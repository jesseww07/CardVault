import React from 'react';
import { Scan, Database, Sliders, Printer, ShieldCheck, Sparkles, Layers, Activity, Cpu } from 'lucide-react';

interface NavbarProps {
  activeTab: 'scan' | 'database' | 'templates' | 'print';
  setActiveTab: (tab: 'scan' | 'database' | 'templates' | 'print') => void;
  totalCardsCount: number;
  totalEstimatedValue: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  totalCardsCount,
  totalEstimatedValue,
}) => {
  const formattedValue = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(totalEstimatedValue);

  return (
    <header className="flex flex-col border-b border-white/10 bg-[#0a0a0c] sticky top-0 z-40 backdrop-blur-md">
      {/* Top Telemetry Ticker */}
      <div className="hidden md:flex items-center justify-between px-6 py-1.5 bg-[#050505] border-b border-white/5 text-[10px] uppercase tracking-widest text-gray-400 font-mono">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
            <span className="text-gray-300">Scanner Engine: <span className="text-white font-semibold">1200 DPI Ready</span></span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-400">
            <Cpu className="w-3 h-3 text-cyan-400" />
            <span>AI Vision Core: <span className="text-cyan-400 font-semibold">Online (99.2% Conf)</span></span>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div>Database: <span className="text-white font-semibold">IndexedDB Vault v2.4</span></div>
          <div className="text-emerald-400 font-semibold flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            <span>Portfolio: {formattedValue}</span>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div
            className="flex items-center space-x-3 cursor-pointer group"
            onClick={() => setActiveTab('scan')}
          >
            <div className="w-8 h-8 bg-cyan-500 rounded flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.5)] group-hover:scale-105 transition-transform">
              <div className="w-4 h-4 border-2 border-black rotate-45 flex items-center justify-center">
                <div className="w-1 h-1 bg-black rounded-full" />
              </div>
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight uppercase italic text-white flex items-center gap-1.5">
                CardVault <span className="text-cyan-400 not-italic font-black text-xs px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 uppercase tracking-wider">Pro</span>
              </h1>
              <p className="text-[10px] uppercase tracking-widest text-gray-400">
                Batch Scanner & Slab OCR
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center space-x-1 sm:space-x-2 bg-[#08080a] p-1 rounded-xl border border-white/10">
            <button
              id="nav-tab-scan"
              onClick={() => setActiveTab('scan')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === 'scan'
                  ? 'bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Scan className="w-3.5 h-3.5" />
              <span>Scan Studio</span>
            </button>

            <button
              id="nav-tab-database"
              onClick={() => setActiveTab('database')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === 'database'
                  ? 'bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Collection</span>
              {totalCardsCount > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                  {totalCardsCount}
                </span>
              )}
            </button>

            <button
              id="nav-tab-templates"
              onClick={() => setActiveTab('templates')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === 'templates'
                  ? 'bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Templates</span>
            </button>

            <button
              id="nav-tab-print"
              onClick={() => setActiveTab('print')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === 'print'
                  ? 'bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print Catalog</span>
            </button>
          </nav>

          {/* Quick Portfolio Stats */}
          <div className="hidden lg:flex items-center space-x-4 pl-4 border-l border-white/10">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Portfolio Est.</div>
              <div className="text-sm font-black text-emerald-400 font-mono">{formattedValue}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Cataloged</div>
              <div className="text-sm font-bold text-white font-mono">{totalCardsCount} cards</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

