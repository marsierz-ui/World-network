import { useMemo } from 'react';
import type { Contact, Tag } from '../../lib/database.types';
import { CATEGORY_RGB } from './mapIcons';
import { useMapStore } from './mapStore';

type Tagged = Contact & { tag_ids?: string[] };

export interface MapPoint {
  lng: number;
  lat: number;
  contacts: Contact[];
  count: number;
  /** null when the point's contacts have no country set. */
  country: string | null;
  city: string | null;
  /** Dot colour: category by default, sublabel colour under a grouped filter. */
  color: [number, number, number];
  /** Which sublabel drove the colour, for the legend. */
  colorLabel: string | null;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
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

function dominantCategory(list: Contact[]) {
  const counts: Record<string, number> = {};
  for (const c of list) counts[c.category] = (counts[c.category] ?? 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] as Contact['category'];
}

function toPoint(list: Contact[], sublabels?: Map<string, Tag>): MapPoint {
  // Anchor on a contact that has a country, so a half-filled record does not
  // drag the dot away from the city the rest of the group agrees on.
  const anchor = list.find((c) => c.current_country) ?? list[0];

  let color = CATEGORY_RGB[dominantCategory(list)];
  let colorLabel: string | null = null;
  if (sublabels?.size) {
    // Colour by the sublabel most represented at this point.
    const counts = new Map<string, number>();
    for (const c of list as Tagged[]) {
      for (const id of c.tag_ids ?? []) {
        if (sublabels.has(id)) counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) {
      const tag = sublabels.get(top[0])!;
      color = hexToRgb(tag.color);
      colorLabel = tag.name;
    }
  }

  return {
    lng: anchor.current_lng!,
    lat: anchor.current_lat!,
    contacts: list,
    count: list.length,
    country: anchor.current_country ?? null,
    city: anchor.current_city ?? null,
    color,
    colorLabel,
  };
}

/**
 * Group placed contacts into map dots. Exported so the grouping rules can be
 * exercised directly; the hook below just memoises it.
 */
export function groupIntoPoints(placed: Contact[], sublabels?: Map<string, Tag>): MapPoint[] {
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
      for (const cluster of splitByDistance(sub)) out.push(toPoint(cluster, sublabels));
    }
  }
  return out;
}

export function useMapData(contacts: Contact[], homeCountry: string | null, tags: Tag[] = []) {
  const { viewMode, categories, country, tagId } = useMapStore();

  // Filtering by a parent label includes everything under it, and those
  // sublabels then drive the dot colours.
  const sublabels = useMemo(() => {
    if (!tagId) return new Map<string, Tag>();
    const kids = tags.filter((t) => t.parent_id === tagId);
    return new Map(kids.map((t) => [t.id, t]));
  }, [tags, tagId]);

  const wantedTagIds = useMemo(
    () => (tagId ? new Set([tagId, ...sublabels.keys()]) : null),
    [tagId, sublabels],
  );

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      if (c.current_lng == null || c.current_lat == null) return false;
      if (categories.size && !categories.has(c.category)) return false;
      if (country && c.current_country !== country) return false;
      if (viewMode === 'homelover' && homeCountry && c.current_country !== homeCountry) return false;
      if (wantedTagIds && !(c as Tagged).tag_ids?.some((id) => wantedTagIds.has(id))) return false;
      return true;
    });
  }, [contacts, categories, country, viewMode, homeCountry, wantedTagIds]);

  const points = useMemo(() => groupIntoPoints(filtered, sublabels), [filtered, sublabels]);

  const legend = useMemo(
    () => [...sublabels.values()].filter((t) => points.some((p) => p.colorLabel === t.name)),
    [sublabels, points],
  );

  return { points, filtered, legend };
}
