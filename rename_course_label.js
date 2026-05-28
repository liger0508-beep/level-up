const fs = require('fs');
const path = require('path');

function replaceText(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    content = content.replace(/코스 기입/g, '코스');
    fs.writeFileSync(filePath, content, 'utf-8');
}

const filesToUpdate = [
    'src/app/(main)/course-info/create/page.tsx',
    'src/app/(main)/course-info/[id]/edit/page.tsx',
    'src/components/courseInfo/CourseInfoTable.tsx'
];

filesToUpdate.forEach(file => {
    const fullPath = path.join(__dirname, file);
    if (fs.existsSync(fullPath)) {
        replaceText(fullPath);
        console.log("Updated", file);
    }
});
