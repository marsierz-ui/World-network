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
// The same keys in code-unit order, so every key sharing a prefix sits in one
// contiguous run found by binary search instead of a scan of ~260k keys.
let sortedKeys: string[] = [];
// All sorted keys joined by newlines, with each key's offset, so substring
// search is a few native indexOf calls rather than a JS loop over every key.
let joinedKeys = '';
let keyOffsets = new Int32Array(0);
// normalize(c.name) per city, so substring search does not re-normalize in its loop.
let normNames = new Map<City, string>();

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

  const names = new Map<City, string>();
  for (const c of merged) {
    const n = normalize(c.name);
    names.set(c, n);
    add(n, c);
    for (const a of c.aliases ?? []) add(normalize(a), c);
  }
  for (const list of m.values()) list.sort(byPopulation);
  index = m;
  sortedKeys = [...m.keys()].sort();
  joinedKeys = sortedKeys.join('\n');
  keyOffsets = new Int32Array(sortedKeys.length);
  for (let i = 0, off = 0; i < sortedKeys.length; i++) {
    keyOffsets[i] = off;
    off += sortedKeys[i].length + 1;
  }
  normNames = names;
}

function keysContaining(q: string): string[] {
  const out: string[] = [];
  let from = 0;
  for (;;) {
    const pos = joinedKeys.indexOf(q, from);
    if (pos === -1) return out;
    // Last key starting at or before pos is the key the hit falls in.
    let lo = 0;
    let hi = keyOffsets.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (keyOffsets[mid] <= pos) lo = mid;
      else hi = mid - 1;
    }
    out.push(sortedKeys[lo]);
    from = lo + 1 < keyOffsets.length ? keyOffsets[lo + 1] : joinedKeys.length;
  }
}

function keysWithPrefix(prefix: string): string[] {
  let lo = 0;
  let hi = sortedKeys.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sortedKeys[mid] < prefix) lo = mid + 1;
    else hi = mid;
  }
  const out: string[] = [];
  for (let i = lo; i < sortedKeys.length && sortedKeys[i].startsWith(prefix); i++) {
    out.push(sortedKeys[i]);
  }
  return out;
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
  for (const key of keysWithPrefix(q)) starts.push(...index!.get(key)!);
  starts.sort(byPopulation);

  const seen = new Set<City>();
  const out: City[] = [];
  const take = (list: City[]) => {
    for (const c of list) {
      if (out.length >= limit) return;
      if (seen.has(c)) continue;
      seen.add(c);
      out.push(c);
    }
  };
  take(starts);
  if (out.length >= limit) return out;

  // Substring hits are only needed when prefix hits did not fill the list.
  const contains: City[] = [];
  for (const key of keysContaining(q)) {
    if (key.startsWith(q)) continue;
    // Substring hits only count against the real name. Aliases match by
    // prefix only, otherwise obscure transliterations leak in - Guangzhou
    // carries "kuvanco", which would surface it for "vanco".
    contains.push(...index!.get(key)!.filter((c) => normNames.get(c)!.includes(q)));
  }
  contains.sort(byPopulation);
  take(contains);
  return out;
}

/**
 * Cities whose name merely starts with the query, as a whole word: GeoNames
 * stores "Hanau am Main", "Frankfurt am Main", "Freiburg im Breisgau", so the
 * bare name people actually write matches nothing without this.
 */
function qualifiedNameMatches(q: string, countryCode?: string): City[] {
  const out: City[] = [];
  for (const key of keysWithPrefix(`${q} `)) {
    const list = index!.get(key)!;
    out.push(...(countryCode ? list.filter((c) => c.country === countryCode) : list));
  }
  return out.sort(byPopulation);
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
    const q = normalize(city);
    const candidates = index!.get(q);
    if (!candidates?.length) {
      const qualified = qualifiedNameMatches(q, countryCode);
      if (qualified.length) {
        return { lng: qualified[0].lng, lat: qualified[0].lat, precision: 'city' };
      }
    }
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
