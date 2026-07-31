-- World Network — initial schema
-- Per-user data isolation via RLS. Geo via PostGIS.

create extension if not exists postgis;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type view_mode as enum ('cosmopolitan', 'homelover');
create type contact_category as enum ('work', 'private', 'other');
create type contact_source as enum ('google', 'csv', 'manual', 'linkedin_csv');
create type field_type as enum ('text', 'date', 'number', 'select', 'tags', 'boolean');
create type location_type as enum ('residence', 'work');
create type tag_kind as enum ('community', 'label');

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  home_city text,
  home_country text,                       -- ISO-3166 alpha-2
  view_mode_default view_mode not null default 'cosmopolitan',
  languages_spoken text[] not null default '{}',
  share_on_leaderboard boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- contacts
-- ---------------------------------------------------------------------------
create table contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  primary_email text,
  avatar_url text,
  origin_country text,                     -- where they are "from"
  current_city text,
  current_country text,
  category contact_category not null default 'other',
  source contact_source not null default 'manual',
  external_ids jsonb not null default '{}'::jsonb,  -- {google: resourceName, ...}
  custom jsonb not null default '{}'::jsonb,          -- user-defined rubrics
  current_lng double precision,
  current_lat double precision,
  -- generated so PostGIS distance/clustering works without the client touching geometry
  current_geom geography(Point, 4326) generated always as (
    case when current_lng is not null and current_lat is not null
      then ST_SetSRID(ST_MakePoint(current_lng, current_lat), 4326)::geography
    end
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index contacts_user_idx on contacts(user_id);
create index contacts_geom_idx on contacts using gist (current_geom);
create index contacts_email_idx on contacts(user_id, lower(primary_email));

-- ---------------------------------------------------------------------------
-- field_definitions — drives the custom-field UI
-- ---------------------------------------------------------------------------
create table field_definitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,                       -- json key inside contacts.custom
  label text not null,
  type field_type not null default 'text',
  options text[] not null default '{}',    -- for select/tags
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, key)
);
create index field_definitions_user_idx on field_definitions(user_id);

-- ---------------------------------------------------------------------------
-- location_history — backbone of mobility / movement-in-time
-- ---------------------------------------------------------------------------
create table location_history (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  city text,
  country text,
  lng double precision,
  lat double precision,
  geom geography(Point, 4326) generated always as (
    case when lng is not null and lat is not null
      then ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
    end
  ) stored,
  date_from date,
  date_to date,                            -- null = present
  type location_type not null default 'residence',
  source contact_source not null default 'manual',
  note text,
  created_at timestamptz not null default now()
);
create index location_history_contact_idx on location_history(contact_id);
create index location_history_user_idx on location_history(user_id);

-- ---------------------------------------------------------------------------
-- tags + contact_tags (communities / labels)
-- ---------------------------------------------------------------------------
create table tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind tag_kind not null default 'label',
  color text not null default '#6366f1',
  created_at timestamptz not null default now(),
  unique (user_id, name, kind)
);
create index tags_user_idx on tags(user_id);

create table contact_tags (
  contact_id uuid not null references contacts(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (contact_id, tag_id)
);
create index contact_tags_tag_idx on contact_tags(tag_id);

-- ---------------------------------------------------------------------------
-- import_jobs — audit + dedupe for CSV/Google syncs
-- ---------------------------------------------------------------------------
create table import_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source contact_source not null,
  status text not null default 'pending',  -- pending|running|done|error
  raw_file_path text,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index import_jobs_user_idx on import_jobs(user_id);

-- ---------------------------------------------------------------------------
-- user_metrics — materialized per user, powers leaderboard
-- ---------------------------------------------------------------------------
create table user_metrics (
  user_id uuid primary key references auth.users(id) on delete cascade,
  total_contacts int not null default 0,
  intl_contacts int not null default 0,
  cosmopolitan_share numeric(5,2) not null default 0,
  mobility_index numeric(8,2) not null default 0,
  languages_count int not null default 0,
  computed_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger contacts_updated_at before update on contacts
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- new-user bootstrap: create a profile row on signup
-- ---------------------------------------------------------------------------
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict (user_id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security — every table is owner-scoped via user_id = auth.uid()
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table contacts enable row level security;
alter table field_definitions enable row level security;
alter table location_history enable row level security;
alter table tags enable row level security;
alter table contact_tags enable row level security;
alter table import_jobs enable row level security;
alter table user_metrics enable row level security;

-- owner-only full access
create policy "own profile" on profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own contacts" on contacts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own field_definitions" on field_definitions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own location_history" on location_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own tags" on tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own contact_tags" on contact_tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own import_jobs" on import_jobs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- leaderboard: read others' metrics only if they opted in; write only own
create policy "read own metrics" on user_metrics
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from profiles p
      where p.user_id = user_metrics.user_id and p.share_on_leaderboard
    )
  );
create policy "write own metrics" on user_metrics
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
