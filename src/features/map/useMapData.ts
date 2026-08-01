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
  city: string | null;
}

function norm(s: string) {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

// Equirectangular approximation - plenty accurate for "same city or not".
function roughKm(a: Contact, b: Contact) {
  const dLat = (a.current_lat! - b.current_lat!) * 111;
  const dLng =
    (a.current_lng! - b.current_lng!) *
    111 *
    Math.cos(((a.current_lat! + b.current_lat!) / 2) * (Math.PI / 180));
  return Math.hypot(dLat, dLng);
}

// One name can cover distinct places inside a single country: Princeton NJ and
// Princeton FL are 1700km apart, and eight US Springfields exist. Grouping them
// by name alone would drop contacts onto the wrong side of the country.
function splitByDistance(list: Contact[], km = 60): Contact[][] {
  const groups: Contact[][] = [];
  for (const c of list) {
    const near = groups.find((g) => roughKm(g[0], c) <= km);
    if (near) near.push(c);
    else groups.push([c]);
  }
  return groups;
}

function toPoint(list: Contact[]): MapPoint {
  // Anchor on a contact that has a country, so a half-filled record does not
  // drag the dot away from the city the rest of the group agrees on.
  const anchor = list.find((c) => c.current_country) ?? list[0];
  return {
    lng: anchor.current_lng!,
    lat: anchor.current_lat!,
    contacts: list,
    count: list.length,
    country: anchor.current_country ?? null,
    city: anchor.current_city ?? null,
  };
}

/**
 * Group placed contacts into map dots. Exported so the grouping rules can be
 * exercised directly; the hook below just memoises it.
 */
export function groupIntoPoints(placed: Contact[]): MapPoint[] {
  // Group by city first. Grouping on raw coordinates alone hid people:
  // two contacts in Dublin a couple of km apart became separate dots
  // stacked on the same pixel, so whichever drew second was invisible.
  const byCity = new Map<string, Contact[]>();
  for (const c of placed) {
    const key = c.current_city
      ? norm(c.current_city)
      : `@${c.current_lng!.toFixed(1)},${c.current_lat!.toFixed(1)}`;
    const list = byCity.get(key);
    if (list) list.push(c);
    else byCity.set(key, [c]);
  }

  const out: MapPoint[] = [];
  for (const list of byCity.values()) {
    const countries = new Set(list.map((c) => c.current_country).filter((x): x is string => !!x));

    // One known country (or none): a single place. Contacts missing a country
    // join it rather than forming a duplicate dot on top.
    const subgroups: Contact[][] = [];
    if (countries.size <= 1) {
      subgroups.push(list);
    } else {
      // Same city name in genuinely different countries - keep them apart.
      const byCountry = new Map<string, Contact[]>();
      for (const c of list) {
        const k = c.current_country ?? '?';
        const sub = byCountry.get(k);
        if (sub) sub.push(c);
        else byCountry.set(k, [c]);
      }
      subgroups.push(...byCountry.values());
    }

    for (const sub of subgroups) {
      for (const cluster of splitByDistance(sub)) out.push(toPoint(cluster));
    }
  }
  return out;
}

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

  const points = useMemo(() => groupIntoPoints(filtered), [filtered]);

  return { points, filtered };
}
