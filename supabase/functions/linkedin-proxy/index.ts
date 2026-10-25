// Forwards Member Snapshot API calls to LinkedIn.
//
// api.linkedin.com sends no CORS headers, so the browser cannot call it
// directly, and GitHub Pages is a static host with nowhere to put a proxy.
// The browser sends its own LinkedIn token in x-linkedin-token; it is passed
// through and never stored.
//
// Deploy:
//   supabase functions deploy linkedin-proxy

import { createClient } from 'npm:@supabase/supabase-js@2';

const TARGET = 'https://api.linkedin.com/rest/memberSnapshotData';

// Same origin list as google-token; override with ALLOWED_ORIGINS.
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
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-linkedin-token, linkedin-version',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!,
  { auth: { persistSession: false } },
);

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) });

  // Signed-in app users only, so this is not an open relay.
  const jwt = req.headers.get('Authorization')?.replace(/^Bearer /i, '');
  const { data: auth } = jwt ? await supabase.auth.getUser(jwt) : { data: { user: null } };
  if (!auth.user) return new Response('unauthorized', { status: 401, headers: cors(origin) });

  const token = req.headers.get('x-linkedin-token');
  const version = req.headers.get('linkedin-version');
  if (!token || !version) {
    return new Response('missing x-linkedin-token or linkedin-version', {
      status: 400,
      headers: cors(origin),
    });
  }

  const res = await fetch(`${TARGET}${new URL(req.url).search}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Linkedin-Version': version,
    },
  });

  return new Response(await res.text(), {
    status: res.status,
    headers: {
      ...cors(origin),
      'Content-Type': res.headers.get('Content-Type') ?? 'application/json',
    },
  });
});
