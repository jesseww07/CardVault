import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { ScannerStudio } from './components/ScannerStudio';
import { CollectionDatabase } from './components/CollectionDatabase';
import { TemplateManager } from './components/TemplateManager';
import { PrintInventoryView } from './components/PrintInventoryView';
import { CardDetailModal } from './components/CardDetailModal';
import { CardRecord, ScannerTemplate } from './types';
import {
  getAllCards,
  saveCard,
  saveCardsBatch,
  deleteCard,
  deleteCardsBatch,
  getAllTemplates,
  saveCustomTemplate,
  deleteCustomTemplate
} from './lib/indexedDb';
import { createPsaSlabDemoScan, createRaw9CardDemoScan } from './lib/sampleScans';
import { cropAllSlots } from './lib/imageProcessor';
import { DEFAULT_TEMPLATES } from './lib/defaultTemplates';

export default function App() {
  const [activeTab, setActiveTab] = useState<'scan' | 'database' | 'templates' | 'print'>('scan');
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [templates, setTemplates] = useState<ScannerTemplate[]>([]);
  const [selectedCardForModal, setSelectedCardForModal] = useState<CardRecord | null>(null);
  const [customizingTemplateId, setCustomizingTemplateId] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load database & templates on startup
  useEffect(() => {
    async function initData() {
      try {
        const loadedTemplates = await getAllTemplates();
        setTemplates(loadedTemplates);

        const loadedCards = await getAllCards();
        if (loadedCards.length > 0) {
          setCards(loadedCards);
        } else {
          // Pre-populate with initial starter demo records so user sees full interface immediately
          await seedStarterCards();
        }
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        setIsLoading(false);
      }
    }
    initData();
  }, []);

  // Seed sample records
  const seedStarterCards = async () => {
    try {
      const psaDemo = createPsaSlabDemoScan();
      const cropped = await cropAllSlots(
        psaDemo.front,
        psaDemo.back,
        DEFAULT_TEMPLATES[0],
        [
          { id: 0, active: true, xPercent: 8, yPercent: 5.5, widthPercent: 38, heightPercent: 42, label: 'Slot 1' },
          { id: 1, active: true, xPercent: 53, yPercent: 5.5, widthPercent: 38, heightPercent: 42, label: 'Slot 2' },
          { id: 2, active: true, xPercent: 8, yPercent: 52, widthPercent: 38, heightPercent: 42, label: 'Slot 3' },
          { id: 3, active: true, xPercent: 53, yPercent: 52, widthPercent: 38, heightPercent: 42, label: 'Slot 4' },
        ],
        'horizontal'
      );

      const demoRecords: CardRecord[] = [
        {
          id: 'card-init-1',
          createdAt: Date.now() - 100000,
          updatedAt: Date.now(),
          frontImage: cropped[0]?.frontCroppedDataUrl || '',
          backImage: cropped[0]?.backCroppedDataUrl,
          name: 'Michael Jordan',
          year: '1986',
          set: 'Fleer',
          cardNumber: '#57',
          category: 'Basketball',
          variation: 'Rookie Card (RC)',
          isGraded: true,
          gradingCompany: 'PSA',
          grade: '10',
          certNumber: '48291048',
          estimatedValue: 185000,
          currency: 'USD',
          tags: ['Grail', 'GOAT', 'RC', 'PSA 10'],
          notes: 'Iconic 1986 Fleer Michael Jordan Rookie #57 in pristine PSA 10 Gem Mint.',
        },
        {
          id: 'card-init-2',
          createdAt: Date.now() - 80000,
          updatedAt: Date.now(),
          frontImage: cropped[1]?.frontCroppedDataUrl || '',
          backImage: cropped[1]?.backCroppedDataUrl,
          name: 'Charizard 1st Edition Shadowless',
          year: '1999',
          set: 'Pokemon Base Set',
          cardNumber: '#4/102',
          category: 'Pokemon',
          variation: '1st Edition Holo Shadowless',
          isGraded: true,
          gradingCompany: 'PSA',
          grade: '9',
          certNumber: '29481023',
          estimatedValue: 24500,
          currency: 'USD',
          tags: ['Pokemon', '1st Edition', 'Vintage', 'Holo'],
          notes: 'Original 1999 Base Set 1st Edition Holo Charizard.',
        },
        {
          id: 'card-init-3',
          createdAt: Date.now() - 60000,
          updatedAt: Date.now(),
          frontImage: cropped[2]?.frontCroppedDataUrl || '',
          backImage: cropped[2]?.backCroppedDataUrl,
          name: 'Ken Griffey Jr.',
          year: '1989',
          set: 'Upper Deck Star Rookie',
          cardNumber: '#1',
          category: 'Baseball',
          variation: 'Star Rookie',
          isGraded: true,
          gradingCompany: 'PSA',
          grade: '10',
          certNumber: '81039471',
          estimatedValue: 2100,
          currency: 'USD',
          tags: ['Baseball', 'HOF', 'RC'],
          notes: '1989 Upper Deck #1 Ken Griffey Jr. Gem Mint 10.',
        },
        {
          id: 'card-init-4',
          createdAt: Date.now() - 40000,
          updatedAt: Date.now(),
          frontImage: cropped[3]?.frontCroppedDataUrl || '',
          backImage: cropped[3]?.backCroppedDataUrl,
          name: 'LeBron James',
          year: '2003',
          set: 'Topps Chrome',
          cardNumber: '#111',
          category: 'Basketball',
          variation: 'Rookie Card (RC)',
          isGraded: true,
          gradingCompany: 'PSA',
          grade: '9',
          certNumber: '67401928',
          estimatedValue: 4200,
          currency: 'USD',
          tags: ['King James', 'RC', 'Chrome'],
          notes: '2003 Topps Chrome LeBron James rookie.',
        },
      ];

      await saveCardsBatch(demoRecords);
      setCards(demoRecords);
    } catch (e) {
      console.error('Failed to seed starter cards:', e);
    }
  };

  // Handlers for cards
  const handleBatchCatalogSaved = async (newCards: CardRecord[]) => {
    await saveCardsBatch(newCards);
    const updated = await getAllCards();
    setCards(updated);
    setActiveTab('database');
  };

  const handleUpdateCard = async (updatedCard: CardRecord) => {
    await saveCard(updatedCard);
    setCards((prev) => prev.map((c) => (c.id === updatedCard.id ? updatedCard : c)));
  };

  const handleDeleteCard = async (id: string) => {
    await deleteCard(id);
    setCards((prev) => prev.filter((c) => c.id !== id));
    if (selectedCardForModal?.id === id) {
      setSelectedCardForModal(null);
    }
  };

  const handleDeleteCardsBatch = async (ids: string[]) => {
    await deleteCardsBatch(ids);
    setCards((prev) => prev.filter((c) => !ids.includes(c.id)));
  };

  // Handlers for templates
  const handleSaveTemplate = async (template: ScannerTemplate) => {
    await saveCustomTemplate(template);
    const updated = await getAllTemplates();
    setTemplates(updated);
  };

  const handleDeleteTemplate = async (id: string) => {
    await deleteCustomTemplate(id);
    const updated = await getAllTemplates();
    setTemplates(updated);
  };

  const handleOpenTemplateEditor = (templateId?: string) => {
    setCustomizingTemplateId(templateId);
    setActiveTab('templates');
  };

  const totalValue = cards.reduce((sum, c) => sum + (c.estimatedValue || 0), 0);

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        totalCardsCount={cards.length}
        totalEstimatedValue={totalValue}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400 space-y-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl border-2 border-cyan-500/30 border-t-cyan-400 animate-spin shadow-[0_0_20px_rgba(6,182,212,0.4)]" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold uppercase tracking-widest text-white">Initializing CardVault Pro</div>
              <div className="text-xs text-gray-500 font-mono mt-1">Mounting OCR Engine & Flatbed Calibrator...</div>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'scan' && (
              <ScannerStudio
                templates={templates}
                onBatchCatalogSaved={handleBatchCatalogSaved}
                onOpenTemplateEditor={handleOpenTemplateEditor}
              />
            )}

            {activeTab === 'database' && (
              <CollectionDatabase
                cards={cards}
                onUpdateCard={handleUpdateCard}
                onDeleteCard={handleDeleteCard}
                onDeleteCardsBatch={handleDeleteCardsBatch}
                onOpenCardDetail={(card) => setSelectedCardForModal(card)}
                onNavigateToScan={() => setActiveTab('scan')}
                onNavigateToPrint={() => setActiveTab('print')}
              />
            )}

            {activeTab === 'templates' && (
              <TemplateManager
                templates={templates}
                onSaveTemplate={handleSaveTemplate}
                onDeleteTemplate={handleDeleteTemplate}
                initialSelectedId={customizingTemplateId}
              />
            )}

            {activeTab === 'print' && (
              <PrintInventoryView cards={cards} onBack={() => setActiveTab('database')} />
            )}
          </>
        )}
      </main>

      {/* Futuristic Telemetry Footer */}
      <footer className="h-10 border-t border-white/10 bg-[#050505] flex items-center justify-between px-6 text-[10px] text-gray-500 uppercase tracking-widest font-mono select-none">
        <div className="flex items-center gap-3">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.8)]" />
          <span>System Core: <span className="text-gray-300">Active • Batch Pipeline Ready</span></span>
        </div>
        <div className="hidden sm:flex items-center gap-6 text-gray-500">
          <span>Vision Conf: <span className="text-emerald-400 font-semibold">99.2%</span></span>
          <span>IndexedDB: <span className="text-cyan-400 font-semibold">Synced ({cards.length} records)</span></span>
          <span>RAM: <span className="text-gray-400">4.2 GB</span></span>
          <span className="hidden md:inline">Storage: <span className="text-gray-400">82% Free</span></span>
        </div>
      </footer>

      {/* Card Detail Modal */}
      {selectedCardForModal && (
        <CardDetailModal
          card={selectedCardForModal}
          onClose={() => setSelectedCardForModal(null)}
          onUpdate={handleUpdateCard}
          onDelete={handleDeleteCard}
        />
      )}
    </div>
  );
}
