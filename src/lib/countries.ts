// ISO 3166-1 alpha-2 + approximate country centroid (lat, lng).
// Centroids power the geocoding fallback when only a country is known,
// and the list drives the home-country / origin dropdowns.

export interface Country {
  code: string;
  name: string;
  lat: number;
  lng: number;
}

export const COUNTRIES: Country[] = [
  { code: 'AD', name: 'Andorra', lat: 42.55, lng: 1.6 },
  { code: 'AE', name: 'United Arab Emirates', lat: 23.42, lng: 53.85 },
  { code: 'AF', name: 'Afghanistan', lat: 33.94, lng: 67.71 },
  { code: 'AL', name: 'Albania', lat: 41.15, lng: 20.17 },
  { code: 'AM', name: 'Armenia', lat: 40.07, lng: 45.04 },
  { code: 'AO', name: 'Angola', lat: -11.2, lng: 17.87 },
  { code: 'AR', name: 'Argentina', lat: -38.42, lng: -63.62 },
  { code: 'AT', name: 'Austria', lat: 47.52, lng: 14.55 },
  { code: 'AU', name: 'Australia', lat: -25.27, lng: 133.78 },
  { code: 'AZ', name: 'Azerbaijan', lat: 40.14, lng: 47.58 },
  { code: 'BA', name: 'Bosnia and Herzegovina', lat: 43.92, lng: 17.68 },
  { code: 'BD', name: 'Bangladesh', lat: 23.68, lng: 90.36 },
  { code: 'BE', name: 'Belgium', lat: 50.5, lng: 4.47 },
  { code: 'BF', name: 'Burkina Faso', lat: 12.24, lng: -1.56 },
  { code: 'BG', name: 'Bulgaria', lat: 42.73, lng: 25.49 },
  { code: 'BH', name: 'Bahrain', lat: 25.93, lng: 50.64 },
  { code: 'BI', name: 'Burundi', lat: -3.37, lng: 29.92 },
  { code: 'BJ', name: 'Benin', lat: 9.31, lng: 2.32 },
  { code: 'BN', name: 'Brunei', lat: 4.54, lng: 114.73 },
  { code: 'BO', name: 'Bolivia', lat: -16.29, lng: -63.59 },
  { code: 'BR', name: 'Brazil', lat: -14.24, lng: -51.93 },
  { code: 'BW', name: 'Botswana', lat: -22.33, lng: 24.68 },
  { code: 'BY', name: 'Belarus', lat: 53.71, lng: 27.95 },
  { code: 'BZ', name: 'Belize', lat: 17.19, lng: -88.5 },
  { code: 'CA', name: 'Canada', lat: 56.13, lng: -106.35 },
  { code: 'CD', name: 'DR Congo', lat: -4.04, lng: 21.76 },
  { code: 'CF', name: 'Central African Republic', lat: 6.61, lng: 20.94 },
  { code: 'CG', name: 'Congo', lat: -0.23, lng: 15.83 },
  { code: 'CH', name: 'Switzerland', lat: 46.82, lng: 8.23 },
  { code: 'CI', name: "Cote d'Ivoire", lat: 7.54, lng: -5.55 },
  { code: 'CL', name: 'Chile', lat: -35.68, lng: -71.54 },
  { code: 'CM', name: 'Cameroon', lat: 7.37, lng: 12.35 },
  { code: 'CN', name: 'China', lat: 35.86, lng: 104.2 },
  { code: 'CO', name: 'Colombia', lat: 4.57, lng: -74.3 },
  { code: 'CR', name: 'Costa Rica', lat: 9.75, lng: -83.75 },
  { code: 'CU', name: 'Cuba', lat: 21.52, lng: -77.78 },
  { code: 'CY', name: 'Cyprus', lat: 35.13, lng: 33.43 },
  { code: 'CZ', name: 'Czechia', lat: 49.82, lng: 15.47 },
  { code: 'DE', name: 'Germany', lat: 51.17, lng: 10.45 },
  { code: 'DK', name: 'Denmark', lat: 56.26, lng: 9.5 },
  { code: 'DO', name: 'Dominican Republic', lat: 18.74, lng: -70.16 },
  { code: 'DZ', name: 'Algeria', lat: 28.03, lng: 1.66 },
  { code: 'EC', name: 'Ecuador', lat: -1.83, lng: -78.18 },
  { code: 'EE', name: 'Estonia', lat: 58.6, lng: 25.01 },
  { code: 'EG', name: 'Egypt', lat: 26.82, lng: 30.8 },
  { code: 'ER', name: 'Eritrea', lat: 15.18, lng: 39.78 },
  { code: 'ES', name: 'Spain', lat: 40.46, lng: -3.75 },
  { code: 'ET', name: 'Ethiopia', lat: 9.15, lng: 40.49 },
  { code: 'FI', name: 'Finland', lat: 61.92, lng: 25.75 },
  { code: 'FJ', name: 'Fiji', lat: -16.58, lng: 179.41 },
  { code: 'FR', name: 'France', lat: 46.23, lng: 2.21 },
  { code: 'GA', name: 'Gabon', lat: -0.8, lng: 11.61 },
  { code: 'GB', name: 'United Kingdom', lat: 55.38, lng: -3.44 },
  { code: 'GE', name: 'Georgia', lat: 42.32, lng: 43.36 },
  { code: 'GH', name: 'Ghana', lat: 7.95, lng: -1.02 },
  { code: 'GN', name: 'Guinea', lat: 9.95, lng: -9.7 },
  { code: 'GR', name: 'Greece', lat: 39.07, lng: 21.82 },
  { code: 'GT', name: 'Guatemala', lat: 15.78, lng: -90.23 },
  { code: 'GY', name: 'Guyana', lat: 4.86, lng: -58.93 },
  { code: 'HK', name: 'Hong Kong', lat: 22.32, lng: 114.17 },
  { code: 'HN', name: 'Honduras', lat: 15.2, lng: -86.24 },
  { code: 'HR', name: 'Croatia', lat: 45.1, lng: 15.2 },
  { code: 'HT', name: 'Haiti', lat: 18.97, lng: -72.29 },
  { code: 'HU', name: 'Hungary', lat: 47.16, lng: 19.5 },
  { code: 'ID', name: 'Indonesia', lat: -0.79, lng: 113.92 },
  { code: 'IE', name: 'Ireland', lat: 53.41, lng: -8.24 },
  { code: 'IL', name: 'Israel', lat: 31.05, lng: 34.85 },
  { code: 'IN', name: 'India', lat: 20.59, lng: 78.96 },
  { code: 'IQ', name: 'Iraq', lat: 33.22, lng: 43.68 },
  { code: 'IR', name: 'Iran', lat: 32.43, lng: 53.69 },
  { code: 'IS', name: 'Iceland', lat: 64.96, lng: -19.02 },
  { code: 'IT', name: 'Italy', lat: 41.87, lng: 12.57 },
  { code: 'JM', name: 'Jamaica', lat: 18.11, lng: -77.3 },
  { code: 'JO', name: 'Jordan', lat: 30.59, lng: 36.24 },
  { code: 'JP', name: 'Japan', lat: 36.2, lng: 138.25 },
  { code: 'KE', name: 'Kenya', lat: -0.02, lng: 37.91 },
  { code: 'KG', name: 'Kyrgyzstan', lat: 41.2, lng: 74.77 },
  { code: 'KH', name: 'Cambodia', lat: 12.57, lng: 104.99 },
  { code: 'KR', name: 'South Korea', lat: 35.91, lng: 127.77 },
  { code: 'KW', name: 'Kuwait', lat: 29.31, lng: 47.48 },
  { code: 'KZ', name: 'Kazakhstan', lat: 48.02, lng: 66.92 },
  { code: 'LA', name: 'Laos', lat: 19.86, lng: 102.5 },
  { code: 'LB', name: 'Lebanon', lat: 33.85, lng: 35.86 },
  { code: 'LK', name: 'Sri Lanka', lat: 7.87, lng: 80.77 },
  { code: 'LR', name: 'Liberia', lat: 6.43, lng: -9.43 },
  { code: 'LT', name: 'Lithuania', lat: 55.17, lng: 23.88 },
  { code: 'LU', name: 'Luxembourg', lat: 49.82, lng: 6.13 },
  { code: 'LV', name: 'Latvia', lat: 56.88, lng: 24.6 },
  { code: 'LY', name: 'Libya', lat: 26.34, lng: 17.23 },
  { code: 'MA', name: 'Morocco', lat: 31.79, lng: -7.09 },
  { code: 'MD', name: 'Moldova', lat: 47.41, lng: 28.37 },
  { code: 'ME', name: 'Montenegro', lat: 42.71, lng: 19.37 },
  { code: 'MG', name: 'Madagascar', lat: -18.77, lng: 46.87 },
  { code: 'MK', name: 'North Macedonia', lat: 41.61, lng: 21.75 },
  { code: 'ML', name: 'Mali', lat: 17.57, lng: -4 },
  { code: 'MM', name: 'Myanmar', lat: 21.91, lng: 95.96 },
  { code: 'MN', name: 'Mongolia', lat: 46.86, lng: 103.85 },
  { code: 'MT', name: 'Malta', lat: 35.94, lng: 14.38 },
  { code: 'MX', name: 'Mexico', lat: 23.63, lng: -102.55 },
  { code: 'MY', name: 'Malaysia', lat: 4.21, lng: 101.98 },
  { code: 'MZ', name: 'Mozambique', lat: -18.67, lng: 35.53 },
  { code: 'NA', name: 'Namibia', lat: -22.96, lng: 18.49 },
  { code: 'NG', name: 'Nigeria', lat: 9.08, lng: 8.68 },
  { code: 'NI', name: 'Nicaragua', lat: 12.87, lng: -85.21 },
  { code: 'NL', name: 'Netherlands', lat: 52.13, lng: 5.29 },
  { code: 'NO', name: 'Norway', lat: 60.47, lng: 8.47 },
  { code: 'NP', name: 'Nepal', lat: 28.39, lng: 84.12 },
  { code: 'NZ', name: 'New Zealand', lat: -40.9, lng: 174.89 },
  { code: 'OM', name: 'Oman', lat: 21.51, lng: 55.92 },
  { code: 'PA', name: 'Panama', lat: 8.54, lng: -80.78 },
  { code: 'PE', name: 'Peru', lat: -9.19, lng: -75.02 },
  { code: 'PH', name: 'Philippines', lat: 12.88, lng: 121.77 },
  { code: 'PK', name: 'Pakistan', lat: 30.38, lng: 69.35 },
  { code: 'PL', name: 'Poland', lat: 51.92, lng: 19.15 },
  { code: 'PT', name: 'Portugal', lat: 39.4, lng: -8.22 },
  { code: 'PY', name: 'Paraguay', lat: -23.44, lng: -58.44 },
  { code: 'QA', name: 'Qatar', lat: 25.35, lng: 51.18 },
  { code: 'RO', name: 'Romania', lat: 45.94, lng: 24.97 },
  { code: 'RS', name: 'Serbia', lat: 44.02, lng: 21.01 },
  { code: 'RU', name: 'Russia', lat: 61.52, lng: 105.32 },
  { code: 'RW', name: 'Rwanda', lat: -1.94, lng: 29.87 },
  { code: 'SA', name: 'Saudi Arabia', lat: 23.89, lng: 45.08 },
  { code: 'SD', name: 'Sudan', lat: 12.86, lng: 30.22 },
  { code: 'SE', name: 'Sweden', lat: 60.13, lng: 18.64 },
  { code: 'SG', name: 'Singapore', lat: 1.35, lng: 103.82 },
  { code: 'SI', name: 'Slovenia', lat: 46.15, lng: 14.99 },
  { code: 'SK', name: 'Slovakia', lat: 48.67, lng: 19.7 },
  { code: 'SN', name: 'Senegal', lat: 14.5, lng: -14.45 },
  { code: 'SO', name: 'Somalia', lat: 5.15, lng: 46.2 },
  { code: 'SR', name: 'Suriname', lat: 3.92, lng: -56.03 },
  { code: 'SV', name: 'El Salvador', lat: 13.79, lng: -88.9 },
  { code: 'SY', name: 'Syria', lat: 34.8, lng: 38.997 },
  { code: 'TD', name: 'Chad', lat: 15.45, lng: 18.73 },
  { code: 'TG', name: 'Togo', lat: 8.62, lng: 0.82 },
  { code: 'TH', name: 'Thailand', lat: 15.87, lng: 100.99 },
  { code: 'TJ', name: 'Tajikistan', lat: 38.86, lng: 71.28 },
  { code: 'TM', name: 'Turkmenistan', lat: 38.97, lng: 59.56 },
  { code: 'TN', name: 'Tunisia', lat: 33.89, lng: 9.54 },
  { code: 'TR', name: 'Turkey', lat: 38.96, lng: 35.24 },
  { code: 'TT', name: 'Trinidad and Tobago', lat: 10.69, lng: -61.22 },
  { code: 'TW', name: 'Taiwan', lat: 23.7, lng: 120.96 },
  { code: 'TZ', name: 'Tanzania', lat: -6.37, lng: 34.89 },
  { code: 'UA', name: 'Ukraine', lat: 48.38, lng: 31.17 },
  { code: 'UG', name: 'Uganda', lat: 1.37, lng: 32.29 },
  { code: 'US', name: 'United States', lat: 37.09, lng: -95.71 },
  { code: 'UY', name: 'Uruguay', lat: -32.52, lng: -55.77 },
  { code: 'UZ', name: 'Uzbekistan', lat: 41.38, lng: 64.59 },
  { code: 'VE', name: 'Venezuela', lat: 6.42, lng: -66.59 },
  { code: 'VN', name: 'Vietnam', lat: 14.06, lng: 108.28 },
  { code: 'YE', name: 'Yemen', lat: 15.55, lng: 48.52 },
  { code: 'ZA', name: 'South Africa', lat: -30.56, lng: 22.94 },
  { code: 'ZM', name: 'Zambia', lat: -13.13, lng: 27.85 },
  { code: 'ZW', name: 'Zimbabwe', lat: -19.02, lng: 29.15 },
];

// The literal above is maintained in ISO-code order; every dropdown wants names.
COUNTRIES.sort((a, b) => a.name.localeCompare(b.name));

export const COUNTRY_BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));
export const COUNTRY_BY_NAME = new Map(COUNTRIES.map((c) => [c.name.toLowerCase(), c]));

// Common exonyms / localized names / informal codes -> ISO alpha-2.
// Keeps imported contacts placeable when the source stores country in another language.
const ALIASES: Record<string, string> = {
  uk: 'GB', 'great britain': 'GB', 'united kingdom': 'GB', 'royaume-uni': 'GB',
  angleterre: 'GB', inglaterra: 'GB', grossbritannien: 'GB',
  usa: 'US', us: 'US', 'united states of america': 'US', 'etats-unis': 'US',
  'estados unidos': 'US', 'vereinigte staaten': 'US',
  deutschland: 'DE', allemagne: 'DE', alemania: 'DE', germania: 'DE', niemcy: 'DE',
  frankreich: 'FR', francia: 'FR', francja: 'FR',
  espagne: 'ES', espana: 'ES', spagna: 'ES', hiszpania: 'ES', spanien: 'ES',
  italie: 'IT', italia: 'IT', italien: 'IT', wlochy: 'IT',
  niederlande: 'NL', niederlanden: 'NL', 'pays-bas': 'NL', 'paesi bassi': 'NL',
  holland: 'NL', holanda: 'NL', holandia: 'NL',
  polska: 'PL', polonia: 'PL', pologne: 'PL', polen: 'PL',
  osterreich: 'AT', autriche: 'AT', austria: 'AT',
  schweiz: 'CH', suisse: 'CH', svizzera: 'CH', suiza: 'CH', szwajcaria: 'CH',
  belgien: 'BE', belgique: 'BE', belgio: 'BE', belgica: 'BE',
  namibie: 'NA', mongolei: 'MN', mongolie: 'MN', chine: 'CN', cina: 'CN', chili: 'CL',
  sudafrika: 'ZA', sudafrica: 'ZA', 'afrique du sud': 'ZA',
  griechenland: 'GR', grece: 'GR', grecia: 'GR',
  schweden: 'SE', suede: 'SE', norwegen: 'NO', norvege: 'NO',
  danemark: 'DK', irlande: 'IE', irland: 'IE',
};

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

export function findCountry(input?: string | null): Country | undefined {
  if (!input) return undefined;
  const s = input.trim();
  if (!s) return undefined;
  const lower = s.toLowerCase();
  const flat = stripAccents(lower);
  const aliasCode = ALIASES[lower] ?? ALIASES[flat];
  if (aliasCode) return COUNTRY_BY_CODE.get(aliasCode);
  if (s.length === 2) return COUNTRY_BY_CODE.get(s.toUpperCase());
  return COUNTRY_BY_NAME.get(lower) ?? COUNTRY_BY_NAME.get(flat);
}

// Name/alias match only (no 2-letter code path) - safe for scanning free text,
// where a 2-letter word like "in" must not match the IN country code.
export function findCountryByNameOnly(input?: string | null): Country | undefined {
  if (!input) return undefined;
  const lower = input.trim().toLowerCase();
  if (lower.length < 4) return undefined;
  const flat = stripAccents(lower);
  const aliasCode = ALIASES[lower] ?? ALIASES[flat];
  if (aliasCode) return COUNTRY_BY_CODE.get(aliasCode);
  return COUNTRY_BY_NAME.get(lower) ?? COUNTRY_BY_NAME.get(flat);
}
