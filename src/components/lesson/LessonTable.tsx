"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { LessonData } from "./LessonCard";
import { cn } from "@/lib/utils";
import { BookOpen } from "lucide-react";

const typeConfig: Record<string, {
    label: string;
    accentBorder: string;
    dotColor: string;
    labelColor: string;
    iconColor: string;
    iconBg: string;
}> = {
    shot: { label: "Shot", accentBorder: "border-l-emerald-500", dotColor: "bg-emerald-500", labelColor: "text-emerald-700 dark:text-emerald-400", iconColor: "text-emerald-500", iconBg: "bg-emerald-50 dark:bg-emerald-500/10" },
    pitch: { label: "Pitch", accentBorder: "border-l-teal-500", dotColor: "bg-teal-500", labelColor: "text-teal-700 dark:text-teal-400", iconColor: "text-teal-500", iconBg: "bg-teal-50 dark:bg-teal-500/10" },
    bunker: { label: "Bunker", accentBorder: "border-l-orange-500", dotColor: "bg-orange-500", labelColor: "text-orange-700 dark:text-orange-400", iconColor: "text-orange-500", iconBg: "bg-orange-50 dark:bg-orange-500/10" },
    approach: { label: "Approach", accentBorder: "border-l-sky-500", dotColor: "bg-sky-500", labelColor: "text-sky-700 dark:text-sky-400", iconColor: "text-sky-500", iconBg: "bg-sky-50 dark:bg-sky-500/10" },
    putt: { label: "Putt", accentBorder: "border-l-blue-500", dotColor: "bg-blue-500", labelColor: "text-blue-700 dark:text-blue-400", iconColor: "text-blue-500", iconBg: "bg-blue-50 dark:bg-blue-500/10" },
    physical: { label: "Physical", accentBorder: "border-l-amber-500", dotColor: "bg-amber-500", labelColor: "text-amber-700 dark:text-amber-400", iconColor: "text-amber-500", iconBg: "bg-amber-50 dark:bg-amber-500/10" },
    etc: { label: "Etc", accentBorder: "border-l-zinc-500", dotColor: "bg-zinc-500", labelColor: "text-zinc-700 dark:text-zinc-400", iconColor: "text-zinc-500", iconBg: "bg-zinc-50 dark:bg-zinc-500/10" },
    field: { label: "Field", accentBorder: "border-l-violet-500", dotColor: "bg-violet-500", labelColor: "text-violet-700 dark:text-violet-400", iconColor: "text-violet-500", iconBg: "bg-violet-50 dark:bg-violet-500/10" },
};

interface LessonTableProps {
    lessons: LessonData[];
    totalCount?: number;
    viewMode?: "list" | "content";
    userRole?: string | null;
    basePath?: string;
}

export function LessonTable({ lessons, totalCount, viewMode = "list", userRole, basePath = "/lessons" }: LessonTableProps) {
    const router = useRouter();

    const handleRowClick = (id: string) => {
        const prefix = basePath === "/analysis" ? "gla_analysis" : "gla_lessons";
        sessionStorage.setItem(`${prefix}_keep_alive`, "true");
        sessionStorage.setItem(`${prefix}_scroll`, window.scrollY.toString());
        router.push(`${basePath}/${id}`);
    };

    return (
        <>
            {/* ── Mobile Card Grid (hidden on md+) ── */}
            <div className="flex flex-col gap-2.5 md:hidden">
                {lessons.map((lesson) => {
                    const cfg = typeConfig[lesson.type] || typeConfig.etc;
                    return (
                        <button
                            key={lesson.id}
                            onClick={() => handleRowClick(lesson.id)}
                            className="w-full text-left bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 py-4 px-6 shadow-sm hover:border-brand-navy/30 hover:shadow-md transition-all group"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", cfg.iconBg, cfg.iconColor)}>
                                        <BookOpen size={16} />
                                    </div>
                                    <div className="flex items-center gap-1 min-w-0">
                                        {lesson.title?.includes("[기본기]") && <span className="text-[12px] font-black text-brand-red shrink-0">기본기</span>}
                                        {lesson.title?.includes("[예습]") && <span className="text-[12px] font-black text-brand-navy shrink-0">예습</span>}
                                        {lesson.title?.includes("[복습]") && <span className="text-[12px] font-black text-zinc-500 shrink-0">복습</span>}
                                        <span className="text-sm font-bold text-zinc-600 dark:text-zinc-300 truncate">{cfg.label}</span>

                                        {lesson.is_core_lesson && <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-md shrink-0 ml-1">핵심</span>}
                                    </div>
                                </div>
                            </div>

                            {viewMode === "content" ? (
                                <div className="flex gap-2 mt-3 items-start relative">
                                    <span className="flex-1 text-[12px] font-medium text-zinc-600 dark:text-zinc-300 line-clamp-2 leading-snug pr-8 text-left">
                                        {lesson.comment || "내용 없음"}
                                    </span>
                                    <span className="text-sm font-bold text-zinc-600 dark:text-zinc-300 shrink-0 mr-2 mt-auto">
                                        {lesson.playerName}
                                    </span>
                                </div>
                            ) : (
                                <div className="flex items-end justify-between mt-3 relative">
                                    <span className="text-[11px] font-bold text-zinc-400 shrink-0 mb-0.5">
                                        {lesson.date.slice(5).replace("-", ".")} <span className="opacity-40 font-normal mx-0.5">|</span> {lesson.coachName}
                                    </span>
                                    <span className="text-sm font-bold text-zinc-600 dark:text-zinc-300 truncate mr-2">
                                        {lesson.playerName}
                                    </span>
                                </div>
                            )}
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
                            const cfg = typeConfig[lesson.type] || typeConfig.etc;
                            return (
                                <tr
                                    key={lesson.id}
                                    onClick={() => handleRowClick(lesson.id)}
                                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                                >
                                    <td className="py-3.5 px-4 text-center text-zinc-500 dark:text-zinc-500">
                                        {(totalCount ?? lessons.length) - idx}
                                    </td>
                                    <td className="py-3.5 px-4 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="flex flex-col items-center leading-tight">
                                                {lesson.title?.includes("[기본기]") && <span className="text-[12px] font-black text-brand-red">기본기</span>}
                                                {lesson.title?.includes("[예습]") && <span className="text-[12px] font-black text-brand-navy">예습</span>}
                                                {lesson.title?.includes("[복습]") && <span className="text-[12px] font-black text-zinc-500">복습</span>}
                                                <span className={cn("text-[12px] font-semibold flex items-center gap-1 whitespace-nowrap", cfg.labelColor)}>
                                                    {cfg.label}

                                                    {lesson.is_core_lesson && (
                                                        <span className="text-white bg-red-500 px-1.5 py-0.5 rounded-md ml-1 text-[10px] font-bold">
                                                            핵심
                                                        </span>
                                                    )}
                                                </span>
                                            </div>
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
