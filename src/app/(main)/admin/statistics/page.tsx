"use client";

import React, { useState, useEffect } from "react";
import {
    BarChart3,
    Filter,
    X,
    RefreshCw,
} from "lucide-react";
import { fetchMonthlyStatistics, MonthlyStatistic, fetchCoachMonthlyStatistics, CoachMonthlyStatistic } from "@/lib/statistics-sync";
import { format } from "date-fns";

export default function StatisticsPage() {
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
    const [selectedUser, setSelectedUser] = useState("");
    const [tab, setTab] = useState<"athlete" | "coach">("athlete");
    const [selectedBranch, setSelectedBranch] = useState("전체");
    const [selectedCoach, setSelectedCoach] = useState("전체");
    const [data, setData] = useState<MonthlyStatistic[]>([]);
    const [coachData, setCoachData] = useState<CoachMonthlyStatistic[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const loadData = async (forceRefresh = false) => {
        setIsLoading(true);
        const [year, month] = selectedMonth.split("-").map(Number);
        const cacheKey = `gla_admin_stats_${year}_${month}`;

        if (!forceRefresh) {
            const cached = sessionStorage.getItem(cacheKey);
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    setData(parsed.stats);
                    setCoachData(parsed.cStats);
                    setIsLoading(false);
                    return;
                } catch(e) {}
            }
        }

        const stats = await fetchMonthlyStatistics(year, month);
        const cStats = await fetchCoachMonthlyStatistics(year, month);
        
        setData(stats);
        setCoachData(cStats);
        sessionStorage.setItem(cacheKey, JSON.stringify({ stats, cStats }));
        setIsLoading(false);
    };

    useEffect(() => {
        loadData();
    }, [selectedMonth]);

    const branches = ["전체", "조이마루점", "구미점", "미지정"];
    const rawCoaches = Array.from(new Set(data.map(d => d.coach))).filter(Boolean).sort();
    const coaches = [
        "전체",
        ...rawCoaches.filter(c => c !== "미지정"),
        ...(rawCoaches.includes("미지정") ? ["미지정"] : [])
    ];

    const filteredData = data.filter(d => {
        const matchUser = !selectedUser || d.name.includes(selectedUser) || d.coach.includes(selectedUser);
        const matchBranch = selectedBranch === "전체" || d.branch === selectedBranch;
        const matchCoach = selectedCoach === "전체" || d.coach === selectedCoach;
        return matchUser && matchBranch && matchCoach;
    });

    const filteredCoachData = coachData.filter(d => {
        const matchUser = !selectedUser || d.name.includes(selectedUser);
        const matchBranch = selectedBranch === "전체" || d.branch === selectedBranch;
        return matchUser && matchBranch;
    });

    return (
        <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
            <div className="mb-6">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight flex items-center gap-2">
                    <BarChart3 className="text-brand-navy" size={28} />
                    운영 통계
                </h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">지정된 기간 동안의 지표를 분석합니다.</p>
            </div>

            {/* Tabs */}
            <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl w-fit mb-6">
                <button 
                    onClick={() => setTab("athlete")}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === "athlete" ? "bg-white shadow-sm text-zinc-900" : "text-zinc-500"}`}
                >
                    선수 통계
                </button>
                <button 
                    onClick={() => setTab("coach")}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === "coach" ? "bg-white shadow-sm text-zinc-900" : "text-zinc-500"}`}
                >
                    코치 통계
                </button>
            </div>

            {/* Branch and Coach Filter Card */}
            <div className="mb-6 bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
                <div className="space-y-3 w-full overflow-hidden">
                    <label className="block text-base font-bold text-zinc-900 dark:text-zinc-100">지점 선택</label>
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 -mb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        {branches.map(b => (
                            <button
                                key={b}
                                onClick={() => setSelectedBranch(b)}
                                className={`px-4 py-2 rounded-full text-sm transition-all whitespace-nowrap shrink-0 ${
                                    selectedBranch === b
                                        ? "bg-brand-navy text-white font-bold shadow-md"
                                        : "bg-white text-zinc-600 border border-zinc-200 font-medium hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                }`}
                            >
                                {b}
                            </button>
                        ))}
                    </div>
                </div>

                {tab === "athlete" && (
                <div className="space-y-3 w-full overflow-hidden">
                    <label className="block text-base font-bold text-zinc-900 dark:text-zinc-100">담임 코치</label>
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 -mb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        {coaches.map(c => (
                            <button
                                key={c}
                                onClick={() => setSelectedCoach(c)}
                                className={`px-4 py-2 rounded-full text-sm transition-all whitespace-nowrap shrink-0 ${
                                    selectedCoach === c
                                        ? "bg-brand-navy text-white font-bold shadow-md"
                                        : "bg-white text-zinc-600 border border-zinc-200 font-medium hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                }`}
                            >
                                {c === "전체" ? "ALL" : c}
                            </button>
                        ))}
                    </div>
                </div>
                )}
            </div>

            {/* Filter Card */}
            <div className="mb-6 bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-zinc-900 dark:text-zinc-100">월별 기준</label>
                    <div className="flex items-center gap-2">
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent transition-all"
                        />
                        <button 
                            onClick={() => loadData(true)}
                            disabled={isLoading}
                            className="flex items-center justify-center p-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl text-zinc-600 dark:text-zinc-400 transition-colors"
                            title="최신 데이터 다시 불러오기"
                        >
                            <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
                        </button>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-zinc-900 dark:text-zinc-100">대상 검색</label>
                    <div className="relative">
                        <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input
                            type="text"
                            value={selectedUser}
                            onChange={(e) => setSelectedUser(e.target.value)}
                            placeholder="코치 또는 선수 이름 검색..."
                            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent dark:text-zinc-300 placeholder:text-zinc-400 shadow-sm transition-all"
                        />
                        {selectedUser && (
                            <button onClick={() => setSelectedUser("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors">
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>

            </div>

            {/* Detailed Table View */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/20">
                    <h3 className="font-bold text-zinc-900 dark:text-zinc-50">세부 항목 리스트</h3>
                    <button className="text-xs font-bold text-brand-navy dark:text-brand-navy-light hover:underline">엑셀 다운로드</button>
                </div>
                <div className="overflow-x-auto w-full">
                    <div className="inline-block min-w-full align-middle relative">
                        {isLoading && (
                            <div className="absolute inset-0 bg-white/50 dark:bg-zinc-900/50 flex items-center justify-center z-20 backdrop-blur-[1px]">
                                <span className="text-sm font-bold text-brand-navy">불러오는 중...</span>
                            </div>
                        )}
                        {tab === "athlete" ? (
                        <table className="min-w-full text-sm text-left border-collapse">
                            <thead className="text-[11px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                                <tr>
                                    <th className="px-6 py-4 font-bold sticky left-0 z-10 bg-zinc-50 dark:bg-zinc-800/20 border-r border-zinc-100 dark:border-zinc-800 whitespace-nowrap shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">이름</th>
                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">담임 코치</th>
                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">레슨 (담임)</th>
                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">훈련 (담임)</th>
                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">챌린지</th>
                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">스코어</th>
                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">상담</th>
                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">훈련일지</th>
                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">훈련 계획</th>
                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">선수 레포트 조회</th>
                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">접속</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/30">
                                {filteredData.length === 0 && !isLoading ? (
                                    <tr>
                                        <td colSpan={10} className="px-6 py-12 text-center text-zinc-500">데이터가 없습니다.</td>
                                    </tr>
                                ) : (
                                    filteredData.map((d) => (
                                        <tr key={d.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors group">
                                            <td className="px-6 py-4 font-bold text-zinc-900 dark:text-zinc-100 sticky left-0 z-10 bg-white dark:bg-zinc-900 group-hover:bg-zinc-50 dark:group-hover:bg-zinc-800/40 border-r border-zinc-100 dark:border-zinc-800 whitespace-nowrap shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] transition-colors">
                                                {d.name}
                                            </td>
                                            <td className="px-6 py-4 text-center font-medium text-zinc-800 dark:text-zinc-200 whitespace-nowrap">{d.coach}</td>
                                            <td className="px-6 py-4 text-center font-medium text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                                                {d.lesson.toLocaleString()} <span className="text-brand-navy font-bold">({d.lessonByCoach.toLocaleString()})</span>
                                            </td>
                                            <td className="px-6 py-4 text-center font-medium text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                                                {d.training.toLocaleString()} <span className="text-brand-navy font-bold">({d.trainingByCoach.toLocaleString()})</span>
                                            </td>
                                            <td className="px-6 py-4 text-center font-medium text-zinc-600 dark:text-zinc-400">{d.challenge.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-center font-medium text-zinc-600 dark:text-zinc-400">{d.score.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-center font-medium text-zinc-600 dark:text-zinc-400">{d.consultation.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-center font-medium text-zinc-600 dark:text-zinc-400">{d.trainingLog.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-center font-medium text-zinc-600 dark:text-zinc-400">{d.trainingPlan?.toLocaleString() || 0}</td>
                                            <td className="px-6 py-4 text-center font-medium text-zinc-600 dark:text-zinc-400">{d.reportView.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-center font-medium text-zinc-600 dark:text-zinc-400">{d.login.toLocaleString()}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                        ) : (
                        <table className="min-w-full text-sm text-left border-collapse">
                            <thead className="text-[11px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                                <tr>
                                    <th className="px-6 py-4 font-bold sticky left-0 z-10 bg-zinc-50 dark:bg-zinc-800/20 border-r border-zinc-100 dark:border-zinc-800 whitespace-nowrap shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">이름 (지점)</th>
                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">레슨</th>
                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">훈련</th>
                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">챌린지</th>
                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">상담</th>
                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">댓글</th>
                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">레포트 작성률</th>
                                    <th className="px-6 py-4 font-bold text-center whitespace-nowrap">접속</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/30">
                                {filteredCoachData.length === 0 && !isLoading ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-12 text-center text-zinc-500">데이터가 없습니다.</td>
                                    </tr>
                                ) : (
                                    filteredCoachData.map((d) => (
                                        <tr key={d.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors group">
                                            <td className="px-6 py-4 font-bold text-zinc-900 dark:text-zinc-100 sticky left-0 z-10 bg-white dark:bg-zinc-900 group-hover:bg-zinc-50 dark:group-hover:bg-zinc-800/40 border-r border-zinc-100 dark:border-zinc-800 whitespace-nowrap shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] transition-colors">
                                                {d.name} <span className="font-normal text-zinc-400">({d.branch})</span>
                                            </td>
                                            <td className="px-6 py-4 text-center font-medium text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{d.lesson.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-center font-medium text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{d.training.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-center font-medium text-zinc-600 dark:text-zinc-400">{d.challenge.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-center font-medium text-zinc-600 dark:text-zinc-400">{d.consultation.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-center font-medium text-zinc-600 dark:text-zinc-400">{d.comment.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-center font-medium text-zinc-600 dark:text-zinc-400">{d.reportRate}%</td>
                                            <td className="px-6 py-4 text-center font-medium text-zinc-600 dark:text-zinc-400">{d.login.toLocaleString()}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
