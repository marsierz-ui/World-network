import { useEffect, useMemo, useRef, useState } from 'react';
import { searchCities } from '../../lib/geocode';
import { COUNTRY_BY_CODE } from '../../lib/countries';
import type { City } from '../../lib/cities';

interface Props {
  city: string;
  /** Called on free typing; only the city text is known. */
  onCityChange: (city: string) => void;
  /** Called when a suggestion is chosen: city, country and exact coordinates. */
  onPick: (c: City) => void;
}

// GeoNames admin1 is a readable abbreviation in some countries ("WA") and an
// opaque number in others ("02" for British Columbia). Show only the readable ones.
function readableAdmin1(admin1?: string) {
  return admin1 && /^[A-Za-z]/.test(admin1) ? admin1 : undefined;
}

// Type a city, pick from suggestions. Choosing one adopts its country and
// coordinates too, so ambiguous names (Vancouver CA vs US) are resolved once,
// here, instead of being guessed later by the geocoder.
export function CityAutocomplete({ city, onCityChange, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [touched, setTouched] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => (touched ? searchCities(city, 8) : []), [city, touched]);

  useEffect(() => {
    if (!open) return;
    function onDocDown(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [open]);

  function choose(c: City) {
    onPick(c);
    setOpen(false);
  }

  return (
    <div className="city-auto" ref={boxRef}>
      <input
        value={city}
        placeholder="Start typing a city..."
        onChange={(e) => {
          setTouched(true);
          setOpen(true);
          onCityChange(e.target.value);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && open && matches[0]) {
            e.preventDefault();
            choose(matches[0]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
      />
      {open && matches.length > 0 && (
        <div className="city-menu">
          {matches.map((c) => (
            <button
              key={`${c.name}-${c.country}-${c.lat}-${c.lng}`}
              type="button"
              className="city-opt"
              onMouseDown={() => choose(c)}
            >
              <span className="city-name">{c.name}</span>
              <span className="muted">
                {[COUNTRY_BY_CODE.get(c.country)?.name ?? c.country, readableAdmin1(c.admin1)]
                  .filter(Boolean)
                  .join(' · ')}
                {c.population ? ` · ${c.population.toLocaleString()}` : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
