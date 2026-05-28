const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    content = content.replace(/Notice/g, 'CourseInfo');
    content = content.replace(/notice/g, 'courseInfo');
    content = content.replace(/NOTICES/g, 'COURSE_INFOS');
    content = content.replace(/NOTICE/g, 'COURSE_INFO');
    content = content.replace(/공지사항/g, '코스 정보');
    content = content.replace(/community/g, 'course-info');
    
    // In the sync file, keep the table name as 'notices' but we need to query type = 'course_info'
    if (filePath.includes('course-info-sync.ts')) {
        content = content.replace(/from\("courseInfos"\)/g, 'from("notices")');
        content = content.replace(/courseInfos_author_id_fkey/g, 'notices_author_id_fkey');
        content = content.replace(/type CourseInfoType = "all" \| "coach" \| "athlete" \| "parent";/g, 'type CourseInfoType = "course_info";');
        content = content.replace(/COURSE_INFO_TYPE_LABELS: Record<CourseInfoType, string> = {[^}]+};/g, 'COURSE_INFO_TYPE_LABELS: Record<CourseInfoType, string> = { "course_info": "코스 정보" };');
        content = content.replace(/COURSE_INFO_TYPE_COLORS: Record<CourseInfoType, { bg: string; text: string; border: string }> = {[^}]+};/g, 'COURSE_INFO_TYPE_COLORS: Record<CourseInfoType, { bg: string; text: string; border: string }> = { "course_info": { bg: "bg-indigo-50", text: "text-indigo-600", border: "border-indigo-100" } };');
        
        // Ensure type defaults to 'course_info'
        content = content.replace(/courseInfo\.type/g, '"course_info"');
        
        // Filter only 'course_info' type when fetching
        content = content.replace(/\.order\("created_at"/g, '.eq("type", "course_info").order("created_at"');
    }
    
    fs.writeFileSync(filePath, content, 'utf-8');
}

const walkDir = (dir) => {
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
replaceInFile(path.join(__dirname, 'src/lib/course-info-sync.ts'));

console.log("Done");
