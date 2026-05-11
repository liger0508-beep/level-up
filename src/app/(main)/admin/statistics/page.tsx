"use client";

import React, { useState } from "react";
import {
    BarChart3,
    Calendar,
    Users,
    Target,
    BookOpen,
    Dumbbell,
    ClipboardList,
    Flag,
    MessageSquare,
    PenTool,
    LogIn,
    Filter,
    X,
    ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DatePickerInput } from "@/components/ui/DatePickerInput";

interface StatCardProps {
    title: string;
    value: number | string;
    icon: React.ElementType;
    color: string;
    trend?: {
        value: string;
        positive: boolean;
    };
}

function StatCard({ title, value, icon: Icon, color }: StatCardProps) {
    return (
        <div className="bg-white dark:bg-zinc-900 rounded-xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all overflow-hidden">
            {/* Color banner with icon + title */}
            <div className={cn("flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-3", color)}>
                <Icon size={16} className="text-white/90 shrink-0 sm:hidden" />
                <Icon size={20} className="text-white/90 shrink-0 hidden sm:block" />
                <span className="text-xs sm:text-sm font-bold text-white tracking-wide">{title}</span>
            </div>
            {/* Value */}
            <div className="px-3 py-2 sm:px-4 sm:py-3 flex justify-end">
                <p className="text-xl sm:text-2xl font-extrabold text-zinc-900 dark:text-zinc-50">{value}</p>
            </div>
        </div>
    );
}

export default function StatisticsPage() {
    const [dateRange, setDateRange] = useState({ start: "2026-04-01", end: "2026-04-30" });
    const [selectedUser, setSelectedUser] = useState("");

    const stats = [
        { title: "분석", value: 42, icon: Target, color: "bg-orange-500" },
        { title: "레슨", value: 128, icon: BookOpen, color: "bg-blue-500" },
        { title: "훈련", value: 86, icon: Dumbbell, color: "bg-emerald-500" },

        { title: "테스트", value: 31, icon: ClipboardList, color: "bg-rose-500" },
        { title: "스코어", value: 112, icon: Flag, color: "bg-sky-500" },
        { title: "훈련일지", value: 95, icon: PenTool, color: "bg-indigo-500" },
        { title: "상담", value: 18, icon: MessageSquare, color: "bg-amber-500" },
        { title: "댓글", value: 245, icon: MessageSquare, color: "bg-zinc-500" },
        { title: "접속수", value: "1,240", icon: LogIn, color: "bg-teal-500" },
    ];

    return (
        <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
            <div className="mb-6">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight flex items-center gap-2">
                    <BarChart3 className="text-brand-navy" size={28} />
                    운영 통계
                </h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">지정된 기간 동안의 지표를 분석합니다.</p>
            </div>

            {/* Filter Card - Two Rows as requested */}
            <div className="mb-6 bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
                {/* Row 1: Date Range */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <label className="text-sm font-bold text-zinc-900 dark:text-zinc-100 w-24 shrink-0">조회 기간</label>
                    <div className="flex items-center gap-2 flex-1">
                        <DatePickerInput
                            value={dateRange.start}
                            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                            className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl py-2.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 shadow-sm"
                        />
                        <span className="text-zinc-400">~</span>
                        <DatePickerInput
                            value={dateRange.end}
                            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                            className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl py-2.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 shadow-sm"
                        />
                    </div>
                </div>

                {/* Row 2: Search + Button */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <label className="text-sm font-bold text-zinc-900 dark:text-zinc-100 w-24 shrink-0">대상 검색</label>
                    <div className="flex flex-1 gap-3">
                        <div className="relative flex-1">
                            <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                            <input
                                type="text"
                                value={selectedUser}
                                onChange={(e) => setSelectedUser(e.target.value)}
                                placeholder="코치 또는 선수 이름 검색..."
                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none dark:text-zinc-300 placeholder:text-zinc-400 shadow-sm"
                            />
                            {selectedUser && (
                                <button onClick={() => setSelectedUser("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors">
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                        <button className="bg-brand-navy hover:bg-brand-navy-dark text-white px-8 py-2.5 rounded-xl text-sm font-bold shadow-md transition-all active:scale-95 whitespace-nowrap">
                            조회하기
                        </button>
                    </div>
                </div>
            </div>

            {/* Selection Overview Section - Now right under filters */}
            <div className="mb-8 grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Profile Snapshot or additional info */}
                <div className="lg:order-last bg-gradient-to-br from-brand-navy to-brand-navy-dark rounded-2xl p-5 text-white shadow-lg flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center border border-white/30 backdrop-blur-md">
                                <Users size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] text-white/70 font-medium uppercase tracking-wider">조회 대상</p>
                                <p className="text-lg font-bold">{selectedUser || "전체 인원"}</p>
                            </div>
                        </div>
                        <p className="text-xs text-white/80 leading-relaxed">
                            {dateRange.start.split("-").slice(1).join("/")} ~ {dateRange.end.split("-").slice(1).join("/")} 기간 동안 {selectedUser ? `${selectedUser}님` : "모든 인원"}의 요약 데이터입니다.
                        </p>
                    </div>
                </div>

                <div className="lg:col-span-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        {stats.map((stat, idx) => (
                            <StatCard
                                key={idx}
                                title={stat.title}
                                value={stat.value}
                                icon={stat.icon}
                                color={stat.color}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Detailed Table View */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/20">
                    <h3 className="font-bold text-zinc-900 dark:text-zinc-50">세부 항목 리스트</h3>
                    <button className="text-xs font-bold text-brand-navy dark:text-brand-navy-light hover:underline">엑셀 다운로드</button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-[11px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                            <tr>
                                <th className="px-6 py-4 font-bold">이름</th>
                                <th className="px-6 py-4 font-bold text-center">레슨</th>
                                <th className="px-6 py-4 font-bold text-center">분석</th>
                                <th className="px-6 py-4 font-bold text-center">훈련</th>
                                <th className="px-6 py-4 font-bold text-center">테스트</th>
                                <th className="px-6 py-4 font-bold text-center">활동 점수</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/30">
                            {[1, 2, 3, 4, 5].map((idx) => (
                                <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                                    <td className="px-6 py-4 font-bold text-zinc-900 dark:text-zinc-100">
                                        {["김민수", "이수진", "박도윤", "정세미", "최진혁"][idx - 1]}
                                    </td>
                                    <td className="px-6 py-4 text-center">2{idx}</td>
                                    <td className="px-6 py-4 text-center">{idx * 2}</td>
                                    <td className="px-6 py-4 text-center">1{idx}</td>

                                    <td className="px-6 py-4 text-center">5</td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="w-16 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full mx-auto overflow-hidden">
                                            <div className="bg-brand-navy h-full" style={{ width: `${70 + idx * 5}%` }} />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
