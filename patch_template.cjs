const fs = require('fs');
const file = 'src/lib/defaultTemplates.ts';
let data = fs.readFileSync(file, 'utf8');

const newTemplate = `  {
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
  },`;

const searchStr = `    isBuiltIn: true,
  },`;

// Find the index of the cgc-4-slab template ending
const cgc4SlabStart = data.indexOf("id: 'cgc-4-slab'");
const cgc4SlabEnd = data.indexOf(searchStr, cgc4SlabStart) + searchStr.length;

data = data.slice(0, cgc4SlabEnd) + '\n' + newTemplate + data.slice(cgc4SlabEnd);

fs.writeFileSync(file, data);
