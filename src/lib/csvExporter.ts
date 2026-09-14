import { CardRecord } from '../types';

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
 * Formats numeric monetary value cleanly for spreadsheet software
 */
function formatNumericValue(val: number | undefined | null): string {
  if (val === null || val === undefined || isNaN(val)) {
    return '0.00';
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

/**
 * Generates RFC 4180 compliant CSV text from an array of CardRecord items
 */
export function generateCardsCsv(cards: CardRecord[]): string {
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
    'Date Added',
    'Last Updated',
    'Scan Batch ID',
    'Slot Index'
  ];

  const rows = cards.map((c) => {
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
      escapeCsvValue(formatDate(c.createdAt)),
      escapeCsvValue(formatDate(c.updatedAt)),
      escapeCsvValue(c.scanBatchId || ''),
      escapeCsvValue(c.slotIndex !== undefined ? c.slotIndex + 1 : '')
    ].join(',');
  });

  // Prepend UTF-8 BOM (\uFEFF) so Excel, Numbers & Google Sheets decode special characters perfectly
  return '\uFEFF' + [headers.map(h => `"${h}"`).join(','), ...rows].join('\r\n');
}

/**
 * Downloads a list of CardRecord items as a CSV file in the browser
 */
export function exportCardsToCsv(
  cards: CardRecord[],
  customFilename?: string
): CsvExportSummary {
  const count = cards.length;
  const totalEstimatedValue = cards.reduce((sum, c) => sum + (c.estimatedValue || 0), 0);
  const gradedCount = cards.filter((c) => c.isGraded).length;
  const rawCount = count - gradedCount;

  const dateSlug = new Date().toISOString().slice(0, 10);
  const filename = customFilename || `cardvault-collection-${dateSlug}.csv`;

  const csvContent = generateCardsCsv(cards);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return {
    success: true,
    count,
    totalEstimatedValue,
    filename,
    gradedCount,
    rawCount
  };
}
