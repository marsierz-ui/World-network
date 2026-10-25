-- Account deletion with a grace period, and the query the per-user sync fan-out
-- uses to pick who is due.
--
-- Deleting an account is not immediate. The delete-account Edge Function records
-- a row here, stops everything that touches the account (Google sync, the Google
-- grant, shared history) and signs the user out. Nothing is removed for
-- GRACE_DAYS (30, set in the function); signing back in shows a restore screen,
-- and restoring deletes the row. Only account-purge, a daily job, permanently
-- deletes the auth user once purge_after has passed - every table references
-- auth.users on delete cascade, so that removes the data with it. Admins are
-- never purged.
--
-- Written only by the service role (the two functions). The client may read its
-- own row so the app can show the restore screen without calling a function on
-- every page load.

create table if not exists public.account_deletions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  requested_at timestamptz not null default now(),
  purge_after timestamptz not null
);

alter table public.account_deletions enable row level security;

drop policy if exists "read own account_deletions" on public.account_deletions;
create policy "read own account_deletions" on public.account_deletions
  for select to authenticated using (auth.uid() = user_id);

revoke all on public.account_deletions from anon, authenticated;
grant select on public.account_deletions to authenticated;

comment on table public.account_deletions is
  'Accounts waiting out their deletion grace period. Select-own for the client; written only by the delete-account and account-purge Edge Functions (service role).';

-- Who google-sync-cron should sync next: connected, sync switched on, not synced
-- within the interval, not locked by a live run. Oldest first (never-synced
-- first), so a user that keeps failing cannot hold up the ones behind it and a
-- large backlog drains evenly. Service role only: it reads google_credentials.
create or replace function public.due_google_syncs(
  max_users int,
  interval_secs int,
  lock_ttl_secs int
) returns table (user_id uuid)
language sql stable security definer set search_path = public as $$
  select c.user_id
  from google_credentials c
  join profiles p on p.user_id = c.user_id
  where p.google_sync_enabled
    and (p.google_last_synced is null
         or p.google_last_synced < now() - make_interval(secs => interval_secs))
    and (c.sync_started_at is null
         or c.sync_started_at < now() - make_interval(secs => lock_ttl_secs))
  order by p.google_last_synced asc nulls first
  limit max_users;
$$;

revoke all on function public.due_google_syncs(int, int, int) from public, anon, authenticated;
grant execute on function public.due_google_syncs(int, int, int) to service_role;

notify pgrst, 'reload schema';
