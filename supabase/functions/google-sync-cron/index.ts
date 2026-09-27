// Pulls every connected user's Google contacts on a schedule, independent of
// whether anyone has the app open. Deploy and call this the same way as the
// keepalive ping (see .github/workflows/sync-contacts.yml), but unlike that
// public, harmless ping, this one reads Google contact data and writes to
// every synced user's row, so it is gated by a shared secret rather than left
// open.
//
// Scope: pull + import only, not push. Local edits already push to Google as
// soon as they are saved (see src/features/import/googleQueue.ts) - that path
// runs live, in the browser, with the user watching for a mistake. Writing to
// a user's real Google address book unattended, on a timer, for every synced
// account is a materially bigger risk than reading from it, so this job only
// ever pulls Google -> here. `useGoogleSync`'s interactive "Sync now" (or the
// per-tab background sync while a tab is open) remains what reconciles edits
// made while disconnected back out to Google.
//
// Deploy:
//   supabase functions deploy google-sync-cron --no-verify-jwt
//   supabase secrets set CRON_SECRET=$(openssl rand -hex 32)
// (--no-verify-jwt because this is called with a shared secret, not a user
// session - see README.md)
//
// One request handles every eligible user in a loop; for the handful of users
// this app is built for that comfortably fits an Edge Function invocation.
// It is not built to scale to a large multi-tenant user base without paging.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { fetchGoogleContacts, GoogleApiError } from './pull.ts';
import { findDeletedContactKeys, importForUser } from './sync.ts';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

/** Re-sync a user at most this often, matching the client's own interval - see useGoogleAutoSync.ts. */
const SYNC_INTERVAL_MS = 15 * 60 * 1000;
/** A lock older than this is treated as an abandoned run (the function crashed or timed out), not a live one. */
const LOCK_TTL_MS = 10 * 60 * 1000;

function dedupeKey(name: string, email?: string | null) {
  return email ? `e:${email.toLowerCase()}` : `n:${name.toLowerCase()}`;
}

interface RunResult {
  user_id: string;
  status: 'synced' | 'skipped' | 'error';
  detail?: string;
  inserted?: number;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret) {
    return new Response(JSON.stringify({ ok: false, reason: 'not_configured' }), { status: 500 });
  }
  if (req.headers.get('x-cron-secret') !== secret) {
    return new Response(JSON.stringify({ ok: false, reason: 'unauthorized' }), { status: 401 });
  }

  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    return new Response(JSON.stringify({ ok: false, reason: 'not_configured' }), { status: 500 });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const { data: creds, error: credsError } = await admin
    .from('google_credentials')
    .select('user_id,refresh_token,sync_started_at');
  if (credsError) {
    return new Response(JSON.stringify({ ok: false, reason: 'db_error', detail: credsError.message }), { status: 500 });
  }
  const rows = (creds as { user_id: string; refresh_token: string; sync_started_at: string | null }[] | null) ?? [];
  if (!rows.length) return new Response(JSON.stringify({ ok: true, results: [] }));

  const { data: profiles } = await admin
    .from('profiles')
    .select('user_id,google_sync_enabled,google_last_synced')
    .in('user_id', rows.map((r) => r.user_id));
  const profileByUser = new Map(
    ((profiles as { user_id: string; google_sync_enabled: boolean; google_last_synced: string | null }[] | null) ?? []).map(
      (p) => [p.user_id, p],
    ),
  );

  const now = Date.now();
  const results: RunResult[] = [];

  for (const cred of rows) {
    const profile = profileByUser.get(cred.user_id);
    if (!profile?.google_sync_enabled) {
      results.push({ user_id: cred.user_id, status: 'skipped', detail: 'sync_disabled' });
      continue;
    }
    const since = profile.google_last_synced ? new Date(profile.google_last_synced).getTime() : 0;
    if (now - since < SYNC_INTERVAL_MS) {
      results.push({ user_id: cred.user_id, status: 'skipped', detail: 'recently_synced' });
      continue;
    }
    const lockedAt = cred.sync_started_at ? new Date(cred.sync_started_at).getTime() : 0;
    if (lockedAt && now - lockedAt < LOCK_TTL_MS) {
      results.push({ user_id: cred.user_id, status: 'skipped', detail: 'sync_in_progress' });
      continue;
    }

    await admin.from('google_credentials').update({ sync_started_at: new Date().toISOString() }).eq('user_id', cred.user_id);

    try {
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
          await admin.from('google_credentials').delete().eq('user_id', cred.user_id);
        }
        results.push({ user_id: cred.user_id, status: 'error', detail: tokenPayload?.error ?? `token_${tokenRes.status}` });
        continue;
      }
      const accessToken: string = tokenPayload.access_token;

      const pulled = await fetchGoogleContacts(accessToken);
      const deletedKeys = await findDeletedContactKeys(admin, cred.user_id);
      const importable = pulled.filter((c) => !deletedKeys.has(dedupeKey(c.full_name, c.primary_email)));

      const summary = await importForUser(admin, cred.user_id, importable);

      await admin.from('profiles').update({ google_last_synced: new Date().toISOString() }).eq('user_id', cred.user_id);
      results.push({ user_id: cred.user_id, status: 'synced', inserted: summary.inserted });
    } catch (e) {
      const detail = e instanceof GoogleApiError ? e.message : (e as Error).message;
      results.push({ user_id: cred.user_id, status: 'error', detail });
    } finally {
      await admin.from('google_credentials').update({ sync_started_at: null }).eq('user_id', cred.user_id);
    }
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
