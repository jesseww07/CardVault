import React from 'react';
import {
  Wand2,
  Sliders,
  RotateCw,
  RotateCcw,
  RefreshCw,
  Layers,
  ShieldCheck,
  Maximize2,
  Sparkles,
  CheckCircle2,
  Square,
  Compass,
} from 'lucide-react';
import { ScannerSlot, FlipMode } from '../types';

interface AutoEdgeControlsProps {
  scanMode: 'auto-detect' | 'template';
  onScanModeChange: (mode: 'auto-detect' | 'template') => void;
  isDetecting: boolean;
  onRunAutoDetect: () => void;
  detectedCount: number;
  edgeMarginPercent: number;
  onEdgeMarginChange: (val: number) => void;
  mattingBackground: 'dark' | 'black' | 'white' | 'original';
  onMattingBackgroundChange: (bg: 'dark' | 'black' | 'white' | 'original') => void;
  hasBackScan: boolean;
  flipMode: FlipMode;
  onFlipModeChange: (mode: FlipMode) => void;
  onBatchRotate: (delta: number) => void;
  onAutoOrientUpright: () => void;
  activeSide: 'front' | 'back';
  onActiveSideChange: (side: 'front' | 'back') => void;
  onResetCalibration: () => void;
}

export const AutoEdgeControls: React.FC<AutoEdgeControlsProps> = ({
  scanMode,
  onScanModeChange,
  isDetecting,
  onRunAutoDetect,
  detectedCount,
  edgeMarginPercent,
  onEdgeMarginChange,
  mattingBackground,
  onMattingBackgroundChange,
  hasBackScan,
  flipMode,
  onFlipModeChange,
  onBatchRotate,
  onAutoOrientUpright,
  activeSide,
  onActiveSideChange,
  onResetCalibration,
}) => {
  return (
    <div className="space-y-4">
      {/* Mode Selector Tabs */}
      <div className="bg-[#0a0a0c] border border-white/10 rounded-2xl p-2 shadow-xl">
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#050505] rounded-xl border border-white/5">
          <button
            id="tab-mode-auto-detect"
            onClick={() => onScanModeChange('auto-detect')}
            className={`py-2.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2 transition-all ${
              scanMode === 'auto-detect'
                ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Auto Edge Detect</span>
          </button>

          <button
            id="tab-mode-template-grid"
            onClick={() => onScanModeChange('template')}
            className={`py-2.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2 transition-all ${
              scanMode === 'template'
                ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Square className="w-3.5 h-3.5" />
            <span>Rigid Template Grid</span>
          </button>
        </div>
      </div>

      {/* Auto Edge Detection Main Card */}
      {scanMode === 'auto-detect' && (
        <div className="bg-[#0a0a0c] border border-cyan-500/30 rounded-2xl p-4 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              <label className="text-[10px] font-bold text-gray-300 uppercase tracking-widest font-mono">
                Edge Detection & Normalization
              </label>
            </div>
            {detectedCount > 0 && (
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold border border-emerald-500/40">
                {detectedCount} CARDS FOUND
              </span>
            )}
          </div>

          <button
            id="btn-run-auto-detect-edges"
            disabled={isDetecting}
            onClick={onRunAutoDetect}
            className="w-full py-3 px-4 bg-cyan-500 hover:bg-cyan-400 text-black rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-2 shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all active:scale-95 disabled:opacity-50"
          >
            <Wand2 className={`w-4 h-4 ${isDetecting ? 'animate-spin' : ''}`} />
            <span>{isDetecting ? 'Detecting Card Edges...' : 'Auto-Detect & Normalize Edges'}</span>
          </button>

          <p className="text-[10px] text-gray-400 font-mono leading-relaxed">
            Detects card perimeters on loose scanner placements, deskews angles, and normalizes orientations upright with full border visibility.
          </p>
        </div>
      )}

      {/* Edge Visibility & Matting Controls */}
      <div className="bg-[#0a0a0c] border border-white/10 rounded-2xl p-4 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono flex items-center space-x-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Border & Corner Visibility</span>
          </label>
          <span className="text-xs font-mono font-bold text-cyan-400">+{edgeMarginPercent}% padding</span>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] text-gray-400 font-mono">
            <span>Perimeter Margin Buffer</span>
            <span className="text-gray-300">
              {edgeMarginPercent === 0 ? 'Tight Flush' : `${edgeMarginPercent}% Safety`}
            </span>
          </div>
          <input
            id="slider-edge-margin"
            type="range"
            min="0"
            max="8"
            step="1"
            value={edgeMarginPercent}
            onChange={(e) => onEdgeMarginChange(parseInt(e.target.value, 10))}
            className="w-full accent-cyan-400 cursor-pointer"
          />
          <div className="flex justify-between text-[9px] text-gray-500 font-mono">
            <span>0% (Tight)</span>
            <span className="text-cyan-400 font-bold">3% (Optimal For Inspection)</span>
            <span>8% (Generous)</span>
          </div>
        </div>

        {/* Matting Background Selector */}
        <div className="space-y-2 pt-2 border-t border-white/10">
          <div className="flex justify-between text-[11px] text-gray-400 font-mono">
            <span>Matting Frame Background:</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { id: 'original', label: 'Original', desc: 'Scan Bed' },
              { id: 'dark', label: 'Dark Slate', desc: '#0f172a' },
              { id: 'black', label: 'Jet Black', desc: '#000000' },
              { id: 'white', label: 'White', desc: '#ffffff' },
            ].map((bg) => (
              <button
                key={bg.id}
                onClick={() => onMattingBackgroundChange(bg.id as any)}
                className={`py-1.5 px-2 rounded-lg text-[10px] font-mono border transition-all text-center ${
                  mattingBackground === bg.id
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold shadow-[0_0_8px_rgba(6,182,212,0.2)]'
                    : 'bg-[#050505] border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                {bg.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Uniform Orientation Normalization */}
      <div className="bg-[#0a0a0c] border border-white/10 rounded-2xl p-4 space-y-3 shadow-xl">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono flex items-center space-x-1.5">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>Uniform Orientation</span>
          </label>
          <button
            onClick={onAutoOrientUpright}
            className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold uppercase tracking-wider font-mono flex items-center space-x-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Auto-Upright</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onBatchRotate(90)}
            className="p-2 rounded-xl bg-[#050505] hover:bg-white/5 border border-white/10 text-white text-xs font-mono flex flex-col items-center space-y-1 transition-all"
            title="Rotate all 90° Clockwise"
          >
            <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[10px]">+90° CW</span>
          </button>

          <button
            onClick={() => onBatchRotate(270)}
            className="p-2 rounded-xl bg-[#050505] hover:bg-white/5 border border-white/10 text-white text-xs font-mono flex flex-col items-center space-y-1 transition-all"
            title="Rotate all 90° Counter-Clockwise"
          >
            <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[10px]">-90° CCW</span>
          </button>

          <button
            onClick={() => onBatchRotate(180)}
            className="p-2 rounded-xl bg-[#050505] hover:bg-white/5 border border-white/10 text-white text-xs font-mono flex flex-col items-center space-y-1 transition-all"
            title="Rotate all 180° Invert"
          >
            <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[10px]">180° Flip</span>
          </button>
        </div>
      </div>

      {/* Dual Side / Alignment Switcher */}
      {hasBackScan && (
        <div className="bg-[#0a0a0c] border border-white/10 rounded-2xl p-4 space-y-3 shadow-xl">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono">
            Sheet Preview Side
          </label>
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#050505] rounded-xl border border-white/5">
            <button
              onClick={() => onActiveSideChange('front')}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${
                activeSide === 'front' ? 'bg-cyan-500 text-black font-bold' : 'text-gray-400 hover:text-white'
              }`}
            >
              Front Sheet
            </button>
            <button
              onClick={() => onActiveSideChange('back')}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${
                activeSide === 'back' ? 'bg-cyan-500 text-black font-bold' : 'text-gray-400 hover:text-white'
              }`}
            >
              Back Sheet
            </button>
          </div>

          <div className="pt-2 border-t border-white/10">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono mb-2">
              Back Flip Match Mode
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'horizontal', label: 'Book Flip' },
                { id: 'vertical', label: 'Calendar' },
                { id: 'direct', label: 'Direct 1:1' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => onFlipModeChange(m.id as FlipMode)}
                  className={`py-1.5 px-2 rounded-lg text-[10px] font-mono border transition-all text-center ${
                    flipMode === m.id
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold'
                      : 'bg-[#050505] border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
