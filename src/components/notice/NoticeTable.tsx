"use client";

import { useRouter } from "next/navigation";
import { Notice, NOTICE_TYPE_LABELS, NoticeType, NOTICE_TYPE_COLORS, getPlainText } from "@/lib/notice-sync";
import { cn } from "@/lib/utils";

interface NoticeTableProps {
    notices: Notice[];
}

export function NoticeTable({ notices }: NoticeTableProps) {
    const router = useRouter();

    return (
        <>
            {/* ── Mobile Card Grid ── */}
            <div className="flex flex-col gap-2 md:hidden">
                {notices.map((notice) => {
                    const styles = NOTICE_TYPE_COLORS[notice.type];
                    return (
                        <button
                            key={notice.id}
                            onClick={() => {
                                sessionStorage.setItem("gla_community_keep_alive", "true");
                                router.push(`/community/${notice.id}`);
                            }}
                            className={cn(
                                "w-full text-left bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-l-4 rounded-xl px-4 py-3.5 hover:shadow-sm active:scale-[0.99] transition-all",
                                styles.border
                            )}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className={cn("shrink-0 inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide", styles.bg, styles.text)}>
                                        {NOTICE_TYPE_LABELS[notice.type]}
                                    </span>
                                    <span className="shrink-0 inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                                        {notice.branch}
                                    </span>
                                    {notice.isImportant && (
                                        <span className="text-[10px] font-bold text-red-500 border border-red-200 px-1.5 py-0.5 rounded bg-red-50">중요</span>
                                    )}
                                </div>
                            </div>
                            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3 truncate text-left">
                                {notice.title}
                            </h3>
                            <div className="flex items-center justify-end gap-2 text-zinc-400 dark:text-zinc-500">
                                <span className="text-[11px] font-medium">{notice.author}</span>
                                <span className="text-[10px] opacity-30">|</span>
                                <span className="text-[11px] font-medium">
                                    {notice.date.replace(/-/g, ".")}
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
                            <th className="py-2.5 px-4 font-semibold text-center w-16 whitespace-nowrap">번호</th>
                            <th className="py-2.5 px-4 font-semibold text-center w-24">유형</th>
                            <th className="py-2.5 px-4 font-semibold text-center w-24">지점</th>
                            <th className="py-2.5 px-4 font-semibold text-center">제목</th>
                            <th className="py-2.5 px-4 font-semibold text-center w-24">작성자</th>
                            <th className="py-2.5 px-4 font-semibold text-center w-24">날짜</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {notices.map((notice, idx) => {
                            const styles = NOTICE_TYPE_COLORS[notice.type];
                            return (
                                <tr
                                    key={notice.id}
                                    onClick={() => {
                                        sessionStorage.setItem("gla_community_keep_alive", "true");
                                        router.push(`/community/${notice.id}`);
                                    }}
                                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                                >
                                    <td className="py-3.5 px-4 text-center text-zinc-500 dark:text-zinc-500">
                                        {notices.length - idx}
                                    </td>
                                    <td className="py-3.5 px-4 text-center">
                                        <span className={cn("inline-flex items-center justify-center w-16 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide", styles.bg, styles.text)}>
                                            {NOTICE_TYPE_LABELS[notice.type]}
                                        </span>
                                    </td>
                                    <td className="py-3.5 px-4 text-center">
                                        <span className="inline-flex items-center justify-center w-16 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                                            {notice.branch}
                                        </span>
                                    </td>
                                    <td className="py-3.5 px-4 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            {notice.isImportant && (
                                                <span className="shrink-0 text-[10px] font-bold text-red-500 border border-red-200 px-1.5 py-0.5 rounded bg-red-50">중요</span>
                                            )}
                                            <span className="text-zinc-700 dark:text-zinc-300 font-medium truncate">
                                                {notice.title}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="py-3.5 px-4 text-center text-zinc-600 dark:text-zinc-400 truncate">
                                        {notice.author}
                                    </td>
                                    <td className="py-3.5 px-4 text-center text-zinc-500 dark:text-zinc-500">
                                        {notice.date.slice(5).replace("-", ".")}
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
