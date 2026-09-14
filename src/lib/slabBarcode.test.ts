import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { prepareZXingModule, readBarcodes, writeBarcode } from 'zxing-wasm/full';
import {
  BarcodeReadFn,
  certLookupUrl,
  DecodedBarcode,
  parseSlabBarcodeText,
  readSlabBarcode,
  selectSlabBarcode,
  SLAB_BARCODE_FORMATS,
  uprightRotationFromBarcode,
} from './slabBarcode';
import type { RgbaImage } from './cardDetector';

describe('parseSlabBarcodeText', () => {
  it('reads company and cert from grader URLs', () => {
    assert.deepEqual(parseSlabBarcodeText('https://www.psacard.com/cert/48291048'), { certNumber: '48291048', company: 'PSA' });
    assert.deepEqual(parseSlabBarcodeText('https://www.cgccards.com/certlookup/4012345001/'), { certNumber: '4012345001', company: 'CGC' });
    assert.deepEqual(
      parseSlabBarcodeText('https://www.beckett.com/grading/card-lookup?item_type=BGS&item_id=0012345678'),
      { certNumber: '0012345678', company: 'BGS' }
    );
  });

  it('treats a bare 6-12 digit code as a cert number with unknown company', () => {
    assert.deepEqual(parseSlabBarcodeText(' 84920194 '), { certNumber: '84920194' });
  });

  it('ignores unrelated content', () => {
    assert.equal(parseSlabBarcodeText('https://example.com/promo'), null);
    assert.equal(parseSlabBarcodeText('12345'), null);
    assert.equal(parseSlabBarcodeText('ABC-123-XYZ'), null);
    assert.equal(parseSlabBarcodeText(''), null);
  });
});

describe('certLookupUrl', () => {
  it('builds verification links for graders with known URL formats only', () => {
    assert.equal(certLookupUrl('PSA', '123456'), 'https://www.psacard.com/cert/123456');
    assert.ok(certLookupUrl('CGC', '123456')?.includes('cgccards.com/certlookup/123456'));
    assert.equal(certLookupUrl('SGC', '123456'), undefined);
    assert.equal(certLookupUrl('PSA', ''), undefined);
  });
});

describe('uprightRotationFromBarcode', () => {
  it('returns the clockwise correction for a rotated symbol', () => {
    assert.equal(uprightRotationFromBarcode(0), 0);
    assert.equal(uprightRotationFromBarcode(90), 270);
    assert.equal(uprightRotationFromBarcode(180), 180);
    assert.equal(uprightRotationFromBarcode(-90), 90);
    assert.equal(uprightRotationFromBarcode(3), 0, 'small reading jitter snaps to the nearest right angle');
  });
});

describe('selectSlabBarcode', () => {
  const r = (text: string, rotation = 0): DecodedBarcode => ({ text, format: 'Code128', rotation });

  it('prefers a URL that identifies the company over a bare number', () => {
    const picked = selectSlabBarcode([r('48291048')], [r('https://www.psacard.com/cert/48291048', 180)]);
    assert.equal(picked?.company, 'PSA');
    assert.equal(picked?.side, 'back');
    assert.deepEqual(picked?.uprightRotation, { front: 0, back: 180 }, 'each side keeps its own orientation');
    assert.equal(picked?.lookupUrl, 'https://www.psacard.com/cert/48291048');
  });

  it('falls back to the front bare number', () => {
    const picked = selectSlabBarcode([r('ignored-text'), r('84920194', 90)], []);
    assert.equal(picked?.certNumber, '84920194');
    assert.equal(picked?.company, undefined);
    assert.equal(picked?.side, 'front');
    assert.deepEqual(picked?.uprightRotation, { front: 270 });
  });

  it('returns undefined when nothing looks like a cert', () => {
    assert.equal(selectSlabBarcode([r('hello')], []), undefined);
  });
});

// ---------------------------------------------------------------------------
// End-to-end decoding with the real zxing WASM decoder on synthetic slab crops
// ---------------------------------------------------------------------------

type Rotation = 0 | 90 | 180 | 270;

/** Renders an upright slab (label with barcode at the top, card below), then rotates the whole crop. */
async function renderSlabCrop(text: string, format: 'Code128' | 'QRCode', rotation: Rotation, moduleSize: number): Promise<RgbaImage> {
  const symbol = (await writeBarcode(text, { format })).symbol;
  const W = 620, H = 1000;
  const lum = new Uint8Array(W * H).fill(235); // clear slab plastic over a light lid
  const fill = (x0: number, y0: number, w: number, h: number, v: number) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) lum[y * W + x] = v;
  };
  fill(30, 30, 560, 190, 250); // label
  fill(60, 260, 500, 700, 90); // card artwork
  for (let i = 0; i < 40; i++) fill(80 + (i * 37) % 440, 280 + (i * 53) % 640, 20, 20, (i * 71) % 255);

  const bw = symbol.width * moduleSize;
  const bh = format === 'QRCode' ? symbol.height * moduleSize : 60;
  const bx = format === 'QRCode' ? 440 : 60, by = 60;
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const sx = Math.floor(x / moduleSize);
      const sy = format === 'QRCode' ? Math.floor(y / moduleSize) : Math.floor((y * symbol.height) / bh);
      lum[(by + y) * W + bx + x] = symbol.data[sy * symbol.width + sx];
    }
  }

  const OW = rotation % 180 ? H : W, OH = rotation % 180 ? W : H;
  const data = new Uint8ClampedArray(OW * OH * 4);
  let seed = 11;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let X = x, Y = y;
      if (rotation === 90) { X = H - 1 - y; Y = x; }
      else if (rotation === 180) { X = W - 1 - x; Y = H - 1 - y; }
      else if (rotation === 270) { X = y; Y = W - 1 - x; }
      seed = (seed * 16807) % 2147483647;
      const v = lum[y * W + x] + ((seed / 2147483647) - 0.5) * 12;
      const p = (Y * OW + X) * 4;
      data[p] = data[p + 1] = data[p + 2] = v;
      data[p + 3] = 255;
    }
  }
  return { data, width: OW, height: OH };
}

/** Rotates an RGBA image clockwise by a right angle (what the app does to the crop). */
function rotateClockwise(img: RgbaImage, degrees: number): RgbaImage {
  let out = img;
  for (let k = 0; k < ((degrees / 90) % 4 + 4) % 4; k++) {
    const { width: w, height: h, data } = out;
    const next = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const src = (y * w + x) * 4, dst = (x * h + (h - 1 - y)) * 4;
        next.set(data.subarray(src, src + 4), dst);
      }
    }
    out = { data: next, width: h, height: w };
  }
  return out;
}

describe('readSlabBarcode with zxing', () => {
  let read: BarcodeReadFn;

  before(() => {
    const require = createRequire(import.meta.url);
    prepareZXingModule({
      overrides: { wasmBinary: readFileSync(require.resolve('zxing-wasm/full/zxing_full.wasm')).buffer as ArrayBuffer },
      fireImmediately: true,
    });
    // Tests pass raw RGBA images; the app passes JPEG bytes, which zxing decodes itself
    read = async (image) => {
      const results = await readBarcodes({ ...(image as unknown as RgbaImage), colorSpace: 'srgb' } as unknown as ImageData, {
        formats: [...SLAB_BARCODE_FORMATS],
        tryHarder: true,
        tryRotate: true,
        tryInvert: true,
      });
      return results.filter((r) => r.isValid).map((r) => ({ text: r.text, format: r.format, rotation: r.rotation }));
    };
  });

  for (const rotation of [0, 90, 180, 270] as Rotation[]) {
    it(`reads a label Code128 cert and orientation from a slab crop rotated ${rotation}°`, async () => {
      const crop = await renderSlabCrop('48291048', 'Code128', rotation, 3);
      const info = await readSlabBarcode(read, crop as unknown as Uint8Array, undefined);
      assert.equal(info?.certNumber, '48291048');
      assert.equal(info?.side, 'front');
      // Applying the correction must bring the label back to the top
      const upright = rotateClockwise(crop, info!.uprightRotation.front!);
      assert.equal(upright.width, 620, `upright crop should be portrait, got ${upright.width}x${upright.height}`);
      const recheck = await read(upright as unknown as Uint8Array);
      assert.equal(uprightRotationFromBarcode(recheck[0].rotation), 0);
    });
  }

  it('reads a PSA QR code on the back and identifies the company', async () => {
    const front = await renderSlabCrop('00000000', 'Code128', 0, 2); // bare number, no company
    const back = await renderSlabCrop('https://www.psacard.com/cert/84920194', 'QRCode', 180, 4);
    const info = await readSlabBarcode(read, front as unknown as Uint8Array, back as unknown as Uint8Array);
    assert.equal(info?.company, 'PSA');
    assert.equal(info?.certNumber, '84920194');
    assert.equal(info?.side, 'back', 'the company-identifying QR wins over the bare front number');
    assert.equal(info?.uprightRotation.back, 180);
  });

  it('returns undefined for a raw card with no barcode, and survives decoder errors', async () => {
    const blank: RgbaImage = { data: new Uint8ClampedArray(400 * 560 * 4).fill(200), width: 400, height: 560 };
    assert.equal(await readSlabBarcode(read, blank as unknown as Uint8Array, undefined), undefined);
    const failing: BarcodeReadFn = async () => {
      throw new Error('decoder crashed');
    };
    assert.equal(await readSlabBarcode(failing, blank as unknown as Uint8Array, blank as unknown as Uint8Array), undefined);
  });
});
