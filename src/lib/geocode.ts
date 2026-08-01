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

// Biggest first, so an unqualified "Springfield" resolves to the one most people mean.
function byPopulation(a: City, b: City) {
  return (b.population ?? 0) - (a.population ?? 0);
}

function buildIndex(extra: City[] = []) {
  const m = new Map<string, City[]>();
  const add = (key: string, c: City) => {
    if (!key) return;
    const list = m.get(key);
    if (list) {
      if (!list.includes(c)) list.push(c);
    } else {
      m.set(key, [c]);
    }
  };
  // The curated CITIES table overlaps the GeoNames set; collapse same
  // name+country entries so the picker does not offer one place twice.
  const merged = new Map<string, City>();
  for (const c of [...CITIES, ...extra]) {
    const key = `${normalize(c.name)}|${c.country}`;
    const prev = merged.get(key);
    if (!prev || (c.population ?? 0) > (prev.population ?? 0)) merged.set(key, c);
  }
  for (const c of merged.values()) {
    add(normalize(c.name), c);
    for (const a of c.aliases ?? []) add(normalize(a), c);
  }
  for (const list of m.values()) list.sort(byPopulation);
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
    // Format: [name, countryCode, lat, lng, population?, admin1?, aliases?]
    const rows: [string, string, number, number, number?, string?, string[]?][] = await res.json();
    const extra: City[] = rows.map(([name, country, lat, lng, population, admin1, aliases]) => ({
      name,
      country,
      lat,
      lng,
      population: population ?? 0,
      admin1: admin1 || undefined,
      aliases,
    }));
    buildIndex(extra);
  } catch {
    if (!index) buildIndex();
  }
}

/**
 * Every city matching `name`, largest first. Optionally restricted to a country.
 * Lets callers show the user which "Springfield" they mean instead of guessing.
 */
export function geocodeCandidates(name?: string | null, country?: string | null): City[] {
  if (!index) buildIndex();
  if (!name?.trim()) return [];
  const all = index!.get(normalize(name)) ?? [];
  const code = findCountry(country)?.code;
  return code ? all.filter((c) => c.country === code) : all;
}

/**
 * Resolve free-text city + country to coordinates.
 * City match wins; falls back to the country centroid; returns null if neither resolves.
 *
 * A named country is a hard constraint: if the city is not found inside it we
 * return that country's centroid rather than a same-named city elsewhere.
 * Otherwise "Vancouver, US" would silently land in Canada.
 */
export function geocode(city?: string | null, country?: string | null): GeoPoint | null {
  if (!index) buildIndex();
  const countryHit = findCountry(country);
  const countryCode = countryHit?.code;

  if (city) {
    const candidates = index!.get(normalize(city));
    if (candidates?.length) {
      if (countryCode) {
        const inCountry = candidates.find((c) => c.country === countryCode);
        if (inCountry) return { lng: inCountry.lng, lat: inCountry.lat, precision: 'city' };
        // Deliberately fall through to the country centroid below.
      } else {
        const best = candidates[0]; // sorted by population
        return { lng: best.lng, lat: best.lat, precision: 'city' };
      }
    }
  }

  if (countryHit) {
    return { lng: countryHit.lng, lat: countryHit.lat, precision: 'country' };
  }
  return null;
}
