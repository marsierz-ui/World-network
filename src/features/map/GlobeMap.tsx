import { useMemo, useRef } from 'react';
import {
  Map,
  Source,
  Layer,
  type MapLayerMouseEvent,
  type MapRef,
} from 'react-map-gl/maplibre';
import type { Contact, ContactCategory } from '../../lib/database.types';
import type { MapPoint } from './useMapData';
import { CATEGORY_HEX, makePinImage } from './mapIcons';
import 'maplibre-gl/dist/maplibre-gl.css';

const BASEMAP = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

interface Props {
  contacts: Contact[]; // filtered, with coords
  initialView: { longitude: number; latitude: number; zoom: number };
  onSelect: (p: MapPoint | null) => void;
}

// Globe projection + MapLibre-native clustering (projects correctly on the sphere,
// unlike a screen-space deck overlay).
export function GlobeMap({ contacts, initialView, onSelect }: Props) {
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
      onSelect({ lng: c.current_lng!, lat: c.current_lat!, contacts: [c], count: 1 });
    }
  }

  return (
    <Map
      ref={mapRef}
      initialViewState={initialView}
      mapStyle={BASEMAP}
      onLoad={(e) => {
        const map = e.target;
        map.setProjection({ type: 'globe' });
        (['work', 'private', 'other'] as ContactCategory[]).forEach((cat) => {
          const id = `pin-${cat}`;
          if (map.hasImage(id)) return;
          const c = makePinImage(CATEGORY_HEX[cat], 48);
          const data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
          map.addImage(id, data, { pixelRatio: 2 });
        });
      }}
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
        <Layer
          id="unclustered"
          type="symbol"
          filter={['!', ['has', 'point_count']]}
          layout={{
            'icon-image': [
              'match', ['get', 'category'],
              'work', 'pin-work',
              'private', 'pin-private',
              'pin-other',
            ],
            'icon-size': 1,
            'icon-anchor': 'bottom',
            'icon-allow-overlap': true,
          }}
        />
      </Source>
    </Map>
  );
}
