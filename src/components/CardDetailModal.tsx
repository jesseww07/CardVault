import React, { useState } from 'react';
import {
  X,
  RefreshCw,
  ExternalLink,
  Save,
  Download,
  FileJson,
  FileSpreadsheet,
  Trash2,
  Tag,
  ShieldCheck,
  Calendar,
  DollarSign,
  Layers,
  Sparkles,
  FileText,
  Copy,
  Check
} from 'lucide-react';
import { CardRecord, CardCategory, GradingBrand } from '../types';
import { exportCardsToCsv } from '../lib/csvExporter';

interface CardDetailModalProps {
  card: CardRecord;
  onClose: () => void;
  onUpdate: (updatedCard: CardRecord) => void;
  onDelete: (cardId: string) => void;
}

export const CardDetailModal: React.FC<CardDetailModalProps> = ({
  card,
  onClose,
  onUpdate,
  onDelete,
}) => {
  const [formData, setFormData] = useState<CardRecord>({ ...card });
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');
  const [copiedCert, setCopiedCert] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');

  const handleFieldChange = (field: keyof CardRecord, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
      updatedAt: Date.now(),
    }));
  };

  const handleSubgradeChange = (subField: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      subgrades: {
        ...(prev.subgrades || {}),
        [subField]: value,
      },
      updatedAt: Date.now(),
    }));
  };

  const handleAddTag = () => {
    if (!newTagInput.trim()) return;
    if (!formData.tags.includes(newTagInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, newTagInput.trim()],
      }));
    }
    setNewTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tagToRemove),
    }));
  };

  const handleCopyCert = () => {
    if (formData.certNumber) {
      navigator.clipboard.writeText(formData.certNumber);
      setCopiedCert(true);
      setTimeout(() => setCopiedCert(false), 2000);
    }
  };

  const getCertLookupUrl = (): string | null => {
    if (!formData.certNumber) return null;
    const cert = encodeURIComponent(formData.certNumber.trim());
    switch (formData.gradingCompany) {
      case 'PSA':
        return `https://www.psacard.com/cert/${cert}`;
      case 'BGS':
        return `https://www.beckett.com/grading/cert-verification?cert_id=${cert}`;
      case 'CGC':
        return `https://www.cgccards.com/certlookup/${cert}/`;
      case 'SGC':
        return `https://www.gosgc.com/cert-code-lookup/${cert}`;
      default:
        return null;
    }
  };

  const certLookupUrl = getCertLookupUrl();

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0a0a0c] border border-white/10 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-[#050505] sticky top-0 z-10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold uppercase tracking-wider text-white leading-snug">{formData.name}</h2>
              <p className="text-xs text-gray-400 font-mono">
                {formData.year} {formData.set} • #{formData.cardNumber}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onDelete(formData.id)}
              className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all"
              title="Delete Card"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: 3D Flip Card Image Preview */}
          <div className="lg:col-span-5 space-y-4">
            <div className="relative aspect-[3/4] bg-black rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center p-3 shadow-2xl">
              <img
                src={
                  activeSide === 'back' && formData.backImage
                    ? formData.backImage
                    : formData.frontImage
                }
                alt={formData.name}
                className="max-h-full max-w-full object-contain rounded-xl shadow-2xl transition-all"
              />

              {/* Side indicator badge */}
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-md text-[10px] font-black uppercase tracking-wider text-cyan-400 border border-cyan-500/30">
                {activeSide.toUpperCase()} VIEW
              </div>

              {/* Flip Button */}
              {formData.backImage && (
                <button
                  onClick={() => setActiveSide((prev) => (prev === 'front' ? 'back' : 'front'))}
                  className="absolute bottom-3 right-3 px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-black uppercase tracking-wider shadow-[0_0_15px_rgba(6,182,212,0.4)] flex items-center space-x-2 transition-all active:scale-95"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Flip to {activeSide === 'front' ? 'Back' : 'Front'}</span>
                </button>
              )}
            </div>

            {/* Cert Lookup & Verification Banner */}
            {formData.certNumber && (
              <div className="bg-[#050505] border border-white/10 rounded-xl p-3 flex items-center justify-between font-mono">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-gray-300">
                    Cert #{formData.certNumber}
                  </span>
                  <button
                    onClick={handleCopyCert}
                    className="text-cyan-400 hover:text-white p-1 rounded"
                    title="Copy Cert Number"
                  >
                    {copiedCert ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {certLookupUrl && (
                  <a
                    href={certLookupUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center space-x-1 font-bold uppercase text-[10px] tracking-wider underline"
                  >
                    <span>Verify {formData.gradingCompany}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Right: Editable Card Fields */}
          <div className="lg:col-span-7 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
              <div className="sm:col-span-2">
                <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1 block">Player / Character Title</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  className="w-full bg-[#050505] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-bold focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1 block">Year</label>
                <input
                  type="text"
                  value={formData.year}
                  onChange={(e) => handleFieldChange('year', e.target.value)}
                  className="w-full bg-[#050505] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1 block">Card Number</label>
                <input
                  type="text"
                  value={formData.cardNumber}
                  onChange={(e) => handleFieldChange('cardNumber', e.target.value)}
                  className="w-full bg-[#050505] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1 block">Set / Product Series</label>
                <input
                  type="text"
                  value={formData.set}
                  onChange={(e) => handleFieldChange('set', e.target.value)}
                  className="w-full bg-[#050505] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1 block">Category / Sport</label>
                <select
                  value={formData.category}
                  onChange={(e) => handleFieldChange('category', e.target.value as CardCategory)}
                  className="w-full bg-[#050505] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                >
                  <option value="Baseball">Baseball</option>
                  <option value="Basketball">Basketball</option>
                  <option value="Football">Football</option>
                  <option value="Hockey">Hockey</option>
                  <option value="Soccer">Soccer</option>
                  <option value="Pokemon">Pokemon</option>
                  <option value="Magic: The Gathering">Magic: The Gathering</option>
                  <option value="Yu-Gi-Oh!">Yu-Gi-Oh!</option>
                  <option value="Non-Sport / Marvel">Marvel / Non-Sport</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1 block">Variation / Parallel</label>
                <input
                  type="text"
                  value={formData.variation}
                  onChange={(e) => handleFieldChange('variation', e.target.value)}
                  className="w-full bg-[#050505] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1 block">Estimated Value ($)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-emerald-400 font-bold">$</span>
                  <input
                    type="number"
                    value={formData.estimatedValue || 0}
                    onChange={(e) =>
                      handleFieldChange('estimatedValue', parseFloat(e.target.value) || 0)
                    }
                    className="w-full bg-[#050505] border border-white/10 rounded-xl pl-7 pr-3 py-2 text-emerald-400 font-bold focus:border-cyan-400 focus:outline-none text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1 block">Card Status</label>
                <div className="flex items-center space-x-2 pt-1">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isGraded}
                      onChange={(e) => handleFieldChange('isGraded', e.target.checked)}
                      className="rounded border-white/20 bg-black text-cyan-500 focus:ring-cyan-500"
                    />
                    <span className="text-gray-300 font-bold text-xs uppercase tracking-wide">Graded Slab</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Graded Slab Specific Section */}
            {formData.isGraded && (
              <div className="bg-[#050505] border border-white/10 rounded-2xl p-4 space-y-3 font-mono">
                <h4 className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Grading Company & Authenticity</span>
                </h4>

                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="text-[9px] uppercase font-bold text-gray-400 mb-1 block">Company</label>
                    <select
                      value={formData.gradingCompany}
                      onChange={(e) =>
                        handleFieldChange('gradingCompany', e.target.value as GradingBrand)
                      }
                      className="w-full bg-[#0a0a0c] border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs"
                    >
                      <option value="PSA">PSA</option>
                      <option value="BGS">BGS (Beckett)</option>
                      <option value="CGC">CGC Cards</option>
                      <option value="SGC">SGC</option>
                      <option value="TAG">TAG</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[9px] uppercase font-bold text-gray-400 mb-1 block">Grade</label>
                    <input
                      type="text"
                      value={formData.grade}
                      onChange={(e) => handleFieldChange('grade', e.target.value)}
                      placeholder="e.g. 10 or 9.5"
                      className="w-full bg-[#0a0a0c] border border-white/10 rounded-lg px-2.5 py-1.5 text-white font-bold text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] uppercase font-bold text-gray-400 mb-1 block">Cert Number</label>
                    <input
                      type="text"
                      value={formData.certNumber || ''}
                      onChange={(e) => handleFieldChange('certNumber', e.target.value)}
                      placeholder="Serial #"
                      className="w-full bg-[#0a0a0c] border border-white/10 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs"
                    />
                  </div>
                </div>

                {/* Subgrades */}
                <div className="pt-2 border-t border-white/10">
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1.5 block">
                    Subgrades (Centering / Corners / Edges / Surface)
                  </label>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-gray-500">Centering</span>
                      <input
                        type="text"
                        value={formData.subgrades?.centering || ''}
                        onChange={(e) => handleSubgradeChange('centering', e.target.value)}
                        placeholder="9.5"
                        className="w-full bg-[#0a0a0c] border border-white/10 rounded px-1.5 py-1 text-white text-center font-mono text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-gray-500">Corners</span>
                      <input
                        type="text"
                        value={formData.subgrades?.corners || ''}
                        onChange={(e) => handleSubgradeChange('corners', e.target.value)}
                        placeholder="10"
                        className="w-full bg-[#0a0a0c] border border-white/10 rounded px-1.5 py-1 text-white text-center font-mono text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-gray-500">Edges</span>
                      <input
                        type="text"
                        value={formData.subgrades?.edges || ''}
                        onChange={(e) => handleSubgradeChange('edges', e.target.value)}
                        placeholder="9.5"
                        className="w-full bg-[#0a0a0c] border border-white/10 rounded px-1.5 py-1 text-white text-center font-mono text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-gray-500">Surface</span>
                      <input
                        type="text"
                        value={formData.subgrades?.surface || ''}
                        onChange={(e) => handleSubgradeChange('surface', e.target.value)}
                        placeholder="10"
                        className="w-full bg-[#0a0a0c] border border-white/10 rounded px-1.5 py-1 text-white text-center font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tags Manager */}
            <div className="space-y-2 font-mono">
              <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Collection Tags</label>
              <div className="flex flex-wrap gap-1.5">
                {formData.tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-[#050505] text-cyan-300 text-xs border border-white/10"
                  >
                    <span>{t}</span>
                    <button
                      onClick={() => handleRemoveTag(t)}
                      className="text-gray-500 hover:text-white ml-1"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex space-x-2 pt-1">
                <input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                  placeholder="Add custom tag (e.g. PC, For Sale, Rookie)..."
                  className="flex-1 bg-[#050505] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                />
                <button
                  onClick={handleAddTag}
                  className="px-3 py-1.5 bg-[#050505] hover:bg-white/5 border border-white/10 text-white rounded-lg text-xs font-bold uppercase tracking-wider"
                >
                  Add
                </button>
              </div>
            </div>

            {/* OCR Transcribed Snippets */}
            {(formData.frontOcrText || formData.backOcrText) && (
              <div className="bg-[#050505] border border-white/10 rounded-xl p-3 space-y-1 text-xs font-mono">
                <div className="text-gray-400 font-bold uppercase text-[10px] tracking-wider flex items-center space-x-1.5">
                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                  <span>OCR Transcribed Text</span>
                </div>
                {formData.frontOcrText && (
                  <p className="text-gray-300 text-[11px] line-clamp-2">
                    Front: {formData.frontOcrText}
                  </p>
                )}
                {formData.backOcrText && (
                  <p className="text-gray-400 text-[11px] line-clamp-2">
                    Back: {formData.backOcrText}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-white/10 bg-[#050505] flex items-center justify-between font-mono">
          <div className="text-xs text-gray-500">
            Cataloged: {new Date(formData.createdAt).toLocaleDateString()}
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 mr-4 border-r border-white/10 pr-4">
               <button
                 onClick={() => {
                   const downloadImage = (dataUrl, filename) => {
                     const link = document.createElement('a');
                     link.href = dataUrl;
                     link.download = filename;
                     document.body.appendChild(link);
                     link.click();
                     document.body.removeChild(link);
                   };
                   
                   const safeName = (formData.name || 'card').replace(/[^a-z0-9]/gi, '_').toLowerCase();
                   downloadImage(formData.frontImage, `${safeName}_front.jpg`);
                   if (formData.backImage) {
                     setTimeout(() => {
                       downloadImage(formData.backImage, `${safeName}_back.jpg`);
                     }, 300);
                   }
                 }}
                 className="p-2 bg-[#0a0a0c] hover:bg-white/5 text-gray-300 rounded-lg text-xs font-bold border border-white/10"
                 title="Download Card Image(s)"
               >
                 <Download className="w-4 h-4" />
               </button>
               <button
                 onClick={() => {
                   const safeName = (formData.name || 'card').replace(/[^a-z0-9]/gi, '_').toLowerCase();
                   exportCardsToCsv([formData], `${safeName}_${formData.cardNumber || 'card'}.csv`);
                 }}
                 className="p-2 bg-[#0a0a0c] hover:bg-white/5 text-gray-300 hover:text-cyan-400 rounded-lg text-xs font-bold border border-white/10 transition-all"
                 title="Export Card to CSV"
               >
                 <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
               </button>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[#0a0a0c] hover:bg-white/5 text-gray-300 rounded-xl text-xs font-bold uppercase tracking-wider border border-white/10"
            >
              Cancel
            </button>
            <button
              id="btn-save-card-detail"
              onClick={() => {
                onUpdate(formData);
                onClose();
              }}
              className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-black uppercase tracking-wider rounded-xl text-xs shadow-[0_0_15px_rgba(6,182,212,0.4)] flex items-center space-x-2 transition-all active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Save Record</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
