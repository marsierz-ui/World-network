// Hands one feedback item to the AI agent. Admin-only.
//
// The admin page calls this with a feedback id once an item has been triaged.
// It fires a GitHub repository_dispatch, which starts
// .github/workflows/feedback-agent.yml: Claude Code implements the change on a
// branch and opens a pull request. Nothing ships until a human merges that PR.
//
// The screenshot travels as a signed Storage URL that expires in an hour - long
// enough for the workflow to start and download it, short enough that the link
// is dead by the time anyone could lift it out of a run. The image itself never
// goes into the dispatch payload (GitHub caps those at a few KB anyway).
//
// Deploy:
//   supabase functions deploy feedback-dispatch
//   supabase secrets set GH_REPO=marsierz-ui/World-network GH_DISPATCH_TOKEN=<fine-grained PAT>
// The PAT needs "Contents: read and write" on that one repository, which is the
// permission repository_dispatch checks.

import { createClient } from 'npm:@supabase/supabase-js@2';

const SCREENSHOT_URL_TTL_S = 60 * 60;

// Same allow-list as google-token: an admin JWT that leaked from the browser
// should not be usable from somebody else's page.
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

// The workflow only accepts these, and falls back to its defaults for anything
// else; filtering here as well keeps junk out of the payload in the first place.
const MODELS = new Set(['opus', 'sonnet', 'haiku']);
const EFFORTS = new Set(['low', 'medium', 'high', 'xhigh']);

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) });

  const jwt = req.headers.get('Authorization')?.replace(/^Bearer /i, '');
  if (!jwt) return json({ ok: false, error: 'unauthorized' }, 401, origin);
  const { data: auth, error: authError } = await admin.auth.getUser(jwt);
  if (authError || !auth.user) return json({ ok: false, error: 'unauthorized' }, 401, origin);

  const { data: isAdmin } = await admin
    .from('admins')
    .select('user_id')
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (!isAdmin) return json({ ok: false, error: 'forbidden' }, 403, origin);

  const repo = Deno.env.get('GH_REPO');
  const ghToken = Deno.env.get('GH_DISPATCH_TOKEN');
  if (!repo || !ghToken) {
    return json({ ok: false, error: 'not configured: set GH_REPO and GH_DISPATCH_TOKEN' }, 500, origin);
  }

  const body = await req.json().catch(() => ({}));
  const feedbackId = Number(body?.feedback_id);
  if (!Number.isInteger(feedbackId) || feedbackId <= 0) {
    return json({ ok: false, error: 'feedback_id required' }, 400, origin);
  }
  const model = MODELS.has(body?.model) ? body.model : 'opus';
  const effort = EFFORTS.has(body?.effort) ? body.effort : 'high';

  const { data: fb, error: fbError } = await admin
    .from('feedback')
    .select('id, text, category, page, user_agent, viewport, admin_note, screenshot_path')
    .eq('id', feedbackId)
    .maybeSingle();
  if (fbError || !fb) return json({ ok: false, error: 'feedback not found' }, 404, origin);

  // A note typed next to the button wins over the saved one, and is saved.
  const note = typeof body?.comment === 'string' && body.comment.trim() ? body.comment.trim() : fb.admin_note ?? '';

  let screenshotUrl = '';
  if (fb.screenshot_path) {
    const { data: signed } = await admin.storage
      .from('feedback')
      .createSignedUrl(fb.screenshot_path, SCREENSHOT_URL_TTL_S);
    screenshotUrl = signed?.signedUrl ?? '';
  }

  const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ghToken}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'world-network-feedback',
    },
    body: JSON.stringify({
      event_type: 'feedback',
      client_payload: {
        id: String(fb.id),
        text: fb.text,
        category: fb.category ?? '',
        page: fb.page ?? '',
        device: [fb.viewport, fb.user_agent].filter(Boolean).join(' | '),
        comment: note,
        screenshot_url: screenshotUrl,
        model,
        effort,
      },
    }),
  });
  if (!res.ok) {
    return json({ ok: false, error: `GitHub dispatch failed: ${res.status} ${await res.text()}` }, 502, origin);
  }

  await admin
    .from('feedback')
    .update({ status: 'dispatched', dispatched_at: new Date().toISOString(), admin_note: note || null })
    .eq('id', fb.id);

  return json({ ok: true }, 200, origin);
});
