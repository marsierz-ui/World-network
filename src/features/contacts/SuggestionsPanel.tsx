import { useMemo, useState } from 'react';
import type { Contact } from '../../lib/database.types';
import { COUNTRY_BY_CODE } from '../../lib/countries';
import { detectLocationInText } from '../import/parseCsv';
import { useUpdateContact, type ContactInput } from './useContacts';

// Surfaces note-derived location guesses for contacts that have no location yet,
// for the user to accept or dismiss (never applied automatically).
export function SuggestionsPanel({ contacts }: { contacts: Contact[] }) {
  const update = useUpdateContact();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(false);

  const suggestions = useMemo(() => {
    return contacts
      .filter((c) => c.current_lng == null && c.notes && !dismissed.has(c.id))
      .map((c) => ({ contact: c, hit: detectLocationInText(c.notes) }))
      .filter((s): s is { contact: Contact; hit: NonNullable<ReturnType<typeof detectLocationInText>> } => s.hit != null);
  }, [contacts, dismissed]);

  if (suggestions.length === 0) return null;

  function accept(contactId: string, fieldName: 'current_country' | 'current_city', value: string) {
    update.mutate({ id: contactId, input: { [fieldName]: value } as Partial<ContactInput> });
    setDismissed((d) => new Set(d).add(contactId));
  }

  return (
    <section className="suggestions">
      <div className="sugg-head" onClick={() => setCollapsed((v) => !v)}>
        <strong>Location suggestions from notes ({suggestions.length})</strong>
        <button className="link">{collapsed ? 'show' : 'hide'}</button>
      </div>
      {!collapsed && (
        <ul>
          {suggestions.map(({ contact, hit }) => {
            const label =
              hit.field === 'current_country'
                ? `${COUNTRY_BY_CODE.get(hit.value)?.name ?? hit.value} (country)`
                : `${hit.value} (city)`;
            return (
              <li key={contact.id}>
                <span className="sugg-name">{contact.full_name}</span>
                <span className="muted sugg-note">note: "{contact.notes}"</span>
                <span className="sugg-arrow">→ {label}</span>
                <span className="sugg-actions">
                  <button onClick={() => accept(contact.id, hit.field, hit.value)}>
                    Set
                  </button>
                  <button
                    className="link"
                    onClick={() => setDismissed((d) => new Set(d).add(contact.id))}
                  >
                    dismiss
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
