"use client";

import { useRouter } from "next/navigation";
import React from "react";
import { cn } from "@/lib/utils";
import { Trophy, Flag, ArrowRight } from "lucide-react";

export interface ScoreData {
    id: string;
    score: number;
    title: string;
    playerName: string;
    coachName: string;
    courseName: string;
    comment: string;
    date: string;
    completedHoles?: number;
    holeCount?: number;
    isFinal?: boolean;
    relativeScore?: number;
    createdAt?: string;
}

interface ScoreTableProps {
    scores: ScoreData[];
    totalCount?: number;
}

export function ScoreTable({ scores, totalCount }: ScoreTableProps) {
    const router = useRouter();
    const [selectedDraftScore, setSelectedDraftScore] = React.useState<ScoreData | null>(null);

    const getScoreColor = (score: number, holeCount: number = 18) => {
        const par = holeCount === 9 ? 36 : 72;
        if (score === par) return "text-zinc-900 dark:text-zinc-100";
        if (score < par) return "text-red-500 font-bold";
        return "text-blue-500 font-bold";
    };

    const getIconColor = (score: number, holeCount: number = 18, isFinal: boolean = true) => {
        if (!isFinal) return "bg-zinc-50 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400";
        const par = holeCount === 9 ? 36 : 72;
        if (score === par) return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
        if (score < par) return "bg-red-50 text-red-500 dark:bg-red-500/10";
        return "bg-blue-50 text-blue-500 dark:bg-blue-500/10";
    };

    return (
        <>
            {/* ── Mobile Card Grid (hidden on md+) ── */}
            <div className="flex flex-col gap-2.5 md:hidden">
                {scores.map((score, idx) => {
                    const prevDate = idx > 0 ? scores[idx - 1].date : null;
                    const showSeparator = prevDate && prevDate !== score.date;

                    return (
                        <React.Fragment key={score.id}>
                            {showSeparator && (
                                <div className="w-full flex items-center justify-center py-2">
                                    <div className="h-px flex-1 bg-zinc-100 dark:bg-zinc-800/80"></div>
                                    <span className="px-3 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 tracking-widest">{score.date.slice(5).replace('-', '/')}</span>
                                    <div className="h-px flex-1 bg-zinc-100 dark:bg-zinc-800/80"></div>
                                </div>
                            )}
                        <button
                            onClick={() => {
                                if (score.isFinal === false) {
                                    setSelectedDraftScore(score);
                                } else {
                                    sessionStorage.setItem("gla_scores_keep_alive", "true");
                                    router.push(`/scores/${score.id}`);
                                }
                            }}
                            className={cn(
                                "w-full text-left rounded-[2.5rem] border py-4 px-6 transition-all active:scale-[0.98] hover:shadow-md",
                                score.isFinal === false 
                                    ? "bg-zinc-100 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-800" 
                                    : "bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 shadow-sm hover:border-brand-navy/30"
                            )}
                        >
                            <div className="flex items-center gap-2">
                                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", getIconColor(score.score, score.holeCount, score.isFinal))}>
                                    <Flag size={16} />
                                </div>
                                <span className="text-sm font-bold text-zinc-600 dark:text-zinc-300 truncate">
                                    {score.playerName}
                                </span>
                            </div>

                            <div className="flex items-end justify-between mt-3">
                                <span className="text-[11px] font-bold text-zinc-400 shrink-0 mb-1 pl-[40px]">
                                    {score.date.slice(5).replace("-", ".")} <span className="opacity-40 font-normal mx-0.5">|</span> {score.courseName} <span className="ml-1 tracking-tighter">({score.holeCount === 9 ? "9H" : (score.completedHoles !== undefined && score.completedHoles > 0 && score.completedHoles < 18 ? `${score.completedHoles}H` : "18H")})</span>
                                </span>
                                
                                {score.isFinal === false ? (
                                    <div className="flex items-center gap-1 mr-2">
                                        <span className="text-[18px] font-black text-zinc-700 dark:text-zinc-300">
                                            {score.relativeScore !== undefined ? (score.relativeScore > 0 ? `+${score.relativeScore}` : score.relativeScore === 0 ? "E" : score.relativeScore) : `${score.score}타`}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1 mr-2">
                                        <span className={cn("text-[18px] font-black", getScoreColor(score.score, score.holeCount))}>
                                            {score.score}타
                                        </span>
                                    </div>
                                )}
                            </div>
                        </button>
                        </React.Fragment>
                    );
                })}
            </div>

            {/* ── Desktop Table (hidden on mobile) ── */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm border-separate border-spacing-0">
                    <thead>
                        <tr className="bg-zinc-50/50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400">
                            <th className="py-3 px-4 font-semibold text-center w-[8%] border-b border-zinc-200 dark:border-zinc-700">번호</th>
                            <th className="py-3 px-4 font-semibold text-center w-[12%] border-b border-zinc-200 dark:border-zinc-700">스코어</th>
                            <th className="py-3 px-4 font-semibold text-center w-[30%] border-b border-zinc-200 dark:border-zinc-700">선수명</th>
                            <th className="py-3 px-4 font-semibold text-center w-[35%] border-b border-zinc-200 dark:border-zinc-700">골프장</th>
                            <th className="py-3 px-4 font-semibold text-center w-[15%] border-b border-zinc-200 dark:border-zinc-700">날짜</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {scores.map((score, idx) => {
                            const prevDate = idx > 0 ? scores[idx - 1].date : null;
                            const showSeparator = prevDate && prevDate !== score.date;

                            return (
                                <React.Fragment key={score.id}>
                                    {showSeparator && (
                                        <tr><td colSpan={6} className="py-1"><div className="w-full h-px bg-zinc-200 dark:bg-zinc-700/50"></div></td></tr>
                                    )}
                                <tr
                                    onClick={() => {
                                        if (score.isFinal === false) {
                                            setSelectedDraftScore(score);
                                        } else {
                                            sessionStorage.setItem("gla_scores_keep_alive", "true");
                                            router.push(`/scores/${score.id}`);
                                        }
                                    }}
                                    className={cn(
                                        "transition-colors cursor-pointer group",
                                        score.isFinal === false ? "bg-zinc-100 dark:bg-zinc-800/50 hover:bg-zinc-200/50 dark:hover:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                                    )}
                                >
                                    <td className="py-4 px-4 text-center text-zinc-400 dark:text-zinc-500 text-xs">
                                        {(totalCount ?? scores.length) - idx}
                                    </td>
                                    <td className="py-4 px-4 text-center">
                                        {score.isFinal === false ? (
                                            <div className="inline-flex flex-col items-center gap-0.5">

                                                <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 whitespace-nowrap min-w-[70px] justify-center">
                                                    <span className="text-[14px] font-black text-zinc-900 dark:text-zinc-50">
                                                        {score.relativeScore !== undefined ? (score.relativeScore > 0 ? `+${score.relativeScore}` : score.relativeScore === 0 ? "E" : score.relativeScore) : `${score.score}타`}
                                                    </span>
                                                    <span className="text-[10px] text-zinc-400 font-bold italic tracking-tighter">
                                                        {score.holeCount === 9 ? (
                                                            "(9H)"
                                                        ) : (score.completedHoles !== undefined && score.completedHoles > 0 && score.completedHoles < 18 ? (
                                                            `(${score.completedHoles}H)`
                                                        ) : "(18H)")}
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <span className={cn("text-[14px] font-bold", getScoreColor(score.score, score.holeCount))}>
                                                {score.score}타
                                                {score.holeCount === 9 && (
                                                    <span className="ml-1 text-[11px] text-zinc-400 font-bold italic tracking-tighter">(9H)</span>
                                                )}
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-4 px-4 text-center">
                                        <span className="text-zinc-900 dark:text-zinc-100 font-bold">
                                            {score.playerName}
                                        </span>
                                    </td>
                                    <td className="py-4 px-4 text-center">
                                        <span className="text-zinc-600 dark:text-zinc-400 font-medium">
                                            {score.courseName}
                                        </span>
                                    </td>
                                    <td className="py-4 px-4 text-center text-zinc-500 dark:text-zinc-500 font-medium">
                                        {score.date.slice(5).replace("-", ".")}
                                    </td>
                                </tr>
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {selectedDraftScore && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedDraftScore(null)}>
                    <div className="bg-white dark:bg-zinc-900 rounded-[2rem] shadow-xl overflow-hidden w-full max-w-sm flex border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <button 
                            onClick={() => {
                                sessionStorage.setItem("gla_scores_keep_alive", "true");
                                router.push(`/scores/${selectedDraftScore.id}`);
                                setSelectedDraftScore(null);
                            }}
                            className="flex-1 py-5 px-6 flex flex-col items-center justify-center border-r border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group"
                        >
                            <span className="text-[15px] font-bold text-zinc-800 dark:text-zinc-200 text-center leading-relaxed">
                                중간점수<br />확인하기
                            </span>
                            <div className="mt-6 self-end w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-sm group-hover:bg-blue-700 transition-colors">
                                <ArrowRight size={16} strokeWidth={3} />
                            </div>
                        </button>
                        <button
                            onClick={() => {
                                sessionStorage.setItem("gla_scores_keep_alive", "true");
                                router.push(`/scores/create?id=${selectedDraftScore.id}`);
                                setSelectedDraftScore(null);
                            }}
                            className="flex-1 py-5 px-6 flex flex-col items-center justify-center hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group"
                        >
                            <span className="text-[15px] font-bold text-zinc-800 dark:text-zinc-200 text-center leading-relaxed">
                                이어서<br />작성하기
                            </span>
                            <div className="mt-6 self-end w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center shadow-sm group-hover:bg-red-600 transition-colors">
                                <ArrowRight size={16} strokeWidth={3} />
                            </div>
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
