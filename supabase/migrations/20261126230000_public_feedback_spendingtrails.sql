-- SpendingTrails joins the apps that may send anonymous feedback through
-- submit_public_feedback(). Same function as 20261126200000, with
-- 'spendingtrails' added to the allowed app list.
--
-- Not applied by the commit that adds it: run it in the SQL editor of project
-- dioviawozcypzzowgoyk (or `supabase db push`).

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
  if p_app is null or p_app not in ('braintrails', 'linguatrails', 'pictrails', 'spendingtrails') then
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

notify pgrst, 'reload schema';
