const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// Restore the first one (detect-cards)
content = content.replace(`    let parsed;
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
    }`, `    const parsed = JSON.parse(text);`);

// Replace the batch one
const batchSearch = `    const text = response?.text || "[]";
    const parsed = JSON.parse(text);`;

const batchReplace = `    const text = response?.text || "[]";
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (parseError) {
      console.warn("JSON Parse failed for batch OCR, attempting basic truncation repair...");
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
        console.warn("Repair failed, returning empty array");
        parsed = [];
      }
    }`;

if (content.includes(batchSearch)) {
    content = content.replace(batchSearch, batchReplace);
}

fs.writeFileSync('server.ts', content);
