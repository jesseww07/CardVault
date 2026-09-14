const fs = require('fs');
let data = fs.readFileSync('src/components/CollectionDatabase.tsx', 'utf8');

const downloadFnStr = `  // Export to JSON
  const handleExportJson = () => {`;

const newDownloadFnStr = `  // Download Images Batch
  const handleDownloadImages = () => {
    const cardsToExport = selectedCardIds.length > 0
      ? cards.filter((c) => selectedCardIds.includes(c.id))
      : filteredCards;
      
    if (cardsToExport.length > 30 && !confirm(\`You are about to download images for \${cardsToExport.length} cards (up to \${cardsToExport.length * 2} files). This may take a moment or trigger browser multiple download warnings. Proceed?\`)) {
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
        setTimeout(() => downloadImage(c.frontImage, \`\${safeName}_\${c.id.substring(0,4)}_front.jpg\`), delayCounter * 300);
        delayCounter++;
      }
      if (c.backImage) {
        setTimeout(() => downloadImage(c.backImage, \`\${safeName}_\${c.id.substring(0,4)}_back.jpg\`), delayCounter * 300);
        delayCounter++;
      }
    });
  };

  // Export to JSON
  const handleExportJson = () => {`;

data = data.replace(downloadFnStr, newDownloadFnStr);

const bulkButtonsStr = `              <button
                onClick={handleExportCsv}
                className="px-3 py-1 bg-cyan-500 text-black rounded-lg font-black uppercase tracking-wider hover:bg-cyan-400 text-xs shadow-md"
              >
                Export CSV
              </button>
              <button`;

const newBulkButtonsStr = `              <button
                onClick={handleDownloadImages}
                className="px-3 py-1 bg-white/10 text-white border border-white/20 rounded-lg font-bold uppercase tracking-wider hover:bg-white/20 text-xs shadow-md"
              >
                Images
              </button>
              <button
                onClick={handleExportCsv}
                className="px-3 py-1 bg-cyan-500 text-black rounded-lg font-black uppercase tracking-wider hover:bg-cyan-400 text-xs shadow-md"
              >
                CSV
              </button>
              <button`;

data = data.replace(bulkButtonsStr, newBulkButtonsStr);

fs.writeFileSync('src/components/CollectionDatabase.tsx', data);
