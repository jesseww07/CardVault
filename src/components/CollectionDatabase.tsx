import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Layers,
  ArrowUpDown,
  Grid,
  List,
  RefreshCw,
  Sparkles,
  Download,
  Trash2,
  Tag,
  ShieldCheck,
  Eye,
  Plus,
  ExternalLink,
  FileSpreadsheet,
  CheckCircle2,
  DollarSign,
  SlidersHorizontal
} from 'lucide-react';
import { CardRecord, CardCategory, GradingBrand, FilterOptions } from '../types';
import { exportCardsToCsv, CsvExportSummary } from '../lib/csvExporter';
import { ExportCsvModal } from './ExportCsvModal';

interface CollectionDatabaseProps {
  cards: CardRecord[];
  onUpdateCard: (card: CardRecord) => void;
  onDeleteCard: (id: string) => void;
  onDeleteCardsBatch: (ids: string[]) => void;
  onOpenCardDetail: (card: CardRecord) => void;
  onNavigateToScan: () => void;
  onNavigateToPrint: () => void;
}

export const CollectionDatabase: React.FC<CollectionDatabaseProps> = ({
  cards,
  onUpdateCard,
  onDeleteCard,
  onDeleteCardsBatch,
  onOpenCardDetail,
  onNavigateToScan,
  onNavigateToPrint,
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [flippedCardIds, setFlippedCardIds] = useState<Record<string, boolean>>({});
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [gradedFilter, setGradedFilter] = useState<'all' | 'graded' | 'raw'>('all');
  const [sortBy, setSortBy] = useState<'createdAt' | 'name' | 'year' | 'grade' | 'estimatedValue'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Portfolio overview metrics
  const totalPortfolioValue = useMemo(() => {
    return cards.reduce((sum, c) => sum + (c.estimatedValue || 0), 0);
  }, [cards]);

  const gradedSlabsCount = useMemo(() => {
    return cards.filter((c) => c.isGraded).length;
  }, [cards]);

  const rawCardsCount = useMemo(() => {
    return cards.length - gradedSlabsCount;
  }, [cards, gradedSlabsCount]);

  // Toggle Flip for specific card
  const toggleFlip = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFlippedCardIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Toggle selection
  const toggleSelectCard = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedCardIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedCardIds.length === filteredCards.length) {
      setSelectedCardIds([]);
    } else {
      setSelectedCardIds(filteredCards.map((c) => c.id));
    }
  };

  // Filter and Sort Cards
  const filteredCards = useMemo(() => {
    return cards
      .filter((card) => {
        // Text Search
        const q = searchQuery.toLowerCase().trim();
        const matchesQuery =
          !q ||
          card.name.toLowerCase().includes(q) ||
          card.set.toLowerCase().includes(q) ||
          card.cardNumber.toLowerCase().includes(q) ||
          card.year.toLowerCase().includes(q) ||
          (card.certNumber && card.certNumber.toLowerCase().includes(q)) ||
          card.tags.some((t) => t.toLowerCase().includes(q));

        // Category Filter
        const matchesCategory = categoryFilter === 'all' || card.category === categoryFilter;

        // Company Filter
        const matchesCompany = companyFilter === 'all' || card.gradingCompany === companyFilter;

        // Graded vs Raw Filter
        const matchesGraded =
          gradedFilter === 'all' ||
          (gradedFilter === 'graded' && card.isGraded) ||
          (gradedFilter === 'raw' && !card.isGraded);

        return matchesQuery && matchesCategory && matchesCompany && matchesGraded;
      })
      .sort((a, b) => {
        let comp = 0;
        if (sortBy === 'createdAt') {
          comp = a.createdAt - b.createdAt;
        } else if (sortBy === 'name') {
          comp = a.name.localeCompare(b.name);
        } else if (sortBy === 'year') {
          comp = (a.year || '').localeCompare(b.year || '');
        } else if (sortBy === 'estimatedValue') {
          comp = (a.estimatedValue || 0) - (b.estimatedValue || 0);
        } else if (sortBy === 'grade') {
          comp = (a.grade || '').localeCompare(b.grade || '');
        }
        return sortOrder === 'asc' ? comp : -comp;
      });
  }, [cards, searchQuery, categoryFilter, companyFilter, gradedFilter, sortBy, sortOrder]);

  // Export to CSV Function
  const handleExportCsv = (scope?: 'all' | 'filtered' | 'selected' | 'prompt') => {
    if (scope === 'prompt') {
      setIsExportModalOpen(true);
      return;
    }

    let cardsToExport: CardRecord[] = [];
    let scopeName = 'collection';

    if (scope === 'selected') {
      cardsToExport = cards.filter((c) => selectedCardIds.includes(c.id));
      scopeName = 'selected';
    } else if (scope === 'filtered') {
      cardsToExport = filteredCards;
      scopeName = 'filtered';
    } else if (scope === 'all') {
      cardsToExport = cards;
      scopeName = 'all';
    } else {
      // Default: if selected cards exist, export selected, otherwise if filtered, export filtered, otherwise all
      if (selectedCardIds.length > 0) {
        cardsToExport = cards.filter((c) => selectedCardIds.includes(c.id));
        scopeName = 'selected';
      } else if (filteredCards.length < cards.length) {
        cardsToExport = filteredCards;
        scopeName = 'filtered';
      } else {
        cardsToExport = cards;
        scopeName = 'all';
      }
    }

    if (cardsToExport.length === 0) {
      setToastMessage('No cards available to export.');
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    const dateSlug = new Date().toISOString().slice(0, 10);
    const summary = exportCardsToCsv(cardsToExport, `cardvault-${scopeName}-${dateSlug}.csv`);

    setToastMessage(
      `✓ Successfully exported ${summary.count} cards to CSV ($${summary.totalEstimatedValue.toLocaleString('en-US', { minimumFractionDigits: 2 })} value)`
    );
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Download Images Batch
  const handleDownloadImages = () => {
    const cardsToExport = selectedCardIds.length > 0
      ? cards.filter((c) => selectedCardIds.includes(c.id))
      : filteredCards;
      
    if (cardsToExport.length > 30 && !confirm(`You are about to download images for ${cardsToExport.length} cards (up to ${cardsToExport.length * 2} files). This may take a moment or trigger browser multiple download warnings. Proceed?`)) {
      return;
    }

    const downloadImage = (dataUrl, filename) => {
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    let delayCounter = 0;
    cardsToExport.forEach((c) => {
      const safeName = (c.name || 'card').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      if (c.frontImage) {
        setTimeout(() => downloadImage(c.frontImage, `${safeName}_${c.id.substring(0,4)}_front.jpg`), delayCounter * 300);
        delayCounter++;
      }
      if (c.backImage) {
        setTimeout(() => downloadImage(c.backImage, `${safeName}_${c.id.substring(0,4)}_back.jpg`), delayCounter * 300);
        delayCounter++;
      }
    });
  };

  // Export to JSON
  const handleExportJson = () => {
    const cardsToExport = selectedCardIds.length > 0
      ? cards.filter((c) => selectedCardIds.includes(c.id))
      : filteredCards;

    const jsonStr = JSON.stringify(cardsToExport, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `cardvault-export-${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Portfolio Overview & Quick Stats Bar */}
      <div className="bg-[#0a0a0c] border border-white/10 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl font-mono text-xs">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div className="flex items-center space-x-2">
            <span className="text-gray-500 uppercase text-[11px] font-bold">Catalog Total:</span>
            <span className="text-white font-black text-sm">{cards.length} cards</span>
          </div>
          <div className="hidden sm:block text-white/15">•</div>
          <div className="flex items-center space-x-2">
            <span className="text-gray-500 uppercase text-[11px] font-bold">Graded Slabs:</span>
            <span className="text-cyan-400 font-bold">{gradedSlabsCount}</span>
          </div>
          <div className="hidden sm:block text-white/15">•</div>
          <div className="flex items-center space-x-2">
            <span className="text-gray-500 uppercase text-[11px] font-bold">Raw Cards:</span>
            <span className="text-gray-300 font-bold">{rawCardsCount}</span>
          </div>
          <div className="hidden sm:block text-white/15">•</div>
          <div className="flex items-center space-x-2">
            <span className="text-gray-500 uppercase text-[11px] font-bold">Est. Total Value:</span>
            <span className="text-emerald-400 font-black text-sm">
              ${totalPortfolioValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Quick CSV Download & Options */}
        <div className="flex items-center space-x-2">
          <button
            id="stats-download-csv-button"
            onClick={() => handleExportCsv(selectedCardIds.length > 0 ? 'selected' : (filteredCards.length < cards.length ? 'filtered' : 'all'))}
            disabled={cards.length === 0}
            className="px-3.5 py-1.5 bg-[#050505] hover:bg-cyan-500/15 border border-white/10 hover:border-cyan-500/40 text-cyan-300 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center space-x-2 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
            title="Download CSV spreadsheet of collection"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV</span>
          </button>
          <button
            onClick={() => setIsExportModalOpen(true)}
            disabled={cards.length === 0}
            className="p-1.5 bg-[#050505] hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white rounded-xl text-xs transition-all disabled:opacity-40"
            title="CSV Export Options & Scope Settings"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Top Filter & Search Bar */}
      <div className="bg-[#0a0a0c] border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Field */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-cyan-400 absolute left-3.5 top-3" />
            <input
              id="search-collection-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search catalog by player, set, card #, cert #, year, tag..."
              className="w-full bg-[#050505] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
            />
          </div>

          {/* View Mode & Actions */}
          <div className="flex items-center space-x-2 w-full md:w-auto justify-between md:justify-end">
            <div className="flex items-center bg-[#050505] rounded-xl p-1 border border-white/10">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'grid' ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(6,182,212,0.4)]' : 'text-gray-400 hover:text-white'
                }`}
                title="Grid View"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'table' ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(6,182,212,0.4)]' : 'text-gray-400 hover:text-white'
                }`}
                title="Table View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Download CSV Split Button Group */}
            <div className="flex items-center bg-[#050505] rounded-xl border border-white/15 overflow-hidden shadow-sm">
              <button
                id="download-csv-button"
                onClick={() => handleExportCsv(selectedCardIds.length > 0 ? 'selected' : (filteredCards.length < cards.length ? 'filtered' : 'all'))}
                disabled={cards.length === 0}
                className={`px-3.5 py-2 hover:bg-white/10 text-gray-200 text-xs font-mono font-bold uppercase tracking-wider flex items-center space-x-2 transition-all ${
                  cards.length === 0 ? 'opacity-40 cursor-not-allowed' : 'hover:border-cyan-500/50 hover:text-white'
                }`}
                title="Download collection records as CSV for Excel, Google Sheets, or Numbers"
              >
                <Download className="w-4 h-4 text-cyan-400" />
                <span>Download CSV</span>
                {selectedCardIds.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 rounded text-[10px] border border-cyan-500/30">
                    {selectedCardIds.length}
                  </span>
                )}
              </button>
              <button
                id="download-csv-options-button"
                onClick={() => setIsExportModalOpen(true)}
                disabled={cards.length === 0}
                className="px-2.5 py-2 border-l border-white/10 hover:bg-white/10 text-gray-400 hover:text-cyan-300 transition-all disabled:opacity-40"
                title="CSV export options (scope selector, custom filename, summary preview)"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={onNavigateToScan}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-black uppercase tracking-wider rounded-xl flex items-center space-x-1.5 shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Scan Batch</span>
            </button>
          </div>
        </div>

        {/* Filter Chips Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-white/10 text-xs font-mono">
          {/* Quick Graded / Raw Segment */}
          <div className="flex items-center bg-[#050505] rounded-lg p-0.5 border border-white/10">
            {(['all', 'graded', 'raw'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setGradedFilter(mode)}
                className={`px-3 py-1 rounded-md uppercase font-bold text-[10px] tracking-wider transition-all ${
                  gradedFilter === mode ? 'bg-cyan-500 text-black shadow-[0_0_8px_rgba(6,182,212,0.3)]' : 'text-gray-400 hover:text-white'
                }`}
              >
                {mode === 'all' ? 'All Cards' : mode === 'graded' ? 'Graded Slabs' : 'Raw Cards'}
              </button>
            ))}
          </div>

          {/* Grading Brand Filter */}
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="bg-[#050505] border border-white/10 rounded-lg px-2.5 py-1 text-gray-300 text-[11px] focus:outline-none focus:border-cyan-400"
          >
            <option value="all">All Brands (PSA/BGS/CGC/SGC)</option>
            <option value="PSA">PSA Slabs</option>
            <option value="BGS">BGS Beckett</option>
            <option value="CGC">CGC Cards</option>
            <option value="SGC">SGC Tuxedo</option>
            <option value="TAG">TAG</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-[#050505] border border-white/10 rounded-lg px-2.5 py-1 text-gray-300 text-[11px] focus:outline-none focus:border-cyan-400"
          >
            <option value="all">All Categories</option>
            <option value="Baseball">Baseball</option>
            <option value="Basketball">Basketball</option>
            <option value="Football">Football</option>
            <option value="Hockey">Hockey</option>
            <option value="Soccer">Soccer</option>
            <option value="Pokemon">Pokemon</option>
            <option value="Magic: The Gathering">Magic (MTG)</option>
            <option value="Yu-Gi-Oh!">Yu-Gi-Oh!</option>
            <option value="Non-Sport / Marvel">Marvel / Non-Sport</option>
          </select>

          {/* Sort By Dropdown */}
          <div className="flex items-center space-x-1.5 ml-auto">
            <span className="text-gray-500 uppercase tracking-widest text-[9px] font-bold">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-[#050505] border border-white/10 rounded-lg px-2.5 py-1 text-gray-300 text-[11px] focus:outline-none focus:border-cyan-400"
            >
              <option value="createdAt">Date Added</option>
              <option value="estimatedValue">Est. Value ($)</option>
              <option value="name">Player / Title</option>
              <option value="year">Year</option>
              <option value="grade">Grade</option>
            </select>
            <button
              onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              className="p-1 rounded bg-[#050505] border border-white/10 text-cyan-400 hover:text-white"
              title="Toggle Sort Direction"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Selected Items Bulk Actions Strip */}
        {selectedCardIds.length > 0 && (
          <div className="bg-cyan-950/40 border border-cyan-500/40 rounded-xl p-3 flex items-center justify-between text-xs font-mono shadow-lg">
            <div className="flex items-center space-x-2 text-cyan-200">
              <span className="font-bold uppercase tracking-wider">{selectedCardIds.length} cards selected</span>
              <button
                onClick={() => setSelectedCardIds([])}
                className="text-cyan-400 hover:underline uppercase text-[10px] font-bold"
              >
                Clear
              </button>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleDownloadImages}
                className="px-3 py-1 bg-white/10 text-white border border-white/20 rounded-lg font-bold uppercase tracking-wider hover:bg-white/20 text-xs shadow-md"
              >
                Images
              </button>
              <button
                id="bulk-download-csv-button"
                onClick={() => handleExportCsv('selected')}
                className="px-3 py-1.5 bg-cyan-500 text-black rounded-lg font-black uppercase tracking-wider hover:bg-cyan-400 text-xs shadow-[0_0_12px_rgba(6,182,212,0.3)] flex items-center space-x-1.5 transition-all active:scale-95"
                title="Download CSV spreadsheet of selected cards"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download CSV ({selectedCardIds.length})</span>
              </button>
              <button
                onClick={() => {
                  if (confirm(`Delete ${selectedCardIds.length} cards from database?`)) {
                    onDeleteCardsBatch(selectedCardIds);
                    setSelectedCardIds([]);
                  }
                }}
                className="px-3 py-1 bg-red-600/80 text-white rounded-lg font-bold uppercase tracking-wider hover:bg-red-500 text-xs"
              >
                Delete Selected
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Empty State */}
      {filteredCards.length === 0 && (
        <div className="bg-[#0a0a0c] border border-white/10 rounded-3xl p-12 text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(6,182,212,0.2)]">
            <Layers className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold uppercase tracking-wider text-white">No Trading Cards Found</h3>
            <p className="text-xs text-gray-400 max-w-md mx-auto mt-1 font-mono">
              {cards.length === 0
                ? 'Your collection database is currently empty. Run a batch scan with graded slabs or raw cards to begin cataloging!'
                : 'No cards matched your current search or filters.'}
            </p>
          </div>
          {cards.length === 0 && (
            <button
              onClick={onNavigateToScan}
              className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-black uppercase tracking-wider text-xs rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.4)]"
            >
              Start Batch Scan
            </button>
          )}
        </div>
      )}

      {/* GRID VIEW */}
      {viewMode === 'grid' && filteredCards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredCards.map((card) => {
            const isFlipped = Boolean(flippedCardIds[card.id]);
            const isSelected = selectedCardIds.includes(card.id);

            return (
              <div
                key={card.id}
                onClick={() => onOpenCardDetail(card)}
                className={`bg-[#0a0a0c] border rounded-2xl p-4 space-y-3 cursor-pointer transition-all hover:shadow-2xl hover:scale-[1.01] relative group ${
                  isSelected ? 'border-cyan-500 ring-2 ring-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.3)]' : 'border-white/10 hover:border-cyan-500/40'
                }`}
              >
                {/* Checkbox for bulk select */}
                <div
                  onClick={(e) => toggleSelectCard(card.id, e)}
                  className={`absolute top-6 left-6 z-20 w-5 h-5 rounded border flex items-center justify-center transition-all ${
                    isSelected ? 'bg-cyan-500 border-cyan-400 text-black font-black' : 'bg-black/80 border-white/20 opacity-0 group-hover:opacity-100'
                  }`}
                >
                  {isSelected && <span className="text-xs">✓</span>}
                </div>

                {/* 3D Interactive Card Image */}
                <div className="relative aspect-[3/4] bg-black rounded-xl overflow-hidden border border-white/10 flex items-center justify-center p-2 shadow-2xl">
                  <img
                    src={isFlipped && card.backImage ? card.backImage : card.frontImage}
                    alt={card.name}
                    className="max-h-full max-w-full object-contain rounded shadow-lg transition-transform duration-300"
                  />

                  {/* Flip Action Button */}
                  {card.backImage && (
                    <button
                      onClick={(e) => toggleFlip(card.id, e)}
                      className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/90 hover:bg-cyan-500 hover:text-black text-cyan-400 text-xs shadow-lg backdrop-blur-sm border border-white/10 transition-all"
                      title="Flip Card"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Slab Brand Badge */}
                  <div className="absolute top-2 right-2 flex items-center space-x-1">
                    {card.isGraded ? (
                      <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-black uppercase tracking-wider">
                        {card.gradingCompany} {card.grade}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-white/10 text-gray-300 text-[10px] font-mono font-medium">
                        Raw
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Info */}
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-1">
                    <h4 className="font-bold text-sm text-white truncate group-hover:text-cyan-300 transition-colors">
                      {card.name}
                    </h4>
                    {card.estimatedValue !== undefined && (
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        ${card.estimatedValue}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-gray-400 truncate font-mono">
                    {card.year} {card.set} • #{card.cardNumber}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1.5 border-t border-white/10 font-mono">
                    <span>{card.category}</span>
                    {card.certNumber && (
                      <span className="text-gray-400">#{card.certNumber}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TABLE VIEW */}
      {viewMode === 'table' && filteredCards.length > 0 && (
        <div className="bg-[#0a0a0c] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#050505] border-b border-white/10 text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3 w-10">
                    <input
                      type="checkbox"
                      checked={selectedCardIds.length === filteredCards.length}
                      onChange={toggleSelectAll}
                      className="rounded border-white/20 bg-black text-cyan-500"
                    />
                  </th>
                  <th className="p-3">Card</th>
                  <th className="p-3">Year / Set</th>
                  <th className="p-3">Card #</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Grade / Slab</th>
                  <th className="p-3">Cert #</th>
                  <th className="p-3 text-right">Est. Value</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredCards.map((card) => (
                  <tr
                    key={card.id}
                    onClick={() => onOpenCardDetail(card)}
                    className="hover:bg-white/5 cursor-pointer transition-colors"
                  >
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedCardIds.includes(card.id)}
                        onChange={(e) => toggleSelectCard(card.id, e as any)}
                        className="rounded border-white/20 bg-black text-cyan-500"
                      />
                    </td>
                    <td className="p-3">
                      <div className="flex items-center space-x-3">
                        <img
                          src={card.frontImage}
                          alt={card.name}
                          className="w-10 h-14 object-contain rounded bg-black border border-white/10"
                        />
                        <div>
                          <div className="font-bold text-white text-xs">{card.name}</div>
                          <div className="text-gray-500 text-[10px]">{card.variation || 'Base'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-gray-300">
                      <div>{card.set}</div>
                      <div className="text-gray-500 text-[10px]">{card.year}</div>
                    </td>
                    <td className="p-3 font-semibold text-gray-300">#{card.cardNumber}</td>
                    <td className="p-3 text-gray-400">{card.category}</td>
                    <td className="p-3">
                      {card.isGraded ? (
                        <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold text-[10px] uppercase">
                          {card.gradingCompany} {card.grade}
                        </span>
                      ) : (
                        <span className="text-gray-500">Raw</span>
                      )}
                    </td>
                    <td className="p-3 text-gray-400">{card.certNumber || '-'}</td>
                    <td className="p-3 text-right font-bold text-emerald-400">
                      ${card.estimatedValue || 0}
                    </td>
                    <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          onClick={() => onOpenCardDetail(card)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-cyan-300 hover:bg-white/5 transition-colors"
                          title="View Card Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            const safeName = (card.name || 'card').replace(/[^a-z0-9]/gi, '_').toLowerCase();
                            exportCardsToCsv([card], `${safeName}_${card.cardNumber || 'card'}.csv`);
                            setToastMessage(`✓ Downloaded CSV for "${card.name}"`);
                            setTimeout(() => setToastMessage(null), 3000);
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-400 hover:bg-white/5 transition-colors"
                          title="Download CSV record for this card"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CSV Export Modal Dialog */}
      <ExportCsvModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        allCards={cards}
        filteredCards={filteredCards}
        selectedCardIds={selectedCardIds}
        activeSearchQuery={searchQuery}
        activeCategoryFilter={categoryFilter}
        activeCompanyFilter={companyFilter}
        activeGradedFilter={gradedFilter}
        onExportComplete={(summary) => {
          setToastMessage(
            `✓ Successfully exported ${summary.count} cards to CSV ($${summary.totalEstimatedValue.toLocaleString('en-US', { minimumFractionDigits: 2 })} value)`
          );
          setTimeout(() => setToastMessage(null), 4000);
        }}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div
          id="collection-toast"
          className="fixed bottom-6 right-6 z-50 bg-[#050505] border border-cyan-500/50 text-cyan-200 px-4 py-3 rounded-2xl shadow-[0_0_25px_rgba(6,182,212,0.3)] flex items-center space-x-3 font-mono text-xs animate-in fade-in slide-in-from-bottom-5"
        >
          <div className="w-6 h-6 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <span className="font-bold">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-gray-400 hover:text-white ml-2 text-xs"
            aria-label="Dismiss toast"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};
