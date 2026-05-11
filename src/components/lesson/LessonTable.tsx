"use client";

import { useRouter } from "next/navigation";
import { LessonData, LessonType } from "./LessonCard";
import { cn } from "@/lib/utils";

const typeConfig: Record<string, {
    label: string;
    accentBorder: string;
    dotColor: string;
    labelColor: string;
}> = {
    shot: { label: "Shot", accentBorder: "border-l-emerald-500", dotColor: "bg-emerald-500", labelColor: "text-emerald-700 dark:text-emerald-400" },
    pitch: { label: "Pitch", accentBorder: "border-l-teal-500", dotColor: "bg-teal-500", labelColor: "text-teal-700 dark:text-teal-400" },
    bunker: { label: "Bunker", accentBorder: "border-l-orange-500", dotColor: "bg-orange-500", labelColor: "text-orange-700 dark:text-orange-400" },
    approach: { label: "Approach", accentBorder: "border-l-sky-500", dotColor: "bg-sky-500", labelColor: "text-sky-700 dark:text-sky-400" },
    putt: { label: "Putt", accentBorder: "border-l-blue-500", dotColor: "bg-blue-500", labelColor: "text-blue-700 dark:text-blue-400" },
    physical: { label: "Physical", accentBorder: "border-l-amber-500", dotColor: "bg-amber-500", labelColor: "text-amber-700 dark:text-amber-400" },
    etc: { label: "Etc", accentBorder: "border-l-zinc-500", dotColor: "bg-zinc-500", labelColor: "text-zinc-700 dark:text-zinc-400" },
    field: { label: "Field", accentBorder: "border-l-violet-500", dotColor: "bg-violet-500", labelColor: "text-violet-700 dark:text-violet-400" },
};

interface LessonTableProps {
    lessons: LessonData[];
}

export function LessonTable({ lessons }: LessonTableProps) {
    const router = useRouter();

    return (
        <>
            {/* ── Mobile Card Grid (hidden on md+) ── */}
            <div className="flex flex-col gap-2.5 md:hidden">
                {lessons.map((lesson) => {
                    const cfg = typeConfig[lesson.type];
                    return (
                        <button
                            key={lesson.id}
                            onClick={() => router.push(`/lessons/${lesson.id}`)}
                            className={cn(
                                "w-full text-left bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-l-4 rounded-xl px-4 py-3.5 transition-all active:scale-[0.98] hover:shadow-md hover:-translate-y-px",
                                cfg.accentBorder
                            )}
                        >
                            {/* Single row: dot + type label + player name | date + coach */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <span className={cn("w-2 h-2 rounded-full shrink-0", cfg.dotColor)} />
                                    <span className={cn("w-[5.5rem] text-[11px] font-bold uppercase tracking-widest shrink-0", cfg.labelColor)}>
                                        {cfg.label}
                                    </span>
                                    <span className="mr-1.5 w-[1px] h-3 bg-zinc-200 dark:bg-zinc-700 shrink-0" />
                                    <div className="flex items-center min-w-0">
                                        <div className="flex items-center shrink-0">
                                            {lesson.title?.includes("[기본기]") && <span className="text-[13px] font-black text-brand-red mr-1.5">기본기 |</span>}
                                            {lesson.title?.includes("[예습]") && <span className="text-[13px] font-black text-brand-navy mr-1.5">예습 |</span>}
                                            {lesson.title?.includes("[복습]") && <span className="text-[13px] font-black text-zinc-500 mr-1.5">복습 |</span>}
                                        </div>
                                        <span className="text-[14px] font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                            {lesson.playerName}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-0.5 shrink-0 pl-3">
                                    <span className="text-[11px] text-zinc-400 font-medium">
                                        {lesson.date.slice(5).replace("-", ".")}
                                    </span>
                                    <span className="text-[12px] text-zinc-600 dark:text-zinc-300 font-semibold">
                                        {lesson.coachName}
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
                            <th className="py-2.5 px-4 font-semibold text-center w-32">유형</th>
                            <th className="py-2.5 px-4 font-semibold text-center w-32">선수명</th>
                            <th className="py-2.5 px-4 font-semibold text-center w-24">작성자</th>
                            <th className="py-2.5 px-4 font-semibold text-center w-24">날짜</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {lessons.map((lesson, idx) => {
                            const cfg = typeConfig[lesson.type];
                            return (
                                <tr
                                    key={lesson.id}
                                    onClick={() => router.push(`/lessons/${lesson.id}`)}
                                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                                >
                                    <td className="py-3.5 px-4 text-center text-zinc-500 dark:text-zinc-500">
                                        {lessons.length - idx}
                                    </td>
                                    <td className="py-3.5 px-4 text-center">
                                        <div className="flex flex-col items-center leading-tight">
                                            {lesson.title?.includes("[기본기]") && <span className="text-[12px] font-black text-brand-red">기본기</span>}
                                            {lesson.title?.includes("[예습]") && <span className="text-[12px] font-black text-brand-navy">예습</span>}
                                            {lesson.title?.includes("[복습]") && <span className="text-[12px] font-black text-zinc-500">복습</span>}
                                            <span className={cn("text-[12px] font-semibold", cfg.labelColor)}>
                                                {cfg.label}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="py-3.5 px-4 text-center">
                                        <span className="text-zinc-700 dark:text-zinc-300 font-bold truncate">
                                            {lesson.playerName}
                                        </span>
                                    </td>
                                    <td className="py-3.5 px-4 text-center text-zinc-600 dark:text-zinc-400 truncate">
                                        {lesson.coachName}
                                    </td>
                                    <td className="py-3.5 px-4 text-center text-zinc-500 dark:text-zinc-500">
                                        {lesson.date.slice(5).replace("-", ".")}
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
