import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isTiffBuffer, mapBackSlotIndex } from './imageProcessor';

describe('mapBackSlotIndex', () => {
  // 3x3 grid, front indices:
  // 0 1 2
  // 3 4 5
  // 6 7 8
  it('mirrors columns for a horizontal (book) flip', () => {
    assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => mapBackSlotIndex(i, 3, 3, 'horizontal')), [2, 1, 0, 5, 4, 3, 8, 7, 6]);
  });

  it('mirrors rows for a vertical (calendar) flip', () => {
    assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => mapBackSlotIndex(i, 3, 3, 'vertical')), [6, 7, 8, 3, 4, 5, 0, 1, 2]);
  });

  it('keeps indices for direct and AI matching', () => {
    assert.equal(mapBackSlotIndex(5, 3, 3, 'direct'), 5);
    assert.equal(mapBackSlotIndex(5, 3, 3, 'ai-match'), 5);
  });

  it('handles non-square grids', () => {
    // 4 rows x 2 cols
    assert.equal(mapBackSlotIndex(0, 4, 2, 'horizontal'), 1);
    assert.equal(mapBackSlotIndex(7, 4, 2, 'vertical'), 1);
  });
});

describe('isTiffBuffer', () => {
  it('recognizes little- and big-endian TIFF headers', () => {
    assert.equal(isTiffBuffer(new Uint8Array([0x49, 0x49, 0x2a, 0x00, 1]).buffer), true);
    assert.equal(isTiffBuffer(new Uint8Array([0x4d, 0x4d, 0x00, 0x2a, 1]).buffer), true);
  });

  it('rejects other formats and short buffers', () => {
    assert.equal(isTiffBuffer(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer), false);
    assert.equal(isTiffBuffer(new Uint8Array([0x49, 0x49]).buffer), false);
  });
});
