import { useEffect, useMemo, useRef, useState } from 'react';
import { Map, Marker, type MapRef } from 'react-map-gl/maplibre';
import type { MapPoint } from './useMapData';
import { CITY_ZOOM, groupingForZoom, useMapStore } from './mapStore';
import { useBasemap } from '../../lib/basemap';
import { COUNTRY_BY_CODE } from '../../lib/countries';
import { BallStack } from '../countryball/BallStack';
import { ballCountry, contactLocalFlag, type Ball } from '../countryball/faces';
import type { BallLook } from '../countryball/look';
import type { Map as MaplibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// Countryballs instead of dots. One person is one ball; several people at one
// place stack into a group of up to three balls with a count badge. Zoomed far
// in (a single city fills the screen) the group opens into a ring so everyone
// is visible again.
export const SPREAD_ZOOM = 9;

// City when the dots are per city, country name when they are per country.
function placeLabel(p: MapPoint) {
  return p.city ?? COUNTRY_BY_CODE.get(p.country ?? '')?.name ?? null;
}

export interface MeOnMap {
  lng: number;
  lat: number;
  country: string | null;
  look: BallLook | null;
}

/** The member's home: country, and where in it if known. */
export interface HomeArea {
  country: string;
  lng: number | null;
  lat: number | null;
}

// Clouds start this long apart, west to east, so they fill in like a wave.
const CLOUD_STEP = 70;
const CLOUD_MAX = 1400;

interface Props {
  points: MapPoint[];
  initialView: { longitude: number; latitude: number; zoom: number };
  focus: { lng: number; lat: number; zoom: number } | null;
  selected: MapPoint | null;
  onSelect: (p: MapPoint | null) => void;
  /** Looks of linked members by contact id; everyone else is a plain ball. */
  looks?: globalThis.Map<string, BallLook>;
  /** The signed-in member's own ball, where they are. */
  me?: MeOnMap | null;
  /** The member's home. Not used for the clouds any more (they show everywhere at city zoom); kept for callers. */
  home?: HomeArea | null;
}

export function NetworkMap({ points, initialView, focus, selected, onSelect, looks, me }: Props) {
  const [hovered, setHovered] = useState<MapPoint | null>(null);
  const [spread, setSpread] = useState(initialView.zoom >= SPREAD_ZOOM);
  // City zoom: balls keep their national flag and grow a cloud with the regional or city flag.
  const [detail, setDetail] = useState(initialView.zoom >= CITY_ZOOM);
  const basemap = useBasemap();
  const setGrouping = useMapStore((s) => s.setGrouping);
  const mapRef = useRef<MapRef | null>(null);

  useEffect(() => {
    if (focus) mapRef.current?.getMap().flyTo({ center: [focus.lng, focus.lat], zoom: focus.zoom });
  }, [focus]);

  const balls = useMemo(() => {
    // Rank places west to east for the cloud wave.
    const rank = new globalThis.Map(
      points.map((p, i) => [i, p.lng] as const).sort((a, b) => a[1] - b[1]).map(([i], r) => [i, r] as const),
    );
    return points.map((p, i): Ball[] =>
      p.contacts.map((c) => {
        const look = looks?.get(c.id) ?? null;
        // A member's own choice (none / region / city) wins over where the address puts them.
        const own = look?.local ? (look.local === 'none' ? null : look.localFlag ?? null) : undefined;
        const local = detail ? (own !== undefined ? own : contactLocalFlag(c)) : null;
        const cloudDelay = Math.min((rank.get(i) ?? 0) * CLOUD_STEP, CLOUD_MAX);
        return { key: c.id, country: ballCountry(c, p.country), look, name: c.full_name, local, cloudDelay };
      }),
    );
  }, [points, looks, detail]);

  function onView(map: MaplibreMap) {
    // Only thresholds are stored, so panning inside one band re-renders nothing.
    const zoom = map.getZoom();
    setGrouping(groupingForZoom(zoom));
    setSpread(zoom >= SPREAD_ZOOM);
    setDetail(zoom >= CITY_ZOOM);
  }

  return (
    <Map
      ref={mapRef}
      initialViewState={initialView}
      mapStyle={basemap}
      onLoad={(e) => onView(e.target)}
      onMove={(e) => onView(e.target)}
      style={{ position: 'absolute', inset: 0 }}
    >
      {points.map((p, i) => {
        const isSel = !!selected && selected.contacts[0]?.id === p.contacts[0]?.id;
        return (
          <Marker
            key={`${p.contacts[0]?.id ?? i}-${p.count}`}
            longitude={p.lng}
            latitude={p.lat}
            anchor="center"
            style={{ zIndex: isSel ? 3 : p.count > 1 ? 2 : 1 }}
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              onSelect(p);
            }}
          >
            <div
              role="button"
              tabIndex={0}
              aria-label={`${p.count === 1 ? p.contacts[0].full_name : `${p.count} contacts`}${placeLabel(p) ? `, ${placeLabel(p)}` : ''}`}
              onMouseEnter={() => setHovered(p)}
              onMouseLeave={() => setHovered((h) => (h === p ? null : h))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(p);
                }
              }}
            >
              <BallStack balls={balls[i]} count={p.count} spread={spread} selected={isSel} />
            </div>
          </Marker>
        );
      })}
      {me && (
        <Marker longitude={me.lng} latitude={me.lat} anchor="center" style={{ zIndex: 4 }}>
          <BallStack
            balls={[{ key: 'me', country: me.country, look: me.look, local: detail && me.look?.local && me.look.local !== 'none' ? me.look.localFlag ?? null : null }]}
            count={1}
            spread={false}
            label="You"
          />
        </Marker>
      )}
      {hovered && (
        <div className="map-hover lg lg-thick">
          {hovered.count === 1 ? (
            <>
              <span className={`dot ${hovered.contacts[0].category}`} />
              {hovered.contacts[0].full_name}
            </>
          ) : (
            `${hovered.count} contacts`
          )}
          {placeLabel(hovered) && <span className="mh-city">{placeLabel(hovered)}</span>}
        </div>
      )}
    </Map>
  );
}
