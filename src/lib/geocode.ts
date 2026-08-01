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

// Equirectangular approximation; accurate enough to answer "same place?".
function roughKm(a: City, b: City) {
  const dLat = (a.lat - b.lat) * 111;
  const dLng = (a.lng - b.lng) * 111 * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  return Math.hypot(dLat, dLng);
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
  // The curated CITIES table overlaps the GeoNames set; collapse entries that
  // are the same place, keeping the better-populated record. Sameness is by
  // distance, not rounded coordinates: two records for one city can straddle a
  // rounding boundary (Vancouver at 49.2497 vs 49.28) and survive as duplicates.
  // Distinct cities sharing a name inside one country - Princeton NJ and
  // Princeton FL, eight US Springfields - stay separate.
  const byNameCountry = new Map<string, City[]>();
  for (const c of [...CITIES, ...extra]) {
    const key = `${normalize(c.name)}|${c.country}`;
    const list = byNameCountry.get(key);
    if (list) list.push(c);
    else byNameCountry.set(key, [c]);
  }
  const merged: City[] = [];
  for (const list of byNameCountry.values()) {
    const kept: City[] = [];
    for (const c of list) {
      const i = kept.findIndex((k) => roughKm(k, c) <= 25);
      if (i === -1) kept.push(c);
      else if ((c.population ?? 0) > (kept[i].population ?? 0)) kept[i] = c;
    }
    merged.push(...kept);
  }

  for (const c of merged) {
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
 * Prefix/substring search over city names and aliases, biggest first.
 * Powers the city autocomplete; matches are whole City records so the caller
 * can adopt the country and exact coordinates along with the name.
 */
export function searchCities(query: string, limit = 8): City[] {
  if (!index) buildIndex();
  const q = normalize(query);
  if (q.length < 2) return [];

  const starts: City[] = [];
  const contains: City[] = [];
  for (const [key, list] of index!) {
    if (key.startsWith(q)) {
      starts.push(...list);
    } else if (key.includes(q)) {
      // Substring hits only count against the real name. Aliases match by
      // prefix only, otherwise obscure transliterations leak in - Guangzhou
      // carries "kuvanco", which would surface it for "vanco".
      contains.push(...list.filter((c) => normalize(c.name).includes(q)));
    }
  }
  starts.sort(byPopulation);
  contains.sort(byPopulation);

  const seen = new Set<City>();
  const out: City[] = [];
  for (const c of starts.concat(contains)) {
    if (seen.has(c)) continue;
    seen.add(c);
    out.push(c);
    if (out.length >= limit) break;
  }
  return out;
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
