const fs = require('fs');
let data = fs.readFileSync('src/components/CollectionDatabase.tsx', 'utf8');

const oldHeaders = `    const headers = [
      'Name',
      'Year',
      'Set',
      'CardNumber',
      'Category',
      'Variation',
      'IsGraded',
      'GradingCompany',
      'Grade',
      'CertNumber',
      'EstimatedValueUSD',
      'Tags',
    ];`;

const newHeaders = `    const headers = [
      'Name',
      'Year',
      'Set',
      'CardNumber',
      'Category',
      'Variation',
      'IsGraded',
      'GradingCompany',
      'Grade',
      'CertNumber',
      'Centering',
      'Corners',
      'Edges',
      'Surface',
      'Auto',
      'EstimatedCondition',
      'EstimatedValueUSD',
      'Tags',
      'Notes',
      'FrontOCRText',
      'BackOCRText'
    ];`;

const oldRows = `    const csvRows = cardsToExport.map((c) => [
      \`"\${c.name.replace(/"/g, '""')}"\`,
      \`"\${c.year}"\`,
      \`"\${c.set.replace(/"/g, '""')}"\`,
      \`"\${c.cardNumber}"\`,
      \`"\${c.category}"\`,
      \`"\${c.variation}"\`,
      c.isGraded ? 'Yes' : 'No',
      \`"\${c.gradingCompany}"\`,
      \`"\${c.grade}"\`,
      \`"\${c.certNumber || ''}"\`,
      c.estimatedValue || 0,
      \`"\${c.tags.join(', ')}"\`,
    ]);`;

const newRows = `    const csvRows = cardsToExport.map((c) => [
      \`"\${c.name.replace(/"/g, '""')}"\`,
      \`"\${c.year}"\`,
      \`"\${c.set.replace(/"/g, '""')}"\`,
      \`"\${c.cardNumber}"\`,
      \`"\${c.category}"\`,
      \`"\${c.variation}"\`,
      c.isGraded ? 'Yes' : 'No',
      \`"\${c.gradingCompany}"\`,
      \`"\${c.grade}"\`,
      \`"\${c.certNumber || ''}"\`,
      \`"\${c.subgrades?.centering || ''}"\`,
      \`"\${c.subgrades?.corners || ''}"\`,
      \`"\${c.subgrades?.edges || ''}"\`,
      \`"\${c.subgrades?.surface || ''}"\`,
      \`"\${c.subgrades?.auto || ''}"\`,
      \`"\${(c.estimatedCondition || '').replace(/"/g, '""')}"\`,
      c.estimatedValue || 0,
      \`"\${c.tags.join(', ')}"\`,
      \`"\${(c.notes || '').replace(/"/g, '""')}"\`,
      \`"\${(c.frontOcrText || '').replace(/"/g, '""')}"\`,
      \`"\${(c.backOcrText || '').replace(/"/g, '""')}"\`
    ]);`;

data = data.replace(oldHeaders, newHeaders);
data = data.replace(oldRows, newRows);

// Fix the encoding for CSVs that have special characters (e.g. hashtags, commas)
data = data.replace(
    "const encodedUri = encodeURI(csvContent);", 
    "const encodedUri = encodeURI(csvContent).replace(/#/g, '%23');"
);

fs.writeFileSync('src/components/CollectionDatabase.tsx', data);
