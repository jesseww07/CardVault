import React, { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  Download,
  ShieldCheck,
  DollarSign,
  Layers,
  CheckCircle2,
  Check,
  HelpCircle,
  FileText
} from 'lucide-react';
import { CardRecord } from '../types';
import { exportCardsToCsv, CsvExportSummary } from '../lib/csvExporter';

interface ExportCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  allCards: CardRecord[];
  filteredCards: CardRecord[];
  selectedCardIds: string[];
  activeSearchQuery?: string;
  activeCategoryFilter?: string;
  activeCompanyFilter?: string;
  activeGradedFilter?: string;
  onExportComplete?: (summary: CsvExportSummary) => void;
}

export const ExportCsvModal: React.FC<ExportCsvModalProps> = ({
  isOpen,
  onClose,
  allCards,
  filteredCards,
  selectedCardIds,
  activeSearchQuery = '',
  activeCategoryFilter = 'all',
  activeCompanyFilter = 'all',
  activeGradedFilter = 'all',
  onExportComplete
}) => {
  if (!isOpen) return null;

  // Default scope priority: selected if > 0, else filtered if filter active, else all
  const defaultScope = selectedCardIds.length > 0
    ? 'selected'
    : (filteredCards.length < allCards.length ? 'filtered' : 'all');

  const [scope, setScope] = useState<'all' | 'filtered' | 'selected'>(defaultScope);
  const [customFilename, setCustomFilename] = useState(
    `cardvault-collection-${new Date().toISOString().slice(0, 10)}.csv`
  );

  // Compute cards for selected scope
  const targetCards = React.useMemo(() => {
    if (scope === 'selected') {
      return allCards.filter((c) => selectedCardIds.includes(c.id));
    }
    if (scope === 'filtered') {
      return filteredCards;
    }
    return allCards;
  }, [scope, allCards, filteredCards, selectedCardIds]);

  const totalVal = targetCards.reduce((sum, c) => sum + (c.estimatedValue || 0), 0);
  const gradedCount = targetCards.filter((c) => c.isGraded).length;
  const rawCount = targetCards.length - gradedCount;
  const highestValCard = targetCards.length > 0
    ? [...targetCards].sort((a, b) => (b.estimatedValue || 0) - (a.estimatedValue || 0))[0]
    : null;

  const handleDownload = () => {
    if (targetCards.length === 0) return;
    const summary = exportCardsToCsv(targetCards, customFilename.trim() || undefined);
    if (onExportComplete) {
      onExportComplete(summary);
    }
    onClose();
  };

  const hasActiveFilters = Boolean(
    activeSearchQuery.trim() ||
    activeCategoryFilter !== 'all' ||
    activeCompanyFilter !== 'all' ||
    activeGradedFilter !== 'all'
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div
        className="bg-[#0a0a0c] border border-white/10 rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-csv-title"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-[#050505]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.25)]">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 id="export-csv-title" className="text-base font-bold uppercase tracking-wider text-white">
                Export Catalog to CSV
              </h2>
              <p className="text-xs text-gray-400 font-mono">
                Spreadsheet-ready export with grading & market valuation data
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
            aria-label="Close export dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 font-mono text-xs">
          {/* Scope Selector */}
          <div>
            <label className="block text-gray-400 uppercase tracking-wider text-[11px] font-bold mb-2">
              Select Export Scope
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* All Cards */}
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`p-3 rounded-xl border text-left transition-all relative ${
                  scope === 'all'
                    ? 'bg-cyan-500/10 border-cyan-500 text-white shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                    : 'bg-[#050505] border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[11px] uppercase">All Cards</span>
                  {scope === 'all' && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                </div>
                <div className="text-lg font-black text-white">{allCards.length}</div>
                <span className="text-[10px] text-gray-500">Entire collection</span>
              </button>

              {/* Filtered View */}
              <button
                type="button"
                onClick={() => setScope('filtered')}
                className={`p-3 rounded-xl border text-left transition-all relative ${
                  scope === 'filtered'
                    ? 'bg-cyan-500/10 border-cyan-500 text-white shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                    : 'bg-[#050505] border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[11px] uppercase">Filtered</span>
                  {scope === 'filtered' && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                </div>
                <div className="text-lg font-black text-white">{filteredCards.length}</div>
                <span className="text-[10px] text-gray-500">
                  {hasActiveFilters ? 'Active search/filters' : 'Current view'}
                </span>
              </button>

              {/* Selected Cards */}
              <button
                type="button"
                disabled={selectedCardIds.length === 0}
                onClick={() => setScope('selected')}
                className={`p-3 rounded-xl border text-left transition-all relative ${
                  selectedCardIds.length === 0
                    ? 'opacity-40 cursor-not-allowed bg-[#050505] border-white/5 text-gray-600'
                    : scope === 'selected'
                    ? 'bg-cyan-500/10 border-cyan-500 text-white shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                    : 'bg-[#050505] border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[11px] uppercase">Selected</span>
                  {scope === 'selected' && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                </div>
                <div className="text-lg font-black text-white">{selectedCardIds.length}</div>
                <span className="text-[10px] text-gray-500">
                  {selectedCardIds.length === 0 ? 'No cards selected' : 'Marked with checkboxes'}
                </span>
              </button>
            </div>
          </div>

          {/* Export Metrics Summary Box */}
          <div className="bg-[#050505] border border-white/10 rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-3 gap-3 divide-x divide-white/10 text-center">
              <div>
                <span className="text-[10px] uppercase text-gray-500 block">Total Cards</span>
                <span className="text-base font-black text-white">{targetCards.length}</span>
              </div>
              <div className="pl-3">
                <span className="text-[10px] uppercase text-gray-500 block">Slabs / Raw</span>
                <span className="text-xs font-bold text-cyan-300">
                  {gradedCount} Slabs <span className="text-gray-500">•</span> {rawCount} Raw
                </span>
              </div>
              <div className="pl-3">
                <span className="text-[10px] uppercase text-gray-500 block">Est. Portfolio Value</span>
                <span className="text-base font-black text-emerald-400">
                  ${totalVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {highestValCard && (
              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-400">
                <span className="text-gray-500">Highest Valued:</span>
                <span className="text-white font-bold truncate max-w-[280px]">
                  {highestValCard.name} ({highestValCard.year}) —{' '}
                  <span className="text-emerald-400 font-mono">
                    ${(highestValCard.estimatedValue || 0).toLocaleString()}
                  </span>
                </span>
              </div>
            )}
          </div>

          {/* Included Data Breakdown */}
          <div className="space-y-1.5">
            <span className="text-gray-400 uppercase tracking-wider text-[11px] font-bold block">
              Included Data Columns (RFC 4180 Compliant)
            </span>
            <div className="bg-[#050505] border border-white/10 rounded-xl p-3 text-[11px] text-gray-300 space-y-2">
              <div className="flex flex-wrap gap-1.5">
                <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300">
                  Card ID
                </span>
                <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300">
                  Player / Title
                </span>
                <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300">
                  Year & Set
                </span>
                <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300">
                  Card #
                </span>
                <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300">
                  Category & Variation
                </span>
                <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-bold">
                  Grading Company & Grade
                </span>
                <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-bold">
                  Cert Number
                </span>
                <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-bold">
                  Subgrades (Centering/Corners/Edges/Surface/Auto)
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold">
                  Estimated Value & Currency
                </span>
                <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300">
                  Estimated Condition
                </span>
                <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300">
                  Tags & Notes
                </span>
                <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300">
                  Front & Back OCR Text
                </span>
                <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300">
                  Date Added
                </span>
              </div>
              <p className="text-[10px] text-gray-500 leading-normal pt-1">
                Formatted with UTF-8 BOM encoding for direct compatibility with Microsoft Excel, Apple Numbers, Google Sheets, and inventory systems.
              </p>
            </div>
          </div>

          {/* Filename Input */}
          <div>
            <label htmlFor="csv-filename-input" className="block text-gray-400 uppercase tracking-wider text-[11px] font-bold mb-1.5">
              File Name
            </label>
            <div className="relative">
              <input
                id="csv-filename-input"
                type="text"
                value={customFilename}
                onChange={(e) => setCustomFilename(e.target.value)}
                placeholder="cardvault-collection.csv"
                className="w-full bg-[#050505] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-white/10 bg-[#050505] flex items-center justify-between font-mono">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all"
          >
            Cancel
          </button>

          <button
            type="button"
            id="confirm-export-csv-button"
            disabled={targetCards.length === 0}
            onClick={handleDownload}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-2 transition-all ${
              targetCards.length === 0
                ? 'opacity-40 cursor-not-allowed bg-gray-800 text-gray-500'
                : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)] active:scale-95'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Download CSV ({targetCards.length})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
