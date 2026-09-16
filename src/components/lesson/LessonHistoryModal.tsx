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
    connectedLessonId: string | null;
    setConnectedLessonId: (val: string | null) => void;
    partOptions: { key: string; label: string }[];
    readOnly?: boolean;
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
                        레슨 히스토리 찾아보기
                    </SectionTitle>
                </div>
                <div className="p-4 shrink-0 border-b border-zinc-200 dark:border-zinc-800">
                    <CategoryTabs options={partOptions} value={historySelectedPart} onChange={setHistorySelectedPart} />
                    <div className="relative w-full mt-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                        <input
                            type="text"
                            placeholder="레슨 내용 검색..."
                            value={historySearchQuery}
                            onChange={(e) => setHistorySearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all"
                        />
                    </div>
                </div>
                <div className="p-4 space-y-3 overflow-y-auto flex-1 bg-zinc-50/50 dark:bg-zinc-900 min-h-[300px]" ref={scrollRef}>
                    {(() => {
                        const effectivePart = historySelectedPart;

                        const lessonMap = new Map<string, GroupedLesson>();
                        allLessons.forEach(l => lessonMap.set(l.id, { ...l, subLessons: [] }));

                        const rootLessons: GroupedLesson[] = [];
                        const treeMap = new Map<string, GroupedLesson[]>();

                        const getRootId = (id: string): string => {
                            let current = lessonMap.get(id);
                            const visited = new Set<string>();
                            while (current?.connected_lesson_id) {
                                if (visited.has(current.id)) break;
                                visited.add(current.id);
                                const parent = lessonMap.get(current.connected_lesson_id);
                                if (!parent) break;
                                current = parent;
                            }
                            return current?.id || id;
                        };

                        allLessons.forEach(l => {
                            const rootId = getRootId(l.id);
                            if (rootId === l.id) {
                                if (!treeMap.has(rootId)) treeMap.set(rootId, []);
                            } else {
                                if (!treeMap.has(rootId)) treeMap.set(rootId, []);
                                treeMap.get(rootId)!.push(lessonMap.get(l.id)!);
                            }
                        });

                        Array.from(treeMap.keys()).forEach(rootId => {
                            const root = lessonMap.get(rootId);
                            if (root) {
                                const descendants = treeMap.get(rootId)!;
                                descendants.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                                root.subLessons = descendants;
                                if (descendants.length >= 2) {
                                    root.is_core_lesson = true;
                                }
                                rootLessons.push(root);
                            }
                        });

                        rootLessons.sort((a, b) => {
                            let maxDateA = new Date(a.created_at).getTime();
                            if (a.subLessons && a.subLessons.length > 0) {
                                const latestSubA = new Date(a.subLessons[0].created_at).getTime();
                                if (latestSubA > maxDateA) maxDateA = latestSubA;
                            }
                            let maxDateB = new Date(b.created_at).getTime();
                            if (b.subLessons && b.subLessons.length > 0) {
                                const latestSubB = new Date(b.subLessons[0].created_at).getTime();
                                if (latestSubB > maxDateB) maxDateB = latestSubB;
                            }
                            return maxDateB - maxDateA;
                        });

                        const groupedLessons = rootLessons.filter(root => {
                            const typeMatch = (l: GroupedLesson) => effectivePart === "all" || l.category === effectivePart;
                            const searchMatch = (l: GroupedLesson) => !historySearchQuery || l.content.toLowerCase().includes(historySearchQuery.toLowerCase());

                            const isMatch = (l: GroupedLesson) => typeMatch(l) && searchMatch(l);

                            if (isMatch(root)) return true;
                            if (root.subLessons?.some(sub => isMatch(sub))) return true;

                            return false;
                        });

                        const displayedHistory = groupedLessons;

                        const renderLessonCard = (lesson: GroupedLesson, isSub = false) => {
                            const isConnected = connectedLessonId === lesson.id;
                            const cardContent = (
                                <div
                                    className={cn(
                                        "bg-white dark:bg-zinc-900 border rounded-[1.25rem] overflow-hidden shadow-sm px-5 py-4 transition-all relative flex-1 group",
                                        isConnected
                                            ? "border-brand-navy dark:border-brand-navy-light shadow-brand-navy/10 ring-1 ring-brand-navy"
                                            : "border-zinc-200 dark:border-zinc-700 hover:border-brand-navy/50 cursor-pointer"
                                    )}
                                    onClick={() => {
                                        sessionStorage.setItem('openLessonHistoryModal', 'true');
                                        router.push(`/lessons/${lesson.id}`);
                                    }}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            {!isSub && (
                                                <span className="text-[11px] font-bold text-brand-navy dark:text-brand-navy-light uppercase px-2 py-1 bg-brand-navy/5 dark:bg-brand-navy/20 rounded-md">
                                                    {partOptions.find(p => p.key === lesson.category)?.label || lesson.category}
                                                </span>
                                            )}
                                            {lesson.is_core_lesson && (
                                                <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-md shrink-0">
                                                    핵심 레슨
                                                </span>
                                            )}

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
                                    <p className="text-[13px] text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap leading-relaxed mt-1 mb-8">
                                        {lesson.content}
                                    </p>
                                    {/* Connect button */}
                                    {!isSub && !readOnly && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (isConnected) {
                                                    setConnectedLessonId(null);
                                                } else {
                                                    setConnectedLessonId(lesson.id);
                                                    onClose();
                                                    setTimeout(() => {
                                                        const el = document.getElementById('before-correction-section');
                                                        if (el) {
                                                            const y = el.getBoundingClientRect().top + window.scrollY - (window.innerHeight / 3);
                                                            window.scrollTo({ top: y, behavior: 'smooth' });
                                                        }
                                                    }, 100);
                                                }
                                            }}
                                            className={cn(
                                                "absolute bottom-4 right-4 flex items-center gap-1 text-[11px] font-bold transition-colors px-2 py-1 rounded-md",
                                                isConnected
                                                    ? "text-red-500 bg-red-50 hover:bg-red-100"
                                                    : "text-brand-navy bg-brand-navy/5 hover:bg-brand-navy/10"
                                            )}
                                        >
                                            {isConnected ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                                            {isConnected ? "연결 해제" : "레슨 연결"}
                                        </button>
                                    )}
                                </div>
                            );

                            if (isSub) {
                                return (
                                    <div key={lesson.id} className="flex items-start gap-2 mr-2 mt-2">
                                        <div className="mt-5 shrink-0 text-zinc-300 dark:text-zinc-600 pl-3">
                                            <CornerDownRight size={16} />
                                        </div>
                                        {cardContent}
                                    </div>
                                );
                            }

                            return <React.Fragment key={lesson.id}>{cardContent}</React.Fragment>;
                        };

                        return (
                            <>
                                {displayedHistory.map(root => (
                                    <div key={root.id} className="space-y-0 relative mb-3">
                                        {renderLessonCard(root, false)}
                                        {root.subLessons?.map(sub => renderLessonCard(sub, true))}
                                    </div>
                                ))}
                                {displayedHistory.length === 0 && (
                                    <div className="py-8 text-center text-zinc-500 text-sm">
                                        검색된 레슨 기록이 없습니다.
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
