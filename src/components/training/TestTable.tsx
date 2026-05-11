"use client";

import { useRouter } from "next/navigation";
import { TestData, TEST_TYPE_LABELS, TEST_TYPE_COLORS } from "@/lib/test-sync";
import { cn } from "@/lib/utils";

const typeLabelShort: Record<string, string> = {
    ...TEST_TYPE_LABELS,
    short_game: "A/Green",
};

interface TestTableProps {
    tests: TestData[];
    totalCount?: number;
}

export function TestTable({ tests, totalCount = 0 }: TestTableProps) {
    const router = useRouter();

    return (
        <>
            {/* ── Mobile Card Grid ── */}
            <div className="flex flex-col gap-2.5 md:hidden">
                {tests.map((test) => {
                    const colors = TEST_TYPE_COLORS[test.type];
                    const dotColor = colors.border.replace("border-l-", "bg-");
                    const typeLabel = (test.type === "around_green" ? "A/G" : (test.type === "shot" ? "SHOT" : (test.type === "putting" ? "PUTT" : test.type))).toUpperCase();
                    
                    return (
                        <button
                            key={test.id}
                            onClick={() => router.push(`/training/tests/${test.id}`)}
                            className={cn(
                                "w-full text-left bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-l-4 rounded-xl px-4 py-3.5 transition-all active:scale-[0.98] hover:shadow-md hover:-translate-y-px",
                                colors.border
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                    <span className={cn("w-2 h-2 rounded-full shrink-0", dotColor)} />
                                    <span className={cn("w-14 text-[11px] font-bold uppercase tracking-widest shrink-0", colors.text)}>
                                        {typeLabel}
                                    </span>
                                    <span className="w-[1px] h-3 bg-zinc-200 dark:bg-zinc-700 shrink-0" />
                                    <div className={cn(
                                        "text-[13px] font-black italic tracking-tighter shrink-0 min-w-[3.5rem] text-center",
                                        (test.totalScore || 0) > 0 ? "text-blue-600" : (test.totalScore || 0) < 0 ? "text-brand-red" : "text-zinc-400"
                                    )}>
                                        {(test.totalScore || 0) > 0 ? `+${test.totalScore?.toFixed(2)}` : test.totalScore?.toFixed(2)}
                                    </div>
                                    <span className="w-[1px] h-3 bg-zinc-200 dark:bg-zinc-700 shrink-0" />
                                    <span className="text-[14px] font-bold text-zinc-700 dark:text-zinc-100 truncate">
                                        {test.playerName}
                                    </span>
                                </div>
                                <div className="shrink-0 pl-3">
                                    <span className="text-[11px] text-zinc-400 font-medium">
                                        {test.date.slice(5).replace("-", ".")}
                                    </span>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* ── Desktop Table ── */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-zinc-50/50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700 text-left text-zinc-500 dark:text-zinc-400">
                            <th className="py-2.5 px-4 font-semibold text-center w-16">번호</th>
                            <th className="py-2.5 px-4 font-semibold text-center w-32">유형</th>
                            <th className="py-2.5 px-4 font-semibold text-center w-40">점수</th>
                            <th className="py-2.5 px-4 font-semibold text-center w-32">선수명</th>
                            <th className="py-2.5 px-4 font-semibold text-center w-24">날짜</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {tests.map((test, idx) => {
                            const colors = TEST_TYPE_COLORS[test.type];
                            return (
                                <tr
                                    key={test.id}
                                    onClick={() => router.push(`/training/tests/${test.id}`)}
                                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                                >
                                    <td className="py-3.5 px-4 text-center text-zinc-500 dark:text-zinc-500">
                                        {totalCount > 0 ? totalCount - idx : tests.length - idx}
                                    </td>
                                    <td className="py-3.5 px-4">
                                        <div className="flex justify-center">
                                            <span className={cn(
                                                "text-[12px] font-semibold whitespace-nowrap",
                                                colors.text
                                            )}>
                                                {typeLabelShort[test.type]}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="py-3.5 px-4">
                                        <div className="flex justify-center">
                                            <span className={cn(
                                                "text-lg font-black italic tracking-tighter",
                                                (test.totalScore || 0) > 0 ? "text-blue-600" : (test.totalScore || 0) < 0 ? "text-brand-red" : "text-zinc-400"
                                            )}>
                                                {(test.totalScore || 0) > 0 ? `+${test.totalScore?.toFixed(2)}` : test.totalScore?.toFixed(2)}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="py-3.5 px-4">
                                        <div className="flex justify-center">
                                            <span className="text-zinc-700 dark:text-zinc-300 font-bold truncate">
                                                {test.playerName}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="py-3.5 px-4 text-center text-zinc-500 dark:text-zinc-500 font-medium">
                                        {test.date.slice(5).replace("-", ".")}
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
