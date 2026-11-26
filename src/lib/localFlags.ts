// Regional and city flags for countryballs, drawn from simple shapes so they
// stay legible on a 30px ball. Emblems (bears, eagles, seals) are reduced to a
// disc, a shield or a bar in the emblem's main colour; colours are approximate.
//
// Nothing here is fetched: a contact's region comes from their address region,
// their city name, or the nearest region centre to their coordinates.

export type EmblemKind =
  | 'disc' // round emblem (seal, bear, sun), below the eyes
  | 'shield' // coat of arms, below the eyes
  | 'star'
  | 'cross' // full-width cross (St George, Piedmont)
  | 'saltire' // diagonal cross
  | 'canton' // upper hoist rectangle; c2 draws a small cross in it
  | 'hoist' // vertical band at the hoist
  | 'triangle' // hoist triangle
  | 'bend' // diagonal band, upper hoist to lower fly
  | 'diamond'
  | 'bar' // narrow upright (crozier, key, sword)
  | 'quarter' // c1 upper-left and lower-right, c2 the other two
  | 'lozenge'; // Bavarian check

export interface Emblem {
  k: EmblemKind;
  c: string;
  c2?: string;
  /** Put a star or disc on the hoist instead of the middle. */
  hoist?: boolean;
}

export interface FlagArt {
  /** Field colours: one colour, or stripes. */
  s: string[];
  /** h = horizontal stripes (top first), v = vertical (hoist first), d = split upper-hoist to lower-fly, d2 = lower-hoist to upper-fly. */
  d?: 'h' | 'v' | 'd' | 'd2';
  /** Relative stripe sizes, when unequal. */
  w?: number[];
  e?: Emblem[];
}

export interface LocalFlag {
  /** 'DE-BY' for regions, 'city:munich' for cities. */
  id: string;
  /** ISO alpha-2 of the country. */
  cc: string;
  name: string;
  kind: 'region' | 'city';
  art: FlagArt;
  /** Region centre [lng, lat] and a size factor (bigger regions win ties further out). */
  at?: [number, number];
  r?: number;
  /** Other names an address may use for the region (local language, postal code). */
  alt?: string[];
}

const K = '#1b1b1f', W = '#ffffff', R = '#d7263d', Y = '#ffcf1f', B = '#1f5aa6', LB = '#4aa3df',
  G = '#1e8a4c', N = '#1c2f6b', CR = '#a01e3c', BR = '#7a4a24', GR = '#9aa0a6', OR = '#f07c1e',
  BU = '#e6c68b', PU = '#6b2c91';

const h = (s: string[], e?: Emblem[], w?: number[]): FlagArt => ({ s, d: 'h', e, w });
const v = (s: string[], e?: Emblem[], w?: number[]): FlagArt => ({ s, d: 'v', e, w });
const solid = (c: string, e?: Emblem[]): FlagArt => ({ s: [c], e });
const em = (k: EmblemKind, c: string, c2?: string, hoist?: boolean): Emblem => ({ k, c, c2, hoist });
const SENYERA = [Y, R, Y, R, Y, R, Y, R, Y];

type Row = [code: string, name: string, lng: number, lat: number, art: FlagArt, r?: number, alt?: string[]];

function regions(cc: string, rows: Row[]): LocalFlag[] {
  return rows.map(([code, name, lng, lat, art, r, alt]) => ({
    id: `${cc}-${code}`,
    cc,
    name,
    kind: 'region',
    art,
    at: [lng, lat],
    r,
    alt,
  }));
}

const REGIONS: LocalFlag[] = [
  ...regions('DE', [
    ['BW', 'Baden-Württemberg', 9.0, 48.6, h([K, Y])],
    ['BY', 'Bavaria', 11.4, 48.9, solid(W, [em('lozenge', LB)]), 1.2, ['Bayern']],
    ['BE', 'Berlin', 13.4, 52.52, h([R, W, R], [em('disc', K)], [1, 3, 1]), 0.3],
    ['BB', 'Brandenburg', 13.2, 52.2, h([R, W], [em('shield', R, W)])],
    ['HB', 'Bremen', 8.8, 53.08, h([R, W, R, W, R, W, R, W]), 0.3],
    ['HH', 'Hamburg', 10.0, 53.55, solid(R, [em('shield', W)]), 0.35],
    ['HE', 'Hesse', 9.0, 50.6, h([R, W]), 1, ['Hessen']],
    ['MV', 'Mecklenburg-Vorpommern', 12.4, 53.8, h([B, W, Y, W, R], undefined, [4, 3, 1, 3, 4]), 1, ['Mecklenburg-Western Pomerania']],
    ['NI', 'Lower Saxony', 9.3, 52.7, h([K, R, Y], [em('shield', R, W)]), 1.1, ['Niedersachsen']],
    ['NW', 'North Rhine-Westphalia', 7.5, 51.5, h([G, W, R], [em('shield', W)]), 1, ['Nordrhein-Westfalen', 'NRW']],
    ['RP', 'Rhineland-Palatinate', 7.4, 49.9, h([K, R, Y], [em('shield', W, R)]), 0.9, ['Rheinland-Pfalz']],
    ['SL', 'Saarland', 6.95, 49.4, h([K, R, Y], [em('shield', B, W)]), 0.5],
    ['SN', 'Saxony', 13.2, 51.0, h([W, G]), 1, ['Sachsen']],
    ['ST', 'Saxony-Anhalt', 11.7, 52.0, h([Y, K], [em('shield', W)]), 1, ['Sachsen-Anhalt']],
    ['SH', 'Schleswig-Holstein', 9.8, 54.2, h([B, W, R])],
    ['TH', 'Thuringia', 11.0, 50.9, h([W, R]), 0.9, ['Thüringen']],
  ]),
  ...regions('AT', [
    ['9', 'Vienna', 16.37, 48.21, h([R, W]), 0.3, ['Wien']],
    ['3', 'Lower Austria', 15.6, 48.3, h([B, Y]), 1, ['Niederösterreich']],
    ['4', 'Upper Austria', 14.0, 48.2, h([W, R]), 1, ['Oberösterreich']],
    ['5', 'Salzburg', 13.2, 47.4, h([R, W]), 0.8],
    ['6', 'Styria', 15.0, 47.25, h([W, G]), 1.1, ['Steiermark']],
    ['2', 'Carinthia', 13.9, 46.75, h([Y, R, W]), 0.9, ['Kärnten']],
    ['7', 'Tyrol', 11.4, 47.2, h([W, R]), 1, ['Tirol']],
    ['8', 'Vorarlberg', 9.85, 47.25, h([R, W]), 0.5],
    ['1', 'Burgenland', 16.5, 47.5, h([R, Y]), 0.6],
  ]),
  ...regions('CH', [
    ['ZH', 'Zürich', 8.65, 47.42, { s: [W, B], d: 'd' }, 1, ['Zurich']],
    ['BE', 'Bern', 7.6, 46.8, solid(R, [em('bend', Y), em('disc', K)]), 1.3, ['Berne']],
    ['LU', 'Lucerne', 8.1, 47.05, h([B, W]), 1, ['Luzern']],
    ['UR', 'Uri', 8.63, 46.77, solid(Y, [em('disc', K)])],
    ['SZ', 'Schwyz', 8.75, 47.05, solid(R, [em('canton', R, W)])],
    ['OW', 'Obwalden', 8.2, 46.85, h([R, W]), 0.6],
    ['NW', 'Nidwalden', 8.4, 46.93, solid(R, [em('bar', W)]), 0.5],
    ['GL', 'Glarus', 9.05, 46.98, solid(R, [em('shield', K, W)]), 0.8],
    ['ZG', 'Zug', 8.53, 47.16, h([W, B, W]), 0.5],
    ['FR', 'Fribourg', 7.1, 46.7, h([K, W]), 1, ['Freiburg']],
    ['SO', 'Solothurn', 7.6, 47.3, h([R, W]), 0.8],
    ['BS', 'Basel-Stadt', 7.59, 47.56, solid(W, [em('bar', K)]), 0.25, ['Basel-City']],
    ['BL', 'Basel-Landschaft', 7.7, 47.45, solid(W, [em('bar', R)]), 0.7],
    ['SH', 'Schaffhausen', 8.6, 47.7, solid(Y, [em('shield', K, Y)]), 0.6],
    ['AR', 'Appenzell Ausserrhoden', 9.35, 47.37, solid(W, [em('disc', K), em('star', K, undefined, true)]), 0.5],
    ['AI', 'Appenzell Innerrhoden', 9.42, 47.31, solid(W, [em('disc', K)]), 0.4],
    ['SG', 'St. Gallen', 9.25, 47.2, solid(G, [em('bar', W)]), 1.1, ['Sankt Gallen', 'St Gallen']],
    ['GR', 'Graubünden', 9.6, 46.65, v([GR, Y, B]), 1.6, ['Grisons']],
    ['AG', 'Aargau', 8.15, 47.4, v([K, B], [em('star', W)])],
    ['TG', 'Thurgau', 9.1, 47.55, { s: [W, G], d: 'd2', e: [em('disc', Y)] }, 0.9],
    ['TI', 'Ticino', 8.85, 46.3, h([R, B]), 1.2, ['Tessin']],
    ['VD', 'Vaud', 6.6, 46.55, h([W, G]), 1.2, ['Waadt']],
    ['VS', 'Valais', 7.6, 46.2, v([W, R], [em('star', R, undefined, true), em('star', W)]), 1.4, ['Wallis']],
    ['NE', 'Neuchâtel', 6.85, 47.0, v([G, W, R], [em('canton', G, W)]), 0.8],
    ['GE', 'Geneva', 6.14, 46.2, v([Y, R]), 0.5, ['Genève', 'Genf']],
    ['JU', 'Jura', 7.15, 47.35, h([W, R, W, R, W, R, W], [em('hoist', W), em('bar', R)]), 0.8],
  ]),
  ...regions('GB', [
    ['ENG', 'England', -1.5, 52.6, solid(W, [em('cross', R)]), 3],
    ['SCT', 'Scotland', -4.2, 56.8, solid(B, [em('saltire', W)]), 2],
    ['WLS', 'Wales', -3.7, 52.3, h([W, G], [em('disc', R)]), 1, ['Cymru']],
    ['NIR', 'Northern Ireland', -6.7, 54.6, solid(W, [em('saltire', R)]), 0.8],
  ]),
  ...regions('ES', [
    ['AN', 'Andalusia', -4.6, 37.4, h([G, W, G]), 1.5, ['Andalucía']],
    ['AR', 'Aragon', -0.7, 41.5, h(SENYERA, [em('shield', R, Y)]), 1.2, ['Aragón']],
    ['AS', 'Asturias', -6.0, 43.3, solid(B, [em('cross', Y)]), 0.6],
    ['IB', 'Balearic Islands', 2.9, 39.6, h(SENYERA, [em('canton', PU)]), 0.6, ['Illes Balears', 'Islas Baleares']],
    ['CN', 'Canary Islands', -15.5, 28.3, v([W, B, Y]), 1, ['Canarias']],
    ['CB', 'Cantabria', -4.0, 43.2, h([W, R]), 0.5],
    ['CL', 'Castile and León', -4.8, 41.8, solid(CR, [em('quarter', CR, W)]), 1.6, ['Castilla y León']],
    ['CM', 'Castile-La Mancha', -3.0, 39.5, v([CR, W]), 1.5, ['Castilla-La Mancha']],
    ['CT', 'Catalonia', 1.6, 41.8, h(SENYERA), 1, ['Catalunya', 'Cataluña']],
    ['EX', 'Extremadura', -6.1, 39.2, h([G, W, K]), 1.1],
    ['GA', 'Galicia', -7.9, 42.8, solid(W, [em('bend', LB)]), 1],
    ['MD', 'Community of Madrid', -3.7, 40.45, solid(R, [em('star', W)]), 0.6, ['Madrid', 'Comunidad de Madrid']],
    ['MC', 'Region of Murcia', -1.5, 38.0, solid(CR, [em('canton', Y)]), 0.6, ['Murcia']],
    ['NC', 'Navarre', -1.65, 42.7, solid(R, [em('disc', Y)]), 0.6, ['Navarra']],
    ['PV', 'Basque Country', -2.6, 43.05, solid(R, [em('saltire', G), em('cross', W)]), 0.5, ['País Vasco', 'Euskadi']],
    ['RI', 'La Rioja', -2.5, 42.3, h([R, W, G, Y]), 0.4, ['Rioja']],
    ['VC', 'Valencian Community', -0.55, 39.4, h(SENYERA, [em('hoist', B)]), 1, ['Comunitat Valenciana', 'Comunidad Valenciana']],
  ]),
  ...regions('IT', [
    ['65', 'Abruzzo', 13.85, 42.25, solid(B, [em('shield', W, G)])],
    ['77', 'Basilicata', 16.1, 40.5, solid(LB, [em('shield', W)])],
    ['78', 'Calabria', 16.35, 39.05, solid(B, [em('shield', W)])],
    ['72', 'Campania', 14.75, 40.85, solid(W, [em('bend', R)])],
    ['45', 'Emilia-Romagna', 11.0, 44.5, solid(W, [em('shield', G)]), 1.2],
    ['36', 'Friuli-Venezia Giulia', 13.1, 46.1, solid(LB, [em('shield', Y)]), 0.8],
    ['62', 'Lazio', 12.75, 41.9, solid(B, [em('shield', W)]), 1.2, ['Latium']],
    ['42', 'Liguria', 8.7, 44.3, solid(W, [em('cross', R)]), 0.7],
    ['25', 'Lombardy', 9.8, 45.6, solid(W, [em('disc', G)]), 1.2, ['Lombardia']],
    ['57', 'Marche', 13.1, 43.3, solid(W, [em('shield', G)]), 0.9],
    ['67', 'Molise', 14.6, 41.65, solid(R, [em('shield', W)]), 0.6],
    ['21', 'Piedmont', 7.9, 45.05, solid(R, [em('cross', W)]), 1.2, ['Piemonte']],
    ['75', 'Apulia', 16.6, 41.0, solid(W, [em('shield', R)]), 1.2, ['Puglia']],
    ['88', 'Sardinia', 9.0, 40.1, solid(W, [em('cross', R)]), 1.2, ['Sardegna']],
    ['82', 'Sicily', 14.1, 37.6, { s: [R, Y], d: 'd2', e: [em('disc', Y, R)] }, 1.3, ['Sicilia']],
    ['52', 'Tuscany', 11.1, 43.4, solid(W, [em('disc', R)]), 1.2, ['Toscana']],
    ['32', 'Trentino-South Tyrol', 11.3, 46.4, solid(W, [em('quarter', R, W)]), 1, ['Trentino-Alto Adige', 'Südtirol']],
    ['55', 'Umbria', 12.5, 42.95, solid(LB, [em('shield', R)]), 0.8],
    ['23', "Aosta Valley", 7.4, 45.75, v([K, R]), 0.5, ["Valle d'Aosta"]],
    ['34', 'Veneto', 11.9, 45.6, solid(CR, [em('shield', Y)]), 1.1],
  ]),
  ...regions('PL', [
    ['02', 'Lower Silesia', 16.4, 51.1, h([Y, W], [em('shield', Y, K)]), 1, ['Dolnośląskie', 'Lower Silesian']],
    ['04', 'Kuyavia-Pomerania', 18.5, 53.1, h([W, R], [em('shield', K)]), 1, ['Kujawsko-Pomorskie', 'Kuyavian-Pomeranian']],
    ['06', 'Lublin', 22.9, 51.2, h([W, R, Y]), 1.1, ['Lubelskie']],
    ['08', 'Lubusz', 15.3, 52.2, h([Y, G, R]), 0.9, ['Lubuskie']],
    ['10', 'Łódź', 19.4, 51.6, h([R, Y]), 0.9, ['Łódzkie', 'Lodzkie']],
    ['12', 'Lesser Poland', 20.3, 49.85, h([W, Y, B]), 0.9, ['Małopolskie', 'Malopolskie']],
    ['14', 'Masovia', 21.0, 52.3, solid(R, [em('shield', W)]), 1.2, ['Mazowieckie', 'Masovian']],
    ['16', 'Opole', 17.9, 50.6, h([Y, B]), 0.7, ['Opolskie']],
    ['18', 'Subcarpathia', 22.2, 49.9, h([Y, B, R]), 0.9, ['Podkarpackie', 'Subcarpathian']],
    ['20', 'Podlaskie', 22.9, 53.3, h([W, R], [em('shield', R)]), 1],
    ['22', 'Pomerania', 18.0, 54.2, solid(Y, [em('shield', K)]), 0.9, ['Pomorskie', 'Pomeranian']],
    ['24', 'Silesia', 19.0, 50.3, h([Y, B]), 0.8, ['Śląskie', 'Slaskie', 'Silesian']],
    ['26', 'Holy Cross', 20.75, 50.8, h([Y, R, B]), 0.7, ['Świętokrzyskie', 'Swietokrzyskie']],
    ['28', 'Warmia-Masuria', 20.8, 53.85, h([W, R], [em('shield', W)]), 1.1, ['Warmińsko-Mazurskie', 'Warmian-Masurian']],
    ['30', 'Greater Poland', 17.2, 52.3, solid(R, [em('shield', W, Y)]), 1.2, ['Wielkopolskie']],
    ['32', 'West Pomerania', 15.3, 53.5, solid(W, [em('shield', R)]), 1, ['Zachodniopomorskie', 'West Pomeranian']],
  ]),
  ...regions('US', [
    ['AL', 'Alabama', -86.8, 32.8, solid(W, [em('saltire', R)])],
    ['AK', 'Alaska', -152, 64, solid(N, [em('star', Y)]), 3],
    ['AZ', 'Arizona', -111.7, 34.3, h([R, Y, B], [em('star', '#c4703a')])],
    ['AR', 'Arkansas', -92.4, 34.9, solid(R, [em('diamond', B, W)])],
    ['CA', 'California', -119.5, 37.2, h([W, R], [em('disc', BR)], [3, 1]), 1.6],
    ['CO', 'Colorado', -105.5, 39.0, h([B, W, B], [em('disc', Y, R)])],
    ['CT', 'Connecticut', -72.7, 41.6, solid(B, [em('shield', W)]), 0.4],
    ['DE', 'Delaware', -75.5, 39.0, solid(LB, [em('diamond', BU)]), 0.3],
    ['FL', 'Florida', -81.7, 28.6, solid(W, [em('saltire', R), em('disc', Y)]), 1.2],
    ['GA', 'Georgia', -83.4, 32.7, h([R, W, R], [em('canton', N)])],
    ['HI', 'Hawaii', -157, 20.5, h([W, R, B, W, R, B, W, R], [em('canton', N, R)])],
    ['ID', 'Idaho', -114.6, 44.4, solid(N, [em('disc', W)])],
    ['IL', 'Illinois', -89.2, 40.0, solid(W, [em('disc', BR)])],
    ['IN', 'Indiana', -86.3, 39.9, solid(N, [em('star', Y)])],
    ['IA', 'Iowa', -93.5, 42.1, v([B, W, R], [em('disc', B)])],
    ['KS', 'Kansas', -98.4, 38.5, solid(N, [em('disc', Y)])],
    ['KY', 'Kentucky', -85.3, 37.5, solid(N, [em('disc', W)])],
    ['LA', 'Louisiana', -92.0, 31.0, solid(N, [em('disc', W)])],
    ['ME', 'Maine', -69.2, 45.4, solid(N, [em('shield', W)])],
    ['MD', 'Maryland', -76.8, 39.0, solid(Y, [em('quarter', Y, R)]), 0.5],
    ['MA', 'Massachusetts', -71.8, 42.3, solid(W, [em('shield', B)]), 0.5],
    ['MI', 'Michigan', -85.4, 44.3, solid(N, [em('shield', W)])],
    ['MN', 'Minnesota', -94.3, 46.3, v([N, LB], [em('star', W, undefined, true)], [1, 2])],
    ['MS', 'Mississippi', -89.7, 32.7, v([R, B, R], [em('disc', W)], [1, 4, 1])],
    ['MO', 'Missouri', -92.5, 38.4, h([R, W, B], [em('disc', W)])],
    ['MT', 'Montana', -109.6, 47.0, solid(N, [em('disc', Y)]), 1.4],
    ['NE', 'Nebraska', -99.8, 41.5, solid(N, [em('disc', Y)])],
    ['NV', 'Nevada', -116.6, 39.3, solid(B, [em('star', W, undefined, true)])],
    ['NH', 'New Hampshire', -71.6, 43.7, solid(N, [em('disc', Y)]), 0.5],
    ['NJ', 'New Jersey', -74.6, 40.2, solid(BU, [em('shield', B)]), 0.5],
    ['NM', 'New Mexico', -106.1, 34.4, solid(Y, [em('disc', R)])],
    ['NY', 'New York', -75.5, 42.9, solid(N, [em('shield', LB)])],
    ['NC', 'North Carolina', -79.4, 35.5, h([R, W], [em('hoist', B)])],
    ['ND', 'North Dakota', -100.5, 47.5, solid(N, [em('disc', B, Y)])],
    ['OH', 'Ohio', -82.8, 40.3, h([R, W, R, W, R], [em('triangle', N)])],
    ['OK', 'Oklahoma', -97.5, 35.6, solid(LB, [em('shield', BU)])],
    ['OR', 'Oregon', -120.5, 44.0, solid(N, [em('disc', Y)])],
    ['PA', 'Pennsylvania', -77.6, 40.9, solid(N, [em('shield', Y)])],
    ['RI', 'Rhode Island', -71.5, 41.7, solid(W, [em('disc', Y)]), 0.2],
    ['SC', 'South Carolina', -80.9, 33.9, solid(N, [em('bar', W), em('star', W, undefined, true)])],
    ['SD', 'South Dakota', -100.2, 44.4, solid(LB, [em('disc', Y)])],
    ['TN', 'Tennessee', -86.3, 35.8, solid(R, [em('disc', N, W)])],
    ['TX', 'Texas', -99.3, 31.4, h([W, R], [em('hoist', N), em('star', W, undefined, true)]), 2],
    ['UT', 'Utah', -111.7, 39.3, h([N, W, R], [em('disc', Y)])],
    ['VT', 'Vermont', -72.7, 44.0, solid(N, [em('shield', G)]), 0.4],
    ['VA', 'Virginia', -78.8, 37.5, solid(N, [em('disc', W)])],
    ['WA', 'Washington', -120.5, 47.4, solid(G, [em('disc', Y)])],
    ['WV', 'West Virginia', -80.6, 38.6, solid(W, [em('disc', B)]), 0.6],
    ['WI', 'Wisconsin', -89.8, 44.6, solid(N, [em('shield', Y)])],
    ['WY', 'Wyoming', -107.5, 43.0, solid(B, [em('disc', W, R)])],
  ]),
];

const CITY_FLAGS: LocalFlag[] = [
  ['munich', 'DE', 'Munich', h([K, Y])],
  ['cologne', 'DE', 'Cologne', h([R, W])],
  ['frankfurt', 'DE', 'Frankfurt', h([R, W], [em('shield', W, R)])],
  ['warsaw', 'PL', 'Warsaw', h([Y, R])],
  ['krakow', 'PL', 'Kraków', h([W, B])],
  ['gdansk', 'PL', 'Gdańsk', solid(R, [em('bar', W)])],
  ['wroclaw', 'PL', 'Wrocław', h([R, Y])],
  ['lodz', 'PL', 'Łódź', h([Y, R])],
  ['madrid', 'ES', 'Madrid', solid(CR, [em('shield', W)])],
  ['barcelona', 'ES', 'Barcelona', h(SENYERA, [em('canton', W, R)])],
  ['rome', 'IT', 'Rome', v(['#f0b323', '#8b1f33'])],
  ['milan', 'IT', 'Milan', solid(W, [em('cross', R)])],
  ['florence', 'IT', 'Florence', solid(W, [em('disc', R)])],
  ['naples', 'IT', 'Naples', h([Y, R])],
  ['turin', 'IT', 'Turin', solid(B, [em('disc', Y)])],
  ['london', 'GB', 'London', solid(W, [em('cross', R), em('canton', R)])],
  ['nyc', 'US', 'New York City', v([B, W, OR], [em('disc', B)])],
  ['chicago', 'US', 'Chicago', h([W, LB, W, LB, W], [em('star', R)], [3, 1, 2, 1, 3])],
  ['paris', 'FR', 'Paris', v([B, R])],
  ['amsterdam', 'NL', 'Amsterdam', h([R, K, R], [em('saltire', W)])],
].map(([key, cc, name, art]) => ({ id: `city:${key}`, cc, name, kind: 'city', art }) as LocalFlag);

export const LOCAL_FLAGS = new Map<string, LocalFlag>([...REGIONS, ...CITY_FLAGS].map((f) => [f.id, f]));

// City names (any spelling an address might use) to their region and, where the
// city has a well-known flag of its own, that flag. Berlin, Hamburg, Bremen,
// Vienna, Zurich, Geneva, Basel and Bern are city-states or share the canton's
// flag, so their region flag is the city flag.
const CITY_ROWS: [names: string[], region: string, flag?: string][] = [
  [['berlin'], 'DE-BE', 'DE-BE'],
  [['hamburg'], 'DE-HH', 'DE-HH'],
  [['bremen', 'bremerhaven'], 'DE-HB', 'DE-HB'],
  [['munich', 'munchen', 'muenchen'], 'DE-BY', 'city:munich'],
  [['nuremberg', 'nurnberg', 'nuernberg', 'augsburg', 'regensburg', 'wurzburg'], 'DE-BY'],
  [['cologne', 'koln', 'koeln'], 'DE-NW', 'city:cologne'],
  [['dusseldorf', 'duesseldorf', 'dortmund', 'essen', 'bonn', 'munster', 'duisburg', 'bochum'], 'DE-NW'],
  [['frankfurt', 'frankfurt am main'], 'DE-HE', 'city:frankfurt'],
  [['wiesbaden', 'kassel', 'darmstadt'], 'DE-HE'],
  [['stuttgart', 'karlsruhe', 'mannheim', 'freiburg', 'heidelberg', 'ulm'], 'DE-BW'],
  [['dresden', 'leipzig', 'chemnitz'], 'DE-SN'],
  [['hanover', 'hannover', 'braunschweig', 'gottingen', 'osnabruck', 'oldenburg', 'wolfsburg'], 'DE-NI'],
  [['mainz', 'koblenz', 'trier', 'ludwigshafen'], 'DE-RP'],
  [['saarbrucken', 'saarbruecken'], 'DE-SL'],
  [['kiel', 'lubeck', 'flensburg'], 'DE-SH'],
  [['erfurt', 'jena', 'weimar'], 'DE-TH'],
  [['magdeburg', 'halle'], 'DE-ST'],
  [['potsdam', 'cottbus'], 'DE-BB'],
  [['schwerin', 'rostock', 'greifswald'], 'DE-MV'],
  [['vienna', 'wien'], 'AT-9', 'AT-9'],
  [['graz'], 'AT-6'], [['linz'], 'AT-4'], [['salzburg'], 'AT-5'], [['innsbruck'], 'AT-7'],
  [['klagenfurt'], 'AT-2'], [['bregenz', 'dornbirn'], 'AT-8'], [['st. polten', 'st polten', 'sankt polten'], 'AT-3'], [['eisenstadt'], 'AT-1'],
  [['zurich', 'zuerich', 'winterthur'], 'CH-ZH', 'CH-ZH'],
  [['geneva', 'geneve', 'genf'], 'CH-GE', 'CH-GE'],
  [['basel', 'bale'], 'CH-BS', 'CH-BS'],
  [['bern', 'berne'], 'CH-BE', 'CH-BE'],
  [['lausanne'], 'CH-VD'], [['lucerne', 'luzern'], 'CH-LU'], [['lugano', 'bellinzona'], 'CH-TI'], [['st. gallen', 'st gallen'], 'CH-SG'], [['zug'], 'CH-ZG'],
  [['london'], 'GB-ENG', 'city:london'],
  [['manchester', 'birmingham', 'liverpool', 'leeds', 'bristol', 'oxford', 'cambridge', 'newcastle', 'sheffield'], 'GB-ENG'],
  [['edinburgh', 'glasgow', 'aberdeen', 'dundee'], 'GB-SCT'],
  [['cardiff', 'swansea'], 'GB-WLS'],
  [['belfast', 'derry'], 'GB-NIR'],
  [['madrid'], 'ES-MD', 'city:madrid'],
  [['barcelona'], 'ES-CT', 'city:barcelona'],
  [['girona', 'tarragona', 'lleida'], 'ES-CT'],
  [['seville', 'sevilla', 'malaga', 'granada', 'cordoba', 'cadiz'], 'ES-AN'],
  [['valencia', 'alicante', 'castellon'], 'ES-VC'],
  [['bilbao', 'san sebastian', 'donostia', 'vitoria', 'vitoria-gasteiz'], 'ES-PV'],
  [['zaragoza'], 'ES-AR'], [['palma', 'palma de mallorca', 'ibiza'], 'ES-IB'], [['las palmas', 'santa cruz de tenerife'], 'ES-CN'],
  [['santiago de compostela', 'vigo', 'a coruna'], 'ES-GA'], [['valladolid', 'salamanca', 'leon', 'burgos'], 'ES-CL'], [['murcia', 'cartagena'], 'ES-MC'],
  [['pamplona'], 'ES-NC'], [['oviedo', 'gijon'], 'ES-AS'], [['santander'], 'ES-CB'], [['toledo'], 'ES-CM'], [['logrono'], 'ES-RI'], [['merida', 'badajoz'], 'ES-EX'],
  [['rome', 'roma'], 'IT-62', 'city:rome'],
  [['milan', 'milano'], 'IT-25', 'city:milan'],
  [['florence', 'firenze'], 'IT-52', 'city:florence'],
  [['naples', 'napoli'], 'IT-72', 'city:naples'],
  [['turin', 'torino'], 'IT-21', 'city:turin'],
  [['venice', 'venezia', 'verona', 'padua', 'padova'], 'IT-34'], [['bologna'], 'IT-45'], [['genoa', 'genova'], 'IT-42'],
  [['palermo', 'catania'], 'IT-82'], [['bari'], 'IT-75'], [['cagliari'], 'IT-88'], [['trieste'], 'IT-36'], [['trento', 'bolzano'], 'IT-32'],
  [['warsaw', 'warszawa'], 'PL-14', 'city:warsaw'],
  [['krakow', 'cracow'], 'PL-12', 'city:krakow'],
  [['gdansk', 'gdynia', 'sopot'], 'PL-22', 'city:gdansk'],
  [['wroclaw'], 'PL-02', 'city:wroclaw'],
  [['lodz'], 'PL-10', 'city:lodz'],
  [['poznan'], 'PL-30'], [['katowice', 'gliwice'], 'PL-24'], [['lublin'], 'PL-06'], [['szczecin'], 'PL-32'], [['bydgoszcz', 'torun'], 'PL-04'],
  [['bialystok'], 'PL-20'], [['rzeszow'], 'PL-18'], [['olsztyn'], 'PL-28'], [['kielce'], 'PL-26'], [['opole'], 'PL-16'], [['zielona gora', 'gorzow wielkopolski'], 'PL-08'],
  [['new york', 'new york city', 'nyc', 'brooklyn', 'manhattan', 'queens'], 'US-NY', 'city:nyc'],
  [['chicago'], 'US-IL', 'city:chicago'],
  [['los angeles', 'san francisco', 'san diego', 'san jose', 'oakland'], 'US-CA'],
  [['seattle'], 'US-WA'], [['boston'], 'US-MA'], [['austin', 'houston', 'dallas'], 'US-TX'], [['miami'], 'US-FL'], [['philadelphia'], 'US-PA'],
  [['paris'], '', 'city:paris'],
  [['amsterdam'], '', 'city:amsterdam'],
];

function norm(s: string) {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/ł/g, 'l').replace(/ß/g, 'ss').toLowerCase().trim();
}

// Centres of the cities with their own flag, so a contact with coordinates but
// no city name still gets the city flag (within ~20 km).
const CITY_AT: Record<string, [number, number]> = {
  'city:munich': [11.58, 48.14], 'city:cologne': [6.96, 50.94], 'city:frankfurt': [8.68, 50.11],
  'city:warsaw': [21.01, 52.23], 'city:krakow': [19.94, 50.06], 'city:gdansk': [18.65, 54.35],
  'city:wroclaw': [17.04, 51.11], 'city:lodz': [19.46, 51.76], 'city:madrid': [-3.7, 40.42],
  'city:barcelona': [2.17, 41.39], 'city:rome': [12.5, 41.9], 'city:milan': [9.19, 45.46],
  'city:florence': [11.26, 43.77], 'city:naples': [14.27, 40.85], 'city:turin': [7.69, 45.07],
  'city:london': [-0.12, 51.51], 'city:nyc': [-73.94, 40.71], 'city:chicago': [-87.63, 41.88],
  'city:paris': [2.35, 48.86], 'city:amsterdam': [4.9, 52.37],
};
const CITY_REGION = new Map<string, string | null>();

const CITY_INDEX = new Map<string, { region: string | null; flag: string | null; cc: string }>();
for (const [names, region, flag] of CITY_ROWS) {
  const cc = region ? region.slice(0, 2) : (flag && LOCAL_FLAGS.get(flag)?.cc) || '';
  for (const n of names) CITY_INDEX.set(`${cc}|${norm(n)}`, { region: region || null, flag: flag ?? null, cc });
  if (flag?.startsWith('city:') && !CITY_REGION.has(flag)) CITY_REGION.set(flag, region || null);
}

function nearFlaggedCity(cc: string, lng: number, lat: number) {
  for (const [id, [x, y]] of Object.entries(CITY_AT)) {
    if (LOCAL_FLAGS.get(id)?.cc !== cc) continue;
    const km = Math.hypot((x - lng) * 111 * Math.cos((lat * Math.PI) / 180), (y - lat) * 111);
    if (km < 20) return { region: CITY_REGION.get(id) ?? null, flag: id, cc };
  }
  return undefined;
}

const REGION_NAMES = new Map<string, string>();
for (const r of REGIONS) {
  for (const n of [r.name, ...(r.alt ?? [])]) REGION_NAMES.set(`${r.cc}|${norm(n)}`, r.id);
  REGION_NAMES.set(`${r.cc}|${norm(r.id.slice(3))}`, r.id);
}
const REGION_WORDS = /\b(state|province|voivodeship|wojewodztwo|canton|kanton|region|land|bundesland|comunidad autonoma)\b/g;

const COUNTRIES_WITH_REGIONS = new Set(REGIONS.map((r) => r.cc));

export interface Place {
  country: string | null;
  city?: string | null;
  /** Free-text region from an address ("Bayern", "CA", "Mazowieckie"). */
  region?: string | null;
  lng?: number | null;
  lat?: number | null;
}

export interface LocalMatch {
  region: LocalFlag | null;
  /** A city flag, when the city has one that differs from the region's. */
  city: LocalFlag | null;
}

function nearestRegion(cc: string, lng: number, lat: number): LocalFlag | null {
  let best: LocalFlag | null = null;
  let bestScore = Infinity;
  for (const r of REGIONS) {
    if (r.cc !== cc || !r.at) continue;
    const dx = (r.at[0] - lng) * Math.cos((lat * Math.PI) / 180);
    const dy = r.at[1] - lat;
    const score = Math.hypot(dx, dy) / (r.r ?? 1);
    if (score < bestScore) {
      bestScore = score;
      best = r;
    }
  }
  // Further than ~8 region-sizes away: the coordinates are not in this country.
  return bestScore < 8 ? best : null;
}

/** The region and city flags for a place; either may be null. */
export function matchLocal(p: Place): LocalMatch {
  const cc = p.country?.toUpperCase() ?? '';
  if (!cc) return { region: null, city: null };
  const named = p.city ? CITY_INDEX.get(`${cc}|${norm(p.city)}`) : undefined;
  const city = named ?? (p.lng != null && p.lat != null ? nearFlaggedCity(cc, p.lng, p.lat) : undefined);
  let regionId = city?.region ?? null;
  if (!regionId && p.region) {
    const key = norm(p.region).replace(REGION_WORDS, '').replace(/\s+/g, ' ').trim();
    regionId = REGION_NAMES.get(`${cc}|${key}`) ?? null;
  }
  let region = regionId ? LOCAL_FLAGS.get(regionId) ?? null : null;
  if (!region && COUNTRIES_WITH_REGIONS.has(cc) && p.lng != null && p.lat != null) region = nearestRegion(cc, p.lng, p.lat);
  const cityFlag = city?.flag && city.flag !== region?.id ? LOCAL_FLAGS.get(city.flag) ?? null : null;
  return { region, city: cityFlag };
}

/** The one flag to draw for a place: its city's own flag if it has one, else its region's. */
export function localFlagId(p: Place): string | null {
  const m = matchLocal(p);
  return m.city?.id ?? m.region?.id ?? null;
}
