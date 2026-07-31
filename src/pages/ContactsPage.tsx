import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Contact, ContactCategory } from '../lib/database.types';
import { COUNTRY_BY_CODE } from '../lib/countries';
import { ContactForm } from '../features/contacts/ContactForm';
import { CustomFieldsManager } from '../features/contacts/CustomFieldsManager';
import { SuggestionsPanel } from '../features/contacts/SuggestionsPanel';
import { MergeDuplicates } from '../features/contacts/MergeDuplicates';
import { findDuplicateGroups } from '../features/contacts/matchContacts';
import { TagAssigner } from '../features/tags/TagAssigner';
import { InlineTags } from '../features/tags/InlineTags';
import { LocationHistoryEditor } from '../features/mobility/LocationHistoryEditor';
import {
  useContacts,
  useCreateContact,
  useDeleteAllContacts,
  useDeleteContact,
  useFieldDefinitions,
  useUpdateContact,
  type ContactInput,
} from '../features/contacts/useContacts';

export function ContactsPage() {
  const { data: contacts = [], isLoading } = useContacts();
  const { data: fields = [] } = useFieldDefinitions();
  const create = useCreateContact();
  const update = useUpdateContact();
  const del = useDeleteContact();
  const delAll = useDeleteAllContacts();

  function clearAll() {
    if (contacts.length === 0) return;
    if (window.confirm(`Delete all ${contacts.length} contacts? This cannot be undone.`)) {
      delAll.mutate(undefined, { onSuccess: () => { setEditing(null); setAdding(false); } });
    }
  }

  const [params, setParams] = useSearchParams();
  const unplacedOnly = params.get('unplaced') === '1';
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Contact | null>(null);
  const [adding, setAdding] = useState(false);
  const [merging, setMerging] = useState(false);

  const unplacedCount = useMemo(
    () => contacts.filter((c) => c.current_lng == null || c.current_lat == null).length,
    [contacts],
  );
  const dupCount = useMemo(
    () => findDuplicateGroups(contacts).reduce((n, g) => n + g.length - 1, 0),
    [contacts],
  );

  function toggleUnplaced() {
    setParams(unplacedOnly ? {} : { unplaced: '1' });
  }

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return contacts.filter((c) => {
      if (unplacedOnly && c.current_lng != null && c.current_lat != null) return false;
      return (
        c.full_name.toLowerCase().includes(q) ||
        (c.current_city ?? '').toLowerCase().includes(q) ||
        (c.primary_email ?? '').toLowerCase().includes(q)
      );
    });
  }, [contacts, query, unplacedOnly]);

  function handleSubmit(input: ContactInput) {
    if (editing) {
      update.mutate({ id: editing.id, input }, { onSuccess: () => setEditing(null) });
    } else {
      create.mutate(input, { onSuccess: () => setAdding(false) });
    }
  }

  return (
    <div className="contacts-layout">
      <div className="contacts-main">
        <div className="toolbar">
          <input
            placeholder="Search name, city, email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            className={unplacedOnly ? 'toggle active' : 'toggle'}
            onClick={toggleUnplaced}
            title="Contacts without map coordinates"
          >
            Unplaced {unplacedCount}
          </button>
          <button onClick={() => { setAdding(true); setEditing(null); }}>+ Add</button>
          {dupCount > 0 && (
            <button className="toggle" onClick={() => setMerging(true)}>
              Merge dupes {dupCount}
            </button>
          )}
          <button
            className="danger"
            onClick={clearAll}
            disabled={delAll.isPending || contacts.length === 0}
          >
            {delAll.isPending ? 'Clearing...' : 'Clear all'}
          </button>
        </div>

        <SuggestionsPanel contacts={contacts} />

        {isLoading ? (
          <div className="muted">Loading...</div>
        ) : (
          <table className="contacts-table">
            <thead>
              <tr>
                <th>Name</th><th>Category</th><th>City</th><th>Country</th>
                <th>Tags</th><th>Phone</th><th>Notes</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} onClick={() => { setEditing(c); setAdding(false); }}>
                  <td>{c.full_name}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <select
                      className={`cat-select ${c.category}`}
                      value={c.category}
                      onChange={(e) =>
                        update.mutate({ id: c.id, input: { category: e.target.value as ContactCategory } })
                      }
                    >
                      <option value="work">work</option>
                      <option value="private">private</option>
                      <option value="other">other</option>
                    </select>
                  </td>
                  <td>{c.current_city ?? '-'}</td>
                  <td>{COUNTRY_BY_CODE.get(c.current_country ?? '')?.name ?? c.current_country ?? '-'}</td>
                  <td><InlineTags contactId={c.id} /></td>
                  <td className="phone-cell">{c.phone ?? '-'}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <InlineNotes contact={c} onSave={(notes) => update.mutate({ id: c.id, input: { notes } })} />
                  </td>
                  <td>
                    <button
                      className="link"
                      onClick={(e) => { e.stopPropagation(); del.mutate(c.id); }}
                    >
                      delete
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="muted">No contacts yet. Add one or import.</td></tr>
              )}
            </tbody>
          </table>
        )}

        <CustomFieldsManager fields={fields} />
      </div>

      {(adding || editing) && (
        <aside className="side-panel">
          <h3>{editing ? 'Edit contact' : 'New contact'}</h3>
          <ContactForm
            key={editing?.id ?? 'new'}
            initial={editing ?? undefined}
            fields={fields}
            busy={create.isPending || update.isPending}
            onSubmit={handleSubmit}
            onCancel={() => { setAdding(false); setEditing(null); }}
          />
          {editing && <TagAssigner contactId={editing.id} />}
          {editing && <LocationHistoryEditor contactId={editing.id} />}
        </aside>
      )}

      {merging && <MergeDuplicates contacts={contacts} onClose={() => setMerging(false)} />}
    </div>
  );
}

function InlineNotes({ contact, onSave }: { contact: Contact; onSave: (notes: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(contact.notes ?? '');

  if (!editing) {
    return (
      <div className="notes-cell" onClick={() => { setValue(contact.notes ?? ''); setEditing(true); }}>
        {contact.notes ? <span>{contact.notes}</span> : <span className="muted">add note</span>}
      </div>
    );
  }
  return (
    <textarea
      className="notes-edit"
      autoFocus
      rows={2}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        setEditing(false);
        const next = value.trim() || null;
        if (next !== (contact.notes ?? null)) onSave(next);
      }}
    />
  );
}
