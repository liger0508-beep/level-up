"use client";

import React, { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface LiveScoreModalProps {
    isOpen: boolean;
    onClose: () => void;
    tournamentId: string;
    athleteId: string;
    athleteName: string;
    usePlainNumbers?: boolean;
}

export function LiveScoreModal({ isOpen, onClose, tournamentId, athleteId, athleteName, usePlainNumbers = false }: LiveScoreModalProps) {
    const [loading, setLoading] = useState(true);
    const [scorecard, setScorecard] = useState<any>(null);

    useEffect(() => {
        if (!isOpen) return;
        
        const fetchScorecard = async () => {
            setLoading(true);
            const supabase = createClient();
            
            // Fetch the marker's scorecard for this athlete (official score)
            const { data: scData, error } = await supabase
                .from("scorecards")
                .select(`
                    id, total_score, hole_count, is_final,
                    base_holes:scorecard_holes(hole_number, par, score),
                    marker_scores:tournament_marker_scores(hole_number, score)
                `)
                .eq("tournament_id", tournamentId)
                .eq("marker_id", athleteId)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (scData) {
                // Map marker_scores and base_holes into a unified 'holes' array
                const holesMap = new Map();
                
                scData.base_holes?.forEach((h: any) => {
                    holesMap.set(h.hole_number, { hole_number: h.hole_number, par: h.par, score: h.score || 0 });
                });
                
                scData.marker_scores?.forEach((m: any) => {
                    if (holesMap.has(m.hole_number)) {
                        if (m.score > 0) {
                            holesMap.get(m.hole_number).score = m.score;
                        }
                    } else {
                        holesMap.set(m.hole_number, { hole_number: m.hole_number, par: 0, score: m.score });
                    }
                });

                const unifiedHoles = Array.from(holesMap.values()).sort((a: any, b: any) => a.hole_number - b.hole_number);
                
                setScorecard({
                    ...scData,
                    holes: unifiedHoles
                });
            }
            setLoading(false);
        };

        fetchScorecard();
    }, [isOpen, tournamentId, athleteId]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-3xl bg-white dark:bg-zinc-900 rounded-[2rem] shadow-xl overflow-hidden relative flex flex-col max-h-[85vh]">
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 z-10 shrink-0">
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-brand-red animate-pulse"></span>
                        라이브 스코어 <span className="text-zinc-400 text-sm font-semibold ml-2">({athleteName})</span>
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-48 gap-3">
                            <Loader2 className="w-8 h-8 text-brand-navy animate-spin" />
                            <p className="text-sm font-semibold text-zinc-500">데이터를 불러오는 중입니다...</p>
                        </div>
                    ) : !scorecard ? (
                        <div className="flex flex-col items-center justify-center h-48 text-zinc-500">
                            <p>입력된 스코어가 없습니다.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            
                            {/* Summary Card and Score Tables */}
                            {(() => {
                                const renderPar = (start: number, end: number) => {
                                    const cells = [];
                                    let sum = 0;
                                    for (let i = start; i <= end; i++) {
                                        const hole = scorecard.holes?.find((h: any) => h.hole_number === i);
                                        const par = hole?.par || 0;
                                        sum += par;
                                        cells.push(<td key={i} className="px-1 sm:px-2 py-1.5 sm:py-2">{par || "-"}</td>);
                                    }
                                    return { cells, sum };
                                };
                                
                                const renderScore = (start: number, end: number) => {
                                    const cells = [];
                                    let sum = 0;
                                    for (let i = start; i <= end; i++) {
                                        const hole = scorecard.holes?.find((h: any) => h.hole_number === i);
                                        
                                        if (hole && hole.score > 0 && hole.par > 0) {
                                            const s = hole.score;
                                            sum += s;
                                            const diff = s - hole.par;
                                            
                                            
                                            if (usePlainNumbers) {
                                                let colorClass = "";
                                                if (diff < 0) colorClass = "text-red-500";
                                                else if (diff > 0) colorClass = "text-blue-500";
                                                
                                                cells.push(<td key={i} className={`px-1 sm:px-2 py-2 sm:py-2.5 font-bold ${colorClass}`}>{s}</td>);
                                            } else {
                                                cells.push(
                                                    <td key={i} className="px-0 sm:px-2 py-1 sm:py-1.5 align-middle">
                                                        <div className="relative inline-flex items-center justify-center w-5 h-5 sm:w-7 sm:h-7 mx-auto">
                                                            <span className={cn(
                                                                "relative z-10 font-black tracking-tighter text-[10px] sm:text-[13px]",
                                                                diff <= -2 ? "text-orange-600 dark:text-orange-400" :
                                                                diff === -1 ? "text-yellow-600 dark:text-yellow-500" :
                                                                diff === 1 ? "text-sky-600 dark:text-sky-400" :
                                                                diff >= 2 ? "text-sky-700 dark:text-sky-300" :
                                                                "text-zinc-900 dark:text-zinc-100"
                                                            )}>{s}</span>
                                                            {diff <= -2 && (
                                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                                    <div className="w-[110%] h-[110%] rounded-full border-[1.5px] border-orange-400/80 absolute" />
                                                                    <div className="w-[85%] h-[85%] rounded-full border-[1.5px] border-orange-400/80 absolute" />
                                                                </div>
                                                            )}
                                                            {diff === -1 && (
                                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                                    <div className="w-full h-full rounded-full border-[1.5px] border-yellow-400/80 absolute" />
                                                                </div>
                                                            )}
                                                            {diff === 1 && (
                                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                                    <div className="w-[90%] h-[90%] border-[1.5px] border-sky-400/80 absolute" />
                                                                </div>
                                                            )}
                                                            {diff >= 2 && (
                                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                                    <div className="w-[100%] h-[100%] border-[1.5px] border-sky-400/80 absolute" />
                                                                    <div className="w-[80%] h-[80%] border-[1.5px] border-sky-400/80 absolute" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                );
                                            }
                                        } else {
                                            cells.push(<td key={i} className="px-0 sm:px-2 py-2 sm:py-2.5 text-zinc-300 dark:text-zinc-700">-</td>);
                                        }
                                    }
                                    return { cells, sum };
                                };

                                const outPar = renderPar(1, 9);
                                const inPar = renderPar(10, 18);
                                const outScore = renderScore(1, 9);
                                const inScore = renderScore(10, 18);
                                const totalScoreSum = outScore.sum + inScore.sum;

                                return (
                                    <>
                                        {/* Summary Card */}
                                        <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800">
                                            <div className="flex flex-col items-center flex-1 border-r border-zinc-200 dark:border-zinc-700">
                                                <span className="text-[10px] font-bold text-zinc-400 mb-0.5">OUT</span>
                                                <span className="text-sm font-black text-zinc-900 dark:text-white">{outScore.sum || "-"}</span>
                                            </div>
                                            <div className="flex flex-col items-center flex-1 border-r border-zinc-200 dark:border-zinc-700">
                                                <span className="text-[10px] font-bold text-zinc-400 mb-0.5">IN</span>
                                                <span className="text-sm font-black text-zinc-900 dark:text-white">{inScore.sum || "-"}</span>
                                            </div>
                                            <div className="flex flex-col items-center flex-1">
                                                <span className="text-[10px] font-bold text-brand-navy mb-0.5">TOTAL</span>
                                                <span className="text-sm font-black text-brand-navy">{totalScoreSum || "-"}</span>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            {/* OUT Course */}
                                            <div className="border border-zinc-200 dark:border-zinc-700 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 shadow-sm w-full">
                                                <div className="overflow-hidden">
                                                    <table className="w-full table-fixed text-center text-[9px] sm:text-sm">
                                                        <thead>
                                                            <tr className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 font-bold text-zinc-600 dark:text-zinc-300">
                                                                <th className="px-0 sm:px-3 py-2 sm:py-3 w-8 sm:w-16 bg-zinc-100 dark:bg-zinc-900/50 border-r border-zinc-200 dark:border-zinc-700 whitespace-nowrap overflow-hidden">HOLE</th>
                                                                {[1,2,3,4,5,6,7,8,9].map(h => (
                                                                    <th key={h} className="px-0 sm:px-2 py-2 sm:py-3 truncate">{h}</th>
                                                                ))}
                                                                <th className="px-0 sm:px-3 py-2 sm:py-3 bg-zinc-100 dark:bg-zinc-900/50 border-l border-zinc-200 dark:border-zinc-700 text-brand-navy w-8 sm:w-16 whitespace-nowrap overflow-hidden">OUT</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-500 font-semibold bg-white dark:bg-zinc-900">
                                                                <td className="px-0 sm:px-3 py-1.5 sm:py-2 bg-zinc-50/50 dark:bg-zinc-800/30 border-r border-zinc-200 dark:border-zinc-700 overflow-hidden">PAR</td>
                                                                {outPar.cells}
                                                                <td className="px-0 sm:px-3 py-1.5 sm:py-2 bg-zinc-50/50 dark:bg-zinc-800/30 border-l border-zinc-200 dark:border-zinc-700 overflow-hidden">{outPar.sum || "-"}</td>
                                                            </tr>
                                                            <tr className="font-bold text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900">
                                                                <td className="px-0 sm:px-3 py-2 sm:py-2.5 bg-zinc-50/50 dark:bg-zinc-800/30 border-r border-zinc-200 dark:border-zinc-700 overflow-hidden">SCORE</td>
                                                                {outScore.cells}
                                                                <td className="px-0 sm:px-3 py-2 sm:py-2.5 bg-zinc-50/50 dark:bg-zinc-800/30 border-l border-zinc-200 dark:border-zinc-700 text-brand-navy overflow-hidden">{outScore.sum || "-"}</td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>

                                            {/* IN Course */}
                                            <div className="border border-zinc-200 dark:border-zinc-700 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 shadow-sm w-full">
                                                <div className="overflow-hidden">
                                                    <table className="w-full table-fixed text-center text-[9px] sm:text-sm">
                                                        <thead>
                                                            <tr className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 font-bold text-zinc-600 dark:text-zinc-300">
                                                                <th className="px-0 sm:px-3 py-2 sm:py-3 w-8 sm:w-16 bg-zinc-100 dark:bg-zinc-900/50 border-r border-zinc-200 dark:border-zinc-700 whitespace-nowrap overflow-hidden">HOLE</th>
                                                                {[10,11,12,13,14,15,16,17,18].map(h => (
                                                                    <th key={h} className="px-0 sm:px-2 py-2 sm:py-3 truncate">{h}</th>
                                                                ))}
                                                                <th className="px-0 sm:px-3 py-2 sm:py-3 bg-zinc-100 dark:bg-zinc-900/50 border-l border-zinc-200 dark:border-zinc-700 text-brand-navy w-8 sm:w-16 whitespace-nowrap overflow-hidden">IN</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-500 font-semibold bg-white dark:bg-zinc-900">
                                                                <td className="px-0 sm:px-3 py-1.5 sm:py-2 bg-zinc-50/50 dark:bg-zinc-800/30 border-r border-zinc-200 dark:border-zinc-700 overflow-hidden">PAR</td>
                                                                {inPar.cells}
                                                                <td className="px-0 sm:px-3 py-1.5 sm:py-2 bg-zinc-50/50 dark:bg-zinc-800/30 border-l border-zinc-200 dark:border-zinc-700 overflow-hidden">{inPar.sum || "-"}</td>
                                                            </tr>
                                                            <tr className="font-bold text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900">
                                                                <td className="px-0 sm:px-3 py-2 sm:py-2.5 bg-zinc-50/50 dark:bg-zinc-800/30 border-r border-zinc-200 dark:border-zinc-700 overflow-hidden">SCORE</td>
                                                                {inScore.cells}
                                                                <td className="px-0 sm:px-3 py-2 sm:py-2.5 bg-zinc-50/50 dark:bg-zinc-800/30 border-l border-zinc-200 dark:border-zinc-700 text-brand-navy overflow-hidden">{inScore.sum || "-"}</td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}

                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
