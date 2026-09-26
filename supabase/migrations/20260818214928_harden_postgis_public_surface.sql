-- PostGIS objects live in `public`, so PostgREST exposes them.
-- spatial_ref_sys is reference data: keep it readable (PostGIS needs it) but
-- never writable from the API. st_estimatedextent is SECURITY DEFINER and was
-- callable via /rest/v1/rpc/st_estimatedextent by anonymous callers.
-- Best effort: these objects are owned by supabase_admin, so any statement we
-- lack the privilege for is skipped rather than failing the whole migration.
--
-- Follow-up: the spatial_ref_sys revoke below is a silent no-op, because a
-- REVOKE issued by anyone other than the grantor does nothing. The extension is
-- moved out of `public` altogether in 20260916_move_postgis_out_of_public.sql.

do $$
declare f record;
begin
  begin
    execute 'revoke insert, update, delete, truncate on table public.spatial_ref_sys from anon, authenticated';
  exception when insufficient_privilege then
    raise notice 'skipped spatial_ref_sys grants (owned by another role)';
  end;

  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  loop
    begin
      execute format('revoke execute on function %s from anon, authenticated', f.sig);
    exception when insufficient_privilege then
      raise notice 'skipped %', f.sig;
    end;
  end loop;
end $$;
