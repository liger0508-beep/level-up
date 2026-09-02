"use client";

import React, { useState } from "react";
import { Search, X } from "lucide-react";
import { CategoryTabs } from "@/components/ui/CategoryTabs";
import { cn } from "@/lib/utils";
import { Journal, JournalType, JOURNAL_TYPE_LABELS, JOURNAL_TYPE_COLORS } from "@/lib/journal-sync";

const partOptions: { key: JournalType; label: string }[] = [
    { key: "all", label: "전체" },
    { key: "good", label: "굿샷" },
    { key: "miss", label: "미스샷" },
];

interface JournalHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    allJournals: Journal[];
    onSelectJournal?: (journalId: string) => void;
    connectedJournalId?: string | null;
    readOnly?: boolean;
}

import { useRouter } from "next/navigation";

export function JournalHistoryModal({ isOpen, onClose, allJournals, onSelectJournal, connectedJournalId, readOnly = false }: JournalHistoryModalProps) {
    const router = useRouter();
    const [historySelectedPart, setHistorySelectedPart] = useState<JournalType>(() => {
        if (typeof window !== 'undefined') {
            return (sessionStorage.getItem('journalHistoryTab') as JournalType) || "all";
        }
        return "all";
    });

    React.useEffect(() => {
        sessionStorage.setItem('journalHistoryTab', historySelectedPart);
    }, [historySelectedPart]);
    const [historySearchQuery, setHistorySearchQuery] = useState("");
    const [historyDisplayLimit, setHistoryDisplayLimit] = useState(10);

    if (!isOpen) return null;

    const historyItems = allJournals.filter(j =>
        (historySelectedPart === "all" || j.type === historySelectedPart) &&
        (!historySearchQuery || j.content.toLowerCase().includes(historySearchQuery.toLowerCase()) || j.title.toLowerCase().includes(historySearchQuery.toLowerCase()))
    );
    const displayedHistory = historyItems.slice(0, historyDisplayLimit);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col" style={{ height: '85vh' }} onClick={(e) => e.stopPropagation()}>
                <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 shrink-0">
                    <h2 className="font-bold text-lg text-zinc-900 dark:text-zinc-100">
                        훈련 일지 찾아보기
                    </h2>
                    <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-zinc-900 bg-white rounded-lg border border-zinc-200">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-4 shrink-0 border-b border-zinc-200 dark:border-zinc-800">
                    <CategoryTabs options={partOptions} value={historySelectedPart} onChange={setHistorySelectedPart} />
                    <div className="relative w-full mt-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                        <input
                            type="text"
                            placeholder="훈련 일지 내용 검색..."
                            value={historySearchQuery}
                            onChange={(e) => setHistorySearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all"
                        />
                    </div>
                </div>
                <div className="p-4 space-y-3 overflow-y-auto flex-1 bg-zinc-50/50 dark:bg-zinc-900 min-h-[300px]">
                    {displayedHistory.map(journal => {
                        return (
                            <div
                                key={journal.id}
                                className={cn(
                                    "bg-white dark:bg-zinc-800 border rounded-xl overflow-hidden shadow-sm p-4 transition-all relative cursor-pointer hover:border-brand-navy/50 border-zinc-200 dark:border-zinc-700"
                                )}
                                onClick={() => {
                                    sessionStorage.setItem('openJournalHistoryModal', 'true');
                                    router.push(`/admin/training-journal/${journal.id}`);
                                }}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className={cn("text-[11px] font-bold uppercase px-1.5 py-0.5 rounded-md", JOURNAL_TYPE_COLORS[journal.type]?.text, JOURNAL_TYPE_COLORS[journal.type]?.bg)}>
                                            {JOURNAL_TYPE_LABELS[journal.type] || "훈련 일지"}
                                        </span>
                                        {journal.author && (
                                            <span className="text-[12px] font-medium text-zinc-500">
                                                {journal.author}
                                            </span>
                                        )}
                                        <span className="text-[12px] text-zinc-400">
                                            {new Date(journal.date).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-[14px] text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap mt-1">
                                    {journal.content || "일지 내용이 없습니다."}
                                </div>
                            </div>
                        );
                    })}
                    {displayedHistory.length === 0 && (
                        <div className="py-8 text-center text-zinc-500 text-sm">
                            해당 조건의 훈련 일지가 없습니다.
                        </div>
                    )}
                    {historyItems.length > historyDisplayLimit && (
                        <div className="pt-2 text-center pb-4">
                            <button
                                type="button"
                                onClick={() => setHistoryDisplayLimit(prev => prev + 10)}
                                className="px-4 py-2 text-sm font-medium text-brand-navy dark:text-brand-navy-light bg-brand-navy/5 dark:bg-brand-navy/20 hover:bg-brand-navy/10 dark:hover:bg-brand-navy/30 rounded-xl transition-colors"
                            >
                                더보기
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}