const fs = require('fs');
let data = fs.readFileSync('src/components/ScannerStudio.tsx', 'utf8');

const searchStr = `                  <label className="text-xs font-bold uppercase tracking-wider text-white flex items-center space-x-2">
                  <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
                  <span>
                  Fine Calibration
                  </span>
                </label>
                <button
                  onClick={() => {
                    setMarginAdjustment({ top: 0, left: 0, gapX: 0, gapY: 0, scale: 100 });
                    setRotationAngle(0);
                    setSkewAngle(0);
                  }}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold uppercase tracking-wider"
                >
                  Reset
                </button>`;

const searchStrAlternative = `                <button
                  onClick={() => {
                    setMarginAdjustment({ top: 0, left: 0, gapX: 0, gapY: 0, scale: 100 });
                    setRotationAngle(0);
                    setSkewAngle(0);
                  }}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold uppercase tracking-wider"
                >
                  Reset
                </button>`;

const replaceStr = `                <button
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
                </button>`;

if (data.includes(searchStrAlternative)) {
  data = data.replace(searchStrAlternative, replaceStr);
  fs.writeFileSync('src/components/ScannerStudio.tsx', data);
  console.log('Successfully patched Reset button!');
} else {
  console.log('Could not find search string.');
}
