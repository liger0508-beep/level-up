const fs = require('fs');
let buf = fs.readFileSync('src/app/(main)/training/challenges/create/page.tsx');
let text = new TextDecoder('utf-8', {fatal: false}).decode(buf);
const startIndex = text.indexOf('{/* Putting */}');
const endIndex = text.indexOf('</section>', startIndex);

const newPutting = `{/* Putting */}
                                    {testGroups.find(g => g.label === selectedGroup)?.categoryId === "putting" && (
                                        <div className="space-y-4">
                                            <div>
                                                <p className="text-sm font-bold text-brand-navy opacity-80 uppercase tracking-widest mb-1.5">퍼팅</p>
                                                <p className={cn(
                                                    "text-[24px] font-black italic tracking-tighter leading-none text-right",
                                                    scores.puttingSubtotal < 0 ? "text-brand-red" : scores.puttingSubtotal > 0 ? "text-blue-600" : "text-zinc-900 dark:text-white"
                                                )}>
                                                    {formatScore(scores.puttingSubtotal)}
                                                </p>
                                            </div>
                                            <div className="space-y-3 pt-2 border-t border-zinc-100 dark:border-white/5">
                                                <div className="flex flex-col w-full">
                                                    <span className="text-[11px] font-bold text-zinc-500 leading-tight text-left">숏퍼팅</span>
                                                    <span className={cn("text-[13px] font-black italic mt-0.5 text-right w-full", scores.short_putt < 0 ? "text-brand-red" : scores.short_putt > 0 ? "text-blue-600" : "text-zinc-400")}>
                                                        {formatScore(scores.short_putt)}
                                                    </span>
                                                </div>
                                                <div className="flex flex-col w-full">
                                                    <span className="text-[11px] font-bold text-zinc-500 leading-tight text-left">미들퍼팅</span>
                                                    <span className={cn("text-[13px] font-black italic mt-0.5 text-right w-full", scores.middle_putt < 0 ? "text-brand-red" : scores.middle_putt > 0 ? "text-blue-600" : "text-zinc-400")}>
                                                        {formatScore(scores.middle_putt)}
                                                    </span>
                                                </div>
                                                <div className="flex flex-col w-full">
                                                    <span className="text-[11px] font-bold text-zinc-500 leading-tight text-left">롱퍼팅</span>
                                                    <span className={cn("text-[13px] font-black italic mt-0.5 text-right w-full", scores.long_putt < 0 ? "text-brand-red" : scores.long_putt > 0 ? "text-blue-600" : "text-zinc-400")}>
                                                        {formatScore(scores.long_putt)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        `;
text = text.substring(0, startIndex) + newPutting + text.substring(endIndex);
fs.writeFileSync('src/app/(main)/training/challenges/create/page.tsx', text);
