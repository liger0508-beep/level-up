const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Fix imports
    content = content.replace(/@\/lib\/courseInfo-sync/g, '@/lib/course-info-sync');
    
    // Fix CourseInfoTable specific replacements
    if (filePath.includes('CourseInfoTable.tsx')) {
        content = content.replace(/Notice/g, 'CourseInfo');
        content = content.replace(/notice/g, 'courseInfo');
        content = content.replace(/NOTICES/g, 'COURSE_INFOS');
        content = content.replace(/NOTICE/g, 'COURSE_INFO');
        content = content.replace(/공지사항/g, '코스 정보');
        content = content.replace(/community/g, 'course-info');
    }
    
    // Fix 'any' type in page.tsx data format function
    if (filePath.includes('page.tsx')) {
        content = content.replace(/formatCourseInfoFromDb = \(data\)/g, 'formatCourseInfoFromDb = (data: any)');
        content = content.replace(/formatCourseInfoFromDb\(data\)/g, 'formatCourseInfoFromDb(data: any)');
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
walkDir(path.join(__dirname, 'src/components/courseInfo'));

// Fix lib file
const syncFile = path.join(__dirname, 'src/lib/course-info-sync.ts');
let syncContent = fs.readFileSync(syncFile, 'utf-8');
// Fix the Record
syncContent = syncContent.replace(/export const COURSE_INFO_TYPE_COLORS[\s\S]*?};/g, 'export const COURSE_INFO_TYPE_COLORS: Record<CourseInfoType, { bg: string; text: string; border: string }> = { "course_info": { bg: "bg-indigo-50", text: "text-indigo-600", border: "border-indigo-100" } };');
syncContent = syncContent.replace(/export const COURSE_INFO_TYPE_LABELS[\s\S]*?};/g, 'export const COURSE_INFO_TYPE_LABELS: Record<CourseInfoType, string> = { "course_info": "코스 정보" };');
// Check formatCourseInfoFromDb (data)
syncContent = syncContent.replace(/function formatCourseInfoFromDb\(data: any\)/g, 'function formatCourseInfoFromDb(data: any)');
fs.writeFileSync(syncFile, syncContent, 'utf-8');

console.log("Done fixing TS");
