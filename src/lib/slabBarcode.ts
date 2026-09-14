/**
 * Slab barcode / QR handling: turns decoded barcode text into a cert number, grading company,
 * lookup URL and an upright orientation. Decoding itself is injected (see barcodeReader.ts)
 * so this module stays testable in Node.
 */

import type { GradingBrand, SlabBarcodeInfo } from '../types';

/** Minimal shape of a zxing-wasm ReadResult that we rely on. */
export interface DecodedBarcode {
  text: string;
  format: string;
  /** Clockwise rotation of the symbol in the image, in degrees. */
  rotation: number;
}

export type BarcodeReadFn = (image: Blob | Uint8Array) => Promise<DecodedBarcode[]>;

/** Symbologies used on grading labels. Retail formats (EAN/UPC) are excluded so card-back barcodes are ignored. */
export const SLAB_BARCODE_FORMATS = ['Code128', 'Code39', 'Code93', 'ITF', 'QRCode', 'DataMatrix', 'PDF417'] as const;

const URL_PATTERNS: { company: GradingBrand; pattern: RegExp }[] = [
  { company: 'PSA', pattern: /psacard\.com\/cert\/(\d{6,12})/i },
  { company: 'CGC', pattern: /cgccards\.com\/certlookup\/(\d{6,12})/i },
  { company: 'BGS', pattern: /beckett\.com\/.*?(?:item_id=|card-lookup\/)(\d{6,12})/i },
  { company: 'SGC', pattern: /gosgc\.com\/.*?(\d{6,12})/i },
  { company: 'TAG', pattern: /taggrading\.com\/.*?([A-Z0-9]{6,14})\b/i },
];

export function certLookupUrl(company: GradingBrand | undefined, certNumber: string): string | undefined {
  if (!certNumber) return undefined;
  switch (company) {
    case 'PSA':
      return `https://www.psacard.com/cert/${certNumber}`;
    case 'CGC':
      return `https://www.cgccards.com/certlookup/${certNumber}/`;
    case 'BGS':
      return `https://www.beckett.com/grading/card-lookup?item_type=BGS&item_id=${certNumber}`;
    default:
      return undefined;
  }
}

export interface ParsedSlabBarcode {
  certNumber: string;
  company?: GradingBrand;
}

/** Extracts a cert number (and company, when the code is a grader URL) from barcode text. */
export function parseSlabBarcodeText(text: string): ParsedSlabBarcode | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  for (const { company, pattern } of URL_PATTERNS) {
    const m = trimmed.match(pattern);
    if (m) return { certNumber: m[1], company };
  }

  // Plain numeric label barcodes carry the cert/serial number directly
  if (/^\d{6,12}$/.test(trimmed)) return { certNumber: trimmed };

  return null;
}

/** Clockwise rotation (0/90/180/270) that turns an image upright, given a symbol rotated `rotation` degrees clockwise. */
export function uprightRotationFromBarcode(rotation: number): number {
  const snapped = Math.round(rotation / 90) * 90;
  return (((-snapped % 360) + 360) % 360);
}

/**
 * Picks the most trustworthy barcode from a card's front and back results.
 * Grader URLs (which identify the company) win over bare numbers; front wins over back.
 */
export function selectSlabBarcode(
  front: DecodedBarcode[],
  back: DecodedBarcode[]
): SlabBarcodeInfo | undefined {
  const candidates: Omit<SlabBarcodeInfo, 'uprightRotation'>[] = [];
  const uprightRotation: SlabBarcodeInfo['uprightRotation'] = {};
  for (const [side, results] of [['front', front], ['back', back]] as const) {
    for (const r of results) {
      const parsed = parseSlabBarcodeText(r.text);
      if (!parsed) continue;
      // Every label code on a side tells us which way that side is turned, even if it is not the chosen cert
      uprightRotation[side] ??= uprightRotationFromBarcode(r.rotation);
      candidates.push({
        certNumber: parsed.certNumber,
        company: parsed.company,
        lookupUrl: certLookupUrl(parsed.company, parsed.certNumber),
        rawText: r.text,
        side,
      });
    }
  }
  if (candidates.length === 0) return undefined;

  return { ...(candidates.find((c) => c.company) ?? candidates[0]), uprightRotation };
}

/** Decodes both sides of a card and returns the selected slab barcode (if any). Never throws. */
export async function readSlabBarcode(
  read: BarcodeReadFn,
  frontImage: Blob | Uint8Array | undefined,
  backImage: Blob | Uint8Array | undefined
): Promise<SlabBarcodeInfo | undefined> {
  const safeRead = async (img?: Blob | Uint8Array) => {
    if (!img) return [];
    try {
      return await read(img);
    } catch (e) {
      console.warn('Barcode decode failed:', e);
      return [];
    }
  };
  const [front, back] = await Promise.all([safeRead(frontImage), safeRead(backImage)]);
  return selectSlabBarcode(front, back);
}
