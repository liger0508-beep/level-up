"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from 'next/link';
import {
    MessageSquare,
    Plus,
    Search,
    ChevronLeft,
    ChevronRight,
    SlidersHorizontal,
    Megaphone
} from "lucide-react";
import { Journal, JournalType, JOURNAL_TYPE_LABELS, getPlainText, JOURNAL_TYPE_COLORS, fetchJournals } from "@/lib/journal-sync";
import { JournalTable } from "@/components/training-journal/JournalTable";
import { cn } from "@/lib/utils";
import { DatePickerInput } from "@/components/ui/DatePickerInput";
import { DatePresets, DatePresetType } from "@/components/ui/DatePresets";

export default function TrainingJournalPage() {
    const [activeType, setActiveType] = useState<JournalType>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [displayLimit, setDisplayLimit] = useState(20);
    const [activePreset, setActivePreset] = useState<DatePresetType>("custom");
    const [journals, setJournals] = useState<Journal[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchJournals().then(data => {
            setJournals(data);
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

    // Filtered journals for the main list
    const filteredJournals = useMemo(() => {
        return journals.filter((j) => {
            const typeMatch = activeType === "all" || j.type === activeType;
            const titleMatch = !searchQuery || j.title.toLowerCase().includes(searchQuery.toLowerCase()) || j.content.toLowerCase().includes(searchQuery.toLowerCase());
            const afterStart = !startDate || j.date >= startDate;
            const beforeEnd = !endDate || j.date <= endDate;
            return typeMatch && titleMatch && afterStart && beforeEnd;
        });
    }, [journals, activeType, searchQuery, startDate, endDate]);

    // Recent 3 journals for the top carousel
    const recentJournals = useMemo(() => {
        return [...journals]
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 3);
    }, [journals]);

    const displayedJournals = useMemo(() => {
        return filteredJournals.slice(0, displayLimit);
    }, [filteredJournals, displayLimit]);

    return (
        <div className="p-4 sm:p-8 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <MessageSquare size={24} className="text-brand-navy dark:text-brand-navy-light shrink-0" />
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                        훈련일지
                    </h1>
                </div>
                <Link
                    href="/admin/training-journal/create"
                    className="bg-brand-red hover:bg-brand-red-dark text-white px-5 py-2 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1.5 shrink-0"
                >
                    <Plus size={18} />
                    작성
                </Link>
            </div>

            {/* ── Type Filters ── */}
            <div className="flex flex-nowrap gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                {(Object.entries(JOURNAL_TYPE_LABELS) as [JournalType, string][]).map(([key, label]) => {
                    const isActive = activeType === key;
                    return (
                        <button
                            key={key}
                            onClick={() => setActiveType(key)}
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

            {/* ── Recent Journals (Top Carousel) ── */}
            <div className="mb-4">
                <div className="flex items-center justify-between mb-3 px-1">
                    <h2 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                        <Megaphone size={16} className="text-brand-navy dark:text-brand-navy-light" />
                        최근 게시물
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
                        {recentJournals.map((journal) => (
                            <Link
                                key={journal.id}
                                href={`/admin/training-journal/${journal.id}`}
                                className="flex-shrink-0 w-64 md:w-72 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm hover:border-brand-navy/50 hover:shadow-md transition-all active:scale-95 cursor-pointer group"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className={cn(
                                        "text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider",
                                        JOURNAL_TYPE_COLORS[journal.type].bg,
                                        JOURNAL_TYPE_COLORS[journal.type].text
                                    )}>
                                        {JOURNAL_TYPE_LABELS[journal.type]}
                                    </span>
                                    {journal.isImportant && (
                                        <span className="text-[10px] font-black text-brand-red ml-auto uppercase italic">Important</span>
                                    )}
                                </div>
                                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-brand-navy dark:group-hover:text-brand-navy-light transition-colors line-clamp-1 mb-3 text-[15px]">
                                    {journal.author}
                                </h3>
                                <div className="text-[11px] text-zinc-400 font-medium flex items-center justify-end gap-2 mt-auto pt-2 border-t border-zinc-50 dark:border-zinc-800/50">
                                    <span>{journal.date.replace(/-/g, ".")}</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Filter Bar ── */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 mb-6 shadow-sm">
                <div className="flex items-center gap-2">
                    <label className="w-20 shrink-0 text-center text-sm font-bold text-zinc-700 dark:text-zinc-300">
                        일자
                    </label>
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <DatePickerInput
                            value={startDate}
                            onClick={(e) => (e.target as any).showPicker?.()}
                            onChange={(e) => { setStartDate(e.target.value); setActivePreset("custom"); }}
                            className="flex-1 min-w-0 px-2 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-[13px] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all text-center cursor-pointer"
                        />
                        <span className="text-zinc-400 shrink-0 text-xs">~</span>
                        <DatePickerInput
                            value={endDate}
                            onClick={(e) => (e.target as any).showPicker?.()}
                            onChange={(e) => { setEndDate(e.target.value); setActivePreset("custom"); }}
                            className="flex-1 min-w-0 px-2 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-[13px] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all text-center cursor-pointer"
                        />
                    </div>
                    {(startDate || endDate) && (
                        <button
                            onClick={() => { setStartDate(""); setEndDate(""); }}
                            className="shrink-0 px-2 text-xs font-bold text-zinc-400 hover:text-zinc-600 transition-colors"
                        >
                            초기화
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2 mt-3">
                    <label className="w-20 shrink-0 text-center text-sm font-bold text-zinc-700 dark:text-zinc-300">
                        검색
                    </label>
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input
                            type="text"
                            placeholder="제목 또는 내용 검색..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all"
                        />
                    </div>
                </div>
            </div>

            {/* ── Journal List section ── */}
            <section>
                <div className="flex items-center justify-between mb-4 px-1">
                    <div className="flex items-center gap-2">
                        <SlidersHorizontal size={18} className="text-brand-navy dark:text-brand-navy-light" />
                        <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-200">
                            조회 결과
                        </h2>
                        <span className="text-xs text-zinc-400 font-medium">
                            ({filteredJournals.length}건)
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

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm overflow-hidden min-h-[300px]">
                    {displayedJournals.length > 0 ? (
                        <>
                            <JournalTable journals={displayedJournals} />
                            {filteredJournals.length > displayLimit && (
                                <div className="mt-8 flex justify-center">
                                    <button
                                        onClick={() => setDisplayLimit(prev => prev + 20)}
                                        className="px-8 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all active:scale-95 shadow-sm"
                                    >
                                        더 보기 ({filteredJournals.length - displayLimit}건 남음)
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
                            <Megaphone size={40} className="mb-4 text-zinc-200" />
                            <p className="text-sm font-medium">검색 결과가 없습니다.</p>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
