import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crc32 as zlibCrc32 } from 'node:zlib';
import { buildCardsZipEntries, generateCardsCsv } from './csvExporter';
import { createZip, crc32, dataUrlExtension, dataUrlToBytes } from './zip';
import type { CardRecord } from '../types';

const jpeg = (bytes: number[]) => `data:image/jpeg;base64,${Buffer.from(bytes).toString('base64')}`;

const record = (over: Partial<CardRecord> = {}): CardRecord => ({
  id: 'card-1',
  createdAt: Date.UTC(2026, 8, 13),
  updatedAt: Date.UTC(2026, 8, 13),
  frontImage: jpeg([0xff, 0xd8, 1, 2, 3]),
  backImage: jpeg([0xff, 0xd8, 4, 5]),
  name: 'Ken Griffey Jr.',
  year: '1989',
  set: 'Upper Deck',
  cardNumber: '#1',
  category: 'Baseball',
  variation: 'Star Rookie',
  isGraded: true,
  gradingCompany: 'PSA',
  grade: '9',
  certNumber: '81039471',
  certSource: 'barcode',
  certLookupUrl: 'https://www.psacard.com/cert/81039471',
  tags: ['RC', 'HOF'],
  notes: 'Says "Star Rookie", on front',
  scanBatchId: 'batch-20260913-101500',
  slotIndex: 0,
  ...over,
});

/** Minimal CSV parser for quoted RFC 4180 output. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\r' && text[i + 1] === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; }
    else field += ch;
  }
  row.push(field);
  rows.push(row);
  return rows;
}

const asObjects = (csv: string) => {
  const [headers, ...rows] = parseCsv(csv.replace(/^\uFEFF/, ''));
  return rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i]])));
};

describe('generateCardsCsv', () => {
  it('writes cert provenance, review flags and escapes quotes and commas', () => {
    const csv = generateCardsCsv([record({ needsReview: true, reviewReasons: ['Grade not read', 'Cert number not found'] })]);
    assert.ok(csv.startsWith('\uFEFF'));
    const [row] = asObjects(csv);
    assert.equal(row['Cert Number'], '81039471');
    assert.equal(row['Cert Source'], 'barcode');
    assert.equal(row['Cert Lookup URL'], 'https://www.psacard.com/cert/81039471');
    assert.equal(row['Notes'], 'Says "Star Rookie", on front');
    assert.equal(row['Needs Review'], 'Yes');
    assert.equal(row['Review Reasons'], 'Grade not read; Cert number not found');
    assert.equal(row['Scan Batch ID'], 'batch-20260913-101500');
    assert.equal(row['Slot Index'], '1');
  });

  it('leaves unknown value blank instead of 0.00', () => {
    const [row] = asObjects(generateCardsCsv([record({ estimatedValue: undefined })]));
    assert.equal(row['Estimated Value'], '');
    const [priced] = asObjects(generateCardsCsv([record({ estimatedValue: 125 })]));
    assert.equal(priced['Estimated Value'], '125.00');
  });
});

describe('buildCardsZipEntries', () => {
  it('bundles the CSV with front/back images and links them by file name', () => {
    const cards = [record(), record({ id: 'card-2', name: 'Bo Jackson / RC', backImage: undefined })];
    const entries = buildCardsZipEntries(cards, 'cardvault-batch.csv');
    assert.deepEqual(entries.map((e) => e.name), [
      'cardvault-batch.csv',
      'images/001_ken_griffey_jr_front.jpg',
      'images/001_ken_griffey_jr_back.jpg',
      'images/002_bo_jackson_rc_front.jpg',
    ]);
    assert.deepEqual(Array.from(entries[1].data), [0xff, 0xd8, 1, 2, 3]);

    const rows = asObjects(new TextDecoder().decode(entries[0].data));
    assert.equal(rows[0]['Front Image File'], 'images/001_ken_griffey_jr_front.jpg');
    assert.equal(rows[0]['Back Image File'], 'images/001_ken_griffey_jr_back.jpg');
    assert.equal(rows[1]['Back Image File'], '');
  });
});

describe('createZip', () => {
  /** Reads a stored ZIP via its central directory, the way unzip tools do. */
  function readZip(zip: Uint8Array) {
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    const endOffset = zip.length - 22;
    assert.equal(view.getUint32(endOffset, true), 0x06054b50, 'end of central directory signature');
    const count = view.getUint16(endOffset + 10, true);
    let p = view.getUint32(endOffset + 16, true);
    const files: { name: string; data: Uint8Array; crc: number }[] = [];
    for (let i = 0; i < count; i++) {
      assert.equal(view.getUint32(p, true), 0x02014b50, 'central directory signature');
      const crc = view.getUint32(p + 16, true);
      const size = view.getUint32(p + 24, true);
      const nameLen = view.getUint16(p + 28, true);
      const localOffset = view.getUint32(p + 42, true);
      const name = new TextDecoder().decode(zip.subarray(p + 46, p + 46 + nameLen));
      assert.equal(view.getUint32(localOffset, true), 0x04034b50, 'local header signature');
      const localNameLen = view.getUint16(localOffset + 26, true);
      const start = localOffset + 30 + localNameLen;
      files.push({ name, data: zip.subarray(start, start + size), crc });
      p += 46 + nameLen;
    }
    return files;
  }

  it('produces an archive whose entries and checksums round-trip', () => {
    const entries = [
      { name: 'cards.csv', data: new TextEncoder().encode('a,b\r\n1,2') },
      { name: 'images/001_café_front.jpg', data: new Uint8Array([255, 216, 0, 1, 2, 250]) },
      { name: 'empty.txt', data: new Uint8Array() },
    ];
    const files = readZip(createZip(entries));
    assert.deepEqual(files.map((f) => f.name), entries.map((e) => e.name));
    files.forEach((f, i) => {
      assert.deepEqual(Array.from(f.data), Array.from(entries[i].data));
      assert.equal(f.crc, zlibCrc32(entries[i].data));
    });
  });

  it('computes standard CRC-32', () => {
    assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  });
});

describe('data URL helpers', () => {
  it('decodes bytes and picks the file extension', () => {
    assert.deepEqual(Array.from(dataUrlToBytes(jpeg([1, 2, 3]))), [1, 2, 3]);
    assert.equal(dataUrlExtension('data:image/png;base64,AA'), 'png');
    assert.equal(dataUrlExtension('data:image/jpeg;base64,AA'), 'jpg');
  });
});
