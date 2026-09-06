import { useEffect, useMemo, useRef, useState } from 'react';
import { Map, Source, Layer, type MapLayerMouseEvent, type MapRef } from 'react-map-gl/maplibre';
import type { ExpressionSpecification } from 'maplibre-gl';
import type { MapPoint } from './useMapData';
import { useCountryShapes } from './countryShapes';
import { useBasemap } from '../../lib/basemap';
import { COUNTRY_BY_CODE } from '../../lib/countries';
import { useTheme } from '../../lib/theme';
import 'maplibre-gl/dist/maplibre-gl.css';

interface Props {
  /** One entry per country holding contacts, keyed by ISO alpha-2. */
  byCountry: Map<string, MapPoint>;
  initialView: { longitude: number; latitude: number; zoom: number };
  focus: { lng: number; lat: number; zoom: number } | null;
  selected: MapPoint | null;
  onSelect: (p: MapPoint | null) => void;
}

// Ascending with the contact count. Dark theme runs dim -> bright and light
// theme pale -> deep, so in both cases "more contacts" is the louder colour
// against that basemap. `flip` is the first band whose fill is dark enough
// (light theme) or bright enough (dark theme) to need the other text colour.
const PALETTE = {
  dark: { fills: ['#3730a3', '#4338ca', '#4f46e5', '#6366f1', '#a5b4fc'], flip: 4 },
  light: { fills: ['#e0e7ff', '#c7d2fe', '#a5b4fc', '#818cf8', '#4f46e5'], flip: 3 },
};

/**
 * Lower bound of each colour band.
 *
 * Quantiles over the distinct counts rather than an even split of 1..max: a
 * network is one big home country and a long tail of ones and twos, and even
 * bands would paint the whole tail a single colour. Few distinct values get a
 * band each, which is the honest reading when there are only three of them.
 */
function breaksFor(counts: number[]): number[] {
  const distinct = [...new Set(counts)].sort((a, b) => a - b);
  if (distinct.length <= 5) return distinct;
  const at = (q: number) => distinct[Math.floor(q * (distinct.length - 1))];
  return [...new Set([distinct[0], at(0.3), at(0.6), at(0.85), distinct[distinct.length - 1]])];
}

/** ['step', input, first, b1, second, ...] built from bounds + values. */
function stepExpression(bounds: number[], values: string[]): ExpressionSpecification {
  const stops = bounds.slice(1).flatMap((b, i) => [b, values[i + 1]]);
  return ['step', ['get', 'count'], values[0], ...stops] as ExpressionSpecification;
}

export function ChoroplethMap({ byCountry, initialView, focus, selected, onSelect }: Props) {
  const basemap = useBasemap();
  const theme = useTheme((s) => s.theme);
  const { shapes, error } = useCountryShapes();
  const [hovered, setHovered] = useState<{ name: string; count: number } | null>(null);
  const mapRef = useRef<MapRef | null>(null);

  useEffect(() => {
    if (focus) mapRef.current?.getMap().flyTo({ center: [focus.lng, focus.lat], zoom: focus.zoom });
  }, [focus]);

  const palette = PALETTE[theme === 'light' ? 'light' : 'dark'];
  const breaks = useMemo(
    () => breaksFor([...byCountry.values()].map((p) => p.count)),
    [byCountry],
  );
  // No contacts at all: the layers still need a valid colour expression, even
  // though nothing will be drawn through it. The legend below reads `breaks`, so
  // it stays empty rather than inventing a band.
  const bands = useMemo(() => (breaks.length ? breaks : [1]), [breaks]);
  // Fewer distinct counts than colours: use the loud end of the ramp, so two
  // bands are indigo and pale-indigo rather than two shades nobody can tell apart.
  const fills = useMemo(
    () => palette.fills.slice(palette.fills.length - bands.length),
    [palette, bands],
  );
  const flip = Math.max(0, bands.length - (palette.fills.length - palette.flip));
  const textColors = useMemo(
    () =>
      bands.map((_, i) =>
        theme === 'light'
          ? i >= flip
            ? '#ffffff'
            : '#1b2430'
          : i >= flip
            ? '#0f1115'
            : '#ffffff',
      ),
    [bands, flip, theme],
  );

  // Only countries that hold contacts are drawn. The rest of the world keeps
  // the basemap, which reads better than a grey wash over every label on it.
  const filled = useMemo(() => {
    if (!shapes) return { type: 'FeatureCollection' as const, features: [] };
    return {
      type: 'FeatureCollection' as const,
      features: shapes.features
        .filter((f) => f.properties.code && byCountry.has(f.properties.code))
        .map((f) => ({
          ...f,
          properties: {
            code: f.properties.code,
            name: f.properties.name,
            count: byCountry.get(f.properties.code!)!.count,
          },
        })),
    };
  }, [shapes, byCountry]);

  // Centroids, for the count labels and for the countries the 1:110m outlines
  // leave out entirely (Singapore, Hong Kong, Malta, Bahrain, Andorra). Those
  // would silently vanish from a map of where people are, so they get a marker.
  const centres = useMemo(() => {
    const withShape = new Set(filled.features.map((f) => f.properties.code));
    return {
      type: 'FeatureCollection' as const,
      features: [...byCountry.entries()].flatMap(([code, point]) => {
        const centre = COUNTRY_BY_CODE.get(code);
        if (!centre) return [];
        return [
          {
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [centre.lng, centre.lat] },
            properties: {
              code,
              name: centre.name,
              count: point.count,
              shaped: withShape.has(code),
            },
          },
        ];
      }),
    };
  }, [byCountry, filled]);

  function pick(e: MapLayerMouseEvent): MapPoint | null {
    const code = e.features?.[0]?.properties?.code as string | undefined;
    return code ? byCountry.get(code) ?? null : null;
  }

  if (error) {
    return (
      <div className="map-empty">
        Country outlines could not be loaded ({error}). Run
        <code> node scripts/build-countries.mjs</code>.
      </div>
    );
  }

  return (
    <Map
      ref={mapRef}
      initialViewState={initialView}
      mapStyle={basemap}
      interactiveLayerIds={['country-fill', 'country-dot']}
      onClick={(e) => onSelect(pick(e))}
      onMouseMove={(e) => {
        const f = e.features?.[0];
        if (!f) {
          setHovered(null);
          return;
        }
        // Our own country names, so the readout matches the filters and the
        // contact card rather than switching to Natural Earth's ("United States
        // of America" vs "United States").
        const code = f.properties?.code as string | undefined;
        setHovered({
          name: (code && COUNTRY_BY_CODE.get(code)?.name) || (f.properties?.name as string),
          count: f.properties?.count as number,
        });
      }}
      onMouseLeave={() => setHovered(null)}
      onMouseEnter={(e) => (e.target.getCanvas().style.cursor = 'pointer')}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Source id="countries" type="geojson" data={filled}>
        <Layer
          id="country-fill"
          type="fill"
          paint={{
            'fill-color': stepExpression(bands, fills),
            'fill-opacity': 0.72,
          }}
        />
        <Layer
          id="country-line"
          type="line"
          paint={{ 'line-color': stepExpression(bands, fills), 'line-width': 1 }}
        />
        <Layer
          id="country-selected"
          type="line"
          filter={['==', ['get', 'code'], selected?.country ?? '']}
          paint={{ 'line-color': '#6366f1', 'line-width': 2.5 }}
        />
      </Source>

      <Source id="country-centres" type="geojson" data={centres}>
        <Layer
          id="country-dot"
          type="circle"
          filter={['==', ['get', 'shaped'], false]}
          paint={{
            'circle-color': stepExpression(bands, fills),
            'circle-opacity': 0.85,
            'circle-radius': 9,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': theme === 'light' ? '#ffffff' : '#0a0c10',
          }}
        />
        <Layer
          id="country-count"
          type="symbol"
          layout={{
            'text-field': ['to-string', ['get', 'count']],
            'text-size': 11,
            'text-allow-overlap': false,
          }}
          paint={{
            'text-color': stepExpression(bands, textColors),
            'text-halo-color': theme === 'light' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)',
            'text-halo-width': 1,
          }}
        />
      </Source>

      {hovered && (
        <div className="map-hover">
          {hovered.name}
          <span className="mh-city">
            {hovered.count} {hovered.count === 1 ? 'contact' : 'contacts'}
          </span>
        </div>
      )}

      {breaks.length > 0 && (
        <div className="map-scale">
          <div className="section-label">Contacts</div>
          <div className="scale-row">
            {breaks.map((b, i) => (
              <div key={b} className="scale-step">
                <span className="scale-swatch" style={{ background: fills[i] }} />
                <span>
                  {i === breaks.length - 1 || breaks[i + 1] === b + 1
                    ? b
                    : `${b}-${breaks[i + 1] - 1}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Map>
  );
}
