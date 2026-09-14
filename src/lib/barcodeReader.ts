/// <reference types="vite/client" />
/**
 * Browser barcode reader. The zxing WASM module is bundled by Vite and loaded on first use,
 * so it costs nothing until a batch is actually cropped.
 */

import type { BarcodeReadFn } from './slabBarcode';
import { SLAB_BARCODE_FORMATS } from './slabBarcode';

let readerPromise: Promise<BarcodeReadFn> | null = null;

export function getBarcodeReader(): Promise<BarcodeReadFn> {
  if (!readerPromise) {
    readerPromise = (async () => {
      const [zxing, { default: wasmUrl }] = await Promise.all([
        import('zxing-wasm/reader'),
        import('zxing-wasm/reader/zxing_reader.wasm?url'),
      ]);
      zxing.prepareZXingModule({
        overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) },
      });
      return async (image) => {
        const results = await zxing.readBarcodes(image, {
          formats: [...SLAB_BARCODE_FORMATS],
          tryHarder: true,
          tryRotate: true,
          tryInvert: true,
          tryDownscale: true,
          maxNumberOfSymbols: 4,
        });
        return results.filter((r) => r.isValid).map((r) => ({ text: r.text, format: r.format, rotation: r.rotation }));
      };
    })().catch((e) => {
      readerPromise = null;
      throw e;
    });
  }
  return readerPromise;
}
