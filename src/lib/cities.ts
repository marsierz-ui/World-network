// Curated major-city table so geocoding works with zero setup.
// For full coverage run `node scripts/build-cities.mjs` to generate
// public/cities.min.json (GeoNames cities15000); geocode.ts prefers it when present.

export interface City {
  name: string;
  country: string; // ISO alpha-2
  lat: number;
  lng: number;
  /** GeoNames population. Breaks ties between same-named cities; 0 when unknown. */
  population?: number;
  /** GeoNames admin1 code (state/province), for disambiguating within a country. */
  admin1?: string;
  /** Latin-script alternate spellings, e.g. Ulaanbaatar for "Ulan Bator". */
  aliases?: string[];
}

export const CITIES: City[] = [
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
