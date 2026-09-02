import React from "react";
import { X, FileText, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Plan, PLAN_TYPE_LABELS } from "@/lib/plan-sync";

interface LinkedPlanCardProps {
    plan: Plan | null;
    onRemove?: () => void;
    onMoreClick?: () => void;
    readOnly?: boolean;
}

export function LinkedPlanCard({ plan, onRemove, onMoreClick, readOnly = false }: LinkedPlanCardProps) {
    return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl flex flex-col relative transition-all hover:border-brand-navy/30">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    {plan && plan.type !== 'all' && (
                        <span className="text-xs font-black px-2 py-0.5 rounded-md bg-brand-navy/10 text-brand-navy dark:bg-brand-navy/20 dark:text-brand-navy-light uppercase">
                            {PLAN_TYPE_LABELS[plan.type]}
                        </span>
                    )}
                </div>
                {!readOnly && onRemove && (
                    <button
                        type="button"
                        onClick={onRemove}
                        className="p-1 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="제외"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>

            {plan ? (
                <div className="flex-1 min-h-0 flex flex-col">
                    <div className="text-sm text-zinc-900 dark:text-zinc-100 mt-2 mb-2 whitespace-pre-wrap break-words">
                        {plan.content || "계획 내용이 없습니다."}
                    </div>
                    <div className="text-[10px] text-zinc-400 mt-2">
                        {new Date(plan.date).toLocaleDateString()}
                    </div>
                </div>
            ) : (
                <div className="flex-1 min-h-[60px] flex items-center justify-center text-xs text-zinc-400 italic">
                    선택된 훈련 계획이 없습니다.
                </div>
            )}

            {!readOnly && onMoreClick && (
                <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
                    <button
                        type="button"
                        onClick={onMoreClick}
                        className="flex items-center gap-1 text-[11px] font-bold text-zinc-500 hover:text-brand-navy transition-colors"
                    >
                        <FileText size={12} />
                        더보기 (다른 훈련계획 찾기)
                        <ChevronRight size={12} />
                    </button>
                </div>
            )}
        </div>
    );
}