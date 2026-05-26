"use client";

import { useRouter } from "next/navigation";
import { Journal, JournalType, JOURNAL_TYPE_LABELS } from "@/lib/journal-sync";
import { cn } from "@/lib/utils";
import { Paperclip } from "lucide-react";

const typeConfig: Record<JournalType, {
    accentBorder: string;
    dotColor: string;
    labelColor: string;
}> = {
    all: { accentBorder: "border-l-indigo-400", dotColor: "bg-indigo-400", labelColor: "text-indigo-600 dark:text-indigo-400" },
    good: { accentBorder: "border-l-emerald-500", dotColor: "bg-emerald-500", labelColor: "text-emerald-700 dark:text-emerald-400" },
    miss: { accentBorder: "border-l-rose-500", dotColor: "bg-rose-500", labelColor: "text-rose-700 dark:text-rose-400" },
    field: { accentBorder: "border-l-indigo-500", dotColor: "bg-indigo-500", labelColor: "text-indigo-700 dark:text-indigo-400" },
};

function getConfig(type: JournalType) {
    return typeConfig[type] || typeConfig.all;
}

interface JournalTableProps {
    journals: Journal[];
}

export function JournalTable({ journals }: JournalTableProps) {
    const router = useRouter();

    return (
        <>
            {/* ── Mobile Card Grid (hidden on md+) ── */}
            <div className="flex flex-col gap-2.5 md:hidden">
                {journals.map((journal) => {
                    const cfg = getConfig(journal.type);
                    const label = JOURNAL_TYPE_LABELS[journal.type];
                    return (
                        <button
                            key={journal.id}
                            onClick={() => router.push(`/admin/training-journal/${journal.id}`)}
                            className={cn(
                                "w-full text-left bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-l-4 rounded-xl px-4 py-5 transition-all active:scale-[0.98] hover:shadow-md hover:-translate-y-px",
                                cfg.accentBorder
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <span className={cn("w-2 h-2 rounded-full shrink-0", cfg.dotColor)} />
                                    <span className={cn("w-[3.8rem] text-[11px] font-bold uppercase tracking-widest shrink-0", cfg.labelColor)}>
                                        {label}
                                    </span>
                                    <span className="mr-1.5 w-[1px] h-3 bg-zinc-200 dark:bg-zinc-700 shrink-0" />
                                    <span className="text-[14px] font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                        {journal.athleteName}
                                        {journal.type === 'field' && journal.fieldScore !== undefined && (
                                            <span className="ml-1.5 text-[11px] font-medium font-normal">
                                                (
                                                <span className={cn(
                                                    journal.fieldScore - (journal.fieldHoleCount === 9 ? 36 : 72) < 0 ? "text-red-500 font-bold" :
                                                    journal.fieldScore - (journal.fieldHoleCount === 9 ? 36 : 72) > 0 ? "text-blue-500 font-bold" : "text-zinc-900 dark:text-zinc-100 font-bold"
                                                )}>
                                                    {journal.fieldScore}타
                                                </span>
                                                <span className="text-zinc-400"> • </span>
                                                <span className="text-zinc-900 dark:text-zinc-100">{journal.fieldCourse}</span>
                                                )
                                            </span>
                                        )}
                                    </span>
                                    {journal.isImportant && (
                                        <span className="ml-1.5 shrink-0 text-[10px] font-bold text-red-500 border border-red-200 px-1 py-0.5 rounded bg-red-50">중요</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-0.5 shrink-0 pl-3">
                                    {journal.media_urls && journal.media_urls.length > 0 && (
                                        <Paperclip size={12} className="text-brand-navy mr-0.5" />
                                    )}
                                    <span className="text-[11px] text-zinc-400 font-medium">
                                        {journal.date.slice(5).replace("-", ".")}
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
                            <th className="py-2.5 px-4 font-semibold text-center w-24">날짜</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {journals.map((journal, idx) => {
                            const cfg = getConfig(journal.type);
                            const label = JOURNAL_TYPE_LABELS[journal.type];
                            return (
                                <tr
                                    key={journal.id}
                                    onClick={() => router.push(`/admin/training-journal/${journal.id}`)}
                                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                                >
                                    <td className="py-3.5 px-4 text-center text-zinc-500 dark:text-zinc-500">
                                        {journals.length - idx}
                                    </td>
                                    <td className="py-3.5 px-4 text-center">
                                        <span className={cn("text-[12px] font-semibold", cfg.labelColor)}>
                                            {label}
                                        </span>
                                    </td>
                                    <td className="py-3.5 px-4 text-center">
                                        <span className="text-zinc-700 dark:text-zinc-300 font-bold truncate">
                                            {journal.athleteName}
                                            {journal.type === 'field' && journal.fieldScore !== undefined && (
                                                <span className="ml-1.5 text-[11px] font-medium font-normal">
                                                    (
                                                    <span className={cn(
                                                        journal.fieldScore - (journal.fieldHoleCount === 9 ? 36 : 72) < 0 ? "text-red-500 font-bold" :
                                                        journal.fieldScore - (journal.fieldHoleCount === 9 ? 36 : 72) > 0 ? "text-blue-500 font-bold" : "text-zinc-900 dark:text-zinc-100 font-bold"
                                                    )}>
                                                        {journal.fieldScore}타
                                                    </span>
                                                    <span className="text-zinc-400"> • </span>
                                                    <span className="text-zinc-900 dark:text-zinc-100">{journal.fieldCourse}</span>
                                                    )
                                                </span>
                                            )}
                                        </span>
                                    </td>
                                    <td className="py-3.5 px-4 text-center text-zinc-500 dark:text-zinc-500">
                                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
                                            <div className="flex justify-end">
                                                {journal.media_urls && journal.media_urls.length > 0 && (
                                                    <Paperclip size={14} className="text-brand-navy" />
                                                )}
                                            </div>
                                            <span className="text-center">{journal.date.slice(5).replace("-", ".")}</span>
                                            <div></div>
                                        </div>
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
