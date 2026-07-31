import { useMemo, useState } from 'react';
import { Map, useControl } from 'react-map-gl/maplibre';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import type { ContactCategory } from '../../lib/database.types';
import type { MapPoint } from './useMapData';
import { CATEGORY_RGB } from './mapIcons';
import { useBasemap, useMarkerOutline } from '../../lib/basemap';
import { useTheme } from '../../lib/theme';
import 'maplibre-gl/dist/maplibre-gl.css';

function dominantCategory(p: MapPoint): ContactCategory {
  const counts: Record<string, number> = {};
  for (const c of p.contacts) counts[c.category] = (counts[c.category] ?? 0) + 1;
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] as ContactCategory) ?? 'other';
}

// Flat discs instead of the old 30px teardrop pins: a pin's tail and solid fill
// cover a lot of basemap, and at city scale several of them overlap into a blob.
// Radius grows with the stack so density still reads at a glance.
function radiusFor(p: MapPoint) {
  return p.count === 1 ? 6 : 8 + Math.sqrt(p.count) * 3.2;
}

function DeckOverlay(props: ConstructorParameters<typeof MapboxOverlay>[0]) {
  const overlay = useControl(() => new MapboxOverlay(props));
  overlay.setProps(props);
  return null;
}

interface Props {
  points: MapPoint[];
  initialView: { longitude: number; latitude: number; zoom: number };
  selected: MapPoint | null;
  onSelect: (p: MapPoint | null) => void;
}

export function NetworkMap({ points, initialView, selected, onSelect }: Props) {
  const [hovered, setHovered] = useState<MapPoint | null>(null);
  const basemap = useBasemap();
  const outline = useMarkerOutline();
  const theme = useTheme((s) => s.theme);

  const stacks = useMemo(() => points.filter((p) => p.count > 1), [points]);
  const selectedRing = useMemo(() => (selected ? [selected] : []), [selected]);

  const layers = useMemo(
    () => [
      new ScatterplotLayer<MapPoint>({
        id: 'contacts',
        data: points,
        pickable: true,
        stroked: true,
        filled: true,
        radiusUnits: 'pixels',
        lineWidthUnits: 'pixels',
        getPosition: (d) => [d.lng, d.lat],
        getRadius: radiusFor,
        // Translucent so overlapping points and the basemap both stay readable.
        getFillColor: (d) => [...CATEGORY_RGB[dominantCategory(d)], 170],
        getLineColor: outline,
        getLineWidth: 1.5,
        radiusMinPixels: 4,
        radiusMaxPixels: 28,
        autoHighlight: true,
        highlightColor: [255, 255, 255, 90],
        onClick: (info) => onSelect((info.object as MapPoint) ?? null),
        onHover: (info) => setHovered((info.object as MapPoint) ?? null),
        updateTriggers: { getLineColor: theme },
      }),
      // Ring marking the open point, so the card and the map agree.
      new ScatterplotLayer<MapPoint>({
        id: 'selection',
        data: selectedRing,
        pickable: false,
        stroked: true,
        filled: false,
        radiusUnits: 'pixels',
        lineWidthUnits: 'pixels',
        getPosition: (d) => [d.lng, d.lat],
        getRadius: (d) => radiusFor(d) + 5,
        getLineColor: [99, 102, 241, 255],
        getLineWidth: 2,
      }),
      new TextLayer<MapPoint>({
        id: 'counts',
        data: stacks,
        getPosition: (d) => [d.lng, d.lat],
        getText: (d) => String(d.count),
        getSize: 11,
        getColor: [255, 255, 255, 255],
        outlineColor: [0, 0, 0, 180],
        outlineWidth: 2,
        fontSettings: { sdf: true },
        getTextAnchor: 'middle',
        getAlignmentBaseline: 'center',
      }),
    ],
    [points, stacks, selectedRing, onSelect, outline, theme],
  );

  return (
    <Map initialViewState={initialView} mapStyle={basemap} style={{ position: 'absolute', inset: 0 }}>
      <DeckOverlay
        layers={layers}
        getCursor={({ isHovering }) => (isHovering ? 'pointer' : 'grab')}
      />
      {hovered && (
        <div className="map-hover">
          {hovered.count === 1 ? (
            <>
              <span className={`dot ${hovered.contacts[0].category}`} />
              {hovered.contacts[0].full_name}
            </>
          ) : (
            `${hovered.count} contacts`
          )}
          {hovered.contacts[0].current_city && (
            <span className="mh-city">{hovered.contacts[0].current_city}</span>
          )}
        </div>
      )}
    </Map>
  );
}
