import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload,
  Layers,
  RotateCw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Eye,
  RefreshCw,
  Sliders,
  ChevronRight,
  ShieldCheck,
  FileCheck,
  Wand2,
  Trash2,
  Plus,
  Play,
  Maximize2,
  Grid3X3,
  Flame,
  Check,
  ChevronDown,
  Scan,
  Loader2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  ScannerTemplate,
  ScannerSlot,
  FlipMode,
  CroppedSlotPair,
  CardRecord,
  GradingBrand,
  CardCategory
} from '../types';
import { DEFAULT_TEMPLATES, getTemplateSlots } from '../lib/defaultTemplates';
import {
  cropAllSlots,
  cropSlotFromImage,
  loadImage,
  processUploadFile,
  rotateImageDataUrl,
  createOptimizedScanForApi,
  optimizeCroppedCardForOcr,
} from '../lib/imageProcessor';
import {
  CardQuad,
  createRegionReader,
  detectCardsInElement,
  matchQuad,
  mirrorSlot,
  pairBackSlotsForActiveFronts,
  quadToSlot,
  refineQuad,
  slotToQuad,
  sortReadingOrder,
} from '../lib/cardDetector';
import { createPsaSlabDemoScan, createRaw9CardDemoScan, createRaw8LetterDemoScan, createLooseRaw8CardsDemoScan } from '../lib/sampleScans';
import { AutoEdgeControls } from './AutoEdgeControls';
import { InspectQualityModal } from './InspectQualityModal';


/** Single AI detection call. Returns null on failure or when the server returned its canned fallback grid. */
async function detectCardsWithApi(scanUrl: string, width: number, height: number): Promise<CardQuad[] | null> {
  try {
    const optimized = await createOptimizedScanForApi(scanUrl, 1400, 0.82);
    const res = await fetch('/api/detect-cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: optimized }),
    });
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) {
      console.warn(`Card detection API status ${res.status} (${contentType})`);
      return null;
    }
    const data = await res.json();
    if (data.fallback || !Array.isArray(data.detectedCards)) return null;
    return data.detectedCards.map((c: any): CardQuad => {
      const [ymin, xmin, ymax, xmax] = c.box_2d;
      const w = ((xmax - xmin) / 1000) * width;
      const h = ((ymax - ymin) / 1000) * height;
      return {
        cx: ((xmin + xmax) / 2000) * width,
        cy: ((ymin + ymax) / 2000) * height,
        width: w,
        height: h,
        angleDeg: 0,
        rectangularity: 1,
        aspectScore: 1,
        refined: false,
      };
    });
  } catch (e) {
    console.warn('AI detection request failed, using local detection:', e);
    return null;
  }
}

interface ScannerStudioProps {
  templates: ScannerTemplate[];
  onBatchCatalogSaved: (cards: CardRecord[]) => void;
  onOpenTemplateEditor: (templateId?: string) => void;
}

export const ScannerStudio: React.FC<ScannerStudioProps> = ({
  templates,
  onBatchCatalogSaved,
  onOpenTemplateEditor,
}) => {
  // Step state: 1: Upload -> 2: Align & Template -> 3: Batch Crop & OCR -> 4: Review & Catalog
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Scan Mode: Auto Edge Detection (No Template) vs Rigid Template Grid
  const [scanMode, setScanMode] = useState<'auto-detect' | 'template'>('auto-detect');
  const [edgeMarginPercent, setEdgeMarginPercent] = useState<number>(3); // 3% safety margin so all borders & corners are visible
  const [mattingBackground, setMattingBackground] = useState<'dark' | 'black' | 'white' | 'original'>('original');
  const [inspectModal, setInspectModal] = useState<{
    isOpen: boolean;
    imageUrl: string;
    cardName: string;
    side: 'front' | 'back';
    index?: number;
  }>({
    isOpen: false,
    imageUrl: '',
    cardName: '',
    side: 'front',
  });

  // Scan Images
  const [frontScanUrl, setFrontScanUrl] = useState<string | null>(null);
  const [backScanUrl, setBackScanUrl] = useState<string | null>(null);
  const [hasBackScan, setHasBackScan] = useState<boolean>(true);

  // Template & Alignment
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('psa-4-slab');
  const [slots, setSlots] = useState<ScannerSlot[]>([]);
  const [flipMode, setFlipMode] = useState<FlipMode>('horizontal');
  const [rotationAngle, setRotationAngle] = useState<number>(0);
  const [skewAngle, setSkewAngle] = useState<number>(0);

  // Margins / Offsets overrides
  const [marginAdjustment, setMarginAdjustment] = useState({ top: 0, left: 0, gapX: 0, gapY: 0, scale: 100 });
  const [backMarginAdjustment, setBackMarginAdjustment] = useState({ top: 0, left: 0, gapX: 0, gapY: 0, scale: 100 });
  const [backRotationAngle, setBackRotationAngle] = useState<number>(0);
  const [backSkewAngle, setBackSkewAngle] = useState<number>(0);
  const [backSlots, setBackSlots] = useState<ScannerSlot[]>([]);

  // Cropped Cards & OCR State
  const [croppedCards, setCroppedCards] = useState<CroppedSlotPair[]>([]);
  const [cropError, setCropError] = useState<string | null>(null);
  const [isProcessingOcr, setIsProcessingOcr] = useState<boolean>(false);
  const [isConvertingScan, setIsConvertingScan] = useState<boolean>(false);
  const [convertingMessage, setConvertingMessage] = useState<string>('');
  const [activeFlippedCardIndex, setActiveFlippedCardIndex] = useState<number | null>(null);
  const [previewCardIndex, setPreviewCardIndex] = useState<number | null>(null);
  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front');

  // Dragging slot state on alignment canvas
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  const [dragState, setDragState] = useState<{
    index: number;
    action: 'move' | 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';
    startX: number;
    startY: number;
    startSlot: ScannerSlot;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frontFileInputRef = useRef<HTMLInputElement | null>(null);
  const backFileInputRef = useRef<HTMLInputElement | null>(null);

  // Active template object
  const currentTemplate = templates.find((t) => t.id === selectedTemplateId) || DEFAULT_TEMPLATES[0];

  // Initialize or recompute slots whenever template or margins change (only in template mode)
  useEffect(() => {
    if (scanMode === 'auto-detect') {
      // Auto-detect will be triggered by AI or CV
      return;
    }
    if (currentTemplate.type === 'auto-detect') {
      return;
    }

    const baseSlots = getTemplateSlots(currentTemplate);
    // Apply fine margin and scale adjustments
    const adjusted = baseSlots.map((s) => {
      const scaleFactor = marginAdjustment.scale / 100;
      return {
        ...s,
        xPercent: Math.max(0, Math.min(100, s.xPercent + marginAdjustment.left)),
        yPercent: Math.max(0, Math.min(100, s.yPercent + marginAdjustment.top)),
        widthPercent: Math.max(2, Math.min(100, s.widthPercent * scaleFactor)),
        heightPercent: Math.max(2, Math.min(100, s.heightPercent * scaleFactor)),
      };
    });
    setSlots(adjusted);
    
    const adjustedBack = baseSlots.map((s) => {
      const scaleFactor = backMarginAdjustment.scale / 100;
      return {
        ...s,
        xPercent: Math.max(0, Math.min(100, s.xPercent + backMarginAdjustment.left)),
        yPercent: Math.max(0, Math.min(100, s.yPercent + backMarginAdjustment.top)),
        widthPercent: Math.max(2, Math.min(100, s.widthPercent * scaleFactor)),
        heightPercent: Math.max(2, Math.min(100, s.heightPercent * scaleFactor)),
      };
    });
    setBackSlots(adjustedBack);
  }, [scanMode, selectedTemplateId, currentTemplate, marginAdjustment, backMarginAdjustment]);

  // Load Demo Scans
  const handleLoadDemoLooseRaw8 = () => {
    const demo = createLooseRaw8CardsDemoScan();
    setCropError(null);
    setFrontScanUrl(demo.front);
    setBackScanUrl(demo.back);
    setHasBackScan(true);
    setScanMode('auto-detect');
    setStep(2);
  };

  const handleLoadDemoPsa = () => {
    const demo = createPsaSlabDemoScan();
    setCropError(null);
    setFrontScanUrl(demo.front);
    setBackScanUrl(demo.back);
    setHasBackScan(true);
    setSelectedTemplateId('psa-4-slab');
    setScanMode('template');
    setFlipMode('horizontal');
    setStep(2);
  };

  const handleLoadDemoRaw = () => {
    const demo = createRaw9CardDemoScan();
    setCropError(null);
    setFrontScanUrl(demo.front);
    setBackScanUrl(demo.back);
    setHasBackScan(true);
    setSelectedTemplateId('raw-9-pocket');
    setScanMode('template');
    setFlipMode('horizontal');
    setStep(2);
  };

  const handleLoadDemoRaw8Letter = () => {
    const demo = createRaw8LetterDemoScan();
    setCropError(null);
    setFrontScanUrl(demo.front);
    setBackScanUrl(demo.back);
    setHasBackScan(true);
    setSelectedTemplateId('raw-8-letter');
    setScanMode('template');
    setFlipMode('horizontal');
    setStep(2);
  };

  // Process File Object (handles native TIFF/TIF decoding and standard web formats)
  const processFile = async (file: File, side: 'front' | 'back') => {
    if (!file) return;
    setCropError(null);
    setIsConvertingScan(true);
    const isTiff = /\.tiff?$/i.test(file.name) || file.type.includes('tiff');
    setConvertingMessage(
      isTiff
        ? `Decoding raw scanner TIFF image "${file.name}"...`
        : `Loading "${file.name}"...`
    );

    try {
      const dataUrl = await processUploadFile(file);
      if (side === 'front') {
        setFrontScanUrl(dataUrl);
      } else {
        setBackScanUrl(dataUrl);
      }
    } catch (err: any) {
      console.error('File load error:', err);
      setCropError(err.message || 'Failed to decode image file');
    } finally {
      setIsConvertingScan(false);
      setConvertingMessage('');
    }
  };

  // Handle File Uploads
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
    const file = e.target.files?.[0];
    if (file) processFile(file, side);
    // Reset file input value to allow re-uploading same file if desired
    e.target.value = '';
  };

  // Handle Drag and Drop
  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>, side: 'front' | 'back') => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file, side);
  };

  // Determine hit region for dragging/resizing
  const getHitRegion = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;
    const padding = 25; // Hit padding for edges

    const activeSlots = previewSide === 'front' ? slots : backSlots;
    for (let i = activeSlots.length - 1; i >= 0; i--) {
      const slot = activeSlots[i];
      if (!slot.active) continue;

      let x = (slot.xPercent / 100) * canvas.width;
      let y = (slot.yPercent / 100) * canvas.height;
      let w = (slot.widthPercent / 100) * canvas.width;
      let h = (slot.heightPercent / 100) * canvas.height;

      // Check boundaries using base box (before padding)
      const isTop = mouseY >= y - padding && mouseY <= y + padding;
      const isBottom = mouseY >= y + h - padding && mouseY <= y + h + padding;
      const isLeft = mouseX >= x - padding && mouseX <= x + padding;
      const isRight = mouseX >= x + w - padding && mouseX <= x + w + padding;
      const isInside = mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + h;

      if (isTop && isLeft) return { index: i, action: 'nw' as const };
      if (isTop && isRight) return { index: i, action: 'ne' as const };
      if (isBottom && isLeft) return { index: i, action: 'sw' as const };
      if (isBottom && isRight) return { index: i, action: 'se' as const };
      if (isTop && mouseX > x && mouseX < x + w) return { index: i, action: 'n' as const };
      if (isBottom && mouseX > x && mouseX < x + w) return { index: i, action: 's' as const };
      if (isLeft && mouseY > y && mouseY < y + h) return { index: i, action: 'w' as const };
      if (isRight && mouseY > y && mouseY < y + h) return { index: i, action: 'e' as const };
      if (isInside) return { index: i, action: 'move' as const };
    }
    return null;
  };

  const onCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const hit = getHitRegion(e);
    if (hit) {
      const activeSlots = previewSide === 'front' ? slots : backSlots;
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mouseX = (e.clientX - rect.left) * scaleX;
      const mouseY = (e.clientY - rect.top) * scaleY;
      
      setDragState({
        ...hit,
        startX: mouseX,
        startY: mouseY,
        startSlot: { ...activeSlots[hit.index] }
      });
      setSelectedSlotIndex(hit.index);
    } else {
      setSelectedSlotIndex(null);
    }
  };

  const onCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!dragState) {
      const hit = getHitRegion(e);
      if (hit) {
        if (hit.action === 'move') canvas.style.cursor = 'move';
        else if (hit.action === 'n' || hit.action === 's') canvas.style.cursor = 'ns-resize';
        else if (hit.action === 'e' || hit.action === 'w') canvas.style.cursor = 'ew-resize';
        else if (hit.action === 'nw' || hit.action === 'se') canvas.style.cursor = 'nwse-resize';
        else if (hit.action === 'ne' || hit.action === 'sw') canvas.style.cursor = 'nesw-resize';
      } else {
        canvas.style.cursor = 'default';
      }
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;
    
    const dx = ((mouseX - dragState.startX) / canvas.width) * 100;
    const dy = ((mouseY - dragState.startY) / canvas.height) * 100;

    const newSlot = { ...dragState.startSlot };

    if (dragState.action === 'move') {
      newSlot.xPercent += dx;
      newSlot.yPercent += dy;
    } else {
      if (dragState.action.includes('n')) {
        newSlot.yPercent += dy;
        newSlot.heightPercent -= dy;
      }
      if (dragState.action.includes('s')) {
        newSlot.heightPercent += dy;
      }
      if (dragState.action.includes('w')) {
        newSlot.xPercent += dx;
        newSlot.widthPercent -= dx;
      }
      if (dragState.action.includes('e')) {
        newSlot.widthPercent += dx;
      }
    }

    // Clamp
    newSlot.xPercent = Math.max(0, Math.min(newSlot.xPercent, 100));
    newSlot.yPercent = Math.max(0, Math.min(newSlot.yPercent, 100));
    newSlot.widthPercent = Math.max(1, Math.min(newSlot.widthPercent, 100 - newSlot.xPercent));
    newSlot.heightPercent = Math.max(1, Math.min(newSlot.heightPercent, 100 - newSlot.yPercent));

    if (previewSide === 'front') {
      const updated = [...slots];
      updated[dragState.index] = newSlot;
      setSlots(updated);
    } else {
      const updated = [...backSlots];
      updated[dragState.index] = newSlot;
      setBackSlots(updated);
    }
  };

  const onCanvasMouseUp = () => {
    setDragState(null);
  };

  const onCanvasMouseLeave = () => {
    setDragState(null);
  };

  // Draw alignment overlay on canvas
  const renderAlignmentCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const activeScanUrl = previewSide === 'front' ? frontScanUrl : (hasBackScan ? backScanUrl : frontScanUrl);
    if (!canvas || !activeScanUrl) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    loadImage(activeScanUrl)
      .then((img) => {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        // Draw background scan
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        const activeSlots = previewSide === 'front' ? slots : backSlots;

        // Draw slots
        activeSlots.forEach((slot, index) => {
          const x = (slot.xPercent / 100) * canvas.width;
          const y = (slot.yPercent / 100) * canvas.height;
          const w = (slot.widthPercent / 100) * canvas.width;
          const h = (slot.heightPercent / 100) * canvas.height;

          const isSelected = selectedSlotIndex === index;

          // Slot boundary (Base Box)
          ctx.save();
          if (slot.deskewAngle) {
            // Show the tilted region that will actually be cropped
            ctx.translate(x + w / 2, y + h / 2);
            ctx.rotate((-slot.deskewAngle * Math.PI) / 180);
            ctx.translate(-(x + w / 2), -(y + h / 2));
          }
          if (slot.active) {
            ctx.strokeStyle = isSelected ? '#22d3ee' : '#06b6d4';
            ctx.lineWidth = isSelected ? 4 : 2;
            ctx.fillStyle = isSelected ? 'rgba(34, 211, 238, 0.25)' : 'rgba(6, 182, 212, 0.12)';
            ctx.shadowColor = '#06b6d4';
            ctx.shadowBlur = isSelected ? 12 : 6;
          } else {
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
          }

          ctx.beginPath();
          ctx.roundRect(x, y, w, h, 8);
          ctx.fill();
          ctx.stroke();

          // Margin padding boundary (Dashed line)
          if (slot.active && edgeMarginPercent > 0) {
            const padW = Math.round(w * (edgeMarginPercent / 100));
            const padH = Math.round(h * (edgeMarginPercent / 100));
            const mx = Math.max(0, x - padW);
            const my = Math.max(0, y - padH);
            const mw = Math.min(canvas.width - mx, w + padW * 2);
            const mh = Math.min(canvas.height - my, h + padH * 2);
            
            ctx.beginPath();
            ctx.setLineDash([6, 6]);
            ctx.strokeStyle = 'rgba(250, 204, 21, 0.8)'; // Yellow dashed line for buffer
            ctx.lineWidth = 2;
            ctx.roundRect(mx, my, mw, mh, 10);
            ctx.stroke();
            ctx.setLineDash([]);
          }

          // Slab cert header line preview for graded templates
          if (currentTemplate.isSlab && slot.active) {
            const headerH = h * 0.22;
            ctx.strokeStyle = 'rgba(6, 182, 212, 0.6)';
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(x, y + headerH);
            ctx.lineTo(x + w, y + headerH);
            ctx.stroke();
            ctx.setLineDash([]);
          }

          // Slot label badge
          ctx.fillStyle = slot.active ? (isSelected ? '#22d3ee' : '#06b6d4') : '#ef4444';
          ctx.beginPath();
          ctx.roundRect(x + 6, y + 6, 95, 24, 4);
          ctx.fill();

          ctx.fillStyle = slot.active ? '#000000' : '#ffffff';
          ctx.font = 'bold 11px monospace';
          ctx.fillText(slot.active ? `SLOT ${index + 1}` : 'DISABLED', x + 14, y + 22);

          ctx.restore();
        });
      })
      .catch((err) => {
        console.warn('Canvas alignment preview loading error:', err);
      });
  }, [frontScanUrl, backScanUrl, hasBackScan, previewSide, slots, backSlots, selectedSlotIndex, currentTemplate, edgeMarginPercent]);

  useEffect(() => {
    if (step === 2) {
      renderAlignmentCanvas();
    }
  }, [step, renderAlignmentCanvas]);

  // Local-first edge detection: AI is only called when the local detector is not confident
  const handleAutoDetectCards = async () => {
    if (!frontScanUrl) return;
    setIsProcessingOcr(true);
    setCropError(null);

    const detectOptions =
      currentTemplate.type === 'auto-detect'
        ? {}
        : { expectedCount: currentTemplate.rows * currentTemplate.cols, aspectRatio: currentTemplate.aspectRatio };

    try {
      // 1. Front: local detection
      const frontImg = await loadImage(frontScanUrl);
      const { width: fw, height: fh } = { width: frontImg.naturalWidth, height: frontImg.naturalHeight };
      const local = detectCardsInElement(frontImg, detectOptions);
      let frontQuads = local.quads;
      console.info(
        `Local detection: ${local.quads.length} cards, confidence ${local.confidence.toFixed(2)}`,
        local.reasons
      );

      // 2. Low confidence: one AI call, then snap its rough boxes to real edges
      if (!local.confident) {
        const aiQuads = await detectCardsWithApi(frontScanUrl, fw, fh);
        if (aiQuads && aiQuads.length > 0) {
          const read = createRegionReader(frontImg);
          frontQuads = aiQuads.map((q) => {
            const localMatch = matchQuad(q, local.quads);
            // AI boxes include a 1-2% safety margin, so search a little wider than usual
            return localMatch ?? refineQuad(q, read, fw, fh, 0.06);
          });
        }
      }

      if (frontQuads.length === 0) {
        setCropError('Could not detect distinct card edges in scan. Try adjusting brightness or use rigid template mode.');
        return;
      }

      const frontDetected = sortReadingOrder(frontQuads).map((q, i) => quadToSlot(q, fw, fh, i, `Card ${i + 1}`));
      setSlots(frontDetected);

      // 3. Back: mirror front slots by flip mode, then snap to locally detected back cards (no API call).
      //    backSlots[i] is always the back of slots[i].
      if (hasBackScan && backScanUrl) {
        const backImg = await loadImage(backScanUrl);
        const bw = backImg.naturalWidth, bh = backImg.naturalHeight;
        const backLocal = detectCardsInElement(backImg, detectOptions);
        const read = createRegionReader(backImg);
        const backDetected = frontDetected.map((s, i) => {
          const mirrored = mirrorSlot(s, flipMode);
          const mirroredQuad = slotToQuad(mirrored, bw, bh);
          const snapped = matchQuad(mirroredQuad, backLocal.quads) ?? refineQuad(mirroredQuad, read, bw, bh, 0.04);
          return { ...quadToSlot(snapped, bw, bh, i, `Back Slot ${i + 1}`), rotation: s.rotation, isLandscape: s.isLandscape };
        });
        setBackSlots(backDetected);
      }

      setScanMode('auto-detect');
    } catch (err: any) {
      console.error('Auto detect failed:', err);
      setCropError(err.message || 'Auto-detection request failed.');
    } finally {
      setIsProcessingOcr(false);
    }
  };

  // Uniform batch rotation handlers
  const handleBatchRotate = (delta: number) => {
    if (previewSide === 'front') {
      const updated = slots.map((s) => ({
        ...s,
        rotation: (((s.rotation || 0) + delta) % 360) as any,
      }));
      setSlots(updated);
    } else {
      const updated = backSlots.map((s) => ({
        ...s,
        rotation: (((s.rotation || 0) + delta) % 360) as any,
      }));
      setBackSlots(updated);
    }
  };

  const handleAutoOrientUpright = () => {
    const updatedFront = slots.map((s) => ({
      ...s,
      rotation: s.isLandscape ? 90 : 0,
    }));
    setSlots(updatedFront);
    const updatedBack = backSlots.map((s) => ({
      ...s,
      rotation: s.isLandscape ? 90 : 0,
    }));
    setBackSlots(updatedBack);
  };

  // Rotate single cropped card on-the-fly in Step 3 / 4
  const handleRotateCroppedCard = async (cardIndex: number, side: 'front' | 'back') => {
    const card = croppedCards[cardIndex];
    if (!card) return;

    try {
      const targetUrl = side === 'front' ? card.frontCroppedDataUrl : card.backCroppedDataUrl;
      if (!targetUrl) return;

      const rotated = await rotateImageDataUrl(targetUrl, 90);
      const updated = [...croppedCards];
      if (side === 'front') {
        updated[cardIndex].frontCroppedDataUrl = rotated;
        if (updated[cardIndex].extractedData) {
          updated[cardIndex].extractedData!.frontImage = rotated;
        }
      } else {
        updated[cardIndex].backCroppedDataUrl = rotated;
        if (updated[cardIndex].extractedData) {
          updated[cardIndex].extractedData!.backImage = rotated;
        }
      }
      setCroppedCards(updated);

      // Also update inspectModal if open
      if (inspectModal.isOpen && inspectModal.index === cardIndex && inspectModal.side === side) {
        setInspectModal({ ...inspectModal, imageUrl: rotated });
      }
    } catch (e) {
      console.error('Rotate cropped card error:', e);
    }
  };

  // Perform Batch Cropping and transition to OCR Step
  const handleExecuteBatchCrop = async () => {
    if (!frontScanUrl) return;

    try {
      setCropError(null);
      setIsProcessingOcr(true);
      const activeSlots = slots.filter((s) => s.active);

      if (activeSlots.length === 0) {
        setCropError('Please activate at least 1 slot before cropping.');
        setIsProcessingOcr(false);
        return;
      }

      // Auto-detected back slots are already paired by index (backSlots[i] is the back of slots[i]),
      // so skip grid flip mapping and keep only the backs of active fronts.
      const isAutoPaired = scanMode === 'auto-detect';
      const pairedBackSlots = isAutoPaired ? pairBackSlotsForActiveFronts(slots, backSlots) : backSlots;

      const cropped = await cropAllSlots(
        frontScanUrl,
        hasBackScan && backScanUrl ? backScanUrl : undefined,
        currentTemplate,
        activeSlots,
        isAutoPaired ? 'direct' : flipMode,
        rotationAngle,
        skewAngle,
        pairedBackSlots,
        backRotationAngle,
        backSkewAngle,
        edgeMarginPercent,
        mattingBackground
      );

      if (!cropped || cropped.length === 0) {
        setCropError('No cards could be extracted from the specified slots.');
        setIsProcessingOcr(false);
        return;
      }

      setCroppedCards(cropped);
      setStep(3);

      // Start automatic sequential OCR processing
      runBatchOcr(cropped);
    } catch (err: any) {
      console.error('Cropping error:', err);
      setCropError(err.message || 'Failed to crop cards from scan');
    } finally {
      setIsProcessingOcr(false);
    }
  };

    // Run AI OCR on all cropped cards using Batch endpoint
  const runBatchOcr = async (cardsToProcess: CroppedSlotPair[]) => {
    setIsProcessingOcr(true);
    const updated = [...cardsToProcess];
    
    // Set all to processing
    updated.forEach(card => {
      card.status = 'processing';
      card.progressMessage = 'Analyzing batch with Gemini OCR...';
    });
    setCroppedCards([...updated]);

    try {
      const payloadCards = await Promise.all(
        updated.map(async (c, i) => ({
          id: String(i),
          frontImageBase64: await optimizeCroppedCardForOcr(c.frontCroppedDataUrl, 1000, 0.85),
          backImageBase64: await optimizeCroppedCardForOcr(c.backCroppedDataUrl, 1000, 0.85),
        }))
      );

      const res = await fetch('/api/ocr-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cards: payloadCards,
          templateHint: currentTemplate.name,
          isSlabHint: currentTemplate.isSlab,
        }),
      });

      if (!res.ok) {
        let errorMsg = `Server returned ${res.status}`;
        try {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const errData = await res.json();
            if (errData.error) errorMsg = errData.error;
          }
        } catch (e) {}
        throw new Error(errorMsg);
      }

      const batchData = await res.json();
      
      updated.forEach((card, i) => {
        const data = batchData.find((d: any) => d.id === String(i)) || {};
        card.status = 'done';
        card.progressMessage = 'Data Extracted';
        card.error = undefined;
        card.extractedData = {
          id: `card-${Date.now()}-${i}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          frontImage: card.frontCroppedDataUrl,
          backImage: card.backCroppedDataUrl,
          name: data.name || `Card ${i + 1}`,
          year: data.year || '',
          set: data.set || '',
          cardNumber: data.cardNumber || '',
          category: (data.category as CardCategory) || 'Other',
          variation: data.variation || 'Base',
          isGraded: Boolean(data.isGraded),
          gradingCompany: (data.gradingCompany as GradingBrand) || (currentTemplate.isSlab ? currentTemplate.brand as GradingBrand : 'Raw'),
          grade: data.grade || (data.isGraded ? '10' : ''),
          certNumber: data.certNumber || '',
          subgrades: data.subgrades,
          estimatedCondition: data.estimatedCondition || (data.isGraded ? 'Graded' : 'Near Mint'),
          estimatedValue: typeof data.estimatedValue === 'number' ? data.estimatedValue : 15,
          currency: 'USD',
          frontOcrText: data.frontOcrText || '',
          backOcrText: data.backOcrText || '',
          tags: Array.isArray(data.tags) ? data.tags : ['Cataloged'],
          notes: data.notes || '',
          slotIndex: card.slotIndex,
        };
      });
    } catch (err: any) {
      updated.forEach((card) => {
        card.status = 'error';
        card.error = err.message || 'Batch OCR extraction failed';
      });
    }

    setCroppedCards([...updated]);
    setIsProcessingOcr(false);
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    setStep(4);
  };

  // Re-run OCR for single card
  const handleSingleCardOcrRetry = async (index: number) => {
    const card = croppedCards[index];
    if (!card) return;

    card.status = 'processing';
    setCroppedCards([...croppedCards]);

    try {
      const frontOpt = await optimizeCroppedCardForOcr(card.frontCroppedDataUrl, 1100, 0.86);
      const backOpt = await optimizeCroppedCardForOcr(card.backCroppedDataUrl, 1100, 0.86);

      const res = await fetch('/api/ocr-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frontImageBase64: frontOpt,
          backImageBase64: backOpt,
          templateHint: currentTemplate.name,
          isSlabHint: currentTemplate.isSlab,
        }),
      });
      if (!res.ok) {
        let errorMsg = `Server returned ${res.status}`;
        try {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const errData = await res.json();
            if (errData.error) errorMsg = errData.error;
          }
        } catch (e) {
          // ignore error
        }
        throw new Error(errorMsg);
      }
      const data = await res.json();
      card.status = 'done';
      card.error = undefined;
      card.extractedData = {
        ...(card.extractedData || {}),
        ...data,
      };
    } catch (err: any) {
      card.status = 'error';
      card.error = err.message || 'OCR extraction failed';
    }
    setCroppedCards([...croppedCards]);
  };

  // Update card field in review step
  const handleUpdateCardField = (index: number, field: string, value: any) => {
    const updated = [...croppedCards];
    if (updated[index] && updated[index].extractedData) {
      (updated[index].extractedData as any)[field] = value;
      setCroppedCards(updated);
    }
  };

  // Save all cataloged cards to collection database
  const handleSaveAllToDatabase = () => {
    const validCards: CardRecord[] = croppedCards
      .filter((c) => c.extractedData)
      .map((c) => c.extractedData as CardRecord);

    onBatchCatalogSaved(validCards);
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });

    // Reset scanner
    setStep(1);
    setFrontScanUrl(null);
    setBackScanUrl(null);
    setCroppedCards([]);
  };

  return (
    <div className="space-y-6">
      {/* Workflow Stepper */}
      <div className="bg-[#0a0a0c] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xl">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          {[
            { num: 1, label: 'Upload Scans', desc: 'Front & Back Sheets' },
            { num: 2, label: 'Align & Template', desc: 'Slabs & Grids' },
            { num: 3, label: 'Auto-Crop & OCR', desc: 'AI Vision Engine' },
            { num: 4, label: 'Review & Catalog', desc: 'Save to Database' },
          ].map((s, idx) => (
            <React.Fragment key={s.num}>
              <div
                className={`flex items-center space-x-3 cursor-pointer group ${
                  step === s.num
                    ? 'text-cyan-400 font-bold'
                    : step > s.num
                    ? 'text-emerald-400 font-medium'
                    : 'text-gray-500'
                }`}
                onClick={() => {
                  if (s.num <= step) setStep(s.num as any);
                }}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-mono font-bold transition-all ${
                    step === s.num
                      ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.5)] ring-2 ring-cyan-400/50'
                      : step > s.num
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-[#050505] text-gray-500 border border-white/10'
                  }`}
                >
                  {step > s.num ? <Check className="w-4 h-4" /> : `0${s.num}`}
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-xs uppercase tracking-wider font-bold text-white group-hover:text-cyan-300 transition-colors">{s.label}</div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">{s.desc}</div>
                </div>
              </div>
              {idx < 3 && <ChevronRight className="w-4 h-4 text-gray-700 hidden sm:block" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* STEP 1: UPLOAD FRONT & BACK SCANS */}
      {step === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Upload Columns */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#0a0a0c] border border-white/10 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold uppercase tracking-wider text-white flex items-center gap-2">
                    <Scan className="w-5 h-5 text-cyan-400" />
                    <span>Select Scanner Flatbed Images</span>
                  </h2>
                  <p className="text-xs text-gray-400 mt-1">
                    Upload your high-resolution scanner flatbed sheet images (supports multiple cards/slabs per scan).
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <label className="text-xs text-gray-300 flex items-center space-x-2 cursor-pointer bg-[#050505] px-3 py-1.5 rounded-lg border border-white/10 hover:border-cyan-500/40 transition-all">
                    <input
                      type="checkbox"
                      checked={hasBackScan}
                      onChange={(e) => setHasBackScan(e.target.checked)}
                      className="rounded border-gray-700 text-cyan-500 focus:ring-cyan-400 accent-cyan-400"
                    />
                    <span className="text-[11px] uppercase tracking-wider font-semibold">Dual-Sided (Back Sheet)</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Front Scan Upload Box */}
                <div
                  onClick={() => !isConvertingScan && frontFileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => handleFileDrop(e, 'front')}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all relative overflow-hidden ${
                    frontScanUrl
                      ? 'border-cyan-500/50 bg-cyan-500/5 hover:border-cyan-400'
                      : 'border-white/10 bg-[#050505] hover:border-cyan-500/40 hover:bg-cyan-500/5'
                  }`}
                >
                  <input
                    type="file"
                    ref={frontFileInputRef}
                    onChange={(e) => handleFileUpload(e, 'front')}
                    accept="image/*,.tif,.tiff,image/tiff,image/png,image/jpeg,image/webp,.pdf,application/pdf"
                    className="hidden"
                  />
                  {isConvertingScan ? (
                    <div className="py-12 space-y-3">
                      <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
                      <p className="text-xs uppercase tracking-wider font-bold text-cyan-300 font-mono">
                        {convertingMessage || 'Decoding scanner image...'}
                      </p>
                      <p className="text-[10px] text-gray-400 font-mono">Converting high-resolution scan buffer to canvas</p>
                    </div>
                  ) : frontScanUrl ? (
                    <div className="space-y-3">
                      <div className="relative aspect-[3/4] max-h-56 mx-auto rounded-lg overflow-hidden border border-white/10 bg-black">
                        <img src={frontScanUrl} alt="Front Scan" className="w-full h-full object-contain" />
                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-cyan-500 text-black text-[10px] font-black uppercase tracking-wider shadow-lg">
                          FRONT LOADED
                        </div>
                      </div>
                      <p className="text-[11px] uppercase tracking-wider text-gray-400">Click or drag new TIFF / PNG to replace</p>
                    </div>
                  ) : (
                    <div className="py-8 space-y-3">
                      <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
                        <Upload className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-bold uppercase tracking-wider text-white">Upload Front Scan</p>
                        <p className="text-[10px] text-cyan-400 font-mono mt-1 font-semibold">TIFF, TIF, PNG, JPG, WEBP</p>
                        <p className="text-[10px] text-gray-500 font-mono">Raw flatbed scans decoded directly</p>
                      </div>
                      <span className="inline-block px-3 py-1 bg-cyan-500/15 text-cyan-300 text-[10px] uppercase tracking-wider font-bold rounded-lg border border-cyan-500/30">
                        Choose File or Drop Here
                      </span>
                    </div>
                  )}
                </div>

                {/* Back Scan Upload Box */}
                {hasBackScan ? (
                  <div
                    onClick={() => !isConvertingScan && backFileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => handleFileDrop(e, 'back')}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all relative overflow-hidden ${
                      backScanUrl
                        ? 'border-cyan-500/50 bg-cyan-500/5 hover:border-cyan-400'
                        : 'border-white/10 bg-[#050505] hover:border-cyan-500/40 hover:bg-cyan-500/5'
                    }`}
                  >
                    <input
                      type="file"
                      ref={backFileInputRef}
                      onChange={(e) => handleFileUpload(e, 'back')}
                      accept="image/*,.tif,.tiff,image/tiff,image/png,image/jpeg,image/webp,.pdf,application/pdf"
                      className="hidden"
                    />
                    {isConvertingScan ? (
                      <div className="py-12 space-y-3">
                        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
                        <p className="text-xs uppercase tracking-wider font-bold text-cyan-300 font-mono">
                          {convertingMessage || 'Decoding scanner image...'}
                        </p>
                        <p className="text-[10px] text-gray-400 font-mono">Processing raw flatbed data</p>
                      </div>
                    ) : backScanUrl ? (
                      <div className="space-y-3">
                        <div className="relative aspect-[3/4] max-h-56 mx-auto rounded-lg overflow-hidden border border-white/10 bg-black">
                          <img src={backScanUrl} alt="Back Scan" className="w-full h-full object-contain" />
                          <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-cyan-500 text-black text-[10px] font-black uppercase tracking-wider shadow-lg">
                            BACK LOADED
                          </div>
                        </div>
                        <p className="text-[11px] uppercase tracking-wider text-gray-400">Click or drag new TIFF / PNG to replace</p>
                      </div>
                    ) : (
                      <div className="py-8 space-y-3">
                        <div className="w-12 h-12 rounded-xl bg-white/5 text-gray-400 flex items-center justify-center mx-auto border border-white/10">
                          <Layers className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-sm font-bold uppercase tracking-wider text-white">Upload Back Scan</p>
                          <p className="text-[10px] text-cyan-400 font-mono mt-1 font-semibold">TIFF, TIF, PNG, JPG, WEBP</p>
                          <p className="text-[10px] text-gray-500 font-mono">Flipped sheet on scanner bed</p>
                        </div>
                        <span className="inline-block px-3 py-1 bg-white/5 text-gray-400 text-[10px] uppercase tracking-wider font-bold rounded-lg border border-white/10">
                          Choose Back File or Drop
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="border border-white/10 bg-[#050505] rounded-xl p-6 flex flex-col items-center justify-center text-center text-gray-500">
                    <Layers className="w-8 h-8 mb-2 opacity-30" />
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Front-Only Scanning Mode</p>
                    <p className="text-[10px] mt-1 text-gray-600 font-mono">Only front card faces will be cropped & cataloged.</p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex items-center justify-between pt-4 border-t border-white/10">
                <div className="text-[11px] uppercase tracking-wider font-mono text-gray-500">
                  {frontScanUrl ? 'Ready to choose template & align' : 'Upload scan files or choose instant demo scan'}
                </div>
                <button
                  id="btn-proceed-to-align"
                  disabled={!frontScanUrl}
                  onClick={() => setStep(2)}
                  className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl font-bold uppercase tracking-wider text-xs transition-all ${
                    frontScanUrl
                      ? 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_20px_rgba(6,182,212,0.4)] active:scale-95'
                      : 'bg-white/5 text-gray-600 cursor-not-allowed border border-white/5'
                  }`}
                >
                  <span>Continue to Alignment</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Quick Demo Scans & Guide Sidebar */}
          <div className="space-y-6">
            {/* Quick Demo Box */}
            <div className="bg-[#0a0a0c] border border-cyan-500/30 rounded-2xl p-5 shadow-[0_0_20px_rgba(6,182,212,0.1)]">
              <div className="flex items-center space-x-2 mb-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <h3 className="font-bold text-white text-xs uppercase tracking-wider">Instant Test Scans</h3>
              </div>
              <p className="text-xs text-gray-400 mb-4">
                Don't have a flatbed scanner handy? Test the full workflow immediately with high-resolution synthetic scans:
              </p>

              <div className="space-y-3">
                <button
                  id="btn-demo-loose-raw-8"
                  onClick={handleLoadDemoLooseRaw8}
                  className="w-full text-left p-3.5 rounded-xl bg-[#050505] hover:bg-cyan-500/10 border-2 border-cyan-500/50 hover:border-cyan-400 transition-all flex items-center justify-between group shadow-[0_0_20px_rgba(6,182,212,0.2)] relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 px-2 py-0.5 bg-cyan-500 text-black text-[9px] font-black uppercase tracking-wider rounded-bl">
                    Template-Free Auto Edge
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.9)] animate-pulse" />
                      <span className="font-bold text-xs uppercase tracking-wider text-white group-hover:text-cyan-300">
                        8 Cubs Cards (Loose Scanner Glass)
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-300 font-mono mt-0.5">
                      No Template: Soto, Colvin, Mateo, Castro, Garza, Barney
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-cyan-400 group-hover:translate-x-0.5 transition-transform" />
                </button>

                <button
                  id="btn-demo-raw-8"
                  onClick={handleLoadDemoRaw8Letter}
                  className="w-full text-left p-3 rounded-xl bg-[#050505] hover:bg-cyan-500/10 border border-cyan-500/30 hover:border-cyan-400 transition-all flex items-center justify-between group"
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"></span>
                      <span className="font-bold text-xs uppercase tracking-wider text-white group-hover:text-cyan-300">
                        8-Card Raw Letter Sheet (2x4)
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">8.5x11" Template: Jordan, Charizard, Griffey, Brady</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-cyan-400 transition-colors" />
                </button>

                <button
                  id="btn-demo-psa"
                  onClick={handleLoadDemoPsa}
                  className="w-full text-left p-3 rounded-xl bg-[#050505] hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-500/40 transition-all flex items-center justify-between group"
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]"></span>
                      <span className="font-bold text-xs uppercase tracking-wider text-white group-hover:text-cyan-300">
                        PSA Graded Slabs (4-Up)
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">Jordan 86 Fleer, Charizard 1st Ed, Griffey, LeBron</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-cyan-400 transition-colors" />
                </button>

                <button
                  id="btn-demo-raw"
                  onClick={handleLoadDemoRaw}
                  className="w-full text-left p-3 rounded-xl bg-[#050505] hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-500/40 transition-all flex items-center justify-between group"
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.8)]"></span>
                      <span className="font-bold text-xs uppercase tracking-wider text-white group-hover:text-cyan-300">
                        Raw Cards 9-Pocket Sheet
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">Ohtani, Mahomes, Kobe, Black Lotus, Mewtwo</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-cyan-400 transition-colors" />
                </button>
              </div>
            </div>

            {/* Template Support Overview */}
            <div className="bg-[#0a0a0c] border border-white/10 rounded-2xl p-5 space-y-3">
              <h3 className="font-bold text-white text-xs uppercase tracking-wider flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span>Supported Slab Brands & Formats</span>
              </h3>
              <ul className="text-xs text-gray-400 space-y-2.5">
                <li className="flex items-center space-x-2.5">
                  <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 font-mono text-[10px] font-bold border border-emerald-800/50">AUTO</span>
                  <span className="text-[11px]">Template-Free Edge Detection (any loose flatbed cards)</span>
                </li>
                <li className="flex items-center space-x-2.5">
                  <span className="px-1.5 py-0.5 rounded bg-red-950 text-red-400 font-mono text-[10px] font-bold border border-red-800/50">PSA</span>
                  <span className="text-[11px]">Professional Sports Authenticator (2x2, 2x3)</span>
                </li>
                <li className="flex items-center space-x-2.5">
                  <span className="px-1.5 py-0.5 rounded bg-blue-950 text-blue-400 font-mono text-[10px] font-bold border border-blue-800/50">BGS</span>
                  <span className="text-[11px]">Beckett Grading Services (thick slabs & subgrades)</span>
                </li>
                <li className="flex items-center space-x-2.5">
                  <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 font-mono text-[10px] font-bold border border-emerald-800/50">CGC</span>
                  <span className="text-[11px]">Certified Guaranty Company (modern labels)</span>
                </li>
                <li className="flex items-center space-x-2.5">
                  <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-gray-300 font-mono text-[10px] font-bold border border-white/10">SGC</span>
                  <span className="text-[11px]">Sportscard Guaranty "Tuxedo" black inserts</span>
                </li>
                <li className="flex items-center space-x-2.5">
                  <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 font-mono text-[10px] font-bold border border-cyan-800/50">RAW</span>
                  <span className="text-[11px]">8-Card letter sheet, 9-pocket binders & loose cards</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: TEMPLATE SELECTION & ALIGNMENT OVERLAY */}
      {step === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Controls Column */}
          <div className="lg:col-span-1 space-y-5">
            <AutoEdgeControls
              scanMode={scanMode}
              onScanModeChange={setScanMode}
              isDetecting={isProcessingOcr}
              onRunAutoDetect={handleAutoDetectCards}
              detectedCount={slots.filter((s) => s.active).length}
              edgeMarginPercent={edgeMarginPercent}
              onEdgeMarginChange={setEdgeMarginPercent}
              mattingBackground={mattingBackground}
              onMattingBackgroundChange={setMattingBackground}
              hasBackScan={hasBackScan}
              flipMode={flipMode}
              onFlipModeChange={setFlipMode}
              onBatchRotate={handleBatchRotate}
              onAutoOrientUpright={handleAutoOrientUpright}
              activeSide={previewSide}
              onActiveSideChange={setPreviewSide}
              onResetCalibration={() => {
                if (previewSide === 'front') {
                  setMarginAdjustment({ top: 0, left: 0, gapX: 0, gapY: 0, scale: 100 });
                  setRotationAngle(0);
                  setSkewAngle(0);
                } else {
                  setBackMarginAdjustment({ top: 0, left: 0, gapX: 0, gapY: 0, scale: 100 });
                  setBackRotationAngle(0);
                  setBackSkewAngle(0);
                }
              }}
            />

            {/* Template Selector (Shown when Template Mode is selected) */}
            {scanMode === 'template' && (
              <div className="bg-[#0a0a0c] border border-white/10 rounded-2xl p-4 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono">
                    Rigid Grid Template
                  </label>
                  <button
                    onClick={() => onOpenTemplateEditor(selectedTemplateId)}
                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center space-x-1 uppercase font-bold tracking-wider"
                  >
                    <Sliders className="w-3 h-3" />
                    <span>Customize</span>
                  </button>
                </div>

                <select
                  id="select-scanner-template"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full bg-[#050505] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none font-mono"
                >
                  <optgroup label="Graded Slab Templates (4 Brands)">
                    {templates
                      .filter((t) => t.isSlab && t.type !== 'auto-detect' && t.isBuiltIn)
                      .map((t) => (
                        <option key={`opt-slab-${t.id}`} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Raw Cards Templates">
                    {templates
                      .filter((t) => !t.isSlab && t.type !== 'auto-detect' && t.isBuiltIn)
                      .map((t) => (
                        <option key={`opt-raw-${t.id}`} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </optgroup>
                  {templates.some((t) => !t.isBuiltIn && t.type !== 'auto-detect') && (
                    <optgroup label="Custom Calibration Presets">
                      {templates
                        .filter((t) => !t.isBuiltIn && t.type !== 'auto-detect')
                        .map((t) => (
                          <option key={`opt-custom-${t.id}`} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                    </optgroup>
                  )}
                </select>

                <p className="text-[11px] text-gray-400 leading-relaxed font-mono">{currentTemplate.description}</p>
              </div>
            )}


            {/* Fine Alignment Sliders */}
            <div className="bg-[#0a0a0c] border border-white/10 rounded-2xl p-4 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono">
                  Fine Calibration
                </label>
                <button
                  onClick={() => {
                    if (previewSide === 'front') {
                      setMarginAdjustment({ top: 0, left: 0, gapX: 0, gapY: 0, scale: 100 });
                      setRotationAngle(0);
                      setSkewAngle(0);
                    } else {
                      setBackMarginAdjustment({ top: 0, left: 0, gapX: 0, gapY: 0, scale: 100 });
                      setBackRotationAngle(0);
                      setBackSkewAngle(0);
                    }
                  }}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold uppercase tracking-wider"
                >
                  Reset
                </button>
              </div>

              {/* Toggle Side Control */}
              {hasBackScan && (
                <div className="flex bg-[#050505] rounded-lg p-1 border border-white/10 mb-4">
                  <button
                    onClick={() => setPreviewSide('front')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md ${previewSide === 'front' ? 'bg-cyan-500 text-black' : 'text-gray-400 hover:text-white'}`}
                  >
                    Front Alignment
                  </button>
                  <button
                    onClick={() => setPreviewSide('back')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md ${previewSide === 'back' ? 'bg-cyan-500 text-black' : 'text-gray-400 hover:text-white'}`}
                  >
                    Back Alignment
                  </button>
                </div>
              )}
              {/* Offset X & Y */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-400 font-mono">
                  <span>Horizontal Offset</span>
                  <span className="text-cyan-400">{previewSide === 'front' ? marginAdjustment.left : backMarginAdjustment.left}%</span>
                </div>
                <input
                  type="range"
                  min="-15"
                  max="15"
                  value={previewSide === 'front' ? marginAdjustment.left : backMarginAdjustment.left}
                  onChange={(e) =>
                    previewSide === 'front'
                      ? setMarginAdjustment({ ...marginAdjustment, left: parseFloat(e.target.value) })
                      : setBackMarginAdjustment({ ...backMarginAdjustment, left: parseFloat(e.target.value) })
                  }
                  className="w-full accent-cyan-400"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-400 font-mono">
                  <span>Vertical Offset</span>
                  <span className="text-cyan-400">{previewSide === 'front' ? marginAdjustment.top : backMarginAdjustment.top}%</span>
                </div>
                <input
                  type="range"
                  min="-15"
                  max="15"
                  value={previewSide === 'front' ? marginAdjustment.top : backMarginAdjustment.top}
                  onChange={(e) =>
                    previewSide === 'front'
                      ? setMarginAdjustment({ ...marginAdjustment, top: parseFloat(e.target.value) })
                      : setBackMarginAdjustment({ ...backMarginAdjustment, top: parseFloat(e.target.value) })
                  }
                  className="w-full accent-cyan-400"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-400 font-mono">
                  <span>Card Box Scale</span>
                  <span className="text-cyan-400">{previewSide === 'front' ? marginAdjustment.scale : backMarginAdjustment.scale}%</span>
                </div>
                <input
                  type="range"
                  min="80"
                  max="120"
                  value={previewSide === 'front' ? marginAdjustment.scale : backMarginAdjustment.scale}
                  onChange={(e) =>
                    previewSide === 'front'
                      ? setMarginAdjustment({ ...marginAdjustment, scale: parseFloat(e.target.value) })
                      : setBackMarginAdjustment({ ...backMarginAdjustment, scale: parseFloat(e.target.value) })
                  }
                  className="w-full accent-cyan-400"
                />
              </div>

              {/* Rotation */}
              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                <span className="text-xs text-gray-400 font-mono">Rotate Sheet</span>
                <button
                  onClick={() => previewSide === 'front' ? setRotationAngle((prev) => (prev + 90) % 360) : setBackRotationAngle((prev) => (prev + 90) % 360)}
                  className="px-3 py-1 bg-[#050505] hover:bg-white/5 border border-white/10 text-xs rounded-lg text-white font-mono flex items-center space-x-1.5"
                >
                  <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{previewSide === 'front' ? rotationAngle : backRotationAngle}°</span>
                </button>
              </div>
            </div>

            {/* Error Notification if Cropping Fails */}
            {cropError && (
              <div className="p-3 bg-red-950/60 border border-red-500/50 rounded-xl text-xs text-red-200 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-red-300">Cropping Error</p>
                  <p className="text-[11px] text-red-200/80 font-mono">{cropError}</p>
                </div>
              </div>
            )}

            {/* Execute Batch Crop Button */}
            <button
              id="btn-crop-all-cards"
              disabled={slots.filter((s) => s.active).length === 0 || isProcessingOcr}
              onClick={handleExecuteBatchCrop}
              className="w-full py-3.5 px-4 bg-cyan-500 hover:bg-cyan-400 text-black font-black uppercase tracking-wider rounded-xl text-xs shadow-[0_0_25px_rgba(6,182,212,0.4)] flex items-center justify-center space-x-2 transition-all active:scale-95"
            >
              <Wand2 className="w-4 h-4" />
              <span>
                Crop {slots.filter((s) => s.active).length} Cards & Run OCR
              </span>
            </button>
          </div>

          {/* Interactive Scan Canvas Column */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-[#0a0a0c] border border-white/10 rounded-2xl p-4 shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Eye className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs uppercase tracking-wider font-bold text-white">Live Alignment Reticle</span>
                  <span className="text-[10px] text-gray-500 font-mono">
                    ({slots.filter((s) => s.active).length} active crop slots)
                  </span>
                </div>
                <div className="text-[10px] text-gray-400 font-mono flex items-center space-x-2">
                  <span className="inline-block w-2.5 h-2.5 rounded bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.8)]"></span>
                  <span>Active Crop Area</span>
                </div>
              </div>

              {/* Canvas viewport */}
              <div className="relative bg-black rounded-xl overflow-hidden border border-white/10 max-h-[620px] flex items-center justify-center p-2">
                <canvas
                  ref={canvasRef}
                  onMouseDown={onCanvasMouseDown}
                  onMouseMove={onCanvasMouseMove}
                  onMouseUp={onCanvasMouseUp}
                  onMouseLeave={onCanvasMouseLeave}
                  className="max-h-[600px] w-auto max-w-full object-contain rounded-lg shadow-2xl touch-none"
                />
              </div>

              {/* Slot Toggles Strip */}
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between overflow-x-auto gap-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono whitespace-nowrap">
                  Slot Filter:
                </span>
                <div className="flex items-center space-x-2">
                  {slots.map((s, idx) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        const updated = [...slots];
                        updated[idx].active = !updated[idx].active;
                        setSlots(updated);
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                        s.active
                          ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-[0_0_8px_rgba(6,182,212,0.2)]'
                          : 'bg-red-950/40 text-red-400 border border-red-800/40 line-through'
                      }`}
                    >
                      SLOT {idx + 1}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: CROPPING & AI OCR PIPELINE */}
      {step === 3 && (
        <div className="bg-[#0a0a0c] border border-white/10 rounded-2xl p-6 space-y-6 shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold uppercase tracking-wider text-white flex items-center space-x-2">
                <RefreshCw className={`w-5 h-5 text-cyan-400 ${isProcessingOcr ? 'animate-spin' : ''}`} />
                <span>Processing Card Cropping & OCR Extraction</span>
              </h2>
              <p className="text-xs text-gray-400 font-mono mt-1">
                Cards normalized with safe edge borders and uniform orientation. Click any card to inspect quality.
              </p>
            </div>
            {!isProcessingOcr && (
              <button
                onClick={() => setStep(4)}
                className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-2 shadow-[0_0_15px_rgba(6,182,212,0.4)]"
              >
                <span>Proceed to Review</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Live Progress Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {croppedCards.map((card, idx) => (
              <div
                key={idx}
                className="bg-[#050505] border border-white/10 rounded-xl p-3.5 space-y-3 shadow-lg group relative"
              >
                {/* Images Preview */}
                <div className="grid grid-cols-2 gap-2 aspect-[3/2] bg-black rounded-lg overflow-hidden border border-white/10 p-1">
                  <div
                    onClick={() =>
                      setInspectModal({
                        isOpen: true,
                        imageUrl: card.frontCroppedDataUrl,
                        cardName: card.extractedData?.name || `Card ${idx + 1}`,
                        side: 'front',
                        index: idx,
                      })
                    }
                    className="relative h-full flex items-center justify-center cursor-pointer group/img"
                  >
                    <img
                      src={card.frontCroppedDataUrl}
                      alt={`Front ${idx + 1}`}
                      className="max-h-full max-w-full object-contain rounded"
                    />
                    <span className="absolute bottom-1 left-1 bg-black/90 px-1 py-0.5 text-[8px] text-cyan-400 uppercase font-mono rounded">
                      Front
                    </span>
                    <div className="absolute inset-0 bg-cyan-500/10 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                      <span className="bg-black/80 text-[8px] text-cyan-300 font-mono px-1 py-0.5 rounded border border-cyan-500/40">
                        Inspect
                      </span>
                    </div>
                  </div>

                  {card.backCroppedDataUrl ? (
                    <div
                      onClick={() =>
                        setInspectModal({
                          isOpen: true,
                          imageUrl: card.backCroppedDataUrl!,
                          cardName: card.extractedData?.name || `Card ${idx + 1}`,
                          side: 'back',
                          index: idx,
                        })
                      }
                      className="relative h-full flex items-center justify-center cursor-pointer group/img"
                    >
                      <img
                        src={card.backCroppedDataUrl}
                        alt={`Back ${idx + 1}`}
                        className="max-h-full max-w-full object-contain rounded"
                      />
                      <span className="absolute bottom-1 left-1 bg-black/90 px-1 py-0.5 text-[8px] text-cyan-400 uppercase font-mono rounded">
                        Back
                      </span>
                      <div className="absolute inset-0 bg-cyan-500/10 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                        <span className="bg-black/80 text-[8px] text-cyan-300 font-mono px-1 py-0.5 rounded border border-cyan-500/40">
                          Inspect
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-[9px] font-mono text-gray-600">
                      No Back
                    </div>
                  )}
                </div>

                {/* Quick Individual Rotate Controls */}
                <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10px] font-mono">
                  <span className="text-gray-400 font-bold">{card.label}</span>
                  <div className="flex items-center space-x-1">
                    <button
                      title="Rotate Front 90°"
                      onClick={() => handleRotateCroppedCard(idx, 'front')}
                      className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-cyan-500/20 text-gray-300 hover:text-cyan-300 border border-white/10"
                    >
                      ↻ F 90°
                    </button>
                    {card.backCroppedDataUrl && (
                      <button
                        title="Rotate Back 90°"
                        onClick={() => handleRotateCroppedCard(idx, 'back')}
                        className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-cyan-500/20 text-gray-300 hover:text-cyan-300 border border-white/10"
                      >
                        ↻ B 90°
                      </button>
                    )}
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    {card.status === 'processing' && (
                      <span className="text-cyan-400 flex items-center space-x-1 font-mono text-[11px]">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>OCR running...</span>
                      </span>
                    )}
                    {card.status === 'done' && (
                      <span className="text-emerald-400 flex items-center space-x-1 font-mono text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Extracted</span>
                      </span>
                    )}
                    {card.status === 'error' && (
                      <span className="text-red-400 flex items-center space-x-1 font-mono text-[11px]">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Review Req.</span>
                      </span>
                    )}
                  </div>

                  {card.extractedData && (
                    <div className="text-xs text-gray-300 truncate font-bold">
                      {card.extractedData.name} ({card.extractedData.year || 'N/A'})
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP 4: REVIEW, VERIFY & BATCH SAVE TO DATABASE */}
      {step === 4 && (
        <div className="space-y-6">
          {/* Header Actions */}
          <div className="bg-[#0a0a0c] border border-white/10 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xl">
            <div>
              <h2 className="text-lg font-bold uppercase tracking-wider text-white flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>Review Cataloged Cards ({croppedCards.length})</span>
              </h2>
              <p className="text-xs text-gray-400 font-mono mt-1">
                Uniformly oriented with full edges visible for quality inspection. Click "Inspect Quality" on any card to examine corners, borders, and centering.
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2 bg-[#050505] hover:bg-white/5 text-gray-300 rounded-xl text-xs font-mono font-bold uppercase tracking-wider border border-white/10"
              >
                Re-Align Crop
              </button>
              <button
                id="btn-save-batch-db"
                onClick={handleSaveAllToDatabase}
                className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-black uppercase tracking-wider rounded-xl text-xs shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center space-x-2 transition-all active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>Save All {croppedCards.length} Cards to Database</span>
              </button>
            </div>
          </div>

          {/* Cards Review Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {croppedCards.map((card, idx) => {
              const data = card.extractedData || ({} as Partial<CardRecord>);
              const isFlipped = activeFlippedCardIndex === idx;
              const currentImageUrl =
                isFlipped && card.backCroppedDataUrl
                  ? card.backCroppedDataUrl
                  : card.frontCroppedDataUrl;

              return (
                <div
                  key={idx}
                  className="bg-[#0a0a0c] border border-white/10 rounded-2xl p-5 space-y-4 hover:border-cyan-500/40 transition-all shadow-xl"
                >
                  {/* Card Front / Back Interactive 3D Flip Viewer */}
                  <div className="relative group">
                    <div
                      onClick={() =>
                        setInspectModal({
                          isOpen: true,
                          imageUrl: currentImageUrl,
                          cardName: data.name || `Card ${idx + 1}`,
                          side: isFlipped ? 'back' : 'front',
                          index: idx,
                        })
                      }
                      className="aspect-[3/4] max-h-72 w-full mx-auto bg-black rounded-xl overflow-hidden border border-white/10 flex items-center justify-center p-2 cursor-pointer relative"
                    >
                      <img
                        src={currentImageUrl}
                        alt={`Card ${idx + 1}`}
                        className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <span className="px-3 py-1.5 bg-cyan-500 text-black font-black uppercase tracking-wider text-xs rounded-lg shadow-lg">
                          Inspect Quality & Corners
                        </span>
                      </div>
                    </div>

                    {/* Quality & Rotation Action Controls */}
                    <div className="absolute bottom-3 right-3 flex items-center space-x-1.5">
                      <button
                        title="Rotate 90° clockwise"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRotateCroppedCard(idx, isFlipped ? 'back' : 'front');
                        }}
                        className="px-2.5 py-1.5 bg-black/80 hover:bg-black text-gray-200 hover:text-cyan-400 text-[10px] font-bold uppercase tracking-wider rounded-lg shadow-lg border border-white/20 backdrop-blur-sm transition-all"
                      >
                        ↻ 90°
                      </button>

                      {card.backCroppedDataUrl && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveFlippedCardIndex(isFlipped ? null : idx);
                          }}
                          className="px-3 py-1.5 bg-black/80 hover:bg-black text-cyan-400 text-[10px] font-black uppercase tracking-wider rounded-lg shadow-lg border border-cyan-500/40 backdrop-blur-sm flex items-center space-x-1.5 transition-all"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>{isFlipped ? 'Show Front' : 'Flip to Back'}</span>
                        </button>
                      )}
                    </div>

                    <div className="absolute top-3 left-3 flex items-center space-x-1.5">
                      {data.isGraded ? (
                        <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-black uppercase tracking-wider">
                          {data.gradingCompany} {data.grade || 'GRADED'}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-white/10 text-gray-300 text-[10px] font-mono font-medium">
                          Raw Card
                        </span>
                      )}
                      {data.certNumber && (
                        <span className="px-2 py-0.5 rounded bg-black/80 text-gray-400 text-[10px] font-mono border border-white/10">
                          #{data.certNumber}
                        </span>
                      )}
                    </div>
                  </div>

                  {card.error && (
                    <div className="p-3 bg-red-950/60 border border-red-500/50 rounded-xl text-xs text-red-200 flex items-start space-x-2">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-bold text-red-300">OCR Extraction Failed</p>
                        <p className="text-[11px] text-red-200/80 font-mono">{card.error}</p>
                        <button
                          onClick={() => handleSingleCardOcrRetry(idx)}
                          className="mt-2 px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded border border-red-500/50 text-[10px] uppercase font-bold tracking-wider"
                          disabled={card.status === 'processing'}
                        >
                          {card.status === 'processing' ? 'Retrying...' : 'Retry OCR'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Metadata Fields Form */}
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block mb-1">Player / Character Title</label>
                      <input
                        type="text"
                        value={data.name || ''}
                        onChange={(e) => handleUpdateCardField(idx, 'name', e.target.value)}
                        className="w-full bg-[#050505] border border-white/10 rounded-lg px-2.5 py-1.5 text-white font-bold focus:outline-none focus:border-cyan-400 font-mono text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block mb-1">Year</label>
                        <input
                          type="text"
                          value={data.year || ''}
                          onChange={(e) => handleUpdateCardField(idx, 'year', e.target.value)}
                          className="w-full bg-[#050505] border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-400 font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block mb-1">Card #</label>
                        <input
                          type="text"
                          value={data.cardNumber || ''}
                          onChange={(e) => handleUpdateCardField(idx, 'cardNumber', e.target.value)}
                          className="w-full bg-[#050505] border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-400 font-mono text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block mb-1">Set / Series</label>
                      <input
                        type="text"
                        value={data.set || ''}
                        onChange={(e) => handleUpdateCardField(idx, 'set', e.target.value)}
                        className="w-full bg-[#050505] border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-400 font-mono text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block mb-1">Category</label>
                        <select
                          value={data.category || 'Other'}
                          onChange={(e) => handleUpdateCardField(idx, 'category', e.target.value)}
                          className="w-full bg-[#050505] border border-white/10 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:border-cyan-400 font-mono text-xs"
                        >
                          <option value="Baseball">Baseball</option>
                          <option value="Basketball">Basketball</option>
                          <option value="Football">Football</option>
                          <option value="Hockey">Hockey</option>
                          <option value="Soccer">Soccer</option>
                          <option value="Pokemon">Pokemon</option>
                          <option value="Magic: The Gathering">Magic (MTG)</option>
                          <option value="Yu-Gi-Oh!">Yu-Gi-Oh!</option>
                          <option value="Non-Sport / Marvel">Marvel / Non-Sport</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block mb-1">Est. Value ($)</label>
                        <input
                          type="number"
                          value={data.estimatedValue || 0}
                          onChange={(e) =>
                            handleUpdateCardField(idx, 'estimatedValue', parseFloat(e.target.value) || 0)
                          }
                          className="w-full bg-[#050505] border border-white/10 rounded-lg px-2.5 py-1.5 text-emerald-400 font-mono font-bold focus:outline-none focus:border-cyan-400 text-xs"
                        />
                      </div>
                    </div>

                    {/* Graded Details */}
                    {data.isGraded && (
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10">
                        <div>
                          <label className="text-[9px] uppercase font-bold text-gray-400 block mb-1">Brand</label>
                          <select
                            value={data.gradingCompany || 'PSA'}
                            onChange={(e) => handleUpdateCardField(idx, 'gradingCompany', e.target.value)}
                            className="w-full bg-[#050505] border border-white/10 rounded-lg px-1.5 py-1 text-white text-[10px] font-mono"
                          >
                            <option value="PSA">PSA</option>
                            <option value="BGS">BGS</option>
                            <option value="CGC">CGC</option>
                            <option value="SGC">SGC</option>
                            <option value="TAG">TAG</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] uppercase font-bold text-gray-400 block mb-1">Grade</label>
                          <input
                            type="text"
                            value={data.grade || ''}
                            onChange={(e) => handleUpdateCardField(idx, 'grade', e.target.value)}
                            className="w-full bg-[#050505] border border-white/10 rounded-lg px-1.5 py-1 text-white font-mono font-bold text-[10px]"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] uppercase font-bold text-gray-400 block mb-1">Cert #</label>
                          <input
                            type="text"
                            value={data.certNumber || ''}
                            onChange={(e) => handleUpdateCardField(idx, 'certNumber', e.target.value)}
                            className="w-full bg-[#050505] border border-white/10 rounded-lg px-1.5 py-1 text-white font-mono text-[10px]"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Inspect Quality Modal */}
      <InspectQualityModal
        isOpen={inspectModal.isOpen}
        onClose={() => setInspectModal({ ...inspectModal, isOpen: false })}
        imageUrl={inspectModal.imageUrl}
        cardName={inspectModal.cardName}
        side={inspectModal.side}
        onRotate={() => {
          if (inspectModal.index !== undefined) {
            handleRotateCroppedCard(inspectModal.index, inspectModal.side);
          }
        }}
      />
    </div>
  );
};

