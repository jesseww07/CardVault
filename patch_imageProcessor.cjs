const fs = require('fs');
let data = fs.readFileSync('src/lib/imageProcessor.ts', 'utf8');

// Update pdfjs
data = data.replace(
  "const loadingTask = pdfjsLib.getDocument({ data: buffer });",
  "const loadingTask = pdfjsLib.getDocument({ data: buffer, cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`, cMapPacked: true });"
);

// Update cropAllSlots signature and implementation
const oldCropAllSlots = `export async function cropAllSlots(
  frontImageUrl: string,
  backImageUrl: string | undefined,
  template: ScannerTemplate,
  slots: ScannerSlot[],
  flipMode: FlipMode,
  rotationAngle = 0,
  skewAngle = 0
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

    // Crop front
    const frontCropped = await cropSlotFromImage(frontImg, slot, rotationAngle, skewAngle);

    // Crop back if available
    let backCropped: string | undefined = undefined;
    let mappedBackIdx = i;

    if (backImg) {
      try {
        mappedBackIdx = mapBackSlotIndex(i, template.rows, template.cols, flipMode);
        const targetBackSlot = slots[mappedBackIdx] || slot;
        backCropped = await cropSlotFromImage(backImg, targetBackSlot, rotationAngle, skewAngle);
      } catch (err) {
        console.warn(\`Failed to crop back slot index \${i}:\`, err);
        backCropped = undefined;
      }
    }

    results.push({
      slotIndex: i,
      frontSlotIndex: i,
      backSlotIndex: backImg ? mappedBackIdx : undefined,
      frontCroppedDataUrl: frontCropped,
      backCroppedDataUrl: backCropped,
      label: slot.label || \`Card \${i + 1}\`,
      active: true,
      status: 'pending',
    });
  }

  return results;
}`;

const newCropAllSlots = `export async function cropAllSlots(
  frontImageUrl: string,
  backImageUrl: string | undefined,
  template: ScannerTemplate,
  slots: ScannerSlot[],
  flipMode: FlipMode,
  rotationAngle = 0,
  skewAngle = 0,
  backSlots?: ScannerSlot[],
  backRotationAngle = 0,
  backSkewAngle = 0
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

    // Crop front
    const frontCropped = await cropSlotFromImage(frontImg, slot, rotationAngle, skewAngle);

    // Crop back if available
    let backCropped: string | undefined = undefined;
    let mappedBackIdx = i;

    if (backImg) {
      try {
        mappedBackIdx = mapBackSlotIndex(i, template.rows, template.cols, flipMode);
        const targetBackSlot = (backSlots && backSlots[mappedBackIdx]) || (backSlots && backSlots[i]) || slots[mappedBackIdx] || slot;
        backCropped = await cropSlotFromImage(backImg, targetBackSlot, backRotationAngle, backSkewAngle);
      } catch (err) {
        console.warn(\`Failed to crop back slot index \${i}:\`, err);
        backCropped = undefined;
      }
    }

    results.push({
      slotIndex: i,
      frontSlotIndex: i,
      backSlotIndex: backImg ? mappedBackIdx : undefined,
      frontCroppedDataUrl: frontCropped,
      backCroppedDataUrl: backCropped,
      label: slot.label || \`Card \${i + 1}\`,
      active: true,
      status: 'pending',
    });
  }

  return results;
}`;

data = data.replace(oldCropAllSlots, newCropAllSlots);
fs.writeFileSync('src/lib/imageProcessor.ts', data);
