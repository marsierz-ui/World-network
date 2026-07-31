import { useMemo, useState } from 'react';
import { Map, useControl } from 'react-map-gl/maplibre';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { ScatterplotLayer, TextLayer, IconLayer } from '@deck.gl/layers';
import type { ContactCategory } from '../../lib/database.types';
import type { MapPoint } from './useMapData';
import { CATEGORY_RGB, PIN_URL } from './mapIcons';
import 'maplibre-gl/dist/maplibre-gl.css';

const BASEMAP = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

function dominantCategory(p: MapPoint): ContactCategory {
  const counts: Record<string, number> = {};
  for (const c of p.contacts) counts[c.category] = (counts[c.category] ?? 0) + 1;
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] as ContactCategory) ?? 'other';
}

function DeckOverlay(props: ConstructorParameters<typeof MapboxOverlay>[0]) {
  const overlay = useControl(() => new MapboxOverlay(props));
  overlay.setProps(props);
  return null;
}

interface Props {
  points: MapPoint[];
  initialView: { longitude: number; latitude: number; zoom: number };
  onSelect: (p: MapPoint | null) => void;
}

export function NetworkMap({ points, initialView, onSelect }: Props) {
  const [hovered, setHovered] = useState<MapPoint | null>(null);

  const singles = useMemo(() => points.filter((p) => p.count === 1), [points]);
  const stacks = useMemo(() => points.filter((p) => p.count > 1), [points]);

  const layers = useMemo(
    () => [
      // Individual contacts: pin markers.
      new IconLayer<MapPoint>({
        id: 'pins',
        data: singles,
        pickable: true,
        getPosition: (d) => [d.lng, d.lat],
        getIcon: () => ({ url: PIN_URL, width: 24, height: 24, anchorX: 12, anchorY: 24, mask: true }),
        sizeUnits: 'pixels',
        getSize: 30,
        getColor: (d) => CATEGORY_RGB[dominantCategory(d)],
        onClick: (info) => onSelect((info.object as MapPoint) ?? null),
        onHover: (info) => setHovered((info.object as MapPoint) ?? null),
      }),
      // Stacked contacts at one location: a circle with the count.
      new ScatterplotLayer<MapPoint>({
        id: 'stacks',
        data: stacks,
        pickable: true,
        stroked: true,
        lineWidthMinPixels: 1,
        getPosition: (d) => [d.lng, d.lat],
        getRadius: (d) => 8 + Math.sqrt(d.count) * 4,
        radiusUnits: 'pixels',
        getFillColor: (d) => [...CATEGORY_RGB[dominantCategory(d)], 220] as [number, number, number, number],
        getLineColor: [255, 255, 255, 200],
        onClick: (info) => onSelect((info.object as MapPoint) ?? null),
        onHover: (info) => setHovered((info.object as MapPoint) ?? null),
      }),
      new TextLayer<MapPoint>({
        id: 'counts',
        data: stacks,
        getPosition: (d) => [d.lng, d.lat],
        getText: (d) => String(d.count),
        getSize: 12,
        getColor: [255, 255, 255, 255],
        getTextAnchor: 'middle',
        getAlignmentBaseline: 'center',
      }),
    ],
    [singles, stacks, onSelect],
  );

  return (
    <Map
      initialViewState={initialView}
      mapStyle={BASEMAP}
      style={{ position: 'absolute', inset: 0 }}
    >
      <DeckOverlay layers={layers} />
      {hovered && (
        <div className="map-hover">
          {hovered.count === 1
            ? hovered.contacts[0].full_name
            : `${hovered.count} contacts`}
        </div>
      )}
    </Map>
  );
}
