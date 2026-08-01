import { useMemo, useState } from 'react';
import { COUNTRY_BY_CODE } from '../../lib/countries';
import type { Contact, Tag } from '../../lib/database.types';
import { useMapStore } from './mapStore';

type Tagged = Contact & { tag_ids?: string[] };

interface Props {
  contacts: Tagged[];
  tags: Tag[];
  onPick: (c: Contact) => void;
}

function norm(s: string) {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

// Free-text search across everything a contact carries: name, email, phone,
// notes, city, country, custom fields, and the tags/communities they belong to.
export function MapSearch({ contacts, tags, onPick }: Props) {
  const [query, setQuery] = useState('');
  const setTagId = useMapStore((s) => s.setTagId);

  const tagById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);

  const results = useMemo(() => {
    const q = norm(query.trim());
    if (q.length < 2) return null;

    const matchedTags = tags.filter((t) => norm(t.name).includes(q)).slice(0, 5);

    const matchedContacts = contacts
      .filter((c) => {
        if (c.current_lng == null || c.current_lat == null) return false;
        const countryName = COUNTRY_BY_CODE.get(c.current_country ?? '')?.name ?? '';
        const tagNames = (c.tag_ids ?? []).map((id) => tagById.get(id)?.name ?? '').join(' ');
        const customValues = Object.values(c.custom ?? {})
          .map((v) => (typeof v === 'string' ? v : Array.isArray(v) ? v.join(' ') : ''))
          .join(' ');
        return norm(
          [
            c.full_name,
            c.primary_email ?? '',
            c.phone ?? '',
            c.notes ?? '',
            c.current_city ?? '',
            c.current_country ?? '',
            countryName,
            tagNames,
            customValues,
          ].join(' '),
        ).includes(q);
      })
      .slice(0, 20);

    return { matchedTags, matchedContacts };
  }, [query, contacts, tags, tagById]);

  return (
    <div className="map-search">
      <input
        className="search-input"
        placeholder="Search contacts, tags, places, notes"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
      />
      {results && (
        <div className="ms-results">
          {results.matchedTags.map((t) => (
            <button
              key={t.id}
              className="ms-row ms-tag"
              onClick={() => {
                setTagId(t.id);
                setQuery('');
              }}
            >
              <span className="mini-tag">{t.name}</span>
              <span className="muted">filter by this {t.kind}</span>
            </button>
          ))}
          {results.matchedContacts.map((c) => (
            <button
              key={c.id}
              className="ms-row"
              onClick={() => {
                onPick(c);
                setQuery('');
              }}
            >
              <span className={`dot ${c.category}`} />
              <span className="ms-name">{c.full_name}</span>
              <span className="muted">
                {[c.current_city, COUNTRY_BY_CODE.get(c.current_country ?? '')?.name]
                  .filter(Boolean)
                  .join(', ')}
              </span>
            </button>
          ))}
          {results.matchedTags.length === 0 && results.matchedContacts.length === 0 && (
            <div className="ms-empty muted">
              No match. Contacts without a location cannot be shown on the map.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
