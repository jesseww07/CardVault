const fs = require('fs');
let data = fs.readFileSync('src/components/TemplateManager.tsx', 'utf8');

// 1. Add Download icon
data = data.replace('Eye\n} from \'lucide-react\';', 'Eye,\n  Download\n} from \'lucide-react\';');
if (!data.includes('Download\n}')) {
   data = data.replace('Eye } from \'lucide-react\';', 'Eye, Download } from \'lucide-react\';');
}

// 2. Add handleDownloadBlueprint
const downloadFunc = `  const handleDownloadBlueprint = () => {
    const slots = generateGridSlots(
      templateForm.rows,
      templateForm.cols,
      templateForm.topMarginPercent,
      templateForm.bottomMarginPercent,
      templateForm.leftMarginPercent,
      templateForm.rightMarginPercent,
      templateForm.horizontalGapPercent,
      templateForm.verticalGapPercent
    );

    let svg = \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 850 1100" width="8.5in" height="11in">
      <rect width="850" height="1100" fill="#ffffff" stroke="#000000" stroke-width="2"/>
      <text x="425" y="40" font-family="sans-serif" font-size="24" text-anchor="middle" font-weight="bold">\${templateForm.name} - 8.5" x 11" Cut Blueprint</text>
      <text x="425" y="70" font-family="sans-serif" font-size="16" text-anchor="middle" fill="#666">Make sure to print at 100% scale (Do not fit to page)</text>\`;

    slots.forEach(slot => {
      const x = (slot.xPercent / 100) * 850;
      const y = (slot.yPercent / 100) * 1100;
      const w = (slot.widthPercent / 100) * 850;
      const h = (slot.heightPercent / 100) * 1100;
      svg += \`\\n      <rect x="\${x}" y="\${y}" width="\${w}" height="\${h}" fill="none" stroke="#ff0000" stroke-width="2"/>\`;
      svg += \`\\n      <text x="\${x + w/2}" y="\${y + h/2}" font-family="sans-serif" font-size="14" text-anchor="middle" fill="#ff0000">\${(w/100).toFixed(2)}" x \${(h/100).toFixed(2)}"</text>\`;
    });

    svg += '\\n</svg>';
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = \`\${templateForm.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_stencil.svg\`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (`;
data = data.replace('  return (', downloadFunc);

// 3. Add button
const oldButtons = `<div className="pt-3 border-t border-white/10">
                <button
                  onClick={handleSave}
                  className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-black uppercase tracking-wider rounded-xl text-xs flex items-center justify-center space-x-2 shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all active:scale-95"
                >
                  {savedSuccess ? <Check className="w-4 h-4 text-emerald-950 font-black" /> : <Save className="w-4 h-4" />}
                  <span>{savedSuccess ? 'Preset Saved!' : 'Save Template Preset'}</span>
                </button>
              </div>`;
const newButtons = `<div className="pt-3 border-t border-white/10 space-y-3">
                <button
                  onClick={handleSave}
                  className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-black uppercase tracking-wider rounded-xl text-xs flex items-center justify-center space-x-2 shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all active:scale-95"
                >
                  {savedSuccess ? <Check className="w-4 h-4 text-emerald-950 font-black" /> : <Save className="w-4 h-4" />}
                  <span>{savedSuccess ? 'Preset Saved!' : 'Save Template Preset'}</span>
                </button>
                <button
                  onClick={handleDownloadBlueprint}
                  className="w-full py-2.5 bg-[#0a0a0c] hover:bg-[#15151a] border border-white/20 text-cyan-400 hover:text-cyan-300 font-bold uppercase tracking-wider rounded-xl text-xs flex items-center justify-center space-x-2 transition-all active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>Export Printable Stencil (SVG)</span>
                </button>
              </div>`;
data = data.replace(oldButtons, newButtons);

fs.writeFileSync('src/components/TemplateManager.tsx', data);
