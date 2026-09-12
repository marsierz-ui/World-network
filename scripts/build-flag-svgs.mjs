// Generates public/flags/<code>.svg: a circular-cropped flag for every
// country in COUNTRIES, used as the actual background image of a flag-mode
// map dot (see NetworkMap/GlobeMap) instead of a colour approximation.
//
// Source is the flag-icons package (MIT, github.com/lipis/flag-icons), whose
// "1x1" variant is already a square crop of each flag - exactly what a round
// dot needs. Circular cropping happens here rather than at render time: once
// a flag is a WebGL texture (a maplibre icon-image / deck.gl IconLayer icon)
// there is no layer-level clip-path to round its corners with, so the circle
// has to already be baked into the image.
//
// Run: npm install --no-save flag-icons@7.5.0 && node scripts/build-flag-svgs.mjs
//
// The output is committed - like countries.min.json and cities.min.json, the
// running map should not depend on a package that only ever exists as a
// dev-time source, and a fresh clone should not need to fetch anything to
// show flags.

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';

const SRC_DIR = 'node_modules/flag-icons/flags/1x1';
const OUT_DIR = 'public/flags';
// Native size to bake the SVG's width/height at. Vector under the hood, so
// this only sets the resolution a browser rasterises it to as an <img> /
// texture - plenty for the dot sizes the map ever draws (max ~56px across).
const SIZE = 128;

async function main() {
  if (!(await readdir(SRC_DIR).catch(() => null))) {
    throw new Error(`${SRC_DIR} not found - run: npm install --no-save flag-icons@7.5.0`);
  }

  const countriesSrc = await readFile('src/lib/countries.ts', 'utf8');
  const codes = [...countriesSrc.matchAll(/code: '([A-Z]{2})'/g)].map((m) => m[1]);

  await mkdir(OUT_DIR, { recursive: true });

  let written = 0;
  const missing = [];
  for (const code of codes) {
    const lower = code.toLowerCase();
    const raw = await readFile(`${SRC_DIR}/${lower}.svg`, 'utf8').catch(() => null);
    if (!raw) {
      missing.push(code);
      continue;
    }

    // Keep the original <svg ...> tag as-is (xmlns:xlink and friends included
    // - several flags use xlink:href for internal <use> references) and just
    // add explicit sizing: flag-icons ships only a viewBox, and an <img> with
    // no width/height falls back to the CSS default replaced-element size
    // (300x150) instead of its own square aspect ratio.
    const openTag = raw.match(/^<svg\b[^>]*>/)?.[0];
    if (!openTag) {
      missing.push(`${code} (unexpected shape)`);
      continue;
    }
    const sized = `${openTag.slice(0, -1)} width="${SIZE}" height="${SIZE}">`;
    const inner = raw.slice(openTag.length).replace(/<\/svg>\s*$/, '');
    const svg =
      `${sized}<defs><clipPath id="flag-clip"><circle cx="256" cy="256" r="256"/></clipPath></defs>` +
      `<g clip-path="url(#flag-clip)">${inner}</g></svg>\n`;

    await writeFile(`${OUT_DIR}/${lower}.svg`, svg);
    written++;
  }

  console.log(`Wrote ${written} flags to ${OUT_DIR}`);
  if (missing.length) console.log(`No flag-icons source for: ${missing.join(', ')}`);
}

await main();
