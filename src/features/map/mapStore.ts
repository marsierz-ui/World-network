import { create } from 'zustand';
import type { ContactCategory, ViewMode } from '../../lib/database.types';

/** Which place a contact is drawn at: where they live now, or where they are from. */
export type LocationBasis = 'current' | 'origin';

/** How dots are merged: one per country, or one per city. */
export type Grouping = 'country' | 'city';

/**
 * Zoom at which dots split from country stacks into city stacks.
 *
 * Below it a whole country fits on screen and per-city dots collapse into an
 * unreadable smear; at 4 a country fills the viewport and its cities separate.
 */
export const CITY_ZOOM = 4;

export const groupingForZoom = (zoom: number): Grouping => (zoom < CITY_ZOOM ? 'country' : 'city');

interface MapState {
  viewMode: ViewMode;
  locationBasis: LocationBasis;
  /** Driven by the map's zoom, not by the user. */
  grouping: Grouping;
  categories: Set<ContactCategory>; // empty = all
  countries: Set<string>; // empty = all
  tagId: string; // '' = all
  setViewMode: (m: ViewMode) => void;
  setLocationBasis: (b: LocationBasis) => void;
  setGrouping: (g: Grouping) => void;
  toggleCategory: (c: ContactCategory) => void;
  toggleCountry: (code: string) => void;
  clearCountries: () => void;
  setTagId: (id: string) => void;
}

export const useMapStore = create<MapState>((set) => ({
  viewMode: 'cosmopolitan',
  locationBasis: 'current',
  grouping: 'country',
  categories: new Set(),
  countries: new Set(),
  tagId: '',
  setViewMode: (viewMode) => set({ viewMode }),
  setLocationBasis: (locationBasis) => set({ locationBasis }),
  setGrouping: (grouping) => set({ grouping }),
  toggleCategory: (c) =>
    set((s) => {
      const next = new Set(s.categories);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return { categories: next };
    }),
  toggleCountry: (code) =>
    set((s) => {
      const next = new Set(s.countries);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return { countries: next };
    }),
  clearCountries: () => set({ countries: new Set() }),
  setTagId: (tagId) => set({ tagId }),
}));
