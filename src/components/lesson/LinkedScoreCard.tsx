"use client";

import React from "react";
import { BookOpen, Calendar, MapPin, Activity, Target, ChevronRight as ChevronRight2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionTitle } from "@/components/ui/Typography";

export interface LinkedScoreCardProps {
    recentScore: any | null;
    onMoreClick?: () => void;
}

export function LinkedScoreCard({ recentScore, onMoreClick }: LinkedScoreCardProps) {
    if (!recentScore) {
        return (
            <div className="text-sm text-zinc-400 py-8 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
                최근 라운드 정보가 없습니다.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-zinc-500 pl-[4px]">
                    <Calendar size={12} />
                    <span>{recentScore.date?.substring(5) || ""}</span>
                    <div className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600"></div>
                    <MapPin size={12} />
                    <span>{recentScore.courseName || ""}</span>
                </div>
            </div>

            {/* SCORE Banner */}
            {(() => {
                const scoreDiff = recentScore.score - (recentScore.totalPar || 72);
                const scoreDiffStr = scoreDiff > 0 ? `+${scoreDiff}` : scoreDiff === 0 ? "E" : `${scoreDiff}`;
                const isUnderPar = scoreDiff < 0;
                const isOverPar = scoreDiff > 0;
                const scoreBgClass = isUnderPar ? "bg-red-50 border-red-100" : isOverPar ? "bg-blue-50 border-blue-100" : "bg-zinc-100 border-zinc-200";
                const scoreTextClass = isUnderPar ? "text-red-500" : isOverPar ? "text-blue-500" : "text-zinc-900";

                return (
                    <section className={cn("border rounded-[3rem] p-6 sm:p-10 flex flex-col items-center justify-center relative overflow-hidden shadow-sm", scoreBgClass)}>
                        <div className={cn("absolute right-0 top-0 opacity-[0.03] pointer-events-none transform translate-x-1/4 -translate-y-1/4", scoreTextClass)}>
                            <Activity size={240} strokeWidth={1} />
                        </div>

                        <div className={cn("flex items-center gap-2 mb-2 font-bold text-sm tracking-widest relative z-10 uppercase self-start sm:self-center", scoreTextClass)}>
                            <Activity size={18} /> SCORE
                        </div>

                        <div className="flex flex-row items-baseline gap-1.5 sm:gap-2 relative z-10 text-brand-navy mt-1 sm:mt-2 whitespace-nowrap">
                            <div className="flex items-baseline gap-1.5 sm:gap-2">
                                <span className={cn("text-2xl font-black tracking-tighter", scoreTextClass)}>{recentScore.score}</span>
                                <span className={cn("text-lg font-bold", scoreTextClass)}>
                                    ({scoreDiffStr})
                                </span>
                            </div>
                            <span className="text-sm font-bold text-zinc-500 ml-1 sm:ml-2">/ par {recentScore.totalPar || 72}</span>
                        </div>
                    </section>
                );
            })()}

            {/* 부문별 스코어 */}
            {recentScore.sectorChanges && (
                <section className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 shadow-sm border border-zinc-200/60 dark:border-zinc-800/60">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400">
                                <Target size={18} />
                            </div>
                            <SectionTitle>부문별 스코어</SectionTitle>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {recentScore.sectorChanges.map((sc: any, idx: number) => {
                            const isPositive = parseFloat(sc.value) > 0;
                            return (
                                <div key={idx} className={cn(
                                    "p-3 sm:p-4 rounded-[1.5rem] sm:rounded-[2rem] border flex flex-col gap-2 sm:gap-3 transition-all",
                                    isPositive ? "bg-blue-50/30 border-blue-100" : "bg-red-50/30 border-red-100"
                                )}>
                                    <div className="flex flex-col">
                                        <p className="text-[13px] font-black text-zinc-400 uppercase tracking-tight">{sc.type}</p>
                                        <p className={cn("text-2xl font-black tracking-tighter text-right mt-1", isPositive ? "text-blue-500" : "text-red-500")}>
                                            {sc.value}
                                        </p>
                                    </div>
                                    <div className="space-y-1.5 pt-3 mt-1 border-t border-zinc-100/50">
                                        {sc.items.map((item: any, iIdx: number) => {
                                            const isItemPos = parseFloat(item.sg) > 0;
                                            return (
                                                <div key={iIdx} className="flex justify-between items-center text-[12px] sm:text-[13px] font-bold tracking-tight">
                                                    <span className="text-zinc-500 whitespace-nowrap">{item.name}</span>
                                                    <span className={isItemPos ? "text-blue-500" : "text-red-500"}>
                                                        {isItemPos ? "+" : ""}{item.sg.toFixed(1)}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}
        </div>
    );
}
