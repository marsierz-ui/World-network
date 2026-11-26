// Generates public/countries.min.json: country outlines for the choropleth map
// view, keyed by ISO 3166-1 alpha-2 so they join straight onto
// contacts.current_country.
//
// Run: node scripts/build-countries.mjs   (needs network; fetches mapshaper via npx)
//
// Source is Natural Earth 1:10m admin-0 (public domain), the most detailed scale
// Natural Earth publishes. It is simplified with mapshaper, which simplifies
// shared borders once for both neighbours, so adjacent countries still meet
// exactly with no slivers or overlaps. 12% of the vertices are kept (weighted
// Visvalingam), coordinates are rounded to 0.001 deg (~100m). That is ~1.1MB
// raw, ~400KB gzipped, loaded only when the choropleth view opens.
//
// Unlike the old 1:110m file, 1:10m has polygons for microstates (Singapore,
// Malta, Monaco, ...). They are still too small to see at world zoom, so the
// build marks them `tiny` and the map also draws a marker on their centroid.
// Multi-part entries (Australia's territories, Baikonur, ...) are dissolved into
// one feature per country code.

import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SRC =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson';
const OUT = 'public/countries.min.json';
const KEEP = '12%';
const TINY_DEG = 1.2; // bbox narrower than this in both directions = marker too

const dir = await mkdtemp(join(tmpdir(), 'ne10-'));
try {
  console.log('Downloading', SRC);
  const res = await fetch(SRC);
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  const src = join(dir, 'ne10.geojson');
  const mid = join(dir, 'out.json');
  await writeFile(src, Buffer.from(await res.arrayBuffer()));

  execFileSync(
    'npx',
    [
      '-y', 'mapshaper@0.6.102', '-i', src,
      // Antarctica is a large share of the vertices and never holds a contact.
      '-filter', 'ISO_A2_EH!="AQ" && ISO_A2!="AQ"',
      // ISO_A2 is -99 for France, Norway, Kosovo...; ISO_A2_EH has them.
      '-each', 'code=[ISO_A2_EH,ISO_A2].find(c=>c&&c!="-99")||null, name=NAME, k=code||("x"+this.id)',
      '-simplify', KEEP, 'weighted', 'keep-shapes',
      '-dissolve', 'k', 'copy-fields=code,name',
      '-filter-fields', 'code,name',
      '-clean',
      '-o', mid, 'format=geojson', 'precision=0.001', 'force',
    ],
    { stdio: 'inherit', shell: process.platform === 'win32' },
  );

  const fc = JSON.parse(await readFile(mid, 'utf8'));
  for (const f of fc.features) {
    let [x0, y0, x1, y1] = [180, 90, -180, -90];
    const walk = (c) => {
      if (typeof c[0] === 'number') {
        x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0]);
        y0 = Math.min(y0, c[1]); y1 = Math.max(y1, c[1]);
      } else c.forEach(walk);
    };
    walk(f.geometry.coordinates);
    if (x1 - x0 < TINY_DEG && y1 - y0 < TINY_DEG) f.properties.tiny = true;
  }
  const out = JSON.stringify(fc);
  await writeFile(OUT, out);
  const tiny = fc.features.filter((f) => f.properties.tiny).length;
  console.log(`Wrote ${fc.features.length} countries (${tiny} tiny) to ${OUT} (${Math.round(out.length / 1024)}KB)`);
} finally {
  await rm(dir, { recursive: true, force: true });
}
