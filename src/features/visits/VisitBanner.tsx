import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useContacts } from '../contacts/useContacts';
import { useProfile } from '../profile/useProfile';
import { COUNTRY_BY_CODE } from '../../lib/countries';
import { peopleAt, visitingPlace } from './place';
import { useLinkedLocations } from './useVisits';

const KEY = 'wn.visit.seen';

// The automatic part: on opening the app somewhere other than home, say who
// lives there. Dismissing it holds until the member is in a different city.
export function VisitBanner() {
  const { data: profile } = useProfile();
  const { data: contacts } = useContacts();
  const { data: locations } = useLinkedLocations();
  const { pathname } = useLocation();
  const [seen, setSeen] = useState(() => localStorage.getItem(KEY));

  const place = profile ? visitingPlace(profile) : null;
  const people = useMemo(
    () => (place && contacts ? peopleAt(contacts, place, locations ?? new Map()) : null),
    [place, contacts, locations],
  );

  if (!place || !people || pathname === '/visits') return null;
  const id = `${place.city}|${place.country}`;
  const total = people.inCity.length + people.inCountry.length;
  if (seen === id || total === 0) return null;

  const country = COUNTRY_BY_CODE.get(place.country ?? '')?.name ?? place.country;
  function dismiss() {
    localStorage.setItem(KEY, id);
    setSeen(id);
  }

  return (
    <div className="visit-banner" role="status">
      <span>
        You are in <strong>{place.city}</strong>. You know{' '}
        {people.inCity.length > 0 && <>{people.inCity.length} here</>}
        {people.inCity.length > 0 && people.inCountry.length > 0 && ' and '}
        {people.inCountry.length > 0 && (
          <>
            {people.inCountry.length} {people.inCity.length > 0 ? 'more ' : ''}in {country}
          </>
        )}
        .
      </span>
      <Link to="/visits" onClick={dismiss}>See who</Link>
      <button className="x" onClick={dismiss} aria-label="Dismiss">x</button>
    </div>
  );
}
