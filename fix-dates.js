const fs = require('fs');
const files = [
    'd:/Antigravity/gla_coach/src/components/schedule/ScheduleEventDialog.tsx',
    'd:/Antigravity/gla_coach/src/components/schedule/TournamentCalendar.tsx',
    'd:/Antigravity/gla_coach/src/components/schedule/CoachTripCalendar.tsx',
    'd:/Antigravity/gla_coach/src/app/(main)/lessons/create/page.tsx',
    'd:/Antigravity/gla_coach/src/app/(main)/training/page.tsx',
    'd:/Antigravity/gla_coach/src/app/(main)/training/[id]/edit/page.tsx',
    'd:/Antigravity/gla_coach/src/app/(main)/lessons/page.tsx',
    'd:/Antigravity/gla_coach/src/app/(main)/lessons/[id]/edit/page.tsx',
    'd:/Antigravity/gla_coach/src/app/(main)/training/create/page.tsx',
    'd:/Antigravity/gla_coach/src/app/(main)/community/create/page.tsx',
    'd:/Antigravity/gla_coach/src/app/(main)/analysis/page.tsx',
    'd:/Antigravity/gla_coach/src/app/(main)/analysis/[id]/edit/page.tsx',
    'd:/Antigravity/gla_coach/src/app/(main)/community/page.tsx',
    'd:/Antigravity/gla_coach/src/app/(main)/community/[id]/edit/page.tsx',
    'd:/Antigravity/gla_coach/src/app/(main)/analysis/create/page.tsx',
    'd:/Antigravity/gla_coach/src/app/(main)/admin/tournament-schedule/page.tsx',
    'd:/Antigravity/gla_coach/src/app/(main)/admin/polls/page.tsx',
    'd:/Antigravity/gla_coach/src/app/(main)/admin/polls/create/page.tsx',
    'd:/Antigravity/gla_coach/src/app/(main)/admin/coach-trip-schedule/page.tsx'
];

let updatedCount = 0;
for (let file of files) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8');

    if (!content.includes('type="date"')) {
        continue;
    }

    let i = 0;
    while ((i = content.indexOf('<input', i)) !== -1) {
        let nextChar = content[i + 6];
        if (!/(\s|>)/.test(nextChar)) {
            i += 6; continue;
        }

        let j = i + 6;
        let braceDepth = 0;
        let inString = false;
        let stringChar = '';
        while (j < content.length) {
            let c = content[j];
            if (!inString && (c === '"' || c === "'")) {
                inString = true; stringChar = c;
            } else if (inString && c === stringChar) {
                inString = false;
            } else if (!inString && c === '{') {
                braceDepth++;
            } else if (!inString && c === '}') {
                braceDepth--;
            } else if (!inString && braceDepth === 0 && c === '>' && content[j - 1] === '/') {
                break;
            } else if (!inString && braceDepth === 0 && c === '>') {
                break;
            }
            j++;
        }

        let tag = content.substring(i, j + 1);
        if (tag.includes('type="date"')) {
            let newTag = tag.replace('<input', '<DatePickerInput').replace(/type="date"/g, '').replace(/onClick=\{\(e\) => \(e\.target as HTMLInputElement\)\.showPicker\?\.\(\)\}/g, '');
            content = content.substring(0, i) + newTag + content.substring(j + 1);
            i += newTag.length;
        } else {
            i = j + 1;
        }
    }

    if (content.includes('<DatePickerInput') && !content.includes('@/components/ui/DatePickerInput')) {
        let lastImportIdx = content.lastIndexOf('import ');
        if (lastImportIdx !== -1) {
            let endOfLine = content.indexOf('\n', lastImportIdx);
            content = content.substring(0, endOfLine + 1) + 'import { DatePickerInput } from "@/components/ui/DatePickerInput";\n' + content.substring(endOfLine + 1);
        } else {
            content = 'import { DatePickerInput } from "@/components/ui/DatePickerInput";\n' + content;
        }
    }

    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
    updatedCount++;
}
console.log(`Total updated: ${updatedCount}`);
