-- Durable history of contacts added / removed.
-- Written by a trigger, not the client, so the log cannot drift from reality.
-- contact_id is deliberately NOT a foreign key: the history must outlive the contact.

create type contact_event_action as enum ('added', 'removed');

create table contact_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid,
  full_name text not null,
  primary_email text,
  current_city text,
  current_country text,
  category contact_category,
  source contact_source,
  action contact_event_action not null,
  created_at timestamptz not null default now()
);
create index contact_events_user_idx on contact_events(user_id, created_at desc);

create or replace function log_contact_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  c record;
  act contact_event_action;
begin
  if tg_op = 'INSERT' then
    c := new; act := 'added';
  else
    c := old; act := 'removed';
  end if;

  insert into contact_events (
    user_id, contact_id, full_name, primary_email,
    current_city, current_country, category, source, action
  ) values (
    c.user_id, c.id, c.full_name, c.primary_email,
    c.current_city, c.current_country, c.category, c.source, act
  );

  if tg_op = 'INSERT' then return new; else return old; end if;
end $$;

create trigger contacts_log_event
  after insert or delete on contacts
  for each row execute function log_contact_event();

alter table contact_events enable row level security;

-- Read-only from the client; the security-definer trigger does all writing.
-- Delete is allowed so a user can clear their own history on request.
create policy "read own contact_events" on contact_events
  for select using (auth.uid() = user_id);
create policy "delete own contact_events" on contact_events
  for delete using (auth.uid() = user_id);
