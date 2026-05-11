"use client";

import { useRouter } from "next/navigation";
import { AnalysisData, AnalysisType } from "./AnalysisCard";
import { cn } from "@/lib/utils";

const typeConfig: Record<AnalysisType, {
    label: string;
    accentBorder: string;
    dotColor: string;
    labelColor: string;
}> = {
    shot: { label: "Shot", accentBorder: "border-l-emerald-500", dotColor: "bg-emerald-500", labelColor: "text-emerald-700 dark:text-emerald-400" },
    short_game: { label: "Short Game", accentBorder: "border-l-cyan-500", dotColor: "bg-cyan-500", labelColor: "text-cyan-700 dark:text-cyan-400" },
    physical: { label: "Physical", accentBorder: "border-l-amber-500", dotColor: "bg-amber-500", labelColor: "text-amber-700 dark:text-amber-400" },
    etc: { label: "Etc", accentBorder: "border-l-zinc-500", dotColor: "bg-zinc-500", labelColor: "text-zinc-700 dark:text-zinc-400" },
};

interface AnalysisTableProps {
    analyses: AnalysisData[];
}

export function AnalysisTable({ analyses }: AnalysisTableProps) {
    const router = useRouter();

    return (
        <>
            {/* ── Mobile Card Grid (hidden on md+) ── */}
            <div className="flex flex-col gap-2.5 md:hidden">
                {analyses.map((analysis) => {
                    const cfg = typeConfig[analysis.type] || typeConfig.etc;
                    return (
                        <button
                            key={analysis.id}
                            onClick={() => router.push(`/analysis/${analysis.id}`)}
                            className={cn(
                                "w-full text-left bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-l-4 rounded-xl px-4 py-3.5 transition-all active:scale-[0.98] hover:shadow-md hover:-translate-y-px",
                                cfg.accentBorder
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <span className={cn("w-2 h-2 rounded-full shrink-0", cfg.dotColor)} />
                                    <span className={cn("w-[5.5rem] text-[11px] font-bold uppercase tracking-widest shrink-0", cfg.labelColor)}>
                                        {cfg.label}
                                    </span>
                                    <span className="mr-1.5 w-[1px] h-3 bg-zinc-200 dark:bg-zinc-700 shrink-0" />
                                    <span className="text-[14px] font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                        {analysis.playerName}
                                    </span>
                                </div>
                                <div className="flex flex-col items-end gap-0.5 shrink-0 pl-3">
                                    <span className="text-[11px] text-zinc-400 font-medium">
                                        {analysis.date.slice(5).replace("-", ".")}
                                    </span>
                                    <span className="text-[12px] text-zinc-600 dark:text-zinc-300 font-semibold">
                                        {analysis.coachName}
                                    </span>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* ── Desktop Table (hidden on mobile) ── */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-zinc-50/50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700 text-left text-zinc-500 dark:text-zinc-400">
                            <th className="py-2.5 px-4 font-semibold text-center w-16">번호</th>
                            <th className="py-2.5 px-4 font-semibold text-center w-24">유형</th>
                            <th className="py-2.5 px-4 font-semibold text-center w-32">선수명</th>
                            <th className="py-2.5 px-4 font-semibold text-center w-24">작성자</th>
                            <th className="py-2.5 px-4 font-semibold text-center w-24">날짜</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {analyses.map((analysis, idx) => {
                            const cfg = typeConfig[analysis.type] || typeConfig.etc;
                            return (
                                <tr
                                    key={analysis.id}
                                    onClick={() => router.push(`/analysis/${analysis.id}`)}
                                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                                >
                                    <td className="py-3.5 px-4 text-center text-zinc-500 dark:text-zinc-500">
                                        {analyses.length - idx}
                                    </td>
                                    <td className="py-3.5 px-4 text-center">
                                        <span className={cn("text-[12px] font-semibold", cfg.labelColor)}>
                                            {cfg.label}
                                        </span>
                                    </td>
                                    <td className="py-3.5 px-4 text-center">
                                        <span className="text-zinc-700 dark:text-zinc-300 font-bold truncate">
                                            {analysis.playerName}
                                        </span>
                                    </td>
                                    <td className="py-3.5 px-4 text-center text-zinc-600 dark:text-zinc-400 truncate">
                                        {analysis.coachName}
                                    </td>
                                    <td className="py-3.5 px-4 text-center text-zinc-500 dark:text-zinc-500">
                                        {analysis.date.slice(5).replace("-", ".")}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </>
    );
}
