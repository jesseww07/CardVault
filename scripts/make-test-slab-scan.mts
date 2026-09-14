/**
 * Generates a realistic "imperfect" 4-slab flatbed scan pair (front + back PNG) for manual/E2E testing:
 * slabs are shifted off the PSA 4-slab template, tilted, one is upside down, and every label carries a real
 * barcode (front: Code128 cert) or QR code (back: PSA cert URL).
 *
 * Usage: npx tsx scripts/make-test-slab-scan.mts <outDir>
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';
import { prepareZXingModule, writeBarcode } from 'zxing-wasm/full';

const outDir = process.argv[2] ?? 'test-scans';
const require = createRequire(import.meta.url);
prepareZXingModule({
  overrides: { wasmBinary: readFileSync(require.resolve('zxing-wasm/full/zxing_full.wasm')).buffer as ArrayBuffer },
  fireImmediately: true,
});

const W = 2550, H = 3300; // 8.5x11" at 300 dpi
const SLAB_W = 900, SLAB_H = 1450;

interface Slab {
  cx: number;
  cy: number;
  angle: number; // clockwise degrees; ~180 means upside down
  cert: string;
  art: [number, number, number];
}

// Positions are deliberately off the PSA 4-slab template grid, tilted, and slab 3 is upside down
const slabs: Slab[] = [
  { cx: 690, cy: 950, angle: 1.8, cert: '48291048', art: [200, 40, 40] },
  { cx: 1905, cy: 900, angle: -2.2, cert: '81039471', art: [40, 90, 200] },
  { cx: 640, cy: 2480, angle: 180.9, cert: '29481023', art: [30, 150, 80] },
  { cx: 1830, cy: 2380, angle: -1.1, cert: '67401928', art: [180, 120, 20] },
];

async function symbolFor(text: string, format: 'Code128' | 'QRCode') {
  return (await writeBarcode(text, { format })).symbol;
}

/** Draws a slab into slab-local coordinates (u right, v down, origin top-left of the slab). */
async function slabPainter(slab: Slab, side: 'front' | 'back') {
  const symbol = side === 'front' ? await symbolFor(slab.cert, 'Code128') : await symbolFor(`https://www.psacard.com/cert/${slab.cert}`, 'QRCode');
  return (u: number, v: number): number[] | null => {
    if (u < 0 || v < 0 || u >= SLAB_W || v >= SLAB_H) return null;
    const edge = Math.min(u, v, SLAB_W - 1 - u, SLAB_H - 1 - v);
    if (edge < 6) return [150, 155, 160]; // slab outer rim
    if (edge < 30) return [222, 226, 230]; // clear plastic
    // Label
    if (v >= 40 && v < 360 && u >= 40 && u < SLAB_W - 40) {
      if (v < 90) return [205, 30, 40]; // red header band
      if (side === 'front') {
        if (v >= 120 && v < 150 && u >= 80 && u < 600) return [30, 30, 30]; // title text block
        if (v >= 170 && v < 195 && u >= 80 && u < 450) return [60, 60, 60];
        // Code128 barcode, 3px modules
        const bx = 80, by = 230, mod = 3, bh = 90;
        const su = Math.floor((u - bx) / mod);
        if (v >= by && v < by + bh && su >= 0 && su < symbol.width) {
          const s = symbol.data[Math.floor(((v - by) / bh) * symbol.height) * symbol.width + su];
          return [s, s, s];
        }
      } else {
        const qx = 580, qy = 110, mod = 6;
        const su = Math.floor((u - qx) / mod), sv = Math.floor((v - qy) / mod);
        if (su >= 0 && sv >= 0 && su < symbol.width && sv < symbol.height) {
          const s = symbol.data[sv * symbol.width + su];
          return [s, s, s];
        }
        if (v >= 130 && v < 160 && u >= 80 && u < 480) return [40, 40, 40];
      }
      return [250, 250, 248];
    }
    // Card inside the slab
    if (v >= 400 && v < SLAB_H - 60 && u >= 70 && u < SLAB_W - 70) {
      const cu = u - 70, cv = v - 400;
      if (cu < 25 || cv < 25 || cu > SLAB_W - 165 || cv > SLAB_H - 485) return [248, 248, 245]; // card white border
      if (side === 'back') return (Math.floor(cv / 40) % 2 === 0) ? [235, 215, 170] : [90, 70, 50];
      const stripe = Math.floor((cu + cv) / 30) % 2 === 0;
      return stripe ? slab.art : slab.art.map((c) => 255 - c);
    }
    return [222, 226, 230];
  };
}

async function renderScan(side: 'front' | 'back'): Promise<Uint8Array> {
  const rgb = new Float32Array(W * H * 3).fill(238);
  for (const slab0 of slabs) {
    // Book flip: back positions mirror horizontally, tilt reverses; upside-down stays upside-down
    const slab = side === 'front' ? slab0 : { ...slab0, cx: W - slab0.cx, angle: 360 - slab0.angle };
    const paint = await slabPainter(slab, side);
    const r = (slab.angle * Math.PI) / 180, cos = Math.cos(r), sin = Math.sin(r);
    const half = Math.hypot(SLAB_W, SLAB_H) / 2 + 20;
    for (let y = Math.max(0, Math.floor(slab.cy - half)); y < Math.min(H, slab.cy + half); y++) {
      for (let x = Math.max(0, Math.floor(slab.cx - half)); x < Math.min(W, slab.cx + half); x++) {
        // Shadow
        const sdx = x - 6 - slab.cx, sdy = y - 8 - slab.cy;
        const su = sdx * cos + sdy * sin + SLAB_W / 2, sv = -sdx * sin + sdy * cos + SLAB_H / 2;
        const p = (y * W + x) * 3;
        const outside = Math.max(-su, -sv, su - SLAB_W, sv - SLAB_H);
        if (outside < 16 && outside > -4) {
          const k = 1 - 0.25 * Math.min(1, (16 - outside) / 20);
          rgb[p] *= k; rgb[p + 1] *= k; rgb[p + 2] *= k;
        }
        // 2x2 supersampled slab
        let acc = [0, 0, 0], cov = 0;
        for (const [ox, oy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
          const dx = x + ox - slab.cx, dy = y + oy - slab.cy;
          const c = paint(dx * cos + dy * sin + SLAB_W / 2, -dx * sin + dy * cos + SLAB_H / 2);
          if (c) { acc = acc.map((a, i) => a + c[i]); cov++; }
        }
        if (cov) {
          const a = cov / 4;
          for (let ch = 0; ch < 3; ch++) rgb[p + ch] = rgb[p + ch] * (1 - a) + (acc[ch] / cov) * a;
        }
      }
    }
  }

  // Scanner noise
  let seed = side === 'front' ? 3 : 5;
  const raw = new Uint8Array((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 3 + 1)] = 0;
    for (let x = 0; x < W; x++) {
      seed = (seed * 16807) % 2147483647;
      const n = ((seed / 2147483647) - 0.5) * 10;
      for (let ch = 0; ch < 3; ch++) {
        raw[y * (W * 3 + 1) + 1 + x * 3 + ch] = Math.max(0, Math.min(255, rgb[(y * W + x) * 3 + ch] + n));
      }
    }
  }
  return encodePng(raw, W, H);
}

function encodePng(raw: Uint8Array, w: number, h: number): Uint8Array {
  const chunk = (type: string, data: Uint8Array) => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, 'ascii');
    Buffer.from(data).copy(out, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', new Uint8Array()),
  ]);
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'slabs-front.png'), await renderScan('front'));
writeFileSync(join(outDir, 'slabs-back.png'), await renderScan('back'));
console.log(`Wrote ${join(outDir, 'slabs-front.png')} and slabs-back.png (certs: ${slabs.map((s) => s.cert).join(', ')})`);
