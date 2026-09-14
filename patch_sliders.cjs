const fs = require('fs');
let data = fs.readFileSync('src/components/ScannerStudio.tsx', 'utf8');

const searchStr = `              {/* Offset X & Y */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-400 font-mono">
                  <span>Horizontal Offset</span>
                  <span className="text-cyan-400">{marginAdjustment.left}%</span>
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

              {/* Rotation */}
              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                <span className="text-xs text-gray-400 font-mono">Rotate Sheet</span>
                <button
                  onClick={() => setRotationAngle((prev) => (prev + 90) % 360)}
                  className="px-3 py-1 bg-[#050505] hover:bg-white/5 border border-white/10 text-xs rounded-lg text-white font-mono flex items-center space-x-1.5"
                >
                  <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{rotationAngle}°</span>
                </button>
              </div>`;

const replaceStr = `              {/* Offset X & Y */}
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
              </div>`;

if (data.includes(searchStr)) {
  data = data.replace(searchStr, replaceStr);
  fs.writeFileSync('src/components/ScannerStudio.tsx', data);
  console.log('Successfully patched sliders!');
} else {
  console.log('Could not find search string.');
}
