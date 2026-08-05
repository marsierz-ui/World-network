-- Supabase free-tier projects pause after ~7 days without activity, which would
-- take the app offline. A scheduled GitHub Action calls ping() to keep the
-- database warm. Single-row table; the write is what registers as activity.

create table keepalive (
  id boolean primary key default true,
  pinged_at timestamptz not null default now(),
  constraint keepalive_single_row check (id)
);
insert into keepalive default values;

alter table keepalive enable row level security;
-- No client policies: all access goes through the security-definer ping() below.

create or replace function ping() returns timestamptz
language sql security definer set search_path = public as $$
  update keepalive set pinged_at = now() where id returning pinged_at;
$$;

grant execute on function ping() to anon;
