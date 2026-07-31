-- Add notes + phone to contacts (imported from Google CSV, editable in-app).
alter table contacts add column if not exists notes text;
alter table contacts add column if not exists phone text;
