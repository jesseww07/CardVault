const fs = require('fs');
let data = fs.readFileSync('src/components/CardDetailModal.tsx', 'utf8');

const startMarker = `               <button\n                 onClick={() => {\n                   const headers = [`;
const endMarker = `                 className="p-2 bg-[#0a0a0c] hover:bg-white/5 text-gray-300 rounded-lg text-xs font-bold border border-white/10"\n                 title="Export Card as CSV"\n               >\n                 <Download className="w-4 h-4" />\n               </button>`;

const oldBlock = data.substring(data.indexOf(startMarker), data.indexOf(endMarker) + endMarker.length);

const newBlock = `               <button
                 onClick={() => {
                   const downloadImage = (dataUrl, filename) => {
                     const link = document.createElement('a');
                     link.href = dataUrl;
                     link.download = filename;
                     document.body.appendChild(link);
                     link.click();
                     document.body.removeChild(link);
                   };
                   
                   const safeName = (formData.name || 'card').replace(/[^a-z0-9]/gi, '_').toLowerCase();
                   downloadImage(formData.frontImage, \`\${safeName}_front.jpg\`);
                   if (formData.backImage) {
                     setTimeout(() => {
                       downloadImage(formData.backImage, \`\${safeName}_back.jpg\`);
                     }, 300);
                   }
                 }}
                 className="p-2 bg-[#0a0a0c] hover:bg-white/5 text-gray-300 rounded-lg text-xs font-bold border border-white/10"
                 title="Download Card Image(s)"
               >
                 <Download className="w-4 h-4" />
               </button>`;

if (data.includes(startMarker)) {
  data = data.replace(oldBlock, newBlock);
  fs.writeFileSync('src/components/CardDetailModal.tsx', data);
  console.log("Replaced CSV export with Image download logic.");
} else {
  console.log("Could not find block to replace.");
}
