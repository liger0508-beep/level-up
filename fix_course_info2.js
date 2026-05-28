const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Fix imports for CourseInfoTable
    content = content.replace(/@\/lib\/courseInfo-sync/g, '@/lib/course-info-sync');
    
    // Fix "all" -> "course_info" in states
    content = content.replace(/useState<CourseInfoType>\("all"\)/g, 'useState<CourseInfoType>("course_info")');
    content = content.replace(/type === "all"/g, 'type === "course_info"');
    content = content.replace(/CourseInfoType \| "all"/g, 'CourseInfoType');
    
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
walkDir(path.join(__dirname, 'src/components/courseInfo'));

console.log("Done fixing TS 2");
