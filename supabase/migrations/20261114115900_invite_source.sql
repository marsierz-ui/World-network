-- Contacts created by accepting another member's invite (see the next
-- migration). Its own file: a new enum value cannot be used in the transaction
-- that adds it.
alter type contact_source add value if not exists 'invite';
