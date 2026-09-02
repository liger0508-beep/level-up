"use client";

import { ClipboardList } from "lucide-react";
import { useRouter } from "next/navigation";
import { TestData, TEST_TYPE_LABELS, TEST_TYPE_COLORS } from "@/lib/test-sync";
import { cn, formatScore } from "@/lib/utils";

const typeLabelShort: Record<string, string> = {
    ...TEST_TYPE_LABELS,
    short_game: "S/G",
    around_green: "S/G",
};

interface TestTableProps {
    tests: TestData[];
    totalCount?: number;
    basePath?: string;
}

export function TestTable({ tests, totalCount = 0, basePath = "/training/tests" }: TestTableProps) {
    const router = useRouter();

    return (
        <>
            {/* ── Mobile Card Grid ── */}
            <div className="flex flex-col gap-2.5 md:hidden">
                {tests.map((test) => {
                    const colors = TEST_TYPE_COLORS[test.type];
                    const typeLabel = (test.type === "short_game" || test.type === "around_green" ? "S/G" : (test.type === "shot" ? "SHOT" : (test.type === "putting" ? "PUTT" : test.type))).toUpperCase();
                    
                    const yy = test.date.slice(2, 4);
                    const mm = test.date.slice(5, 7);
                    const dd = test.date.slice(8, 10);
                    const formattedDate = `${yy}.${mm}.${dd}`;
                    
                    return (
                        <button
                            key={test.id}
                            onClick={() => router.push(`${basePath}/${test.id}`)}
                            className="w-full text-left bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 py-4 px-6 shadow-sm hover:border-brand-navy/30 hover:shadow-md transition-all group cursor-pointer"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", colors?.bg, colors?.text)}>
                                        <ClipboardList size={16} />
                                    </div>
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <span className="text-sm font-bold text-zinc-600 dark:text-zinc-300 truncate mr-1">{typeLabel}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 mr-2">
                                    <span className={cn(
                                        "text-[14px] font-black shrink-0",
                                        (test.totalScore || 0) > 0 ? "text-blue-600" : (test.totalScore || 0) < 0 ? "text-brand-red" : "text-zinc-400"
                                    )}>
                                        {formatScore(test.totalScore)}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="flex items-end justify-between mt-3">
                                <span className="text-[11px] font-bold text-zinc-400 shrink-0 mb-0.5 pl-[40px]">
                                    {test.date.slice(5).replace("-", ".")}
                                </span>
                                <span className="text-sm font-bold text-zinc-600 dark:text-zinc-300 truncate mr-2">
                                    {test.playerName}
                                </span>
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
                                    onClick={() => router.push(`${basePath}/${test.id}`)}
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
                                                "text-sm font-black italic tracking-tighter",
                                                (test.totalScore || 0) > 0 ? "text-blue-600" : (test.totalScore || 0) < 0 ? "text-brand-red" : "text-zinc-400"
                                            )}>
                                            {formatScore(test.totalScore)}
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
