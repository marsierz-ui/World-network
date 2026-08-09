import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Contact, ContactCategory, Tag } from '../lib/database.types';
import { COUNTRY_BY_CODE } from '../lib/countries';
import { ContactForm } from '../features/contacts/ContactForm';
import { CustomFieldsManager } from '../features/contacts/CustomFieldsManager';
import { SuggestionsPanel } from '../features/contacts/SuggestionsPanel';
import { MergeDuplicates } from '../features/contacts/MergeDuplicates';
import { findDuplicateGroups } from '../features/contacts/matchContacts';
import { TagAssigner } from '../features/tags/TagAssigner';
import { InlineTags } from '../features/tags/InlineTags';
import { useContactTagMap, useCreateTag, useSetContactTags, useTags } from '../features/tags/useTags';
import { useGoogleQueue } from '../features/import/googleQueue';
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

// Stable identity so a contact with no tags does not break ContactRow's memo.
const NO_TAGS: string[] = [];

export function ContactsPage() {
  const { data: contacts = [], isLoading } = useContacts();
  const { data: fields = [] } = useFieldDefinitions();
  const { data: tags = [] } = useTags();
  const { data: tagMap = {} } = useContactTagMap();
  const create = useCreateContact();
  const update = useUpdateContact();
  const del = useDeleteContact();
  const delAll = useDeleteAllContacts();
  const setContactTags = useSetContactTags();
  const createTag = useCreateTag();

  const [params, setParams] = useSearchParams();
  const unplacedOnly = params.get('unplaced') === '1';
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [merging, setMerging] = useState(false);

  // Which contact the editor shows lives in the URL, so /contacts?id=... from
  // the map and the history page is the same code path as clicking a row, and
  // a refresh keeps the panel open.
  const openId = params.get('id');
  const editing = useMemo(
    () => (openId ? contacts.find((c) => c.id === openId) ?? null : null),
    [openId, contacts],
  );

  const setOpenId = useCallback(
    (id: string | null) => {
      const next: Record<string, string> = {};
      if (unplacedOnly) next.unplaced = '1';
      if (id) next.id = id;
      // replace: a row click per history entry would make Back unusable.
      setParams(next, { replace: true });
    },
    [unplacedOnly, setParams],
  );

  // The mutate functions are referentially stable, so these handlers are too -
  // which is what lets the memo on each row actually hold.
  const updateMutate = update.mutate;
  const delMutate = del.mutate;
  const setTagsMutate = setContactTags.mutate;
  const createTagMutate = createTag.mutate;

  const onOpen = useCallback((c: Contact) => { setOpenId(c.id); setAdding(false); }, [setOpenId]);
  const onCategory = useCallback(
    (id: string, category: ContactCategory) => updateMutate({ id, input: { category } }),
    [updateMutate],
  );
  const onNotes = useCallback(
    (id: string, notes: string | null) => updateMutate({ id, input: { notes } }),
    [updateMutate],
  );
  const onDelete = useCallback((id: string) => delMutate(id), [delMutate]);
  const onToggleTag = useCallback(
    (contactId: string, tagId: string) => {
      const next = new Set(tagMap[contactId] ?? NO_TAGS);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      setTagsMutate({ contactId, tagIds: [...next] });
    },
    [tagMap, setTagsMutate],
  );
  const onCreateTag = useCallback(
    (name: string) => createTagMutate({ name, kind: 'label', color: '#6366f1' }),
    [createTagMutate],
  );

  function clearAll() {
    if (contacts.length === 0) return;
    if (window.confirm(`Delete all ${contacts.length} contacts? This cannot be undone.`)) {
      delAll.mutate(undefined, { onSuccess: () => { setOpenId(null); setAdding(false); } });
    }
  }

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

  // Escape closes the editor. Capture phase so a dropdown inside the form can
  // still swallow Escape first when it needs to.
  useEffect(() => {
    if (!adding && !editing) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      setAdding(false);
      setOpenId(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [adding, editing, setOpenId]);

  const filtered = useMemo(() => {
    // Accent-insensitive so "Bilegt" matches "Bilégt" and vice versa.
    const norm = (s: string) =>
      s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
    const q = norm(query);
    return contacts.filter((c) => {
      if (unplacedOnly && c.current_lng != null && c.current_lat != null) return false;
      if (!q) return true;
      return (
        norm(c.full_name).includes(q) ||
        norm(c.current_city ?? '').includes(q) ||
        norm(c.primary_email ?? '').includes(q) ||
        norm(c.phone ?? '').includes(q) ||
        norm(c.notes ?? '').includes(q)
      );
    });
  }, [contacts, query, unplacedOnly]);

  function handleSubmit(input: ContactInput) {
    if (editing) {
      update.mutate({ id: editing.id, input }, { onSuccess: () => setOpenId(null) });
    } else {
      create.mutate(input, { onSuccess: () => setAdding(false) });
    }
  }

  return (
    <div className="contacts-layout">
      <div className="contacts-main">
        <div className="toolbar">
          <input
            className="search-input"
            placeholder="Search name, city, email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            // Phone keyboards otherwise capitalise and autocorrect names like
            // "Bilegt" into something that matches nothing.
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            className={unplacedOnly ? 'toggle active' : 'toggle'}
            onClick={toggleUnplaced}
            title="Contacts without map coordinates"
          >
            Unplaced {unplacedCount}
          </button>
          <button onClick={() => { setAdding(true); setOpenId(null); }}>+ Add</button>
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

        <GoogleSyncNote />

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
                <ContactRow
                  key={c.id}
                  contact={c}
                  tags={tags}
                  assigned={tagMap[c.id] ?? NO_TAGS}
                  onOpen={onOpen}
                  onCategory={onCategory}
                  onNotes={onNotes}
                  onDelete={onDelete}
                  onToggleTag={onToggleTag}
                  onCreateTag={onCreateTag}
                />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="muted">
                    {contacts.length === 0
                      ? 'No contacts yet. Add one or import.'
                      : `No match for "${query}" among ${contacts.length} contacts.`}
                  </td>
                </tr>
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
            onCancel={() => { setAdding(false); setOpenId(null); }}
          />
          {editing && <TagAssigner contactId={editing.id} />}
          {editing && <LocationHistoryEditor contactId={editing.id} />}
        </aside>
      )}

      {merging && <MergeDuplicates contacts={contacts} onClose={() => setMerging(false)} />}
    </div>
  );
}

interface RowProps {
  contact: Contact;
  tags: Tag[];
  assigned: string[];
  onOpen: (c: Contact) => void;
  onCategory: (id: string, category: ContactCategory) => void;
  onNotes: (id: string, notes: string | null) => void;
  onDelete: (id: string) => void;
  onToggleTag: (contactId: string, tagId: string) => void;
  onCreateTag: (name: string) => void;
}

// Memoised so editing one contact repaints one row instead of the whole table.
const ContactRow = memo(function ContactRow({
  contact: c,
  tags,
  assigned,
  onOpen,
  onCategory,
  onNotes,
  onDelete,
  onToggleTag,
  onCreateTag,
}: RowProps) {
  return (
    <tr onClick={() => onOpen(c)}>
      <td>{c.full_name}</td>
      <td onClick={(e) => e.stopPropagation()}>
        <select
          className={`cat-select ${c.category}`}
          value={c.category}
          onChange={(e) => onCategory(c.id, e.target.value as ContactCategory)}
        >
          <option value="work">work</option>
          <option value="private">private</option>
          <option value="other">other</option>
        </select>
      </td>
      <td>{c.current_city ?? '-'}</td>
      <td>{COUNTRY_BY_CODE.get(c.current_country ?? '')?.name ?? c.current_country ?? '-'}</td>
      <td>
        <InlineTags
          tags={tags}
          assigned={assigned}
          onToggle={(tagId) => onToggleTag(c.id, tagId)}
          onCreate={onCreateTag}
        />
      </td>
      <td className="phone-cell">{c.phone ?? '-'}</td>
      <td onClick={(e) => e.stopPropagation()}>
        <InlineNotes contact={c} onSave={(notes) => onNotes(c.id, notes)} />
      </td>
      <td>
        <button className="link" onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}>
          delete
        </button>
      </td>
    </tr>
  );
});

// Google writes happen behind the save, so their result arrives here rather
// than from the mutation. Only outcomes the user can act on are shown.
function GoogleSyncNote() {
  const pending = useGoogleQueue((s) => s.pending);
  const last = useGoogleQueue((s) => s.last);
  const clear = useGoogleQueue((s) => s.clear);

  if (pending > 0) {
    return <div className="muted">Syncing {pending} change{pending > 1 ? 's' : ''} to Google...</div>;
  }
  if (!last) return null;
  if (last.result === 'failed') {
    return (
      <div className="error">
        {last.name} saved here, but Google was not updated: {last.error}{' '}
        <button className="link" onClick={clear}>dismiss</button>
      </div>
    );
  }
  if (last.result === 'updated') {
    return <div className="muted">{last.name} pushed to Google Contacts.</div>;
  }
  if (last.result === 'created') {
    return <div className="muted">{last.name} created in Google Contacts.</div>;
  }
  if (last.result === 'no-token') {
    return (
      <div className="muted">
        Saved here. Reconnect Google on the Settings page to push edits to Google Contacts.
      </div>
    );
  }
  return null;
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
