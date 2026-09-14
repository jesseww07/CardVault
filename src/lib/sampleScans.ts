// Generates high-fidelity demo scanner images with Front & Back matching for PSA, BGS, SGC, CGC slabs and Raw cards

export interface SampleScanPreset {
  id: string;
  name: string;
  templateId: string;
  description: string;
  category: 'graded' | 'raw';
  frontDataUrl: string;
  backDataUrl: string;
}

// Generate PSA 4-Slab Front & Back Flatbed Scan
export function createPsaSlabDemoScan(): { front: string; back: string } {
  const width = 1200;
  const height = 1600;

  // FRONT CANVAS
  const frontCanvas = document.createElement('canvas');
  frontCanvas.width = width;
  frontCanvas.height = height;
  const fCtx = frontCanvas.getContext('2d')!;

  // Scanner glass background (slight warm neutral gray)
  fCtx.fillStyle = '#1c1e22';
  fCtx.fillRect(0, 0, width, height);

  // Scanner grid guide lines
  fCtx.strokeStyle = '#2b2f38';
  fCtx.lineWidth = 1;
  for (let x = 0; x < width; x += 100) {
    fCtx.beginPath();
    fCtx.moveTo(x, 0);
    fCtx.lineTo(x, height);
    fCtx.stroke();
  }

  // Draw 4 PSA Slabs (2x2)
  const slabDefs = [
    {
      x: 100,
      y: 90,
      w: 460,
      h: 680,
      player: 'MICHAEL JORDAN',
      year: '1986',
      set: 'FLEER',
      cardNum: '#57',
      grade: 'GEM MT 10',
      cert: '48291048',
      color: '#c41230',
      accent: '#17408B',
      cat: 'BASKETBALL',
    },
    {
      x: 640,
      y: 90,
      w: 460,
      h: 680,
      player: 'CHARIZARD - 1ST ED.',
      year: '1999',
      set: 'POKEMON BASE SET',
      cardNum: '#4/102',
      grade: 'MINT 9',
      cert: '29481023',
      color: '#e65c00',
      accent: '#ffcc00',
      cat: 'POKEMON',
    },
    {
      x: 100,
      y: 830,
      w: 460,
      h: 680,
      player: 'KEN GRIFFEY JR.',
      year: '1989',
      set: 'UPPER DECK STAR ROOKIE',
      cardNum: '#1',
      grade: 'GEM MT 10',
      cert: '81039471',
      color: '#005c53',
      accent: '#042940',
      cat: 'BASEBALL',
    },
    {
      x: 640,
      y: 830,
      w: 460,
      h: 680,
      player: 'LEBRON JAMES',
      year: '2003',
      set: 'TOPPS CHROME RC',
      cardNum: '#111',
      grade: 'MINT 9',
      cert: '67401928',
      color: '#6f263d',
      accent: '#ffb81c',
      cat: 'BASKETBALL',
    },
  ];

  slabDefs.forEach((s) => {
    // Slab outer border (clear frosted acrylic)
    fCtx.save();
    fCtx.fillStyle = '#0d1117';
    fCtx.shadowColor = 'rgba(0,0,0,0.8)';
    fCtx.shadowBlur = 15;
    fCtx.beginPath();
    fCtx.roundRect(s.x, s.y, s.w, s.h, 16);
    fCtx.fill();
    fCtx.strokeStyle = '#4a5568';
    fCtx.lineWidth = 4;
    fCtx.stroke();
    fCtx.restore();

    // PSA Header Label (Red Border, White BG)
    fCtx.fillStyle = '#ffffff';
    fCtx.fillRect(s.x + 20, s.y + 20, s.w - 40, 110);
    fCtx.strokeStyle = '#dc2626';
    fCtx.lineWidth = 3;
    fCtx.strokeRect(s.x + 20, s.y + 20, s.w - 40, 110);

    // PSA Red Logo Banner
    fCtx.fillStyle = '#dc2626';
    fCtx.fillRect(s.x + 20, s.y + 20, 60, 24);
    fCtx.fillStyle = '#ffffff';
    fCtx.font = 'bold 13px sans-serif';
    fCtx.fillText('PSA', s.x + 32, s.y + 37);

    // Label Text
    fCtx.fillStyle = '#111827';
    fCtx.font = 'bold 15px sans-serif';
    fCtx.fillText(`${s.year} ${s.set}`, s.x + 90, s.y + 38);
    fCtx.font = 'bold 16px sans-serif';
    fCtx.fillText(`${s.cardNum} ${s.player}`, s.x + 30, s.y + 68);

    // Grade
    fCtx.fillStyle = '#dc2626';
    fCtx.font = 'bold 22px sans-serif';
    fCtx.fillText(s.grade, s.x + s.w - 180, s.y + 55);

    // Cert & Barcode
    fCtx.fillStyle = '#4b5563';
    fCtx.font = '12px monospace';
    fCtx.fillText(`CERT #${s.cert}`, s.x + 30, s.y + 115);

    // Card Inner Window
    fCtx.fillStyle = s.color;
    fCtx.beginPath();
    fCtx.roundRect(s.x + 30, s.y + 150, s.w - 60, s.h - 180, 8);
    fCtx.fill();

    // Card Graphic art representation
    fCtx.fillStyle = s.accent;
    fCtx.fillRect(s.x + 50, s.y + 180, s.w - 100, s.h - 260);

    fCtx.fillStyle = '#ffffff';
    fCtx.font = 'bold 24px sans-serif';
    fCtx.textAlign = 'center';
    fCtx.fillText(s.player, s.x + s.w / 2, s.y + s.h / 2);
    fCtx.font = 'bold 15px sans-serif';
    fCtx.fillText(`[ ${s.set} • ${s.year} ]`, s.x + s.w / 2, s.y + s.h / 2 + 40);
    fCtx.textAlign = 'left';
  });

  // BACK CANVAS (Book-flipped horizontally)
  const backCanvas = document.createElement('canvas');
  backCanvas.width = width;
  backCanvas.height = height;
  const bCtx = backCanvas.getContext('2d')!;

  bCtx.fillStyle = '#1c1e22';
  bCtx.fillRect(0, 0, width, height);

  // Mirrored positions for horizontal book flip (col 0 <-> col 1)
  const backSlabDefs = [
    { ...slabDefs[1], x: 100, y: 90 }, // Slab 2 is now top-left
    { ...slabDefs[0], x: 640, y: 90 }, // Slab 1 is now top-right
    { ...slabDefs[3], x: 100, y: 830 }, // Slab 4 is now bottom-left
    { ...slabDefs[2], x: 640, y: 830 }, // Slab 3 is now bottom-right
  ];

  backSlabDefs.forEach((s) => {
    bCtx.save();
    bCtx.fillStyle = '#0d1117';
    bCtx.shadowColor = 'rgba(0,0,0,0.8)';
    bCtx.shadowBlur = 15;
    bCtx.beginPath();
    bCtx.roundRect(s.x, s.y, s.w, s.h, 16);
    bCtx.fill();
    bCtx.strokeStyle = '#4a5568';
    bCtx.lineWidth = 4;
    bCtx.stroke();
    bCtx.restore();

    // PSA Back Label (Hologram & Barcode)
    bCtx.fillStyle = '#ffffff';
    bCtx.fillRect(s.x + 20, s.y + 20, s.w - 40, 110);
    bCtx.strokeStyle = '#dc2626';
    bCtx.lineWidth = 2;
    bCtx.strokeRect(s.x + 20, s.y + 20, s.w - 40, 110);

    bCtx.fillStyle = '#111827';
    bCtx.font = '12px monospace';
    bCtx.fillText(`PSA AUTHENTICATED • #${s.cert}`, s.x + 30, s.y + 45);

    // Barcode stripes
    bCtx.fillStyle = '#000000';
    for (let bx = s.x + 30; bx < s.x + s.w - 50; bx += 6) {
      bCtx.fillRect(bx, s.y + 60, 3, 40);
    }

    // Card Back Details
    bCtx.fillStyle = '#1e293b';
    bCtx.beginPath();
    bCtx.roundRect(s.x + 30, s.y + 150, s.w - 60, s.h - 180, 8);
    bCtx.fill();

    bCtx.fillStyle = '#94a3b8';
    bCtx.font = 'bold 18px sans-serif';
    bCtx.textAlign = 'center';
    bCtx.fillText(`${s.player} - CAREER STATS`, s.x + s.w / 2, s.y + 220);
    bCtx.font = '13px sans-serif';
    bCtx.fillText(`Card #${s.cardNum} | © ${s.year} Official Licensed Product`, s.x + s.w / 2, s.y + s.h - 60);
    bCtx.textAlign = 'left';
  });

  return {
    front: frontCanvas.toDataURL('image/jpeg', 0.9),
    back: backCanvas.toDataURL('image/jpeg', 0.9),
  };
}

// Generate Raw 9-Pocket Trading Card Sheet Front & Back Demo
export function createRaw9CardDemoScan(): { front: string; back: string } {
  const width = 1200;
  const height = 1600;

  const rawCards = [
    { name: 'Shohei Ohtani', year: '2018', set: 'Topps Chrome RC', num: '#150', cat: 'Baseball', color: '#ba0c2f' },
    { name: 'Mewtwo GX', year: '2017', set: 'Shining Legends', num: '#78/73', cat: 'Pokemon', color: '#6d28d9' },
    { name: 'Patrick Mahomes', year: '2017', set: 'Panini Prizm RC', num: '#269', cat: 'Football', color: '#e31837' },
    { name: 'Kobe Bryant', year: '1996', set: 'Topps Chrome RC', num: '#138', cat: 'Basketball', color: '#552583' },
    { name: 'Black Lotus', year: '1993', set: 'Magic MTG Beta', num: '#233', cat: 'Magic: The Gathering', color: '#0f172a' },
    { name: 'Connor McDavid', year: '2015', set: 'Upper Deck Young Guns', num: '#201', cat: 'Hockey', color: '#041e42' },
    { name: 'Spider-Man #1', year: '1990', set: 'Marvel Universe Impel', num: '#1', cat: 'Non-Sport / Marvel', color: '#b91c1c' },
    { name: 'Lionel Messi', year: '2004', set: 'Panini Megacracks RC', num: '#71', cat: 'Soccer', color: '#004d98' },
    { name: 'Blue-Eyes White Dragon', year: '2002', set: 'Legend of Blue Eyes', num: '#LOB-001', cat: 'Yu-Gi-Oh!', color: '#1e3a8a' },
  ];

  const frontCanvas = document.createElement('canvas');
  frontCanvas.width = width;
  frontCanvas.height = height;
  const fCtx = frontCanvas.getContext('2d')!;

  // 9-pocket ultra pro binder page background
  fCtx.fillStyle = '#1e293b';
  fCtx.fillRect(0, 0, width, height);

  const cols = 3;
  const rows = 3;
  const cardW = 340;
  const cardH = 460;
  const startX = 60;
  const startY = 60;
  const gapX = 40;
  const gapY = 45;

  rawCards.forEach((c, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = startX + col * (cardW + gapX);
    const y = startY + row * (cardH + gapY);

    // Card boundary & shadow
    fCtx.save();
    fCtx.fillStyle = c.color;
    fCtx.shadowColor = 'rgba(0,0,0,0.6)';
    fCtx.shadowBlur = 10;
    fCtx.beginPath();
    fCtx.roundRect(x, y, cardW, cardH, 8);
    fCtx.fill();
    fCtx.strokeStyle = '#ffffff';
    fCtx.lineWidth = 2;
    fCtx.stroke();
    fCtx.restore();

    // Card Art Banner
    fCtx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    fCtx.fillRect(x + 15, y + 50, cardW - 30, cardH - 120);

    // Card Titles
    fCtx.fillStyle = '#ffffff';
    fCtx.font = 'bold 18px sans-serif';
    fCtx.fillText(c.name, x + 20, y + 35);

    fCtx.font = '13px sans-serif';
    fCtx.fillText(`${c.year} ${c.set}`, x + 20, y + cardH - 40);
    fCtx.font = 'bold 14px sans-serif';
    fCtx.fillText(`${c.num} • ${c.cat}`, x + 20, y + cardH - 18);
  });

  // BACK CANVAS (Horizontal book flip)
  const backCanvas = document.createElement('canvas');
  backCanvas.width = width;
  backCanvas.height = height;
  const bCtx = backCanvas.getContext('2d')!;

  bCtx.fillStyle = '#1e293b';
  bCtx.fillRect(0, 0, width, height);

  rawCards.forEach((c, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    // Mirrored column for back sheet
    const mirroredCol = cols - 1 - col;
    const x = startX + mirroredCol * (cardW + gapX);
    const y = startY + row * (cardH + gapY);

    bCtx.save();
    bCtx.fillStyle = '#0f172a';
    bCtx.beginPath();
    bCtx.roundRect(x, y, cardW, cardH, 8);
    bCtx.fill();
    bCtx.strokeStyle = '#64748b';
    bCtx.lineWidth = 2;
    bCtx.stroke();
    bCtx.restore();

    bCtx.fillStyle = '#94a3b8';
    bCtx.font = 'bold 16px sans-serif';
    bCtx.fillText(`${c.name} (BACK)`, x + 20, y + 35);
    bCtx.font = '13px sans-serif';
    bCtx.fillText(`Official Stats & Checklist`, x + 20, y + 80);
    bCtx.fillText(`Card ${c.num} - ${c.year}`, x + 20, y + cardH - 30);
  });

  return {
    front: frontCanvas.toDataURL('image/jpeg', 0.9),
    back: backCanvas.toDataURL('image/jpeg', 0.9),
  };
}

// Generate 8-Card Loose Raw Cards Demo Scan (No Template - Scanner Glass Placement)
export function createLooseRaw8CardsDemoScan(): { front: string; back: string } {
  const width = 1600;
  const height = 2100;

  const rawCards = [
    { name: 'Geovany Soto', team: 'CHICAGO CUBS • CATCHER', year: '2011', set: 'Topps', num: '#611', color: '#1d4ed8', border: '#f8fafc', bg: '#0369a1' },
    { name: 'Tyler Colvin', team: 'CHICAGO CUBS • OUTFIELD', year: '2011', set: 'Topps', num: '#256', color: '#1e40af', border: '#f8fafc', bg: '#0284c7' },
    { name: 'Marcos Mateo', team: 'CHICAGO CUBS • PITCHER', year: '2011', set: 'Topps RC', num: '#431', color: '#1e3a8a', border: '#f8fafc', bg: '#0f766e' },
    { name: 'Starlin Castro', team: 'CHICAGO CUBS • SHORTSTOP', year: '2011', set: 'Topps', num: '#655', color: '#1e40af', border: '#f8fafc', bg: '#b45309' },
    { name: 'Blake DeWitt', team: 'CHICAGO CUBS • SECOND BASE', year: '2011', set: 'Topps', num: '#628', color: '#1d4ed8', border: '#f8fafc', bg: '#047857' },
    { name: 'Matt Garza', team: 'CHICAGO CUBS • PITCHER', year: '2011', set: 'Topps', num: '#370', color: '#1e3a8a', border: '#f8fafc', bg: '#1d4ed8' },
    { name: 'Tony Campana', team: 'CHICAGO CUBS • OUTFIELD', year: '2011', set: 'Topps RC', num: '#US57', color: '#b91c1c', border: '#f8fafc', bg: '#991b1b' },
    { name: 'Darwin Barney', team: 'CHICAGO CUBS • SHORTSTOP', year: '2011', set: 'Topps RC', num: '#347', color: '#1e40af', border: '#f8fafc', bg: '#1e3a8a' },
  ];

  // FRONT CANVAS (Scanner glass background - slightly off-white scanner lid)
  const frontCanvas = document.createElement('canvas');
  frontCanvas.width = width;
  frontCanvas.height = height;
  const fCtx = frontCanvas.getContext('2d')!;

  // Scanner glass lid texture
  fCtx.fillStyle = '#e2e8f0';
  fCtx.fillRect(0, 0, width, height);

  // Loose card positioning (4 rows x 2 cols of landscape cards placed on scanner glass)
  const cardW = 670;
  const cardH = 470;
  const positions = [
    { x: 70, y: 40, skew: 0 },
    { x: 860, y: 35, skew: 0.2 },
    { x: 75, y: 550, skew: -0.2 },
    { x: 865, y: 545, skew: 0 },
    { x: 68, y: 1060, skew: 0.1 },
    { x: 860, y: 1055, skew: -0.1 },
    { x: 72, y: 1570, skew: 0 },
    { x: 862, y: 1565, skew: 0.2 },
  ];

  rawCards.forEach((c, idx) => {
    const pos = positions[idx];
    const x = pos.x;
    const y = pos.y;

    fCtx.save();
    // Drop shadow onto scanner glass
    fCtx.shadowColor = 'rgba(0,0,0,0.35)';
    fCtx.shadowBlur = 14;
    fCtx.shadowOffsetX = 3;
    fCtx.shadowOffsetY = 4;

    // Card white border perimeter (crucial: visible borders)
    fCtx.fillStyle = '#ffffff';
    fCtx.beginPath();
    fCtx.roundRect(x, y, cardW, cardH, 8);
    fCtx.fill();
    fCtx.restore();

    // Inner artwork frame
    fCtx.save();
    fCtx.fillStyle = c.bg;
    fCtx.beginPath();
    fCtx.roundRect(x + 22, y + 20, cardW - 44, cardH - 40, 4);
    fCtx.fill();

    // Action Photo Box
    fCtx.fillStyle = 'rgba(255,255,255,0.2)';
    fCtx.fillRect(x + 35, y + 35, 340, cardH - 70);

    // Player action graphic mockup
    fCtx.fillStyle = '#ffffff';
    fCtx.beginPath();
    fCtx.arc(x + 200, y + 160, 48, 0, Math.PI * 2);
    fCtx.fill();

    // Cubs Logo circle
    fCtx.fillStyle = '#c41230';
    fCtx.beginPath();
    fCtx.arc(x + cardW - 75, y + cardH - 65, 36, 0, Math.PI * 2);
    fCtx.fill();
    fCtx.strokeStyle = '#ffffff';
    fCtx.lineWidth = 3;
    fCtx.stroke();
    fCtx.fillStyle = '#ffffff';
    fCtx.font = 'bold 18px sans-serif';
    fCtx.fillText('CUBS', x + cardW - 100, y + cardH - 58);

    // Header banner with Name & Position
    fCtx.fillStyle = 'rgba(0,0,0,0.6)';
    fCtx.fillRect(x + 390, y + 50, cardW - 430, 90);
    fCtx.fillStyle = '#facc15';
    fCtx.font = 'bold 28px sans-serif';
    fCtx.fillText(c.name, x + 405, y + 90);
    fCtx.fillStyle = '#ffffff';
    fCtx.font = 'bold 15px sans-serif';
    fCtx.fillText(c.team, x + 405, y + 120);

    // Card details & number
    fCtx.fillStyle = '#ffffff';
    fCtx.font = 'bold 22px monospace';
    fCtx.fillText(`${c.year} ${c.set} ${c.num}`, x + 405, y + 180);

    fCtx.restore();
  });

  // BACK CANVAS (Cards placed for reverse scan - mirrored horizontally)
  const backCanvas = document.createElement('canvas');
  backCanvas.width = width;
  backCanvas.height = height;
  const bCtx = backCanvas.getContext('2d')!;

  bCtx.fillStyle = '#e2e8f0';
  bCtx.fillRect(0, 0, width, height);

  const backPositions = [
    { x: 860, y: 40 },
    { x: 70, y: 35 },
    { x: 865, y: 550 },
    { x: 75, y: 545 },
    { x: 860, y: 1060 },
    { x: 68, y: 1055 },
    { x: 862, y: 1570 },
    { x: 72, y: 1565 },
  ];

  rawCards.forEach((c, idx) => {
    const pos = backPositions[idx];
    const x = pos.x;
    const y = pos.y;

    bCtx.save();
    bCtx.shadowColor = 'rgba(0,0,0,0.35)';
    bCtx.shadowBlur = 14;
    bCtx.shadowOffsetX = 3;
    bCtx.shadowOffsetY = 4;

    // Card white border perimeter
    bCtx.fillStyle = '#ffffff';
    bCtx.beginPath();
    bCtx.roundRect(x, y, cardW, cardH, 8);
    bCtx.fill();
    bCtx.restore();

    // Inner back card stats layout
    bCtx.save();
    bCtx.fillStyle = '#f8fafc';
    bCtx.beginPath();
    bCtx.roundRect(x + 18, y + 16, cardW - 36, cardH - 32, 4);
    bCtx.fill();
    bCtx.strokeStyle = '#cbd5e1';
    bCtx.lineWidth = 1.5;
    bCtx.stroke();

    // Header with card #
    bCtx.fillStyle = '#1e3a8a';
    bCtx.fillRect(x + 22, y + 20, cardW - 44, 46);
    bCtx.fillStyle = '#ffffff';
    bCtx.font = 'bold 22px sans-serif';
    bCtx.fillText(c.name, x + 35, y + 52);
    bCtx.font = 'bold 22px monospace';
    bCtx.fillText(c.num, x + cardW - 120, y + 52);

    // Bio Text
    bCtx.fillStyle = '#334155';
    bCtx.font = '14px sans-serif';
    bCtx.fillText(`${c.team} | Bats: Right  Throws: Right`, x + 35, y + 90);
    bCtx.fillText(`Acquired via draft / trade. Core contributor for the Chicago Cubs.`, x + 35, y + 115);

    // Stats Table Mock
    bCtx.fillStyle = '#0f172a';
    bCtx.fillRect(x + 30, y + 140, cardW - 60, 160);
    bCtx.fillStyle = '#38bdf8';
    bCtx.font = '14px monospace';
    bCtx.fillText(`YEAR    TEAM    G    AB    R    H    HR   RBI   AVG`, x + 45, y + 175);
    bCtx.fillStyle = '#ffffff';
    bCtx.fillText(`2010    CUBS    125  430   56   132  14   62    .307`, x + 45, y + 215);
    bCtx.fillText(`CAREER  TOTAL   450  1580  210  465  48   215   .294`, x + 45, y + 255);

    bCtx.fillStyle = '#94a3b8';
    bCtx.font = '12px sans-serif';
    bCtx.fillText(`© ${c.year} TOPPS COMPANY, INC. ALL RIGHTS RESERVED.`, x + 35, y + cardH - 30);
    bCtx.restore();
  });

  return {
    front: frontCanvas.toDataURL('image/jpeg', 0.94),
    back: backCanvas.toDataURL('image/jpeg', 0.94),
  };
}

export function createRaw8LetterDemoScan(): { front: string; back: string } {
  const width = 1700;
  const height = 2200;


  const rawCards = [
    { name: 'Michael Jordan', year: '1986', set: 'Fleer RC', num: '#57', cat: 'Basketball', color: '#c41230', accent: '#17408b' },
    { name: 'Charizard 1st Ed', year: '1999', set: 'Pokemon Base Set', num: '#4/102', cat: 'Pokemon', color: '#ea580c', accent: '#facc15' },
    { name: 'Ken Griffey Jr.', year: '1989', set: 'Upper Deck Star Rookie', num: '#1', cat: 'Baseball', color: '#047857', accent: '#0284c7' },
    { name: 'LeBron James', year: '2003', set: 'Topps Chrome RC', num: '#111', cat: 'Basketball', color: '#831843', accent: '#fbbf24' },
    { name: 'Tom Brady', year: '2000', set: 'Playoff Contenders RC', num: '#144', cat: 'Football', color: '#1e3a8a', accent: '#dc2626' },
    { name: 'Wayne Gretzky', year: '1979', set: 'O-Pee-Chee RC', num: '#18', cat: 'Hockey', color: '#0369a1', accent: '#f97316' },
    { name: 'Mickey Mantle', year: '1952', set: 'Topps', num: '#311', cat: 'Baseball', color: '#1e293b', accent: '#3b82f6' },
    { name: 'Shohei Ohtani', year: '2018', set: 'Topps Chrome RC', num: '#150', cat: 'Baseball', color: '#b91c1c', accent: '#e2e8f0' },
  ];

  // FRONT CANVAS
  const frontCanvas = document.createElement('canvas');
  frontCanvas.width = width;
  frontCanvas.height = height;
  const fCtx = frontCanvas.getContext('2d')!;

  // Clean template sheet background
  fCtx.fillStyle = '#f8fafc';
  fCtx.fillRect(0, 0, width, height);

  // Template perimeter border line
  fCtx.strokeStyle = '#cbd5e1';
  fCtx.lineWidth = 2;
  fCtx.strokeRect(30, 25, width - 60, height - 50);

  // Registration corner alignment marks
  const regCircles = [
    { x: 58, y: 55 },
    { x: width - 58, y: 55 },
    { x: 58, y: height - 55 },
    { x: width - 58, y: height - 55 },
  ];

  regCircles.forEach((pt) => {
    fCtx.save();
    fCtx.strokeStyle = '#64748b';
    fCtx.lineWidth = 2;
    fCtx.beginPath();
    fCtx.arc(pt.x, pt.y, 16, 0, Math.PI * 2);
    fCtx.stroke();
    fCtx.beginPath();
    fCtx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
    fCtx.fillStyle = '#64748b';
    fCtx.fill();
    fCtx.restore();
  });

  const cols = 2;
  const cardW = 707;
  const cardH = 496;
  const startX = 95;
  const startY = 48;
  const gapX = 96;
  const gapY = 40;

  rawCards.forEach((c, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = startX + col * (cardW + gapX);
    const y = startY + row * (cardH + gapY);

    // Slot outline
    fCtx.strokeStyle = '#94a3b8';
    fCtx.lineWidth = 1.5;
    fCtx.strokeRect(x, y, cardW, cardH);

    // Inner Card Boundary
    fCtx.save();
    fCtx.fillStyle = c.color;
    fCtx.shadowColor = 'rgba(0,0,0,0.3)';
    fCtx.shadowBlur = 12;
    fCtx.beginPath();
    fCtx.roundRect(x + 10, y + 8, cardW - 20, cardH - 16, 10);
    fCtx.fill();
    fCtx.strokeStyle = '#ffffff';
    fCtx.lineWidth = 3;
    fCtx.stroke();
    fCtx.restore();

    // Card Graphic Inner Box
    fCtx.fillStyle = c.accent;
    fCtx.beginPath();
    fCtx.roundRect(x + 30, y + 28, cardW - 60, cardH - 140, 8);
    fCtx.fill();

    // Card Photo Area
    fCtx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    fCtx.fillRect(x + 45, y + 40, 220, cardH - 165);

    // Player & Card Text
    fCtx.fillStyle = '#ffffff';
    fCtx.font = 'bold 30px sans-serif';
    fCtx.fillText(c.name, x + 285, y + 90);

    fCtx.font = 'bold 22px sans-serif';
    fCtx.fillText(`${c.year} ${c.set}`, x + 285, y + 140);

    fCtx.font = 'bold 20px monospace';
    fCtx.fillText(`${c.num} • ${c.cat.toUpperCase()}`, x + 285, y + 185);

    fCtx.fillStyle = '#ffffff';
    fCtx.font = 'bold 20px sans-serif';
    fCtx.fillText(`★ OFFICIAL ROOKIE CARD ★`, x + 35, y + cardH - 45);
  });

  // BACK CANVAS (Mirrored columns for horizontal book flip)
  const backCanvas = document.createElement('canvas');
  backCanvas.width = width;
  backCanvas.height = height;
  const bCtx = backCanvas.getContext('2d')!;

  bCtx.fillStyle = '#f8fafc';
  bCtx.fillRect(0, 0, width, height);

  bCtx.strokeStyle = '#cbd5e1';
  bCtx.lineWidth = 2;
  bCtx.strokeRect(30, 25, width - 60, height - 50);

  regCircles.forEach((pt) => {
    bCtx.save();
    bCtx.strokeStyle = '#64748b';
    bCtx.lineWidth = 2;
    bCtx.beginPath();
    bCtx.arc(pt.x, pt.y, 16, 0, Math.PI * 2);
    bCtx.stroke();
    bCtx.beginPath();
    bCtx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
    bCtx.fillStyle = '#64748b';
    bCtx.fill();
    bCtx.restore();
  });

  rawCards.forEach((c, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const mirroredCol = cols - 1 - col;
    const x = startX + mirroredCol * (cardW + gapX);
    const y = startY + row * (cardH + gapY);

    // Slot outline
    bCtx.strokeStyle = '#94a3b8';
    bCtx.lineWidth = 1.5;
    bCtx.strokeRect(x, y, cardW, cardH);

    // Inner Card Boundary
    bCtx.save();
    bCtx.fillStyle = '#1e293b';
    bCtx.beginPath();
    bCtx.roundRect(x + 10, y + 8, cardW - 20, cardH - 16, 10);
    bCtx.fill();
    bCtx.strokeStyle = '#64748b';
    bCtx.lineWidth = 2;
    bCtx.stroke();
    bCtx.restore();

    bCtx.fillStyle = '#f8fafc';
    bCtx.font = 'bold 26px sans-serif';
    bCtx.fillText(`${c.name} - CAREER STATS`, x + 35, y + 55);

    bCtx.fillStyle = '#94a3b8';
    bCtx.font = '18px monospace';
    bCtx.fillText(`Card ${c.num} | ${c.year} ${c.set}`, x + 35, y + 95);
    bCtx.fillText(`Category: ${c.cat} | Standard Trading Card`, x + 35, y + 130);

    // Stats Table Mock
    bCtx.fillStyle = '#334155';
    bCtx.fillRect(x + 35, y + 160, cardW - 70, 180);

    bCtx.fillStyle = '#e2e8f0';
    bCtx.font = '16px monospace';
    bCtx.fillText(`YEAR    TEAM    G    AVG    HR    RBI    OPS`, x + 50, y + 200);
    bCtx.fillText(`${c.year}    PRO     162  .312   42    118    .985`, x + 50, y + 240);
    bCtx.fillText(`CAREER  TOTAL   1820 .301   480   1420   .942`, x + 50, y + 280);

    bCtx.fillStyle = '#64748b';
    bCtx.font = '14px sans-serif';
    bCtx.fillText(`© ${c.year} Official Licensed Product. All Rights Reserved.`, x + 35, y + cardH - 45);
  });

  return {
    front: frontCanvas.toDataURL('image/jpeg', 0.92),
    back: backCanvas.toDataURL('image/jpeg', 0.92),
  };
}
