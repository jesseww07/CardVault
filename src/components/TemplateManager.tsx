import React, { useState, useRef, useEffect } from 'react';
import {
  Sliders,
  Plus,
  Trash2,
  Save,
  Check,
  ShieldCheck,
  Layers,
  Sparkles,
  RefreshCw,
  Eye,
  Download
} from 'lucide-react';
import { ScannerTemplate, GradingBrand } from '../types';
import { generateGridSlots } from '../lib/defaultTemplates';

interface TemplateManagerProps {
  templates: ScannerTemplate[];
  onSaveTemplate: (template: ScannerTemplate) => void;
  onDeleteTemplate: (id: string) => void;
  initialSelectedId?: string;
}

export const TemplateManager: React.FC<TemplateManagerProps> = ({
  templates,
  onSaveTemplate,
  onDeleteTemplate,
  initialSelectedId,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<ScannerTemplate>(
    templates.find((t) => t.id === initialSelectedId) || templates[0]
  );

  const [isEditingCustom, setIsEditingCustom] = useState(false);
  const [templateForm, setTemplateForm] = useState<ScannerTemplate>({ ...selectedTemplate });
  const [savedSuccess, setSavedSuccess] = useState(false);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setTemplateForm({ ...selectedTemplate });
  }, [selectedTemplate]);

  // Render preview on canvas
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 800;
    const height = 1000;
    canvas.width = width;
    canvas.height = height;

    // Scanner bed background
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, width, height);

    // Bed grid lines
    ctx.strokeStyle = '#0e2229';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

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

    slots.forEach((slot, idx) => {
      const x = (slot.xPercent / 100) * width;
      const y = (slot.yPercent / 100) * height;
      const w = (slot.widthPercent / 100) * width;
      const h = (slot.heightPercent / 100) * height;

      ctx.save();
      ctx.fillStyle = templateForm.isSlab ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255, 255, 255, 0.05)';
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, templateForm.cornerRadius || 8);
      ctx.fill();
      ctx.stroke();

      // If slab, draw simulated label header
      if (templateForm.isSlab) {
        ctx.fillStyle = 'rgba(6, 182, 212, 0.3)';
        ctx.fillRect(x + 4, y + 4, w - 8, h * 0.22);
      }

      // Slot label
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px monospace';
      ctx.shadowBlur = 0;
      ctx.fillText(`SLOT ${idx + 1}`, x + 12, y + 25);
      ctx.restore();
    });
  }, [templateForm]);

  const handleCreateNew = () => {
    const newT: ScannerTemplate = {
      id: `custom-template-${Date.now()}`,
      name: 'New Custom Template',
      description: 'Custom flatbed scanner slot layout',
      brand: 'Custom',
      type: 'custom',
      isSlab: false,
      rows: 2,
      cols: 2,
      aspectRatio: 0.7,
      topMarginPercent: 6,
      bottomMarginPercent: 6,
      leftMarginPercent: 8,
      rightMarginPercent: 8,
      horizontalGapPercent: 6,
      verticalGapPercent: 6,
      cornerRadius: 8,
      isBuiltIn: false,
    };
    setSelectedTemplate(newT);
    setTemplateForm(newT);
    setIsEditingCustom(true);
  };

  const handleSave = () => {
    onSaveTemplate(templateForm);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleDownloadBlueprint = () => {
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

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 850 1100" width="8.5in" height="11in">
      <rect width="850" height="1100" fill="#ffffff" stroke="#000000" stroke-width="2"/>
      <text x="425" y="40" font-family="sans-serif" font-size="24" text-anchor="middle" font-weight="bold">${templateForm.name} - 8.5" x 11" Cut Blueprint</text>
      <text x="425" y="70" font-family="sans-serif" font-size="16" text-anchor="middle" fill="#666">Make sure to print at 100% scale (Do not fit to page)</text>`;

    slots.forEach(slot => {
      const x = (slot.xPercent / 100) * 850;
      const y = (slot.yPercent / 100) * 1100;
      const w = (slot.widthPercent / 100) * 850;
      const h = (slot.heightPercent / 100) * 1100;
      svg += `\n      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#ff0000" stroke-width="2"/>`;
      svg += `\n      <text x="${x + w/2}" y="${y + h/2}" font-family="sans-serif" font-size="14" text-anchor="middle" fill="#ff0000">${(w/100).toFixed(2)}" x ${(h/100).toFixed(2)}"</text>`;
    });

    svg += '\n</svg>';
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${templateForm.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_stencil.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#0a0a0c] border border-white/10 rounded-2xl p-5 flex items-center justify-between shadow-2xl">
        <div>
          <h2 className="text-base font-bold uppercase tracking-wider text-white flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-cyan-400" />
            <span>Scanner Calibration & Template Library</span>
          </h2>
          <p className="text-xs text-gray-400 font-mono mt-1">
            Fine-tune slot layouts for PSA, BGS, CGC, SGC graded slabs or create custom physical scanner templates.
          </p>
        </div>
        <button
          onClick={handleCreateNew}
          className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-black uppercase tracking-wider rounded-xl flex items-center space-x-1.5 shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>New Custom Preset</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Template List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-[#0a0a0c] border border-white/10 rounded-2xl p-4 space-y-2 shadow-xl">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono mb-3">
              Templates ({templates.length})
            </h3>
            <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1 font-mono">
              {templates.map((t) => (
                <div
                  key={t.id}
                  onClick={() => {
                    setSelectedTemplate(t);
                    setTemplateForm({ ...t });
                  }}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                    selectedTemplate.id === t.id
                      ? 'bg-cyan-500/15 border-cyan-500 text-white shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                      : 'bg-[#050505] border-white/10 text-gray-400 hover:border-white/20 hover:text-white'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="font-bold flex items-center space-x-2">
                      <span>{t.name}</span>
                      {t.isSlab ? (
                        <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 text-[9px] uppercase font-black">
                          SLAB
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded bg-white/10 text-gray-300 text-[9px] uppercase font-bold">
                          RAW
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {t.rows}x{t.cols} Grid • {t.rows * t.cols} slots
                    </div>
                  </div>

                  {!t.isBuiltIn && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete custom template "${t.name}"?`)) {
                          onDeleteTemplate(t.id);
                        }
                      }}
                      className="text-red-400 hover:text-red-300 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center: Template Controls */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-[#0a0a0c] border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center space-x-2 font-mono">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <span>Configure: {templateForm.name}</span>
            </h3>

            <div className="space-y-3 text-xs font-mono">
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1 block">Template Name</label>
                <input
                  type="text"
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                  className="w-full bg-[#050505] border border-white/10 rounded-lg px-3 py-1.5 text-white font-semibold focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1 block">Grid Rows</label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={templateForm.rows}
                    onChange={(e) =>
                      setTemplateForm({ ...templateForm, rows: parseInt(e.target.value) || 1 })
                    }
                    className="w-full bg-[#050505] border border-white/10 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1 block">Grid Columns</label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={templateForm.cols}
                    onChange={(e) =>
                      setTemplateForm({ ...templateForm, cols: parseInt(e.target.value) || 1 })
                    }
                    className="w-full bg-[#050505] border border-white/10 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1 block">Format Type</label>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="isSlab"
                      checked={templateForm.isSlab}
                      onChange={() => setTemplateForm({ ...templateForm, isSlab: true })}
                      className="text-cyan-500 accent-cyan-400"
                    />
                    <span className="text-gray-300">Graded Slab</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="isSlab"
                      checked={!templateForm.isSlab}
                      onChange={() => setTemplateForm({ ...templateForm, isSlab: false })}
                      className="text-cyan-500 accent-cyan-400"
                    />
                    <span className="text-gray-300">Raw Cards</span>
                  </label>
                </div>
              </div>

              {/* Margins */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
                <div>
                  <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                    <span>Top Margin</span>
                    <span className="text-cyan-400">{templateForm.topMarginPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="25"
                    value={templateForm.topMarginPercent}
                    onChange={(e) =>
                      setTemplateForm({
                        ...templateForm,
                        topMarginPercent: parseFloat(e.target.value),
                        bottomMarginPercent: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-cyan-400"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                    <span>Side Margin</span>
                    <span className="text-cyan-400">{templateForm.leftMarginPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="25"
                    value={templateForm.leftMarginPercent}
                    onChange={(e) =>
                      setTemplateForm({
                        ...templateForm,
                        leftMarginPercent: parseFloat(e.target.value),
                        rightMarginPercent: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-cyan-400"
                  />
                </div>
              </div>

              {/* Gaps */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                    <span>Horizontal Gap</span>
                    <span className="text-cyan-400">{templateForm.horizontalGapPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    value={templateForm.horizontalGapPercent}
                    onChange={(e) =>
                      setTemplateForm({
                        ...templateForm,
                        horizontalGapPercent: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-cyan-400"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                    <span>Vertical Gap</span>
                    <span className="text-cyan-400">{templateForm.verticalGapPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    value={templateForm.verticalGapPercent}
                    onChange={(e) =>
                      setTemplateForm({
                        ...templateForm,
                        verticalGapPercent: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-cyan-400"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 space-y-3">
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
              </div>
            </div>
          </div>
        </div>

        {/* Right: Real-time Visual Canvas Preview */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-[#0a0a0c] border border-white/10 rounded-2xl p-4 shadow-xl">
            <div className="flex items-center justify-between mb-3 text-xs font-mono text-gray-300">
              <span className="uppercase tracking-wider font-bold">Bed Layout Reticle</span>
              <span className="text-cyan-400">{templateForm.rows * templateForm.cols} slots</span>
            </div>

            <div className="aspect-[4/5] bg-black rounded-xl overflow-hidden border border-white/10 flex items-center justify-center p-2 shadow-2xl">
              <canvas
                ref={previewCanvasRef}
                className="max-h-full max-w-full object-contain rounded"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
