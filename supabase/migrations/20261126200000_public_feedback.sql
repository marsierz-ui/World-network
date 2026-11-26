-- Feedback from xTrails apps that have no sign-in (BrainTrails, LinguaTrails,
-- PicTrails) into the one feedback inbox of this project.
--
-- The shared widget (feedback-loop: packages/feedback-widget) runs with the
-- anon key only. It can do exactly two things here:
--   * upload a screenshot into feedback/anon/<uuid>.jpg (no read, no update,
--     no delete), and
--   * call submit_public_feedback(), which files the note with user_id null.
-- Everything else about public.feedback stays as 20260927195723 set it up:
-- signed-in apps (CrowdTrails) insert their own rows, admins read and triage.
--
-- Abuse limits: a known app name, 1-5000 characters (the table check), at
-- most 100 anonymous notes an hour across all apps, and a screenshot path that
-- must name an object that was really uploaded under anon/. Uploads are capped
-- at 5 MB each by the bucket; they are not counted, so watch the bucket size.
--
-- Not applied by the commit that adds it: run it in the SQL editor of project
-- dioviawozcypzzowgoyk (or `supabase db push`) before the widget can send.

-- ---------------------------------------------------------------------------
-- feedback: allow rows without a user
-- ---------------------------------------------------------------------------
alter table public.feedback alter column user_id drop not null;

alter table public.feedback drop constraint if exists feedback_screenshot_own_folder;
alter table public.feedback add constraint feedback_screenshot_own_folder check (
  screenshot_path is null
  or (user_id is not null and screenshot_path like user_id::text || '/%')
  or (user_id is null and screenshot_path like 'anon/%')
);

-- Signed-in senders still get their address from auth.users and cannot set
-- it (no column grant). An anonymous note keeps the reply address it was
-- given, which only submit_public_feedback() can write.
create or replace function public.feedback_fill_sender() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is not null then
    new.sender_email := (select email from auth.users where id = new.user_id);
  end if;
  return new;
end $$;

revoke execute on function public.feedback_fill_sender() from public, anon, authenticated;

create index if not exists feedback_anon_created_at_idx
  on public.feedback (created_at desc) where user_id is null;

-- ---------------------------------------------------------------------------
-- submit_public_feedback
-- ---------------------------------------------------------------------------
create or replace function public.submit_public_feedback(
  p_app text,
  p_text text,
  p_page text default null,
  p_user_agent text default null,
  p_viewport text default null,
  p_screenshot_path text default null,
  p_contact text default null
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
  v_contact text := nullif(btrim(p_contact), '');
begin
  if p_app is null or p_app not in ('braintrails', 'linguatrails', 'pictrails') then
    raise exception 'unknown app' using errcode = '22023';
  end if;

  if (select count(*) from public.feedback
      where user_id is null and created_at > now() - interval '1 hour') >= 100 then
    raise exception 'too many reports right now, please try again later' using errcode = '53400';
  end if;

  if p_screenshot_path is not null and (
       p_screenshot_path !~ '^anon/[0-9a-f-]{36}\.jpg$'
       or not exists (select 1 from storage.objects
                      where bucket_id = 'feedback' and name = p_screenshot_path)
       or exists (select 1 from public.feedback where screenshot_path = p_screenshot_path)
     ) then
    raise exception 'unknown screenshot' using errcode = '22023';
  end if;

  if v_contact is not null and (length(v_contact) > 200 or v_contact !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    v_contact := null;
  end if;

  insert into public.feedback (user_id, app, text, page, user_agent, viewport, screenshot_path, sender_email)
  values (null, p_app, p_text, left(p_page, 500), left(p_user_agent, 400), left(p_viewport, 40),
          p_screenshot_path, v_contact)
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.submit_public_feedback(text, text, text, text, text, text, text) from public;
grant execute on function public.submit_public_feedback(text, text, text, text, text, text, text)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- screenshots: anon may add files under anon/, nothing else
-- ---------------------------------------------------------------------------
drop policy if exists "feedback screenshots insert anon" on storage.objects;
create policy "feedback screenshots insert anon" on storage.objects
  for insert to anon
  with check (
    bucket_id = 'feedback'
    and name ~ '^anon/[0-9a-f-]{36}\.jpg$'
  );

notify pgrst, 'reload schema';
