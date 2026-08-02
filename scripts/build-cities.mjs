// Generates public/cities.min.json from a GeoNames cities dump.
// Run: node scripts/build-cities.mjs [cities500|cities1000|cities5000|cities15000]
//   default cities15000 (~25k cities, ~1.5MB). cities500 = ~200k places (every town).
// Output rows: [name, countryCode, lat, lng, population, admin1, aliases?].
// Population ranks same-named cities; admin1 disambiguates within a country.
// Aliases carry Latin-script alternate spellings, without which common
// romanisations miss entirely (GeoNames calls Ulaanbaatar "Ulan Bator").
// geocode.ts loads it when present.

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
// Cities at/above this population also carry alternate spellings.
const ALIAS_MIN_POP = 100000;

await mkdir(TMP, { recursive: true });
await mkdir('public', { recursive: true });

console.log(`Dataset: ${SET}`);
console.log('Downloading', URL);
const res = await fetch(URL);
if (!res.ok) throw new Error(`download failed: ${res.status}`);
await pipeline(Readable.fromWeb(res.body), createWriteStream(`${TMP}/${SET}.zip`));

// Unzip (relies on system unzip or PowerShell Expand-Archive on Windows).
try {
  execFileSync('unzip', ['-o', `${TMP}/${SET}.zip`, '-d', TMP], { stdio: 'ignore' });
} catch {
  execFileSync('powershell', [
    '-Command',
    `Expand-Archive -Force '${TMP}/${SET}.zip' '${TMP}'`,
  ]);
}

// GeoNames columns: 0 geonameid,1 name,2 asciiname,4 lat,5 lng,8 country,10 admin1,14 population
const rl = createInterface({ input: createReadStream(`${TMP}/${SET}.txt`, 'utf8') });
const rows = [];
for await (const line of rl) {
  const f = line.split('\t');
  const name = f[2] || f[1];
  const lat = parseFloat(f[4]);
  const lng = parseFloat(f[5]);
  const country = f[8];
  const admin1 = f[10] || '';
  const population = parseInt(f[14], 10) || 0;
  if (!name || !country || Number.isNaN(lat) || Number.isNaN(lng)) continue;

  // Latin-script alternate spellings. Only for places big enough that someone
  // might type a different romanisation; carrying them for all 34k cities
  // roughly doubles a file the client fetches on every cold load.
  // Skip short strings and all-caps tokens: those are airport/IATA codes.
  const seen = new Set([name.toLowerCase(), (f[1] || '').toLowerCase()]);
  const aliases = [];
  if (population >= ALIAS_MIN_POP) {
    for (const raw of (f[3] || '').split(',')) {
      const t = raw.trim();
      if (t.length < 4 || t.length > 40) continue;
      if (!/^[A-Za-z][A-Za-z .'-]*$/.test(t)) continue;
      if (t === t.toUpperCase()) continue;
      const k = t.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      aliases.push(t);
    }
  }

  const row = [
    name,
    country,
    Math.round(lat * 1e4) / 1e4,
    Math.round(lng * 1e4) / 1e4,
    population,
    admin1,
  ];
  if (f[1] && f[1] !== name) aliases.unshift(f[1]); // UTF-8 official name
  if (aliases.length) row.push(aliases);
  rows.push(row);
}

await writeFile(OUT, JSON.stringify(rows));
await rm(TMP, { recursive: true, force: true });
console.log(`Wrote ${rows.length} cities to ${OUT}`);
