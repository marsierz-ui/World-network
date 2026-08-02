-- Labels can nest one level: several existing labels get grouped under a new
-- parent, so the map can show the parent while colouring each sublabel apart.
-- on delete set null: deleting a parent promotes its children back to top level
-- rather than destroying them along with every contact link.

alter table tags add column if not exists parent_id uuid references tags(id) on delete set null;
create index if not exists tags_parent_idx on tags(parent_id);

-- A tag cannot be its own parent. Deeper cycles are prevented in the UI, which
-- only ever assigns a parent that is itself top level.
alter table tags drop constraint if exists tags_no_self_parent;
alter table tags add constraint tags_no_self_parent check (parent_id is null or parent_id <> id);
