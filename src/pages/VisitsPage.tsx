import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CityAutocomplete } from '../features/contacts/CityAutocomplete';
import { useContacts } from '../features/contacts/useContacts';
import { useContactLinks } from '../features/card/useCard';
import { useProfile } from '../features/profile/useProfile';
import { currentPlace, peopleAt, visitingPlace, type PersonAt, type Place } from '../features/visits/place';
import {
  useDeleteNotice,
  useLinkedLocations,
  useMarkNoticesRead,
  useSendVisitNotice,
  useVisitNotices,
} from '../features/visits/useVisits';
import { COUNTRY_BY_CODE } from '../lib/countries';
import type { Contact, ContactLink, LinkedLocation, VisitNotice } from '../lib/database.types';

const countryName = (code: string | null) => COUNTRY_BY_CODE.get(code ?? '')?.name ?? code ?? '';

function dateRange(from: string | null, to: string | null): string {
  const fmt = (d: string) =>
    new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  if (from && to) return from === to ? `on ${fmt(from)}` : `from ${fmt(from)} to ${fmt(to)}`;
  if (from) return `from ${fmt(from)}`;
  if (to) return `until ${fmt(to)}`;
  return '';
}

// wa.me needs the full international number; a local one would reach a stranger.
function whatsappUrl(phone: string, text: string): string | null {
  const p = phone.trim();
  if (!p.startsWith('+') && !p.startsWith('00')) return null;
  const digits = p.replace(/^00/, '').replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

// "?&body=" is the one spelling both iOS and Android accept.
const smsUrl = (phone: string, text: string) =>
  `sms:${phone.replace(/[^\d+]/g, '')}?&body=${encodeURIComponent(text)}`;

const mailUrl = (to: string, bcc: string[], subject: string, body: string) =>
  `mailto:${to}?${bcc.length ? `bcc=${bcc.map(encodeURIComponent).join(',')}&` : ''}subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

export function VisitsPage() {
  const { data: profile } = useProfile();
  const { data: contacts = [] } = useContacts();
  const { data: links } = useContactLinks();
  const { data: locations } = useLinkedLocations();

  if (!profile) return <div className="page-pad muted">Loading...</div>;
  return (
    <div className="page-pad import-page">
      <h2>Visits</h2>
      <Inbox contacts={contacts} links={links} />
      <Planner
        // Remount when detection lands, so the form starts from the detected city.
        key={profile.current_city ?? ''}
        initial={visitingPlace(profile) ?? null}
        here={currentPlace(profile)}
        locationOn={profile.location_enabled}
        contacts={contacts}
        links={links ?? new Map()}
        locations={locations ?? new Map()}
      />
      <Whereabouts contacts={contacts} locations={locations} />
    </div>
  );
}

function ContactActions({ contact, text, subject }: { contact: Contact; text: string; subject: string }) {
  const wa = contact.phone ? whatsappUrl(contact.phone, text) : null;
  return (
    <span className="person-actions">
      {contact.primary_email && <a href={mailUrl(contact.primary_email, [], subject, text)}>Email</a>}
      {wa && <a href={wa} target="_blank" rel="noreferrer">WhatsApp</a>}
      {contact.phone && <a href={smsUrl(contact.phone, text)}>SMS</a>}
    </span>
  );
}

function Inbox({ contacts, links }: { contacts: Contact[]; links?: Map<string, ContactLink> }) {
  const { data: notices = [] } = useVisitNotices();
  const markRead = useMarkNoticesRead();
  const remove = useDeleteNotice();

  const unread = notices.filter((n) => !n.read_at).map((n) => n.id).join(',');
  const { mutate: mark } = markRead;
  useEffect(() => {
    if (unread) mark(unread.split(','));
  }, [unread, mark]);

  if (notices.length === 0) return null;

  const contactOf = (n: VisitNotice) => {
    const link = [...(links?.values() ?? [])].find((l) => l.peer_id === n.from_user);
    return link && contacts.find((c) => c.id === link.contact_id);
  };

  return (
    <section className="import-card">
      <h3>Visiting you</h3>
      <div className="people-list">
        {notices.map((n) => {
          const contact = contactOf(n);
          const reply = `Hi ${n.from_name.split(' ')[0]}, good to hear you are in ${n.city ?? 'town'}! `;
          return (
            <div key={n.id} className="notice">
              <div>
                <strong>{contact?.full_name ?? n.from_name}</strong> is in{' '}
                {[n.city, countryName(n.country)].filter(Boolean).join(', ')} {dateRange(n.date_from, n.date_to)}
              </div>
              {n.message && <div className="notice-text">{n.message}</div>}
              <div className="person-row">
                {contact && <ContactActions contact={contact} text={reply} subject="Catching up" />}
                <button className="link" onClick={() => remove.mutate(n.id)}>Dismiss</button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Planner({
  initial,
  here,
  locationOn,
  contacts,
  links,
  locations,
}: {
  initial: Place | null;
  here: Place | null;
  locationOn: boolean;
  contacts: Contact[];
  links: Map<string, ContactLink>;
  locations: Map<string, LinkedLocation>;
}) {
  const send = useSendVisitNotice();
  const [place, setPlace] = useState<Place | null>(initial);
  const [cityText, setCityText] = useState(initial?.city ?? '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [custom, setCustom] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<string | null>(null);

  const people = useMemo(
    () => (place ? peopleAt(contacts, place, locations) : null),
    [place, contacts, locations],
  );

  const when = dateRange(from || null, to || null);
  const message =
    custom ??
    (place
      ? `Hi! I am in ${place.city}${when ? ` ${when}` : ''} and would love to catch up. Are you around?`
      : '');
  const subject = place ? `I am in ${place.city}` : '';

  function toggle(id: string) {
    setResult(null);
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function pickAll(list: PersonAt[]) {
    setPicked((s) => new Set([...s, ...list.map((p) => p.contact.id)]));
  }

  async function notify() {
    if (!place || !people) return;
    const chosen = [...people.inCity, ...people.inCountry]
      .map((p) => p.contact)
      .filter((c) => picked.has(c.id));
    const members = chosen.filter((c) => links.has(c.id));
    const byEmail = chosen.filter((c) => !links.has(c.id) && c.primary_email);
    const phoneOnly = chosen.filter((c) => !links.has(c.id) && !c.primary_email);

    const parts: string[] = [];
    if (members.length) {
      try {
        const n = await send.mutateAsync({
          contactIds: members.map((c) => c.id),
          city: place.city,
          country: place.country,
          from: from || null,
          to: to || null,
          message,
        });
        parts.push(`Notified ${n} in the app.`);
      } catch {
        setResult('The in-app notices did not go through. Try again in a moment.');
        return;
      }
    }
    if (byEmail.length) {
      // Bcc, so the recipients do not get each other's addresses.
      window.location.href = mailUrl('', byEmail.map((c) => c.primary_email!), subject, message);
      parts.push(`Opened an email to ${byEmail.length} in your mail app - press send there.`);
    }
    if (phoneOnly.length) {
      parts.push(
        `${phoneOnly.length} ${phoneOnly.length === 1 ? 'has' : 'have'} no email: use the WhatsApp or SMS link on their row.`,
      );
    }
    setResult(parts.join(' '));
  }

  const row = ({ contact, hereNow }: PersonAt) => (
    <label key={contact.id} className="person-row">
      <input type="checkbox" checked={picked.has(contact.id)} onChange={() => toggle(contact.id)} />
      <span className="person-name">
        {contact.full_name}
        {links.has(contact.id) && <span className="member-badge" title="Gets the notice inside the app">member</span>}
        {hereNow && <span className="member-badge now">here now</span>}
      </span>
      <span className="muted person-place">{contact.current_city ?? countryName(contact.current_country)}</span>
      <ContactActions contact={contact} text={message} subject={subject} />
    </label>
  );

  return (
    <section className="import-card">
      <h3>Who do I know there?</h3>
      {!locationOn && (
        <p className="muted">
          Pick a city you are in or heading to. To have this open by itself when you arrive
          somewhere, turn on city location in <Link to="/settings">Settings</Link>.
        </p>
      )}
      <div className="visit-form">
        <label>
          City
          <CityAutocomplete
            city={cityText}
            onCityChange={setCityText}
            onPick={(c) => {
              setPlace({ city: c.name, country: c.country, lat: c.lat, lng: c.lng });
              setCityText(c.name);
              setPicked(new Set());
              setResult(null);
            }}
          />
        </label>
        <label>
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      {here && here.city !== place?.city && (
        <button
          className="link"
          onClick={() => {
            setPlace(here);
            setCityText(here.city);
          }}
        >
          Use where I am now: {here.city}
        </button>
      )}

      {place && people && (
        <>
          {people.inCity.length + people.inCountry.length === 0 ? (
            <p className="muted">
              Nobody in your contacts is placed in {place.city} or elsewhere in{' '}
              {countryName(place.country)}.
            </p>
          ) : (
            <>
              <PeopleGroup
                title={`In ${place.city}`}
                list={people.inCity}
                onAll={() => pickAll(people.inCity)}
                row={row}
              />
              <PeopleGroup
                title={`Elsewhere in ${countryName(place.country)}`}
                list={people.inCountry}
                onAll={() => pickAll(people.inCountry)}
                row={row}
              />
              <label className="li-field">
                Message
                <textarea rows={3} value={message} onChange={(e) => setCustom(e.target.value)} />
              </label>
              <div className="actions-row">
                <button onClick={notify} disabled={picked.size === 0 || send.isPending}>
                  {send.isPending ? 'Sending...' : `Let ${picked.size || ''} know I am visiting`}
                </button>
                {picked.size > 0 && (
                  <button className="link" onClick={() => setPicked(new Set())}>Clear</button>
                )}
              </div>
              <p className="muted small">
                Connected members get the notice inside the app. Everyone else gets it from you:
                contacts with an email in one message from your own mail app, the rest through
                the WhatsApp or SMS link on their row.
              </p>
              {result && <div className="summary">{result}</div>}
            </>
          )}
        </>
      )}
    </section>
  );
}

function PeopleGroup({
  title,
  list,
  onAll,
  row,
}: {
  title: string;
  list: PersonAt[];
  onAll: () => void;
  row: (p: PersonAt) => React.ReactNode;
}) {
  if (list.length === 0) return null;
  return (
    <div className="people-group">
      <div className="people-head">
        <strong>
          {title} <span className="muted">({list.length})</span>
        </strong>
        <button className="link" onClick={onAll}>Select all</button>
      </div>
      <div className="people-list">{list.map(row)}</div>
    </div>
  );
}

function Whereabouts({
  contacts,
  locations,
}: {
  contacts: Contact[];
  locations?: Map<string, LinkedLocation>;
}) {
  if (!locations?.size) return null;
  const rows = contacts.filter((c) => locations.has(c.id));
  return (
    <section className="import-card">
      <h3>Where connected members are</h3>
      <p className="muted">Members who share their city with the people they are connected to.</p>
      <div className="people-list">
        {rows.map((c) => {
          const l = locations.get(c.id)!;
          return (
            <div key={c.id} className="person-row">
              <span className="person-name">{c.full_name}</span>
              <span className="muted person-place">
                {[l.city, countryName(l.country)].filter(Boolean).join(', ')}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
