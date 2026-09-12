import { useEffect, useMemo, useRef } from 'react';
import { Map, Source, Layer, type MapLayerMouseEvent, type MapRef } from 'react-map-gl/maplibre';
import type { MapPoint } from './useMapData';
import { flagBandRadius } from './mapIcons';
import { groupingForZoom, useMapStore } from './mapStore';
import { useBasemap } from '../../lib/basemap';
import { useTheme } from '../../lib/theme';
import 'maplibre-gl/dist/maplibre-gl.css';

interface Props {
  points: MapPoint[];
  initialView: { longitude: number; latitude: number; zoom: number };
  focus: { lng: number; lat: number; zoom: number } | null;
  selected: MapPoint | null;
  onSelect: (p: MapPoint | null) => void;
}

// Globe projection over the same aggregated points as the flat map. It used to
// do its own proximity clustering, which drew uniform indigo blobs and merged
// contacts across countries - the exact thing the flat map stopped doing.
export function GlobeMap({ points, initialView, focus, selected, onSelect }: Props) {
  const BASEMAP = useBasemap();
  const outline = useTheme((s) => (s.theme === 'light' ? '#ffffff' : '#0a0c10'));
  const setGrouping = useMapStore((s) => s.setGrouping);
  const mapRef = useRef<MapRef | null>(null);

  useEffect(() => {
    if (focus) mapRef.current?.getMap().flyTo({ center: [focus.lng, focus.lat], zoom: focus.zoom });
  }, [focus]);

  const geojson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: points.map((p, i) => {
        const radius = p.count === 1 ? 6 : 8 + Math.sqrt(p.count) * 3.2;
        const bands = p.flagColors;
        return {
          type: 'Feature' as const,
          id: i,
          geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
          properties: {
            idx: i,
            count: p.count,
            label: p.count > 1 ? String(p.count) : '',
            color: `rgb(${p.color.join(',')})`,
            // The 2nd and 3rd flag colours, painted as smaller solid discs on top
            // of the base circle so each one shows as a concentric ring instead
            // of a thin stroke - see flagBandRadius. Null when the dot has fewer
            // than that many bands (or isn't flag-coloured at all).
            band2Color: bands?.[1] ? `rgb(${bands[1].join(',')})` : null,
            band2Radius: bands?.[1] ? flagBandRadius(radius, 1, bands.length) : 0,
            band3Color: bands?.[2] ? `rgb(${bands[2].join(',')})` : null,
            band3Radius: bands?.[2] ? flagBandRadius(radius, 2, bands.length) : 0,
            // See NetworkMap: pastel flags are not recognisable flags.
            opacity: bands ? 0.9 : 0.7,
            radius,
          },
        };
      }),
    }),
    [points],
  );

  const selectedGeojson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: selected
        ? [
            {
              type: 'Feature' as const,
              geometry: { type: 'Point' as const, coordinates: [selected.lng, selected.lat] },
              properties: {
                radius: (selected.count === 1 ? 6 : 8 + Math.sqrt(selected.count) * 3.2) + 5,
              },
            },
          ]
        : [],
    }),
    [selected],
  );

  function handleClick(e: MapLayerMouseEvent) {
    const f = e.features?.[0];
    if (!f) { onSelect(null); return; }
    const idx = f.properties?.idx as number;
    onSelect(points[idx] ?? null);
  }

  return (
    <Map
      ref={mapRef}
      initialViewState={initialView}
      mapStyle={BASEMAP}
      onLoad={(e) => {
        e.target.setProjection({ type: 'globe' });
        setGrouping(groupingForZoom(e.target.getZoom()));
      }}
      onMove={(e) => setGrouping(groupingForZoom(e.viewState.zoom))}
      interactiveLayerIds={['points']}
      onClick={handleClick}
      onMouseEnter={(e) => (e.target.getCanvas().style.cursor = 'pointer')}
      onMouseLeave={(e) => (e.target.getCanvas().style.cursor = '')}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Source id="selection" type="geojson" data={selectedGeojson}>
        <Layer
          id="selection-ring"
          type="circle"
          paint={{
            'circle-color': 'rgba(0,0,0,0)',
            'circle-radius': ['get', 'radius'],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#6366f1',
          }}
        />
      </Source>

      <Source id="contacts" type="geojson" data={geojson}>
        <Layer
          id="points"
          type="circle"
          paint={{
            'circle-color': ['get', 'color'],
            'circle-opacity': ['get', 'opacity'],
            'circle-radius': ['get', 'radius'],
            // A plain contrast edge, the same for every dot: flag colouring no
            // longer lives in the stroke, so it never has to compete with it.
            'circle-stroke-width': 1.5,
            'circle-stroke-color': outline,
            'circle-stroke-opacity': 0.9,
          }}
        />
        {/* Smaller solid discs on top of the base circle, one per extra flag
            colour, so a two- or three-colour flag fills the whole dot as
            concentric bands instead of a fill-plus-ring approximation. */}
        <Layer
          id="points-band-2"
          type="circle"
          filter={['!=', ['get', 'band2Color'], null]}
          paint={{
            'circle-color': ['get', 'band2Color'],
            'circle-opacity': ['get', 'opacity'],
            'circle-radius': ['get', 'band2Radius'],
          }}
        />
        <Layer
          id="points-band-3"
          type="circle"
          filter={['!=', ['get', 'band3Color'], null]}
          paint={{
            'circle-color': ['get', 'band3Color'],
            'circle-opacity': ['get', 'opacity'],
            'circle-radius': ['get', 'band3Radius'],
          }}
        />
        <Layer
          id="point-count"
          type="symbol"
          filter={['>', ['get', 'count'], 1]}
          layout={{ 'text-field': ['get', 'label'], 'text-size': 11, 'text-allow-overlap': true }}
          paint={{
            'text-color': '#ffffff',
            'text-halo-color': 'rgba(0,0,0,0.7)',
            'text-halo-width': 1,
          }}
        />
      </Source>
    </Map>
  );
}
