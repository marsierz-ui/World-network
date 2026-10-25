// Starts or cancels the deletion of the caller's account.
//
// "request" does not delete anything. It records the request (see
// account_deletions), then stops everything that still reaches into the account:
// the stored Google grant is revoked and dropped, background sync is switched
// off, and any shared history is withdrawn. The data stays for GRACE_DAYS, during
// which the user can sign back in and "cancel". account-purge removes it for good
// afterwards.
//
// Admins cannot request deletion: the owner's data is the one thing here that
// must not go because of a stolen session.
//
// Deploy:
//   supabase functions deploy delete-account

import { createClient } from 'npm:@supabase/supabase-js@2';

const GRACE_DAYS = 30;
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

// Same allow-list as google-token: a leaked JWT is not usable from another page.
const ALLOWED_ORIGINS = (
  Deno.env.get('ALLOWED_ORIGINS') ??
  'https://marsierz-ui.github.io,http://localhost:5173,http://127.0.0.1:5173'
)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

function cors(origin: string | null): Record<string, string> {
  return {
    ...(origin && ALLOWED_ORIGINS.includes(origin)
      ? { 'Access-Control-Allow-Origin': origin }
      : {}),
    Vary: 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

const json = (body: unknown, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), 'Content-Type': 'application/json' },
  });

// App-level outcomes are 200 with ok:false, like google-token, so the client can
// tell a refusal from an unreachable function.
const fail = (reason: string, origin: string | null) => json({ ok: false, reason }, 200, origin);

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) });

  const jwt = req.headers.get('Authorization')?.replace(/^Bearer /i, '');
  if (!jwt) return json({ ok: false, reason: 'unauthorized' }, 401, origin);
  const { data: auth, error: authError } = await admin.auth.getUser(jwt);
  if (authError || !auth.user) return json({ ok: false, reason: 'unauthorized' }, 401, origin);
  const userId = auth.user.id;

  const body = await req.json().catch(() => ({}));
  const action = body?.action;

  if (action === 'cancel') {
    const { error } = await admin.from('account_deletions').delete().eq('user_id', userId);
    if (error) return fail('cancel_failed', origin);
    return json({ ok: true }, 200, origin);
  }
  if (action !== 'request') return fail('unknown_action', origin);

  const { data: isAdmin } = await admin
    .from('admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (isAdmin) return fail('admin_protected', origin);

  // Idempotent: asking again keeps the original date rather than pushing it back,
  // and re-runs the clean-up below in case an earlier attempt stopped half way.
  const { data: existing } = await admin
    .from('account_deletions')
    .select('purge_after')
    .eq('user_id', userId)
    .maybeSingle();
  let purgeAfter: string = existing?.purge_after;
  if (!existing) {
    purgeAfter = new Date(Date.now() + GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await admin
      .from('account_deletions')
      .insert({ user_id: userId, purge_after: purgeAfter });
    if (error) return fail('request_failed', origin);
  }

  const { data: cred } = await admin
    .from('google_credentials')
    .select('refresh_token')
    .eq('user_id', userId)
    .maybeSingle();
  // Best effort: dropping our copy is what matters; Google refuses a revoke for a
  // grant the user already removed on their account page.
  if (cred?.refresh_token) {
    await fetch(`${REVOKE_URL}?token=${encodeURIComponent(cred.refresh_token)}`, {
      method: 'POST',
    }).catch(() => {});
  }
  const dropped = await admin.from('google_credentials').delete().eq('user_id', userId);
  const synced = await admin
    .from('profiles')
    .update({ google_sync_enabled: false })
    .eq('user_id', userId);
  if (dropped.error || synced.error) return fail('cleanup_failed', origin);

  // Withdraw shared history so other users stop seeing it during the grace period.
  // Ignored on failure: the table only exists where that feature is deployed.
  await admin.from('shared_linkedin').delete().eq('user_id', userId);

  return json({ ok: true, purge_after: purgeAfter }, 200, origin);
});
