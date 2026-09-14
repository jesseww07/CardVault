const fs = require('fs');
let data = fs.readFileSync('src/components/ScannerStudio.tsx', 'utf8');

// State additions
const stateSearch = `  const [marginAdjustment, setMarginAdjustment] = useState({ top: 0, left: 0, gapX: 0, gapY: 0, scale: 100 });`;
const stateReplace = `  const [marginAdjustment, setMarginAdjustment] = useState({ top: 0, left: 0, gapX: 0, gapY: 0, scale: 100 });
  const [backMarginAdjustment, setBackMarginAdjustment] = useState({ top: 0, left: 0, gapX: 0, gapY: 0, scale: 100 });
  const [backRotationAngle, setBackRotationAngle] = useState<number>(0);
  const [backSkewAngle, setBackSkewAngle] = useState<number>(0);
  const [backSlots, setBackSlots] = useState<ScannerSlot[]>([]);`;
data = data.replace(stateSearch, stateReplace);

// Effect update
const effectSearch = `    // Apply fine margin and scale adjustments
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
  }, [selectedTemplateId, currentTemplate, marginAdjustment]);`;
const effectReplace = `    // Apply fine margin and scale adjustments
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
  }, [selectedTemplateId, currentTemplate, marginAdjustment, backMarginAdjustment]);`;
data = data.replace(effectSearch, effectReplace);

// Render Canvas Update
const renderCanvasSearch = `  // Draw alignment overlay on canvas
  const renderAlignmentCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !frontScanUrl) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    loadImage(frontScanUrl)
      .then((img) => {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        // Draw background scan
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        // Draw slots
        slots.forEach((slot, index) => {`;
const renderCanvasReplace = `  // Draw alignment overlay on canvas
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
        activeSlots.forEach((slot, index) => {`;
data = data.replace(renderCanvasSearch, renderCanvasReplace);

// Update renderAlignmentCanvas dependencies
const depsSearch = `  }, [frontScanUrl, slots, selectedSlotIndex, currentTemplate]);`;
const depsReplace = `  }, [frontScanUrl, backScanUrl, hasBackScan, previewSide, slots, backSlots, selectedSlotIndex, currentTemplate]);`;
data = data.replace(depsSearch, depsReplace);


// Update cropAllSlots call
const cropSearch = `      const cropped = await cropAllSlots(
        frontScanUrl,
        hasBackScan && backScanUrl ? backScanUrl : undefined,
        currentTemplate,
        activeSlots,
        flipMode,
        rotationAngle,
        skewAngle
      );`;
const cropReplace = `      const cropped = await cropAllSlots(
        frontScanUrl,
        hasBackScan && backScanUrl ? backScanUrl : undefined,
        currentTemplate,
        activeSlots,
        flipMode,
        rotationAngle,
        skewAngle,
        backSlots,
        backRotationAngle,
        backSkewAngle
      );`;
data = data.replace(cropSearch, cropReplace);


// Setup active states for controls
const controlSetupSearch = `              {/* Offset X & Y */}`;
const controlSetupReplace = `              {/* Toggle Side Control */}
              {hasBackScan && (
                <div className="flex bg-[#050505] rounded-lg p-1 border border-white/10 mb-4">
                  <button
                    onClick={() => setPreviewSide('front')}
                    className={\`flex-1 py-1.5 text-xs font-bold rounded-md \${previewSide === 'front' ? 'bg-cyan-500 text-black' : 'text-gray-400 hover:text-white'}\`}
                  >
                    Front Alignment
                  </button>
                  <button
                    onClick={() => setPreviewSide('back')}
                    className={\`flex-1 py-1.5 text-xs font-bold rounded-md \${previewSide === 'back' ? 'bg-cyan-500 text-black' : 'text-gray-400 hover:text-white'}\`}
                  >
                    Back Alignment
                  </button>
                </div>
              )}
              {/* Offset X & Y */}`;
data = data.replace(controlSetupSearch, controlSetupReplace);

const getActiveState = `const activeMargin = previewSide === 'front' ? marginAdjustment : backMarginAdjustment;
                  const setMargin = previewSide === 'front' ? setMarginAdjustment : setBackMarginAdjustment;
                  const activeRot = previewSide === 'front' ? rotationAngle : backRotationAngle;
                  const setRot = previewSide === 'front' ? setRotationAngle : setBackRotationAngle;`;

const inputsSearch = `                  <span className="text-cyan-400">{marginAdjustment.left}%</span>
                </div>
                <input
                  type="range"
                  min="-15"
                  max="15"
                  value={marginAdjustment.left}
                  onChange={(e) =>
                    setMarginAdjustment({ ...marginAdjustment, left: parseFloat(e.target.value) })
                  }
                  className="w-full accent-cyan-400"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-400 font-mono">
                  <span>Vertical Offset</span>
                  <span className="text-cyan-400">{marginAdjustment.top}%</span>
                </div>
                <input
                  type="range"
                  min="-15"
                  max="15"
                  value={marginAdjustment.top}
                  onChange={(e) =>
                    setMarginAdjustment({ ...marginAdjustment, top: parseFloat(e.target.value) })
                  }
                  className="w-full accent-cyan-400"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-400 font-mono">
                  <span>Card Box Scale</span>
                  <span className="text-cyan-400">{marginAdjustment.scale}%</span>
                </div>
                <input
                  type="range"
                  min="80"
                  max="120"
                  value={marginAdjustment.scale}
                  onChange={(e) =>
                    setMarginAdjustment({ ...marginAdjustment, scale: parseFloat(e.target.value) })
                  }
                  className="w-full accent-cyan-400"
                />
              </div>

            </div>

            {/* Rotation & Skew Tools */}
            <div className="bg-[#0a0a0c] border border-white/10 rounded-2xl p-4 space-y-4 shadow-xl">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono flex items-center space-x-1.5">
                <RotateCw className="w-3.5 h-3.5" />
                <span>Rotation & Correction</span>
              </h3>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-300 font-bold">Base Rotation</span>
                <button
                  onClick={() => setRotationAngle((prev) => (prev + 90) % 360)}
                  className="px-3 py-1 bg-[#050505] hover:bg-white/5 border border-white/10 text-xs rounded-lg text-white font-mono flex items-center space-x-1.5"
                >
                  <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{rotationAngle}°</span>
                </button>`;

const inputsReplace = `                  <span className="text-cyan-400">{previewSide === 'front' ? marginAdjustment.left : backMarginAdjustment.left}%</span>
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

            </div>

            {/* Rotation & Skew Tools */}
            <div className="bg-[#0a0a0c] border border-white/10 rounded-2xl p-4 space-y-4 shadow-xl">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono flex items-center space-x-1.5">
                <RotateCw className="w-3.5 h-3.5" />
                <span>Rotation & Correction</span>
              </h3>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-300 font-bold">Base Rotation</span>
                <button
                  onClick={() => previewSide === 'front' ? setRotationAngle((prev) => (prev + 90) % 360) : setBackRotationAngle((prev) => (prev + 90) % 360)}
                  className="px-3 py-1 bg-[#050505] hover:bg-white/5 border border-white/10 text-xs rounded-lg text-white font-mono flex items-center space-x-1.5"
                >
                  <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{previewSide === 'front' ? rotationAngle : backRotationAngle}°</span>
                </button>`;
data = data.replace(inputsSearch, inputsReplace);

fs.writeFileSync('src/components/ScannerStudio.tsx', data);
