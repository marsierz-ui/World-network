// Generates public/cities.min.json from a GeoNames cities dump.
// Run: node scripts/build-cities.mjs [cities500|cities1000|cities5000|cities15000]
//   default cities15000 (~25k cities, ~1.5MB). cities500 = ~200k places (every town).
// Output rows: [name, countryCode, lat, lng]. geocode.ts loads it when present.

import { createWriteStream } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { execFileSync } from 'node:child_process';

const ALLOWED = ['cities500', 'cities1000', 'cities5000', 'cities15000'];
const SET = ALLOWED.includes(process.argv[2]) ? process.argv[2] : 'cities15000';
const URL = `https://download.geonames.org/export/dump/${SET}.zip`;
const TMP = '.tmp-geonames';
const OUT = 'public/cities.min.json';

await mkdir(TMP, { recursive: true });
await mkdir('public', { recursive: true });

console.log(`Dataset: ${SET}`);
console.log('Downloading', URL);
const res = await fetch(URL);
if (!res.ok) throw new Error(`download failed: ${res.status}`);
await pipeline(Readable.fromWeb(res.body), createWriteStream(`${TMP}/cities15000.zip`));

// Unzip (relies on system unzip or PowerShell Expand-Archive on Windows).
try {
  execFileSync('unzip', ['-o', `${TMP}/${SET}.zip`, '-d', TMP], { stdio: 'ignore' });
} catch {
  execFileSync('powershell', [
    '-Command',
    `Expand-Archive -Force '${TMP}/${SET}.zip' '${TMP}'`,
  ]);
}

// GeoNames columns: 0 geonameid,1 name,2 asciiname,...,8 country,...,4 lat,5 lng,...,14 population
const rl = createInterface({ input: createReadStream(`${TMP}/${SET}.txt`, 'utf8') });
const rows = [];
for await (const line of rl) {
  const f = line.split('\t');
  const name = f[2] || f[1];
  const lat = parseFloat(f[4]);
  const lng = parseFloat(f[5]);
  const country = f[8];
  if (!name || !country || Number.isNaN(lat) || Number.isNaN(lng)) continue;
  rows.push([name, country, Math.round(lat * 1e4) / 1e4, Math.round(lng * 1e4) / 1e4]);
}

await writeFile(OUT, JSON.stringify(rows));
await rm(TMP, { recursive: true, force: true });
console.log(`Wrote ${rows.length} cities to ${OUT}`);
