// Keeps the Google connection alive across tabs, reloads and days.
//
// Supabase hands the browser a Google refresh token exactly once, on the OAuth
// redirect, and never again. Exchanging it for a fresh access token needs the
// OAuth client secret, which cannot live in a static site - so it happens here.
// The browser posts the refresh token once ("store") and afterwards only ever
// asks for a short-lived access token ("access"); it never sees the refresh
// token again.
//
// Deploy:
//   supabase functions deploy google-token
//   supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...
// (the same client id/secret as the Google provider in Supabase Auth)

import { createClient } from 'npm:@supabase/supabase-js@2';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

// This function mints Google access tokens, so it answers the app's own origins
// and nobody else's. `*` would let any page on the internet call it and read the
// token out of the response with a JWT that leaked from the browser.
// Override for another deployment with:
//   supabase secrets set ALLOWED_ORIGINS=https://example.com,https://www.example.com
const ALLOWED_ORIGINS = (
  Deno.env.get('ALLOWED_ORIGINS') ??
  'https://marsierz-ui.github.io,http://localhost:5173,http://127.0.0.1:5173'
)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// An origin that is not on the list gets no Allow-Origin header at all, which is
// what makes the browser refuse the response. Vary: Origin keeps a cache from
// handing one origin's answer to another.
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

// Application-level outcomes are 200 with ok:false, not HTTP errors: the client
// has to tell "you are not connected" (act on it) from "the function is not
// deployed / unreachable" (fall back to the session token), and an HTTP error
// code cannot carry that difference through supabase-js.
const fail = (reason: string, detail?: string, origin: string | null = null) =>
  json({ ok: false, reason, detail }, 200, origin);

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

  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

  const body = await req.json().catch(() => ({}));
  const action = body?.action ?? 'access';

  if (action === 'store') {
    const refreshToken = body?.refresh_token;
    if (typeof refreshToken !== 'string' || !refreshToken) return fail('missing_refresh_token', undefined, origin);
    const { error } = await admin.from('google_credentials').upsert({
      user_id: userId,
      refresh_token: refreshToken,
      scope: typeof body?.scope === 'string' ? body.scope : null,
      updated_at: new Date().toISOString(),
    });
    if (error) return fail('store_failed', error.message, origin);
    return json({ ok: true }, 200, origin);
  }

  if (action === 'status') {
    const { data } = await admin
      .from('google_credentials')
      .select('updated_at')
      .eq('user_id', userId)
      .maybeSingle();
    return json({ ok: true, connected: !!data, configured: !!(clientId && clientSecret) }, 200, origin);
  }

  if (action === 'disconnect') {
    const { data } = await admin
      .from('google_credentials')
      .select('refresh_token')
      .eq('user_id', userId)
      .maybeSingle();
    // Best effort: dropping our copy is what matters, and Google refuses a
    // revoke for a grant the user already removed on their account page.
    if (data?.refresh_token) {
      await fetch(`${REVOKE_URL}?token=${encodeURIComponent(data.refresh_token)}`, {
        method: 'POST',
      }).catch(() => {});
    }
    await admin.from('google_credentials').delete().eq('user_id', userId);
    return json({ ok: true }, 200, origin);
  }

  if (action !== 'access') return fail('unknown_action', String(action), origin);

  if (!clientId || !clientSecret) return fail('not_configured', undefined, origin);

  const { data: cred } = await admin
    .from('google_credentials')
    .select('refresh_token')
    .eq('user_id', userId)
    .maybeSingle();
  if (!cred?.refresh_token) return fail('no_refresh_token', undefined, origin);

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: cred.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const payload = await res.json().catch(() => ({}));

  if (!res.ok) {
    // invalid_grant is terminal: the grant was revoked in the Google account, or
    // the refresh token expired. Drop it so the UI stops claiming a connection
    // and asks for a reconnect instead of retrying forever.
    if (payload?.error === 'invalid_grant') {
      await admin.from('google_credentials').delete().eq('user_id', userId);
      return fail('reconnect_required', payload?.error_description, origin);
    }
    return fail('google_error', payload?.error_description ?? payload?.error ?? String(res.status), origin);
  }

  return json(
    {
      ok: true,
      access_token: payload.access_token,
      expires_in: payload.expires_in ?? 3600,
      scope: payload.scope ?? null,
    },
    200,
    origin,
  );
});
