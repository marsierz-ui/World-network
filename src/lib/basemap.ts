import { useTheme } from './theme';

// Free CARTO styles, no token. Positron is the light counterpart to dark-matter.
const DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const LIGHT = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

// Keeps the last frame in the WebGL buffer so the feedback screenshot
// (features/feedback/captureScreenshot.ts) can copy the map; by default the
// buffer is cleared once the frame is shown and the map would come out blank.
// Module constant for the same reason as the outlines below: MapLibre reads it
// once at creation, and a fresh object each render is needless churn.
export const MAP_CANVAS_CONTEXT = { preserveDrawingBuffer: true } as const;

export function useBasemap(): string {
  return useTheme((s) => (s.theme === 'light' ? LIGHT : DARK));
}

// Marker outline needs to contrast with the basemap, not the app chrome.
// These must be module constants: zustand compares selector results with
// Object.is, so returning a fresh array literal here re-renders forever.
const OUTLINE_LIGHT: [number, number, number, number] = [255, 255, 255, 235];
const OUTLINE_DARK: [number, number, number, number] = [10, 12, 16, 200];

export function useMarkerOutline(): [number, number, number, number] {
  return useTheme((s) => (s.theme === 'light' ? OUTLINE_LIGHT : OUTLINE_DARK));
}
