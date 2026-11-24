"use client";

import { useRouter } from "next/navigation";
import { Notice, NOTICE_TYPE_LABELS, NOTICE_TYPE_COLORS } from "@/lib/notice-sync";
import { cn } from "@/lib/utils";
import { Bell } from "lucide-react";

interface NoticeTableProps {
    notices: Notice[];
    totalCount?: number;
}

export function NoticeTable({ notices, totalCount }: NoticeTableProps) {
    const router = useRouter();

    const handleRowClick = (id: string) => {
        sessionStorage.setItem("gla_community_keep_alive", "true");
        router.push(`/community/${id}`);
    };

    return (
        <>
            {/* ── Mobile Card Grid (hidden on md+) ── */}
            <div className="flex flex-col gap-2.5 md:hidden">
                {notices.map((notice) => {
                    const styles = NOTICE_TYPE_COLORS[notice.type] || NOTICE_TYPE_COLORS.all;
                    return (
                        <button
                            key={notice.id}
                            onClick={() => handleRowClick(notice.id)}
                            className="w-full text-left bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 py-4 px-6 shadow-sm hover:border-brand-navy/30 hover:shadow-md transition-all group"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", styles.bg, styles.text)}>
                                        <Bell size={16} />
                                    </div>
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <span className="text-sm font-bold text-zinc-600 dark:text-zinc-300 truncate">
                                            {NOTICE_TYPE_LABELS[notice.type]}
                                        </span>
                                        {notice.isImportant && (
                                            <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-md shrink-0">
                                                중요
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {notice.branch && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 shrink-0 mr-1">
                                        {notice.branch}
                                    </span>
                                )}
                            </div>

                            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 mt-2.5 line-clamp-1">
                                {notice.title}
                            </h3>

                            <div className="flex items-end justify-between mt-2">
                                <span className="text-[11px] font-bold text-zinc-400 shrink-0">
                                    {notice.date.slice(5).replace(/-/g, ".")} <span className="opacity-40 font-normal mx-0.5">|</span> {notice.author}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* ── Desktop Table (hidden on mobile) ── */}
            <div className="hidden md:block bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-zinc-50/50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700 text-left text-zinc-500 dark:text-zinc-400">
                                <th className="py-2.5 px-4 font-semibold text-center w-16 whitespace-nowrap">번호</th>
                                <th className="py-2.5 px-4 font-semibold text-center w-28">유형</th>
                                <th className="py-2.5 px-4 font-semibold text-center w-24">지점</th>
                                <th className="py-2.5 px-4 font-semibold text-center">제목</th>
                                <th className="py-2.5 px-4 font-semibold text-center w-24">작성자</th>
                                <th className="py-2.5 px-4 font-semibold text-center w-24">날짜</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {notices.map((notice, idx) => {
                                const styles = NOTICE_TYPE_COLORS[notice.type] || NOTICE_TYPE_COLORS.all;
                                return (
                                    <tr
                                        key={notice.id}
                                        onClick={() => handleRowClick(notice.id)}
                                        className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                                    >
                                        <td className="py-3.5 px-4 text-center text-zinc-500 dark:text-zinc-500">
                                            {(totalCount ?? notices.length) - idx}
                                        </td>
                                        <td className="py-3.5 px-4 text-center">
                                            <span className="text-[12px] font-semibold whitespace-nowrap text-zinc-900 dark:text-zinc-100">
                                                {NOTICE_TYPE_LABELS[notice.type]}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-4 text-center">
                                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                                                {notice.branch}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                {notice.isImportant && (
                                                    <span className="shrink-0 text-white bg-red-500 px-1.5 py-0.5 rounded-md text-[10px] font-bold">
                                                        중요
                                                    </span>
                                                )}
                                                <span className="text-zinc-700 dark:text-zinc-300 font-bold truncate max-w-md">
                                                    {notice.title}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-4 text-center text-zinc-600 dark:text-zinc-400 truncate">
                                            {notice.author}
                                        </td>
                                        <td className="py-3.5 px-4 text-center text-zinc-500 dark:text-zinc-500">
                                            {notice.date.slice(5).replace(/-/g, ".")}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
