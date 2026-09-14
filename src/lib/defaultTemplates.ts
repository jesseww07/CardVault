import { ScannerTemplate, ScannerSlot } from '../types';

export function generateGridSlots(
  rows: number,
  cols: number,
  topMarginPercent: number,
  bottomMarginPercent: number,
  leftMarginPercent: number,
  rightMarginPercent: number,
  horizontalGapPercent: number,
  verticalGapPercent: number
): ScannerSlot[] {
  const slots: ScannerSlot[] = [];
  const totalHorizontalGap = (cols - 1) * horizontalGapPercent;
  const totalVerticalGap = (rows - 1) * verticalGapPercent;

  const availableWidth = 100 - leftMarginPercent - rightMarginPercent - totalHorizontalGap;
  const availableHeight = 100 - topMarginPercent - bottomMarginPercent - totalVerticalGap;

  const slotWidth = availableWidth / cols;
  const slotHeight = availableHeight / rows;

  let id = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = leftMarginPercent + c * (slotWidth + horizontalGapPercent);
      const y = topMarginPercent + r * (slotHeight + verticalGapPercent);

      slots.push({
        id: id++,
        active: true,
        xPercent: Math.max(0, Math.min(100, x)),
        yPercent: Math.max(0, Math.min(100, y)),
        widthPercent: Math.max(1, Math.min(100, slotWidth)),
        heightPercent: Math.max(1, Math.min(100, slotHeight)),
        label: `Slot ${id} (R${r + 1}C${c + 1})`,
      });
    }
  }

  return slots;
}

export const DEFAULT_TEMPLATES: ScannerTemplate[] = [
  {
    id: 'psa-4-slab',
    name: 'PSA 4-Slab Flatbed (2x2)',
    description: 'Precision layout for 4 PSA graded slabs placed on standard 8.5x11" flatbed scanner.',
    brand: 'PSA',
    type: 'slab-psa',
    isSlab: true,
    rows: 2,
    cols: 2,
    aspectRatio: 3.125 / 5.375, // ~0.58
    topMarginPercent: 5.5,
    bottomMarginPercent: 5.5,
    leftMarginPercent: 8,
    rightMarginPercent: 8,
    horizontalGapPercent: 5,
    verticalGapPercent: 5,
    cornerRadius: 12,
    isBuiltIn: true,
  },
  {
    id: 'psa-6-slab',
    name: 'PSA 6-Slab Flatbed (2x3)',
    description: 'High-density 6-slab scanner layout for PSA encapsulation cases.',
    brand: 'PSA',
    type: 'slab-psa',
    isSlab: true,
    rows: 2,
    cols: 3,
    aspectRatio: 3.125 / 5.375,
    topMarginPercent: 4,
    bottomMarginPercent: 4,
    leftMarginPercent: 4,
    rightMarginPercent: 4,
    horizontalGapPercent: 3.5,
    verticalGapPercent: 4,
    cornerRadius: 12,
    isBuiltIn: true,
  },
  {
    id: 'bgs-4-slab',
    name: 'BGS Beckett 4-Slab (2x2)',
    description: 'Calibrated for Beckett Grading Services (BGS) thick acrylic cases & subgrade labels.',
    brand: 'BGS',
    type: 'slab-bgs',
    isSlab: true,
    rows: 2,
    cols: 2,
    aspectRatio: 3.25 / 5.125, // ~0.63
    topMarginPercent: 6,
    bottomMarginPercent: 6,
    leftMarginPercent: 7.5,
    rightMarginPercent: 7.5,
    horizontalGapPercent: 5.5,
    verticalGapPercent: 5.5,
    cornerRadius: 14,
    isBuiltIn: true,
  },
  {
    id: 'cgc-4-slab',
    name: 'CGC Cards 4-Slab (2x2)',
    description: 'Optimized for modern CGC Cards & CGC Trading Cards slabs with high-clarity labels.',
    brand: 'CGC',
    type: 'slab-cgc',
    isSlab: true,
    rows: 2,
    cols: 2,
    aspectRatio: 3.18 / 5.35, // ~0.59
    topMarginPercent: 5.5,
    bottomMarginPercent: 5.5,
    leftMarginPercent: 8,
    rightMarginPercent: 8,
    horizontalGapPercent: 5,
    verticalGapPercent: 5,
    cornerRadius: 12,
    isBuiltIn: true,
  },
  {
    id: 'cgc-4-slab-foam',
    name: 'CGC Cards 4-Slab (Foam Backing)',
    description: 'Custom optimized layout for CGC slabs scanned with the foam backing offset (tighter left/top margins, larger right margin).',
    brand: 'CGC',
    type: 'slab-cgc',
    isSlab: true,
    rows: 2,
    cols: 2,
    aspectRatio: 3.18 / 5.35,
    topMarginPercent: 2,
    bottomMarginPercent: 6.5,
    leftMarginPercent: 3.5,
    rightMarginPercent: 13,
    horizontalGapPercent: 4.5,
    verticalGapPercent: 3.5,
    cornerRadius: 12,
    isBuiltIn: true,
  },
  {
    id: 'sgc-4-slab',
    name: 'SGC "Tuxedo" 4-Slab (2x2)',
    description: 'Tailored for Sportscard Guaranty Corporation (SGC) classic black insert slabs.',
    brand: 'SGC',
    type: 'slab-sgc',
    isSlab: true,
    rows: 2,
    cols: 2,
    aspectRatio: 3.3 / 5.4, // ~0.61
    topMarginPercent: 5,
    bottomMarginPercent: 5,
    leftMarginPercent: 7,
    rightMarginPercent: 7,
    horizontalGapPercent: 5,
    verticalGapPercent: 5,
    cornerRadius: 16,
    isBuiltIn: true,
  },
  {
    id: 'raw-8-letter',
    name: 'Raw Cards 8-Card Letter Sheet (2x4)',
    description: 'Letter-size (8.5x11") template with 8 horizontal raw card slots (4 rows x 2 columns) with calibration registration marks.',
    brand: 'Raw',
    type: 'raw-grid',
    isSlab: false,
    rows: 4,
    cols: 2,
    aspectRatio: 3.5 / 2.5, // 1.4 landscape card pocket
    topMarginPercent: 2.2,
    bottomMarginPercent: 2.2,
    leftMarginPercent: 5.6,
    rightMarginPercent: 5.6,
    horizontalGapPercent: 5.6,
    verticalGapPercent: 1.8,
    cornerRadius: 4,
    isBuiltIn: true,
  },
  {
    id: 'raw-9-pocket',
    name: 'Raw Cards 9-Pocket Sheet (3x3)',
    description: 'Standard 9-card binder page or 3x3 flatbed scan template for standard 2.5x3.5" cards.',
    brand: 'Raw',
    type: 'raw-grid',
    isSlab: false,
    rows: 3,
    cols: 3,
    aspectRatio: 2.5 / 3.5, // ~0.714
    topMarginPercent: 3.5,
    bottomMarginPercent: 3.5,
    leftMarginPercent: 4.5,
    rightMarginPercent: 4.5,
    horizontalGapPercent: 3.2,
    verticalGapPercent: 3.2,
    cornerRadius: 6,
    isBuiltIn: true,
  },
  {
    id: 'raw-6-grid',
    name: 'Raw Cards 6-Card Grid (2x3)',
    description: 'Spacious 6-card flatbed grid for oversized or spaced raw trading cards.',
    brand: 'Raw',
    type: 'raw-grid',
    isSlab: false,
    rows: 2,
    cols: 3,
    aspectRatio: 2.5 / 3.5,
    topMarginPercent: 7,
    bottomMarginPercent: 7,
    leftMarginPercent: 6,
    rightMarginPercent: 6,
    horizontalGapPercent: 4.5,
    verticalGapPercent: 6,
    cornerRadius: 6,
    isBuiltIn: true,
  },
  {
    id: 'raw-4-grid',
    name: 'Raw Cards 4-Card Grid (2x2)',
    description: '4-card layout for raw cards, semi-rigid holders (Card Saver I), or magnetic One-Touch cases.',
    brand: 'Raw',
    type: 'raw-grid',
    isSlab: false,
    rows: 2,
    cols: 2,
    aspectRatio: 2.5 / 3.5,
    topMarginPercent: 8,
    bottomMarginPercent: 8,
    leftMarginPercent: 12,
    rightMarginPercent: 12,
    horizontalGapPercent: 8,
    verticalGapPercent: 8,
    cornerRadius: 8,
    isBuiltIn: true,
  },
  {
    id: 'auto-ai-detect',
    name: 'AI Auto-Detect & Crop',
    description: 'Uses computer vision to automatically detect cards/slabs at any position or angle on the scanner bed.',
    brand: 'Custom',
    type: 'auto-detect',
    isSlab: false,
    rows: 1,
    cols: 1,
    aspectRatio: 0.7,
    topMarginPercent: 0,
    bottomMarginPercent: 0,
    leftMarginPercent: 0,
    rightMarginPercent: 0,
    horizontalGapPercent: 0,
    verticalGapPercent: 0,
    cornerRadius: 6,
    isBuiltIn: true,
  },
];

export function getTemplateSlots(template: ScannerTemplate): ScannerSlot[] {
  if (template.customSlots && template.customSlots.length > 0) {
    return template.customSlots;
  }
  return generateGridSlots(
    template.rows,
    template.cols,
    template.topMarginPercent,
    template.bottomMarginPercent,
    template.leftMarginPercent,
    template.rightMarginPercent,
    template.horizontalGapPercent,
    template.verticalGapPercent
  );
}
