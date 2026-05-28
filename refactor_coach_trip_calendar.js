const fs = require('fs');
const path = require('path');

function updateCalendarFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');

    // Update search match
    content = content.replace(
        /t\.remarks\.toLowerCase\(\)\.includes\(searchQuery\.toLowerCase\(\)\);/g,
        't.remarks.toLowerCase().includes(searchQuery.toLowerCase()) ||\n                (t.vehicle || "").toLowerCase().includes(searchQuery.toLowerCase());'
    );

    // Update info row
    const infoRowRegex = /{t\.remarks && \([\s\S]*?<div className="flex items-center gap-1\.5 text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap shrink-0">[\s\S]*?<Info size={13} className="shrink-0" \/>[\s\S]*?<span>{t\.remarks}<\/span>[\s\S]*?<\/div>[\s\S]*?\)}/;

    const newInfoRow = `{t.vehicle && (
                                        <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap shrink-0">
                                            <Car size={13} className="shrink-0" />
                                            <span>{t.vehicle}</span>
                                        </div>
                                    )}
                                    {t.remarks && (
                                        <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap shrink-0 bg-transparent dark:bg-zinc-800/80 px-2.5 py-1.5 rounded-lg">
                                            <Info size={13} className="shrink-0" />
                                            <span>{t.remarks}</span>
                                        </div>
                                    )}`;
                                    
    content = content.replace(infoRowRegex, newInfoRow);

    fs.writeFileSync(filePath, content, 'utf-8');
}

updateCalendarFile(path.join(__dirname, 'src/components/schedule/CoachTripCalendar.tsx'));
console.log("Refactored coach trip calendar");
