import { useMemo, useRef } from 'react';
import {
  Map,
  Source,
  Layer,
  type MapLayerMouseEvent,
  type MapRef,
} from 'react-map-gl/maplibre';
import type { Contact } from '../../lib/database.types';
import type { MapPoint } from './useMapData';
import { CATEGORY_HEX } from './mapIcons';
import { useBasemap } from '../../lib/basemap';
import { useTheme } from '../../lib/theme';
import 'maplibre-gl/dist/maplibre-gl.css';


interface Props {
  contacts: Contact[]; // filtered, with coords
  initialView: { longitude: number; latitude: number; zoom: number };
  onSelect: (p: MapPoint | null) => void;
}

// Globe projection + MapLibre-native clustering (projects correctly on the sphere,
// unlike a screen-space deck overlay).
export function GlobeMap({ contacts, initialView, onSelect }: Props) {
  const BASEMAP = useBasemap();
  const outline = useTheme((s) => (s.theme === 'light' ? '#ffffff' : '#0a0c10'));
  const mapRef = useRef<MapRef | null>(null);

  const geojson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: contacts
        .filter((c) => c.current_lng != null && c.current_lat != null)
        .map((c) => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [c.current_lng!, c.current_lat!] },
          properties: { id: c.id, name: c.full_name, category: c.category },
        })),
    }),
    [contacts],
  );

  function handleClick(e: MapLayerMouseEvent) {
    const f = e.features?.[0];
    if (!f) { onSelect(null); return; }
    if (f.properties?.cluster) {
      const map = mapRef.current?.getMap();
      const src = map?.getSource('contacts') as
        | { getClusterExpansionZoom: (id: number) => Promise<number> }
        | undefined;
      const [lng, lat] = (f.geometry as unknown as { coordinates: [number, number] }).coordinates;
      src?.getClusterExpansionZoom(f.properties.cluster_id as number).then((zoom) => {
        map?.easeTo({ center: [lng, lat], zoom });
      });
      return;
    }
    const id = f.properties?.id as string;
    const c = contacts.find((x) => x.id === id);
    if (c) {
      onSelect({
        lng: c.current_lng!,
        lat: c.current_lat!,
        contacts: [c],
        count: 1,
        country: c.current_country ?? null,
      });
    }
  }

  return (
    <Map
      ref={mapRef}
      initialViewState={initialView}
      mapStyle={BASEMAP}
      onLoad={(e) => e.target.setProjection({ type: 'globe' })}
      interactiveLayerIds={['clusters', 'unclustered']}
      onClick={handleClick}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Source
        id="contacts"
        type="geojson"
        data={geojson}
        cluster
        clusterRadius={45}
        clusterMaxZoom={6}
      >
        <Layer
          id="clusters"
          type="circle"
          filter={['has', 'point_count']}
          paint={{
            'circle-color': '#6366f1',
            'circle-opacity': 0.85,
            'circle-radius': ['step', ['get', 'point_count'], 14, 10, 18, 50, 24, 200, 32],
            'circle-stroke-width': 1,
            'circle-stroke-color': 'rgba(255,255,255,0.5)',
          }}
        />
        <Layer
          id="cluster-count"
          type="symbol"
          filter={['has', 'point_count']}
          layout={{ 'text-field': '{point_count_abbreviated}', 'text-size': 12 }}
          paint={{ 'text-color': '#ffffff' }}
        />
        {/* Dots, matching the flat map. Pins covered the basemap below each
            point and stacked into an unreadable mass in dense cities. */}
        <Layer
          id="unclustered"
          type="circle"
          filter={['!', ['has', 'point_count']]}
          paint={{
            'circle-color': [
              'match', ['get', 'category'],
              'work', CATEGORY_HEX.work,
              'private', CATEGORY_HEX.private,
              CATEGORY_HEX.other,
            ],
            'circle-opacity': 0.7,
            'circle-radius': 6,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': outline,
            'circle-stroke-opacity': 0.9,
          }}
        />
      </Source>
    </Map>
  );
}
