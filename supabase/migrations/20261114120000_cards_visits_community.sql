-- Member cards, links between members, city-level location, visit notices, and
-- the pieces shared with the other apps in the same Supabase project.
--
--   * A member's card is the part of their profile they agree to hand over. It
--     is reached through profiles.share_token (the QR code and the invite link
--     carry it). Accepting an invite swaps cards: each side gets the other as a
--     contact, and a contact_links row records which contact is which member.
--   * contact_links is written only by security-definer functions. A client
--     that could write it could claim a link to any member and then read their
--     city or send them notices.
--   * Location is the city the member is in, never a position: the browser
--     snaps its reading to the nearest city and stores that city's coordinates.
--   * A visit notice goes only to members the sender is linked with.
--   * profiles, apps and feedback are app-neutral: every app in this project
--     signs in against the same auth.users and reads the same profile.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
alter table profiles add column if not exists share_token uuid not null default gen_random_uuid();
create unique index if not exists profiles_share_token_idx on profiles (share_token);
-- Which parts of the profile the card carries: phone, emails, socials, home.
-- The display name is always on it.
alter table profiles add column if not exists share_fields text[] not null
  default '{phone,emails,socials,home}';
alter table profiles add column if not exists home_lng double precision;
alter table profiles add column if not exists home_lat double precision;
alter table profiles add column if not exists location_enabled boolean not null default false;
alter table profiles add column if not exists current_city text;
alter table profiles add column if not exists current_country text;
alter table profiles add column if not exists current_lng double precision;
alter table profiles add column if not exists current_lat double precision;
alter table profiles add column if not exists location_updated_at timestamptz;
-- Consent to take the home city from the member's own LinkedIn profile.
alter table profiles add column if not exists linkedin_location_consent boolean not null default false;

-- ---------------------------------------------------------------------------
-- contact_links: this contact of mine is that member
-- ---------------------------------------------------------------------------
create table if not exists public.contact_links (
  contact_id uuid primary key references contacts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  peer_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, peer_id)
);
create index if not exists contact_links_peer_idx on public.contact_links (peer_id);

alter table public.contact_links enable row level security;

drop policy if exists "read own contact_links" on public.contact_links;
create policy "read own contact_links" on public.contact_links
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "delete own contact_links" on public.contact_links;
create policy "delete own contact_links" on public.contact_links
  for delete to authenticated using (auth.uid() = user_id);

revoke all on public.contact_links from anon, authenticated;
grant select, delete on public.contact_links to authenticated;

-- A link is mutual. Dropping one side (unlinking, or deleting the contact)
-- drops the other, so neither member can go on reaching someone who left.
create or replace function public.contact_links_drop_mirror() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from contact_links where user_id = old.peer_id and peer_id = old.user_id;
  return old;
end $$;

revoke execute on function public.contact_links_drop_mirror() from public, anon, authenticated;

drop trigger if exists contact_links_drop_mirror on public.contact_links;
create trigger contact_links_drop_mirror after delete on public.contact_links
  for each row execute function public.contact_links_drop_mirror();

-- ---------------------------------------------------------------------------
-- cards
-- ---------------------------------------------------------------------------

-- Puts `subject`'s card into `owner`'s contacts and links it. An existing
-- contact with the same email or phone is adopted instead of duplicated, and
-- only its empty fields are filled: what the owner typed stays.
create or replace function public.link_card(owner uuid, subject uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  p profiles;
  login_email text;
  v_name text;
  v_emails text[] := '{}';
  v_phone text;
  v_socials jsonb := '{}'::jsonb;
  v_city text;
  v_country text;
  v_lng double precision;
  v_lat double precision;
  cid uuid;
begin
  select * into p from profiles where user_id = subject;
  select lower(email) into login_email from auth.users where id = subject;

  v_name := coalesce(
    nullif(trim(p.display_name), ''),
    nullif(split_part(login_email, '@', 1), ''),
    'World Network member'
  );
  if 'emails' = any(p.share_fields) then
    v_emails := array_remove(
      array[login_email] || array(
        select lower(e) from unnest(p.emails) e where lower(e) is distinct from login_email
      ),
      null
    );
  end if;
  if 'phone' = any(p.share_fields) then
    v_phone := nullif(trim(p.phone), '');
  end if;
  if 'socials' = any(p.share_fields) then
    v_socials := p.socials;
  end if;
  if 'home' = any(p.share_fields) then
    v_city := p.home_city;
    v_country := p.home_country;
    v_lng := p.home_lng;
    v_lat := p.home_lat;
  end if;

  select contact_id into cid from contact_links where user_id = owner and peer_id = subject;

  if cid is null then
    select c.id into cid
    from contacts c
    where c.user_id = owner
      and not exists (select 1 from contact_links l where l.contact_id = c.id)
      and (lower(c.primary_email) = any(v_emails) or phone_key(c.phone) = phone_key(v_phone))
    order by c.created_at
    limit 1;
  end if;

  if cid is null then
    insert into contacts (
      user_id, full_name, primary_email, phone, source, socials, details,
      current_city, current_country, current_lng, current_lat
    ) values (
      owner, v_name, v_emails[1], v_phone, 'invite', v_socials,
      jsonb_strip_nulls(jsonb_build_object(
        'emails', (select jsonb_agg(jsonb_build_object('label', '', 'value', e)) from unnest(v_emails) e),
        'phones', case when v_phone is not null
          then jsonb_build_array(jsonb_build_object('label', '', 'value', v_phone)) end
      )),
      v_city, v_country, v_lng, v_lat
    )
    returning id into cid;
  else
    update contacts c set
      primary_email = coalesce(c.primary_email, v_emails[1]),
      phone = coalesce(c.phone, v_phone),
      socials = v_socials || c.socials,
      current_city = case when c.current_lng is null and v_lng is not null then v_city else c.current_city end,
      current_country = case when c.current_lng is null and v_lng is not null then v_country else c.current_country end,
      current_lat = case when c.current_lng is null and v_lng is not null then v_lat else c.current_lat end,
      current_lng = coalesce(c.current_lng, v_lng),
      sources = case when 'invite' = any(c.sources) then c.sources else c.sources || 'invite'::contact_source end
    where c.id = cid;
  end if;

  insert into contact_links (contact_id, user_id, peer_id)
  values (cid, owner, subject)
  on conflict do nothing;

  return cid;
end $$;

revoke execute on function public.link_card(uuid, uuid) from public, anon, authenticated;

-- What the invite screen shows before the caller decides. Name and home only,
-- whatever the card would hand over once accepted.
create or replace function public.invite_preview(token uuid)
returns table (display_name text, home_city text, home_country text, is_self boolean, linked boolean)
language sql stable security definer set search_path = public as $$
  select
    coalesce(nullif(trim(p.display_name), ''), 'A World Network member'),
    case when 'home' = any(p.share_fields) then p.home_city end,
    case when 'home' = any(p.share_fields) then p.home_country end,
    p.user_id = auth.uid(),
    exists (select 1 from contact_links l where l.user_id = auth.uid() and l.peer_id = p.user_id)
  from profiles p
  where p.share_token = token;
$$;

revoke execute on function public.invite_preview(uuid) from public, anon;
grant execute on function public.invite_preview(uuid) to authenticated;

-- Swaps cards with whoever owns the token. Returns the caller's new (or
-- adopted) contact. The inviter agreed by handing out the token, the caller
-- by calling this; rotating share_token ends the inviter's side.
create or replace function public.accept_invite(token uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  inviter uuid;
  cid uuid;
begin
  if me is null then
    raise exception 'not_signed_in';
  end if;
  select user_id into inviter from profiles where share_token = token;
  if inviter is null then
    raise exception 'invite_not_found';
  end if;
  if inviter = me then
    raise exception 'own_invite';
  end if;
  cid := link_card(me, inviter);
  perform link_card(inviter, me);
  return cid;
end $$;

revoke execute on function public.accept_invite(uuid) from public, anon;
grant execute on function public.accept_invite(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- where linked members are, for those who share it
-- ---------------------------------------------------------------------------
create or replace function public.linked_locations()
returns table (
  contact_id uuid,
  city text,
  country text,
  lng double precision,
  lat double precision,
  updated_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select l.contact_id, p.current_city, p.current_country, p.current_lng, p.current_lat,
         p.location_updated_at
  from contact_links l
  join profiles p on p.user_id = l.peer_id
  where l.user_id = auth.uid()
    and p.location_enabled
    and p.current_city is not null
    and p.location_updated_at > now() - interval '30 days';
$$;

revoke execute on function public.linked_locations() from public, anon;
grant execute on function public.linked_locations() to authenticated;

-- ---------------------------------------------------------------------------
-- visit notices: "I am in your city, let's catch up"
-- ---------------------------------------------------------------------------
create table if not exists public.visit_notices (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  -- Copied at send time, so the notice reads the same if the link later goes.
  from_name text not null,
  city text,
  country text,
  date_from date,
  date_to date,
  message text check (char_length(message) <= 1000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists visit_notices_to_idx on public.visit_notices (to_user, created_at desc);
create index if not exists visit_notices_from_idx on public.visit_notices (from_user, created_at desc);

alter table public.visit_notices enable row level security;

drop policy if exists "read own visit_notices" on public.visit_notices;
create policy "read own visit_notices" on public.visit_notices
  for select to authenticated using (auth.uid() = to_user or auth.uid() = from_user);

drop policy if exists "mark own visit_notices read" on public.visit_notices;
create policy "mark own visit_notices read" on public.visit_notices
  for update to authenticated using (auth.uid() = to_user) with check (auth.uid() = to_user);

drop policy if exists "delete own visit_notices" on public.visit_notices;
create policy "delete own visit_notices" on public.visit_notices
  for delete to authenticated using (auth.uid() = to_user or auth.uid() = from_user);

-- Sending goes through send_visit_notice(); the recipient can only flip read_at.
revoke all on public.visit_notices from anon, authenticated;
grant select, delete on public.visit_notices to authenticated;
grant update (read_at) on public.visit_notices to authenticated;

create or replace function public.send_visit_notice(
  contact_ids uuid[],
  p_city text,
  p_country text,
  p_from date,
  p_to date,
  p_message text
) returns int
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  sender text;
  sent int;
begin
  if me is null then
    raise exception 'not_signed_in';
  end if;
  -- A day's worth for a real trip; a ceiling for a stolen session.
  if (select count(*) from visit_notices
      where from_user = me and created_at > now() - interval '1 day')
     + coalesce(array_length(contact_ids, 1), 0) > 200 then
    raise exception 'too_many_notices';
  end if;

  select coalesce(nullif(trim(p.display_name), ''), split_part(u.email, '@', 1))
  into sender
  from auth.users u left join profiles p on p.user_id = u.id
  where u.id = me;

  insert into visit_notices (from_user, to_user, from_name, city, country, date_from, date_to, message)
  select me, l.peer_id, sender, p_city, p_country, p_from, p_to, nullif(left(trim(p_message), 1000), '')
  from contact_links l
  where l.user_id = me and l.contact_id = any(contact_ids);

  get diagnostics sent = row_count;
  return sent;
end $$;

revoke execute on function public.send_visit_notice(uuid[], text, text, date, date, text) from public, anon;
grant execute on function public.send_visit_notice(uuid[], text, text, date, date, text) to authenticated;

-- ---------------------------------------------------------------------------
-- apps: the other apps a member can open with the same account
-- ---------------------------------------------------------------------------
-- Managed from the SQL editor. Each app lists the others, so launching a new
-- one advertises it in all of them without a deploy:
--   insert into public.apps (slug, name, tagline, url, sort_order)
--   values ('photomap', 'Photomap', 'Your photos on the map.', 'https://photomap.example', 20);
create table if not exists public.apps (
  slug text primary key,
  name text not null,
  tagline text,
  url text not null,
  sort_order int not null default 0,
  active boolean not null default true
);

alter table public.apps enable row level security;

drop policy if exists "read active apps" on public.apps;
create policy "read active apps" on public.apps
  for select to authenticated using (active);

revoke all on public.apps from anon, authenticated;
grant select on public.apps to authenticated;

-- ---------------------------------------------------------------------------
-- feedback: one inbox for every app
-- ---------------------------------------------------------------------------
alter table public.feedback add column if not exists app text not null default 'world-network';
grant insert (app) on public.feedback to authenticated;

notify pgrst, 'reload schema';
