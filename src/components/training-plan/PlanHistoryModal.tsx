"use client";

import React, { useState } from "react";
import { Search, X } from "lucide-react";
import { CategoryTabs } from "@/components/ui/CategoryTabs";
import { cn } from "@/lib/utils";
import { Plan, PlanType, PLAN_TYPE_LABELS, PLAN_TYPE_COLORS } from "@/lib/plan-sync";
import { useRouter } from "next/navigation";



interface PlanHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    allPlans: Plan[];
    onSelectPlan?: (planId: string) => void;
    connectedPlanId?: string | null;
    readOnly?: boolean;
}

export function PlanHistoryModal({ isOpen, onClose, allPlans, onSelectPlan, connectedPlanId, readOnly = false }: PlanHistoryModalProps) {
    const router = useRouter();

    const [historySearchQuery, setHistorySearchQuery] = useState("");
    const [historyDisplayLimit, setHistoryDisplayLimit] = useState(10);

    if (!isOpen) return null;

    const historyItems = allPlans.filter(p =>
        (!historySearchQuery || p.content.toLowerCase().includes(historySearchQuery.toLowerCase()) || p.title?.toLowerCase().includes(historySearchQuery.toLowerCase()))
    );
    const displayedHistory = historyItems.slice(0, historyDisplayLimit);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col" style={{ height: '85vh' }} onClick={(e) => e.stopPropagation()}>
                <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 shrink-0">
                    <h2 className="font-bold text-lg text-zinc-900 dark:text-zinc-100">
                        훈련 계획 찾아보기
                    </h2>
                    <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-zinc-900 bg-white rounded-lg border border-zinc-200">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-4 shrink-0 border-b border-zinc-200 dark:border-zinc-800">
                    <div className="relative w-full mt-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                        <input
                            type="text"
                            placeholder="훈련 계획 내용 검색..."
                            value={historySearchQuery}
                            onChange={(e) => setHistorySearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all"
                        />
                    </div>
                </div>
                <div className="p-4 space-y-3 overflow-y-auto flex-1 bg-zinc-50/50 dark:bg-zinc-900 min-h-[300px]">
                    {displayedHistory.map(plan => {
                        const colors = PLAN_TYPE_COLORS[plan.type] || { bg: "bg-zinc-100", text: "text-zinc-600", border: "border-zinc-200" };
                        return (
                            <div
                                key={plan.id}
                                className={cn(
                                    "bg-white dark:bg-zinc-800 border rounded-xl overflow-hidden shadow-sm p-4 transition-all relative cursor-pointer hover:border-brand-navy/50 border-zinc-200 dark:border-zinc-700",
                                    connectedPlanId === plan.id ? "ring-2 ring-brand-navy border-transparent" : ""
                                )}
                                onClick={() => {
                                    if (onSelectPlan) {
                                        onSelectPlan(plan.id);
                                    } else {
                                        router.push(`/admin/training-plan/${plan.id}`);
                                    }
                                }}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[12px] text-zinc-400">
                                            {new Date(plan.date).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-[14px] text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap mt-1">
                                    {plan.content || "계획 내용이 없습니다."}
                                </div>
                            </div>
                        );
                    })}
                    {displayedHistory.length === 0 && (
                        <div className="py-8 text-center text-zinc-500 text-sm">
                            해당 조건의 훈련 계획이 없습니다.
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
