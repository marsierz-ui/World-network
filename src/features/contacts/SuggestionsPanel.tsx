import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Contact } from '../../lib/database.types';
import { COUNTRY_BY_CODE, findCountryByNameOnly } from '../../lib/countries';
import { geocodeCandidates } from '../../lib/geocode';
import { useContactTagMap, useTags } from '../tags/useTags';
import type { City } from '../../lib/cities';
import { useUpdateContact } from './useContacts';

interface Option {
  city: string | null;
  country: string | null;
  label: string;
  lng?: number;
  lat?: number;
}

interface Suggestion {
  contact: Contact;
  source: string; // where the guess came from, shown to the user
  options: Option[];
}

function words(text: string) {
  return text.split(/[^\p{Letter}]+/u).filter((w) => w.length > 3);
}

// Build the candidate places implied by a piece of text: a country name, or a
// city name that may exist in several countries (offered as separate options).
function optionsFromText(text: string): { options: Option[]; matched: string } | null {
  const ws = words(text);

  for (let i = 0; i < ws.length; i++) {
    const bigram = i + 1 < ws.length ? `${ws[i]} ${ws[i + 1]}` : '';
    const c = findCountryByNameOnly(ws[i]) ?? (bigram ? findCountryByNameOnly(bigram) : undefined);
    if (c) {
      return { matched: c.name, options: [{ city: null, country: c.code, label: c.name }] };
    }
  }

  for (const w of ws) {
    const cands: City[] = geocodeCandidates(w).slice(0, 4);
    if (cands.length) {
      return {
        matched: w,
        options: cands.map((c) => ({
          city: c.name,
          country: c.country,
          lng: c.lng,
          lat: c.lat,
          label: `${c.name}, ${COUNTRY_BY_CODE.get(c.country)?.name ?? c.country}${
            c.population ? ` (${c.population.toLocaleString()})` : ''
          }`,
        })),
      };
    }
  }
  return null;
}

// Location guesses for contacts with no location, drawn from their notes and
// their labels. Never applied automatically; the user picks one or dismisses.
export function SuggestionsPanel({ contacts }: { contacts: Contact[] }) {
  const update = useUpdateContact();
  const navigate = useNavigate();
  const { data: tags = [] } = useTags();
  const { data: tagMap = {} } = useContactTagMap();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(false);

  const tagName = useMemo(() => new Map(tags.map((t) => [t.id, t.name])), [tags]);

  const suggestions = useMemo<Suggestion[]>(() => {
    const out: Suggestion[] = [];
    for (const c of contacts) {
      if (c.current_lng != null || dismissed.has(c.id)) continue;

      // Notes first, then each label; the first source that yields a place wins.
      const sources: { text: string; kind: string }[] = [];
      if (c.notes) sources.push({ text: c.notes, kind: 'note' });
      for (const id of tagMap[c.id] ?? []) {
        const n = tagName.get(id);
        if (n) sources.push({ text: n, kind: 'label' });
      }

      for (const s of sources) {
        const hit = optionsFromText(s.text);
        if (hit) {
          out.push({ contact: c, source: `${s.kind}: "${s.text}"`, options: hit.options });
          break;
        }
      }
    }
    return out;
  }, [contacts, dismissed, tagMap, tagName]);

  if (suggestions.length === 0) return null;

  function apply(contactId: string, o: Option) {
    update.mutate({
      id: contactId,
      input: {
        ...(o.city ? { current_city: o.city } : {}),
        ...(o.country ? { current_country: o.country } : {}),
        ...(o.lng != null && o.lat != null ? { current_lng: o.lng, current_lat: o.lat } : {}),
      },
    });
    setDismissed((d) => new Set(d).add(contactId));
  }

  return (
    <section className="suggestions">
      <div className="sugg-head" onClick={() => setCollapsed((v) => !v)}>
        <strong>Location suggestions from notes and labels ({suggestions.length})</strong>
        <button className="link">{collapsed ? 'show' : 'hide'}</button>
      </div>
      {!collapsed && (
        <ul>
          {suggestions.map(({ contact, source, options }) => (
            <li key={contact.id}>
              <span className="sugg-name">{contact.full_name}</span>
              <span className="muted sugg-note">{source}</span>
              <span className="sugg-options">
                {options.map((o) => (
                  <button key={o.label} className="sugg-opt" onClick={() => apply(contact.id, o)}>
                    {o.label}
                  </button>
                ))}
              </span>
              <span className="sugg-actions">
                <button className="link" onClick={() => navigate(`/contacts?id=${contact.id}`)}>
                  view
                </button>
                <button
                  className="link"
                  onClick={() => setDismissed((d) => new Set(d).add(contact.id))}
                >
                  dismiss
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
