-- contacts_geo_backup holds a snapshot of contact PII (names, cities, coordinates).
-- It had RLS disabled and full grants to anon/authenticated, so anyone holding the
-- public anon key could read, modify or delete all 630 rows over PostgREST.
-- The data is kept; it is simply no longer reachable from the public API.
-- Nothing in the schema (views, FKs, functions) references this table.

alter table public.contacts_geo_backup enable row level security;
revoke all on table public.contacts_geo_backup from anon, authenticated;

comment on table public.contacts_geo_backup is
  'Geo backup snapshot of public.contacts. RLS enabled with no policies and no API grants: reachable only via the service role / direct DB connection.';
