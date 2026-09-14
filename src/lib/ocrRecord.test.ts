import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildCardRecord, chunk, createBatchId, OcrResult, resolveUprightRotations } from './ocrRecord';
import type { CroppedSlotPair, SlabBarcodeInfo } from '../types';

const card = (over: Partial<CroppedSlotPair> = {}): CroppedSlotPair => ({
  slotIndex: 2,
  frontSlotIndex: 2,
  frontCroppedDataUrl: 'data:image/jpeg;base64,AAAA',
  backCroppedDataUrl: 'data:image/jpeg;base64,BBBB',
  label: 'Card 3',
  active: true,
  status: 'processing',
  ...over,
});

const barcode = (over: Partial<SlabBarcodeInfo> = {}): SlabBarcodeInfo => ({
  certNumber: '48291048',
  company: 'PSA',
  lookupUrl: 'https://www.psacard.com/cert/48291048',
  rawText: 'https://www.psacard.com/cert/48291048',
  side: 'front',
  uprightRotation: {},
  ...over,
});

const ctx = { batchId: 'batch-20260913-101500', now: 1_700_000_000_000, isSlabTemplate: false, templateBrand: 'Raw' };

const fullOcr: OcrResult = {
  name: 'Shohei Ohtani',
  year: '2018',
  set: 'Topps Chrome',
  cardNumber: '#150',
  category: 'Baseball',
  variation: 'Rookie Card (RC)',
  isGraded: true,
  gradingCompany: 'PSA',
  grade: '10',
  certNumber: '48291048',
  estimatedValue: 450,
  tags: ['RC'],
  frontOcrText: 'SHOHEI OHTANI ANGELS',
};

describe('buildCardRecord', () => {
  it('uses the barcode cert as the source of truth and links to the grader', () => {
    const rec = buildCardRecord(card({ barcode: barcode() }), fullOcr, ctx);
    assert.equal(rec.certNumber, '48291048');
    assert.equal(rec.certSource, 'barcode');
    assert.equal(rec.certLookupUrl, 'https://www.psacard.com/cert/48291048');
    assert.equal(rec.gradingCompany, 'PSA');
    assert.equal(rec.needsReview, false);
    assert.equal(rec.scanBatchId, ctx.batchId);
    assert.equal(rec.slotIndex, 2);
  });

  it('flags a mismatch between OCR and barcode cert or company', () => {
    const rec = buildCardRecord(card({ barcode: barcode({ company: 'CGC', certNumber: '4012345001' }) }), fullOcr, ctx);
    assert.equal(rec.certNumber, '4012345001');
    assert.equal(rec.gradingCompany, 'CGC');
    assert.equal(rec.needsReview, true);
    assert.equal(rec.reviewReasons?.length, 2);
  });

  it('treats a card as graded when a slab barcode with a company is found, even if OCR missed it', () => {
    const rec = buildCardRecord(card({ barcode: barcode() }), { ...fullOcr, isGraded: false, gradingCompany: 'Raw', grade: '' }, ctx);
    assert.equal(rec.isGraded, true);
    assert.equal(rec.gradingCompany, 'PSA');
    assert.ok(rec.reviewReasons?.includes('Grade not read'));
  });

  it('ignores a bare-number barcode on a raw card', () => {
    const raw: OcrResult = { ...fullOcr, isGraded: false, gradingCompany: 'Raw', grade: '', certNumber: '' };
    const rec = buildCardRecord(card({ barcode: barcode({ company: undefined, lookupUrl: undefined }) }), raw, ctx);
    assert.equal(rec.isGraded, false);
    assert.equal(rec.gradingCompany, 'Raw');
    assert.equal(rec.certNumber, '');
    assert.equal(rec.needsReview, false);
  });

  it('keeps OCR cert as the source when no barcode was decoded', () => {
    const rec = buildCardRecord(card(), fullOcr, ctx);
    assert.equal(rec.certSource, 'ocr');
    assert.equal(rec.certNumber, '48291048');
  });

  it('does not invent grade, value, condition or tags when OCR fails', () => {
    const rec = buildCardRecord(card(), undefined, { ...ctx, isSlabTemplate: true, templateBrand: 'PSA' }, 'Server returned 502');
    assert.equal(rec.name, 'Card 3');
    assert.equal(rec.grade, '');
    assert.equal(rec.estimatedValue, undefined);
    assert.equal(rec.estimatedCondition, '');
    assert.deepEqual(rec.tags, []);
    assert.equal(rec.needsReview, true);
    assert.deepEqual(rec.reviewReasons, ['OCR failed: Server returned 502']);
  });

  it('flags records missing identity fields and normalizes unknown categories and brands', () => {
    const rec = buildCardRecord(card(), { isGraded: true, gradingCompany: 'Beckett??', category: 'Curling' }, { ...ctx, isSlabTemplate: true, templateBrand: 'BGS' });
    assert.equal(rec.category, 'Other');
    assert.equal(rec.gradingCompany, 'BGS', 'falls back to the slab template brand');
    assert.deepEqual(rec.reviewReasons, ['Name not read', 'Year and set not read', 'Grade not read', 'Cert number not found']);
  });
});

describe('resolveUprightRotations', () => {
  it('uses a barcode-derived rotation for its side and the model estimate for the other', () => {
    const c = card({ barcode: barcode({ uprightRotation: { front: 180 } }) });
    assert.deepEqual(resolveUprightRotations(c, { frontRotation: 0, backRotation: 90 }), { front: 180, back: 90 });
  });

  it('does not re-rotate a side whose barcode rotation was already applied', () => {
    const c = card({ barcode: barcode({ uprightRotation: { front: 0, back: 0 } }) });
    assert.deepEqual(resolveUprightRotations(c, { frontRotation: 180, backRotation: 180 }), { front: 0, back: 0 });
  });

  it('ignores invalid model angles and cards without a back', () => {
    assert.deepEqual(resolveUprightRotations(card(), { frontRotation: 45, backRotation: 270 }), { front: 0, back: 270 });
    assert.deepEqual(resolveUprightRotations(card({ backCroppedDataUrl: undefined }), { backRotation: 90 }), { front: 0, back: 0 });
    assert.deepEqual(resolveUprightRotations(card(), undefined), { front: 0, back: 0 });
  });
});

describe('helpers', () => {
  it('chunks lists for batched OCR requests', () => {
    assert.deepEqual(chunk([1, 2, 3, 4, 5, 6, 7, 8, 9], 4), [[1, 2, 3, 4], [5, 6, 7, 8], [9]]);
    assert.deepEqual(chunk([], 4), []);
  });

  it('creates sortable batch ids', () => {
    assert.equal(createBatchId(new Date(2026, 8, 13, 9, 5, 7)), 'batch-20260913-090507');
  });
});
