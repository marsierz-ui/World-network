-- No function in `public` should be callable over /rest/v1/rpc/ by an
-- unauthenticated caller. ping() is kept anon-executable because the keepalive
-- workflow calls it with the anon key. handle_new_user() and log_contact_event()
-- are trigger functions and lose EXECUTE from authenticated too.

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.proname <> 'ping'
      and pg_get_userbyid(p.proowner) = current_user
  loop
    execute format('revoke execute on function %s from anon', f.sig);
  end loop;

  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prorettype = 'trigger'::regtype
      and pg_get_userbyid(p.proowner) = current_user
  loop
    execute format('revoke execute on function %s from anon, authenticated', f.sig);
  end loop;
end $$;

revoke all on table public.keepalive from anon, authenticated;
