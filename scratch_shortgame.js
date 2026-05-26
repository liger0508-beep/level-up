const fs = require('fs');
const path = 'd:/gla_coach/src/app/(main)/training/challenges/create/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Approach Test
const approachTarget = `                            {[
                                { title: "숏 어프로치 테스트", shots: approachShots.slice(0, 4), labelMap: { 1: "5~10m", 2: "5~10m", 3: "5~10m", 4: "5~10m" } },
                                { title: "미들 어프로치 테스트", shots: approachShots.slice(4, 8), labelMap: { 5: "15m", 6: "15m", 7: "20m", 8: "20m" } },
                                { title: "롱 어프로치 테스트", shots: approachShots.slice(8, 12), labelMap: { 9: "25m", 10: "25m", 11: "30m", 12: "30m" } }
                            ].map((group, gIdx) => (
                                <section key={gIdx} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm">
                                    <h4 className="text-sm font-bold text-zinc-400 dark:text-zinc-500 mb-4">{group.title}</h4>`;

const approachReplacement = `                            {[
                                { title: "숏 어프로치 테스트", shots: approachShots.slice(0, 4), labelMap: { 1: "5~10m", 2: "5~10m", 3: "5~10m", 4: "5~10m" }, scoreKey: 'shortApproach' },
                                { title: "미들 어프로치 테스트", shots: approachShots.slice(4, 8), labelMap: { 5: "15m", 6: "15m", 7: "20m", 8: "20m" }, scoreKey: 'middleApproach' },
                                { title: "롱 어프로치 테스트", shots: approachShots.slice(8, 12), labelMap: { 9: "25m", 10: "25m", 11: "30m", 12: "30m" }, scoreKey: 'longApproach' }
                            ].map((group, gIdx) => {
                                const distScore = (scores as any)[group.scoreKey];
                                return (
                                <section key={gIdx} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-sm font-bold text-zinc-400 dark:text-zinc-500">{group.title}</h4>
                                        <div className="text-right">
                                            <span className="text-[10px] text-zinc-400 block mb-0.5">합계 점수</span>
                                            <span className={cn(
                                                "text-lg font-black italic",
                                                distScore < 0 ? "text-brand-red" : distScore > 0 ? "text-blue-600" : "text-zinc-400"
                                            )}>
                                                {distScore > 0 ? \`+\${distScore.toFixed(2)}\` : distScore.toFixed(2)}
                                            </span>
                                        </div>
                                    </div>`;

content = content.replace(approachTarget, approachReplacement);
content = content.replace(approachTarget.replace(/\r\n/g, '\n'), approachReplacement);
// Fix syntax error introduced by mapping approach with `{`
content = content.replace(`                                </section>\n                            ))}`, `                                </section>\n                                );\n                            })}`);
content = content.replace(`                                </section>\r\n                            ))}`, `                                </section>\r\n                                );\r\n                            })}`);

// 2. Bunker Test
const bunkerTarget = `                            {[
                                { title: "숏 벙커 테스트", shots: bunkerShots.slice(0, 3), label: "25m 이내" },
                                { title: "롱 벙커 테스트", shots: bunkerShots.slice(3, 6), label: "25m 이상" }
                            ].map((group, gIdx) => (
                                <section key={gIdx} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm">
                                    <h4 className="text-sm font-bold text-zinc-400 dark:text-zinc-500 mb-4">{group.title}</h4>`;

const bunkerReplacement = `                            {[
                                { title: "숏 벙커 테스트", shots: bunkerShots.slice(0, 3), label: "25m 이내", scoreKey: 'shortBunker' },
                                { title: "롱 벙커 테스트", shots: bunkerShots.slice(3, 6), label: "25m 이상", scoreKey: 'longBunker' }
                            ].map((group, gIdx) => {
                                const distScore = (scores as any)[group.scoreKey];
                                return (
                                <section key={gIdx} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-sm font-bold text-zinc-400 dark:text-zinc-500">{group.title}</h4>
                                        <div className="text-right">
                                            <span className="text-[10px] text-zinc-400 block mb-0.5">합계 점수</span>
                                            <span className={cn(
                                                "text-lg font-black italic",
                                                distScore < 0 ? "text-brand-red" : distScore > 0 ? "text-blue-600" : "text-zinc-400"
                                            )}>
                                                {distScore > 0 ? \`+\${distScore.toFixed(2)}\` : distScore.toFixed(2)}
                                            </span>
                                        </div>
                                    </div>`;

content = content.replace(bunkerTarget, bunkerReplacement);
content = content.replace(bunkerTarget.replace(/\r\n/g, '\n'), bunkerReplacement);
// Fix syntax error introduced by mapping bunker with `{`
content = content.replace(`                                </section>\n                            ))}`, `                                </section>\n                                );\n                            })}`);
content = content.replace(`                                </section>\r\n                            ))}`, `                                </section>\r\n                                );\r\n                            })}`);

// 3. Putting (Long, Middle, Short)
// Long Putt
const longPuttTarget = `                                <h3 className="text-lg font-black text-brand-navy italic mb-4">롱퍼팅 테스트 (4회)</h3>`;
const longPuttReplacement = `                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-black text-brand-navy italic">롱퍼팅 테스트 (4회)</h3>
                                    <div className="text-right">
                                        <span className="text-xs text-zinc-400 block mb-1">합계 점수</span>
                                        <span className={cn(
                                            "text-xl font-black italic",
                                            scores.long_putt < 0 ? "text-brand-red" : scores.long_putt > 0 ? "text-blue-600" : "text-zinc-400"
                                        )}>
                                            {scores.long_putt > 0 ? \`+\${scores.long_putt.toFixed(2)}\` : scores.long_putt.toFixed(2)}
                                        </span>
                                    </div>
                                </div>`;
content = content.replace(longPuttTarget, longPuttReplacement);
content = content.replace(longPuttTarget.replace(/\r\n/g, '\n'), longPuttReplacement);

// Middle Putt
const middlePuttTarget = `                                <h3 className="text-lg font-black text-brand-navy italic mb-4">미들퍼팅 테스트 (8회)</h3>`;
const middlePuttReplacement = `                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-black text-brand-navy italic">미들퍼팅 테스트 (8회)</h3>
                                    <div className="text-right">
                                        <span className="text-xs text-zinc-400 block mb-1">합계 점수</span>
                                        <span className={cn(
                                            "text-xl font-black italic",
                                            scores.middle_putt < 0 ? "text-brand-red" : scores.middle_putt > 0 ? "text-blue-600" : "text-zinc-400"
                                        )}>
                                            {scores.middle_putt > 0 ? \`+\${scores.middle_putt.toFixed(2)}\` : scores.middle_putt.toFixed(2)}
                                        </span>
                                    </div>
                                </div>`;
content = content.replace(middlePuttTarget, middlePuttReplacement);
content = content.replace(middlePuttTarget.replace(/\r\n/g, '\n'), middlePuttReplacement);

// Short Putt
const shortPuttTarget = `                                <h3 className="text-lg font-black text-brand-navy italic mb-4">숏퍼팅 테스트 (6회)</h3>`;
const shortPuttReplacement = `                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-black text-brand-navy italic">숏퍼팅 테스트 (6회)</h3>
                                    <div className="text-right">
                                        <span className="text-xs text-zinc-400 block mb-1">합계 점수</span>
                                        <span className={cn(
                                            "text-xl font-black italic",
                                            scores.short_putt < 0 ? "text-brand-red" : scores.short_putt > 0 ? "text-blue-600" : "text-zinc-400"
                                        )}>
                                            {scores.short_putt > 0 ? \`+\${scores.short_putt.toFixed(2)}\` : scores.short_putt.toFixed(2)}
                                        </span>
                                    </div>
                                </div>`;
content = content.replace(shortPuttTarget, shortPuttReplacement);
content = content.replace(shortPuttTarget.replace(/\r\n/g, '\n'), shortPuttReplacement);

fs.writeFileSync(path, content, 'utf8');
console.log('done');
