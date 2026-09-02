"use client";

import { useRouter } from "next/navigation";
import { Plan, PlanType, PLAN_TYPE_LABELS, getPlainText } from "@/lib/plan-sync";
import { cn } from "@/lib/utils";
import { Paperclip, Target } from "lucide-react";

const typeConfig: Record<PlanType, {
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

function getConfig(type: PlanType) {
    return typeConfig[type] || typeConfig.all;
}

interface PlanTableProps {
    plans: Plan[];
    viewMode?: "list" | "content";
}

export function PlanTable({ plans, viewMode = "list" }: PlanTableProps) {
    const router = useRouter();

    return (
        <>
            {/* ── Mobile Card Grid (hidden on md+) ── */}
            <div className="flex flex-col gap-2.5 md:hidden">
                {plans.map((plan) => {
                    const cfg = getConfig(plan.type);
                    const label = PLAN_TYPE_LABELS[plan.type];
                    return (
                        <button
                            key={plan.id}
                            onClick={() => {
                                sessionStorage.setItem("gla_plan_keep_alive", "true");
                                router.push(plan.type === 'field' ? `/scores/field-notes/${plan.id}` : `/admin/training-plan/${plan.id}`);
                            }}
                            className="w-full text-left bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 py-4 px-6 shadow-sm hover:border-brand-navy/30 hover:shadow-md transition-all group"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-3 w-full">
                                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", cfg.iconBg, cfg.iconColor)}>
                                        <Target size={16} />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-zinc-900 dark:text-zinc-100 truncate text-[15px]">
                                                {plan.date.slice(5).replace(/-/g, '.')}
                                            </span>
                                            {plan.isImportant && (
                                                <span className="shrink-0 text-[10px] font-bold text-red-500 border border-red-200 px-1.5 py-0.5 rounded-md bg-red-50">중요</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {viewMode === "content" ? (
                                <div className="flex gap-2 mt-3 items-start relative">
                                    <div className="w-8 shrink-0 flex justify-center mt-0.5"></div>
                                    <span className="flex-1 text-[12px] font-medium text-zinc-600 dark:text-zinc-300 line-clamp-2 leading-snug pr-8 text-left">
                                        {plan.content ? getPlainText(plan.content) : "내용 없음"}
                                    </span>
                                    <span className="text-sm font-bold text-zinc-600 dark:text-zinc-300 shrink-0 mr-2 mt-auto">
                                        {plan.athleteName}
                                    </span>
                                </div>
                            ) : (
                                <div className="flex items-end justify-between mt-3 relative">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 shrink-0 flex justify-center"></div>
                                        <div className="flex items-center gap-1">
                                            {plan.media_urls && plan.media_urls.length > 0 && (
                                                <Paperclip size={12} className="text-brand-navy shrink-0" />
                                            )}
                                        </div>
                                    </div>
                                    <span className="text-sm font-bold text-zinc-600 dark:text-zinc-300 truncate mr-2">
                                        {plan.athleteName}
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
                            <th className="py-2.5 px-4 font-semibold text-center w-32">선수명</th>
                            <th className="py-2.5 px-4 font-semibold text-center w-24">날짜</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {plans.map((plan, idx) => {
                            const cfg = getConfig(plan.type);
                            const label = PLAN_TYPE_LABELS[plan.type];
                            return (
                                <tr
                                    key={plan.id}
                                    onClick={() => {
                                        sessionStorage.setItem("gla_plan_keep_alive", "true");
                                        router.push(plan.type === 'field' ? `/scores/field-notes/${plan.id}` : `/admin/training-plan/${plan.id}`);
                                    }}
                                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                                >
                                    <td className="py-3.5 px-4 text-center text-zinc-500 dark:text-zinc-500">
                                        {plans.length - idx}
                                    </td>
                                    <td className="py-3.5 px-4 text-center">
                                        <span className="text-zinc-700 dark:text-zinc-300 font-bold truncate">
                                            {plan.athleteName}
                                            {plan.type === 'field' && plan.fieldScore !== undefined && (
                                                <span className="ml-1.5 text-[11px] font-medium font-normal">
                                                    (
                                                    <span className={cn(
                                                        plan.fieldScore - (plan.fieldHoleCount === 9 ? 36 : 72) < 0 ? "text-red-500 font-bold" :
                                                            plan.fieldScore - (plan.fieldHoleCount === 9 ? 36 : 72) > 0 ? "text-blue-500 font-bold" : "text-zinc-900 dark:text-zinc-100 font-bold"
                                                    )}>
                                                        {plan.fieldScore}타
                                                    </span>
                                                    <span className="text-zinc-400"> • </span>
                                                    <span className="text-zinc-900 dark:text-zinc-100">{plan.fieldCourse}</span>
                                                    )
                                                </span>
                                            )}
                                        </span>
                                    </td>
                                    <td className="py-3.5 px-4 text-center text-zinc-500 dark:text-zinc-500">
                                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
                                            <div className="flex justify-end">
                                                {plan.media_urls && plan.media_urls.length > 0 && (
                                                    <Paperclip size={14} className="text-brand-navy" />
                                                )}
                                            </div>
                                            <span className="text-center">{plan.date.slice(5).replace("-", ".")}</span>
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
