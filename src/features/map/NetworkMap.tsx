import { useEffect, useMemo, useRef, useState } from 'react';
import { Map, useControl, type MapRef } from 'react-map-gl/maplibre';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import type { MapPoint } from './useMapData';
import { flagBandRadius } from './mapIcons';
import { groupingForZoom, useMapStore } from './mapStore';
import { useBasemap, useMarkerOutline } from '../../lib/basemap';
import { COUNTRY_BY_CODE } from '../../lib/countries';
import { useTheme } from '../../lib/theme';
import 'maplibre-gl/dist/maplibre-gl.css';

// Flat discs instead of the old 30px teardrop pins: a pin's tail and solid fill
// cover a lot of basemap, and at city scale several of them overlap into a blob.
// Radius grows with the stack so density still reads at a glance.
function radiusFor(p: MapPoint) {
  return p.count === 1 ? 6 : 8 + Math.sqrt(p.count) * 3.2;
}

// City when the dots are per city, country name when they are per country.
function placeLabel(p: MapPoint) {
  return p.city ?? COUNTRY_BY_CODE.get(p.country ?? '')?.name ?? null;
}

function DeckOverlay(props: ConstructorParameters<typeof MapboxOverlay>[0]) {
  const overlay = useControl(() => new MapboxOverlay(props));
  overlay.setProps(props);
  return null;
}

interface Props {
  points: MapPoint[];
  initialView: { longitude: number; latitude: number; zoom: number };
  focus: { lng: number; lat: number; zoom: number } | null;
  selected: MapPoint | null;
  onSelect: (p: MapPoint | null) => void;
}

export function NetworkMap({ points, initialView, focus, selected, onSelect }: Props) {
  const [hovered, setHovered] = useState<MapPoint | null>(null);
  const basemap = useBasemap();
  const outline = useMarkerOutline();
  const theme = useTheme((s) => s.theme);
  const setGrouping = useMapStore((s) => s.setGrouping);
  const mapRef = useRef<MapRef | null>(null);

  useEffect(() => {
    if (focus) mapRef.current?.getMap().flyTo({ center: [focus.lng, focus.lat], zoom: focus.zoom });
  }, [focus]);

  const stacks = useMemo(() => points.filter((p) => p.count > 1), [points]);
  const selectedRing = useMemo(() => (selected ? [selected] : []), [selected]);
  // The 2nd and 3rd flag colours each get their own smaller disc stacked on top
  // of the base circle (see flagBandRadius) instead of a stroke, so a two- or
  // three-colour flag fills the whole dot as concentric bands.
  const flagBand2 = useMemo(() => points.filter((p) => (p.flagColors?.length ?? 0) >= 2), [points]);
  const flagBand3 = useMemo(() => points.filter((p) => (p.flagColors?.length ?? 0) >= 3), [points]);

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
        // Flag fills go nearly opaque: at the translucency that keeps category
        // dots from hiding the basemap, a flag's colours wash out into pastels
        // and stop being recognisable as that flag.
        getFillColor: (d) =>
          [...(d.flagColors?.[0] ?? d.color), d.flagColors ? 235 : 170] as [
            number,
            number,
            number,
            number,
          ],
        // A plain contrast edge, the same whether or not the dot is flag
        // coloured: the flag no longer lives in the stroke, so it never has to
        // compete with it.
        getLineColor: outline,
        getLineWidth: 1.5,
        radiusMinPixels: 4,
        radiusMaxPixels: 28,
        autoHighlight: true,
        highlightColor: [255, 255, 255, 90],
        onClick: (info) => onSelect((info.object as MapPoint) ?? null),
        onHover: (info) => setHovered((info.object as MapPoint) ?? null),
        updateTriggers: { getLineColor: [theme, points], getFillColor: points },
      }),
      new ScatterplotLayer<MapPoint>({
        id: 'contacts-flag-band-2',
        data: flagBand2,
        pickable: false,
        stroked: false,
        filled: true,
        radiusUnits: 'pixels',
        getPosition: (d) => [d.lng, d.lat],
        getRadius: (d) => flagBandRadius(radiusFor(d), 1, d.flagColors!.length),
        getFillColor: (d) => [...d.flagColors![1], 235] as [number, number, number, number],
        radiusMinPixels: 4,
        radiusMaxPixels: 28,
        updateTriggers: { getRadius: flagBand2, getFillColor: flagBand2 },
      }),
      new ScatterplotLayer<MapPoint>({
        id: 'contacts-flag-band-3',
        data: flagBand3,
        pickable: false,
        stroked: false,
        filled: true,
        radiusUnits: 'pixels',
        getPosition: (d) => [d.lng, d.lat],
        getRadius: (d) => flagBandRadius(radiusFor(d), 2, d.flagColors!.length),
        getFillColor: (d) => [...d.flagColors![2], 235] as [number, number, number, number],
        radiusMinPixels: 4,
        radiusMaxPixels: 28,
        updateTriggers: { getRadius: flagBand3, getFillColor: flagBand3 },
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
    [points, stacks, selectedRing, flagBand2, flagBand3, onSelect, outline, theme],
  );

  return (
    <Map
      ref={mapRef}
      initialViewState={initialView}
      mapStyle={basemap}
      // Only the country/city threshold is stored, so panning inside one zoom
      // band writes the same value and nothing regroups.
      onLoad={(e) => setGrouping(groupingForZoom(e.target.getZoom()))}
      onMove={(e) => setGrouping(groupingForZoom(e.viewState.zoom))}
      style={{ position: 'absolute', inset: 0 }}
    >
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
          {placeLabel(hovered) && <span className="mh-city">{placeLabel(hovered)}</span>}
        </div>
      )}
    </Map>
  );
}
