import { useEffect, useState } from 'react';
import type { MultiPolygon, Polygon } from 'geojson';

/** One country outline, keyed by ISO 3166-1 alpha-2 (null for disputed areas). */
export interface CountryFeature {
  type: 'Feature';
  properties: { code: string | null; name: string };
  geometry: Polygon | MultiPolygon;
}

export interface CountryShapes {
  type: 'FeatureCollection';
  features: CountryFeature[];
}

// 160KB of outlines, needed only by the choropleth view. Fetched the first time
// that view is opened and kept for the session; the flat and globe maps never
// pay for it. See scripts/build-countries.mjs.
let cache: Promise<CountryShapes> | null = null;

export function loadCountryShapes(): Promise<CountryShapes> {
  cache ??= fetch(`${import.meta.env.BASE_URL}countries.min.json`)
    .then((res) => {
      if (!res.ok) throw new Error(`countries.min.json: ${res.status}`);
      return res.json() as Promise<CountryShapes>;
    })
    .catch((e) => {
      // Do not cache the failure: an offline first attempt would otherwise leave
      // the view permanently empty for the rest of the session.
      cache = null;
      throw e;
    });
  return cache;
}

export function useCountryShapes(): { shapes: CountryShapes | null; error: string | null } {
  const [shapes, setShapes] = useState<CountryShapes | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loadCountryShapes().then(
      (s) => live && setShapes(s),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, []);

  return { shapes, error };
}
