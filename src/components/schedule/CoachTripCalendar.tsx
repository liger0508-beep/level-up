"use client";

import React, { useState, useMemo } from "react";
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { MapPin, Users, Calendar, Search, SlidersHorizontal, Info, Car } from "lucide-react";
import { cn } from "@/lib/utils";
import { CoachTrip, CoachTripCategory } from "@/lib/coach-trip-sync";
import { DatePickerInput } from "@/components/ui/DatePickerInput";

interface CoachTripCalendarProps {
    trips: CoachTrip[];
}

const CATEGORY_COLORS: Record<CoachTripCategory, { dot: string; bg: string; text: string; border: string }> = {
    "대회 출장": { dot: "bg-blue-500", bg: "bg-blue-50", text: "text-blue-600", border: "border-l-blue-500" },
    "필드 레슨": { dot: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-600", border: "border-l-emerald-500" },
    "기타": { dot: "bg-teal-500", bg: "bg-teal-50", text: "text-teal-600", border: "border-l-teal-500" },
};

function getTripDateRange(t: CoachTrip): { start: string; end: string } {
    const year = t.year ?? new Date().getFullYear();
    const parts = t.date.split("~").map(s => s.trim());
    const startMD = parts[0];
    const endMD = parts[1] ?? startMD;

    const toFullDate = (md: string) => {
        if (/^\d{4}-/.test(md)) return md.slice(0, 10);
        return `${year}-${md}`;
    };

    return { start: toFullDate(startMD), end: toFullDate(endMD) };
}

type ActivePreset = "monthly" | "weekly" | "today" | "custom";

export function CoachTripCalendar({ trips }: CoachTripCalendarProps) {
    const today = new Date();

    const [startDate, setStartDate] = useState(format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"));
    const [endDate, setEndDate] = useState(format(endOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"));
    const [activePreset, setActivePreset] = useState<ActivePreset>("weekly");

    const [categoryFilter, setCategoryFilter] = useState<CoachTripCategory | "all">("all");
    const [searchQuery, setSearchQuery] = useState("");

    const [hasMounted, setHasMounted] = useState(false);
    React.useEffect(() => { setHasMounted(true); }, []);

    const applyPreset = (preset: "monthly" | "weekly" | "today") => {
        const now = new Date();
        if (preset === "monthly") {
            setStartDate(format(startOfMonth(now), "yyyy-MM-dd"));
            setEndDate(format(endOfMonth(now), "yyyy-MM-dd"));
        } else if (preset === "weekly") {
            setStartDate(format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"));
            setEndDate(format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"));
        } else {
            const todayStr = format(now, "yyyy-MM-dd");
            setStartDate(todayStr);
            setEndDate(todayStr);
        }
        setActivePreset(preset);
    };

    const filteredTrips = useMemo(() => {
        return trips.filter(t => {
            const categoryMatch = categoryFilter === "all" || t.category === categoryFilter;
            if (!categoryMatch) return false;

            const { start, end } = getTripDateRange(t);
            const dateMatch = (!startDate || end >= startDate) && (!endDate || start <= endDate);
            if (!dateMatch) return false;

            const searchMatch = !searchQuery ||
                t.participants.some(p => p.toLowerCase().includes(searchQuery.toLowerCase())) ||
                t.venue.toLowerCase().includes(searchQuery.toLowerCase()) ||
                t.remarks.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (t.vehicle || "").toLowerCase().includes(searchQuery.toLowerCase());

            return searchMatch;
        }).sort((a, b) => {
            const aStart = getTripDateRange(a).start;
            const bStart = getTripDateRange(b).start;
            return bStart.localeCompare(aStart);
        });
    }, [trips, categoryFilter, startDate, endDate, searchQuery]);

    const CATEGORIES: CoachTripCategory[] = ["대회 출장", "필드 레슨", "기타"];

    if (!hasMounted) return null;

    const presetBtnClass = (preset: ActivePreset) =>
        cn("px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200",
            activePreset === preset
                ? "bg-brand-navy text-white shadow-sm"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100"
        );

    return (
        <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                {/* Category Filter */}
                <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1">
                    <button
                        onClick={() => setCategoryFilter("all")}
                        className={cn("px-4 py-2 text-sm rounded-full font-semibold border transition-all duration-200 whitespace-nowrap shrink-0",
                            categoryFilter === "all"
                                ? "bg-brand-navy text-white border-brand-navy shadow-md"
                                : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                        )}>전체</button>
                    {CATEGORIES.map((cat) => (
                        <button key={cat}
                            onClick={() => setCategoryFilter(cat)}
                            className={cn("px-4 py-2 text-sm rounded-full font-semibold border transition-all duration-200 whitespace-nowrap shrink-0",
                                categoryFilter === cat
                                    ? "bg-brand-navy text-white border-brand-navy shadow-md"
                                    : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                            )}>{cat}</button>
                    ))}
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2">
                    <label className="w-16 shrink-0 text-center text-sm font-semibold text-zinc-700 dark:text-zinc-300">일정</label>
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <DatePickerInput

                            value={startDate}

                            onChange={(e) => { setStartDate(e.target.value); setActivePreset("custom"); }}
                            className="flex-1 min-w-0 px-2 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-[13px] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all text-center cursor-pointer"
                        />
                        <span className="text-zinc-400 shrink-0 text-xs">~</span>
                        <DatePickerInput

                            value={endDate}

                            onChange={(e) => { setEndDate(e.target.value); setActivePreset("custom"); }}
                            className="flex-1 min-w-0 px-2 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-[13px] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all text-center cursor-pointer"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2 mt-3">
                    <label className="w-16 shrink-0 text-center text-sm font-semibold text-zinc-700 dark:text-zinc-300">검색</label>
                    <div className="relative flex-1">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input
                            type="text"
                            placeholder="출장자, 장소, 비고 검색..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all"
                        />
                    </div>
                </div>
            </div>

            <div className="flex justify-end">
                <div className="flex items-center bg-transparent dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700">
                    <button onClick={() => applyPreset("monthly")} className={presetBtnClass("monthly")}>월간</button>
                    <button onClick={() => applyPreset("weekly")} className={presetBtnClass("weekly")}>주간</button>
                    <button onClick={() => applyPreset("today")} className={presetBtnClass("today")}>오늘</button>
                </div>
            </div>

            <div className="flex items-center justify-between px-1">
                <span className="font-bold text-base text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                    <SlidersHorizontal size={16} className="text-brand-navy" />
                    조회 결과 ({filteredTrips.length}건)
                </span>
            </div>

            <div className="flex flex-col gap-3 pb-10">
                {filteredTrips.length === 0 ? (
                    <div className="py-16 bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 text-center shadow-sm">
                        <Calendar size={36} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-700" />
                        <p className="text-zinc-400 text-sm font-medium">조회된 일정이 없습니다.</p>
                        <p className="text-zinc-300 dark:text-zinc-600 text-xs mt-1">기간 또는 필터를 변경해보세요.</p>
                    </div>
                ) : (
                    filteredTrips.map((t) => {
                        const colors = CATEGORY_COLORS[t.category];
                        const { start, end } = getTripDateRange(t);
                        return (
                            <div
                                key={t.id}
                                className={cn(
                                    "bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 border-l-4 shadow-sm hover:shadow-md transition-all p-4 active:scale-[0.98]",
                                    colors.border
                                )}
                            >
                                {/* Row 1: Category */}
                                <div className="mb-3">
                                    <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full uppercase shrink-0", colors.bg, colors.text)}>
                                        {t.category}
                                    </span>
                                </div>

                                {/* Row 2: Venue + Date + Vehicle */}
                                <div className="flex items-center justify-start gap-2 flex-wrap mb-2">
                                    <h3 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-50 shrink-0">{t.venue || "장소 미정"}</h3>
                                    <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-medium bg-transparent dark:bg-zinc-800/80 px-2.5 py-1 rounded-lg shrink-0">
                                        <Calendar size={13} className="shrink-0 text-zinc-400" />
                                        <span>{start.slice(5)} {start !== end && `~ ${end.slice(5)}`}</span>
                                    </div>
                                    {t.vehicle && (
                                        <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-medium bg-transparent dark:bg-zinc-800/80 px-2.5 py-1 rounded-lg shrink-0">
                                            <Car size={13} className="shrink-0 text-zinc-400" />
                                            <span>{t.vehicle}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Row 3: Remarks (if exists) */}
                                {t.remarks && (
                                    <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300 font-medium mb-3 pl-1">
                                        <Info size={13} className="shrink-0 text-zinc-400" />
                                        <span className="leading-relaxed">{t.remarks}</span>
                                    </div>
                                )}

                                {/* Row 4: Participants */}
                                <div className={cn(
                                    "flex items-center gap-2 bg-transparent dark:bg-zinc-800/50 px-3 py-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800",
                                    !t.remarks && "mt-3"
                                )}>
                                    <Users size={14} className="shrink-0 text-zinc-400" />
                                    <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                                        {t.participants.length > 0 ? t.participants.join(", ") : "출장자 미지정"}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
