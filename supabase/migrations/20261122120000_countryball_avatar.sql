-- Countryball look: how a member's ball is drawn on the map (hair, eyes,
-- glasses, hat and, optionally, the flag they want on it). Chosen by the member
-- at setup; linked members see it in place of the plain flag ball. Everyone who
-- is not a member, or who never customised, stays a plain countryball.

alter table public.profiles add column if not exists avatar jsonb;

-- A small JSON object, never free-form payload.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_avatar_shape'
  ) then
    alter table public.profiles add constraint profiles_avatar_shape check (
      avatar is null or (jsonb_typeof(avatar) = 'object' and pg_column_size(avatar) < 1024)
    );
  end if;
end $$;

-- The looks of the members this caller is linked to, keyed by the caller's own
-- contact row for that member (the same key linked_locations() uses).
create or replace function public.linked_avatars()
returns table (contact_id uuid, avatar jsonb)
language sql stable security definer set search_path = public as $$
  select l.contact_id, p.avatar
  from contact_links l
  join profiles p on p.user_id = l.peer_id
  where l.user_id = auth.uid()
    and p.avatar is not null;
$$;

revoke execute on function public.linked_avatars() from public, anon;
grant execute on function public.linked_avatars() to authenticated;
