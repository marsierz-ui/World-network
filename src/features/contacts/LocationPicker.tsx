import { useState } from 'react';
import { Map, Marker, type MapLayerMouseEvent, type ViewState } from 'react-map-gl/maplibre';
import { geocode } from '../../lib/geocode';
import { useBasemap } from '../../lib/basemap';
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

  function runSearch(e: React.FormEvent) {
    e.preventDefault();
    const g = geocode(search, country);
    if (g) {
      setPin({ lng: g.lng, lat: g.lat });
      setView({ longitude: g.lng, latitude: g.lat, zoom: g.precision === 'city' ? 9 : 4 });
    }
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
          />
          <button type="submit">Find</button>
        </form>
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
