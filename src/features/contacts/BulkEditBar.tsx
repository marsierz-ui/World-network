import { useState } from 'react';
import { ComboSelect } from '../../components/ComboSelect';
import { COUNTRIES } from '../../lib/countries';
import { CityAutocomplete } from './CityAutocomplete';
import { useBulkUpdateContacts, type ContactInput } from './useContacts';
import { useAddTagToContacts, useTags } from '../tags/useTags';
import type { City } from '../../lib/cities';
import type { ContactCategory } from '../../lib/database.types';

interface Props {
  ids: string[];
  onClear: () => void;
}

// Edit many contacts at once. Every field starts empty and only the ones the
// user fills are sent, so applying a city does not blank everyone's category.
export function BulkEditBar({ ids, onClear }: Props) {
  const bulk = useBulkUpdateContacts();
  const addTag = useAddTagToContacts();
  const { data: tags = [] } = useTags();

  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [origin, setOrigin] = useState('');
  const [notes, setNotes] = useState('');
  const [tagId, setTagId] = useState('');
  const [done, setDone] = useState(0);

  function buildPatch(): Partial<ContactInput> {
    const patch: Partial<ContactInput> = {};
    if (category) patch.category = category as ContactCategory;
    if (origin) patch.origin_country = origin;
    if (notes.trim()) patch.notes = notes.trim();
    // The location patch is geocoded from city+country together, so send both
    // whenever either was filled - otherwise the pin lands in the wrong place.
    if (city.trim() || country) {
      patch.current_city = city.trim() || null;
      patch.current_country = country || null;
    }
    return patch;
  }

  const hasPatch = Boolean(category || origin || notes.trim() || city.trim() || country);
  const busy = bulk.isPending || addTag.isPending;

  function pickCity(c: City) {
    setCity(c.name);
    setCountry(c.country);
  }

  function reset() {
    setCategory('');
    setCity('');
    setCountry('');
    setOrigin('');
    setNotes('');
    setTagId('');
  }

  async function apply() {
    if (hasPatch) await bulk.mutateAsync({ ids, input: buildPatch() });
    if (tagId) await addTag.mutateAsync({ contactIds: ids, tagId });
    setDone(ids.length);
    reset();
  }

  return (
    <div className="bulk-bar">
      <div className="bulk-head">
        <strong>{ids.length} selected</strong>
        <button className="link" onClick={onClear}>clear selection</button>
      </div>

      <div className="bulk-fields">
        <label>
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">keep</option>
            <option value="work">work</option>
            <option value="private">private</option>
            <option value="other">other</option>
          </select>
        </label>
        <label>
          City
          <CityAutocomplete city={city} onCityChange={setCity} onPick={pickCity} />
        </label>
        <label>
          Country
          <ComboSelect
            options={COUNTRIES.map((c) => ({ value: c.code, label: c.name }))}
            value={country}
            onChange={setCountry}
            emptyLabel="keep"
            placeholder="Search countries..."
          />
        </label>
        <label>
          Origin country
          <ComboSelect
            options={COUNTRIES.map((c) => ({ value: c.code, label: c.name }))}
            value={origin}
            onChange={setOrigin}
            emptyLabel="keep"
            placeholder="Search countries..."
          />
        </label>
        <label>
          Add label
          <select value={tagId} onChange={(e) => setTagId(e.target.value)}>
            <option value="">none</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>
        <label className="bulk-notes">
          Notes (replaces)
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="leave empty to keep" />
        </label>
      </div>

      <div className="bulk-actions">
        <button onClick={apply} disabled={busy || (!hasPatch && !tagId)}>
          {busy ? 'Applying...' : `Apply to ${ids.length}`}
        </button>
        {bulk.isError && <span className="error">{(bulk.error as Error).message}</span>}
        {done > 0 && !busy && <span className="muted">Updated {done} contacts.</span>}
      </div>
    </div>
  );
}
