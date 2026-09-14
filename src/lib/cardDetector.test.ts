import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CardQuad,
  detectCardsInImage,
  matchQuad,
  mirrorSlot,
  pairBackSlotsForActiveFronts,
  quadToSlot,
  refineQuad,
  RgbaImage,
  slotToQuad,
  sortReadingOrder,
} from './cardDetector';
import type { ScannerSlot } from '../types';

// ---------------------------------------------------------------------------
// Synthetic scan rendering
// ---------------------------------------------------------------------------

interface SynthCard {
  cx: number;
  cy: number;
  w: number;
  h: number;
  /** Clockwise tilt in degrees */
  angle: number;
  border: number[];
  art: number[];
}

interface SceneOptions {
  shadow?: boolean;
  noise?: number;
}

const WHITE = [255, 255, 255];
const LIGHT_LID = [226, 232, 240];
const SHADOW_OFFSET = { x: 4, y: 5 };
const SHADOW_EXTENT = 14;
const CORNER_RADIUS = 8;
const ART_INSET = 20;

function toCardSpace(c: SynthCard, x: number, y: number) {
  const r = (c.angle * Math.PI) / 180;
  const dx = x - c.cx, dy = y - c.cy;
  return { u: dx * Math.cos(r) + dy * Math.sin(r), v: -dx * Math.sin(r) + dy * Math.cos(r) };
}

function cardBounds(c: SynthCard, pad: number, W: number, H: number) {
  const half = Math.hypot(c.w, c.h) / 2 + pad;
  return {
    x0: Math.max(0, Math.floor(c.cx - half)),
    y0: Math.max(0, Math.floor(c.cy - half)),
    x1: Math.min(W, Math.ceil(c.cx + half)),
    y1: Math.min(H, Math.ceil(c.cy + half)),
  };
}

/** Renders anti-aliased rounded cards with high-contrast striped artwork, optional soft shadows and noise. */
function renderScan(W: number, H: number, bg: number[], cards: SynthCard[], opts: SceneOptions = {}): RgbaImage {
  const rgb = new Float32Array(W * H * 3);
  for (let i = 0; i < W * H; i++) rgb.set(bg, i * 3);

  if (opts.shadow) {
    for (const c of cards) {
      const b = cardBounds(c, SHADOW_EXTENT + 10, W, H);
      for (let y = b.y0; y < b.y1; y++) {
        for (let x = b.x0; x < b.x1; x++) {
          const { u, v } = toCardSpace(c, x - SHADOW_OFFSET.x, y - SHADOW_OFFSET.y);
          const dd = Math.max(Math.abs(u) - c.w / 2, Math.abs(v) - c.h / 2);
          if (dd >= SHADOW_EXTENT) continue;
          const k = 1 - 0.35 * Math.min(1, (SHADOW_EXTENT - dd) / (2 * SHADOW_EXTENT));
          const p = (y * W + x) * 3;
          rgb[p] *= k; rgb[p + 1] *= k; rgb[p + 2] *= k;
        }
      }
    }
  }

  for (const c of cards) {
    const b = cardBounds(c, 2, W, H);
    for (let y = b.y0; y < b.y1; y++) {
      for (let x = b.x0; x < b.x1; x++) {
        // 3x3 supersampling for anti-aliased edges
        let coverage = 0;
        for (let sy = -1; sy <= 1; sy++) {
          for (let sx = -1; sx <= 1; sx++) {
            const { u, v } = toCardSpace(c, x + 0.5 + sx / 3, y + 0.5 + sy / 3);
            const qx = Math.abs(u) - (c.w / 2 - CORNER_RADIUS);
            const qy = Math.abs(v) - (c.h / 2 - CORNER_RADIUS);
            if (Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) <= CORNER_RADIUS) coverage++;
          }
        }
        if (coverage === 0) continue;
        const { u, v } = toCardSpace(c, x + 0.5, y + 0.5);
        let fill = c.border;
        if (Math.abs(u) < c.w / 2 - ART_INSET && Math.abs(v) < c.h / 2 - ART_INSET) {
          const stripe = Math.floor((u + v) / 12) % 2 === 0;
          fill = stripe ? c.art : c.art.map((ch) => 255 - ch);
        }
        const a = coverage / 9;
        const p = (y * W + x) * 3;
        for (let ch = 0; ch < 3; ch++) rgb[p + ch] = rgb[p + ch] * (1 - a) + fill[ch] * a;
      }
    }
  }

  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5;
  const data = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const n = opts.noise ? rand() * opts.noise : 0;
    data[i * 4] = rgb[i * 3] + n;
    data[i * 4 + 1] = rgb[i * 3 + 1] + n;
    data[i * 4 + 2] = rgb[i * 3 + 2] + n;
    data[i * 4 + 3] = 255;
  }
  return { data, width: W, height: H };
}

function downscale(img: RgbaImage, k: number): RgbaImage {
  const w = Math.floor(img.width / k), h = Math.floor(img.height / k);
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let ch = 0; ch < 4; ch++) {
        let sum = 0;
        for (let yy = 0; yy < k; yy++) {
          for (let xx = 0; xx < k; xx++) sum += img.data[((y * k + yy) * img.width + x * k + xx) * 4 + ch];
        }
        out[(y * w + x) * 4 + ch] = sum / (k * k);
      }
    }
  }
  return { data: out, width: w, height: h };
}

function regionReader(img: RgbaImage) {
  return (x: number, y: number, w: number, h: number): RgbaImage => {
    const out = new Uint8ClampedArray(w * h * 4);
    for (let row = 0; row < h; row++) {
      const start = ((y + row) * img.width + x) * 4;
      out.set(img.data.subarray(start, start + w * 4), row * w * 4);
    }
    return { data: out, width: w, height: h };
  };
}

/** Mirrors the browser entry point: coarse detection at half resolution, refinement at full resolution. */
function detect(W: number, H: number, bg: number[], cards: SynthCard[], opts: SceneOptions & { expectedCount?: number } = {}) {
  const full = renderScan(W, H, bg, cards, opts);
  const result = detectCardsInImage(downscale(full, 2), W, H, { expectedCount: opts.expectedCount });
  const read = regionReader(full);
  return { ...result, quads: result.quads.map((q) => refineQuad(q, read, W, H)) };
}

function assertCardsLocated(quads: CardQuad[], cards: SynthCard[]) {
  assert.equal(quads.length, cards.length, 'card count');
  for (const c of cards) {
    const q = quads.find((q) => Math.hypot(q.cx - c.cx, q.cy - c.cy) < 40);
    assert.ok(q, `card at (${c.cx}, ${c.cy}) not detected`);
    const label = `card at (${c.cx}, ${c.cy}, ${c.angle}°)`;
    assert.ok(q.refined, `${label} was not edge-refined`);
    assert.ok(Math.hypot(q.cx - c.cx, q.cy - c.cy) < 2, `${label} center error`);
    assert.ok(Math.abs(q.width - c.w) < 2.5, `${label} width ${q.width} vs ${c.w}`);
    assert.ok(Math.abs(q.height - c.h) < 2.5, `${label} height ${q.height} vs ${c.h}`);
    assert.ok(Math.abs(q.angleDeg - c.angle) < 0.2, `${label} angle ${q.angleDeg}`);
  }
}

const gridOfCards = (angles: number[], w = 500, h = 700): SynthCard[] =>
  angles.map((angle, i) => ({
    cx: 330 + (i % 3) * 620,
    cy: 440 + Math.floor(i / 3) * 860,
    w,
    h,
    angle,
    border: WHITE,
    art: [30 + i * 30, 90, 200 - i * 20],
  }));

// ---------------------------------------------------------------------------
// Detection accuracy
// ---------------------------------------------------------------------------

describe('detectCardsInImage + refineQuad', () => {
  it('locates tilted white-border cards on a light lid with drop shadows', () => {
    const cards = gridOfCards([0, 1.5, -2, 3, -0.7, 0.3, -4, 2.2, 0]);
    const res = detect(1900, 2600, LIGHT_LID, cards, { shadow: true, noise: 6, expectedCount: 9 });
    assert.ok(res.confident, `expected confident, got ${res.confidence} ${res.reasons}`);
    assertCardsLocated(res.quads, cards);
  });

  it('finds white cards on a white lid from edges alone', () => {
    const cards = gridOfCards([0.8, -1.2, 2, 0, -2.5, 1]);
    const res = detect(1900, 1800, [250, 250, 250], cards, { shadow: true, noise: 4 });
    assert.ok(res.confident, `expected confident, got ${res.confidence} ${res.reasons}`);
    assertCardsLocated(res.quads, cards);
  });

  it('handles landscape cards on a dark lid', () => {
    const cards: SynthCard[] = [0.2, -1, 1.8, -3].map((angle, i) => ({
      cx: 400 + (i % 2) * 790,
      cy: 300 + Math.floor(i / 2) * 560,
      w: 670,
      h: 470,
      angle,
      border: [240, 240, 235],
      art: [180, 40, 40],
    }));
    const res = detect(1600, 1150, [25, 25, 30], cards, { noise: 5 });
    assert.ok(res.confident);
    assertCardsLocated(res.quads, cards);
  });

  it('accepts graded slab proportions and ignores low-contrast slab borders vs. strong artwork edges', () => {
    const cards: SynthCard[] = [-0.5, 1.2].map((angle, i) => ({
      cx: 420 + i * 860,
      cy: 700,
      w: 620,
      h: 1050,
      angle,
      border: [235, 240, 245],
      art: [200, 30, 30],
    }));
    const res = detect(1700, 1400, LIGHT_LID, cards, { shadow: true, noise: 4 });
    assert.ok(res.confident);
    assertCardsLocated(res.quads, cards);
  });

  it('reports low confidence when two cards touch and merge', () => {
    const cards: SynthCard[] = [
      { cx: 450, cy: 500, w: 500, h: 700, angle: 0, border: WHITE, art: [20, 80, 160] },
      { cx: 950, cy: 500, w: 500, h: 700, angle: 0, border: WHITE, art: [160, 40, 20] },
      { cx: 450, cy: 1400, w: 500, h: 700, angle: 1, border: WHITE, art: [20, 160, 60] },
      { cx: 1250, cy: 1400, w: 500, h: 700, angle: -1, border: WHITE, art: [90, 40, 160] },
    ];
    const res = detect(1900, 2000, LIGHT_LID, cards, { shadow: true, noise: 4 });
    assert.equal(res.confident, false);
    assert.ok(res.reasons.some((r) => r.includes('differ significantly in size')));
  });

  it('reports low confidence when more cards are found than the template expects', () => {
    const res = detect(1900, 2600, LIGHT_LID, gridOfCards(Array(9).fill(0)), { noise: 4, expectedCount: 4 });
    assert.equal(res.quads.length, 9);
    assert.equal(res.confident, false);
  });

  it('reports no cards on an empty bed', () => {
    const res = detect(800, 1000, LIGHT_LID, [], { noise: 6 });
    assert.equal(res.quads.length, 0);
    assert.equal(res.confident, false);
  });

  it('returns cards in reading order', () => {
    const res = detect(1900, 1800, LIGHT_LID, gridOfCards([0, 1, -1, 2, -2, 0.5]), { noise: 4 });
    const centers = res.quads.map((q) => [Math.round(q.cx / 10) * 10, Math.round(q.cy / 10) * 10]);
    assert.deepEqual(centers, [[330, 440], [950, 440], [1570, 440], [330, 1300], [950, 1300], [1570, 1300]]);
  });
});

describe('refineQuad', () => {
  it('snaps a loose AI-style box (with safety margin, no angle) to the true tilted edges', () => {
    const card: SynthCard = { cx: 500, cy: 600, w: 500, h: 700, angle: 1.5, border: WHITE, art: [40, 90, 180] };
    const full = renderScan(1000, 1200, LIGHT_LID, [card], { noise: 4 });
    const aiBox: CardQuad = { cx: 504, cy: 596, width: 530, height: 735, angleDeg: 0, rectangularity: 1, aspectScore: 1, refined: false };
    const q = refineQuad(aiBox, regionReader(full), 1000, 1200, 0.06);
    assert.ok(q.refined);
    assert.ok(Math.hypot(q.cx - card.cx, q.cy - card.cy) < 2);
    assert.ok(Math.abs(q.width - card.w) < 3 && Math.abs(q.height - card.h) < 3);
    assert.ok(Math.abs(q.angleDeg - card.angle) < 0.2);
  });

  it('leaves the quad unchanged when there are no edges to snap to', () => {
    const blank = renderScan(600, 600, LIGHT_LID, [], { noise: 2 });
    const quad: CardQuad = { cx: 300, cy: 300, width: 250, height: 350, angleDeg: 0, rectangularity: 1, aspectScore: 1, refined: false };
    assert.deepEqual(refineQuad(quad, regionReader(blank), 600, 600), quad);
  });
});

// ---------------------------------------------------------------------------
// Slot geometry & pairing helpers
// ---------------------------------------------------------------------------

const quad = (over: Partial<CardQuad> = {}): CardQuad => ({
  cx: 300, cy: 400, width: 200, height: 280, angleDeg: 2, rectangularity: 1, aspectScore: 1, refined: true, ...over,
});

const slot = (over: Partial<ScannerSlot> = {}): ScannerSlot => ({
  id: 0, active: true, xPercent: 10, yPercent: 20, widthPercent: 20, heightPercent: 28, ...over,
});

describe('quadToSlot / slotToQuad', () => {
  it('round-trips geometry and stores deskew as the inverse of the tilt', () => {
    const s = quadToSlot(quad(), 1000, 2000, 3, 'Card 4');
    assert.equal(s.deskewAngle, -2);
    assert.equal(s.label, 'Card 4');
    assert.equal(s.isLandscape, false);
    assert.equal(s.rotation, 0);
    const back = slotToQuad(s, 1000, 2000);
    assert.ok(Math.abs(back.cx - 300) < 1e-9 && Math.abs(back.cy - 400) < 1e-9);
    assert.ok(Math.abs(back.width - 200) < 1e-9 && Math.abs(back.height - 280) < 1e-9);
    assert.equal(back.angleDeg, 2);
  });

  it('flags landscape cards for 90° rotation', () => {
    const s = quadToSlot(quad({ width: 280, height: 200 }), 1000, 1000, 0, '');
    assert.equal(s.isLandscape, true);
    assert.equal(s.rotation, 90);
  });

  it('ignores negligible tilt so straight cards skip resampling', () => {
    assert.equal(quadToSlot(quad({ angleDeg: 0.1 }), 1000, 1000, 0, '').deskewAngle, 0);
  });
});

describe('mirrorSlot', () => {
  it('mirrors x and negates deskew for a horizontal (book) flip', () => {
    const m = mirrorSlot(slot({ deskewAngle: 1.5 }), 'horizontal');
    assert.equal(m.xPercent, 70);
    assert.equal(m.yPercent, 20);
    assert.equal(m.deskewAngle, -1.5);
  });

  it('mirrors y and negates deskew for a vertical (calendar) flip', () => {
    const m = mirrorSlot(slot({ deskewAngle: -1 }), 'vertical');
    assert.equal(m.xPercent, 10);
    assert.equal(m.yPercent, 52);
    assert.equal(m.deskewAngle, 1);
  });

  it('keeps position for a direct flip', () => {
    assert.deepEqual(mirrorSlot(slot({ deskewAngle: 1 }), 'direct'), slot({ deskewAngle: 1 }));
  });
});

describe('matchQuad', () => {
  it('picks the nearest candidate within half a card', () => {
    const target = quad({ cx: 500, cy: 500 });
    const near = quad({ cx: 530, cy: 510 });
    const nearer = quad({ cx: 505, cy: 498 });
    assert.equal(matchQuad(target, [near, nearer]), nearer);
  });

  it('returns null when nothing is close enough', () => {
    assert.equal(matchQuad(quad({ cx: 500, cy: 500 }), [quad({ cx: 700, cy: 500 })]), null);
  });
});

describe('sortReadingOrder', () => {
  it('groups slightly offset cards into rows, left to right', () => {
    const q = (cx: number, cy: number) => quad({ cx, cy });
    const sorted = sortReadingOrder([q(900, 820), q(300, 400), q(300, 790), q(900, 380)]);
    assert.deepEqual(sorted.map((s) => [s.cx, s.cy]), [[300, 400], [900, 380], [300, 790], [900, 820]]);
  });
});

describe('pairBackSlotsForActiveFronts', () => {
  it('keeps backs aligned with active fronts when some slots are disabled', () => {
    const fronts = [slot({ id: 0 }), slot({ id: 1, active: false }), slot({ id: 2 })];
    const backs = [slot({ id: 10 }), slot({ id: 11 }), slot({ id: 12 })];
    assert.deepEqual(pairBackSlotsForActiveFronts(fronts, backs).map((s) => s.id), [10, 12]);
  });

  it('skips fronts that have no back slot', () => {
    const fronts = [slot({ id: 0 }), slot({ id: 1 })];
    assert.deepEqual(pairBackSlotsForActiveFronts(fronts, [slot({ id: 10 })]).map((s) => s.id), [10]);
  });
});
