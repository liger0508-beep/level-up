"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from 'next/link';
import {
    Flag,
    Plus,
    Search,
    ChevronLeft,
    ChevronRight,
    SlidersHorizontal,
    Megaphone,
    Play,
    PlayCircle
} from "lucide-react";
import { 
    CourseManagementRecord, 
    fetchCourseRecords, 
    COURSE_CAT_LABELS, 
    COURSE_CAT_COLORS 
} from "@/lib/course-management-sync";
import { cn } from "@/lib/utils";
import { DatePickerInput } from "@/components/ui/DatePickerInput";
import { DatePresets, DatePresetType } from "@/components/ui/DatePresets";

export default function CourseManagementPage() {
    const [records, setRecords] = useState<CourseManagementRecord[]>([]);
    const [activeCat, setActiveCat] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [activePreset, setActivePreset] = useState<DatePresetType>("custom");
    const [displayLimit, setDisplayLimit] = useState(20);
    const [isLoading, setIsLoading] = useState(true);

    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchCourseRecords().then((data) => {
            setRecords(data);
            setIsLoading(false);
        });
    }, []);

    const scroll = (direction: "left" | "right") => {
        if (scrollRef.current) {
            const { current } = scrollRef;
            const scrollAmount = 300;
            current.scrollBy({
                left: direction === "left" ? -scrollAmount : scrollAmount,
                behavior: "smooth",
            });
        }
    };

    // Filtered records
    const filteredRecords = useMemo(() => {
        return records.filter((r) => {
            const catMatch = activeCat === "all" || r.category === activeCat;
            const titleMatch = !searchQuery || 
                r.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                r.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                r.playerName.toLowerCase().includes(searchQuery.toLowerCase());
            const afterStart = !startDate || r.date >= startDate;
            const beforeEnd = !endDate || r.date <= endDate;
            return catMatch && titleMatch && afterStart && beforeEnd;
        });
    }, [records, activeCat, searchQuery, startDate, endDate]);

    // Recent 3 records for top carousel
    const recentRecords = useMemo(() => {
        return [...records]
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .slice(0, 3);
    }, [records]);

    const displayedRecords = filteredRecords.slice(0, displayLimit);

    return (
        <div className="p-4 sm:p-8 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <Flag size={24} className="text-brand-navy dark:text-brand-navy-light shrink-0" />
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                        골프IQ
                    </h1>
                </div>
                <Link
                    href="/course-management/create"
                    className="bg-brand-red hover:bg-brand-red-dark text-white px-5 py-2 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1.5 shrink-0"
                >
                    <Plus size={18} />
                    작성
                </Link>
            </div>

            {/* Category Filters */}
            <div className="flex flex-nowrap gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                {Object.entries(COURSE_CAT_LABELS).map(([key, label]) => {
                    const isActive = activeCat === key;
                    return (
                        <button
                            key={key}
                            onClick={() => setActiveCat(key)}
                            className={cn(
                                "whitespace-nowrap shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all border",
                                isActive
                                    ? "bg-brand-navy text-white border-brand-navy shadow-md"
                                    : "bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-brand-navy/50 hover:text-brand-navy dark:hover:text-white"
                            )}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>

            {/* Recent Records Carousel */}
            <div className="mb-4">
                <div className="flex items-center justify-between mb-3 px-1">
                    <h2 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                        <Megaphone size={16} className="text-brand-navy dark:text-brand-navy-light" />
                        최근 매니지먼트 영상
                    </h2>
                </div>

                <div className="relative group/scroll">
                    <button
                        onClick={() => scroll("left")}
                        className="absolute left-[-20px] top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full shadow-lg flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-brand-navy dark:hover:text-brand-navy-light transition-all opacity-0 group-hover/scroll:opacity-100 hidden md:flex"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <button
                        onClick={() => scroll("right")}
                        className="absolute right-[-20px] top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full shadow-lg flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-brand-navy dark:hover:text-brand-navy-light transition-all opacity-0 group-hover/scroll:opacity-100 hidden md:flex"
                    >
                        <ChevronRight size={20} />
                    </button>

                    <div
                        ref={scrollRef}
                        className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide -mx-1 px-1"
                    >
                        {recentRecords.map((record) => (
                            <Link
                                key={record.id}
                                href={`/course-management/${record.id}`}
                                className={cn(
                                    "flex-shrink-0 w-64 md:w-72 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-l-4 p-4 rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer group flex flex-col",
                                    COURSE_CAT_COLORS[record.category]?.border || "border-l-zinc-200"
                                )}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className={cn(
                                        "text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider",
                                        COURSE_CAT_COLORS[record.category].bg,
                                        COURSE_CAT_COLORS[record.category].text
                                    )}>
                                        {COURSE_CAT_LABELS[record.category]}
                                    </span>
                                </div>
                                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-brand-navy dark:group-hover:text-brand-navy-light transition-colors line-clamp-1 mb-3 text-[15px]">
                                    {record.title}
                                </h3>
                                <div className="text-[11px] text-zinc-400 font-medium flex items-center justify-end gap-2 mt-auto pt-2 border-t border-zinc-50 dark:border-zinc-800/50">
                                    <span>{record.playerName} 선수</span>
                                    <span className="opacity-30">|</span>
                                    <span>{record.date.replace(/-/g, ".")}</span>
                                </div>
                            </Link>
                        ))}
                        {recentRecords.length === 0 && !isLoading && (
                            <div className="w-full py-12 text-center text-zinc-400 text-sm font-medium border-2 border-dashed border-zinc-100 dark:border-zinc-800 rounded-2xl">
                                등록된 최근 영상이 없습니다.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 mb-6 shadow-sm">
                <div className="flex items-center gap-2">
                    <label className="w-20 shrink-0 text-center text-sm font-bold text-zinc-700 dark:text-zinc-300">
                        기간
                    </label>
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <DatePickerInput
                            value={startDate}
                            onChange={(e) => { setStartDate(e.target.value); setActivePreset("custom"); }}
                            className="flex-1 min-w-0 px-2 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-[13px] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all text-center"
                        />
                        <span className="text-zinc-400 shrink-0 text-xs">~</span>
                        <DatePickerInput
                            value={endDate}
                            onChange={(e) => { setEndDate(e.target.value); setActivePreset("custom"); }}
                            className="flex-1 min-w-0 px-2 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-[13px] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all text-center"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2 mt-3">
                    <label className="w-20 shrink-0 text-center text-sm font-bold text-zinc-700 dark:text-zinc-300">
                        검색
                    </label>
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input
                            type="text"
                            placeholder="키워드, 내용, 선수명 검색..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all"
                        />
                    </div>
                </div>
            </div>

            {/* List Results Section */}
            <section className="mt-8">
                <div className="flex items-center justify-between mb-4 px-1">
                    <div className="flex items-center gap-2">
                        <PlayCircle size={18} className="text-brand-navy dark:text-brand-navy-light" />
                        <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-200">
                            조회 결과
                        </h2>
                        <span className="text-xs text-zinc-400 font-medium">
                            ({filteredRecords.length}건)
                        </span>
                    </div>

                    <DatePresets
                        activePreset={activePreset}
                        onPresetChange={(start, end, preset) => {
                            setStartDate(start);
                            setEndDate(end);
                            setActivePreset(preset);
                        }}
                    />
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm overflow-hidden">
                    {/* ── Mobile Card Grid ── */}
                    <div className="flex flex-col gap-2 md:hidden">
                        {displayedRecords.map((item, idx) => (
                            <button
                                key={item.id}
                                onClick={() => window.location.href = `/course-management/${item.id}`}
                                className={cn(
                                    "w-full text-left bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-l-4 rounded-xl px-4 py-3.5 hover:shadow-sm active:scale-[0.99] transition-all",
                                    COURSE_CAT_COLORS[item.category].border
                                )}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className={cn("shrink-0 inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide", COURSE_CAT_COLORS[item.category].bg, COURSE_CAT_COLORS[item.category].text)}>
                                        {COURSE_CAT_LABELS[item.category]}
                                    </span>
                                    <span className="text-[10px] text-zinc-400 font-bold">Player: {item.playerName}</span>
                                </div>
                                <div className="flex flex-wrap gap-1 mb-3">
                                    {item.title.split(", ").map((kw, idx) => (
                                        <span key={idx} className="text-[15px] text-zinc-900 dark:text-zinc-100 font-bold">
                                            #{kw}
                                        </span>
                                    ))}
                                </div>
                                <div className="flex items-center justify-end gap-2 text-zinc-400 text-[11px] font-medium pt-2 border-t border-zinc-50 dark:border-zinc-800/50">
                                    <span>{item.coachName}</span>
                                    <span className="opacity-30">|</span>
                                    <span>{item.date.replace(/-/g, ".")}</span>
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* ── Desktop Table ── */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-zinc-50/50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700 text-left text-zinc-500 dark:text-zinc-400">
                                    <th className="py-2.5 px-4 font-semibold text-center w-16 whitespace-nowrap">번호</th>
                                    <th className="py-2.5 px-4 font-semibold text-center w-24">유형</th>
                                    <th className="py-2.5 px-4 font-semibold text-center">키워드</th>
                                    <th className="py-2.5 px-4 font-semibold text-center w-24">선수</th>
                                    <th className="py-2.5 px-4 font-semibold text-center w-24">작성자</th>
                                    <th className="py-2.5 px-4 font-semibold text-center w-24">날짜</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {displayedRecords.map((item, idx) => (
                                    <tr
                                        key={item.id}
                                        onClick={() => window.location.href = `/course-management/${item.id}`}
                                        className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                                    >
                                        <td className="py-3.5 px-4 text-center text-zinc-500">
                                            {filteredRecords.length - idx}
                                        </td>
                                        <td className="py-3.5 px-4 text-center">
                                            <span className={cn("inline-flex items-center justify-center w-16 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide", COURSE_CAT_COLORS[item.category].bg, COURSE_CAT_COLORS[item.category].text)}>
                                                {COURSE_CAT_LABELS[item.category]}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-4 text-center">
                                            <div className="flex flex-wrap justify-center gap-1">
                                                {item.title.split(", ").map((kw, idx) => (
                                                    <span key={idx} className="text-[13px] text-zinc-900 dark:text-zinc-100 font-bold whitespace-nowrap">
                                                        #{kw}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-4 text-center text-zinc-600 dark:text-zinc-400 truncate">
                                            {item.playerName}
                                        </td>
                                        <td className="py-3.5 px-4 text-center text-zinc-600 dark:text-zinc-400 truncate">
                                            {item.coachName}
                                        </td>
                                        <td className="py-3.5 px-4 text-center text-zinc-500">
                                            {item.date.slice(5).replace("-", ".")}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {displayedRecords.length === 0 && !isLoading && (
                        <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
                            <Megaphone size={40} className="mb-4 text-zinc-200" />
                            <p className="text-sm font-medium">검색 결과가 없습니다.</p>
                        </div>
                    )}

                    {filteredRecords.length > displayLimit && (
                        <div className="mt-8 flex justify-center">
                            <button
                                onClick={() => setDisplayLimit(prev => prev + 20)}
                                className="px-8 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all active:scale-95 shadow-sm"
                            >
                                더 보기 ({filteredRecords.length - displayLimit}건 남음)
                            </button>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
