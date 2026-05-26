const fs = require('fs');
const path = 'd:/gla_coach/src/app/(main)/consultations/create/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const lines = content.split(/\r?\n/);

const newLines = [];
let replaced1 = false;
let replaced2 = false;

for (let i = 0; i < lines.length; i++) {
    if (!replaced1 && lines[i].includes('// Initialize athleteName from searchParams')) {
        newLines.push('    // Initialize athleteName from searchParams');
        newLines.push('    useEffect(() => {');
        newLines.push('        const player = searchParams.get("player");');
        newLines.push('        if (player) {');
        newLines.push('            setAthleteName(player);');
        newLines.push('        } else {');
        newLines.push('            const saved = sessionStorage.getItem("draftConsultationAthlete");');
        newLines.push('            if (saved) {');
        newLines.push('                setAthleteName(saved);');
        newLines.push('            }');
        newLines.push('        }');
        newLines.push('    }, [searchParams]);');
        newLines.push('');
        newLines.push('    useEffect(() => {');
        newLines.push('        if (athleteName) {');
        newLines.push('            sessionStorage.setItem("draftConsultationAthlete", athleteName);');
        newLines.push('        } else {');
        newLines.push('            sessionStorage.removeItem("draftConsultationAthlete");');
        newLines.push('        }');
        newLines.push('    }, [athleteName]);');
        
        // skip original block
        while (lines[i] !== '    }, [searchParams]);') {
            i++;
        }
        replaced1 = true;
        continue;
    }

    if (!replaced2 && lines[i].includes('alert("상담 일지가 등록되었습니다.");')) {
        newLines.push(lines[i]);
        newLines.push('            sessionStorage.removeItem("draftConsultationAthlete");');
        replaced2 = true;
        continue;
    }

    newLines.push(lines[i]);
}

fs.writeFileSync(path, newLines.join('\n'), 'utf8');
console.log('replaced1:', replaced1, 'replaced2:', replaced2);
