import { distanceKm } from '../../lib/geocode';
import type { Contact, LinkedLocation, Profile } from '../../lib/database.types';

export interface Place {
  city: string;
  country: string | null;
  lat: number;
  lng: number;
}

// Counts as the same city: covers a metro area and the gap between a contact
// geocoded to a suburb and the visitor snapped to the centre.
const CITY_KM = 60;
// Further than this from home is a visit, not a commute.
const AWAY_KM = 75;

export function currentPlace(profile: Profile): Place | null {
  if (!profile.location_enabled || !profile.current_city) return null;
  if (profile.current_lat == null || profile.current_lng == null) return null;
  return {
    city: profile.current_city,
    country: profile.current_country,
    lat: profile.current_lat,
    lng: profile.current_lng,
  };
}

// The place the member is visiting, or null when they are home, have location
// off, or have no home set to compare against.
export function visitingPlace(profile: Profile): Place | null {
  const here = currentPlace(profile);
  if (!here) return null;
  if (profile.home_lat != null && profile.home_lng != null) {
    const km = distanceKm(here, { lat: profile.home_lat, lng: profile.home_lng });
    return km > AWAY_KM ? here : null;
  }
  if (profile.home_country) return here.country !== profile.home_country ? here : null;
  return null;
}

export interface PersonAt {
  contact: Contact;
  /** Shares their city and is in this one right now, wherever they live. */
  hereNow: boolean;
}

export interface PeopleAt {
  inCity: PersonAt[];
  inCountry: PersonAt[];
}

export function peopleAt(
  contacts: Contact[],
  place: Place,
  locations: Map<string, LinkedLocation>,
): PeopleAt {
  const out: PeopleAt = { inCity: [], inCountry: [] };
  for (const contact of contacts) {
    if (contact.custom?.self === true) continue;
    const now = locations.get(contact.id);
    const hereNow =
      now?.lat != null && now.lng != null && distanceKm(place, { lat: now.lat, lng: now.lng }) <= CITY_KM;
    const livesHere =
      contact.current_lat != null &&
      contact.current_lng != null &&
      // A contact placed by country only sits on the centroid; never "in the city".
      !!contact.current_city &&
      distanceKm(place, { lat: contact.current_lat, lng: contact.current_lng }) <= CITY_KM;
    if (hereNow || livesHere) out.inCity.push({ contact, hereNow });
    else if (place.country && contact.current_country === place.country) {
      out.inCountry.push({ contact, hereNow: false });
    }
  }
  return out;
}

export function placeLabel(place: { city: string | null; country: string | null }, countryName?: string) {
  return [place.city, countryName ?? place.country].filter(Boolean).join(', ');
}
