-- Marks a google_credentials row as "a background sync is in flight for this
-- user right now". The interactive sync already serialises itself with a
-- module-level flag in the browser (see useGoogleSync.ts's `globalRun`), which
-- a scheduled server-side run cannot see - this is that same guard for the
-- google-sync-cron Edge Function, so two overlapping cron invocations cannot
-- pull/import the same user's contacts twice at once.
alter table public.google_credentials
  add column if not exists sync_started_at timestamptz;

comment on table public.google_credentials is
  'Google refresh tokens. RLS enabled with no policies and no anon/authenticated grants: only the service role (the google-token and google-sync-cron Edge Functions) can read or write it.';
