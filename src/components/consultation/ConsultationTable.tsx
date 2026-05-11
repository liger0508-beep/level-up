"use client";

import { useRouter } from "next/navigation";
import { Consultation, ConsultationType, CONSULTATION_TYPE_LABELS, CONSULTATION_TYPE_COLORS } from "@/lib/consultation-sync";
import { cn } from "@/lib/utils";

const typeConfig: Record<ConsultationType, {
    accentBorder: string;
    dotColor: string;
    labelColor: string;
}> = {
    all: { accentBorder: "border-l-indigo-400", dotColor: "bg-indigo-400", labelColor: "text-indigo-600 dark:text-indigo-400" },
    assigned: { accentBorder: "border-l-emerald-400", dotColor: "bg-emerald-400", labelColor: "text-emerald-700 dark:text-emerald-400" },
};

interface ConsultationTableProps {
    consultations: Consultation[];
}

export function ConsultationTable({ consultations }: ConsultationTableProps) {
    const router = useRouter();

    return (
        <>
            {/* ── Mobile Card Grid (hidden on md+) ── */}
            <div className="flex flex-col gap-2.5 md:hidden">
                {consultations.map((item) => {
                    const cfg = typeConfig[item.type];
                    const label = CONSULTATION_TYPE_LABELS[item.type];
                    return (
                        <button
                            key={item.id}
                            onClick={() => router.push(`/consultations/${item.id}`)}
                            className={cn(
                                "w-full text-left bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-l-4 rounded-xl px-4 py-3.5 hover:shadow-sm active:scale-[0.99] transition-all",
                                cfg.accentBorder
                            )}
                        >
                            <div className="flex items-center gap-1.5 mb-2">
                                <span className={cn("inline-flex items-center justify-center px-2 py-1 rounded-md text-[10px] font-bold tracking-wide", cfg.labelColor, "bg-zinc-100 dark:bg-zinc-800")}>
                                    {label}
                                </span>
                                <span className="inline-flex items-center justify-center px-2 py-1 rounded-md text-[10px] font-bold tracking-wide text-zinc-500 bg-zinc-100 dark:bg-zinc-800">
                                    전체
                                </span>
                                {item.isImportant && (
                                    <span className="inline-flex items-center justify-center px-2 py-1 rounded-md text-[10px] font-bold tracking-wide text-red-500 bg-red-50 dark:bg-red-950/30">
                                        중요
                                    </span>
                                )}
                            </div>
                            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate mb-3">
                                {item.athleteName} <span className="text-zinc-400 font-medium text-[11px] ml-1">선수 상담</span>
                            </h3>
                            <div className="flex items-center justify-end gap-2 text-zinc-400 dark:text-zinc-500 text-[11px] font-medium">
                                <span>{item.author}</span>
                                <span className="text-zinc-200 dark:text-zinc-800 opacity-30">|</span>
                                <span>{item.date.replace(/-/g, ".")}</span>
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
                            <th className="py-2.5 px-4 font-semibold text-center">선수명</th>
                            <th className="py-2.5 px-4 font-semibold text-center w-32">작성자</th>
                            <th className="py-2.5 px-4 font-semibold text-center w-32">날짜</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {consultations.map((item, idx) => {
                            const cfg = typeConfig[item.type];
                            const label = CONSULTATION_TYPE_LABELS[item.type];
                            return (
                                <tr
                                    key={item.id}
                                    onClick={() => router.push(`/consultations/${item.id}`)}
                                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                                >
                                    <td className="py-3.5 px-4 text-center text-zinc-500 dark:text-zinc-500">
                                        {consultations.length - idx}
                                    </td>
                                    <td className="py-3.5 px-4 text-center">
                                        <span className={cn("text-[12px] font-semibold", cfg.labelColor)}>
                                            {label}
                                        </span>
                                    </td>
                                    <td className="py-3.5 px-4 text-center">
                                        <span className="text-zinc-700 dark:text-zinc-300 font-bold truncate">
                                            {item.athleteName}
                                        </span>
                                    </td>
                                    <td className="py-3.5 px-4 text-center text-zinc-600 dark:text-zinc-400 truncate">
                                        {item.author}
                                    </td>
                                    <td className="py-3.5 px-4 text-center text-zinc-500 dark:text-zinc-500">
                                        {item.date.replace(/-/g, ".")}
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
