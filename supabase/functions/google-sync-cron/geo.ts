// Minimal geocoding for background-imported contacts: the curated city table
// and country centroids from src/lib/cities.ts and src/lib/countries.ts,
// copied rather than imported (see person.ts for why), trimmed to the exact-
// match + country-centroid fallback. This is deliberately less precise than
// the interactive import, which also enriches from the full GeoNames dataset
// (public/cities.min.json) - that file is a 9MB static asset served to the
// browser, not something worth fetching from inside a cron run. A contact
// this misses lands in "Unplaced" like any other, fixable from the map.

interface City {
  name: string;
  country: string; // ISO alpha-2
  lat: number;
  lng: number;
}

const CITIES: City[] = [
  { name: 'Amsterdam', country: 'NL', lat: 52.37, lng: 4.9 },
  { name: 'Athens', country: 'GR', lat: 37.98, lng: 23.73 },
  { name: 'Atlanta', country: 'US', lat: 33.75, lng: -84.39 },
  { name: 'Auckland', country: 'NZ', lat: -36.85, lng: 174.76 },
  { name: 'Bangkok', country: 'TH', lat: 13.76, lng: 100.5 },
  { name: 'Barcelona', country: 'ES', lat: 41.39, lng: 2.17 },
  { name: 'Beijing', country: 'CN', lat: 39.9, lng: 116.41 },
  { name: 'Belgrade', country: 'RS', lat: 44.79, lng: 20.45 },
  { name: 'Berlin', country: 'DE', lat: 52.52, lng: 13.4 },
  { name: 'Bogota', country: 'CO', lat: 4.71, lng: -74.07 },
  { name: 'Boston', country: 'US', lat: 42.36, lng: -71.06 },
  { name: 'Brussels', country: 'BE', lat: 50.85, lng: 4.35 },
  { name: 'Bucharest', country: 'RO', lat: 44.43, lng: 26.1 },
  { name: 'Budapest', country: 'HU', lat: 47.5, lng: 19.04 },
  { name: 'Buenos Aires', country: 'AR', lat: -34.6, lng: -58.38 },
  { name: 'Cairo', country: 'EG', lat: 30.04, lng: 31.24 },
  { name: 'Cape Town', country: 'ZA', lat: -33.92, lng: 18.42 },
  { name: 'Chicago', country: 'US', lat: 41.88, lng: -87.63 },
  { name: 'Copenhagen', country: 'DK', lat: 55.68, lng: 12.57 },
  { name: 'Dallas', country: 'US', lat: 32.78, lng: -96.8 },
  { name: 'Delhi', country: 'IN', lat: 28.7, lng: 77.1 },
  { name: 'Dubai', country: 'AE', lat: 25.2, lng: 55.27 },
  { name: 'Dublin', country: 'IE', lat: 53.35, lng: -6.26 },
  { name: 'Frankfurt', country: 'DE', lat: 50.11, lng: 8.68 },
  { name: 'Geneva', country: 'CH', lat: 46.2, lng: 6.14 },
  { name: 'Hamburg', country: 'DE', lat: 53.55, lng: 9.99 },
  { name: 'Helsinki', country: 'FI', lat: 60.17, lng: 24.94 },
  { name: 'Ho Chi Minh City', country: 'VN', lat: 10.82, lng: 106.63 },
  { name: 'Hong Kong', country: 'HK', lat: 22.32, lng: 114.17 },
  { name: 'Houston', country: 'US', lat: 29.76, lng: -95.37 },
  { name: 'Istanbul', country: 'TR', lat: 41.01, lng: 28.98 },
  { name: 'Jakarta', country: 'ID', lat: -6.21, lng: 106.85 },
  { name: 'Johannesburg', country: 'ZA', lat: -26.2, lng: 28.05 },
  { name: 'Kuala Lumpur', country: 'MY', lat: 3.14, lng: 101.69 },
  { name: 'Kyiv', country: 'UA', lat: 50.45, lng: 30.52 },
  { name: 'Lagos', country: 'NG', lat: 6.52, lng: 3.38 },
  { name: 'Lima', country: 'PE', lat: -12.05, lng: -77.04 },
  { name: 'Lisbon', country: 'PT', lat: 38.72, lng: -9.14 },
  { name: 'London', country: 'GB', lat: 51.51, lng: -0.13 },
  { name: 'Los Angeles', country: 'US', lat: 34.05, lng: -118.24 },
  { name: 'Madrid', country: 'ES', lat: 40.42, lng: -3.7 },
  { name: 'Manila', country: 'PH', lat: 14.6, lng: 120.98 },
  { name: 'Melbourne', country: 'AU', lat: -37.81, lng: 144.96 },
  { name: 'Mexico City', country: 'MX', lat: 19.43, lng: -99.13 },
  { name: 'Miami', country: 'US', lat: 25.76, lng: -80.19 },
  { name: 'Milan', country: 'IT', lat: 45.46, lng: 9.19 },
  { name: 'Montreal', country: 'CA', lat: 45.5, lng: -73.57 },
  { name: 'Moscow', country: 'RU', lat: 55.76, lng: 37.62 },
  { name: 'Mumbai', country: 'IN', lat: 19.08, lng: 72.88 },
  { name: 'Munich', country: 'DE', lat: 48.14, lng: 11.58 },
  { name: 'Nairobi', country: 'KE', lat: -1.29, lng: 36.82 },
  { name: 'New York', country: 'US', lat: 40.71, lng: -74.01 },
  { name: 'Osaka', country: 'JP', lat: 34.69, lng: 135.5 },
  { name: 'Oslo', country: 'NO', lat: 59.91, lng: 10.75 },
  { name: 'Paris', country: 'FR', lat: 48.86, lng: 2.35 },
  { name: 'Prague', country: 'CZ', lat: 50.08, lng: 14.44 },
  { name: 'Rio de Janeiro', country: 'BR', lat: -22.91, lng: -43.17 },
  { name: 'Rome', country: 'IT', lat: 41.9, lng: 12.5 },
  { name: 'San Francisco', country: 'US', lat: 37.77, lng: -122.42 },
  { name: 'Santiago', country: 'CL', lat: -33.45, lng: -70.67 },
  { name: 'Sao Paulo', country: 'BR', lat: -23.55, lng: -46.63 },
  { name: 'Seattle', country: 'US', lat: 47.61, lng: -122.33 },
  { name: 'Seoul', country: 'KR', lat: 37.57, lng: 126.98 },
  { name: 'Shanghai', country: 'CN', lat: 31.23, lng: 121.47 },
  { name: 'Singapore', country: 'SG', lat: 1.35, lng: 103.82 },
  { name: 'Stockholm', country: 'SE', lat: 59.33, lng: 18.07 },
  { name: 'Sydney', country: 'AU', lat: -33.87, lng: 151.21 },
  { name: 'Taipei', country: 'TW', lat: 25.03, lng: 121.57 },
  { name: 'Tel Aviv', country: 'IL', lat: 32.08, lng: 34.78 },
  { name: 'Tokyo', country: 'JP', lat: 35.68, lng: 139.69 },
  { name: 'Toronto', country: 'CA', lat: 43.65, lng: -79.38 },
  { name: 'Vancouver', country: 'CA', lat: 49.28, lng: -123.12 },
  { name: 'Vienna', country: 'AT', lat: 48.21, lng: 16.37 },
  { name: 'Warsaw', country: 'PL', lat: 52.23, lng: 21.01 },
  { name: 'Washington', country: 'US', lat: 38.91, lng: -77.04 },
  { name: 'Zurich', country: 'CH', lat: 47.37, lng: 8.54 },
];

// code -> centroid, generated from src/lib/countries.ts (`node -e` one-liner,
// regenerate the same way if that table changes): every ISO code it lists,
// paired with its lat/lng only - the display names live in the app, not here.
const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  AD: [42.55, 1.6], AE: [23.42, 53.85], AF: [33.94, 67.71], AL: [41.15, 20.17],
  AM: [40.07, 45.04], AO: [-11.2, 17.87], AR: [-38.42, -63.62], AT: [47.52, 14.55],
  AU: [-25.27, 133.78], AZ: [40.14, 47.58], BA: [43.92, 17.68], BD: [23.68, 90.36],
  BE: [50.5, 4.47], BF: [12.24, -1.56], BG: [42.73, 25.49], BH: [25.93, 50.64],
  BI: [-3.37, 29.92], BJ: [9.31, 2.32], BN: [4.54, 114.73], BO: [-16.29, -63.59],
  BR: [-14.24, -51.93], BW: [-22.33, 24.68], BY: [53.71, 27.95], BZ: [17.19, -88.5],
  CA: [56.13, -106.35], CD: [-4.04, 21.76], CF: [6.61, 20.94], CG: [-0.23, 15.83],
  CH: [46.82, 8.23], CI: [7.54, -5.55], CL: [-35.68, -71.54], CM: [7.37, 12.35],
  CN: [35.86, 104.2],
  CO: [4.57, -74.3], CR: [9.75, -83.75], CU: [21.52, -77.78], CY: [35.13, 33.43],
  CZ: [49.82, 15.47], DE: [51.17, 10.45], DK: [56.26, 9.5], DO: [18.74, -70.16],
  DZ: [28.03, 1.66], EC: [-1.83, -78.18], EE: [58.6, 25.01], EG: [26.82, 30.8],
  ER: [15.18, 39.78], ES: [40.46, -3.75], ET: [9.15, 40.49], FI: [61.92, 25.75],
  FJ: [-16.58, 179.41], FR: [46.23, 2.21], GA: [-0.8, 11.61], GB: [55.38, -3.44],
  GE: [42.32, 43.36], GH: [7.95, -1.02], GN: [9.95, -9.7], GR: [39.07, 21.82],
  GT: [15.78, -90.23], GY: [4.86, -58.93], HK: [22.32, 114.17], HN: [15.2, -86.24],
  HR: [45.1, 15.2], HT: [18.97, -72.29], HU: [47.16, 19.5], ID: [-0.79, 113.92],
  IE: [53.41, -8.24], IL: [31.05, 34.85], IN: [20.59, 78.96], IQ: [33.22, 43.68],
  IR: [32.43, 53.69], IS: [64.96, -19.02], IT: [41.87, 12.57], JM: [18.11, -77.3],
  JO: [30.59, 36.24], JP: [36.2, 138.25], KE: [-0.02, 37.91], KG: [41.2, 74.77],
  KH: [12.57, 104.99], KR: [35.91, 127.77], KW: [29.31, 47.48], KZ: [48.02, 66.92],
  LA: [19.86, 102.5], LB: [33.85, 35.86], LK: [7.87, 80.77], LR: [6.43, -9.43],
  LT: [55.17, 23.88], LU: [49.82, 6.13], LV: [56.88, 24.6], LY: [26.34, 17.23],
  MA: [31.79, -7.09], MD: [47.41, 28.37], ME: [42.71, 19.37], MG: [-18.77, 46.87],
  MK: [41.61, 21.75], ML: [17.57, -4], MM: [21.91, 95.96], MN: [46.86, 103.85],
  MT: [35.94, 14.38], MX: [23.63, -102.55], MY: [4.21, 101.98], MZ: [-18.67, 35.53],
  NA: [-22.96, 18.49], NG: [9.08, 8.68], NI: [12.87, -85.21], NL: [52.13, 5.29],
  NO: [60.47, 8.47], NP: [28.39, 84.12], NZ: [-40.9, 174.89], OM: [21.51, 55.92],
  PA: [8.54, -80.78], PE: [-9.19, -75.02], PH: [12.88, 121.77], PK: [30.38, 69.35],
  PL: [51.92, 19.15], PT: [39.4, -8.22], PY: [-23.44, -58.44], QA: [25.35, 51.18],
  RO: [45.94, 24.97], RS: [44.02, 21.01], RU: [61.52, 105.32], RW: [-1.94, 29.87],
  SA: [23.89, 45.08], SD: [12.86, 30.22], SE: [60.13, 18.64], SG: [1.35, 103.82],
  SI: [46.15, 14.99], SK: [48.67, 19.7], SN: [14.5, -14.45], SO: [5.15, 46.2],
  SR: [3.92, -56.03], SV: [13.79, -88.9], SY: [34.8, 38.997], TD: [15.45, 18.73],
  TG: [8.62, 0.82], TH: [15.87, 100.99], TJ: [38.86, 71.28], TM: [38.97, 59.56],
  TN: [33.89, 9.54], TR: [38.96, 35.24], TT: [10.69, -61.22], TW: [23.7, 120.96],
  TZ: [-6.37, 34.89], UA: [48.38, 31.17], UG: [1.37, 32.29], US: [37.09, -95.71],
  UY: [-32.52, -55.77], UZ: [41.38, 64.59], VE: [6.42, -66.59], VN: [14.06, 108.28],
  YE: [15.55, 48.52], ZA: [-30.56, 22.94], ZM: [-13.13, 27.85], ZW: [-19.02, 29.15],
};

function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

let index: Map<string, City[]> | null = null;

function buildIndex(): Map<string, City[]> {
  const m = new Map<string, City[]>();
  for (const c of CITIES) {
    const key = normalize(c.name);
    const list = m.get(key);
    if (list) list.push(c);
    else m.set(key, [c]);
  }
  return m;
}

/**
 * Same contract as geocode() in src/lib/geocode.ts, minus the alias/qualified-
 * name/GeoNames matching: exact curated-city match, narrowed to `country` when
 * given, else the country's centroid.
 */
export function geocodeMinimal(
  city: string | null,
  country: string | null,
): { lng: number; lat: number } | null {
  index ??= buildIndex();
  if (city) {
    const candidates = index.get(normalize(city));
    if (candidates?.length) {
      const inCountry = country ? candidates.find((c) => c.country === country) : undefined;
      const hit = inCountry ?? (country ? undefined : candidates[0]);
      if (hit) return { lng: hit.lng, lat: hit.lat };
    }
  }
  const centroid = country ? COUNTRY_CENTROIDS[country] : undefined;
  return centroid ? { lat: centroid[0], lng: centroid[1] } : null;
}
