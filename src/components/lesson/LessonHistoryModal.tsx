"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { X, Search, CheckCircle2, Circle, CornerDownRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionTitle } from "@/components/ui/Typography";
import { CategoryTabs } from "@/components/ui/CategoryTabs";
import { LessonRecord } from "@/lib/lesson-sync";

export interface GroupedLesson extends LessonRecord {
    subLessons?: GroupedLesson[];
    is_core_lesson?: boolean;
}

export interface LessonHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    allLessons: LessonRecord[];
    historySelectedPart: string;
    setHistorySelectedPart: (val: string) => void;
    historySearchQuery: string;
    setHistorySearchQuery: (val: string) => void;
    historyDisplayLimit: number;
    setHistoryDisplayLimit: React.Dispatch<React.SetStateAction<number>>;
    connectedLessonId?: string | null;
    setConnectedLessonId?: (val: string | null) => void;
    partOptions: { key: string; label: string }[];
    readOnly?: boolean;
    title?: string;
    itemType?: "lesson" | "analysis";
}

export function LessonHistoryModal({
    isOpen,
    onClose,
    allLessons,
    historySelectedPart,
    setHistorySelectedPart,
    historySearchQuery,
    setHistorySearchQuery,
    historyDisplayLimit,
    setHistoryDisplayLimit,
    connectedLessonId,
    setConnectedLessonId,
    partOptions,
    readOnly = false,
    title,
    itemType = "lesson",
}: LessonHistoryModalProps) {
    const router = useRouter();
    const scrollRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = 0;
        }
    }, [historySelectedPart]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col" style={{ height: '85vh' }} onClick={(e) => e.stopPropagation()}>
                <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex justify-start items-center gap-3 bg-zinc-50 dark:bg-zinc-900/50 shrink-0">
                    <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-zinc-900 bg-white rounded-lg border border-zinc-200 transition-colors">
                        <ChevronLeft size={20} />
                    </button>
                    <SectionTitle>
                        {title || (itemType === "analysis" ? "최근 분석 기록 찾아보기" : "최근 레슨 기록 찾아보기")}
                    </SectionTitle>
                </div>
                <div className="p-4 shrink-0 border-b border-zinc-200 dark:border-zinc-800">
                    <CategoryTabs options={partOptions} value={historySelectedPart} onChange={setHistorySelectedPart} />
                    <div className="relative w-full mt-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                        <input
                            type="text"
                            placeholder={itemType === "analysis" ? "분석 내용 검색..." : "레슨 내용 검색..."}
                            value={historySearchQuery}
                            onChange={(e) => setHistorySearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all"
                        />
                    </div>
                </div>
                <div className="p-4 space-y-3 overflow-y-auto flex-1 bg-zinc-50/50 dark:bg-zinc-900 min-h-[300px]" ref={scrollRef}>
                    {(() => {
                        const effectivePart = historySelectedPart;

                        const filteredLessons = allLessons.filter(lesson => {
                            const typeMatch = effectivePart === "all" || lesson.category === effectivePart;
                            const searchMatch = !historySearchQuery || lesson.content.toLowerCase().includes(historySearchQuery.toLowerCase());
                            return typeMatch && searchMatch;
                        });

                        const sortedLessons = [...filteredLessons].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

                        return (
                            <>
                                {sortedLessons.map(lesson => {
                                    const basePath = itemType === "analysis" || lesson.type === "analysis" ? "analysis" : "lessons";
                                    return (
                                        <div
                                            key={lesson.id}
                                            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 hover:border-brand-navy/50 rounded-[1.25rem] overflow-hidden shadow-sm px-5 py-4 transition-all relative group cursor-pointer mb-3"
                                            onClick={() => {
                                                sessionStorage.setItem(basePath === "analysis" ? 'openAnalysisHistoryModal' : 'openLessonHistoryModal', 'true');
                                                router.push(`/${basePath}/${lesson.id}`);
                                            }}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[11px] font-bold text-brand-navy dark:text-brand-navy-light uppercase px-2 py-1 bg-brand-navy/5 dark:bg-brand-navy/20 rounded-md">
                                                        {partOptions.find(p => p.key === lesson.category)?.label || lesson.category}
                                                    </span>

                                                    {lesson.coachName && (
                                                        <span className="text-[12px] font-medium text-zinc-500">
                                                            {lesson.coachName}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[12px] text-zinc-400 font-medium">
                                                        {lesson.created_at ? new Date(lesson.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }).slice(5).replace(/-/g, ".") : ""}
                                                    </span>
                                                </div>
                                            </div>
                                            <p className="text-[13px] text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap leading-relaxed mt-1">
                                                {lesson.content}
                                            </p>
                                        </div>
                                    );
                                })}
                                {sortedLessons.length === 0 && (
                                    <div className="py-8 text-center text-zinc-500 text-sm">
                                        {itemType === "analysis" ? "검색된 분석 기록이 없습니다." : "검색된 레슨 기록이 없습니다."}
                                    </div>
                                )}
                                {allLessons.length >= historyDisplayLimit && (
                                    <div className="py-4 flex justify-center">
                                        <button
                                            type="button"
                                            onClick={() => setHistoryDisplayLimit(prev => prev + 10)}
                                            className="px-6 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm rounded-xl text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                                        >
                                            더 보기 ▼
                                        </button>
                                    </div>
                                )}
                            </>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
}
