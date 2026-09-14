const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const oldPromptBlock = `    prompt += \`\\nExtract key metadata for EACH card and return an array of objects.\`;`;

const newPromptBlock = `    prompt += \`
Extract all key metadata with high accuracy for EACH card and return an array of objects:
1. Card Identity:
   - name: Player name, character name, or primary card title.
   - year: Release or copyright year.
   - set: Card set / product line.
   - cardNumber: Card number with '#' prefix if appropriate.
   - category: One of "Basketball", "Baseball", "Football", "Hockey", "Soccer", "Pokemon", "Magic: The Gathering", "Yu-Gi-Oh!", "Non-Sport / Marvel", "Other".
   - variation: Parallel, insert, or variant details.
2. Grading Information:
   - isGraded: true if encapsulated in a grading slab, false if raw card.
   - gradingCompany: "PSA", "BGS", "CGC", "SGC", "TAG", or "Raw".
   - grade: Numeric or authentic grade from label.
   - certNumber: Serial / certification number printed on the slab label. Leave empty if raw.
   - subgrades: Centering, Corners, Edges, Surface, Autograph grade if listed on BGS/CGC slab.
3. Raw Condition & Value Estimation:
   - estimatedCondition: If raw card, assess visible corners/centering/surface.
   - estimatedValue: Conservative realistic market value estimate in USD as a number.
   - tags: Array of useful tags.
   - frontOcrText: KEEP THIS VERY SHORT. Max 20 words.
   - backOcrText: KEEP THIS VERY SHORT. Max 20 words.
   - notes: Keep brief.
\`;`;

content = content.replace(oldPromptBlock, newPromptBlock);

// Also add a naive json repair fallback for truncated arrays of objects
const oldParse = `    const parsed = JSON.parse(text);`;
const newParse = `    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (parseError) {
      console.warn("JSON Parse failed, attempting basic truncation repair...");
      let repaired = text;
      // If it ends abruptly in a string, try to close the string, object, and array
      const lastQuote = repaired.lastIndexOf('"');
      if (lastQuote > repaired.length - 20) {
        repaired = repaired.substring(0, lastQuote) + '"} ]';
      } else {
        repaired = repaired + '} ]';
      }
      try {
        parsed = JSON.parse(repaired);
      } catch (e2) {
        // Last resort regex extraction
        console.warn("Repair failed, returning empty array");
        parsed = [];
      }
    }`;

content = content.replace(oldParse, newParse);

fs.writeFileSync('server.ts', content);
