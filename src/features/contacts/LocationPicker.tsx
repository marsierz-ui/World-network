import { useState } from 'react';
import { Map, Marker, type MapLayerMouseEvent, type ViewState } from 'react-map-gl/maplibre';
import { geocode, geocodeCandidates } from '../../lib/geocode';
import { COUNTRY_BY_CODE } from '../../lib/countries';
import { useBasemap } from '../../lib/basemap';
import type { City } from '../../lib/cities';
import 'maplibre-gl/dist/maplibre-gl.css';


interface Props {
  initial?: { lng: number; lat: number } | null;
  city?: string | null;
  country?: string | null;
  onConfirm: (coords: { lng: number; lat: number }) => void;
  onCancel: () => void;
}

export function LocationPicker({ initial, city, country, onConfirm, onCancel }: Props) {
  const BASEMAP = useBasemap();
  const start =
    initial ?? geocode(city, country) ?? { lng: 10, lat: 25 };
  const [pin, setPin] = useState<{ lng: number; lat: number }>({ lng: start.lng, lat: start.lat });
  const [view, setView] = useState<Partial<ViewState>>({
    longitude: start.lng,
    latitude: start.lat,
    zoom: initial || (city && geocode(city, country)?.precision === 'city') ? 9 : 3,
  });
  const [search, setSearch] = useState('');
  const [matches, setMatches] = useState<City[] | null>(null);

  function goTo(lng: number, lat: number, zoom = 9) {
    setPin({ lng, lat });
    setView({ longitude: lng, latitude: lat, zoom });
  }

  function runSearch(e: React.FormEvent) {
    e.preventDefault();
    // Search the whole world, not just the contact's country: the point of the
    // picker is fixing a location that the country field may itself have wrong.
    const found = geocodeCandidates(search);
    setMatches(found);
    if (found.length) {
      goTo(found[0].lng, found[0].lat);
    } else {
      const g = geocode(search, country);
      if (g) goTo(g.lng, g.lat, g.precision === 'city' ? 9 : 4);
    }
  }

  function pickMatch(c: City) {
    goTo(c.lng, c.lat);
    setMatches(null);
  }

  return (
    <div className="picker-backdrop" onClick={onCancel}>
      <div className="picker" onClick={(e) => e.stopPropagation()}>
        <div className="picker-head">
          <strong>Set exact location</strong>
          <span className="muted">click the map or search</span>
        </div>
        <form className="picker-search" onSubmit={runSearch}>
          <input
            placeholder="Search a city"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoCapitalize="words"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit">Find</button>
        </form>

        {matches && matches.length > 1 && (
          <div className="picker-matches">
            <div className="muted">
              {matches.length} places named "{search.trim()}" - pick the right one:
            </div>
            <div className="pm-list">
              {matches.slice(0, 12).map((c) => (
                <button
                  key={`${c.country}-${c.admin1 ?? ''}-${c.lat}-${c.lng}`}
                  type="button"
                  className="pm-opt"
                  onClick={() => pickMatch(c)}
                >
                  <span>{c.name}</span>
                  <span className="muted">
                    {[COUNTRY_BY_CODE.get(c.country)?.name ?? c.country, c.admin1]
                      .filter(Boolean)
                      .join(' · ')}
                    {c.population ? ` · ${c.population.toLocaleString()}` : ''}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        {matches && matches.length === 0 && (
          <div className="picker-matches muted">
            No city named "{search.trim()}" in the dataset. Click the map to place it manually.
          </div>
        )}
        <div className="picker-map">
          <Map
            {...view}
            onMove={(e) => setView(e.viewState)}
            mapStyle={BASEMAP}
            onClick={(e: MapLayerMouseEvent) =>
              setPin({ lng: e.lngLat.lng, lat: e.lngLat.lat })
            }
            style={{ position: 'absolute', inset: 0 }}
          >
            <Marker longitude={pin.lng} latitude={pin.lat} color="#6366f1" />
          </Map>
        </div>
        <div className="picker-foot">
          <span className="muted">
            {pin.lat.toFixed(3)}, {pin.lng.toFixed(3)}
          </span>
          <div className="actions">
            <button className="link" onClick={onCancel}>Cancel</button>
            <button onClick={() => onConfirm(pin)}>Use this location</button>
          </div>
        </div>
      </div>
    </div>
  );
}
