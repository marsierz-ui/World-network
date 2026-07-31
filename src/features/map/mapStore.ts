import { create } from 'zustand';
import type { ContactCategory, ViewMode } from '../../lib/database.types';

interface MapState {
  viewMode: ViewMode;
  categories: Set<ContactCategory>; // empty = all
  country: string; // '' = all
  tagId: string; // '' = all
  setViewMode: (m: ViewMode) => void;
  toggleCategory: (c: ContactCategory) => void;
  setCountry: (c: string) => void;
  setTagId: (id: string) => void;
}

export const useMapStore = create<MapState>((set) => ({
  viewMode: 'cosmopolitan',
  categories: new Set(),
  country: '',
  tagId: '',
  setViewMode: (viewMode) => set({ viewMode }),
  toggleCategory: (c) =>
    set((s) => {
      const next = new Set(s.categories);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return { categories: next };
    }),
  setCountry: (country) => set({ country }),
  setTagId: (tagId) => set({ tagId }),
}));
