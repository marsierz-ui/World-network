-- Google refresh tokens, so the People API keeps working after the access token
-- expires (~1h) and after the tab is closed.
--
-- The row is written and read only by the google-token Edge Function, which runs
-- with the service role. RLS is on with no policies at all: that denies anon and
-- authenticated everything, including the owner's own row, so a stolen anon JWT
-- cannot lift a refresh token out of the database. The service role bypasses RLS
-- by design and is the single door in.
create table if not exists public.google_credentials (
  user_id uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.google_credentials enable row level security;

revoke all on public.google_credentials from anon, authenticated;
