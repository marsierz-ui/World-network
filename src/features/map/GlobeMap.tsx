import { useEffect, useMemo, useRef, useState } from 'react';
import { Map, Source, Layer, type MapLayerMouseEvent, type MapRef } from 'react-map-gl/maplibre';
import type { MapPoint } from './useMapData';
import { flagImageUrl } from './mapIcons';
import { groupingForZoom, useMapStore } from './mapStore';
import { useBasemap } from '../../lib/basemap';
import { useTheme } from '../../lib/theme';
import 'maplibre-gl/dist/maplibre-gl.css';

// Native pixel size baked into public/flags/<code>.svg - see build-flag-svgs.mjs.
const FLAG_IMAGE_SIZE = 128;

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
  const [mapReady, setMapReady] = useState(false);
  // Country codes whose flag image maplibre has actually registered. A plain
  // circle (MapPoint.color) covers a code until its entry here lands, so a
  // fresh view never shows a blank dot while the image is still loading.
  const [loadedFlags, setLoadedFlags] = useState<Set<string>>(new Set());
  const requestedFlags = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (focus) mapRef.current?.getMap().flyTo({ center: [focus.lng, focus.lat], zoom: focus.zoom });
  }, [focus]);

  // Register each flag actually in use as a maplibre image, once. addImage
  // needs a loaded style, hence the mapReady gate; adding mapReady as a
  // dependency (rather than only points) picks up whatever codes are already
  // present the moment the map finishes loading, not just later changes.
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    for (const p of points) {
      const code = p.flagCode;
      if (!code || map.hasImage(code) || requestedFlags.current.has(code)) continue;
      requestedFlags.current.add(code);
      const img = new Image();
      img.onload = () => {
        if (!map.hasImage(code)) map.addImage(code, img);
        setLoadedFlags((prev) => (prev.has(code) ? prev : new Set(prev).add(code)));
      };
      img.onerror = () => requestedFlags.current.delete(code);
      img.src = flagImageUrl(code);
    }
  }, [points, mapReady]);

  const geojson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: points.map((p, i) => {
        const radius = p.count === 1 ? 6 : 8 + Math.sqrt(p.count) * 3.2;
        const iconReady = !!p.flagCode && loadedFlags.has(p.flagCode);
        return {
          type: 'Feature' as const,
          id: i,
          geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
          properties: {
            idx: i,
            count: p.count,
            label: p.count > 1 ? String(p.count) : '',
            color: `rgb(${p.color.join(',')})`,
            // Null until the flag image for this dot's country has loaded -
            // see the icon layer below, which only draws where this is set.
            icon: iconReady ? p.flagCode : null,
            iconSize: (radius * 2) / FLAG_IMAGE_SIZE,
            // See NetworkMap: pastel flags are not recognisable flags.
            opacity: p.flagCode ? 0.9 : 0.7,
            radius,
          },
        };
      }),
    }),
    [points, loadedFlags],
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
        setMapReady(true);
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
        {/* The dot's colour: category colour, sublabel colour, or (in flag
            mode) the flag's own dominant colour as a placeholder until the
            real flag image below has loaded - see MapPoint.color. */}
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
        {/* The actual flag image (public/flags/<code>.svg, pre-cropped to a
            circle) as the whole dot's background, once it has loaded - sized
            to exactly cover the circle layer above so no colour shows past
            its transparent corners. */}
        <Layer
          id="points-flag"
          type="symbol"
          filter={['!=', ['get', 'icon'], null]}
          layout={{
            'icon-image': ['get', 'icon'],
            'icon-size': ['get', 'iconSize'],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
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
