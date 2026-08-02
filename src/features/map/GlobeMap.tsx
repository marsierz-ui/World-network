import { useEffect, useMemo, useRef } from 'react';
import { Map, Source, Layer, type MapLayerMouseEvent, type MapRef } from 'react-map-gl/maplibre';
import type { MapPoint } from './useMapData';
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
  const mapRef = useRef<MapRef | null>(null);

  useEffect(() => {
    if (focus) mapRef.current?.getMap().flyTo({ center: [focus.lng, focus.lat], zoom: focus.zoom });
  }, [focus]);

  const geojson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: points.map((p, i) => ({
        type: 'Feature' as const,
        id: i,
        geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
        properties: {
          idx: i,
          count: p.count,
          label: p.count > 1 ? String(p.count) : '',
          color: `rgb(${p.color.join(',')})`,
          radius: p.count === 1 ? 6 : 8 + Math.sqrt(p.count) * 3.2,
        },
      })),
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
      onLoad={(e) => e.target.setProjection({ type: 'globe' })}
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
            'circle-opacity': 0.7,
            'circle-radius': ['get', 'radius'],
            'circle-stroke-width': 1.5,
            'circle-stroke-color': outline,
            'circle-stroke-opacity': 0.9,
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
