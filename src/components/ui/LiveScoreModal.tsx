"use client";

import React, { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface LiveScoreModalProps {
    isOpen: boolean;
    onClose: () => void;
    tournamentId: string;
    athleteId: string;
    athleteName: string;
}

export function LiveScoreModal({ isOpen, onClose, tournamentId, athleteId, athleteName }: LiveScoreModalProps) {
    const [loading, setLoading] = useState(true);
    const [scorecard, setScorecard] = useState<any>(null);

    useEffect(() => {
        if (!isOpen) return;
        
        const fetchScorecard = async () => {
            setLoading(true);
            const supabase = createClient();
            
            // Fetch the most recent scorecard for this tournament and athlete
            const { data: scData, error } = await supabase
                .from("scorecards")
                .select(`
                    id, total_score, hole_count, is_final,
                    holes:scorecard_holes(
                        id, hole_number, par, score,
                        shots:scorecard_shots(shot_number, location_code, distance)
                    )
                `)
                .eq("tournament_id", tournamentId)
                .eq("athlete_id", athleteId)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (scData) {
                // Sort holes
                if (scData.holes) {
                    scData.holes.sort((a: any, b: any) => a.hole_number - b.hole_number);
                }
                setScorecard(scData);
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
                            
                            {/* Summary Card */}
                            <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800">
                                <div>
                                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">상태</p>
                                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                                        {scorecard.is_final ? "라운드 종료" : `${scorecard.hole_count}홀 진행 중`}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">총 타수</p>
                                    <p className="text-xl font-black text-brand-navy dark:text-brand-navy-light">
                                        {scorecard.total_score > 0 ? `+${scorecard.total_score}` : scorecard.total_score === 0 ? "E" : scorecard.total_score}
                                    </p>
                                </div>
                            </div>

                            {/* Score Table */}
                            <div className="border border-zinc-200 dark:border-zinc-700 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 shadow-sm">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-center text-sm">
                                        <thead>
                                            <tr className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 font-bold text-zinc-600 dark:text-zinc-300">
                                                <th className="px-3 py-3 w-16 bg-zinc-100 dark:bg-zinc-900/50 border-r border-zinc-200 dark:border-zinc-700">HOLE</th>
                                                {[1,2,3,4,5,6,7,8,9].map(h => (
                                                    <th key={h} className="px-2 py-3 min-w-[36px]">{h}</th>
                                                ))}
                                                <th className="px-3 py-3 bg-zinc-100 dark:bg-zinc-900/50 border-l border-r border-zinc-200 dark:border-zinc-700 text-brand-navy">OUT</th>
                                                {[10,11,12,13,14,15,16,17,18].map(h => (
                                                    <th key={h} className="px-2 py-3 min-w-[36px]">{h}</th>
                                                ))}
                                                <th className="px-3 py-3 bg-zinc-100 dark:bg-zinc-900/50 border-l border-zinc-200 dark:border-zinc-700 text-brand-navy">IN</th>
                                                <th className="px-3 py-3 bg-brand-navy/5 dark:bg-brand-navy/20 border-l border-brand-navy/20 text-brand-navy font-black">TOT</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {/* PAR Row */}
                                            <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-500 font-semibold bg-white dark:bg-zinc-900">
                                                <td className="px-3 py-2 bg-zinc-50/50 dark:bg-zinc-800/30 border-r border-zinc-200 dark:border-zinc-700">PAR</td>
                                                {(() => {
                                                    const renderPar = (start: number, end: number) => {
                                                        const cells = [];
                                                        let sum = 0;
                                                        for (let i = start; i <= end; i++) {
                                                            const hole = scorecard.holes?.find((h: any) => h.hole_number === i);
                                                            const par = hole?.par || 0;
                                                            sum += par;
                                                            cells.push(<td key={i} className="px-2 py-2">{par || "-"}</td>);
                                                        }
                                                        return { cells, sum };
                                                    };
                                                    
                                                    const out = renderPar(1, 9);
                                                    const in_ = renderPar(10, 18);
                                                    
                                                    return (
                                                        <>
                                                            {out.cells}
                                                            <td className="px-3 py-2 bg-zinc-50/50 dark:bg-zinc-800/30 border-l border-r border-zinc-200 dark:border-zinc-700">{out.sum || "-"}</td>
                                                            {in_.cells}
                                                            <td className="px-3 py-2 bg-zinc-50/50 dark:bg-zinc-800/30 border-l border-zinc-200 dark:border-zinc-700">{in_.sum || "-"}</td>
                                                            <td className="px-3 py-2 bg-brand-navy/5 dark:bg-brand-navy/20 border-l border-brand-navy/20 font-bold">{out.sum + in_.sum || "-"}</td>
                                                        </>
                                                    );
                                                })()}
                                            </tr>
                                            {/* SCORE Row */}
                                            <tr className="font-bold text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900">
                                                <td className="px-3 py-2.5 bg-zinc-50/50 dark:bg-zinc-800/30 border-r border-zinc-200 dark:border-zinc-700">SCORE</td>
                                                {(() => {
                                                    const renderScore = (start: number, end: number) => {
                                                        const cells = [];
                                                        let sum = 0;
                                                        for (let i = start; i <= end; i++) {
                                                            const hole = scorecard.holes?.find((h: any) => h.hole_number === i);
                                                            let scoreStr = "-";
                                                            let colorClass = "";
                                                            
                                                            if (hole && hole.score > 0 && hole.par > 0) {
                                                                const s = hole.score;
                                                                sum += s;
                                                                scoreStr = s.toString();
                                                                
                                                                const diff = s - hole.par;
                                                                if (diff < 0) colorClass = "text-red-500";
                                                                else if (diff > 0) colorClass = "text-blue-500";
                                                            }
                                                            
                                                            cells.push(<td key={i} className={`px-2 py-2.5 ${colorClass}`}>{scoreStr}</td>);
                                                        }
                                                        return { cells, sum };
                                                    };
                                                    
                                                    const out = renderScore(1, 9);
                                                    const in_ = renderScore(10, 18);
                                                    
                                                    return (
                                                        <>
                                                            {out.cells}
                                                            <td className="px-3 py-2.5 bg-zinc-50/50 dark:bg-zinc-800/30 border-l border-r border-zinc-200 dark:border-zinc-700 text-brand-navy">{out.sum || "-"}</td>
                                                            {in_.cells}
                                                            <td className="px-3 py-2.5 bg-zinc-50/50 dark:bg-zinc-800/30 border-l border-zinc-200 dark:border-zinc-700 text-brand-navy">{in_.sum || "-"}</td>
                                                            <td className="px-3 py-2.5 bg-brand-navy/5 dark:bg-brand-navy/20 border-l border-brand-navy/20 font-black text-brand-navy">{out.sum + in_.sum || "-"}</td>
                                                        </>
                                                    );
                                                })()}
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
