import { useState } from 'react';
import type { Tag } from '../../lib/database.types';

interface Props {
  tags: Tag[];
  assigned: string[];
  onToggle: (tagId: string) => void;
  onCreate: (name: string) => void;
}

/**
 * Compact tag editor for a contacts-table row: chips + a popover to toggle or
 * create tags.
 *
 * Data and handlers come in as props on purpose. Reading the tag queries here
 * meant every row opened its own subscriptions, so a table of 500 contacts held
 * 1000 observers and re-rendered all of them whenever any tag changed.
 */
export function InlineTags({ tags, assigned, onToggle, onCreate }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const assignedSet = new Set(assigned);

  function create() {
    const name = query.trim();
    if (!name) return;
    onCreate(name);
    setQuery('');
  }

  const filtered = tags.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()));
  const canCreate =
    query.trim() && !tags.some((t) => t.name.toLowerCase() === query.trim().toLowerCase());

  return (
    <div className="inline-tags" onClick={(e) => e.stopPropagation()}>
      <div className="it-chips">
        {assigned.map((id) => {
          const t = tags.find((x) => x.id === id);
          if (!t) return null;
          return (
            <span key={id} className="chip" onClick={() => onToggle(id)} title="click to remove">
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
                onClick={() => onToggle(t.id)}
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
