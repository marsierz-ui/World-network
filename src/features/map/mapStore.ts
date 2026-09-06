import { create } from 'zustand';
import type { ContactCategory, ViewMode } from '../../lib/database.types';

/** Which place a contact is drawn at: where they live now, or where they are from. */
export type LocationBasis = 'current' | 'origin';

/** How dots are merged: one per country, or one per city. */
export type Grouping = 'country' | 'city';

/**
 * What a dot's colour means: the contacts' category (or the sublabel under a
 * grouped filter), or the flag of the country the dot sits in.
 */
export type ColorBy = 'category' | 'flag';

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
  colorBy: ColorBy;
  categories: Set<ContactCategory>; // empty = all
  countries: Set<string>; // empty = all
  tagId: string; // '' = all
  setViewMode: (m: ViewMode) => void;
  setLocationBasis: (b: LocationBasis) => void;
  setGrouping: (g: Grouping) => void;
  setColorBy: (c: ColorBy) => void;
  toggleCategory: (c: ContactCategory) => void;
  toggleCountry: (code: string) => void;
  clearCountries: () => void;
  setTagId: (id: string) => void;
}

export const useMapStore = create<MapState>((set) => ({
  viewMode: 'cosmopolitan',
  locationBasis: 'current',
  grouping: 'country',
  colorBy: 'category',
  categories: new Set(),
  countries: new Set(),
  tagId: '',
  setViewMode: (viewMode) => set({ viewMode }),
  setLocationBasis: (locationBasis) => set({ locationBasis }),
  setGrouping: (grouping) => set({ grouping }),
  setColorBy: (colorBy) => set({ colorBy }),
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
