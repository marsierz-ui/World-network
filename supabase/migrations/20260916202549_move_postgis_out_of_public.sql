-- PostGIS was installed into `public`, the one schema PostgREST exposes, which
-- put its whole object surface on the public API:
--
--   * public.spatial_ref_sys had RLS off and `arwd` granted to anon and
--     authenticated, so anyone holding the (public by design) anon key could
--     read, rewrite, or DELETE all 8500 projection rows over /rest/v1/. Wiping
--     that table breaks every geography cast, i.e. every contact insert.
--   * public.st_estimatedextent(...) is SECURITY DEFINER and was callable as
--     /rest/v1/rpc/st_estimatedextent by anonymous callers.
--
-- Those objects are owned by supabase_admin, so neither ENABLE ROW LEVEL
-- SECURITY nor REVOKE works from the `postgres` role: a REVOKE issued by
-- anyone other than the grantor silently does nothing, which is why the
-- attempt in 20260818214928 left the grants in place.
--
-- Moving the extension to `extensions` removes the exposure at the root: that
-- schema is not in PostgREST's exposed list, so none of it is reachable over
-- the API any more, and the objects come back owned by `postgres`.
-- `ALTER EXTENSION ... SET SCHEMA` is rejected (PostGIS is not relocatable), so
-- the extension is dropped and recreated. Nothing is lost: the only dependent
-- objects are two STORED GENERATED columns derived from the lng/lat columns,
-- which are recreated below and recompute to the identical values (verified:
-- the geography fingerprint over all 676 contacts is unchanged).

alter table public.contacts drop column current_geom;
alter table public.location_history drop column geom;

-- No CASCADE on purpose: if anything else has come to depend on PostGIS since,
-- this fails and the whole migration rolls back rather than dropping it.
drop extension postgis;
create extension postgis with schema extensions;

alter table public.contacts
  add column current_geom extensions.geography(Point, 4326) generated always as (
    case when current_lng is not null and current_lat is not null
      then (extensions.st_setsrid(extensions.st_makepoint(current_lng, current_lat), 4326))::extensions.geography
    end
  ) stored;

alter table public.location_history
  add column geom extensions.geography(Point, 4326) generated always as (
    case when lng is not null and lat is not null
      then (extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326))::extensions.geography
    end
  ) stored;

create index contacts_geom_idx on public.contacts using gist (current_geom);

-- `postgres` owns the relocated table, so these revokes actually take effect
-- this time. SELECT stays: PostGIS reads spatial_ref_sys from inside the
-- geography cast, as whichever role is doing the insert.
revoke all on table extensions.spatial_ref_sys from anon, authenticated;
grant select on table extensions.spatial_ref_sys to anon, authenticated, service_role;

notify pgrst, 'reload schema';
