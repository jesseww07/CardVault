const fs = require('fs');
let data = fs.readFileSync('src/components/CardDetailModal.tsx', 'utf8');

if (!data.includes('Download')) {
  data = data.replace('Save,\n', 'Save,\n  Download,\n  FileJson,\n  FileSpreadsheet,\n');
}

const oldFooter = `          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[#0a0a0c] hover:bg-white/5 text-gray-300 rounded-xl text-xs font-bold uppercase tracking-wider border border-white/10"
            >
              Cancel
            </button>`;

const newFooter = `          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 mr-4 border-r border-white/10 pr-4">
               <button
                 onClick={() => {
                   const headers = [
                      'Name','Year','Set','CardNumber','Category','Variation',
                      'IsGraded','GradingCompany','Grade','CertNumber',
                      'Centering','Corners','Edges','Surface','Auto',
                      'EstimatedCondition','EstimatedValueUSD','Tags','Notes',
                      'FrontOCRText','BackOCRText'
                   ];
                   const c = formData;
                   const csvRows = [[
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
                   ]];
                   const csvContent = [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\\n');
                   const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                   const url = URL.createObjectURL(blob);
                   const link = document.createElement('a');
                   link.setAttribute('href', url);
                   link.setAttribute('download', \`card-\${c.id}-\${Date.now()}.csv\`);
                   document.body.appendChild(link);
                   link.click();
                   document.body.removeChild(link);
                 }}
                 className="p-2 bg-[#0a0a0c] hover:bg-white/5 text-gray-300 rounded-lg text-xs font-bold border border-white/10"
                 title="Export Card as CSV"
               >
                 <Download className="w-4 h-4" />
               </button>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[#0a0a0c] hover:bg-white/5 text-gray-300 rounded-xl text-xs font-bold uppercase tracking-wider border border-white/10"
            >
              Cancel
            </button>`;

data = data.replace(oldFooter, newFooter);

fs.writeFileSync('src/components/CardDetailModal.tsx', data);
