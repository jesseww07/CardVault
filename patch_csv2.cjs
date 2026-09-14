const fs = require('fs');
let data = fs.readFileSync('src/components/CollectionDatabase.tsx', 'utf8');

const oldCsvContentStr = `    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\\n');
    const encodedUri = encodeURI(csvContent).replace(/#/g, '%23');
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);`;

const newCsvContentStr = `    const csvContent = [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);`;

data = data.replace(oldCsvContentStr, newCsvContentStr);
fs.writeFileSync('src/components/CollectionDatabase.tsx', data);
