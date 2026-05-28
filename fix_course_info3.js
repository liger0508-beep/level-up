const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Fix "all" comparison in page.tsx
    if (filePath.includes('page.tsx')) {
        content = content.replace(/const typeMatch = activeType === "all" \|\| n\.type === activeType \|\| n\.type === "course_info";/g, 'const typeMatch = n.type === activeType || n.type === "course_info";');
        content = content.replace(/const typeMatch = activeType === "course_info" \|\| n\.type === activeType \|\| n\.type === "course_info";/g, 'const typeMatch = n.type === activeType || n.type === "course_info";');
        content = content.replace(/activeType === "all" \|\| /g, '');
    }
    
    fs.writeFileSync(filePath, content, 'utf-8');
}

const walkDir = (dir) => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            replaceInFile(fullPath);
        }
    }
};

walkDir(path.join(__dirname, 'src/app/(main)/course-info'));

console.log("Done fixing TS 3");
