import { useEffect, useRef } from 'react';
import { geocode, loadCityDataset, nearestCity } from '../../lib/geocode';
import { useProfile, useUpdateProfile } from '../profile/useProfile';
import type { City } from '../../lib/cities';
import type { Profile } from '../../lib/database.types';

const REFRESH_MS = 12 * 60 * 60 * 1000;

/**
 * The city the device is in. The position is read at low accuracy, matched to a
 * city here in the browser and dropped: only the city leaves this function, so
 * nothing finer is ever stored or sent.
 */
export async function detectCity(): Promise<City | null> {
  if (!('geolocation' in navigator)) return null;
  const pos = await new Promise<GeolocationPosition | null>((resolve) =>
    navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), {
      enableHighAccuracy: false,
      maximumAge: 60 * 60 * 1000,
      timeout: 20_000,
    }),
  );
  if (!pos) return null;
  await loadCityDataset();
  return nearestCity(pos.coords.latitude, pos.coords.longitude);
}

export function cityPatch(city: City): Partial<Profile> {
  return {
    current_city: city.name,
    current_country: city.country,
    current_lng: city.lng,
    current_lat: city.lat,
    location_updated_at: new Date().toISOString(),
  };
}

// Runs once per app load: fills in home coordinates for profiles saved before
// they existed, and, only for members who switched location on, refreshes the
// current city.
export function useCityLocation() {
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  const ran = useRef(false);

  useEffect(() => {
    if (!profile || ran.current) return;
    ran.current = true;
    void (async () => {
      const patch: Partial<Profile> = {};
      if (profile.home_lng == null && (profile.home_city || profile.home_country)) {
        await loadCityDataset();
        const g = geocode(profile.home_city, profile.home_country);
        if (g) Object.assign(patch, { home_lng: g.lng, home_lat: g.lat });
      }
      if (profile.location_enabled) {
        const city = await detectCity();
        const moved =
          city && (city.name !== profile.current_city || city.country !== profile.current_country);
        const stale =
          !profile.location_updated_at ||
          Date.now() - Date.parse(profile.location_updated_at) > REFRESH_MS;
        if (city && (moved || stale)) Object.assign(patch, cityPatch(city));
      }
      if (Object.keys(patch).length) update.mutate(patch);
    })();
  }, [profile, update]);
}
