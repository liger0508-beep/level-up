"use client";

import { useRouter } from "next/navigation";
import { CourseInfo } from "@/lib/course-info-sync";
import { cn } from "@/lib/utils";
import { Map, Layout } from "lucide-react";

interface CourseInfoTableProps {
    courseInfos: CourseInfo[];
}

function parseCourseContent(contentStr: string) {
    try {
        const parsed = JSON.parse(contentStr);
        return {
            courseInput: parsed.courseInput || "",
            courseDescription: parsed.courseDescription || ""
        };
    } catch (e) {
        return { courseInput: "", courseDescription: contentStr };
    }
}

export function CourseInfoTable({ courseInfos }: CourseInfoTableProps) {
    const router = useRouter();

    return (
        <>
            {/* ── Mobile Card Grid ── */}
            <div className="flex flex-col gap-2 md:hidden">
                {courseInfos.map((courseInfo) => {
                    const parsed = parseCourseContent(courseInfo.content);
                    return (
                        <button
                            key={courseInfo.id}
                            onClick={() => router.push(`/course-info/${courseInfo.id}`)}
                            className="w-full text-left bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-l-4 border-l-brand-navy rounded-xl px-4 py-3.5 hover:shadow-sm active:scale-[0.99] transition-all"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="shrink-0 inline-flex items-center gap-1 justify-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide bg-brand-navy/10 text-brand-navy dark:bg-brand-navy/20 dark:text-brand-navy-light">
                                        <Map size={10} />
                                        골프장
                                    </span>
                                    {parsed.courseInput && (
                                        <span className="shrink-0 inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                                            {parsed.courseInput}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3 truncate text-left">
                                {courseInfo.title}
                            </h3>
                            <div className="flex items-center justify-end gap-2 text-zinc-400 dark:text-zinc-500">
                                <span className="text-[11px] font-medium">{courseInfo.author || "관리자"}</span>
                                <span className="text-[10px] opacity-30">|</span>
                                <span className="text-[11px] font-medium">
                                    {courseInfo.date.replace(/-/g, ".")}
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
                            <th className="py-2.5 px-4 font-semibold text-center">골프장</th>
                            <th className="py-2.5 px-4 font-semibold text-center w-40">코스</th>
                            <th className="py-2.5 px-4 font-semibold text-center w-24">작성자</th>
                            <th className="py-2.5 px-4 font-semibold text-center w-24">작성일자</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {courseInfos.map((courseInfo, idx) => {
                            const parsed = parseCourseContent(courseInfo.content);
                            return (
                                <tr
                                    key={courseInfo.id}
                                    onClick={() => router.push(`/course-info/${courseInfo.id}`)}
                                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                                >
                                    <td className="py-3.5 px-4 text-center text-zinc-500 dark:text-zinc-500">
                                        {courseInfos.length - idx}
                                    </td>
                                    <td className="py-3.5 px-4 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <span className="text-zinc-700 dark:text-zinc-300 font-bold truncate">
                                                {courseInfo.title}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="py-3.5 px-4 text-center">
                                        {parsed.courseInput ? (
                                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                                                {parsed.courseInput}
                                            </span>
                                        ) : (
                                            <span className="text-zinc-300 dark:text-zinc-600">-</span>
                                        )}
                                    </td>
                                    <td className="py-3.5 px-4 text-center text-zinc-600 dark:text-zinc-400 truncate">
                                        {courseInfo.author || "관리자"}
                                    </td>
                                    <td className="py-3.5 px-4 text-center text-zinc-500 dark:text-zinc-500">
                                        {courseInfo.date.slice(5).replace("-", ".")}
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
