// Generates src/lib/flagColors.ts: the dominant colours of every country flag,
// which the map uses to colour contact bubbles by flag.
//
// Run: node scripts/build-flag-colors.mjs
//
// The colours are counted off the actual pixels of a 40px-wide flag PNG from
// flagcdn.com rather than read out of an SVG's fill attributes: a fill tells you
// a colour is present, not how much of the flag it covers, and "how much" is
// exactly what makes a bubble look like the flag. Anti-aliased edges are
// quantised away, and colours that are near-duplicates of one already picked are
// skipped so a flag does not come back as three shades of the same red.
//
// The output is committed - this is a one-off download of 150-odd tiny images,
// and no part of the app should depend on flagcdn being up at runtime.

import { inflateSync } from 'node:zlib';
import { readFile, writeFile } from 'node:fs/promises';

const SRC = (code) => `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
const OUT = 'src/lib/flagColors.ts';
// Below this the "colour" is an anti-aliasing artefact, not part of the design.
const MIN_SHARE = 0.04;
const MAX_COLORS = 3;

// ---------------------------------------------------------------------------
// PNG -> RGBA pixels. Enough of the spec for what flagcdn serves (8-bit
// truecolour, truecolour+alpha, or palette; no interlacing).
// ---------------------------------------------------------------------------

function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let pos = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let colorType = 0;
  let palette = null;
  let transparency = null;
  const idat = [];

  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    pos += 12 + len;

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      colorType = data[9];
      if (data[12] !== 0) throw new Error('interlaced PNG unsupported');
    } else if (type === 'PLTE') {
      palette = data;
    } else if (type === 'tRNS') {
      transparency = data;
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`colour type ${colorType} unsupported`);
  if (depth !== 8 && !(channels === 1 && [1, 2, 4].includes(depth))) {
    throw new Error(`bit depth ${depth} with colour type ${colorType} unsupported`);
  }

  // flagcdn ships heavily optimised PNGs: most are 4-bit palette images, so
  // a scanline is packed and one byte can hold several pixels.
  const bitsPerPixel = channels * depth;
  const stride = Math.ceil((width * bitsPerPixel) / 8);
  const step = Math.max(1, bitsPerPixel >> 3); // filter neighbour distance, in bytes

  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(height * stride);

  // Undo the per-scanline filter. Each byte is predicted from its left (a),
  // above (b) and above-left (c) neighbours; the filter byte says how.
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= step ? out[y * stride + x - step] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= step && y > 0 ? out[(y - 1) * stride + x - step] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[y * stride + x] = v & 255;
    }
  }

  /** The `i`-th sample of row `y`, whatever the bit depth. */
  const sample = (y, i) => {
    if (depth === 8) return out[y * stride + i];
    const bit = i * depth;
    const byte = out[y * stride + (bit >> 3)];
    const shift = 8 - depth - (bit & 7);
    return (byte >> shift) & ((1 << depth) - 1);
  };

  const pixels = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (colorType === 3) {
        const idx = sample(y, x);
        if (transparency && transparency[idx] === 0) continue;
        pixels.push([palette[idx * 3], palette[idx * 3 + 1], palette[idx * 3 + 2]]);
      } else if (colorType === 6) {
        if (out[y * stride + x * 4 + 3] < 128) continue;
        const at = y * stride + x * 4;
        pixels.push([out[at], out[at + 1], out[at + 2]]);
      } else if (colorType === 2) {
        const at = y * stride + x * 3;
        pixels.push([out[at], out[at + 1], out[at + 2]]);
      } else {
        // Greyscale, with the low-depth values scaled up to 0-255.
        const v = Math.round((sample(y, x) * 255) / ((1 << depth) - 1));
        pixels.push([v, v, v]);
      }
    }
  }
  return pixels;
}

// ---------------------------------------------------------------------------
// pixels -> palette
// ---------------------------------------------------------------------------

const hex = ([r, g, b]) =>
  '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** How far `p` sits from the segment a-b, i.e. from every possible mix of the two. */
function distanceToLine(p, a, b) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = d[0] ** 2 + d[1] ** 2 + d[2] ** 2;
  if (!len) return distance(p, a);
  const t = Math.min(
    1,
    Math.max(0, ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1] + (p[2] - a[2]) * d[2]) / len),
  );
  return distance(p, [a[0] + t * d[0], a[1] + t * d[1], a[2] + t * d[2]]);
}

function paletteOf(pixels) {
  // Round to a 16-level cube: enough to merge anti-aliasing and JPEG-ish noise,
  // coarse enough not to split a solid field in two.
  const bins = new Map();
  for (const p of pixels) {
    const key = p.map((v) => Math.round(v / 16) * 16).join(',');
    const bin = bins.get(key);
    if (bin) {
      bin.n++;
      bin.sum[0] += p[0];
      bin.sum[1] += p[1];
      bin.sum[2] += p[2];
    } else {
      bins.set(key, { n: 1, sum: [...p] });
    }
  }

  const ranked = [...bins.values()]
    .map((b) => ({ n: b.n, rgb: b.sum.map((v) => Math.round(v / b.n)) }))
    .sort((a, b) => b.n - a.n);

  const picked = [];
  for (const { n, rgb } of ranked) {
    if (picked.length >= MAX_COLORS) break;
    if (n / pixels.length < MIN_SHARE) break;
    // 60 apart in RGB: white and yellow stay separate, two anti-aliased reds do not.
    if (picked.some((p) => distance(p, rgb) < 60)) continue;
    // A 40px-wide flag has a lot of edge pixels, and every stripe boundary blends
    // its two sides into a colour the flag's design contains nowhere: Sweden's
    // blue and yellow average to olive, and white over crimson gives pink. Any
    // mix of two colours already picked lands on the line between them, whatever
    // the ratio, so that line is what a candidate is tested against.
    if (picked.some((a) => picked.some((b) => a !== b && distanceToLine(rgb, a, b) < 30))) {
      continue;
    }
    picked.push(rgb);
  }
  return picked.map(hex);
}

// ---------------------------------------------------------------------------

const source = await readFile('src/lib/countries.ts', 'utf8');
const countries = [...source.matchAll(/code: '([A-Z]{2})', name: '([^']+)'/g)].map((m) => ({
  code: m[1],
  name: m[2],
}));
console.log(`${countries.length} countries`);

const rows = [];
const missing = [];
for (const { code, name } of countries) {
  const res = await fetch(SRC(code));
  if (!res.ok) {
    missing.push(`${code} (${res.status})`);
    continue;
  }
  const colors = paletteOf(decodePng(Buffer.from(await res.arrayBuffer())));
  if (!colors.length) {
    missing.push(`${code} (no colours)`);
    continue;
  }
  rows.push(`  ${code}: [${colors.map((c) => `'${c}'`).join(', ')}], // ${name}`);
}

const file = `// GENERATED by scripts/build-flag-colors.mjs - do not edit by hand.
//
// Dominant colours of each country's flag, most of the flag first, counted off
// the real pixels of the flag image. The map paints a bubble with the first as
// its fill and the second as its ring, which is what makes a French bubble read
// as blue-and-white rather than as "some blue".

export const FLAG_COLORS: Record<string, string[]> = {
${rows.join('\n')}
};
`;

await writeFile(OUT, file);
console.log(`Wrote ${rows.length} flags to ${OUT}`);
if (missing.length) console.log(`No flag for: ${missing.join(', ')}`);
