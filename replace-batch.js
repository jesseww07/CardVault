const fs = require('fs');
let content = fs.readFileSync('src/components/ScannerStudio.tsx', 'utf8');

const targetStr = `  // Run AI OCR on all cropped cards
  const runBatchOcr = async (cardsToProcess: CroppedSlotPair[]) => {
    setIsProcessingOcr(true);
    const updated = [...cardsToProcess];
    for (let i = 0; i < updated.length; i++) {
      const card = updated[i];
      card.status = 'processing';
      card.progressMessage = 'Analyzing front and back with Gemini OCR...';
      setCroppedCards([...updated]);

      try {
        const res = await fetch('/api/ocr-card', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            frontImageBase64: card.frontCroppedDataUrl,
            backImageBase64: card.backCroppedDataUrl,
            templateHint: currentTemplate.name,
            isSlabHint: currentTemplate.isSlab,
          }),
        });

        if (!res.ok) {
          let errorMsg = \`Server returned \${res.status}\`;
          try {
            const errData = await res.json();
            if (errData.error) errorMsg = errData.error;
          } catch (e) {
            // ignore JSON parse error
          }
          throw new Error(errorMsg);
        }

        const data = await res.json();
        card.status = 'done';
        card.progressMessage = 'Data Extracted';
        card.extractedData = {
          id: \`card-\${Date.now()}-\${i}\`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          frontImage: card.frontCroppedDataUrl,
          backImage: card.backCroppedDataUrl,
          name: data.name || \`Card \${i + 1}\`,
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
      } catch (err: any) {
        card.status = 'error';
        card.error = err.message || 'OCR extraction failed';
      }

      setCroppedCards([...updated]);
      
      // Add a delay between cards to strictly adhere to Free Tier 15 RPM (4s per request)
      if (i < updated.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 4500));
      }
    }

    setIsProcessingOcr(false);
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    setStep(4);
  };`;

const newStr = `  // Run AI OCR on all cropped cards using Batch endpoint
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
      const payloadCards = updated.map((c, i) => ({
        id: String(i),
        frontImageBase64: c.frontCroppedDataUrl,
        backImageBase64: c.backCroppedDataUrl,
      }));

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
        let errorMsg = \`Server returned \${res.status}\`;
        try {
          const errData = await res.json();
          if (errData.error) errorMsg = errData.error;
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
          id: \`card-\${Date.now()}-\${i}\`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          frontImage: card.frontCroppedDataUrl,
          backImage: card.backCroppedDataUrl,
          name: data.name || \`Card \${i + 1}\`,
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
  };`;

if(content.includes('const runBatchOcr = async (cardsToProcess: CroppedSlotPair[]) => {')) {
  // It's probably slightly different, so I'll just use regex replacement
  const regex = /\/\/ Run AI OCR on all cropped cards[\s\S]*?setStep\(4\);\n  };/m;
  content = content.replace(regex, newStr);
  fs.writeFileSync('src/components/ScannerStudio.tsx', content);
  console.log('Replaced runBatchOcr');
} else {
  console.log('runBatchOcr not found');
}
