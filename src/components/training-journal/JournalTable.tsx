"use client";

import { useRouter } from "next/navigation";
import { Journal, JournalType, JOURNAL_TYPE_LABELS, getPlainText } from "@/lib/journal-sync";
import { cn } from "@/lib/utils";
import { Paperclip, BookOpen } from "lucide-react";

const typeConfig: Record<JournalType, {
    accentBorder: string;
    dotColor: string;
    labelColor: string;
    iconBg: string;
    iconColor: string;
}> = {
    all: { accentBorder: "border-l-indigo-400", dotColor: "bg-indigo-400", labelColor: "text-indigo-600 dark:text-indigo-400", iconBg: "bg-indigo-50 dark:bg-indigo-500/10", iconColor: "text-indigo-500" },
    good: { accentBorder: "border-l-emerald-500", dotColor: "bg-emerald-500", labelColor: "text-emerald-700 dark:text-emerald-400", iconBg: "bg-emerald-50 dark:bg-emerald-500/10", iconColor: "text-emerald-500" },
    miss: { accentBorder: "border-l-rose-500", dotColor: "bg-rose-500", labelColor: "text-rose-700 dark:text-rose-400", iconBg: "bg-rose-50 dark:bg-rose-500/10", iconColor: "text-rose-500" },
    field: { accentBorder: "border-l-indigo-500", dotColor: "bg-indigo-500", labelColor: "text-indigo-700 dark:text-indigo-400", iconBg: "bg-indigo-50 dark:bg-indigo-500/10", iconColor: "text-indigo-500" },
};

function getConfig(type: JournalType) {
    return typeConfig[type] || typeConfig.all;
}

interface JournalTableProps {
    journals: Journal[];
    viewMode?: "list" | "content";
}

export function JournalTable({ journals, viewMode = "list" }: JournalTableProps) {
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
                            onClick={() => {
                                sessionStorage.setItem("gla_journal_keep_alive", "true");
                                router.push(journal.type === 'field' ? `/scores/field-notes/${journal.id}` : `/admin/training-journal/${journal.id}`);
                            }}
                            className="w-full text-left bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 py-4 px-6 shadow-sm hover:border-brand-navy/30 hover:shadow-md transition-all group"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", cfg.iconBg, cfg.iconColor)}>
                                        <BookOpen size={16} />
                                    </div>
                                    <div className="flex flex-col items-start min-w-0">
                                        <div className="flex items-center gap-1">
                                            <span className="text-sm font-bold text-zinc-600 dark:text-zinc-300 truncate">{label}</span>
                                            {journal.isImportant && (
                                                <span className="shrink-0 text-[10px] font-bold text-red-500 border border-red-200 px-1.5 py-0.5 rounded-md bg-red-50 ml-1">중요</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {viewMode === "content" ? (
                                <div className="flex gap-2 mt-3 items-start relative">
                                    <div className="w-8 shrink-0 flex justify-center mt-0.5"></div>
                                    <span className="flex-1 text-[12px] font-medium text-zinc-600 dark:text-zinc-300 line-clamp-2 leading-snug pr-8 text-left">
                                        {journal.content ? getPlainText(journal.content) : "내용 없음"}
                                    </span>
                                    <span className="text-sm font-bold text-zinc-600 dark:text-zinc-300 shrink-0 mr-2 mt-auto">
                                        {journal.athleteName}
                                    </span>
                                </div>
                            ) : (
                                <div className="flex items-end justify-between mt-3 relative">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 shrink-0 flex justify-center"></div>
                                        <div className="flex items-center gap-1">
                                            {journal.media_urls && journal.media_urls.length > 0 && (
                                                <Paperclip size={12} className="text-brand-navy shrink-0" />
                                            )}
                                            <span className="text-[11px] font-bold text-zinc-400 shrink-0 mb-0.5">
                                                {journal.date.slice(5).replace("-", ".")} <span className="opacity-40 font-normal mx-0.5">|</span> {journal.author}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="text-sm font-bold text-zinc-600 dark:text-zinc-300 truncate mr-2">
                                        {journal.athleteName}
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
                                    onClick={() => {
                                        sessionStorage.setItem("gla_journal_keep_alive", "true");
                                        router.push(journal.type === 'field' ? `/scores/field-notes/${journal.id}` : `/admin/training-journal/${journal.id}`);
                                    }}
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
