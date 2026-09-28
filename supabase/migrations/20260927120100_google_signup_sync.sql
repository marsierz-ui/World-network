-- Someone who signs up with Google has already granted the contacts scope on the
-- consent screen (AuthProvider asks for it with the sign-in), so make the account
-- start with two-way sync on instead of waiting for them to find the switch on
-- the Settings page. useGoogleAutoSync picks that up on the first page load and
-- imports the address book.
--
-- Only the sign-up is affected: existing profiles keep whatever they chose, and
-- email/password sign-ups stay off because there is no Google account to sync.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, display_name, google_sync_enabled)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    coalesce(new.raw_app_meta_data->>'provider', '') = 'google'
  )
  on conflict (user_id) do nothing;
  return new;
end $$;

-- CREATE OR REPLACE keeps the ACL, but state it: only the auth service calls this.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;
