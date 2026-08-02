import { useMemo, useState } from 'react';
import { useTags, useGroupTags, useUpdateTag, useDeleteTag } from './useTags';
import type { Tag } from '../../lib/database.types';

// Group several labels under a new parent. Children keep their contact links,
// so the parent is a view over them rather than a re-tagging operation.
export function LabelManager() {
  const { data: tags = [] } = useTags();
  const group = useGroupTags();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();

  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [name, setName] = useState('');

  const { parents, childrenOf, loose } = useMemo(() => {
    const childrenOf = new Map<string, Tag[]>();
    for (const t of tags) {
      if (!t.parent_id) continue;
      const list = childrenOf.get(t.parent_id);
      if (list) list.push(t);
      else childrenOf.set(t.parent_id, [t]);
    }
    const parents = tags.filter((t) => childrenOf.has(t.id));
    const loose = tags.filter((t) => !t.parent_id && !childrenOf.has(t.id));
    return { parents, childrenOf, loose };
  }, [tags]);

  function toggle(id: string) {
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function doGroup() {
    if (!name.trim() || picked.size < 2) return;
    group.mutate(
      { name: name.trim(), childIds: [...picked] },
      { onSuccess: () => { setPicked(new Set()); setName(''); } },
    );
  }

  if (tags.length === 0) {
    return <div className="muted">No labels yet. They arrive with a Google sync, or add them per contact.</div>;
  }

  return (
    <div className="label-manager">
      {parents.map((p) => (
        <div key={p.id} className="lm-group">
          <div className="lm-parent">
            <span className="lm-swatch" style={{ background: p.color }} />
            <strong>{p.name}</strong>
            <span className="muted">{childrenOf.get(p.id)!.length} sublabels</span>
            <button
              className="link"
              onClick={() => {
                if (confirm(`Ungroup "${p.name}"? Sublabels become top-level again.`)) {
                  for (const c of childrenOf.get(p.id)!) {
                    updateTag.mutate({ id: c.id, patch: { parent_id: null } });
                  }
                  deleteTag.mutate(p.id);
                }
              }}
            >
              ungroup
            </button>
          </div>
          {childrenOf.get(p.id)!.map((c) => (
            <div key={c.id} className="lm-child">
              <input
                type="color"
                className="lm-color"
                value={c.color}
                onChange={(e) => updateTag.mutate({ id: c.id, patch: { color: e.target.value } })}
                title="Colour on the map"
              />
              <span>{c.name}</span>
            </div>
          ))}
        </div>
      ))}

      {loose.length > 0 && (
        <>
          <div className="section-label">Ungrouped labels</div>
          <div className="lm-loose">
            {loose.map((t) => (
              <label key={t.id} className="check">
                <input type="checkbox" checked={picked.has(t.id)} onChange={() => toggle(t.id)} />
                <span className="chip">{t.name}</span>
              </label>
            ))}
          </div>
        </>
      )}

      <div className="lm-actions">
        <input
          placeholder="New parent label name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button onClick={doGroup} disabled={picked.size < 2 || !name.trim() || group.isPending}>
          {group.isPending ? 'Grouping...' : `Group ${picked.size || ''} selected`}
        </button>
      </div>
      {picked.size === 1 && <div className="muted">Pick at least two labels to group.</div>}
    </div>
  );
}
