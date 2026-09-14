import React from 'react';
import { Printer, ArrowLeft, Download, ShieldCheck } from 'lucide-react';
import { CardRecord } from '../types';

interface PrintInventoryViewProps {
  cards: CardRecord[];
  onBack: () => void;
}

export const PrintInventoryView: React.FC<PrintInventoryViewProps> = ({ cards, onBack }) => {
  const handlePrint = () => {
    window.print();
  };

  const totalValue = cards.reduce((sum, c) => sum + (c.estimatedValue || 0), 0);

  return (
    <div className="space-y-6">
      {/* Print Controls (Hidden when printing) */}
      <div className="bg-[#0a0a0c] border border-white/10 rounded-2xl p-5 flex items-center justify-between shadow-2xl print:hidden">
        <div>
          <h2 className="text-base font-bold uppercase tracking-wider text-white flex items-center space-x-2">
            <Printer className="w-5 h-5 text-cyan-400" />
            <span>Collection Catalog & Binder Export</span>
          </h2>
          <p className="text-xs text-gray-400 font-mono mt-1">
            Formatted for physical printing, insurance documentation, consignment records, or binder sleeves.
          </p>
        </div>
        <div className="flex items-center space-x-3 font-mono">
          <button
            onClick={onBack}
            className="px-4 py-2 bg-[#050505] hover:bg-white/5 border border-white/10 text-gray-300 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
          >
            Back to Database
          </button>
          <button
            onClick={handlePrint}
            className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-black uppercase tracking-wider rounded-xl flex items-center space-x-2 shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>Print Document</span>
          </button>
        </div>
      </div>

      {/* Printable Sheet (Standard Paper Styling for Print) */}
      <div className="bg-white text-slate-900 rounded-2xl p-8 shadow-2xl print:p-0 print:shadow-none print:bg-white print:text-black">
        {/* Document Header */}
        <div className="border-b-2 border-slate-900 pb-4 mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              CARDVAULT INVENTORY REPORT
            </h1>
            <p className="text-xs text-slate-600 font-medium mt-0.5">
              Trading Card Batch Scan & Authentication Catalog
            </p>
          </div>
          <div className="text-right text-xs">
            <div className="font-bold text-slate-900">{cards.length} Total Cards Cataloged</div>
            <div className="text-emerald-700 font-bold text-sm">
              Est. Portfolio Value: ${totalValue.toLocaleString()}
            </div>
            <div className="text-slate-500 text-[10px]">
              Generated on {new Date().toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Printable Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
          {cards.map((card, idx) => (
            <div
              key={card.id}
              className="border border-slate-300 rounded-xl p-3 space-y-2 bg-slate-50/50 print:border-slate-400 print:bg-transparent page-break-inside-avoid"
            >
              {/* Dual Front / Back Thumbnail Strip */}
              <div className="grid grid-cols-2 gap-2 aspect-[3/2] bg-white rounded-lg p-1 border border-slate-200">
                <div className="h-full flex items-center justify-center">
                  <img
                    src={card.frontImage}
                    alt={card.name}
                    className="max-h-full max-w-full object-contain rounded"
                  />
                </div>
                {card.backImage ? (
                  <div className="h-full flex items-center justify-center">
                    <img
                      src={card.backImage}
                      alt={`${card.name} back`}
                      className="max-h-full max-w-full object-contain rounded"
                    />
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-[9px] text-slate-400">
                    No Back Scan
                  </div>
                )}
              </div>

              {/* Information */}
              <div className="space-y-0.5 text-xs">
                <div className="font-bold text-slate-900 truncate">{card.name}</div>
                <div className="text-slate-600 text-[11px]">
                  {card.year} {card.set} • {card.cardNumber}
                </div>
                <div className="flex items-center justify-between text-[11px] pt-1">
                  <span className="font-bold text-slate-800">
                    {card.isGraded ? `${card.gradingCompany} ${card.grade}` : 'Raw Card'}
                  </span>
                  {card.estimatedValue && (
                    <span className="font-bold text-emerald-700">${card.estimatedValue}</span>
                  )}
                </div>
                {card.certNumber && (
                  <div className="text-[10px] font-mono text-slate-500">Cert: #{card.certNumber}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
