import { CITIES, type City } from './cities';
import { findCountry } from './countries';

export interface GeoPoint {
  lng: number;
  lat: number;
  precision: 'city' | 'country';
}

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // strip accents
    .toLowerCase()
    .trim();
}

// name -> City[] (a name can exist in several countries)
let index: Map<string, City[]> | null = null;

function buildIndex(extra: City[] = []) {
  const m = new Map<string, City[]>();
  for (const c of [...CITIES, ...extra]) {
    const key = normalize(c.name);
    const list = m.get(key);
    if (list) list.push(c);
    else m.set(key, [c]);
  }
  index = m;
}

// Optionally enrich with the full GeoNames set generated into /cities.min.json.
// Safe no-op if the file is absent. Call once at startup.
export async function loadCityDataset(): Promise<void> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}cities.min.json`);
    if (!res.ok) {
      if (!index) buildIndex();
      return;
    }
    // Format: [[name, countryCode, lat, lng], ...]
    const rows: [string, string, number, number][] = await res.json();
    const extra: City[] = rows.map(([name, country, lat, lng]) => ({ name, country, lat, lng }));
    buildIndex(extra);
  } catch {
    if (!index) buildIndex();
  }
}

/**
 * Resolve free-text city + country to coordinates.
 * City match wins; falls back to the country centroid; returns null if neither resolves.
 */
export function geocode(city?: string | null, country?: string | null): GeoPoint | null {
  if (!index) buildIndex();
  const countryHit = findCountry(country);
  const countryCode = countryHit?.code;

  if (city) {
    const candidates = index!.get(normalize(city));
    if (candidates && candidates.length) {
      const match =
        (countryCode && candidates.find((c) => c.country === countryCode)) || candidates[0];
      return { lng: match.lng, lat: match.lat, precision: 'city' };
    }
  }

  if (countryHit) {
    return { lng: countryHit.lng, lat: countryHit.lat, precision: 'country' };
  }
  return null;
}
