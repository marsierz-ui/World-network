-- Everything Google Contacts can hold that has no column of its own: structured
-- name parts, nickname, birthday, and the repeatable labelled lists (emails,
-- phones, postal addresses, websites, chats, related people, significant dates,
-- custom fields). Kept as one jsonb blob rather than a dozen side tables - the
-- map, search and dedupe only ever read the scalar columns, and this half is
-- written and read whole on every sync.
--
-- Shape (all keys optional), mirroring the People API names:
--   { prefix, first_name, middle_name, last_name, suffix,
--     phonetic_first, phonetic_middle, phonetic_last, file_as, nickname,
--     birthday: 'yyyy-mm-dd' | '--mm-dd',
--     organizations: [{ name, title, department }],
--     emails|phones|urls|chats|relations|events|user_defined: [{ label, value }],
--     addresses: [{ label, street, city, region, postal_code, country }] }

alter table contacts add column if not exists details jsonb not null default '{}'::jsonb;

-- company/position were parked in `custom`, which exists for user-defined
-- rubrics driven by field_definitions. They are Google organization fields, so
-- move them across and leave `custom` to its actual purpose.
update contacts
set details = details || jsonb_build_object(
      'organizations',
      jsonb_build_array(
        jsonb_build_object(
          'name', coalesce(custom->>'company', ''),
          'title', coalesce(custom->>'position', ''),
          'department', ''
        )
      )
    ),
    custom = custom - 'company' - 'position'
where custom ? 'company' or custom ? 'position';
