import { useState } from 'react';
import type { FieldDefinition, FieldType } from '../../lib/database.types';
import { useCreateFieldDefinition, useDeleteFieldDefinition } from './useContacts';

const TYPES: FieldType[] = ['text', 'date', 'number', 'select', 'tags', 'boolean'];

export function CustomFieldsManager({ fields }: { fields: FieldDefinition[] }) {
  const create = useCreateFieldDefinition();
  const del = useDeleteFieldDefinition();
  const [label, setLabel] = useState('');
  const [type, setType] = useState<FieldType>('text');
  const [options, setOptions] = useState('');

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    create.mutate(
      {
        label: label.trim(),
        type,
        options: options.split(',').map((s) => s.trim()).filter(Boolean),
      },
      { onSuccess: () => { setLabel(''); setOptions(''); setType('text'); } },
    );
  }

  return (
    <section className="custom-fields">
      <div className="section-label">Custom fields (e.g. inside jokes, how we met)</div>
      <div className="chips">
        {fields.map((f) => (
          <span key={f.id} className="chip">
            {f.label} <em>{f.type}</em>
            <button className="x" onClick={() => del.mutate(f.id)}>x</button>
          </span>
        ))}
        {fields.length === 0 && <span className="muted">None yet.</span>}
      </div>
      <form className="add-field" onSubmit={add}>
        <input placeholder="Field label" value={label} onChange={(e) => setLabel(e.target.value)} />
        <select value={type} onChange={(e) => setType(e.target.value as FieldType)}>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {type === 'select' && (
          <input
            placeholder="Options (comma-separated)"
            value={options}
            onChange={(e) => setOptions(e.target.value)}
          />
        )}
        <button type="submit" disabled={create.isPending}>Add field</button>
      </form>
    </section>
  );
}
