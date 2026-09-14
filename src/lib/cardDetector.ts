/**
 * Local card edge detector (no network).
 *
 * Pipeline: downscale -> background model from border strip -> color-distance + gradient mask
 * -> morphology + hole fill -> connected components -> convex hull -> min-area rotated rect
 * -> shape filtering & confidence -> full-resolution edge refinement (line fit per side).
 *
 * Core functions operate on plain RGBA buffers so they can be unit-tested without a DOM.
 */

import type { ScannerSlot } from '../types';

export interface RgbaImage {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

/** Rotated rectangle in source-image pixel space. angleDeg is the card's clockwise tilt in (-45, 45]. */
export interface CardQuad {
  cx: number;
  cy: number;
  width: number;
  height: number;
  angleDeg: number;
  rectangularity: number;
  aspectScore: number;
  refined: boolean;
}

export interface DetectOptions {
  /** Expected number of cards (from template), if known. */
  expectedCount?: number;
  /** Expected card width/height ratio (from template), if known. */
  aspectRatio?: number;
  /** Working resolution (long side) for coarse detection. */
  workSize?: number;
}

export interface DetectionResult {
  quads: CardQuad[];
  confidence: number; // 0..1
  confident: boolean;
  reasons: string[];
  sourceWidth: number;
  sourceHeight: number;
}

/** Reads a source-resolution RGBA region. Used for edge refinement. */
export type RegionReader = (x: number, y: number, w: number, h: number) => RgbaImage;

// Known short/long ratios: raw card (2.5x3.5), toploader (3x4), PSA/BGS/CGC/SGC slabs.
const KNOWN_ASPECTS = [0.714, 0.75, 0.62, 0.6, 0.66];
const CONFIDENCE_THRESHOLD = 0.75;

// ---------------------------------------------------------------------------
// Coarse detection
// ---------------------------------------------------------------------------

function percentile(hist: Uint32Array, total: number, p: number): number {
  const target = total * p;
  let acc = 0;
  for (let i = 0; i < hist.length; i++) {
    acc += hist[i];
    if (acc >= target) return i;
  }
  return hist.length - 1;
}

/** Separable binary dilate/erode with a square kernel of radius r using running sums. */
function morph(mask: Uint8Array, w: number, h: number, r: number, dilate: boolean): Uint8Array {
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  const full = 2 * r + 1;
  // Pixels outside the image count as background for dilate and as foreground for erode,
  // so erosion does not eat cards touching the border.
  const outside = dilate ? 0 : 1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = 0;
    for (let x = -r; x <= r; x++) sum += x < 0 || x >= w ? outside : mask[row + x];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = dilate ? (sum > 0 ? 1 : 0) : sum === full ? 1 : 0;
      const addX = x + r + 1;
      const subX = x - r;
      sum += (addX >= w ? outside : mask[row + addX]) - (subX < 0 ? outside : mask[row + subX]);
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) sum += y < 0 || y >= h ? outside : tmp[y * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = dilate ? (sum > 0 ? 1 : 0) : sum === full ? 1 : 0;
      const addY = y + r + 1;
      const subY = y - r;
      sum += (addY >= h ? outside : tmp[addY * w + x]) - (subY < 0 ? outside : tmp[subY * w + x]);
    }
  }
  return out;
}

/** Marks background pixels not reachable from the image border as foreground (fills card interiors). */
function fillHoles(mask: Uint8Array, w: number, h: number): void {
  const reached = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  let sp = 0;
  const push = (i: number) => {
    if (!mask[i] && !reached[i]) {
      reached[i] = 1;
      stack[sp++] = i;
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (sp > 0) {
    const i = stack[--sp];
    const x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i < w * (h - 1)) push(i + w);
  }
  for (let i = 0; i < mask.length; i++) if (!reached[i]) mask[i] = 1;
}

interface Pt {
  x: number;
  y: number;
}

function convexHull(points: Pt[]): Pt[] {
  if (points.length < 3) return points.slice();
  const pts = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Pt[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

/** Minimum-area enclosing rectangle via hull-edge enumeration (rotating calipers equivalent). */
function minAreaRect(hull: Pt[]): { cx: number; cy: number; width: number; height: number; angleDeg: number } {
  let best = { area: Infinity, cx: 0, cy: 0, width: 0, height: 0, angleDeg: 0 };
  const n = hull.length;
  for (let i = 0; i < n; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % n];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len === 0) continue;
    const ux = (b.x - a.x) / len;
    const uy = (b.y - a.y) / len;
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const p of hull) {
      const u = p.x * ux + p.y * uy;
      const v = -p.x * uy + p.y * ux;
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
    const area = (maxU - minU) * (maxV - minV);
    if (area < best.area) {
      const mu = (minU + maxU) / 2;
      const mv = (minV + maxV) / 2;
      best = {
        area,
        cx: mu * ux - mv * uy,
        cy: mu * uy + mv * ux,
        width: maxU - minU,
        height: maxV - minV,
        angleDeg: (Math.atan2(uy, ux) * 180) / Math.PI,
      };
    }
  }
  return normalizeRect(best);
}

/** Normalizes angle to (-45, 45], swapping width/height as needed. */
function normalizeRect<T extends { width: number; height: number; angleDeg: number }>(r: T): T {
  let { width, height, angleDeg } = r;
  angleDeg = ((angleDeg % 180) + 180) % 180; // [0, 180)
  if (angleDeg > 135) angleDeg -= 180;
  else if (angleDeg > 45) {
    angleDeg -= 90;
    [width, height] = [height, width];
  }
  return { ...r, width, height, angleDeg };
}

function aspectScoreFor(width: number, height: number, hint?: number): number {
  const ratio = Math.min(width, height) / Math.max(width, height);
  const targets = hint ? [Math.min(hint, 1 / hint), ...KNOWN_ASPECTS] : KNOWN_ASPECTS;
  const err = Math.min(...targets.map((t) => Math.abs(ratio - t)));
  // 0 error -> 1, 0.08 error -> 0
  return Math.max(0, 1 - err / 0.08);
}

export function detectCardsInImage(
  src: RgbaImage,
  sourceWidth: number,
  sourceHeight: number,
  options: DetectOptions = {}
): DetectionResult {
  const { width: w, height: h, data } = src;
  const scale = sourceWidth / w;
  const N = w * h;
  const reasons: string[] = [];

  // Luminance + blurred luminance for gradients
  const lum = new Float32Array(N);
  for (let i = 0, p = 0; i < N; i++, p += 4) {
    lum[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  }

  // Background model: per-channel median of a border strip
  const strip = Math.max(2, Math.round(Math.min(w, h) * 0.015));
  const histR = new Uint32Array(256), histG = new Uint32Array(256), histB = new Uint32Array(256);
  let stripCount = 0;
  const isStrip = (x: number, y: number) => x < strip || y < strip || x >= w - strip || y >= h - strip;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!isStrip(x, y)) continue;
      const p = (y * w + x) * 4;
      histR[data[p]]++;
      histG[data[p + 1]]++;
      histB[data[p + 2]]++;
      stripCount++;
    }
  }
  const bgR = percentile(histR, stripCount, 0.5);
  const bgG = percentile(histG, stripCount, 0.5);
  const bgB = percentile(histB, stripCount, 0.5);

  // Color distance + Sobel gradient, with noise statistics from the border strip
  const dist = new Uint16Array(N);
  const grad = new Float32Array(N);
  const distHist = new Uint32Array(766);
  const gradHist = new Uint32Array(1024);
  let noiseCount = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const p = i * 4;
      const d = Math.abs(data[p] - bgR) + Math.abs(data[p + 1] - bgG) + Math.abs(data[p + 2] - bgB);
      dist[i] = d;
      if (x > 0 && y > 0 && x < w - 1 && y < h - 1) {
        const gx =
          lum[i - w + 1] + 2 * lum[i + 1] + lum[i + w + 1] - lum[i - w - 1] - 2 * lum[i - 1] - lum[i + w - 1];
        const gy =
          lum[i + w - 1] + 2 * lum[i + w] + lum[i + w + 1] - lum[i - w - 1] - 2 * lum[i - w] - lum[i - w + 1];
        grad[i] = Math.hypot(gx, gy) / 4;
      }
      if (isStrip(x, y) && x > 0 && y > 0 && x < w - 1 && y < h - 1) {
        distHist[d]++;
        gradHist[Math.min(1023, Math.round(grad[i]))]++;
        noiseCount++;
      }
    }
  }
  const distThreshold = Math.max(18, percentile(distHist, noiseCount, 0.98) + 12);
  const gradThreshold = Math.max(10, percentile(gradHist, noiseCount, 0.98) * 2);

  let mask = new Uint8Array(N);
  for (let i = 0; i < N; i++) mask[i] = dist[i] > distThreshold || grad[i] > gradThreshold ? 1 : 0;

  // Close gaps in outlines, fill interiors, remove specks
  const closeR = Math.max(2, Math.round(Math.min(w, h) * 0.004));
  mask = morph(morph(mask, w, h, closeR, true), w, h, closeR, false);
  fillHoles(mask, w, h);
  mask = morph(morph(mask, w, h, 1, false), w, h, 1, true);

  // Connected components (4-connectivity)
  const labels = new Int32Array(N);
  const stack = new Int32Array(N);
  const imageArea = N;
  const minArea = imageArea * 0.012;
  const quads: CardQuad[] = [];
  let suspicious = 0;
  let nextLabel = 1;

  for (let start = 0; start < N; start++) {
    if (!mask[start] || labels[start]) continue;
    const label = nextLabel++;
    let sp = 0;
    stack[sp++] = start;
    labels[start] = label;
    let area = 0;
    const boundary: Pt[] = [];
    while (sp > 0) {
      const i = stack[--sp];
      area++;
      const x = i % w;
      const y = (i - x) / w;
      let edge = false;
      const visit = (j: number) => {
        if (!mask[j]) {
          edge = true;
        } else if (!labels[j]) {
          labels[j] = label;
          stack[sp++] = j;
        }
      };
      if (x > 0) visit(i - 1); else edge = true;
      if (x < w - 1) visit(i + 1); else edge = true;
      if (y > 0) visit(i - w); else edge = true;
      if (y < h - 1) visit(i + w); else edge = true;
      if (edge) boundary.push({ x: x + 0.5, y: y + 0.5 });
    }

    if (area < minArea) continue;
    if (area > imageArea * 0.85) {
      suspicious++;
      reasons.push('A region covers most of the scan (lid open or dark background?)');
      continue;
    }

    const rect = minAreaRect(convexHull(boundary));
    const rectangularity = area / Math.max(1, rect.width * rect.height);
    const aspectScore = aspectScoreFor(rect.width, rect.height, options.aspectRatio);

    if (rectangularity < 0.8 || aspectScore === 0) {
      suspicious++;
      reasons.push(
        `Rejected non-card region (rectangularity ${rectangularity.toFixed(2)}, aspect ${(
          Math.min(rect.width, rect.height) / Math.max(rect.width, rect.height)
        ).toFixed(2)}) — cards may be touching`
      );
      continue;
    }

    quads.push({
      cx: rect.cx * scale,
      cy: rect.cy * scale,
      width: rect.width * scale,
      height: rect.height * scale,
      angleDeg: rect.angleDeg,
      rectangularity,
      aspectScore,
      refined: false,
    });
  }

  return scoreDetection(sortReadingOrder(quads), suspicious, reasons, sourceWidth, sourceHeight, options);
}

function scoreDetection(
  quads: CardQuad[],
  suspicious: number,
  reasons: string[],
  sourceWidth: number,
  sourceHeight: number,
  options: DetectOptions
): DetectionResult {
  let confidence = 0;
  if (quads.length === 0) {
    reasons.push('No card-shaped regions found');
  } else {
    const shape =
      quads.reduce((s, q) => s + Math.min(1, (q.rectangularity - 0.8) / 0.15) * 0.5 + q.aspectScore * 0.5, 0) /
      quads.length;
    confidence = shape;
    if (suspicious > 0) confidence *= 0.5;

    // Cards on a single scan should be roughly the same size
    const areas = quads.map((q) => q.width * q.height).sort((a, b) => a - b);
    const median = areas[Math.floor(areas.length / 2)];
    if (areas[0] < median * 0.7 || areas[areas.length - 1] > median * 1.3) {
      confidence *= 0.7;
      reasons.push('Detected cards differ significantly in size');
    }

    if (options.expectedCount && quads.length > options.expectedCount) {
      confidence *= 0.6;
      reasons.push(`Found ${quads.length} regions but template expects ${options.expectedCount}`);
    }
  }
  return {
    quads,
    confidence,
    confident: confidence >= CONFIDENCE_THRESHOLD,
    reasons,
    sourceWidth,
    sourceHeight,
  };
}

export function sortReadingOrder(quads: CardQuad[]): CardQuad[] {
  if (quads.length < 2) return quads.slice();
  const byY = quads.slice().sort((a, b) => a.cy - b.cy);
  const rows: CardQuad[][] = [];
  for (const q of byY) {
    const row = rows[rows.length - 1];
    const rowHeight = row ? Math.min(...row.map((r) => Math.min(r.width, r.height))) : 0;
    if (row && Math.abs(q.cy - row[0].cy) < rowHeight * 0.5) row.push(q);
    else rows.push([q]);
  }
  return rows.flatMap((row) => row.sort((a, b) => a.cx - b.cx));
}

// ---------------------------------------------------------------------------
// Full-resolution edge refinement
// ---------------------------------------------------------------------------

/**
 * Snaps each side of a quad to the strongest nearby edge at source resolution and refits the rectangle.
 * searchFraction is the probe distance (inward and outward) as a fraction of the shorter side.
 */
export function refineQuad(quad: CardQuad, read: RegionReader, sourceWidth: number, sourceHeight: number, searchFraction = 0.05): CardQuad {
  const search = Math.max(4, Math.round(Math.min(quad.width, quad.height) * searchFraction));
  const rad = (quad.angleDeg * Math.PI) / 180;
  const ux = Math.cos(rad), uy = Math.sin(rad); // card +x axis
  const vx = -uy, vy = ux; // card +y axis

  const halfW = quad.width / 2, halfH = quad.height / 2;
  const corners = [
    [-halfW - search, -halfH - search],
    [halfW + search, -halfH - search],
    [halfW + search, halfH + search],
    [-halfW - search, halfH + search],
  ].map(([a, b]) => ({ x: quad.cx + a * ux + b * vx, y: quad.cy + a * uy + b * vy }));
  const x0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c.x))) - 2);
  const y0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c.y))) - 2);
  const x1 = Math.min(sourceWidth, Math.ceil(Math.max(...corners.map((c) => c.x))) + 2);
  const y1 = Math.min(sourceHeight, Math.ceil(Math.max(...corners.map((c) => c.y))) + 2);
  if (x1 - x0 < 8 || y1 - y0 < 8) return quad;

  const region = read(x0, y0, x1 - x0, y1 - y0);
  const rw = region.width, rh = region.height;
  const sample = (px: number, py: number): number => {
    const x = Math.round(px - x0), y = Math.round(py - y0);
    if (x < 0 || y < 0 || x >= rw || y >= rh) return NaN;
    const p = (y * rw + x) * 4;
    return 0.299 * region.data[p] + 0.587 * region.data[p + 1] + 0.114 * region.data[p + 2];
  };

  // Sides: [outward normal, half-extent along normal, tangent, half-length along tangent]
  const sides = [
    { nx: -vx, ny: -vy, off: halfH, tx: ux, ty: uy, len: halfW }, // top
    { nx: ux, ny: uy, off: halfW, tx: vx, ty: vy, len: halfH }, // right
    { nx: vx, ny: vy, off: halfH, tx: ux, ty: uy, len: halfW }, // bottom
    { nx: -ux, ny: -uy, off: halfW, tx: vx, ty: vy, len: halfH }, // left
  ];

  const SAMPLES = 24;
  const fitted: { a: number; b: number; ok: boolean }[] = sides.map((s) => {
    const ts: number[] = [];
    const offs: number[] = [];
    for (let k = 0; k < SAMPLES; k++) {
      // Skip rounded corners: sample the middle 70% of each side
      const t = (-0.7 + (1.4 * k) / (SAMPLES - 1)) * s.len;
      const bx = quad.cx + s.nx * s.off + s.tx * t;
      const by = quad.cy + s.ny * s.off + s.ty * t;
      // Walk from outside inward; gradient = |I(d+1) - I(d-1)|
      const profile: number[] = [];
      for (let d = search + 1; d >= -search - 1; d--) {
        // Average across a few pixels along the side to suppress scanner/JPEG noise
        let sum = 0;
        for (let e = -2; e <= 2; e++) sum += sample(bx + s.nx * d + s.tx * e, by + s.ny * d + s.ty * e);
        profile.push(sum / 5);
      }
      const g: number[] = [];
      let gMax = 0;
      for (let j = 1; j < profile.length - 1; j++) {
        const v = Math.abs(profile[j + 1] - profile[j - 1]);
        g.push(Number.isNaN(v) ? 0 : v);
        if (g[j - 1] > gMax) gMax = g[j - 1];
      }
      if (gMax < 12) continue;
      // First significant edge walking inward, climbed to its local peak. This favors the physical
      // card edge (e.g. white border vs. lid) over stronger artwork edges further inside.
      const threshold = Math.max(12, gMax * 0.1);
      let j = g.findIndex((v) => v >= threshold);
      while (j + 1 < g.length && g[j + 1] > g[j]) j++;
      const d = search - j; // outward offset from the current side
      ts.push(t);
      offs.push(d);
    }
    if (ts.length < SAMPLES * 0.4) return { a: 0, b: 0, ok: false };

    // Robust line fit: reject outliers by median absolute deviation, then least squares offs = a + b*t
    const sorted = offs.slice().sort((p, q) => p - q);
    const med = sorted[Math.floor(sorted.length / 2)];
    const mad = sorted.map((o) => Math.abs(o - med)).sort((p, q) => p - q)[Math.floor(sorted.length / 2)];
    const keep = offs.map((o) => Math.abs(o - med) <= Math.max(1.5, mad * 2.5));
    let n = 0, st = 0, so = 0, stt = 0, sto = 0;
    for (let i = 0; i < ts.length; i++) {
      if (!keep[i]) continue;
      n++;
      st += ts[i];
      so += offs[i];
      stt += ts[i] * ts[i];
      sto += ts[i] * offs[i];
    }
    if (n < SAMPLES * 0.3) return { a: 0, b: 0, ok: false };
    const denom = n * stt - st * st;
    const b = denom === 0 ? 0 : (n * sto - st * so) / denom;
    const a = (so - b * st) / n;
    return { a, b, ok: true };
  });

  if (fitted.filter((f) => f.ok).length < 4) return quad;

  // Each side as a line: point P + tangent T, in source coordinates
  const lines = sides.map((s, i) => {
    const { a, b } = fitted[i];
    const px = quad.cx + s.nx * (s.off + a);
    const py = quad.cy + s.ny * (s.off + a);
    // offset grows by b per unit t along the outward normal
    const tx = s.tx + s.nx * b;
    const ty = s.ty + s.ny * b;
    return { px, py, tx, ty };
  });
  const intersect = (l1: (typeof lines)[0], l2: (typeof lines)[0]): Pt | null => {
    const det = l1.tx * -l2.ty - l1.ty * -l2.tx;
    if (Math.abs(det) < 1e-9) return null;
    const dx = l2.px - l1.px, dy = l2.py - l1.py;
    const s = (dx * -l2.ty - dy * -l2.tx) / det;
    return { x: l1.px + l1.tx * s, y: l1.py + l1.ty * s };
  };
  const tl = intersect(lines[3], lines[0]);
  const tr = intersect(lines[0], lines[1]);
  const br = intersect(lines[1], lines[2]);
  const bl = intersect(lines[2], lines[3]);
  if (!tl || !tr || !br || !bl) return quad;

  const width = (Math.hypot(tr.x - tl.x, tr.y - tl.y) + Math.hypot(br.x - bl.x, br.y - bl.y)) / 2;
  const height = (Math.hypot(bl.x - tl.x, bl.y - tl.y) + Math.hypot(br.x - tr.x, br.y - tr.y)) / 2;
  const angle =
    (Math.atan2(tr.y - tl.y + br.y - bl.y, tr.x - tl.x + br.x - bl.x) * 180) / Math.PI;
  const refined = normalizeRect({
    ...quad,
    cx: (tl.x + tr.x + br.x + bl.x) / 4,
    cy: (tl.y + tr.y + br.y + bl.y) / 4,
    width,
    height,
    angleDeg: angle,
    refined: true,
  });

  // Sanity: refinement should nudge, not reshape
  const sizeChange = Math.max(Math.abs(refined.width / quad.width - 1), Math.abs(refined.height / quad.height - 1));
  const shift = Math.hypot(refined.cx - quad.cx, refined.cy - quad.cy);
  if (sizeChange > 0.12 || shift > search * 1.5 || Math.abs(refined.angleDeg - quad.angleDeg) > 3) return quad;
  return refined;
}

// ---------------------------------------------------------------------------
// Slot conversion & pairing helpers
// ---------------------------------------------------------------------------

export function quadToSlot(q: CardQuad, sourceWidth: number, sourceHeight: number, id: number, label: string): ScannerSlot {
  const isLandscape = q.width > q.height;
  // deskewAngle is the rotation applied to straighten the card, i.e. the inverse of its tilt
  const deskew = Math.abs(q.angleDeg) < 0.15 ? 0 : -q.angleDeg;
  return {
    id,
    active: true,
    xPercent: ((q.cx - q.width / 2) / sourceWidth) * 100,
    yPercent: ((q.cy - q.height / 2) / sourceHeight) * 100,
    widthPercent: (q.width / sourceWidth) * 100,
    heightPercent: (q.height / sourceHeight) * 100,
    label,
    rotation: isLandscape ? 90 : 0,
    deskewAngle: deskew,
    isLandscape,
  };
}

export function slotToQuad(s: ScannerSlot, sourceWidth: number, sourceHeight: number): CardQuad {
  const width = (s.widthPercent / 100) * sourceWidth;
  const height = (s.heightPercent / 100) * sourceHeight;
  return {
    cx: (s.xPercent / 100) * sourceWidth + width / 2,
    cy: (s.yPercent / 100) * sourceHeight + height / 2,
    width,
    height,
    angleDeg: -(s.deskewAngle || 0),
    rectangularity: 1,
    aspectScore: aspectScoreFor(width, height),
    refined: false,
  };
}

/** Mirrors a front slot into back-scan coordinates for the given flip mode. */
export function mirrorSlot(s: ScannerSlot, flipMode: string): ScannerSlot {
  if (flipMode === 'horizontal') {
    return { ...s, xPercent: 100 - s.xPercent - s.widthPercent, deskewAngle: s.deskewAngle ? -s.deskewAngle : 0 };
  }
  if (flipMode === 'vertical') {
    return { ...s, yPercent: 100 - s.yPercent - s.heightPercent, deskewAngle: s.deskewAngle ? -s.deskewAngle : 0 };
  }
  return { ...s };
}

/**
 * Auto-detected back slots are paired by index (backSlots[i] is the back of frontSlots[i]).
 * Returns the backs of active fronts only, aligned with frontSlots.filter(s => s.active).
 */
export function pairBackSlotsForActiveFronts(frontSlots: ScannerSlot[], backSlots: ScannerSlot[]): ScannerSlot[] {
  return frontSlots.flatMap((s, i) => (s.active && backSlots[i] ? [backSlots[i]] : []));
}

/** Finds the detected quad whose center is nearest the slot's center, within half a card. */
export function matchQuad(slotQuad: CardQuad, candidates: CardQuad[]): CardQuad | null {
  let best: CardQuad | null = null;
  let bestDist = Math.min(slotQuad.width, slotQuad.height) * 0.5;
  for (const c of candidates) {
    const d = Math.hypot(c.cx - slotQuad.cx, c.cy - slotQuad.cy);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Browser entry points
// ---------------------------------------------------------------------------

export function createRegionReader(img: HTMLImageElement): RegionReader {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  return (x, y, w, h) => {
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
  };
}

export function detectCardsInElement(img: HTMLImageElement, options: DetectOptions = {}): DetectionResult {
  const workSize = options.workSize ?? 1000;
  const sw = img.naturalWidth, sh = img.naturalHeight;
  const k = Math.min(1, workSize / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * k));
  const h = Math.max(1, Math.round(sh * k));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  const result = detectCardsInImage(ctx.getImageData(0, 0, w, h), sw, sh, options);

  const read = createRegionReader(img);
  result.quads = result.quads.map((q) => refineQuad(q, read, sw, sh));
  return result;
}
