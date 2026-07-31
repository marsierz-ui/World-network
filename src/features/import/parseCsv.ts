import Papa from 'papaparse';
import type { ContactInput } from '../contacts/useContacts';
import type { ContactSource } from '../../lib/database.types';
import { geocode } from '../../lib/geocode';
import { findCountry, findCountryByNameOnly } from '../../lib/countries';

export interface ParsedCsv {
  fields: string[];
  rows: Record<string, string>[];
  isLinkedIn: boolean;
}

// One imported contact plus the tag names parsed from its labels.
export interface ImportItem {
  input: ContactInput;
  labels: string[];
}

// Target fields a CSV column can map onto.
export type MapTarget =
  | 'ignore'
  | 'full_name'
  | 'first_name'
  | 'last_name'
  | 'email'
  | 'phone'
  | 'notes'
  | 'labels'
  | 'current_city'
  | 'current_country'
  | 'origin_country'
  | 'company'
  | 'position';

export const MAP_TARGETS: MapTarget[] = [
  'ignore',
  'full_name',
  'first_name',
  'last_name',
  'email',
  'phone',
  'notes',
  'labels',
  'current_city',
  'current_country',
  'origin_country',
  'company',
  'position',
];

// LinkedIn Connections.csv prepends a "Notes:" preamble before the real header, and is
// identified by its "Connected On" column. Google CSV also starts with "First Name" but has
// no "Connected On", so detect on that column rather than the leading field.
function stripLinkedInPreamble(text: string): { text: string; isLinkedIn: boolean } {
  const lines = text.split(/\r?\n/);
  const headerIdx = lines.findIndex((l) => /(^|,)"?First Name"?,/.test(l));
  const sliced = headerIdx > 0 ? lines.slice(headerIdx) : lines;
  const isLinkedIn = /connected on/i.test(sliced[0] ?? '');
  return { text: sliced.join('\n'), isLinkedIn };
}

export function parseCsv(text: string): ParsedCsv {
  const { text: clean, isLinkedIn } = stripLinkedInPreamble(text);
  const result = Papa.parse<Record<string, string>>(clean, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const fields = result.meta.fields ?? [];
  return { fields, rows: result.data, isLinkedIn };
}

// Single-value targets take only the first matching column (Google exports repeat
// Address 1/2, E-mail 1/2, Phone 1/2, etc.).
const SINGLE: ReadonlySet<MapTarget> = new Set<MapTarget>([
  'first_name', 'last_name', 'email', 'phone', 'notes', 'labels',
  'current_city', 'current_country', 'company', 'position', 'full_name',
]);

export function autoMap(fields: string[]): Record<string, MapTarget> {
  const map: Record<string, MapTarget> = {};
  const used = new Set<MapTarget>();
  const take = (f: string, target: MapTarget) => {
    if (SINGLE.has(target) && used.has(target)) return;
    map[f] = target;
    used.add(target);
  };

  for (const f of fields) {
    map[f] = 'ignore';
    const k = f.toLowerCase().trim();
    if (k.includes('phonetic')) continue;
    if (k === 'labels' || k === 'label' || k === 'tags') { take(f, 'labels'); continue; }
    if (k.includes('label')) continue; // skip "E-mail 1 - Label" etc.
    if (k === 'first name' || k === 'given name') take(f, 'first_name');
    else if (k === 'last name' || k === 'family name') take(f, 'last_name');
    else if (k.includes('mail') && (k.includes('value') || k === 'email' || k === 'e-mail' || k.includes('address')))
      take(f, 'email');
    else if (k.includes('phone') && (k.includes('value') || k === 'phone' || k.includes('number')))
      take(f, 'phone');
    else if (k === 'notes' || k === 'note') take(f, 'notes');
    else if (k.includes('title') || k === 'position') take(f, 'position');
    else if (k === 'company' || k.includes('organization name') || k === 'organization') take(f, 'company');
    else if (k.includes('city')) take(f, 'current_city');
    else if (k.includes('country')) take(f, 'current_country');
    else if (k === 'name' || k === 'full name') take(f, 'full_name');
  }
  return map;
}

// Google joins multiple labels with " ::: " and prefixes system labels with "* ".
function parseLabels(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(':::')
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('*'));
}

// Infer location from labels when the address columns are empty. Labels are user-curated
// (e.g. "France", "München") so trusted to apply directly. Notes are NOT auto-applied -
// see detectLocationInText() for the user-reviewed suggestion path.
function inferLocation(
  labels: string[],
  hasCity: boolean,
  hasCountry: boolean,
): { city: string | null; country: string | null } {
  let country: string | null = null;
  let city: string | null = null;

  if (!hasCountry) {
    for (const l of labels) {
      const c = findCountry(l);
      if (c) { country = c.code; break; }
    }
  }

  if (!hasCity) {
    for (const l of labels) {
      const g = geocode(l, country);
      if (g && g.precision === 'city') { city = l; break; }
    }
  }

  return { city, country };
}

// Scan free text (notes) for a place mention, for user-reviewed suggestions only.
// Returns the matched text and the field/value to apply, or null.
export interface LocationSuggestion {
  text: string; // the matched word(s)
  field: 'current_country' | 'current_city';
  value: string;
}

export function detectLocationInText(text?: string | null): LocationSuggestion | null {
  if (!text) return null;
  const words = text.split(/[^\p{Letter}]+/u).filter((w) => w.length > 2);
  // Prefer a country (name-only match, never 2-letter codes).
  for (let i = 0; i < words.length; i++) {
    const bigram = i + 1 < words.length ? `${words[i]} ${words[i + 1]}` : '';
    const c = findCountryByNameOnly(words[i]) || (bigram ? findCountryByNameOnly(bigram) : undefined);
    if (c) return { text: c.name, field: 'current_country', value: c.code };
  }
  // Then a known city (require length > 3 to avoid noise).
  for (const w of words) {
    if (w.length <= 3) continue;
    const g = geocode(w, null);
    if (g && g.precision === 'city') return { text: w, field: 'current_city', value: w };
  }
  return null;
}

export function rowsToContacts(
  rows: Record<string, string>[],
  mapping: Record<string, MapTarget>,
  source: ContactSource,
): ImportItem[] {
  const out: ImportItem[] = [];
  for (const row of rows) {
    const acc: Partial<Record<MapTarget, string>> = {};
    for (const [col, target] of Object.entries(mapping)) {
      if (target === 'ignore') continue;
      const v = (row[col] ?? '').trim();
      if (v) acc[target] = v;
    }
    const fullName =
      acc.full_name || [acc.first_name, acc.last_name].filter(Boolean).join(' ').trim();
    if (!fullName) continue;

    const custom: Record<string, unknown> = {};
    if (acc.company) custom.company = acc.company;
    if (acc.position) custom.position = acc.position;

    const labels = parseLabels(acc.labels);
    const notes = acc.notes ?? null;

    let city = acc.current_city ?? null;
    let country = acc.current_country ?? null;
    if (!city || !country) {
      const inferred = inferLocation(labels, Boolean(city), Boolean(country));
      city = city ?? inferred.city;
      country = country ?? inferred.country;
    }

    out.push({
      labels,
      input: {
        full_name: fullName,
        primary_email: acc.email ?? null,
        phone: acc.phone ?? null,
        notes,
        current_city: city,
        current_country: country,
        origin_country: acc.origin_country ?? null,
        category: source === 'linkedin_csv' ? 'work' : 'other',
        custom,
        source,
      },
    });
  }
  return out;
}
