// Permanently deletes accounts whose deletion grace period has run out.
//
// Called daily by .github/workflows/purge-deleted-accounts.yml with a shared
// secret, like google-sync-cron. This is the only place user data is ever removed
// for good; delete-account only schedules it. Deleting the auth user cascades to
// every table (all reference auth.users on delete cascade), so the one call
// removes the contacts, tags, history, profile and credentials. The private
// `feedback` bucket is not covered by that cascade, so its folder goes first.
//
// Admins are skipped and their pending request is dropped: delete-account refuses
// them, so a row here means something else wrote it.
//
// The response carries counts only. Repository workflow logs may be public, and a
// user id in them is not something to publish.
//
// Deploy:
//   supabase functions deploy account-purge --no-verify-jwt
// and set CRON_SECRET (shared with google-sync-cron).

import { createClient } from 'npm:@supabase/supabase-js@2';

const BATCH = 25;
const BUCKET = 'feedback';

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

async function removeStorageFolder(userId: string) {
  const bucket = admin.storage.from(BUCKET);
  // Bounded so a remove that silently does nothing cannot spin forever.
  for (let page = 0; page < 10; page++) {
    const { data, error } = await bucket.list(userId, { limit: 1000 });
    if (error) throw error;
    if (!data?.length) return;
    const { error: rmError } = await bucket.remove(data.map((f) => `${userId}/${f.name}`));
    if (rmError) throw rmError;
    if (data.length < 1000) return;
  }
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret) return reply({ ok: false, reason: 'not_configured' }, 500);
  if (req.headers.get('x-cron-secret') !== secret) return reply({ ok: false, reason: 'unauthorized' }, 401);

  const { data: due, error } = await admin
    .from('account_deletions')
    .select('user_id')
    .lte('purge_after', new Date().toISOString())
    .order('purge_after')
    .limit(BATCH);
  if (error) return reply({ ok: false, reason: 'db_error' }, 500);

  const counts = { deleted: 0, skipped_admin: 0, error: 0 };
  for (const { user_id: userId } of (due as { user_id: string }[] | null) ?? []) {
    const { data: isAdmin } = await admin
      .from('admins')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (isAdmin) {
      await admin.from('account_deletions').delete().eq('user_id', userId);
      counts.skipped_admin++;
      continue;
    }
    try {
      await removeStorageFolder(userId);
      const { error: delError } = await admin.auth.admin.deleteUser(userId);
      if (delError) throw delError;
      counts.deleted++;
    } catch (e) {
      console.error('purge failed', (e as Error).message);
      counts.error++;
    }
  }
  return reply({ ok: true, ...counts, remaining_batch_full: (due?.length ?? 0) === BATCH });
});
