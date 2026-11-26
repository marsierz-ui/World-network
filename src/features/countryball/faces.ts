import type { Contact } from '../../lib/database.types';
import type { BallLook } from './look';
import { localFlagId } from '../../lib/localFlags';

export interface Ball {
  key: string;
  country: string | null;
  look: BallLook | null;
  name?: string;
  /** Regional or city flag id, shown in a cloud beside the ball (city zoom). */
  local?: string | null;
  /** When that cloud appears, in ms, so clouds fill in one by one. */
  cloudDelay?: number;
}

/** The flag a contact's ball carries: where they are from, else where they live. */
export function ballCountry(c: Contact, fallback: string | null): string | null {
  return c.origin_country ?? c.current_country ?? fallback;
}

/**
 * Up to `n` balls to stand for a group: customised members first (their faces
 * are the fun part), then as many different flags as possible.
 */
export function pickFaces(balls: Ball[], n = 3): Ball[] {
  const out: Ball[] = [];
  const seen = new Set<string>();
  const order = [...balls].sort((a, b) => Number(!!b.look) - Number(!!a.look));
  for (const b of order) {
    if (out.length >= n) break;
    const flag = b.local ?? b.country ?? '';
    if (b.look || !seen.has(flag)) {
      out.push(b);
      seen.add(flag);
    }
  }
  for (const b of order) {
    if (out.length >= n) break;
    if (!out.includes(b)) out.push(b);
  }
  return out;
}


/** A contact's regional or city flag, from where they live: city name, address region, coordinates. */
export function contactLocalFlag(c: Contact): string | null {
  const country = c.current_country;
  if (!country) return null;
  const addr = c.details?.addresses?.find((a) => a.country?.toUpperCase() === country.toUpperCase());
  return localFlagId({
    country,
    city: c.current_city ?? addr?.city ?? null,
    region: addr?.region ?? null,
    lng: c.current_lng,
    lat: c.current_lat,
  });
}
