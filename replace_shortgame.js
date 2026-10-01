const fs = require('fs');
const path = require('path');

function findAndReplace(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            findAndReplace(fullPath);
        } else if (stat.isFile() && (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx'))) {
            let content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('그린주변샷') || content.includes('그린 주변샷')) {
                content = content.replace(/그린주변샷/g, '숏게임').replace(/그린 주변샷/g, '숏게임');
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Updated: ${fullPath}`);
            }
        }
    }
}

findAndReplace(path.join(__dirname, 'src'));
console.log('Done!');
