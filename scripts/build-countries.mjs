// Generates public/countries.min.json: country outlines for the choropleth map
// view, keyed by ISO 3166-1 alpha-2 so they join straight onto
// contacts.current_country.
//
// Run: node scripts/build-countries.mjs
//
// Source is Natural Earth 1:110m admin-0 (public domain). Output keeps only the
// country code and the geometry, rounded to 2 decimals (~1km), which is far more
// precision than a country fill needs and cuts the file to a fifth of the
// original. The result is committed: unlike the city dataset there is no curated
// fallback, and a map view that silently does nothing on a fresh clone is worse
// than 170KB in git.
//
// 110m has no polygon for microstates (Singapore, Malta, Monaco, ...). The map
// draws those as a marker on the country centroid instead - see ChoroplethMap.

import { writeFile } from 'node:fs/promises';

const SRC =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson';
const OUT = 'public/countries.min.json';
const DECIMALS = 2;

const round = (coords) => {
  const m = 10 ** DECIMALS;
  return coords.map((c) =>
    Array.isArray(c[0]) ? round(c) : [Math.round(c[0] * m) / m, Math.round(c[1] * m) / m],
  );
};

console.log('Downloading', SRC);
const res = await fetch(SRC);
if (!res.ok) throw new Error(`download failed: ${res.status}`);
const source = await res.json();

const features = [];
for (const f of source.features) {
  const p = f.properties;
  const code = [p.ISO_A2_EH, p.ISO_A2].find((c) => c && c !== '-99') ?? null;
  // Antarctica is a third of the vertices in the file and never holds a contact.
  if (code === 'AQ') continue;
  features.push({
    type: 'Feature',
    properties: { code, name: p.NAME },
    geometry: { type: f.geometry.type, coordinates: round(f.geometry.coordinates) },
  });
}

const out = JSON.stringify({ type: 'FeatureCollection', features });
await writeFile(OUT, out);
console.log(`Wrote ${features.length} countries to ${OUT} (${Math.round(out.length / 1024)}KB)`);
