-- In-app feedback with a screenshot, routed to an admin and from there to the AI
-- agent (supabase/functions/feedback-dispatch -> .github/workflows/feedback-agent.yml).
-- Same flow as attention-tracker's, with two differences that matter here:
--
--   * Admin rights live in their own table, not on profiles. The "own profile"
--     policy lets a user update every column of their own row, so an is_admin
--     flag there would be self-service. public.admins has RLS on and no policies:
--     nothing but the SQL editor and the service role can write it.
--   * Screenshots go to a private Storage bucket instead of a data URL in a text
--     column. The admin page reads them through short-lived signed URLs, and the
--     dispatch hands the agent one of those rather than the image itself.
--
-- Promote yourself once, in the SQL editor, after your first sign-in:
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'you@example.com';

-- ---------------------------------------------------------------------------
-- admins
-- ---------------------------------------------------------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

comment on table public.admins is
  'Users allowed to triage feedback. RLS enabled with no policies and no client grants: promote from the SQL editor only. Read through public.is_admin().';

-- security definer so a caller can ask about themselves without a grant on the
-- table; it answers for auth.uid() only, so it cannot be used to list admins.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- feedback
-- ---------------------------------------------------------------------------
create table if not exists public.feedback (
  id bigserial primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Filled from auth.users by feedback_fill_sender(), so the admin can reply and
  -- a sender cannot claim to be someone else. Not client-writable.
  sender_email text,
  text text not null check (char_length(text) between 1 and 5000),
  -- Path inside the `feedback` bucket, always under the sender's own folder.
  screenshot_path text,
  -- Where the user was: the in-app route, and enough of the device to reproduce.
  page text,
  user_agent text,
  viewport text,
  status text not null default 'new'
    check (status in ('new', 'triaged', 'approved', 'dispatched', 'done', 'wontfix')),
  category text,
  admin_note text,
  dispatched_at timestamptz,
  created_at timestamptz not null default now(),
  constraint feedback_screenshot_own_folder
    check (screenshot_path is null or screenshot_path like user_id::text || '/%')
);

create index if not exists feedback_created_at_idx on public.feedback (created_at desc);

create or replace function public.feedback_fill_sender() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.sender_email := (select email from auth.users where id = new.user_id);
  return new;
end $$;

-- Postgres checks EXECUTE on a trigger function only at CREATE TRIGGER time
-- (see 20260818215157), so the app roles need no grant to fire it.
revoke execute on function public.feedback_fill_sender() from public, anon, authenticated;

drop trigger if exists feedback_fill_sender on public.feedback;
create trigger feedback_fill_sender before insert on public.feedback
  for each row execute function public.feedback_fill_sender();

alter table public.feedback enable row level security;

-- Senders write their own rows and can read them back; admins read everything
-- and triage. Nobody deletes over the API.
drop policy if exists "feedback insert own" on public.feedback;
create policy "feedback insert own" on public.feedback
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "feedback select own or admin" on public.feedback;
create policy "feedback select own or admin" on public.feedback
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "feedback update admin" on public.feedback;
create policy "feedback update admin" on public.feedback
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Grants under the policies: a sender can set only what they are telling us,
-- and triage can touch only the triage columns, so not even an admin session
-- can rewrite what a user said.
revoke all on public.feedback from anon, authenticated;
grant select on public.feedback to authenticated;
grant insert (text, screenshot_path, page, user_agent, viewport) on public.feedback to authenticated;
grant update (status, category, admin_note) on public.feedback to authenticated;
grant usage on sequence public.feedback_id_seq to authenticated;

comment on table public.feedback is
  'User feedback. Senders insert and read their own rows; admins (public.is_admin()) read all and update status/category/admin_note. The feedback-dispatch Edge Function (service role) sets dispatched_at.';

-- ---------------------------------------------------------------------------
-- screenshots: private bucket, one folder per user
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback', 'feedback', false, 5 * 1024 * 1024, array['image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "feedback screenshots insert own" on storage.objects;
create policy "feedback screenshots insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'feedback' and (storage.foldername(name))[1] = auth.uid()::text);

-- Reading covers createSignedUrl on the admin page. Senders keep access to their
-- own uploads; no update or delete policy, so a screenshot cannot be swapped
-- after the admin has looked at it.
drop policy if exists "feedback screenshots select own or admin" on storage.objects;
create policy "feedback screenshots select own or admin" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'feedback'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

notify pgrst, 'reload schema';
