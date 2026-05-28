const fs = require('fs');
const path = require('path');

function updateLayout(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');

    const layoutRegex = /\{\/\* Row 1: Category \+ Venue \+ Date \+ Vehicle \*\/\}[\s\S]*?<div className=\{cn\([\s\S]*?"flex items-center gap-2 bg-transparent dark:bg-zinc-800\/50 px-3 py-2\.5 rounded-xl border border-zinc-100 dark:border-zinc-800",[\s\S]*?!t\.remarks && "mt-3"[\s\S]*?\)}>[\s\S]*?<Users size=\{14\} className="shrink-0 text-zinc-400" \/>[\s\S]*?<span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">[\s\S]*?\{t\.participants\.length > 0 \? t\.participants\.join\(\", \"\) : \"출장자 미지정\"\}[\s\S]*?<\/span>[\s\S]*?<\/div>/;

    const newLayout = `{/* Row 1: Category */}
                                <div className="mb-3">
                                    <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full uppercase shrink-0", colors.bg, colors.text)}>
                                        {t.category}
                                    </span>
                                </div>

                                {/* Row 2: Venue + Date + Vehicle */}
                                <div className="flex items-center justify-start gap-2 flex-wrap mb-2">
                                    <h3 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-50 shrink-0">{t.venue || "장소 미정"}</h3>
                                    <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-medium bg-transparent dark:bg-zinc-800/80 px-2.5 py-1 rounded-lg shrink-0">
                                        <Calendar size={13} className="shrink-0 text-zinc-400" />
                                        <span>{start.slice(5)} {start !== end && \`~ \${end.slice(5)}\`}</span>
                                    </div>
                                    {t.vehicle && (
                                        <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-medium bg-transparent dark:bg-zinc-800/80 px-2.5 py-1 rounded-lg shrink-0">
                                            <Car size={13} className="shrink-0 text-zinc-400" />
                                            <span>{t.vehicle}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Row 3: Remarks (if exists) */}
                                {t.remarks && (
                                    <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300 font-medium mb-3 pl-1">
                                        <Info size={13} className="shrink-0 text-zinc-400" />
                                        <span className="leading-relaxed">{t.remarks}</span>
                                    </div>
                                )}

                                {/* Row 4: Participants */}
                                <div className={cn(
                                    "flex items-center gap-2 bg-transparent dark:bg-zinc-800/50 px-3 py-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800",
                                    !t.remarks && "mt-3"
                                )}>
                                    <Users size={14} className="shrink-0 text-zinc-400" />
                                    <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                                        {t.participants.length > 0 ? t.participants.join(", ") : "출장자 미지정"}
                                    </span>
                                </div>`;

    content = content.replace(layoutRegex, newLayout);
    fs.writeFileSync(filePath, content, 'utf-8');
}

updateLayout(path.join(__dirname, 'src/components/schedule/CoachTripCalendar.tsx'));
console.log("Refactored coach trip calendar layout to 4 lines");
