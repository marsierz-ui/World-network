-- 1. Every source a contact came from, not just the first.
--
-- `source` records only the import that created the row; a Google contact later
-- found again in a LinkedIn import kept saying "google". `sources` collects
-- them all for badges and filtering. `source` stays as the creating import.

alter table contacts add column if not exists sources contact_source[] not null default '{}';

update contacts set sources = array[source] where sources = '{}';

-- Rows linked to a Google contact came from Google whatever created them.
update contacts set sources = sources || 'google'::contact_source
where external_ids ? 'google' and not ('google' = any(sources));

-- Keeps `source` inside `sources` for every writer, including the
-- google-sync-cron function, without each one having to remember.
create or replace function public.contacts_include_source() returns trigger
language plpgsql set search_path = public as $$
begin
  if not (new.source = any(new.sources)) then
    new.sources := new.sources || new.source;
  end if;
  return new;
end $$;

revoke execute on function public.contacts_include_source() from public, anon, authenticated;

drop trigger if exists contacts_include_source on contacts;
create trigger contacts_include_source before insert or update of source, sources on contacts
  for each row execute function public.contacts_include_source();

-- Called by an import for the existing contacts it matched. Security invoker,
-- so RLS limits it to the caller's own rows.
create or replace function public.add_contact_source(ids uuid[], src contact_source) returns void
language sql security invoker set search_path = public as $$
  update contacts set sources = sources || src
  where id = any(ids) and not (src = any(sources));
$$;

revoke execute on function public.add_contact_source(uuid[], contact_source) from public, anon;
grant execute on function public.add_contact_source(uuid[], contact_source) to authenticated;

-- 2. Who a user is, so other users' contacts can be matched to them.
--
-- Owner-only like the rest of profiles. The login email and phone in
-- auth.users count too; these add the ones a user signs in without.

alter table profiles add column if not exists phone text;
alter table profiles add column if not exists emails text[] not null default '{}';
alter table profiles add column if not exists socials jsonb not null default '{}'::jsonb;

-- Last 9 digits of a 7+ digit number, so +49 151..., 0151... and spaced forms
-- compare equal. Same rule as phoneKeys() in useImport.ts.
create or replace function public.phone_key(v text) returns text
language sql immutable set search_path = public as $$
  select case when length(d) >= 7 then right(d, 9) end
  from (select regexp_replace(coalesce(v, ''), '\D', '', 'g') as d) x;
$$;

-- "https://www.linkedin.com/in/Jane-Doe-123/?x" and "jane-doe-123" -> "jane-doe-123"
create or replace function public.linkedin_slug(v text) returns text
language sql immutable set search_path = public as $$
  select nullif(lower(regexp_replace(
    regexp_replace(coalesce(v, ''), '^.*linkedin\.com/in/', '', 'i'),
    '[/?#].*$', '')), '');
$$;

revoke execute on function public.phone_key(text) from public, anon;
revoke execute on function public.linkedin_slug(text) from public, anon;
grant execute on function public.phone_key(text) to authenticated;
grant execute on function public.linkedin_slug(text) to authenticated;

-- 3. Opt-in sharing of a member's own LinkedIn history with their contacts.
--
-- A row exists only while its owner shares; turning sharing off deletes it.
-- Only the owner reads the table directly. Others see an entry only through
-- shared_linkedin_for_my_contacts(), and only on a contact of theirs whose
-- email, phone or LinkedIn URL matches the owner's identity above.

create table if not exists public.shared_linkedin (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  headline text,
  positions jsonb not null default '[]'::jsonb,  -- [{company,title,location,from,to}]
  education jsonb not null default '[]'::jsonb,  -- [{school,degree,from,to}]
  updated_at timestamptz not null default now()
);

alter table public.shared_linkedin enable row level security;

drop policy if exists "own shared_linkedin" on public.shared_linkedin;
create policy "own shared_linkedin" on public.shared_linkedin
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on table public.shared_linkedin from anon;

create or replace function public.shared_linkedin_for_my_contacts()
returns table (
  contact_id uuid,
  full_name text,
  headline text,
  positions jsonb,
  education jsonb,
  updated_at timestamptz
)
language sql stable security definer set search_path = public as $$
  with sharer as (
    select
      s.*,
      array(
        select lower(e) from unnest(p.emails || u.email::text) e where e is not null
      ) as emails,
      array(
        select k from unnest(array[p.phone, u.phone::text]) ph, phone_key(ph) k where k is not null
      ) as phones,
      linkedin_slug(p.socials->>'linkedin') as slug
    from shared_linkedin s
    join auth.users u on u.id = s.user_id
    left join profiles p on p.user_id = s.user_id
    where s.user_id <> auth.uid()
  ),
  mine as (
    select
      c.id,
      array(
        select lower(v) from (
          select c.primary_email as v
          union all
          select e->>'value' from jsonb_array_elements(
            case when jsonb_typeof(c.details->'emails') = 'array' then c.details->'emails' else '[]'::jsonb end
          ) e
        ) x where v is not null
      ) as emails,
      array(
        select k from (
          select c.phone as v
          union all
          select e->>'value' from jsonb_array_elements(
            case when jsonb_typeof(c.details->'phones') = 'array' then c.details->'phones' else '[]'::jsonb end
          ) e
        ) x, phone_key(v) k where k is not null
      ) as phones,
      linkedin_slug(c.socials->>'linkedin') as slug
    from contacts c
    where c.user_id = auth.uid()
  )
  select distinct on (m.id)
    m.id, s.full_name, s.headline, s.positions, s.education, s.updated_at
  from mine m
  join sharer s on m.emails && s.emails or m.phones && s.phones or m.slug = s.slug
  order by m.id, s.updated_at desc;
$$;

revoke execute on function public.shared_linkedin_for_my_contacts() from public, anon;
grant execute on function public.shared_linkedin_for_my_contacts() to authenticated;

notify pgrst, 'reload schema';
