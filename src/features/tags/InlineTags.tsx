import { useState } from 'react';
import { useContactTagMap, useCreateTag, useSetContactTags, useTags } from './useTags';

// Compact tag editor for a contacts-table row: chips + a popover to toggle/create tags.
export function InlineTags({ contactId }: { contactId: string }) {
  const { data: tags = [] } = useTags();
  const { data: tagMap = {} } = useContactTagMap();
  const setTags = useSetContactTags();
  const createTag = useCreateTag();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const assigned = tagMap[contactId] ?? [];
  const assignedSet = new Set(assigned);

  function toggle(tagId: string) {
    const next = new Set(assignedSet);
    if (next.has(tagId)) next.delete(tagId);
    else next.add(tagId);
    setTags.mutate({ contactId, tagIds: [...next] });
  }

  function create() {
    const name = query.trim();
    if (!name) return;
    createTag.mutate(
      { name, kind: 'label', color: '#6366f1' },
      {
        onSuccess: () => setQuery(''),
      },
    );
  }

  const filtered = tags.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()));
  const canCreate = query.trim() && !tags.some((t) => t.name.toLowerCase() === query.trim().toLowerCase());

  return (
    <div className="inline-tags" onClick={(e) => e.stopPropagation()}>
      <div className="it-chips">
        {assigned.map((id) => {
          const t = tags.find((x) => x.id === id);
          if (!t) return null;
          return (
            <span key={id} className="chip" onClick={() => toggle(id)} title="click to remove">
              {t.name}
            </span>
          );
        })}
        <button type="button" className="it-add" onClick={() => setOpen((v) => !v)}>+</button>
      </div>
      {open && (
        <div className="it-menu" onMouseLeave={() => setOpen(false)}>
          <input
            autoFocus
            placeholder="Search or create"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && canCreate) { e.preventDefault(); create(); } }}
          />
          <div className="it-list">
            {canCreate && (
              <button type="button" className="it-opt custom" onClick={create}>
                Create "{query.trim()}"
              </button>
            )}
            {filtered.map((t) => (
              <button
                type="button"
                key={t.id}
                className={assignedSet.has(t.id) ? 'it-opt active' : 'it-opt'}
                onClick={() => toggle(t.id)}
              >
                <span className="it-check">{assignedSet.has(t.id) ? '✓' : ''}</span>
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
