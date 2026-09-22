const fs = require('fs');
const path = 'src/app/(main)/scores/review/[id]/page.tsx';
let content = fs.readFileSync(path, 'utf-8');

content = content.replace(/roundToOne\(/g, 'formatScore(');
content = content.replace(/roundToTwo\(/g, 'formatScore(');
content = content.replace(/return isYard \? Math\.round\(finalVal\)\.toString\(\) : formatScore\(finalVal\);/, 'return isYard ? Math.round(finalVal).toString() : roundToOne(finalVal);');

fs.writeFileSync(path, content, 'utf-8');
console.log('Successfully updated the file.');
