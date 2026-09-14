import { CardRecord } from '../types';
import { createZip, dataUrlExtension, dataUrlToBytes, ZipEntry } from './zip';

/**
 * Escapes a field according to RFC 4180 CSV standard:
 * - Wraps string in double quotes
 * - Escapes interior double quotes as ""
 * - Preserves interior newlines and commas safely
 */
function escapeCsvValue(val: string | number | boolean | null | undefined): string {
  if (val === null || val === undefined) {
    return '""';
  }
  const str = String(val);
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Formats numeric monetary value cleanly for spreadsheet software. Unknown values stay blank.
 */
function formatNumericValue(val: number | undefined | null): string {
  if (val === null || val === undefined || isNaN(val)) {
    return '';
  }
  return Number(val).toFixed(2);
}

/**
 * Format ISO date for human readable spreadsheet columns
 */
function formatDate(timestamp: number | undefined | null): string {
  if (!timestamp) return '';
  try {
    return new Date(timestamp).toISOString();
  } catch {
    return '';
  }
}

export interface CsvExportSummary {
  success: boolean;
  count: number;
  totalEstimatedValue: number;
  filename: string;
  gradedCount: number;
  rawCount: number;
}

/** Image file names inside a ZIP export, keyed by card id. */
export type ImageFileMap = Map<string, { front?: string; back?: string }>;

/**
 * Generates RFC 4180 compliant CSV text from an array of CardRecord items
 */
export function generateCardsCsv(cards: CardRecord[], imageFiles?: ImageFileMap): string {
  const headers = [
    'Card ID',
    'Player / Title',
    'Year',
    'Set',
    'Card Number',
    'Category',
    'Variation',
    'Is Graded',
    'Grading Company',
    'Grade',
    'Cert Number',
    'Cert Source',
    'Cert Lookup URL',
    'Subgrade: Centering',
    'Subgrade: Corners',
    'Subgrade: Edges',
    'Subgrade: Surface',
    'Subgrade: Autograph',
    'Estimated Condition',
    'Estimated Value',
    'Currency',
    'Tags',
    'Notes',
    'Front OCR Text',
    'Back OCR Text',
    'Needs Review',
    'Review Reasons',
    'Front Image File',
    'Back Image File',
    'Date Added',
    'Last Updated',
    'Scan Batch ID',
    'Slot Index'
  ];

  const rows = cards.map((c) => {
    const files = imageFiles?.get(c.id);
    return [
      escapeCsvValue(c.id),
      escapeCsvValue(c.name || 'Untitled Card'),
      escapeCsvValue(c.year || ''),
      escapeCsvValue(c.set || ''),
      escapeCsvValue(c.cardNumber || ''),
      escapeCsvValue(c.category || ''),
      escapeCsvValue(c.variation || ''),
      escapeCsvValue(c.isGraded ? 'Yes' : 'No'),
      escapeCsvValue(c.isGraded ? c.gradingCompany : 'Raw'),
      escapeCsvValue(c.grade || ''),
      escapeCsvValue(c.certNumber || ''),
      escapeCsvValue(c.certNumber ? c.certSource || '' : ''),
      escapeCsvValue(c.certLookupUrl || ''),
      escapeCsvValue(c.subgrades?.centering || ''),
      escapeCsvValue(c.subgrades?.corners || ''),
      escapeCsvValue(c.subgrades?.edges || ''),
      escapeCsvValue(c.subgrades?.surface || ''),
      escapeCsvValue(c.subgrades?.auto || ''),
      escapeCsvValue(c.estimatedCondition || ''),
      formatNumericValue(c.estimatedValue),
      escapeCsvValue(c.currency || 'USD'),
      escapeCsvValue((c.tags || []).join('; ')),
      escapeCsvValue(c.notes || ''),
      escapeCsvValue(c.frontOcrText || ''),
      escapeCsvValue(c.backOcrText || ''),
      escapeCsvValue(c.needsReview ? 'Yes' : 'No'),
      escapeCsvValue((c.reviewReasons || []).join('; ')),
      escapeCsvValue(files?.front || ''),
      escapeCsvValue(files?.back || ''),
      escapeCsvValue(formatDate(c.createdAt)),
      escapeCsvValue(formatDate(c.updatedAt)),
      escapeCsvValue(c.scanBatchId || ''),
      escapeCsvValue(c.slotIndex !== undefined ? c.slotIndex + 1 : '')
    ].join(',');
  });

  // Prepend UTF-8 BOM so Excel, Numbers & Google Sheets decode special characters perfectly
  return '\uFEFF' + [headers.map(h => `"${h}"`).join(','), ...rows].join('\r\n');
}

function summarize(cards: CardRecord[], filename: string): CsvExportSummary {
  const gradedCount = cards.filter((c) => c.isGraded).length;
  return {
    success: true,
    count: cards.length,
    totalEstimatedValue: cards.reduce((sum, c) => sum + (c.estimatedValue || 0), 0),
    filename,
    gradedCount,
    rawCount: cards.length - gradedCount,
  };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Downloads a list of CardRecord items as a CSV file in the browser
 */
export function exportCardsToCsv(
  cards: CardRecord[],
  customFilename?: string
): CsvExportSummary {
  const dateSlug = new Date().toISOString().slice(0, 10);
  const filename = customFilename || `cardvault-collection-${dateSlug}.csv`;
  downloadBlob(new Blob([generateCardsCsv(cards)], { type: 'text/csv;charset=utf-8;' }), filename);
  return summarize(cards, filename);
}

const slug = (s: string) => (s || 'card').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase().slice(0, 40) || 'card';

/**
 * Builds the ZIP contents: one CSV plus images/NNN_name_front.jpg and _back.jpg for every card.
 * The CSV's image file columns point at the files inside the archive.
 */
export function buildCardsZipEntries(cards: CardRecord[], csvName: string): ZipEntry[] {
  const imageFiles: ImageFileMap = new Map();
  const images: ZipEntry[] = [];
  const pad = String(cards.length).length < 3 ? 3 : String(cards.length).length;

  cards.forEach((c, i) => {
    const base = `images/${String(i + 1).padStart(pad, '0')}_${slug(c.name)}`;
    const files: { front?: string; back?: string } = {};
    if (c.frontImage?.startsWith('data:')) {
      files.front = `${base}_front.${dataUrlExtension(c.frontImage)}`;
      images.push({ name: files.front, data: dataUrlToBytes(c.frontImage) });
    }
    if (c.backImage?.startsWith('data:')) {
      files.back = `${base}_back.${dataUrlExtension(c.backImage)}`;
      images.push({ name: files.back, data: dataUrlToBytes(c.backImage) });
    }
    imageFiles.set(c.id, files);
  });

  const csv = new TextEncoder().encode(generateCardsCsv(cards, imageFiles));
  return [{ name: csvName, data: csv }, ...images];
}

/**
 * Downloads a single ZIP with the CSV and every front/back image, avoiding one browser download per image.
 */
export function exportCardsToZip(cards: CardRecord[], baseName: string): CsvExportSummary {
  const filename = `${baseName}.zip`;
  const zip = createZip(buildCardsZipEntries(cards, `${baseName}.csv`));
  downloadBlob(new Blob([zip], { type: 'application/zip' }), filename);
  return summarize(cards, filename);
}
