import React, { useState } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, ShieldCheck, Check, Sparkles, Sliders } from 'lucide-react';

interface InspectQualityModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  cardName: string;
  side: 'front' | 'back';
  onRotate?: () => void;
}

export const InspectQualityModal: React.FC<InspectQualityModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  cardName,
  side,
  onRotate,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [showCenteringGrid, setShowCenteringGrid] = useState<boolean>(true);
  const [activeCorner, setActiveCorner] = useState<'full' | 'tl' | 'tr' | 'bl' | 'br'>('full');

  if (!isOpen) return null;

  return (
    <div
      id="modal-inspect-quality"
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
    >
      <div className="bg-[#0a0a0c] border border-white/10 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#050505]">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center space-x-2">
                <span>{cardName || 'Card Quality & Edge Inspection'}</span>
                <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-mono font-bold">
                  {side.toUpperCase()}
                </span>
              </h3>
              <p className="text-[10px] text-gray-400 font-mono">
                Verify 4 corners, edge whitening, perimeter borders & centering for buyer quality review.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {onRotate && (
              <button
                onClick={onRotate}
                className="px-3 py-1.5 bg-[#0a0a0c] hover:bg-white/5 border border-white/10 text-white rounded-lg text-xs font-mono flex items-center space-x-1.5 transition-all"
                title="Rotate 90°"
              >
                <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
                <span>Rotate</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewport Toolbar */}
        <div className="flex flex-wrap items-center justify-between px-6 py-2.5 bg-[#050505]/70 border-b border-white/5 gap-3">
          <div className="flex items-center space-x-1">
            <span className="text-[10px] font-mono uppercase text-gray-400 mr-2 font-bold">Corner Focus:</span>
            {[
              { id: 'full', label: 'Full Card' },
              { id: 'tl', label: 'Top-Left ↖' },
              { id: 'tr', label: 'Top-Right ↗' },
              { id: 'bl', label: 'Bottom-Left ↙' },
              { id: 'br', label: 'Bottom-Right ↘' },
            ].map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCorner(c.id as any)}
                className={`px-2.5 py-1 rounded text-xs font-mono transition-all ${
                  activeCorner === c.id
                    ? 'bg-cyan-500 text-black font-bold shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                    : 'bg-[#0a0a0c] text-gray-400 hover:text-white border border-white/5'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-3">
            <label className="flex items-center space-x-1.5 text-xs text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={showCenteringGrid}
                onChange={(e) => setShowCenteringGrid(e.target.checked)}
                className="accent-cyan-400 rounded"
              />
              <span className="font-mono text-[11px]">Centering Grid</span>
            </label>

            <div className="flex items-center space-x-1 bg-[#0a0a0c] border border-white/10 rounded-lg p-1">
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.25))}
                className="p-1 text-gray-400 hover:text-white"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono text-cyan-400 px-1 min-w-[42px] text-center font-bold">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                className="p-1 text-gray-400 hover:text-white"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Inspection Canvas Area */}
        <div className="flex-1 overflow-auto bg-[#030303] flex items-center justify-center p-6 min-h-[380px] relative">
          <div
            className="relative transition-transform duration-200 ease-out max-w-full max-h-full flex items-center justify-center"
            style={{
              transform: `scale(${zoomLevel})`,
              transformOrigin:
                activeCorner === 'tl'
                  ? 'top left'
                  : activeCorner === 'tr'
                  ? 'top right'
                  : activeCorner === 'bl'
                  ? 'bottom left'
                  : activeCorner === 'br'
                  ? 'bottom right'
                  : 'center center',
            }}
          >
            {/* Background matting frame to show perimeter clearly */}
            <div className="relative p-3 rounded-lg bg-zinc-950 border border-white/20 shadow-2xl">
              <img
                src={imageUrl}
                alt={cardName}
                className="max-h-[60vh] max-w-[70vw] object-contain rounded shadow-lg"
              />

              {/* Centering / Alignment overlay grid */}
              {showCenteringGrid && (
                <div className="absolute inset-3 pointer-events-none grid grid-cols-6 grid-rows-6 border border-cyan-400/40">
                  {Array.from({ length: 36 }).map((_, i) => (
                    <div key={i} className="border border-cyan-400/15" />
                  ))}
                  {/* Center Crosshair */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-full h-px bg-cyan-400/30" />
                    <div className="h-full w-px bg-cyan-400/30 absolute" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 bg-[#050505] border-t border-white/10 flex items-center justify-between text-xs font-mono text-gray-400">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
            <span>High-Resolution Edge Visibility Mode Enabled</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold uppercase tracking-wider rounded-lg text-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
