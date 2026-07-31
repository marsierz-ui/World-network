import { useState } from 'react';
import type { Contact, ContactCategory, FieldDefinition } from '../../lib/database.types';
import { COUNTRIES } from '../../lib/countries';
import { geocode } from '../../lib/geocode';
import { PLATFORMS, searchUrl } from '../../lib/socials';
import { LocationPicker } from './LocationPicker';
import type { ContactInput } from './useContacts';

interface Props {
  initial?: Contact;
  fields: FieldDefinition[];
  onSubmit: (input: ContactInput) => void;
  onCancel: () => void;
  busy?: boolean;
}

const CATEGORIES: ContactCategory[] = ['work', 'private', 'other'];

export function ContactForm({ initial, fields, onSubmit, onCancel, busy }: Props) {
  const [fullName, setFullName] = useState(initial?.full_name ?? '');
  const [email, setEmail] = useState(initial?.primary_email ?? '');
  const [originCountry, setOriginCountry] = useState(initial?.origin_country ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [city, setCity] = useState(initial?.current_city ?? '');
  const [country, setCountry] = useState(initial?.current_country ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [category, setCategory] = useState<ContactCategory>(initial?.category ?? 'other');
  const [custom, setCustom] = useState<Record<string, unknown>>(initial?.custom ?? {});
  const [socials, setSocials] = useState<Record<string, string>>(initial?.socials ?? {});
  const [pin, setPin] = useState<{ lng: number; lat: number } | null>(
    initial?.current_lng != null && initial?.current_lat != null
      ? { lng: initial.current_lng, lat: initial.current_lat }
      : null,
  );
  const [showPicker, setShowPicker] = useState(false);

  function setCustomField(key: string, value: unknown) {
    setCustom((c) => ({ ...c, [key]: value }));
  }

  // Changing city/country invalidates a manual pin so geocoding re-runs.
  function changeCity(v: string) { setCity(v); setPin(null); }
  function changeCountry(v: string) { setCountry(v); setPin(null); }

  const autoGeo = pin ? null : geocode(city || null, country || null);
  const locationLabel = pin
    ? `Pinned ${pin.lat.toFixed(2)}, ${pin.lng.toFixed(2)}`
    : autoGeo
      ? `Auto: ${autoGeo.precision}`
      : 'No location';

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      full_name: fullName,
      primary_email: email || null,
      phone: phone || null,
      notes: notes || null,
      origin_country: originCountry || null,
      current_city: city || null,
      current_country: country || null,
      category,
      custom,
      socials: Object.fromEntries(Object.entries(socials).filter(([, v]) => v.trim())),
      current_lng: pin?.lng,
      current_lat: pin?.lat,
    });
  }

  return (
    <form className="contact-form" onSubmit={submit}>
      <label>
        Full name
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      </label>
      <div className="row">
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Phone
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
      </div>
      <div className="row">
        <label>
          Current city
          <input value={city} onChange={(e) => changeCity(e.target.value)} />
        </label>
        <label>
          Current country
          <CountrySelect value={country} onChange={changeCountry} />
        </label>
      </div>
      <div className="location-status">
        <span className={pin || autoGeo ? 'loc-ok' : 'loc-warn'}>{locationLabel}</span>
        <div>
          <button type="button" className="link" onClick={() => setShowPicker(true)}>
            Set exact location
          </button>
          {pin && (
            <button type="button" className="link" onClick={() => setPin(null)}>
              clear pin
            </button>
          )}
        </div>
      </div>
      <div className="row">
        <label>
          Origin country
          <CountrySelect value={originCountry} onChange={setOriginCountry} />
        </label>
        <label>
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value as ContactCategory)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>

      {fields.length > 0 && <div className="section-label">Custom fields</div>}
      {fields.map((f) => (
        <CustomField
          key={f.id}
          def={f}
          value={custom[f.key]}
          onChange={(v) => setCustomField(f.key, v)}
        />
      ))}

      <div className="section-label">Social links {fullName && <span className="muted">— "find" searches the name</span>}</div>
      <div className="socials-edit">
        {PLATFORMS.map((p) => (
          <div key={p.key} className="social-row">
            <span className="social-ic" title={p.label}>{p.icon}</span>
            <input
              placeholder={`${p.label} handle or URL${p.feed ? ' (feed)' : ''}`}
              value={socials[p.key] ?? ''}
              onChange={(e) => setSocials((s) => ({ ...s, [p.key]: e.target.value }))}
            />
            {p.key !== 'website' && fullName.trim() && (
              <a
                className="social-find"
                href={searchUrl(p.key, fullName)}
                target="_blank"
                rel="noreferrer"
                title={`Search ${p.label} for ${fullName}`}
              >
                find
              </a>
            )}
          </div>
        ))}
      </div>

      <label>
        Notes
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      <div className="actions">
        <button type="button" className="link" onClick={onCancel}>Cancel</button>
        <button type="submit" disabled={busy}>{initial ? 'Save' : 'Add contact'}</button>
      </div>

      {showPicker && (
        <LocationPicker
          initial={pin}
          city={city}
          country={country}
          onConfirm={(coords) => { setPin(coords); setShowPicker(false); }}
          onCancel={() => setShowPicker(false)}
        />
      )}
    </form>
  );
}

function CountrySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">--</option>
      {COUNTRIES.map((c) => (
        <option key={c.code} value={c.code}>{c.name}</option>
      ))}
    </select>
  );
}

function CustomField({
  def,
  value,
  onChange,
}: {
  def: FieldDefinition;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  switch (def.type) {
    case 'boolean':
      return (
        <label className="checkbox">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          {def.label}
        </label>
      );
    case 'number':
      return (
        <label>
          {def.label}
          <input
            type="number"
            value={value === undefined || value === null ? '' : String(value)}
            onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          />
        </label>
      );
    case 'date':
      return (
        <label>
          {def.label}
          <input type="date" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
        </label>
      );
    case 'select':
      return (
        <label>
          {def.label}
          <select value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)}>
            <option value="">--</option>
            {def.options.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </label>
      );
    case 'tags':
      return (
        <label>
          {def.label} <span className="muted">(comma-separated)</span>
          <input
            value={Array.isArray(value) ? (value as string[]).join(', ') : ''}
            onChange={(e) =>
              onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))
            }
          />
        </label>
      );
    default:
      return (
        <label>
          {def.label}
          <input value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
        </label>
      );
  }
}
