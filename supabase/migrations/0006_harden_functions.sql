-- Trigger functions do not need to be callable over PostgREST. Triggers still
-- fire (they run as the table owner), but /rest/v1/rpc/<name> stops being an
-- endpoint. ping() keeps its grant on purpose: the keepalive job calls it.

revoke execute on function handle_new_user() from anon, authenticated;
revoke execute on function log_contact_event() from anon, authenticated;

-- Pin search_path so the function cannot resolve names against a caller-set path.
create or replace function set_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;
