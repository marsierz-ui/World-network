import { useState } from 'react';
import type {
  Contact,
  ContactAddress,
  ContactCategory,
  ContactDetails,
  ContactOrganization,
  FieldDefinition,
  LabeledValue,
} from '../../lib/database.types';
import { COUNTRIES } from '../../lib/countries';
import { ComboSelect } from '../../components/ComboSelect';
import { geocode } from '../../lib/geocode';
import { PLATFORMS, searchUrl } from '../../lib/socials';
import { LocationPicker } from './LocationPicker';
import { CityAutocomplete } from './CityAutocomplete';
import type { City } from '../../lib/cities';
import type { ContactInput } from './useContacts';

interface Props {
  initial?: Contact;
  fields: FieldDefinition[];
  onSubmit: (input: ContactInput) => void;
  onCancel: () => void;
  busy?: boolean;
}

const CATEGORIES: ContactCategory[] = ['work', 'private', 'other'];

// Google's own label sets. They are suggestions, not a closed list - the People
// API takes any string as a type, and so does the Google Contacts editor.
const EMAIL_LABELS = ['home', 'work', 'other'];
const PHONE_LABELS = ['mobile', 'home', 'work', 'main', 'workFax', 'homeFax', 'pager', 'other'];
const ADDRESS_LABELS = ['home', 'work', 'other'];
const URL_LABELS = ['homePage', 'blog', 'profile', 'work', 'other'];
const CHAT_LABELS = ['googleTalk', 'skype', 'jabber', 'qq', 'icq', 'aim', 'msn', 'netMeeting'];
const RELATION_LABELS = [
  'spouse', 'child', 'mother', 'father', 'parent', 'brother', 'sister', 'friend',
  'relative', 'domesticPartner', 'manager', 'assistant', 'referredBy', 'partner',
];
const EVENT_LABELS = ['anniversary', 'other'];

const DATE_HINT = 'YYYY-MM-DD (or --MM-DD)';

/**
 * Contacts that predate the `details` column, or came from CSV, hold their only
 * email and phone in the scalar columns. Seed the lists from them so opening
 * the form does not look like the data vanished.
 */
function seedDetails(initial?: Contact): ContactDetails {
  const d: ContactDetails = { ...(initial?.details ?? {}) };
  if (!d.emails?.length && initial?.primary_email) {
    d.emails = [{ label: '', value: initial.primary_email }];
  }
  if (!d.phones?.length && initial?.phone) {
    d.phones = [{ label: '', value: initial.phone }];
  }
  return d;
}

function cleanDetails(d: ContactDetails): ContactDetails {
  const keepValue = (r: LabeledValue) => r.value.trim() !== '';
  const out: ContactDetails = {
    ...d,
    emails: d.emails?.filter(keepValue),
    phones: d.phones?.filter(keepValue),
    urls: d.urls?.filter(keepValue),
    chats: d.chats?.filter(keepValue),
    relations: d.relations?.filter(keepValue),
    events: d.events?.filter(keepValue),
    user_defined: d.user_defined?.filter((r) => r.label.trim() || r.value.trim()),
    organizations: d.organizations?.filter((o) => o.name.trim() || o.title.trim() || o.department.trim()),
    addresses: d.addresses?.filter(
      (a) => a.street.trim() || a.city.trim() || a.region.trim() || a.postal_code.trim() || a.country,
    ),
  };
  // Empty keys are noise in every sync payload and diff.
  for (const [k, v] of Object.entries(out)) {
    if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) {
      delete out[k as keyof ContactDetails];
    }
  }
  return out;
}

export function ContactForm({ initial, fields, onSubmit, onCancel, busy }: Props) {
  const [fullName, setFullName] = useState(initial?.full_name ?? '');
  const [originCountry, setOriginCountry] = useState(initial?.origin_country ?? '');
  const [city, setCity] = useState(initial?.current_city ?? '');
  const [country, setCountry] = useState(initial?.current_country ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [category, setCategory] = useState<ContactCategory>(initial?.category ?? 'other');
  const [custom, setCustom] = useState<Record<string, unknown>>(initial?.custom ?? {});
  const [socials, setSocials] = useState<Record<string, string>>(initial?.socials ?? {});
  const [details, setDetails] = useState<ContactDetails>(() => seedDetails(initial));
  const [showNameParts, setShowNameParts] = useState(false);
  const [pin, setPin] = useState<{ lng: number; lat: number } | null>(
    initial?.current_lng != null && initial?.current_lat != null
      ? { lng: initial.current_lng, lat: initial.current_lat }
      : null,
  );
  const [showPicker, setShowPicker] = useState(false);

  function setField<K extends keyof ContactDetails>(key: K, value: ContactDetails[K]) {
    setDetails((d) => ({ ...d, [key]: value }));
  }

  function setCustomField(key: string, value: unknown) {
    setCustom((c) => ({ ...c, [key]: value }));
  }

  // Changing city/country invalidates a manual pin so geocoding re-runs.
  function changeCity(v: string) { setCity(v); setPin(null); }
  function changeCountry(v: string) { setCountry(v); setPin(null); }

  // Picking a suggestion settles all three at once, so the saved coordinates
  // cannot drift to a same-named city in another country.
  function pickCity(c: City) {
    setCity(c.name);
    setCountry(c.country);
    setPin({ lng: c.lng, lat: c.lat });
  }

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
      // primary_email and phone are derived from details by useContacts.
      primary_email: null,
      phone: null,
      notes: notes || null,
      origin_country: originCountry || null,
      current_city: city || null,
      current_country: country || null,
      category,
      custom,
      details: cleanDetails(details),
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
      <button type="button" className="link align-start" onClick={() => setShowNameParts((v) => !v)}>
        {showNameParts ? 'Hide name details' : 'Name details, nickname, file as'}
      </button>
      {showNameParts && (
        <div className="name-parts">
          <div className="row">
            <label>
              Prefix
              <input value={details.prefix ?? ''} onChange={(e) => setField('prefix', e.target.value)} />
            </label>
            <label>
              Suffix
              <input value={details.suffix ?? ''} onChange={(e) => setField('suffix', e.target.value)} />
            </label>
          </div>
          <div className="row">
            <label>
              First name
              <input value={details.first_name ?? ''} onChange={(e) => setField('first_name', e.target.value)} />
            </label>
            <label>
              Middle name
              <input value={details.middle_name ?? ''} onChange={(e) => setField('middle_name', e.target.value)} />
            </label>
          </div>
          <div className="row">
            <label>
              Last name
              <input value={details.last_name ?? ''} onChange={(e) => setField('last_name', e.target.value)} />
            </label>
            <label>
              Nickname
              <input value={details.nickname ?? ''} onChange={(e) => setField('nickname', e.target.value)} />
            </label>
          </div>
          <div className="row">
            <label>
              Phonetic first
              <input value={details.phonetic_first ?? ''} onChange={(e) => setField('phonetic_first', e.target.value)} />
            </label>
            <label>
              Phonetic last
              <input value={details.phonetic_last ?? ''} onChange={(e) => setField('phonetic_last', e.target.value)} />
            </label>
          </div>
          <div className="row">
            <label>
              Phonetic middle
              <input value={details.phonetic_middle ?? ''} onChange={(e) => setField('phonetic_middle', e.target.value)} />
            </label>
            <label>
              File as
              <input value={details.file_as ?? ''} onChange={(e) => setField('file_as', e.target.value)} />
            </label>
          </div>
        </div>
      )}

      <LabeledRows
        title="Email"
        rows={details.emails ?? []}
        onChange={(r) => setField('emails', r)}
        options={EMAIL_LABELS}
        placeholder="name@example.com"
        note="The first entry is the one shown in lists and used to match duplicates."
      />
      <LabeledRows
        title="Phone"
        rows={details.phones ?? []}
        onChange={(r) => setField('phones', r)}
        options={PHONE_LABELS}
        placeholder="+41 79 000 00 00"
      />

      <div className="section-label">Map location</div>
      <div className="row">
        <label>
          Current city
          <CityAutocomplete city={city} onCityChange={changeCity} onPick={pickCity} />
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

      <OrganizationRows
        rows={details.organizations ?? []}
        onChange={(r) => setField('organizations', r)}
      />

      <label>
        Birthday <span className="muted">{DATE_HINT}</span>
        <input
          value={details.birthday ?? ''}
          placeholder={DATE_HINT}
          onChange={(e) => setField('birthday', e.target.value)}
        />
      </label>

      <AddressRows rows={details.addresses ?? []} onChange={(r) => setField('addresses', r)} />

      <LabeledRows
        title="Website"
        rows={details.urls ?? []}
        onChange={(r) => setField('urls', r)}
        options={URL_LABELS}
        placeholder="https://..."
      />
      <LabeledRows
        title="Chat"
        rows={details.chats ?? []}
        onChange={(r) => setField('chats', r)}
        options={CHAT_LABELS}
        placeholder="username"
      />
      <LabeledRows
        title="Related people"
        rows={details.relations ?? []}
        onChange={(r) => setField('relations', r)}
        options={RELATION_LABELS}
        placeholder="Name"
      />
      <LabeledRows
        title="Significant dates"
        rows={details.events ?? []}
        onChange={(r) => setField('events', r)}
        options={EVENT_LABELS}
        placeholder={DATE_HINT}
      />
      <LabeledRows
        title="Custom fields"
        rows={details.user_defined ?? []}
        onChange={(r) => setField('user_defined', r)}
        options={[]}
        placeholder="Value"
        note="Synced to Google as custom fields."
      />

      {fields.length > 0 && <div className="section-label">App-only fields</div>}
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

// Google allows any string as a label, so the suggestions go in a datalist
// rather than a select - pick one or type your own, same as Google's editor.
function LabeledRows({
  title,
  rows,
  onChange,
  options,
  placeholder,
  note,
}: {
  title: string;
  rows: LabeledValue[];
  onChange: (rows: LabeledValue[]) => void;
  options: string[];
  placeholder: string;
  note?: string;
}) {
  const listId = `dl-${title.replace(/\s+/g, '-').toLowerCase()}`;

  function set(i: number, patch: Partial<LabeledValue>) {
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  return (
    <div className="repeat-block">
      <div className="section-label">{title}</div>
      {note && <div className="muted small">{note}</div>}
      {options.length > 0 && (
        <datalist id={listId}>
          {options.map((o) => <option key={o} value={o} />)}
        </datalist>
      )}
      {rows.map((r, i) => (
        <div key={i} className="repeat-row">
          <input
            className="rr-label"
            list={options.length ? listId : undefined}
            placeholder="Label"
            value={r.label}
            onChange={(e) => set(i, { label: e.target.value })}
          />
          <input
            placeholder={placeholder}
            value={r.value}
            onChange={(e) => set(i, { value: e.target.value })}
          />
          <button
            type="button"
            className="rr-x"
            title="Remove"
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="link align-start"
        onClick={() => onChange([...rows, { label: '', value: '' }])}
      >
        + Add {title.toLowerCase()}
      </button>
    </div>
  );
}

function OrganizationRows({
  rows,
  onChange,
}: {
  rows: ContactOrganization[];
  onChange: (rows: ContactOrganization[]) => void;
}) {
  function set(i: number, patch: Partial<ContactOrganization>) {
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  return (
    <div className="repeat-block">
      <div className="section-label">Organization</div>
      {rows.map((r, i) => (
        <div key={i} className="repeat-row org-row">
          <input placeholder="Company" value={r.name} onChange={(e) => set(i, { name: e.target.value })} />
          <input placeholder="Job title" value={r.title} onChange={(e) => set(i, { title: e.target.value })} />
          <input placeholder="Department" value={r.department} onChange={(e) => set(i, { department: e.target.value })} />
          <button
            type="button"
            className="rr-x"
            title="Remove"
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="link align-start"
        onClick={() => onChange([...rows, { name: '', title: '', department: '' }])}
      >
        + Add organization
      </button>
    </div>
  );
}

function AddressRows({
  rows,
  onChange,
}: {
  rows: ContactAddress[];
  onChange: (rows: ContactAddress[]) => void;
}) {
  function set(i: number, patch: Partial<ContactAddress>) {
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  return (
    <div className="repeat-block">
      <div className="section-label">Postal address</div>
      <div className="muted small">
        Separate from the map location above, which is what places the contact on the map.
      </div>
      <datalist id="dl-address">
        {ADDRESS_LABELS.map((o) => <option key={o} value={o} />)}
      </datalist>
      {rows.map((r, i) => (
        <div key={i} className="addr-row">
          <input
            className="rr-label"
            list="dl-address"
            placeholder="Label"
            value={r.label}
            onChange={(e) => set(i, { label: e.target.value })}
          />
          <input placeholder="Street" value={r.street} onChange={(e) => set(i, { street: e.target.value })} />
          <input placeholder="City" value={r.city} onChange={(e) => set(i, { city: e.target.value })} />
          <input placeholder="Region" value={r.region} onChange={(e) => set(i, { region: e.target.value })} />
          <input placeholder="Postal code" value={r.postal_code} onChange={(e) => set(i, { postal_code: e.target.value })} />
          <CountrySelect value={r.country} onChange={(v) => set(i, { country: v })} />
          <button
            type="button"
            className="rr-x"
            title="Remove"
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="link align-start"
        onClick={() =>
          onChange([
            ...rows,
            { label: '', street: '', city: '', region: '', postal_code: '', country: '' },
          ])
        }
      >
        + Add address
      </button>
    </div>
  );
}

function CountrySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <ComboSelect
      options={COUNTRIES.map((c) => ({ value: c.code, label: c.name }))}
      value={value}
      onChange={onChange}
      emptyLabel="--"
      placeholder="Search countries..."
    />
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
