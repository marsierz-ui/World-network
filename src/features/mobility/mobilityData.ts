import type { Contact, ContactCategory, LocationHistory } from '../../lib/database.types';
import { continentOf, CONTINENTS } from '../../lib/continents';

export interface Stop {
  lng: number;
  lat: number;
  city: string | null;
  country: string | null;
  fromY: number | null;
  toY: number | null;
  note: string | null;
}

export interface Track {
  contact: Contact;
  stops: Stop[]; // sorted by fromY asc (nulls last)
}

const yearOf = (d: string | null): number | null => (d ? Number(d.slice(0, 4)) : null);

export function buildTracks(contacts: Contact[], history: LocationHistory[]): Track[] {
  const byContact = new Map<string, Stop[]>();
  for (const h of history) {
    if (h.lng == null || h.lat == null) continue;
    const list = byContact.get(h.contact_id) ?? [];
    list.push({
      lng: h.lng, lat: h.lat, city: h.city, country: h.country,
      fromY: yearOf(h.date_from), toY: yearOf(h.date_to), note: h.note,
    });
    byContact.set(h.contact_id, list);
  }

  const tracks: Track[] = [];
  for (const c of contacts) {
    let stops = byContact.get(c.id);
    if (!stops && c.current_lng != null && c.current_lat != null) {
      stops = [{
        lng: c.current_lng, lat: c.current_lat, city: c.current_city, country: c.current_country,
        fromY: null, toY: null, note: null,
      }];
    }
    if (!stops || stops.length === 0) continue;
    stops.sort((a, b) => (a.fromY ?? Infinity) - (b.fromY ?? Infinity));
    tracks.push({ contact: c, stops });
  }
  return tracks;
}

export function yearRange(history: LocationHistory[], fallback: number): [number, number] {
  const years = history.map((h) => yearOf(h.date_from)).filter((y): y is number => y != null);
  if (years.length === 0) return [fallback - 10, fallback];
  return [Math.min(...years), Math.max(fallback, Math.max(...years))];
}

function activeStop(stops: Stop[], year: number): Stop | null {
  let best: Stop | null = null;
  for (const s of stops) {
    if (s.fromY == null) { best = best ?? s; continue; } // current/undated: fallback
    if (s.fromY <= year && (s.toY == null || s.toY >= year)) {
      if (!best || best.fromY == null || s.fromY >= best.fromY) best = s;
    }
  }
  return best;
}

export interface Frame {
  points: { lng: number; lat: number; contact: Contact; stop: Stop }[];
  arcs: { from: [number, number]; to: [number, number]; category: ContactCategory }[];
}

export function computeFrame(tracks: Track[], year: number): Frame {
  const points: Frame['points'] = [];
  const arcs: Frame['arcs'] = [];
  for (const { contact, stops } of tracks) {
    const here = activeStop(stops, year);
    if (here) points.push({ lng: here.lng, lat: here.lat, contact, stop: here });

    const dated = stops.filter((s) => s.fromY != null);
    for (let i = 1; i < dated.length; i++) {
      if ((dated[i].fromY as number) <= year) {
        arcs.push({
          from: [dated[i - 1].lng, dated[i - 1].lat],
          to: [dated[i].lng, dated[i].lat],
          category: contact.category,
        });
      }
    }
  }
  return { points, arcs };
}

// For each year, count active located contacts per continent.
export function panelSeries(tracks: Track[], [minY, maxY]: [number, number]) {
  const out: Record<string, number | string>[] = [];
  for (let y = minY; y <= maxY; y++) {
    const row: Record<string, number | string> = { year: y };
    for (const c of CONTINENTS) row[c] = 0;
    for (const { stops } of tracks) {
      const s = activeStop(stops, y);
      const cont = continentOf(s?.country);
      if (cont) row[cont] = (row[cont] as number) + 1;
    }
    out.push(row);
  }
  return out;
}
