-- Google sync preference + per-contact social links.
alter table profiles add column if not exists google_sync_enabled boolean not null default false;
alter table profiles add column if not exists google_last_synced timestamptz;
alter table contacts add column if not exists socials jsonb not null default '{}'::jsonb;
