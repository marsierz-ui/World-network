import { useState } from 'react';
import type { TagKind } from '../../lib/database.types';
import { useContactTagMap, useCreateTag, useSetContactTags, useTags } from './useTags';

export function TagAssigner({ contactId }: { contactId: string }) {
  const { data: tags = [] } = useTags();
  const { data: tagMap = {} } = useContactTagMap();
  const setTags = useSetContactTags();
  const createTag = useCreateTag();
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState<TagKind>('label');

  const assigned = new Set(tagMap[contactId] ?? []);

  function toggle(tagId: string) {
    const next = new Set(assigned);
    if (next.has(tagId)) next.delete(tagId);
    else next.add(tagId);
    setTags.mutate({ contactId, tagIds: [...next] });
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    createTag.mutate(
      { name: newName.trim(), kind: newKind, color: '#6366f1' },
      { onSuccess: () => setNewName('') },
    );
  }

  return (
    <div className="tag-assigner">
      <div className="section-label">Tags / communities</div>
      <div className="chips">
        {tags.map((t) => (
          <button
            key={t.id}
            className={assigned.has(t.id) ? 'tag-pick active' : 'tag-pick'}
            onClick={() => toggle(t.id)}
            type="button"
          >
            {t.name}
          </button>
        ))}
        {tags.length === 0 && <span className="muted">No tags yet.</span>}
      </div>
      <form className="add-field" onSubmit={add}>
        <input placeholder="New tag" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <select value={newKind} onChange={(e) => setNewKind(e.target.value as TagKind)}>
          <option value="label">label</option>
          <option value="community">community</option>
        </select>
        <button type="submit" disabled={createTag.isPending}>Create</button>
      </form>
    </div>
  );
}
