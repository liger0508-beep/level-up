import React from "react";
import { X, FileText, ChevronRight, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { LessonRecord } from "@/lib/lesson-sync";

interface LinkedLessonCardProps {
    part: string;
    lesson: LessonRecord | null;
    onRemove?: () => void;
    onMoreClick?: () => void;
    onConnectClick?: () => void;
    isConnected?: boolean;
    readOnly?: boolean;
}

const partLabels: Record<string, string> = {
    shot: "Shot",
    pitch: "Pitch",
    bunker: "Bunker",
    approach: "Approach",
    putt: "Putt",
    physical: "Physical",
    field: "Field",
    etc: "Etc",
};

export function LinkedLessonCard({ part, lesson, onRemove, onMoreClick, onConnectClick, isConnected, readOnly = false }: LinkedLessonCardProps) {
    return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl flex flex-col relative transition-all hover:border-brand-navy/30">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-black px-2 py-0.5 rounded-md bg-brand-navy/10 text-brand-navy dark:bg-brand-navy/20 dark:text-brand-navy-light uppercase">
                        {partLabels[part] || part}
                    </span>
                </div>
                {!readOnly && onRemove && (
                    <button
                        type="button"
                        onClick={onRemove}
                        className="p-1 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="이 파트 훈련 제외"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>

            {lesson ? (
                <div className="flex-1 min-h-0 flex flex-col">
                    <div className="text-sm text-zinc-900 dark:text-zinc-100 mt-2 mb-2 whitespace-pre-wrap break-words">
                        {lesson.content || "레슨 내용이 없습니다."}
                    </div>
                    <div className="text-[10px] text-zinc-400 mt-2">
                        {new Date(lesson.created_at).toLocaleDateString()}
                    </div>
                </div>
            ) : (
                <div className="flex-1 min-h-[60px] flex items-center justify-center text-xs text-zinc-400 italic">
                    선택된 레슨이 없습니다.
                </div>
            )}

            {!readOnly && (onMoreClick || onConnectClick) && (
                <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                    {onConnectClick && lesson && !lesson.connected_lesson_id ? (
                        <button
                            type="button"
                            onClick={onConnectClick}
                            className={cn(
                                "flex items-center gap-1 text-[11px] font-bold transition-colors px-2 py-1 rounded-md",
                                isConnected
                                    ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    : "text-brand-navy bg-brand-navy/5 hover:bg-brand-navy/10 dark:text-brand-navy-light dark:bg-brand-navy-light/10 dark:hover:bg-brand-navy-light/20"
                            )}
                        >
                            {isConnected ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                            {isConnected ? "연결 해제" : "레슨 연결"}
                        </button>
                    ) : <div />}
                    {onMoreClick && (
                        <button
                            type="button"
                            onClick={onMoreClick}
                            className="flex items-center gap-1 text-[11px] font-bold text-zinc-500 hover:text-brand-navy transition-colors"
                        >
                            <FileText size={12} />
                            더보기 (다른 레슨 찾기)
                            <ChevronRight size={12} />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}