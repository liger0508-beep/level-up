"use client";

import { useRouter } from "next/navigation";
import { Consultation } from "@/lib/consultation-sync";
import {
    CONSULTATION_CATEGORY_LABELS,
    CONSULTATION_CATEGORY_COLORS,
} from "@/lib/consultation-templates";
import { cn } from "@/lib/utils";
import { MessageSquare } from "lucide-react";

interface ConsultationTableProps {
    consultations: Consultation[];
    totalCount?: number;
}

export function ConsultationTable({ consultations, totalCount }: ConsultationTableProps) {
    const router = useRouter();

    return (
        <>
            {/* ── Mobile Card Grid (hidden on md+) ── */}
            <div className="flex flex-col gap-2.5 md:hidden">
                {consultations.map((item) => {
                    const cat = item.category || "general";
                    const cfg = CONSULTATION_CATEGORY_COLORS[cat];
                    const label = CONSULTATION_CATEGORY_LABELS[cat];
                    return (
                        <button
                            key={item.id}
                            onClick={() => router.push(`/consultations/${item.id}`)}
                            className="w-full text-left bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 py-4 px-6 shadow-sm hover:border-brand-navy/30 hover:shadow-md transition-all group"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", cfg.bg, cfg.text)}>
                                        <MessageSquare size={16} />
                                    </div>
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <span className="text-sm font-bold text-zinc-600 dark:text-zinc-300 truncate">
                                            {label}
                                        </span>
                                        {item.isImportant && (
                                            <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-md shrink-0">
                                                중요
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {item.targetMonth && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 shrink-0 mr-1">
                                        {item.targetMonth}
                                    </span>
                                )}
                            </div>

                            <div className="flex items-end justify-between mt-3 relative">
                                <span className="text-[11px] font-bold text-zinc-400 shrink-0 mb-0.5">
                                    {item.date.slice(5).replace(/-/g, ".")} <span className="opacity-40 font-normal mx-0.5">|</span> {item.author}
                                </span>
                                <span className="text-sm font-bold text-zinc-600 dark:text-zinc-300 truncate mr-2">
                                    {item.athleteName}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* ── Desktop Table (hidden on mobile) ── */}
            <div className="hidden md:block bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-zinc-50/50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700 text-left text-zinc-500 dark:text-zinc-400">
                                <th className="py-2.5 px-4 font-semibold text-center w-16">번호</th>
                                <th className="py-2.5 px-4 font-semibold text-center w-36">유형</th>
                                <th className="py-2.5 px-4 font-semibold text-center w-32">선수명</th>
                                <th className="py-2.5 px-4 font-semibold text-center w-24">작성자</th>
                                <th className="py-2.5 px-4 font-semibold text-center w-24">날짜</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {consultations.map((item, idx) => {
                                const cat = item.category || "general";
                                const cfg = CONSULTATION_CATEGORY_COLORS[cat];
                                const label = CONSULTATION_CATEGORY_LABELS[cat];
                                return (
                                    <tr
                                        key={item.id}
                                        onClick={() => router.push(`/consultations/${item.id}`)}
                                        className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                                    >
                                        <td className="py-3.5 px-4 text-center text-zinc-500 dark:text-zinc-500">
                                            {(totalCount ?? consultations.length) - idx}
                                        </td>
                                        <td className="py-3.5 px-4 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <span className={cn("text-[12px] font-semibold whitespace-nowrap", cfg.text)}>
                                                    {label}
                                                </span>
                                                {item.targetMonth && (
                                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                                                        {item.targetMonth}
                                                    </span>
                                                )}
                                                {item.isImportant && (
                                                    <span className="text-white bg-red-500 px-1.5 py-0.5 rounded-md text-[10px] font-bold">
                                                        중요
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-4 text-center">
                                            <span className="text-zinc-700 dark:text-zinc-300 font-bold truncate">
                                                {item.athleteName}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-4 text-center text-zinc-600 dark:text-zinc-400 truncate">
                                            {item.author}
                                        </td>
                                        <td className="py-3.5 px-4 text-center text-zinc-500 dark:text-zinc-500">
                                            {item.date.slice(5).replace(/-/g, ".")}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
