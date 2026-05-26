const fs = require('fs');
const path = 'd:/gla_coach/src/app/(main)/training/challenges/create/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const lines = content.split(/\r?\n/);
const newLines = [];
let replaced = false;

for (let i = 0; i < lines.length; i++) {
    if (!replaced && lines[i].includes('{/* Shot Inputs per Distance */}')) {
        newLines.push('                            {/* Shot Inputs per Distance */}');
        newLines.push('                            {selectedIronDistances.map((dist) => {');
        newLines.push('                                const distScore = ironShots.filter(s => s.distance === dist).reduce((acc, shot) => {');
        newLines.push('                                    if (shot.proximity === "") return acc;');
        newLines.push('                                    const startScore = IRON_START_SCORES[shot.distance] || 0;');
        newLines.push('                                    const prox = Math.min(20, Math.round(Number(shot.proximity)));');
        newLines.push('                                    const resultScore = IRON_RESULT_SCORES[prox] || 0.32;');
        newLines.push('                                    return acc + startScore + resultScore;');
        newLines.push('                                }, 0);');
        newLines.push('');
        newLines.push('                                return (');
        newLines.push('                                <section key={dist} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm">');
        newLines.push('                                    <div className="flex items-center justify-between mb-4">');
        newLines.push('                                        <h3 className="text-lg font-black text-brand-navy dark:text-brand-navy-light italic">');
        newLines.push('                                            {dist}m <span className="text-xs not-italic font-bold text-zinc-400 ml-1">Iron Test</span>');
        newLines.push('                                        </h3>');
        newLines.push('                                        <div className="text-right">');
        newLines.push('                                            <span className="text-xs text-zinc-400 block mb-1">합계 점수</span>');
        newLines.push('                                            <span className={cn(');
        newLines.push('                                                "text-xl font-black italic",');
        newLines.push('                                                distScore < 0 ? "text-brand-red" : distScore > 0 ? "text-blue-600" : "text-zinc-400"');
        newLines.push('                                            )}>');
        newLines.push('                                                {distScore > 0 ? `+${distScore.toFixed(2)}` : distScore.toFixed(2)}');
        newLines.push('                                            </span>');
        newLines.push('                                        </div>');
        newLines.push('                                    </div>');
        
        while (i < lines.length && !lines[i].includes('<div className="space-y-2">')) {
            i++;
        }
        
        // Push the space-y-2 div and continue normally, but we need to remember to change `))} ` to `}))} ` at the end of the map.
        newLines.push(lines[i]);
        replaced = true;
        continue;
    }
    
    // We also need to change `))} ` at the end of the selectedIronDistances block to `})} ` because we changed from implicit to explicit return.
    if (replaced && lines[i].trim() === '))} ' || (replaced && lines[i].trim() === '))}')) {
        // Find the line that actually closes selectedIronDistances.map
        if (lines[i-1].includes('</section>')) {
             newLines.push(lines[i].replace('))} ', '})}').replace('))}', '})}'));
             continue;
        }
    }

    newLines.push(lines[i]);
}

fs.writeFileSync(path, newLines.join('\n'), 'utf8');
console.log('replaced:', replaced);
