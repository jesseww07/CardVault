export type CardCategory =
  | 'Baseball'
  | 'Basketball'
  | 'Football'
  | 'Hockey'
  | 'Soccer'
  | 'Pokemon'
  | 'Magic: The Gathering'
  | 'Yu-Gi-Oh!'
  | 'Non-Sport / Marvel'
  | 'Other';

export type GradingBrand = 'PSA' | 'BGS' | 'CGC' | 'SGC' | 'TAG' | 'Raw' | 'Other';

export interface CardSubgrades {
  centering?: string;
  corners?: string;
  edges?: string;
  surface?: string;
  auto?: string;
}

export interface CardRecord {
  id: string;
  createdAt: number;
  updatedAt: number;
  frontImage: string; // base64 / data URL
  backImage?: string;
  name: string;
  year: string;
  set: string;
  cardNumber: string;
  category: CardCategory;
  variation: string;
  isGraded: boolean;
  gradingCompany: GradingBrand;
  grade: string;
  certNumber?: string;
  subgrades?: CardSubgrades;
  estimatedCondition?: string;
  estimatedValue?: number;
  currency?: string;
  frontOcrText?: string;
  backOcrText?: string;
  tags: string[];
  notes?: string;
  scanBatchId?: string;
  slotIndex?: number;
}

export interface ScannerSlot {
  id: number;
  active: boolean;
  xPercent: number; // 0 to 100
  yPercent: number; // 0 to 100
  widthPercent: number; // 0 to 100
  heightPercent: number; // 0 to 100
  label?: string;
  rotation?: number; // 0, 90, 180, 270 degrees
  backRotation?: number; // rotation for back card
  deskewAngle?: number; // slight rotation in degrees (-15 to 15)
  isLandscape?: boolean;
}

export interface DetectedCardResult {
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] in 0-1000 scale
  label?: string;
  isSlab?: boolean;
  detectedBrand?: string;
  orientation?: number; // 0, 90, 180, 270
  isLandscape?: boolean;
  confidence?: number;
}

export interface NormalizationOptions {
  edgeMarginPercent: number; // 0 to 10% outer padding so all edges/corners are clearly visible
  mattingBackground: 'dark' | 'black' | 'white' | 'original'; // Background for edge margin padding
  autoDeskew: boolean;
  defaultOrientation: 'auto' | 'upright' | 'as-scanned';
}

export interface ScannerTemplate {
  id: string;
  name: string;
  description: string;
  brand: GradingBrand | 'Raw' | 'Custom';
  type: 'slab-psa' | 'slab-bgs' | 'slab-cgc' | 'slab-sgc' | 'raw-grid' | 'custom' | 'auto-detect';
  isSlab: boolean;
  rows: number;
  cols: number;
  aspectRatio: number; // width / height
  topMarginPercent: number;
  bottomMarginPercent: number;
  leftMarginPercent: number;
  rightMarginPercent: number;
  horizontalGapPercent: number;
  verticalGapPercent: number;
  cornerRadius: number; // in px for visual guide
  customSlots?: ScannerSlot[];
  isBuiltIn?: boolean;
}

export type FlipMode =
  | 'horizontal' // Left-to-right book flip (Col 1 on front -> Col 3 on back in a 3-col grid)
  | 'vertical'   // Top-to-bottom calendar flip (Row 1 on front -> Row 3 on back in a 3-row grid)
  | 'direct'     // Direct 1-to-1 matching (Slot i -> Slot i)
  | 'ai-match';  // AI content-based matching

export interface CroppedSlotPair {
  slotIndex: number;
  frontSlotIndex: number;
  backSlotIndex?: number;
  frontCroppedDataUrl: string;
  backCroppedDataUrl?: string;
  label: string;
  active: boolean;
  status: 'pending' | 'processing' | 'done' | 'error';
  progressMessage?: string;
  extractedData?: Partial<CardRecord>;
  error?: string;
}

export interface ScanBatchSession {
  id: string;
  timestamp: number;
  templateId: string;
  frontScanUrl: string;
  backScanUrl?: string;
  flipMode: FlipMode;
  rotationAngle: number;
  skewAngle: number;
  slots: ScannerSlot[];
  croppedCards: CroppedSlotPair[];
}

export interface FilterOptions {
  searchQuery: string;
  category: string;
  gradingCompany: string;
  grade: string;
  isGradedOnly: 'all' | 'graded' | 'raw';
  sortBy: 'createdAt' | 'name' | 'year' | 'grade' | 'estimatedValue';
  sortOrder: 'asc' | 'desc';
  selectedTag?: string;
}
