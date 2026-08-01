import { useTheme } from './theme';

// Free CARTO styles, no token. Positron is the light counterpart to dark-matter.
const DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const LIGHT = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

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
