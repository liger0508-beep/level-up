"use client";

import { useRouter } from "next/navigation";
import React from "react";
import { cn } from "@/lib/utils";

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
}

interface ScoreTableProps {
    scores: ScoreData[];
}

export function ScoreTable({ scores }: ScoreTableProps) {
    const router = useRouter();

    const getScoreColor = (score: number, holeCount: number = 18) => {
        const par = holeCount === 9 ? 36 : 72;
        if (score === par) return "text-zinc-900 dark:text-zinc-100";
        if (score < par) return "text-red-500 font-bold";
        return "text-blue-500 font-bold";
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
                            onClick={() => router.push(`/scores/${score.id}`)}
                            className={cn(
                                "w-full text-left bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-l-4 rounded-xl pl-3 pr-4 py-3.5 transition-all active:scale-[0.98] hover:shadow-md hover:-translate-y-px",
                                score.score < 72 ? "border-l-red-500" : score.score > 72 ? "border-l-blue-500" : "border-l-zinc-400"
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <div className="w-[85px] shrink-0 flex items-center justify-start pr-1">
                                        {score.isFinal === false ? (
                                            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 whitespace-nowrap min-w-[72px] justify-center">
                                                <span className="text-[14px] font-black text-zinc-900 dark:text-zinc-50">
                                                    {score.score}타
                                                </span>
                                                <span className="text-[10px] text-zinc-400 font-bold italic tracking-tighter">
                                                    {score.holeCount === 9 ? (
                                                        "(9H)"
                                                    ) : (score.completedHoles !== undefined && score.completedHoles > 0 && score.completedHoles < 18 ? (
                                                        `(${score.completedHoles}H)`
                                                    ) : "(18H)")}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className={cn("text-[14px] font-black flex items-center gap-1 pl-2", getScoreColor(score.score, score.holeCount))}>
                                                {score.score}타
                                                {score.holeCount === 9 && (
                                                    <span className="text-[10px] text-zinc-400 font-bold italic tracking-tighter">(9H)</span>
                                                )}
                                            </span>
                                        )}
                                    </div>
                                    <span className="mr-4 w-[1px] h-3 bg-zinc-200 dark:bg-zinc-700 shrink-0" />
                                    <span className="text-[14px] font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                        {score.playerName}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 pl-3 min-w-0">
                                    <span className="text-[11px] text-zinc-400 font-medium truncate max-w-[80px]">
                                        {score.courseName}
                                    </span>
                                    <span className="text-[12px] text-zinc-500 font-bold shrink-0">
                                        {score.date.slice(5).replace("-", ".")}
                                    </span>
                                </div>
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
                                    onClick={() => router.push(`/scores/${score.id}`)}
                                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer group"
                                >
                                    <td className="py-4 px-4 text-center text-zinc-400 dark:text-zinc-500 text-xs">
                                        {scores.length - idx}
                                    </td>
                                    <td className="py-4 px-4 text-center">
                                        {score.isFinal === false ? (
                                            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 whitespace-nowrap min-w-[70px] justify-center">
                                                <span className="text-[14px] font-black text-zinc-900 dark:text-zinc-50">
                                                    {score.score}타
                                                </span>
                                                <span className="text-[10px] text-zinc-400 font-bold italic tracking-tighter">
                                                    {score.holeCount === 9 ? (
                                                        "(9H)"
                                                    ) : (score.completedHoles !== undefined && score.completedHoles > 0 && score.completedHoles < 18 ? (
                                                        `(${score.completedHoles}H)`
                                                    ) : "(18H)")}
                                                </span>
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
        </>
    );
}
