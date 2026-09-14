import UTIF from 'utif';
import * as pdfjsLib from 'pdfjs-dist';
import { ScannerSlot, FlipMode, ScannerTemplate, CroppedSlotPair } from '../types';
import { detectCardsInElement, quadToSlot, DetectOptions, DetectionResult } from './cardDetector';

if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.mjs`;
}

async function decodePdfBuffer(buffer: ArrayBuffer): Promise<string> {
  const loadingTask = pdfjsLib.getDocument({ data: buffer, cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`, cMapPacked: true });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);
  
  const scale = 4.0;
  const viewport = page.getViewport({ scale });
  
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Failed to acquire canvas context for PDF rendering');
  
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  
  const renderContext: any = {
    canvasContext: context,
    viewport: viewport,
  };
  
  await page.render(renderContext).promise;
  
  return canvas.toDataURL('image/jpeg', 0.95);
}

/**
 * Checks if a binary buffer begins with TIFF magic numbers
 */
export function isTiffBuffer(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) return false;
  const bytes = new Uint8Array(buffer, 0, 4);
  const isLittleEndian = bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00;
  const isBigEndian = bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a;
  return isLittleEndian || isBigEndian;
}

/**
 * Decodes a TIFF ArrayBuffer into a PNG Data URL using UTIF
 */
export function decodeTiffBuffer(buffer: ArrayBuffer): string {
  const ifds = UTIF.decode(buffer);
  if (!ifds || ifds.length === 0) {
    throw new Error('Invalid TIFF image or no image pages found in file');
  }
  UTIF.decodeImage(buffer, ifds[0]);
  const rgba = UTIF.toRGBA8(ifds[0]);
  const width = ifds[0].width;
  const height = ifds[0].height;

  if (!width || !height || width <= 0 || height <= 0) {
    throw new Error('TIFF file contains invalid dimensions (0x0)');
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to acquire canvas context for TIFF decoding');

  const imgData = ctx.createImageData(width, height);
  imgData.data.set(rgba);
  ctx.putImageData(imgData, 0, 0);

  return canvas.toDataURL('image/png');
}

/**
 * Converts any uploaded scanner file (TIFF, TIF, PNG, JPG, WEBP) into a browser-compatible Data URL
 */
export async function processUploadFile(file: File): Promise<string> {
  const isTiffName = /\.tiff?$/i.test(file.name);
  const isTiffMime = file.type.includes('tiff') || file.type.includes('tif');
  const isPdfName = /\.pdf$/i.test(file.name);
  const isPdfMime = file.type.includes('pdf');

  const arrayBuffer = await file.arrayBuffer();

  if (isPdfName || isPdfMime) {
    try {
      return await decodePdfBuffer(arrayBuffer);
    } catch (err: any) {
      console.error('PDF decoding failed:', err);
      throw new Error(`Failed to decode PDF scan "${file.name}": ${err.message || 'Corrupted or unsupported PDF encoding'}`);
    }
  }

  if (isTiffName || isTiffMime || isTiffBuffer(arrayBuffer)) {
    try {
      return decodeTiffBuffer(arrayBuffer);
    } catch (err: any) {
      console.error('TIFF decoding failed:', err);
      throw new Error(`Failed to decode TIFF scan "${file.name}": ${err.message || 'Corrupted or unsupported TIFF encoding'}`);
    }
  }

  // Standard web image formats (PNG, JPEG, WebP, GIF, etc.)
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (typeof e.target?.result === 'string') {
        resolve(e.target.result);
      } else {
        reject(new Error('Failed to read image file data'));
      }
    };
    reader.onerror = () => reject(new Error('File reading error'));
    reader.readAsDataURL(file);
  });
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (!src || typeof src !== 'string' || !src.trim()) {
      reject(new Error('Image source URL is empty or undefined'));
      return;
    }

    const trimmed = src.trim();

    // Check if it is a TIFF data URL
    if (trimmed.startsWith('data:image/tiff') || trimmed.startsWith('data:image/tif')) {
      try {
        const base64Index = trimmed.indexOf('base64,');
        if (base64Index !== -1) {
          const b64 = trimmed.substring(base64Index + 7);
          const binStr = atob(b64);
          const len = binStr.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binStr.charCodeAt(i);
          }
          const pngDataUrl = decodeTiffBuffer(bytes.buffer);
          return loadImage(pngDataUrl).then(resolve).catch(reject);
        }
      } catch (err: any) {
        return reject(new Error(`Failed to decode base64 TIFF data: ${err.message}`));
      }
    }

    // Direct Image creation
    const img = new Image();

    const onImageLoaded = () => {
      if (img.naturalWidth === 0 || img.naturalHeight === 0) {
        reject(new Error('Image loaded with invalid 0x0 dimensions'));
      } else {
        resolve(img);
      }
    };

    img.onload = onImageLoaded;

    img.onerror = () => {
      // If it failed and is a remote URL, try fetching as blob/arrayBuffer (might be remote TIFF or CORS)
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        fetch(trimmed, { mode: 'cors' })
          .then(async (res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const arrayBuf = await res.arrayBuffer();
            if (isTiffBuffer(arrayBuf) || /\.tiff?$/i.test(trimmed)) {
              const pngUrl = decodeTiffBuffer(arrayBuf);
              return loadImage(pngUrl).then(resolve).catch(reject);
            }
            const blob = new Blob([arrayBuf]);
            const objectUrl = URL.createObjectURL(blob);
            const fallbackImg = new Image();
            fallbackImg.onload = () => {
              URL.revokeObjectURL(objectUrl);
              if (fallbackImg.naturalWidth === 0 || fallbackImg.naturalHeight === 0) {
                reject(new Error('Image decoded with invalid dimensions'));
              } else {
                resolve(fallbackImg);
              }
            };
            fallbackImg.onerror = () => {
              URL.revokeObjectURL(objectUrl);
              reject(new Error('Unable to decode image data or file format not supported'));
            };
            fallbackImg.src = objectUrl;
          })
          .catch(() => {
            reject(new Error('Unable to decode image data or file format not supported'));
          });
      } else {
        reject(new Error('Unable to decode image data or file format not supported'));
      }
    };

    // For data: or blob: urls, do NOT set crossOrigin
    if (!trimmed.startsWith('data:') && !trimmed.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }

    img.src = trimmed;

    // Check if already completed from cache
    if (img.complete && img.naturalWidth > 0) {
      resolve(img);
    }
  });
}

export function mapBackSlotIndex(
  frontSlotIndex: number,
  rows: number,
  cols: number,
  flipMode: FlipMode
): number {
  if (flipMode === 'direct') {
    return frontSlotIndex;
  }

  const row = Math.floor(frontSlotIndex / cols);
  const col = frontSlotIndex % cols;

  if (flipMode === 'horizontal') {
    // Book flip across vertical scanner axis: column is mirrored
    const mirroredCol = cols - 1 - col;
    return row * cols + mirroredCol;
  }

  if (flipMode === 'vertical') {
    // Calendar flip across horizontal scanner axis: row is mirrored
    const mirroredRow = rows - 1 - row;
    return mirroredRow * cols + col;
  }

  return frontSlotIndex;
}

/**
 * Rotates an image data URL by a specific angle (90, 180, 270, etc.)
 */
export async function rotateImageDataUrl(
  dataUrl: string,
  degrees: number
): Promise<string> {
  if (degrees % 360 === 0) return dataUrl;
  const img = await loadImage(dataUrl);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;

  const rad = (degrees * Math.PI) / 180;
  const isSwap = Math.abs(degrees % 180) === 90;

  canvas.width = isSwap ? img.naturalHeight : img.naturalWidth;
  canvas.height = isSwap ? img.naturalWidth : img.naturalHeight;

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rad);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

  return canvas.toDataURL('image/jpeg', 0.94);
}

/**
 * Downscales and compresses a large scan data URL to an optimized lightweight JPEG (<300KB)
 * for fast, reliable transmission to Gemini AI detection API without hitting payload/proxy limits.
 * Normalized coordinates (0-1000) are scale-invariant, so bounding box detection accuracy is preserved.
 */
export async function createOptimizedScanForApi(
  dataUrl: string,
  maxDimension = 1400,
  quality = 0.82
): Promise<string> {
  if (!dataUrl) return dataUrl;
  try {
    const img = await loadImage(dataUrl);
    if (!img.naturalWidth || !img.naturalHeight) return dataUrl;

    const { naturalWidth: w, naturalHeight: h } = img;
    // If already small and not a heavy PNG, we can use it directly
    if (w <= maxDimension && h <= maxDimension && dataUrl.length < 500000 && !dataUrl.startsWith('data:image/png')) {
      return dataUrl;
    }

    let targetW = w;
    let targetH = h;
    if (targetW > maxDimension || targetH > maxDimension) {
      if (targetW >= targetH) {
        targetH = Math.max(1, Math.round((targetH * maxDimension) / targetW));
        targetW = maxDimension;
      } else {
        targetW = Math.max(1, Math.round((targetW * maxDimension) / targetH));
        targetH = maxDimension;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetW, targetH);

    return canvas.toDataURL('image/jpeg', quality);
  } catch (err) {
    console.warn('Failed to downscale scan for API, proceeding with original dataUrl', err);
    return dataUrl;
  }
}

/**
 * Optimizes a cropped card data URL for OCR processing to keep batch requests lightweight (<150KB per card).
 */
export async function optimizeCroppedCardForOcr(
  dataUrl: string | undefined,
  maxDimension = 1100,
  quality = 0.86
): Promise<string | undefined> {
  if (!dataUrl) return undefined;
  try {
    // If already small JPEG, skip recompression
    if (dataUrl.length < 250000 && !dataUrl.startsWith('data:image/png')) {
      return dataUrl;
    }
    const img = await loadImage(dataUrl);
    if (!img.naturalWidth || !img.naturalHeight) return dataUrl;

    const { naturalWidth: w, naturalHeight: h } = img;
    let targetW = w;
    let targetH = h;
    if (targetW > maxDimension || targetH > maxDimension) {
      if (targetW >= targetH) {
        targetH = Math.max(1, Math.round((targetH * maxDimension) / targetW));
        targetW = maxDimension;
      } else {
        targetW = Math.max(1, Math.round((targetW * maxDimension) / targetH));
        targetH = maxDimension;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetW, targetH);

    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return dataUrl;
  }
}

/**
 * Local (no API) card edge detection. Returns rotated, edge-refined slots in reading order
 * plus a confidence score used to decide whether an AI detection call is needed.
 */
export async function detectCardEdgesCV(
  imageSource: string | HTMLImageElement,
  options: DetectOptions = {}
): Promise<{ slots: ScannerSlot[]; result: DetectionResult }> {
  const img = typeof imageSource === 'string' ? await loadImage(imageSource) : imageSource;
  const result = detectCardsInElement(img, options);
  const slots = result.quads.map((q, i) =>
    quadToSlot(q, result.sourceWidth, result.sourceHeight, i, `Card ${i + 1}`)
  );
  return { slots, result };
}

export async function cropSlotFromImage(
  imageSource: string | HTMLImageElement,
  slot: ScannerSlot,
  rotationAngle = 0,
  skewAngle = 0,
  edgeMarginPercent = 0,
  mattingBackground: 'dark' | 'black' | 'white' | 'original' = 'original',
  slotRotation = 0
): Promise<string> {
  const img = typeof imageSource === 'string' ? await loadImage(imageSource) : imageSource;

  if (!img || img.naturalWidth <= 0 || img.naturalHeight <= 0) {
    throw new Error('Source image has invalid dimensions');
  }

  // Create canvas for the full rotated scan if needed
  let sourceCanvas: HTMLCanvasElement;
  let sourceCtx: CanvasRenderingContext2D | null;

  // Per-slot deskew rotates around the slot's own center (see below); global angles rotate the whole scan.
  const slotDeskew = slot.deskewAngle || 0;
  const totalDeskew = rotationAngle + skewAngle;

  if (totalDeskew !== 0) {
    sourceCanvas = document.createElement('canvas');
    sourceCtx = sourceCanvas.getContext('2d');
    if (!sourceCtx) throw new Error('Failed to acquire 2D canvas context');

    const totalRad = (totalDeskew * Math.PI) / 180;
    const absCos = Math.abs(Math.cos(totalRad));
    const absSin = Math.abs(Math.sin(totalRad));
    const newWidth = Math.max(1, Math.floor(img.naturalWidth * absCos + img.naturalHeight * absSin));
    const newHeight = Math.max(1, Math.floor(img.naturalWidth * absSin + img.naturalHeight * absCos));

    sourceCanvas.width = newWidth;
    sourceCanvas.height = newHeight;

    sourceCtx.translate(newWidth / 2, newHeight / 2);
    sourceCtx.rotate(totalRad);
    sourceCtx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  } else {
    sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = img.naturalWidth;
    sourceCanvas.height = img.naturalHeight;
    sourceCtx = sourceCanvas.getContext('2d');
    if (!sourceCtx) throw new Error('Failed to acquire 2D canvas context');
    sourceCtx.drawImage(img, 0, 0);
  }

  // Calculate base crop coordinates
  let cropX = Math.round((slot.xPercent / 100) * sourceCanvas.width);
  let cropY = Math.round((slot.yPercent / 100) * sourceCanvas.height);
  let cropW = Math.round((slot.widthPercent / 100) * sourceCanvas.width);
  let cropH = Math.round((slot.heightPercent / 100) * sourceCanvas.height);

  const effectiveRotation = ((slot.rotation || 0) + (slotRotation || 0)) % 360;
  const isSwap = Math.abs(effectiveRotation % 180) === 90;

  if (slotDeskew !== 0) {
    // Rotated crop: map the slot center to the target center, then rotate by deskew + orientation.
    // Margins are applied symmetrically (no clamping) so the card stays centered; pixels falling
    // outside the scan are filled with the matting color.
    const outW = Math.round(cropW * (1 + (2 * edgeMarginPercent) / 100));
    const outH = Math.round(cropH * (1 + (2 * edgeMarginPercent) / 100));
    const targetCanvas = document.createElement('canvas');
    targetCanvas.width = Math.max(1, isSwap ? outH : outW);
    targetCanvas.height = Math.max(1, isSwap ? outW : outH);
    const targetCtx = targetCanvas.getContext('2d');
    if (!targetCtx) throw new Error('Failed to acquire target canvas context');

    const matteColors = { dark: '#0f172a', black: '#000000', white: '#ffffff', original: '#ffffff' };
    targetCtx.fillStyle = matteColors[mattingBackground];
    targetCtx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
    targetCtx.imageSmoothingEnabled = true;
    targetCtx.imageSmoothingQuality = 'high';
    targetCtx.translate(targetCanvas.width / 2, targetCanvas.height / 2);
    targetCtx.rotate(((effectiveRotation + slotDeskew) * Math.PI) / 180);
    targetCtx.drawImage(sourceCanvas, -(cropX + cropW / 2), -(cropY + cropH / 2));

    return targetCanvas.toDataURL('image/jpeg', 0.94);
  }

  // Apply edge margin padding if requested so 100% of card borders/corners are clearly visible
  if (edgeMarginPercent > 0) {
    const padW = Math.round(cropW * (edgeMarginPercent / 100));
    const padH = Math.round(cropH * (edgeMarginPercent / 100));
    cropX = Math.max(0, cropX - padW);
    cropY = Math.max(0, cropY - padH);
    cropW = Math.min(sourceCanvas.width - cropX, cropW + padW * 2);
    cropH = Math.min(sourceCanvas.height - cropY, cropH + padH * 2);
  }

  // Guard against out-of-bounds
  const safeX = Math.max(0, Math.min(cropX, sourceCanvas.width - 2));
  const safeY = Math.max(0, Math.min(cropY, sourceCanvas.height - 2));
  const safeW = Math.max(1, Math.min(cropW, sourceCanvas.width - safeX));
  const safeH = Math.max(1, Math.min(cropH, sourceCanvas.height - safeY));

  const targetCanvas = document.createElement('canvas');
  targetCanvas.width = isSwap ? safeH : safeW;
  targetCanvas.height = isSwap ? safeW : safeH;
  const targetCtx = targetCanvas.getContext('2d');
  if (!targetCtx) throw new Error('Failed to acquire target canvas context');

  // Background matting fill if specified
  if (mattingBackground === 'dark') {
    targetCtx.fillStyle = '#0f172a'; // slate-900
    targetCtx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
  } else if (mattingBackground === 'black') {
    targetCtx.fillStyle = '#000000';
    targetCtx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
  } else if (mattingBackground === 'white') {
    targetCtx.fillStyle = '#ffffff';
    targetCtx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
  }

  targetCtx.imageSmoothingEnabled = true;
  targetCtx.imageSmoothingQuality = 'high';

  if (effectiveRotation !== 0) {
    targetCtx.save();
    targetCtx.translate(targetCanvas.width / 2, targetCanvas.height / 2);
    targetCtx.rotate((effectiveRotation * Math.PI) / 180);
    targetCtx.drawImage(
      sourceCanvas,
      safeX,
      safeY,
      safeW,
      safeH,
      -safeW / 2,
      -safeH / 2,
      safeW,
      safeH
    );
    targetCtx.restore();
  } else {
    targetCtx.drawImage(
      sourceCanvas,
      safeX,
      safeY,
      safeW,
      safeH,
      0,
      0,
      safeW,
      safeH
    );
  }

  return targetCanvas.toDataURL('image/jpeg', 0.94);
}

export async function cropAllSlots(
  frontImageUrl: string,
  backImageUrl: string | undefined,
  template: ScannerTemplate,
  slots: ScannerSlot[],
  flipMode: FlipMode,
  rotationAngle = 0,
  skewAngle = 0,
  backSlots?: ScannerSlot[],
  backRotationAngle = 0,
  backSkewAngle = 0,
  edgeMarginPercent = 0,
  mattingBackground: 'dark' | 'black' | 'white' | 'original' = 'original'
): Promise<CroppedSlotPair[]> {
  const frontImg = await loadImage(frontImageUrl);
  let backImg: HTMLImageElement | null = null;

  if (backImageUrl && backImageUrl.trim()) {
    try {
      backImg = await loadImage(backImageUrl);
    } catch (err) {
      console.warn('Back scan image could not be loaded, proceeding with front-only:', err);
      backImg = null;
    }
  }

  const results: CroppedSlotPair[] = [];

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (!slot.active) continue;

    // Crop front with orientation normalization and full edge preservation
    const frontCropped = await cropSlotFromImage(
      frontImg,
      slot,
      rotationAngle,
      skewAngle,
      edgeMarginPercent,
      mattingBackground,
      slot.rotation || 0
    );

    // Crop back if available
    let backCropped: string | undefined = undefined;
    let mappedBackIdx = i;

    if (backImg) {
      try {
        mappedBackIdx = mapBackSlotIndex(i, template.rows, template.cols, flipMode);
        const targetBackSlot = (backSlots && backSlots[mappedBackIdx]) || (backSlots && backSlots[i]) || slots[mappedBackIdx] || slot;
        const backRotation = targetBackSlot.backRotation !== undefined 
          ? targetBackSlot.backRotation 
          : (slot.rotation || 0);

        backCropped = await cropSlotFromImage(
          backImg,
          targetBackSlot,
          backRotationAngle,
          backSkewAngle,
          edgeMarginPercent,
          mattingBackground,
          backRotation
        );
      } catch (err) {
        console.warn(`Failed to crop back slot index ${i}:`, err);
        backCropped = undefined;
      }
    }

    results.push({
      slotIndex: i,
      frontSlotIndex: i,
      backSlotIndex: backImg ? mappedBackIdx : undefined,
      frontCroppedDataUrl: frontCropped,
      backCroppedDataUrl: backCropped,
      label: slot.label || `Card ${i + 1}`,
      active: true,
      status: 'pending',
    });
  }

  return results;
}
