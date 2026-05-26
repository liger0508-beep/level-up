"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { calculateScorecardAnalysis, HoleAnalysis } from "@/lib/score-calculations";
import { cn } from "@/lib/utils";

interface ScorecardDetailTableProps {
    scorecardId: string;
    isStatsMode?: boolean;
    selectedCategory?: string | null;
    focusHoles?: number[];
}

const CATEGORY_TO_FIELD: Record<string, string> = {
    "티샷 비거리": "distSG_DriverDist",
    "티샷 정확도": "distSG_DriverAcc",
    "180M이상": "distSG_180Plus",
    "150-179M": "distSG_150_179",
    "120-149M": "distSG_120_149",
    "90-119M": "distSG_90_119",
    "피치샷": "distSG_Pitch31_89",
    "벙커": "distSG_Bunker",
    "어프로치": "distSG_Approach",
    "9M이상": "distSG_Putt9Plus",
    "4-8M": "distSG_Putt4_8",
    "2-3M": "distSG_Putt2_3",
    "1M": "distSG_Putt1",
};

export function ScorecardDetailTable({ scorecardId, isStatsMode, selectedCategory, focusHoles = [] }: ScorecardDetailTableProps) {
    const [loading, setLoading] = useState(true);
    const [holes, setHoles] = useState<HoleAnalysis[]>([]);

    useEffect(() => {
        const fetchAnalysis = async () => {
            setLoading(true);
            try {
                const result = await calculateScorecardAnalysis(scorecardId);
                // Remove duplicates by hole number
                const uniqueHoles = result.filter((v, i, a) => a.findIndex(t => t.holeNumber === v.holeNumber) === i);
                setHoles(uniqueHoles);
            } catch (error) {
                console.error("Failed to fetch scorecard analysis:", error);
            } finally {
                setLoading(false);
            }
        };
        if (scorecardId) fetchAnalysis();
    }, [scorecardId]);

    if (loading) {
        return (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
                <div className="w-8 h-8 border-4 border-brand-navy border-t-transparent rounded-full animate-spin" />
                <p className="text-zinc-500 font-bold text-sm">스코어카드 데이터를 불러오는 중...</p>
            </div>
        );
    }

    if (holes.length === 0) {
        return (
            <div className="py-12 text-center text-zinc-500 font-bold">
                스코어카드 데이터를 찾을 수 없습니다.
            </div>
        );
    }

    const fieldName = selectedCategory ? CATEGORY_TO_FIELD[selectedCategory] : null;

    return (
        <div className="overflow-x-auto -mx-6 pb-2 scrollbar-hide">
            <table className="w-full min-w-[1000px] lg:min-w-0 border-separate border-spacing-0 text-center">
                <thead>
                    <tr className="text-[10px] font-black text-zinc-600 dark:text-zinc-400 uppercase tracking-tighter">
                        <th className="sticky left-0 z-30 py-2 px-1 bg-white dark:bg-zinc-900 border-y border-zinc-100 dark:border-zinc-800 w-24 sm:w-28 text-left pl-6 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)]">Hole</th>
                        {holes.map((h, idx) => {
                            const isHighlighted = (fieldName && (h.summary as any)[fieldName] > 0) || focusHoles.includes(h.holeNumber);
                            return (
                                <th key={`${h.holeNumber}-${idx}`} className={cn(
                                    "py-2 px-0.5 sm:px-1 text-[11px] font-black border-y border-zinc-100 dark:border-zinc-800 transition-colors",
                                    isHighlighted ? "bg-orange-500 text-white" : "text-zinc-900 dark:text-zinc-50 bg-white dark:bg-zinc-950"
                                )}>
                                    {h.holeNumber}
                                </th>
                            );
                        })}
                        <th className="py-2 px-2 text-[11px] font-black text-brand-navy dark:text-brand-navy-light border-y border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/80 pr-6">총계</th>
                    </tr>
                </thead>
                <tbody className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                    {/* PAR Row */}
                    <tr className="border-b border-zinc-50 dark:border-zinc-800/50">
                        <td className="sticky left-0 z-30 py-2 px-1 text-[10px] font-black text-zinc-800 dark:text-zinc-200 tracking-tighter bg-white dark:bg-zinc-900 text-left pl-6 uppercase border-b border-zinc-50 dark:border-zinc-800/50 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)]">PAR</td>
                        {holes.map((h, idx) => {
                            const isHighlighted = (fieldName && (h.summary as any)[fieldName] > 0) || focusHoles.includes(h.holeNumber);
                            return (
                                <td key={`par-${idx}`} className={cn(
                                    "py-2 px-1 font-black border-b border-zinc-50 dark:border-zinc-800/50 transition-colors",
                                    isHighlighted ? "bg-orange-100 dark:bg-orange-900/40" : "bg-white dark:bg-zinc-950"
                                )}>
                                    {h.par}
                                </td>
                            );
                        })}
                        <td className="py-2 px-2 font-black border-b border-zinc-50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-800/50 text-brand-navy pr-6">{holes.reduce((s, h) => s + h.par, 0)}</td>
                    </tr>
                    {/* Score Row */}
                    <tr className="border-b border-zinc-50 dark:border-zinc-800/50">
                        <td className="sticky left-0 z-30 py-3 px-1 text-[10px] font-black text-zinc-900 dark:text-zinc-100 tracking-tighter bg-white dark:bg-zinc-900 text-left pl-6 uppercase border-b border-zinc-50 dark:border-zinc-800/50 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)]">스코어</td>
                        {holes.map((h, idx) => {
                            const isHighlighted = (fieldName && (h.summary as any)[fieldName] > 0) || focusHoles.includes(h.holeNumber);
                            const diff = h.score - h.par;
                            
                            // Render shapes based on relative score to par
                            const renderScoreCell = () => {
                                if (diff === 0) {
                                    // Par (No shape, just standard text)
                                    return (
                                        <div className="inline-flex items-center justify-center w-[22px] h-[22px] sm:w-[26px] sm:h-[26px] font-black text-zinc-900 dark:text-zinc-50">
                                            {h.score}
                                        </div>
                                    );
                                } else if (diff === -1) {
                                    // Birdie (One red circle)
                                    return (
                                        <div className="inline-flex items-center justify-center w-[22px] h-[22px] sm:w-[26px] sm:h-[26px] border border-red-300 dark:border-red-700 rounded-full font-black text-red-600 dark:text-red-400">
                                            {h.score}
                                        </div>
                                    );
                                } else if (diff <= -2) {
                                    // Eagle or better (Two red circles)
                                    return (
                                        <div className="inline-flex items-center justify-center w-[22px] h-[22px] sm:w-[26px] sm:h-[26px] border border-red-300 dark:border-red-700 rounded-full p-[1.5px]">
                                            <div className="w-full h-full flex items-center justify-center border border-red-300 dark:border-red-700 rounded-full font-black text-red-600 dark:text-red-400 text-[10px] sm:text-[11px]">
                                                {h.score}
                                            </div>
                                        </div>
                                    );
                                } else if (diff === 1) {
                                    // Bogey (One blue square)
                                    return (
                                        <div className="inline-flex items-center justify-center w-[22px] h-[22px] sm:w-[26px] sm:h-[26px] border border-blue-300 dark:border-blue-700 rounded-[4px] font-black text-blue-600 dark:text-blue-400">
                                            {h.score}
                                        </div>
                                    );
                                } else {
                                    // Double Bogey or worse (Two blue squares)
                                    return (
                                        <div className="inline-flex items-center justify-center w-[22px] h-[22px] sm:w-[26px] sm:h-[26px] border border-blue-300 dark:border-blue-700 rounded-[4px] p-[1.5px]">
                                            <div className="w-full h-full flex items-center justify-center border border-blue-300 dark:border-blue-700 rounded-[4px] font-black text-blue-600 dark:text-blue-400 text-[10px] sm:text-[11px]">
                                                {h.score}
                                            </div>
                                        </div>
                                    );
                                }
                            };

                            return (
                                <td key={`score-${idx}`} className={cn(
                                    "py-2 px-0 border-b border-zinc-50 dark:border-zinc-800/50 transition-colors",
                                    isHighlighted ? "bg-orange-100 dark:bg-orange-900/40" : "bg-white dark:bg-zinc-950"
                                )}>
                                    {renderScoreCell()}
                                </td>
                            );
                        })}
                        <td className="py-2 px-2 font-black border-b border-zinc-50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-800/50 text-brand-navy pr-6">{holes.reduce((s, h) => s + h.score, 0)}</td>
                    </tr>
                    {/* Fairway Row */}
                    <tr className="border-b border-zinc-50 dark:border-zinc-800/50">
                        <td className="sticky left-0 z-30 py-2 px-1 text-[10px] font-black text-zinc-900 dark:text-zinc-100 tracking-tighter bg-white dark:bg-zinc-900 text-left pl-6 uppercase border-b border-zinc-50 dark:border-zinc-800/50 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)]">페어웨이</td>
                        {holes.map((h, idx) => {
                            const isHighlighted = (fieldName && (h.summary as any)[fieldName] > 0) || focusHoles.includes(h.holeNumber);
                            return (
                                <td key={`fw-${idx}`} className={cn(
                                    "py-2 px-1 font-black border-b border-zinc-50 dark:border-zinc-800/50 transition-colors",
                                    isHighlighted ? "bg-orange-100 dark:bg-orange-900/40" : "bg-white dark:bg-zinc-950"
                                )}>
                                    {h.summary.fairwayHit}
                                </td>
                            );
                        })}
                        <td className="py-2 px-2 font-black border-b border-zinc-50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-800/50 text-brand-navy pr-6">
                            {(() => {
                                const fwHoles = holes.filter(h => h.summary.fairwayHit !== '-');
                                return fwHoles.length > 0 ? Math.round((fwHoles.filter(h => h.summary.fairwayHit === 'O').length / fwHoles.length) * 100) : 0;
                            })()}%
                        </td>
                    </tr>
                    {/* onGreenAttemptDist Row */}
                    <tr className="border-b border-zinc-50 dark:border-zinc-800/50">
                        <td className="sticky left-0 z-30 py-2 px-1 text-[10px] font-black text-zinc-900 dark:text-zinc-100 tracking-tighter bg-white dark:bg-zinc-900 text-left pl-6 uppercase leading-tight border-b border-zinc-50 dark:border-zinc-800/50 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)]">온그린시도</td>
                        {holes.map((h, idx) => {
                            const isHighlighted = (fieldName && (h.summary as any)[fieldName] > 0) || focusHoles.includes(h.holeNumber);
                            return (
                                <td key={`girDist-${idx}`} className={cn(
                                    "py-2 px-1 border-b border-zinc-50 dark:border-zinc-800/50 transition-colors",
                                    isHighlighted ? "bg-orange-100 dark:bg-orange-900/40" : "bg-white dark:bg-zinc-950"
                                )}>
                                    {h.summary.onGreenAttemptDist || "-"}
                                </td>
                            );
                        })}
                        <td className="py-2 px-2 font-black border-b border-zinc-50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-800/50 text-brand-navy pr-6">
                            {(() => {
                                const valid = holes.filter(h => h.summary.onGreenAttemptDist && h.summary.onGreenAttemptDist !== "-" && h.summary.onGreenAttemptDist !== "");
                                return valid.length > 0 ? Math.round(valid.reduce((s, h) => s + parseFloat(h.summary.onGreenAttemptDist as string), 0) / valid.length) : "-";
                            })()}
                        </td>
                    </tr>
                    {/* GIR Row */}
                    <tr className="border-b border-zinc-50 dark:border-zinc-800/50">
                        <td className="sticky left-0 z-30 py-2 px-1 text-[10px] font-black text-zinc-900 dark:text-zinc-100 tracking-tighter bg-white dark:bg-zinc-900 text-left pl-6 uppercase border-b border-zinc-50 dark:border-zinc-800/50 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)]">파온 여부</td>
                        {holes.map((h, idx) => {
                            const isHighlighted = (fieldName && (h.summary as any)[fieldName] > 0) || focusHoles.includes(h.holeNumber);
                            return (
                                <td key={`gir-${idx}`} className={cn(
                                    "py-2 px-0.5 sm:px-1 font-black border-b border-zinc-50 dark:border-zinc-800/50 transition-colors",
                                    isHighlighted ? "bg-orange-100 dark:bg-orange-900/40" : "bg-white dark:bg-zinc-950"
                                )}>
                                    {h.summary.gir}
                                </td>
                            );
                        })}
                        <td className="py-2 px-2 font-black border-b border-zinc-50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-800/50 text-brand-navy pr-6">
                            {Math.round((holes.filter(h => h.summary.gir === 'O').length / holes.length) * 100)}%
                        </td>
                    </tr>
                    {/* Bunker Row */}
                    <tr className="border-b border-zinc-50 dark:border-zinc-800/50">
                        <td className="sticky left-0 z-30 py-2 px-1 text-[10px] font-black text-zinc-900 dark:text-zinc-100 tracking-tighter bg-white dark:bg-zinc-900 text-left pl-6 uppercase border-b border-zinc-50 dark:border-zinc-800/50 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)]">벙커시도</td>
                        {holes.map((h, idx) => {
                            const isHighlighted = (fieldName && (h.summary as any)[fieldName] > 0) || focusHoles.includes(h.holeNumber);
                            return (
                                <td key={`bunker-${idx}`} className={cn(
                                    "py-2 px-0.5 sm:px-1 border-b border-zinc-50 dark:border-zinc-800/50 transition-colors text-[10px] sm:text-[11px]",
                                    isHighlighted ? "bg-orange-100 dark:bg-orange-900/40" : "bg-white dark:bg-zinc-950"
                                )}>
                                    {h.summary.bunkerAttemptDist || "-"}
                                </td>
                            );
                        })}
                        <td className="py-2 px-2 font-black border-b border-zinc-50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-800/50 text-brand-navy pr-6">
                            {(() => {
                                const valid = holes.filter(h => h.summary.bunkerAttemptDist && h.summary.bunkerAttemptDist !== "-" && h.summary.bunkerAttemptDist !== "");
                                return valid.length > 0 ? Math.round(valid.reduce((s, h) => s + parseFloat(h.summary.bunkerAttemptDist as string), 0) / valid.length) : "-";
                            })()}
                        </td>
                    </tr>
                    {/* Approach Row */}
                    <tr className="border-b border-zinc-100 dark:border-zinc-800">
                        <td className="sticky left-0 z-30 py-2 px-1 text-[10px] font-black text-zinc-900 dark:text-zinc-100 tracking-tighter bg-white dark:bg-zinc-900 text-left pl-6 uppercase leading-tight border-b border-zinc-100 dark:border-zinc-800 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)]">어프로치시도</td>
                        {holes.map((h, idx) => {
                            const isHighlighted = (fieldName && (h.summary as any)[fieldName] > 0) || focusHoles.includes(h.holeNumber);
                            return (
                                <td key={`app-${idx}`} className={cn(
                                    "py-2 px-0.5 sm:px-1 border-b border-zinc-100 dark:border-zinc-800 transition-colors text-[10px] sm:text-[11px]",
                                    isHighlighted ? "bg-orange-100 dark:bg-orange-900/40" : "bg-white dark:bg-zinc-950"
                                )}>
                                    {h.summary.approachAttemptDist || "-"}
                                </td>
                            );
                        })}
                        <td className="py-2 px-2 font-black border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-brand-navy pr-6">
                            {(() => {
                                const valid = holes.filter(h => h.summary.approachAttemptDist && h.summary.approachAttemptDist !== "-" && h.summary.approachAttemptDist !== "");
                                return valid.length > 0 ? Math.round(valid.reduce((s, h) => s + parseFloat(h.summary.approachAttemptDist as string), 0) / valid.length) : "-";
                            })()}
                        </td>
                    </tr>
                    {/* First Putt Row */}
                    <tr className="border-b border-zinc-50 dark:border-zinc-800/50 leading-tight">
                        <td className="sticky left-0 z-30 py-2 px-1 text-[10px] font-black text-zinc-900 dark:text-zinc-100 tracking-tighter bg-white dark:bg-zinc-900 text-left pl-6 uppercase leading-tight border-b border-zinc-50 dark:border-zinc-800/50 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)]">첫퍼트시도</td>
                        {holes.map((h, idx) => {
                            const isHighlighted = (fieldName && (h.summary as any)[fieldName] > 0) || focusHoles.includes(h.holeNumber);
                            return (
                                <td key={`putt1st-${idx}`} className={cn(
                                    "py-2 px-0.5 sm:px-1 border-b border-zinc-50 dark:border-zinc-800/50 transition-colors text-[10px] sm:text-[11px]",
                                    isHighlighted ? "bg-orange-100 dark:bg-orange-900/40" : "bg-white dark:bg-zinc-950"
                                )}>
                                    {h.summary.firstPuttAttemptDist || "-"}
                                </td>
                            );
                        })}
                        <td className="py-2 px-2 font-black border-b border-zinc-50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-800/50 text-brand-navy pr-6">
                            {(() => {
                                const valid = holes.filter(h => h.summary.firstPuttAttemptDist && h.summary.firstPuttAttemptDist !== "-" && h.summary.firstPuttAttemptDist !== "");
                                return valid.length > 0 ? (valid.reduce((s, h) => s + parseFloat(h.summary.firstPuttAttemptDist as string), 0) / valid.length).toFixed(1) : "-";
                            })()}
                        </td>
                    </tr>
                    {/* Putts Row */}
                    <tr className="border-b border-zinc-100 dark:border-zinc-800">
                        <td className="sticky left-0 z-30 py-2 px-1 text-[10px] font-black text-zinc-900 dark:text-zinc-100 tracking-tighter bg-white dark:bg-zinc-900 text-left pl-6 uppercase border-b border-zinc-100 dark:border-zinc-800 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)]">퍼터수</td>
                        {holes.map((h, idx) => {
                            const isHighlighted = (fieldName && (h.summary as any)[fieldName] > 0) || focusHoles.includes(h.holeNumber);
                            return (
                                <td key={`putts-${idx}`} className={cn(
                                    "py-2 px-1 font-black border-b border-zinc-100 dark:border-zinc-800 transition-colors",
                                    isHighlighted ? "bg-orange-100 dark:bg-orange-900/40" : "bg-white dark:bg-zinc-950"
                                )}>
                                    {h.summary.putts}
                                </td>
                            );
                        })}
                        <td className="py-2 px-2 font-black border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-brand-navy pr-6">{holes.reduce((s, h) => s + h.summary.putts, 0)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}
