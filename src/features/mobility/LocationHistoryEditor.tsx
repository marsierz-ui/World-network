import { useState } from 'react';
import type { LocationType } from '../../lib/database.types';
import { COUNTRIES, COUNTRY_BY_CODE } from '../../lib/countries';
import {
  useAddLocation,
  useContactLocationHistory,
  useDeleteLocation,
} from './useLocationHistory';

export function LocationHistoryEditor({ contactId }: { contactId: string }) {
  const { data: rows = [] } = useContactLocationHistory(contactId);
  const add = useAddLocation();
  const del = useDeleteLocation();

  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [type, setType] = useState<LocationType>('residence');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!city && !country) return;
    add.mutate(
      {
        contactId,
        input: {
          city: city || null,
          country: country || null,
          date_from: from || null,
          date_to: to || null,
          type,
        },
      },
      { onSuccess: () => { setCity(''); setFrom(''); setTo(''); } },
    );
  }

  return (
    <div className="loc-history">
      <div className="section-label">Location history (for mobility)</div>
      <ul className="lh-list">
        {rows.map((r) => (
          <li key={r.id}>
            <span className={`lh-type ${r.type}`}>{r.type === 'work' ? 'W' : 'R'}</span>
            <span className="lh-place">
              {r.city ?? COUNTRY_BY_CODE.get(r.country ?? '')?.name ?? r.country ?? '?'}
              {r.lng == null && <span className="lh-warn" title="not geocoded"> ⚠</span>}
            </span>
            <span className="muted lh-dates">
              {(r.date_from ?? '?').slice(0, 7)} – {r.date_to ? r.date_to.slice(0, 7) : 'now'}
            </span>
            <button className="link" onClick={() => del.mutate(r.id)}>x</button>
          </li>
        ))}
        {rows.length === 0 && <li className="muted">No history yet.</li>}
      </ul>

      <form className="lh-add" onSubmit={submit}>
        <div className="row">
          <input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
          <select value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">country</option>
            {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </div>
        <div className="row">
          <input type="month" value={from} onChange={(e) => setFrom(e.target.value)} title="from" />
          <input type="month" value={to} onChange={(e) => setTo(e.target.value)} title="to (blank = now)" />
          <select value={type} onChange={(e) => setType(e.target.value as LocationType)}>
            <option value="residence">residence</option>
            <option value="work">work</option>
          </select>
        </div>
        <button type="submit" disabled={add.isPending}>Add location</button>
      </form>
    </div>
  );
}
