import { useMemo } from 'react';
import type { Contact } from '../../lib/database.types';
import { useMapStore } from './mapStore';

export interface MapPoint {
  lng: number;
  lat: number;
  contacts: Contact[];
  count: number;
  /** null when the point's contacts have no country set. */
  country: string | null;
}

// Group geocoded contacts by rounded coordinate so city-level points cluster naturally.
export function useMapData(contacts: Contact[], homeCountry: string | null) {
  const { viewMode, categories, country, tagId } = useMapStore();

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      if (c.current_lng == null || c.current_lat == null) return false;
      if (categories.size && !categories.has(c.category)) return false;
      if (country && c.current_country !== country) return false;
      if (viewMode === 'homelover' && homeCountry && c.current_country !== homeCountry) return false;
      if (tagId && !(c as Contact & { tag_ids?: string[] }).tag_ids?.includes(tagId)) return false;
      return true;
    });
  }, [contacts, categories, country, viewMode, homeCountry, tagId]);

  const points = useMemo(() => {
    const map = new Map<string, MapPoint>();
    for (const c of filtered) {
      // Country is part of the key: two contacts can round to the same coordinate
      // while living in different countries (border towns, or a mis-geocoded
      // city name shared across countries). Merging them hides that.
      const key = `${c.current_country ?? '?'}|${c.current_lng!.toFixed(2)},${c.current_lat!.toFixed(2)}`;
      const p = map.get(key);
      if (p) {
        p.contacts.push(c);
        p.count++;
      } else {
        map.set(key, {
          lng: c.current_lng!,
          lat: c.current_lat!,
          contacts: [c],
          count: 1,
          country: c.current_country ?? null,
        });
      }
    }
    return [...map.values()];
  }, [filtered]);

  return { points, filtered };
}
