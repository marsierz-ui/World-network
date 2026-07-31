import { useMemo, useState } from 'react';
import type { Contact } from '../../lib/database.types';
import { completeness, findDuplicateGroups } from './matchContacts';
import { useMergeContacts } from './useMergeContacts';

export function MergeDuplicates({ contacts, onClose }: { contacts: Contact[]; onClose: () => void }) {
  const merge = useMergeContacts();
  const groups = useMemo(() => findDuplicateGroups(contacts), [contacts]);

  return (
    <div className="picker-backdrop" onClick={onClose}>
      <div className="merge-modal" onClick={(e) => e.stopPropagation()}>
        <div className="picker-head">
          <strong>Merge duplicate contacts</strong>
          <button className="link" onClick={onClose}>close</button>
        </div>
        {groups.length === 0 ? (
          <div className="muted page-pad">No likely duplicates found (matched by email or name).</div>
        ) : (
          <div className="merge-list">
            {groups.map((g) => <MergeGroup key={g[0].id} group={g} onMerge={(survivor, dup) => merge.mutate({ survivor, dup })} busy={merge.isPending} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function MergeGroup({
  group,
  onMerge,
  busy,
}: {
  group: Contact[];
  onMerge: (survivor: Contact, dup: Contact) => void;
  busy: boolean;
}) {
  // Default survivor = most complete record.
  const sorted = [...group].sort((a, b) => completeness(b) - completeness(a));
  const [survivorId, setSurvivorId] = useState(sorted[0].id);
  const survivor = group.find((c) => c.id === survivorId)!;
  const dups = group.filter((c) => c.id !== survivorId);

  return (
    <div className="merge-group">
      <div className="merge-rows">
        {group.map((c) => (
          <label key={c.id} className={`merge-row ${c.id === survivorId ? 'keep' : ''}`}>
            <input type="radio" checked={c.id === survivorId} onChange={() => setSurvivorId(c.id)} />
            <span className="merge-name">{c.full_name}</span>
            <span className="muted">
              {c.primary_email ?? 'no email'} · {c.current_city ?? '-'} · {c.source}
            </span>
          </label>
        ))}
      </div>
      <button
        disabled={busy}
        onClick={() => dups.forEach((d) => onMerge(survivor, d))}
      >
        Keep "{survivor.full_name}", merge {dups.length} other{dups.length === 1 ? '' : 's'}
      </button>
    </div>
  );
}
