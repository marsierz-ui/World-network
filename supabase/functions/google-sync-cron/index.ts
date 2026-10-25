// Pulls connected users' Google contacts on a schedule, independent of whether
// anyone has the app open. Called like the keepalive ping (see
// .github/workflows/sync-contacts.yml), but unlike that public, harmless ping,
// this one reads Google contact data and writes to users' rows, so it is gated
// by a shared secret rather than left open.
//
// Two modes, one function, told apart by the request body:
//
//   no user_id  - dispatcher. Asks the database who is due (due_google_syncs:
//                 oldest-synced first), then calls this same function once per
//                 user, all at once. It does no syncing itself.
//   user_id     - worker. Syncs that one user and nothing else.
//
// Each worker is its own invocation, so one user's slow or failing sync cannot
// eat the time budget of the others, and the wall-clock limit applies per user
// instead of to the whole run. Oldest-first with a cap per run means a user that
// keeps failing cannot hold up the ones behind it: it goes to the back of the
// queue each time. At steady state a run covers MAX_USERS_PER_RUN users; beyond
// that, users are reached less often than the interval, never starved.
//
// Scope: pull + import only, not push. Local edits already push to Google as
// soon as they are saved (see src/features/import/googleQueue.ts) - that path
// runs live, in the browser, with the user watching for a mistake. Writing to
// a user's real Google address book unattended, on a timer, is a materially
// bigger risk than reading from it, so this job only ever pulls Google -> here.
//
// Responses carry counts, never user ids: repository workflow logs may be public.
//
// Deploy (apply 20261025130000_account_deletion.sql first - it defines
// due_google_syncs):
//   supabase functions deploy google-sync-cron --no-verify-jwt
//   supabase secrets set CRON_SECRET=$(openssl rand -hex 32)
// (--no-verify-jwt because this is called with a shared secret, not a user
// session - see README.md)

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { fetchGoogleContacts, GoogleApiError } from './pull.ts';
import { findDeletedContactKeys, importForUser } from './sync.ts';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

/** Re-sync a user at most this often, matching the client's own interval - see useGoogleAutoSync.ts. */
const SYNC_INTERVAL_MS = 15 * 60 * 1000;
/** A lock older than this is treated as an abandoned run (the function crashed or timed out), not a live one. */
const LOCK_TTL_MS = 10 * 60 * 1000;
/** Users handed to workers per dispatcher run. */
const MAX_USERS_PER_RUN = 40;
/** How long the dispatcher waits for workers before reporting what it has; they keep running regardless. */
const DISPATCH_WAIT_MS = 120 * 1000;

type Outcome = 'synced' | 'skipped' | 'error';

function dedupeKey(name: string, email?: string | null) {
  return email ? `e:${email.toLowerCase()}` : `n:${name.toLowerCase()}`;
}

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret) return reply({ ok: false, reason: 'not_configured' }, 500);
  if (req.headers.get('x-cron-secret') !== secret) return reply({ ok: false, reason: 'unauthorized' }, 401);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const body = await req.json().catch(() => ({}));
  const userId = typeof body?.user_id === 'string' ? body.user_id : null;
  return userId ? syncOne(admin, userId) : dispatch(admin, secret);
});

async function dispatch(admin: SupabaseClient, secret: string): Promise<Response> {
  const { data, error } = await admin.rpc('due_google_syncs', {
    max_users: MAX_USERS_PER_RUN,
    interval_secs: SYNC_INTERVAL_MS / 1000,
    lock_ttl_secs: LOCK_TTL_MS / 1000,
  });
  if (error) return reply({ ok: false, reason: 'db_error' }, 500);

  const ids = ((data as { user_id: string }[] | null) ?? []).map((r) => r.user_id);
  const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-sync-cron`;
  const counts = { synced: 0, skipped: 0, error: 0, pending: 0 };

  const calls = ids.map(async (id) => {
    let outcome: Outcome = 'error';
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'x-cron-secret': secret, 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: id }),
      });
      const out = await res.json().catch(() => null);
      if (res.ok && (out?.status === 'synced' || out?.status === 'skipped')) outcome = out.status;
    } catch {
      // counted as an error; the user is simply due again on the next run
    }
    counts[outcome]++;
  });

  let timer: number | undefined;
  const giveUp = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, DISPATCH_WAIT_MS);
  });
  await Promise.race([Promise.all(calls), giveUp]);
  clearTimeout(timer);
  counts.pending = ids.length - counts.synced - counts.skipped - counts.error;
  return reply({ ok: true, due: ids.length, ...counts });
}

async function syncOne(admin: SupabaseClient, userId: string): Promise<Response> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  if (!clientId || !clientSecret) return reply({ ok: false, reason: 'not_configured' }, 500);

  // Claim in one statement so two overlapping runs cannot both pass a check and
  // then both sync: only the update that finds the lock free or stale gets a row.
  const staleBefore = new Date(Date.now() - LOCK_TTL_MS).toISOString();
  const { data: claimed } = await admin
    .from('google_credentials')
    .update({ sync_started_at: new Date().toISOString() })
    .eq('user_id', userId)
    .or(`sync_started_at.is.null,sync_started_at.lt.${staleBefore}`)
    .select('refresh_token');
  const cred = (claimed as { refresh_token: string }[] | null)?.[0];
  if (!cred) return reply({ ok: true, status: 'skipped' satisfies Outcome });

  try {
    // Re-read: the dispatcher's view may be a few seconds old, and the user may
    // have switched sync off or been synced by an open tab since.
    const { data: profile } = await admin
      .from('profiles')
      .select('google_sync_enabled,google_last_synced')
      .eq('user_id', userId)
      .maybeSingle();
    const p = profile as { google_sync_enabled: boolean; google_last_synced: string | null } | null;
    const since = p?.google_last_synced ? new Date(p.google_last_synced).getTime() : 0;
    if (!p?.google_sync_enabled || Date.now() - since < SYNC_INTERVAL_MS) {
      return reply({ ok: true, status: 'skipped' satisfies Outcome });
    }

    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: cred.refresh_token,
        grant_type: 'refresh_token',
      }),
    });
    const tokenPayload = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok) {
      if (tokenPayload?.error === 'invalid_grant') {
        // Same terminal case google-token's `access` action handles: the
        // grant was revoked, so drop it rather than retry every run.
        await admin.from('google_credentials').delete().eq('user_id', userId);
      }
      console.error('token refresh failed', tokenPayload?.error ?? tokenRes.status);
      return reply({ ok: true, status: 'error' satisfies Outcome });
    }

    const pulled = await fetchGoogleContacts(tokenPayload.access_token);
    const deletedKeys = await findDeletedContactKeys(admin, userId);
    const importable = pulled.filter((c) => !deletedKeys.has(dedupeKey(c.full_name, c.primary_email)));

    await importForUser(admin, userId, importable, p.google_last_synced);
    await admin.from('profiles').update({ google_last_synced: new Date().toISOString() }).eq('user_id', userId);
    return reply({ ok: true, status: 'synced' satisfies Outcome });
  } catch (e) {
    console.error('sync failed', e instanceof GoogleApiError ? e.message : (e as Error).message);
    return reply({ ok: true, status: 'error' satisfies Outcome });
  } finally {
    await admin.from('google_credentials').update({ sync_started_at: null }).eq('user_id', userId);
  }
}
