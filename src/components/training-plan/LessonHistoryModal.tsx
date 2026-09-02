"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, X, CheckCircle2, Circle, CornerDownRight } from "lucide-react";
import { CategoryTabs } from "@/components/ui/CategoryTabs";
import { cn } from "@/lib/utils";
import { LessonRecord } from "@/lib/lesson-sync";

type LessonType = "shot" | "pitch" | "bunker" | "approach" | "putt" | "physical" | "field" | "etc";

const partOptions: { key: string; label: string }[] = [
    { key: "all", label: "ALL" },
    { key: "shot", label: "Shot" },
    { key: "pitch", label: "Pitch" },
    { key: "bunker", label: "Bunker" },
    { key: "approach", label: "Approach" },
    { key: "putt", label: "Putt" },
    { key: "physical", label: "Physical" },
    { key: "field", label: "Field" },
    { key: "etc", label: "Etc" },
];

interface GroupedLesson extends LessonRecord {
    subLessons?: GroupedLesson[];
    is_core_lesson?: boolean;
}

interface LessonHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    allLessons: LessonRecord[];
    initialPart?: string;
    onSelectLesson: (lessonId: string) => void;
    connectedLessonId?: string | null;
    readOnly?: boolean;
}

export function LessonHistoryModal({ isOpen, onClose, allLessons, initialPart, onSelectLesson, connectedLessonId, readOnly = false }: LessonHistoryModalProps) {
    const router = useRouter();
    const [historySelectedPart, setHistorySelectedPart] = useState<string>(() => {
        if (typeof window !== 'undefined') {
            return sessionStorage.getItem('lessonHistoryTab') || "all";
        }
        return "all";
    });

    React.useEffect(() => {
        sessionStorage.setItem('lessonHistoryTab', historySelectedPart);
    }, [historySelectedPart]);
    const [historySearchQuery, setHistorySearchQuery] = useState("");
    const [historyDisplayLimit, setHistoryDisplayLimit] = useState(10);

    const effectivePart = historySelectedPart;

    const groupedLessons = useMemo(() => {
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

        return rootLessons.filter(root => {
            const typeMatch = (l: GroupedLesson) => effectivePart === "all" || l.category === effectivePart;
            const searchMatch = (l: GroupedLesson) => !historySearchQuery || l.content.toLowerCase().includes(historySearchQuery.toLowerCase());

            const isMatch = (l: GroupedLesson) => typeMatch(l) && searchMatch(l);

            if (isMatch(root)) return true;
            if (root.subLessons?.some(sub => isMatch(sub))) return true;

            return false;
        });
    }, [allLessons, effectivePart, historySearchQuery]);

    const displayedHistory = groupedLessons.slice(0, historyDisplayLimit);

    const renderLessonCard = (lesson: GroupedLesson, isSub = false) => {
        const cardContent = (
            <div
                className={cn(
                    "bg-white dark:bg-zinc-900 border rounded-[1.25rem] overflow-hidden shadow-sm px-5 py-4 transition-all relative flex-1 group",
                    "border-zinc-200 dark:border-zinc-700 hover:border-brand-navy/50 cursor-pointer"
                )}
                onClick={() => {
                    sessionStorage.setItem('openLessonHistoryModal', 'true');
                    router.push(`/lessons/${lesson.id}`);
                }}
            >
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-brand-navy dark:text-brand-navy-light uppercase px-2 py-1 bg-brand-navy/5 dark:bg-brand-navy/20 rounded-md">
                            {partOptions.find(p => p.key === lesson.category)?.label || lesson.category}
                        </span>
                        {lesson.is_core_lesson && (
                            <span className="text-[11px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-md shrink-0">
                                핵심 레슨
                            </span>
                        )}
                        {lesson.coachName && (
                            <span className="text-[12px] font-medium text-zinc-500">
                                {lesson.coachName}
                            </span>
                        )}
                        <span className="text-[12px] text-zinc-400">
                            {new Date(lesson.created_at).toLocaleDateString()}
                        </span>
                    </div>
                </div>
                <div className="text-[14px] text-zinc-600 dark:text-zinc-400 mt-1 mb-2 whitespace-pre-wrap">
                    {lesson.content}
                </div>
            </div>
        );

        if (isSub) {
            return (
                <div key={lesson.id} className="flex items-start gap-2 mr-2">
                    <div className="mt-5 shrink-0 text-zinc-300 dark:text-zinc-600 pl-3">
                        <CornerDownRight size={16} />
                    </div>
                    {cardContent}
                </div>
            );
        }

        return <React.Fragment key={lesson.id}>{cardContent}</React.Fragment>;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col" style={{ height: '85vh' }}>
                <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 shrink-0">
                    <h2 className="font-bold text-lg text-zinc-900 dark:text-zinc-100">
                        레슨 히스토리 찾아보기
                    </h2>
                    <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-zinc-900 bg-white rounded-lg border border-zinc-200">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-4 shrink-0 border-b border-zinc-200 dark:border-zinc-800">
                    <CategoryTabs options={partOptions} value={effectivePart} onChange={setHistorySelectedPart} />
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
                <div className="p-4 space-y-3 overflow-y-auto flex-1 bg-zinc-50/50 dark:bg-zinc-900 min-h-[300px]">
                    {displayedHistory.map(root => (
                        <div key={root.id} className="space-y-2 relative">
                            {renderLessonCard(root, false)}
                            {root.subLessons?.map(sub => renderLessonCard(sub, true))}
                        </div>
                    ))}
                    {displayedHistory.length === 0 && (
                        <div className="py-8 text-center text-zinc-500 text-sm">
                            해당 조건의 레슨 기록이 없습니다.
                        </div>
                    )}
                    {groupedLessons.length > historyDisplayLimit && (
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