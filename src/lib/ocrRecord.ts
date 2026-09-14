/**
 * Turns OCR responses + locally decoded barcodes into catalog records. Unknown values stay empty
 * and the record is flagged for review instead of being filled with plausible-looking defaults.
 */

import type { CardCategory, CardRecord, CroppedSlotPair, GradingBrand } from '../types';
import { certLookupUrl } from './slabBarcode';

const BRANDS: GradingBrand[] = ['PSA', 'BGS', 'CGC', 'SGC', 'TAG', 'Raw', 'Other'];
const CATEGORIES: CardCategory[] = [
  'Baseball', 'Basketball', 'Football', 'Hockey', 'Soccer', 'Pokemon',
  'Magic: The Gathering', 'Yu-Gi-Oh!', 'Non-Sport / Marvel', 'Other',
];

/** Shape of one card in the /api/ocr-batch and /api/ocr-card responses. */
export interface OcrResult {
  id?: string;
  name?: string;
  year?: string;
  set?: string;
  cardNumber?: string;
  category?: string;
  variation?: string;
  isGraded?: boolean;
  gradingCompany?: string;
  grade?: string;
  certNumber?: string;
  subgrades?: CardRecord['subgrades'];
  estimatedCondition?: string;
  estimatedValue?: number;
  tags?: string[];
  frontOcrText?: string;
  backOcrText?: string;
  notes?: string;
  frontRotation?: number;
  backRotation?: number;
}

export interface RecordContext {
  batchId: string;
  now: number;
  isSlabTemplate: boolean;
  templateBrand?: string;
}

const normalizeCert = (s?: string) => (s || '').replace(/[^0-9A-Za-z]/g, '');

export function buildCardRecord(
  card: CroppedSlotPair,
  ocr: OcrResult | undefined,
  ctx: RecordContext,
  ocrError?: string
): Partial<CardRecord> {
  const reasons: string[] = [];
  const data = ocr ?? {};
  const barcode = card.barcode;

  if (!ocr) reasons.push(ocrError ? `OCR failed: ${ocrError}` : 'OCR returned no data for this card');

  const aiBrand = BRANDS.includes(data.gradingCompany as GradingBrand) ? (data.gradingCompany as GradingBrand) : undefined;
  const templateBrand = BRANDS.includes(ctx.templateBrand as GradingBrand) ? (ctx.templateBrand as GradingBrand) : undefined;
  const isGraded = Boolean(data.isGraded) || Boolean(barcode?.company) || (Boolean(barcode) && ctx.isSlabTemplate);

  let gradingCompany: GradingBrand = 'Raw';
  if (isGraded) {
    gradingCompany = barcode?.company ?? (aiBrand && aiBrand !== 'Raw' ? aiBrand : undefined) ?? templateBrand ?? 'Other';
    if (barcode?.company && aiBrand && aiBrand !== 'Raw' && aiBrand !== barcode.company) {
      reasons.push(`OCR read company ${aiBrand} but barcode indicates ${barcode.company}`);
    }
  }

  let certNumber = '';
  let certSource: CardRecord['certSource'];
  if (isGraded && barcode) {
    certNumber = barcode.certNumber;
    certSource = 'barcode';
    if (data.certNumber && normalizeCert(data.certNumber) !== normalizeCert(barcode.certNumber)) {
      reasons.push(`OCR cert ${data.certNumber} differs from barcode ${barcode.certNumber}`);
    }
  } else if (isGraded && data.certNumber) {
    certNumber = data.certNumber.trim();
    certSource = 'ocr';
  }

  if (ocr) {
    if (!data.name) reasons.push('Name not read');
    if (!data.year && !data.set) reasons.push('Year and set not read');
    if (isGraded && !data.grade) reasons.push('Grade not read');
    if (isGraded && !certNumber) reasons.push('Cert number not found');
  }

  const category = CATEGORIES.includes(data.category as CardCategory) ? (data.category as CardCategory) : 'Other';

  return {
    id: `card-${ctx.now}-${card.slotIndex}`,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    frontImage: card.frontCroppedDataUrl,
    backImage: card.backCroppedDataUrl,
    name: data.name || card.label,
    year: data.year || '',
    set: data.set || '',
    cardNumber: data.cardNumber || '',
    category,
    variation: data.variation || '',
    isGraded,
    gradingCompany,
    grade: isGraded ? data.grade || '' : '',
    certNumber,
    certSource,
    certLookupUrl: certLookupUrl(gradingCompany, certNumber),
    subgrades: data.subgrades,
    estimatedCondition: data.estimatedCondition || '',
    estimatedValue: typeof data.estimatedValue === 'number' && data.estimatedValue > 0 ? data.estimatedValue : undefined,
    currency: 'USD',
    frontOcrText: data.frontOcrText || '',
    backOcrText: data.backOcrText || '',
    tags: Array.isArray(data.tags) ? data.tags : [],
    notes: data.notes || '',
    scanBatchId: ctx.batchId,
    slotIndex: card.slotIndex,
    needsReview: reasons.length > 0,
    reviewReasons: reasons,
  };
}

const RIGHT_ANGLES = [0, 90, 180, 270];

/**
 * Clockwise rotations to apply to the front/back crops so they read upright.
 * A barcode on a side gives its exact orientation and wins for that side; the OCR model's estimate is the fallback.
 */
export function resolveUprightRotations(card: CroppedSlotPair, ocr: OcrResult | undefined): { front: number; back: number } {
  const ai = (v: unknown) => (typeof v === 'number' && RIGHT_ANGLES.includes(v) ? v : 0);
  const fromBarcode = card.barcode?.uprightRotation ?? {};
  const front = fromBarcode.front ?? ai(ocr?.frontRotation);
  const back = fromBarcode.back ?? ai(ocr?.backRotation);
  return { front, back: card.backCroppedDataUrl ? back : 0 };
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function createBatchId(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `batch-${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}
