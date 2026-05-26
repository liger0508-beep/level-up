const fs = require('fs');
const path = 'd:/gla_coach/src/app/(main)/training/challenges/create/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const lines = content.split(/\r?\n/);

for(let i=0; i<lines.length; i++) {
    if (lines[i].includes('                            })}')) {
        if (lines[i-1].includes('</section>')) {
            lines.splice(i, 0, '                                );');
            break;
        }
    }
}

fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log('Fixed');
