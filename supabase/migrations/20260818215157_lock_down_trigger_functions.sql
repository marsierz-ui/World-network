-- Verified empirically: Postgres does not re-check EXECUTE on a trigger function
-- when the trigger fires (only at CREATE TRIGGER time), so app roles do not need
-- it. Drop the grant added as a precaution in the previous migration.
revoke execute on function public.log_contact_event() from anon, authenticated;
