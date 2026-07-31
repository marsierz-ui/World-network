import { useMemo } from 'react';
import { Map, useControl } from 'react-map-gl/maplibre';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { ScatterplotLayer, ArcLayer, TextLayer } from '@deck.gl/layers';
import type { Contact } from '../../lib/database.types';
import { CATEGORY_RGB } from '../map/mapIcons';
import { useBasemap } from '../../lib/basemap';
import type { Frame } from './mobilityData';
import 'maplibre-gl/dist/maplibre-gl.css';


function DeckOverlay(props: ConstructorParameters<typeof MapboxOverlay>[0]) {
  const overlay = useControl(() => new MapboxOverlay(props));
  overlay.setProps(props);
  return null;
}

interface Props {
  frame: Frame;
  showLabels: boolean;
  initialView: { longitude: number; latitude: number; zoom: number };
  onSelect: (c: Contact | null) => void;
}

export function MobilityMap({ frame, showLabels, initialView, onSelect }: Props) {
  const BASEMAP = useBasemap();
  const layers = useMemo(
    () => [
      new ArcLayer<Frame['arcs'][number]>({
        id: 'moves',
        data: frame.arcs,
        getSourcePosition: (d) => d.from,
        getTargetPosition: (d) => d.to,
        getSourceColor: (d) => [...CATEGORY_RGB[d.category], 120] as [number, number, number, number],
        getTargetColor: (d) => [...CATEGORY_RGB[d.category], 220] as [number, number, number, number],
        getWidth: 2,
        getHeight: 0.4,
      }),
      new ScatterplotLayer<Frame['points'][number]>({
        id: 'positions',
        data: frame.points,
        pickable: true,
        stroked: true,
        lineWidthMinPixels: 1,
        radiusUnits: 'pixels',
        getRadius: 6,
        getPosition: (d) => [d.lng, d.lat],
        getFillColor: (d) => [...CATEGORY_RGB[d.contact.category], 230] as [number, number, number, number],
        getLineColor: [255, 255, 255, 200],
        onClick: (info) => onSelect((info.object as Frame['points'][number])?.contact ?? null),
      }),
      ...(showLabels
        ? [
            new TextLayer<Frame['points'][number]>({
              id: 'labels',
              data: frame.points,
              getPosition: (d) => [d.lng, d.lat],
              getText: (d) => d.contact.full_name,
              getSize: 11,
              getColor: [220, 224, 230, 255],
              getPixelOffset: [0, -14],
              getTextAnchor: 'middle',
            }),
          ]
        : []),
    ],
    [frame, showLabels, onSelect],
  );

  return (
    <Map initialViewState={initialView} mapStyle={BASEMAP} style={{ position: 'absolute', inset: 0 }}>
      <DeckOverlay layers={layers} />
    </Map>
  );
}
