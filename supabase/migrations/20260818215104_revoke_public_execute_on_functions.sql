-- Functions carried the default PUBLIC EXECUTE grant, so revoking from `anon`
-- alone did nothing. Revoke PUBLIC and re-grant explicitly. ping() keeps anon
-- access for the keepalive workflow.

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig,
           (p.prorettype = 'trigger'::regtype) as is_trigger
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and pg_get_userbyid(p.proowner) = current_user
  loop
    begin
      execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
      if f.is_trigger then
        execute format('grant execute on function %s to service_role', f.sig);
      else
        execute format('grant execute on function %s to authenticated, service_role', f.sig);
      end if;
    exception when insufficient_privilege then
      raise notice 'skipped % (owned by another role)', f.sig;
    end;
  end loop;
end $$;

grant execute on function public.ping() to anon;

-- Signup and contact-audit triggers run outside the app roles.
grant execute on function public.handle_new_user() to supabase_auth_admin;
grant execute on function public.log_contact_event() to authenticated, service_role;
