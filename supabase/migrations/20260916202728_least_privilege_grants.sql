-- Defence in depth for the app tables: RLS is the only thing standing between a
-- signed-out caller holding the (public by design) anon key and every row of
-- contacts, profiles and location history. Table grants are the layer under it,
-- and right now `anon` holds INSERT/SELECT/UPDATE/DELETE on all of them, so a
-- single dropped or mis-edited policy would expose the whole dataset instead of
-- failing closed. Nothing in the app reads or writes as `anon`: every query runs
-- after sign-in. So take the grants away and leave RLS as the second lock, not
-- the only one.

revoke all on table
  public.profiles,
  public.contacts,
  public.field_definitions,
  public.location_history,
  public.tags,
  public.contact_tags,
  public.import_jobs,
  public.user_metrics,
  public.contact_events
from anon;

-- contact_events is written only by the log_contact_event() trigger, so that the
-- audit log cannot drift from reality. RLS already allows the client nothing but
-- SELECT and DELETE; match the grants to that, so a forged row is refused by the
-- privilege check and not only by a policy.
revoke insert, update, truncate on table public.contact_events from authenticated;

-- Root cause of both this and the contacts_geo_backup exposure fixed in
-- 20260818214837: Supabase's default privileges hand `anon` full rights on every
-- table created in `public` and EXECUTE on every function, so an ad-hoc table
-- created in the SQL editor is world-readable over PostgREST the moment it
-- exists. New objects now start closed for `anon`; `authenticated` keeps its
-- defaults, so a new app table still works behind its RLS policies.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;

-- ping() stays anon-callable: the keepalive workflow runs on a schedule with the
-- anon key and nothing else. It is SECURITY DEFINER, so limit the damage an
-- unmetered caller can do - past the first write in a minute it becomes a plain
-- read and still returns the timestamp the workflow checks for.
create or replace function public.ping() returns timestamptz
language sql security definer set search_path = public as $$
  with bumped as (
    update keepalive set pinged_at = now()
    where id and pinged_at < now() - interval '1 minute'
    returning pinged_at
  )
  select coalesce(
    (select pinged_at from bumped),
    (select pinged_at from keepalive where id)
  );
$$;

-- CREATE OR REPLACE keeps the existing ACL, so state the intended one outright.
revoke all on function public.ping() from public, authenticated;
grant execute on function public.ping() to anon, service_role;

comment on table public.keepalive is
  'Single row touched by ping() so the free-tier project does not pause. RLS enabled with no policies and no client grants on purpose: the only way in is the security-definer ping().';

notify pgrst, 'reload schema';
