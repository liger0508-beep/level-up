import re

with open('d:/gla_coach/src/app/(main)/training/[id]/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = '<div className="grid grid-cols-5 gap-1.5 sm:flex sm:flex-wrap sm:gap-2 mb-4">'
end_marker = '                                                })()}'

start_idx = content.find(start_marker)
if start_idx == -1:
    print("Start marker not found")
    exit()
    
# We need to find the correct ending curly brace/div.
# Actually, it's easier to use a regex or string replacement for the exact chunk.
# Let's extract the exact chunk using the line numbers we found.
lines = content.split('\n')
chunk_start = 1012 # 0-indexed: 1012 is line 1013
chunk_end = 1198 # 0-indexed: 1198 is line 1199 `)}`

# Wait, `isExpanded && (` is at line 1011 (idx 1010)
# So we can just replace lines 1012 to 1198.

new_code = """                                                    <div className="flex overflow-x-auto gap-3 pb-2 snap-x snap-mandatory scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
                                                        {focusHolesForCat.filter((h: any, index: number, self: any[]) => index === self.findIndex((t) => t.holeNumber === h.holeNumber)).map((h: any, hIdx: number) => {
                                                            const uniqueKey = h.uniqueId || `${catName}_${h.holeNumber}`;
                                                            const isCompleted = reviewData.completedHoles.includes(uniqueKey as any);
                                                            const displayHole = h.holeNumber;
                                                            
                                                            return (
                                                                <div key={uniqueKey} className="snap-start shrink-0 w-[240px] bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm p-4 flex flex-col relative overflow-hidden">
                                                                    {isCompleted && (
                                                                        <div className="absolute top-0 right-0 border-b border-l border-emerald-100 dark:border-emerald-800/30 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 px-2 py-1 rounded-bl-xl text-[10px] font-bold flex items-center gap-1 z-10">
                                                                            <CheckCircle2 size={12} /> 완료
                                                                        </div>
                                                                    )}
                                                                    
                                                                    <div className="mb-3">
                                                                        <span className="text-sm font-black text-zinc-900 dark:text-white">{displayHole}번 홀</span>
                                                                    </div>
                                                                    
                                                                    <div className="space-y-1.5 mb-4">
                                                                        <div className="flex items-center text-[12px]">
                                                                            <span className="font-bold text-zinc-400 w-10 shrink-0">시도</span>
                                                                            <span className="font-semibold text-zinc-700 dark:text-zinc-300 truncate">{h.worstShotInfo?.attempt || "-"}</span>
                                                                        </div>
                                                                        <div className="flex items-center text-[12px]">
                                                                            <span className="font-bold text-zinc-400 w-10 shrink-0">결과</span>
                                                                            <span className="font-semibold text-zinc-700 dark:text-zinc-300 truncate">{h.worstShotInfo?.result === "오비" ? "OB" : (h.worstShotInfo?.result || "-")}</span>
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    <div className="mt-auto pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
                                                                        <button 
                                                                            onClick={async () => {
                                                                                const clickedIndex = focusHolesForCat.findIndex((fh: any) => (fh.uniqueId || `${catName}_${fh.holeNumber}`) === uniqueKey);
                                                                                const subsequentHoles = focusHolesForCat.slice(clickedIndex >= 0 ? clickedIndex : 0);
                                                                                
                                                                                let targetHoles = [];
                                                                                if (isCompleted) {
                                                                                    if (!window.confirm('재훈련하시겠습니까?')) return;
                                                                                    targetHoles = focusHolesForCat;
                                                                                    const catPrefix = `${catName}_`;
                                                                                    const newCompletedHoles = reviewData.completedHoles.filter(
                                                                                        (key: string) => !key.startsWith(catPrefix)
                                                                                    );
                                                                                    try {
                                                                                        const supabase = createClient();
                                                                                        const { data: recordData } = await supabase.from("records").select("template_settings").eq("id", id).single();
                                                                                        if (recordData) {
                                                                                            const updatedSettings = (recordData.template_settings || []).map((s: any) => {
                                                                                                if (s.type === "review_scorecard" || s.type === "prep_scorecard") {
                                                                                                    return { ...s, completedHoles: newCompletedHoles };
                                                                                                }
                                                                                                return s;
                                                                                            });
                                                                                            await supabase.from("records").update({ template_settings: updatedSettings }).eq("id", id);
                                                                                        }
                                                                                    } catch (e) {
                                                                                        console.error("Failed to reset completedHoles for retrain:", e);
                                                                                    }
                                                                                    setReviewData(prev => prev ? { ...prev, completedHoles: newCompletedHoles } : prev);
                                                                                } else {
                                                                                    targetHoles = subsequentHoles.filter((fh: any) => 
                                                                                        !reviewData.completedHoles.includes(fh.uniqueId || `${catName}_${fh.holeNumber}` as any)
                                                                                    );
                                                                                }
                                                                                
                                                                                targetHoles = targetHoles.map((fh: any) => ({
                                                                                    hole: fh.holeNumber,
                                                                                    uniqueId: fh.uniqueId || `${catName}_${fh.holeNumber}`,
                                                                                    par: fh.hData ? fh.hData.par : (fh.par || 4),
                                                                                    attempt: fh.worstShotInfo?.attempt || "-",
                                                                                    result: fh.worstShotInfo?.result || "-",
                                                                                    score: fh.worstShotInfo?.score?.toFixed(1) || "-",
                                                                                    note: fh.worstShotInfo?.note || "",
                                                                                    putts: fh.hData?.summary?.putts || 0,
                                                                                    shotNumber: fh.worstShotInfo?.shotNumber || 0
                                                                                }));
                                                                                
                                                                                const trainingChain = currentCats.map(c => {
                                                                                    const cHoles = c.holes.map((ch: any) => ({
                                                                                        hole: ch.holeNumber,
                                                                                        uniqueId: ch.uniqueId || `${c.name}_${ch.holeNumber}`,
                                                                                        par: ch.hData ? ch.hData.par : (ch.par || 4),
                                                                                        attempt: ch.worstShotInfo?.attempt || "-",
                                                                                        result: ch.worstShotInfo?.result || "-",
                                                                                        score: ch.worstShotInfo?.score?.toFixed(1) || "-",
                                                                                        note: ch.worstShotInfo?.note || "",
                                                                                        putts: ch.hData?.summary?.putts || 0,
                                                                                        shotNumber: ch.worstShotInfo?.shotNumber || 0
                                                                                    }));

                                                                                    return {
                                                                                        catName: c.name,
                                                                                        encodedHoles: encodeURIComponent(JSON.stringify(cHoles))
                                                                                    };
                                                                                });
                                                                                sessionStorage.setItem('trainingChain', JSON.stringify(trainingChain));
                                                                                
                                                                                const encodedHoles = encodeURIComponent(JSON.stringify(targetHoles));
                                                                                sessionStorage.setItem('lastTrainingCat', catName);
                                                                                router.push(`/training/voice-guide?type=review_category&cat=${encodeURIComponent(catName)}&holes=${encodedHoles}&recordId=${id}&isPrep=${isPrep}`);
                                                                            }}
                                                                            className={cn(
                                                                                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95",
                                                                                isCompleted
                                                                                    ? "bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800/50"
                                                                                    : "bg-brand-navy text-white hover:bg-brand-navy-light border border-brand-navy-light"
                                                                            )}
                                                                        >
                                                                            {isCompleted ? (
                                                                                <>
                                                                                    <CheckCircle2 size={14} />
                                                                                    재훈련
                                                                                </>
                                                                            ) : (
                                                                                "훈련 시작"
                                                                            )}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>"""

new_lines = lines[:1012] + [new_code] + lines[1199:]

with open('d:/gla_coach/src/app/(main)/training/[id]/page.tsx', 'w', encoding='utf-8') as f:
    f.write('\\n'.join(new_lines))

print("Success")
