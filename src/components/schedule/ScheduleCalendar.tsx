"use client";

import React, { useState, useMemo } from "react";
import {
    format,
    addDays,
    addWeeks,
    addMonths,
    subWeeks,
    subMonths,
    startOfWeek,
    endOfWeek,
    startOfMonth,
    endOfMonth,
    isSameDay,
    isSameMonth,
    eachDayOfInterval,
} from "date-fns";
import { ko } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Calendar, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn, getKstDateStr } from "@/lib/utils";

export interface ScheduleEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    type: "analysis" | "lesson" | "training" | "consultation" | "other";
    category?: string;
    participantName?: string;
    coachName?: string;
    ownerRole?: "me" | "coach" | "athlete";
    status?: "scheduled" | "completed";
}

type CalendarView = "month" | "week" | "search";
type UserFilter = "me" | "all";
type EventTypeFilter = ScheduleEvent["type"] | "all";

const EVENT_COLORS: Record<ScheduleEvent["type"], { bg: string; dot: string }> = {
    analysis: { bg: "bg-orange-100 text-orange-800", dot: "bg-orange-500" },
    lesson: { bg: "bg-blue-100 text-blue-800", dot: "bg-blue-500" },
    training: { bg: "bg-indigo-100 text-indigo-800", dot: "bg-indigo-500" },
    consultation: { bg: "bg-amber-100 text-amber-800", dot: "bg-amber-500" },
    other: { bg: "bg-zinc-100 text-zinc-800", dot: "bg-zinc-400" },
};

const EVENT_TYPE_LABELS: Record<ScheduleEvent["type"], string> = {
    analysis: "분석",
    lesson: "레슨",
    training: "훈련",
    consultation: "상담",
    other: "기타",
};

const VISIBLE_FILTER_TABS: { type: EventTypeFilter; label: string }[] = [
    { type: "all", label: "전체" },
    { type: "analysis", label: "분석" },
    { type: "lesson", label: "레슨" },
    { type: "consultation", label: "상담" },
    { type: "other", label: "기타" },
];

interface ScheduleCalendarProps {
    events: ScheduleEvent[];
    onSelectEvent?: (event: ScheduleEvent) => void;
    onSelectSlot?: (date: Date) => void;
    onAddEvent?: () => void;
    onEditEvent?: (event: ScheduleEvent) => void;
    currentRole?: "coach" | "athlete";
    initialView?: CalendarView;
    hideFilters?: boolean;
}

export function ScheduleCalendar({ events, onSelectEvent, onSelectSlot, onAddEvent, onEditEvent, currentRole = "coach", initialView = "month", hideFilters = false }: ScheduleCalendarProps) {
    const router = useRouter();
    const [view, setView] = useState<CalendarView>(initialView);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [userFilter, setUserFilter] = useState<UserFilter>("all");
    const [typeFilter, setTypeFilter] = useState<EventTypeFilter>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [hasMounted, setHasMounted] = useState(false);

    React.useEffect(() => {
        setHasMounted(true);
    }, []);

    React.useEffect(() => {
        onSelectSlot?.(selectedDate);
    }, [selectedDate, onSelectSlot]);

    const navigate = (direction: "prev" | "next" | "today") => {
        if (direction === "today") {
            const now = new Date();
            setCurrentDate(now);
            setSelectedDate(now);
            return;
        }
        if (view === "month") {
            setCurrentDate(direction === "next" ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
            setSelectedDate(direction === "next" ? addMonths(selectedDate, 1) : subMonths(selectedDate, 1));
        }
        if (view === "week") {
            setCurrentDate(direction === "next" ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
            setSelectedDate(direction === "next" ? addWeeks(selectedDate, 1) : subWeeks(selectedDate, 1));
        }
    };

    const days = useMemo(() => {
        if (view === "month") {
            const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 });
            const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });
            return eachDayOfInterval({ start, end });
        }
        const start = startOfWeek(currentDate, { weekStartsOn: 0 });
        return eachDayOfInterval({ start, end: addDays(start, 6) });
    }, [view, currentDate]);

    const filteredEvents = useMemo(
        () => events.filter((e) => {
            const matchUser = userFilter === "all" || e.ownerRole === "me";
            const matchType = typeFilter === "all" || e.type === typeFilter;
            return matchUser && matchType;
        }),
        [events, userFilter, typeFilter]
    );

    const getEventsForDay = (day: Date) => filteredEvents.filter((e) => isSameDay(e.start, day));

    // Grouping logic for coach view
    const displayEvents = useMemo(() => {
        const rawEvents = getEventsForDay(selectedDate);
        if (currentRole !== "coach") return rawEvents.map(e => ({ ...e, groupCount: 1 }));

        const grouped: (ScheduleEvent & { groupCount: number })[] = [];
        const processedIds = new Set<string>();

        rawEvents.forEach(event => {
            if (processedIds.has(event.id)) return;

            if (event.type === "training") {
                // Find others with same start/end time
                const matches = rawEvents.filter(other =>
                    other.type === "training" &&
                    other.start.getTime() === event.start.getTime() &&
                    other.end.getTime() === event.end.getTime()
                );

                if (matches.length > 1) {
                    grouped.push({
                        ...event,
                        title: `${event.participantName} 외 ${matches.length - 1}명 훈련`,
                        groupCount: matches.length,
                    });
                    matches.forEach(m => processedIds.add(m.id));
                } else {
                    grouped.push({ ...event, groupCount: 1 });
                    processedIds.add(event.id);
                }
            } else {
                grouped.push({ ...event, groupCount: 1 });
                processedIds.add(event.id);
            }
        });

        return grouped;
    }, [selectedDate, filteredEvents, currentRole]);

    const upcomingSearchEvents = useMemo(() => {
        const todayStr = getKstDateStr();
        const q = searchQuery.trim().toLowerCase();
        return filteredEvents
            .filter((e) => {
                if (getKstDateStr(e.start) < todayStr) return false;
                if (!q) return true;
                const player = (e.participantName || "").toLowerCase();
                const coach = (e.coachName === "성시우" ? "성시우 감독" : (e.coachName || "")).toLowerCase();
                const title = (e.title || "").toLowerCase();
                return player.includes(q) || coach.includes(q) || title.includes(q);
            })
            .sort((a, b) => a.start.getTime() - b.start.getTime())
            .map((e) => ({ ...e, groupCount: 1 }));
    }, [filteredEvents, searchQuery]);

    const headerLabel = useMemo(() => {
        if (view === "month") {
            return format(currentDate, "yyyy년 M월", { locale: ko });
        }
        const s = startOfWeek(currentDate, { weekStartsOn: 0 });
        return `${format(s, "M월 d일", { locale: ko })} ~ ${format(addDays(s, 6), "M월 d일", { locale: ko })}`;
    }, [view, currentDate]);

    const WEEK_DAYS = ["일", "월", "화", "수", "목", "금", "토"];

    const VIEW_TABS: { key: CalendarView; label: string }[] = [
        { key: "month", label: "월간" },
        { key: "week", label: "주간" },
        { key: "search", label: "검색" },
    ];

    const USER_TABS: { key: UserFilter; label: string }[] = [
        { key: "me", label: "본인" },
        { key: "all", label: "전체" },
    ];

    if (!hasMounted) {
        return <div className="min-h-[400px] flex items-center justify-center text-zinc-400">Loading Calendar...</div>;
    }

    const renderEventCard = (event: ScheduleEvent & { groupCount: number }, showDate = false) => (
        <div
            key={event.id}
            className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[2.5rem] py-4 px-6 transition-all hover:shadow-md w-full cursor-pointer"
            onClick={() => onEditEvent?.(event)}
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 shrink-0">
                        <Calendar size={16} />
                    </div>
                    <span className="text-sm font-bold text-zinc-600 dark:text-zinc-300 truncate">
                        {event.type === "other" && event.title?.startsWith("기타 (")
                            ? event.title
                            : EVENT_TYPE_LABELS[event.type]}
                    </span>
                    {showDate && (
                        <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full shrink-0">
                            {format(event.start, "M월 d일 (EEE)", { locale: ko })}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 shrink-0 mr-2">
                    {event.groupCount > 1 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-navy/10 text-brand-navy shrink-0">
                            +{event.groupCount - 1}
                        </span>
                    )}
                    {event.type !== "other" && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                const params = new URLSearchParams({
                                    player: event.participantName || "",
                                    type: event.category || "shot",
                                    date: format(event.start, "yyyy-MM-dd"),
                                    start: format(event.start, "HH:mm"),
                                    end: format(event.end, "HH:mm")
                                });
                                if (event.type === "analysis") {
                                    router.push(`/analysis/create?${params.toString()}`);
                                } else if (event.type === "lesson") {
                                    router.push(`/lessons/create?${params.toString()}`);
                                } else if (event.type === "consultation") {
                                    router.push(`/consultations/create?${params.toString()}`);
                                } else if (event.type === "training") {
                                    router.push(`/training/create?${params.toString()}`);
                                }
                            }}
                            title={
                                event.type === "analysis"
                                    ? "분석 작성으로 이동"
                                    : event.type === "consultation"
                                    ? "상담 작성으로 이동"
                                    : event.type === "training"
                                    ? "훈련 작성으로 이동"
                                    : "레슨 작성으로 이동"
                            }
                            className="p-1.5 rounded-full text-zinc-400 hover:text-brand-navy hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-all shrink-0 active:scale-95"
                        >
                            <ChevronRight size={20} />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex items-center justify-between gap-2 mt-3">
                <span className="text-[11px] font-bold text-zinc-400 shrink-0 pl-[40px]">
                    {event.coachName === "성시우" ? "성시우 감독" : (event.coachName || "코치")}
                </span>
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-600 dark:text-zinc-300 mr-2 min-w-0">
                    <span className="shrink-0">
                        {format(event.start, "HH:mm") === format(event.end, "HH:mm")
                            ? format(event.start, "HH:mm")
                            : `${format(event.start, "HH:mm")}~${format(event.end, "HH:mm")}`}
                    </span>
                    <span className="opacity-40 font-normal shrink-0">|</span>
                    <span className="truncate">
                        {event.participantName || "선수 미지정"}
                    </span>
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col gap-3">
            {/* Event Type Filter */}
            {!hideFilters && (
                <div className="flex flex-nowrap justify-start items-center gap-1.5 mb-2 overflow-x-auto scrollbar-hide pb-1">
                    {VISIBLE_FILTER_TABS.map(({ type, label }) => (
                        <button
                            key={type}
                            type="button"
                            onClick={() => setTypeFilter(type)}
                            className={cn(
                                "flex items-center gap-1 px-4 py-2 rounded-full text-sm font-semibold border transition-all duration-200 shrink-0",
                                typeFilter === type
                                    ? "bg-brand-navy text-white border-brand-navy shadow-md"
                                    : "bg-white text-zinc-600 border-zinc-200 hover:bg-brand-navy-light hover:text-brand-navy dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 dark:hover:bg-brand-navy-dark dark:hover:text-white"
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            )}

            {/* View Switch Row (+ Search Input when Search tab is active) */}
            {!hideFilters && (
                <div className="flex flex-wrap items-center justify-between gap-2.5 mb-1">
                    <div className="flex bg-transparent dark:bg-zinc-800 rounded-lg p-0.5 border border-zinc-200 dark:border-zinc-700 shrink-0">
                        {VIEW_TABS.map(({ key, label }) => (
                            <button key={key} type="button" onClick={() => setView(key)}
                                className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer",
                                    view === key ? "bg-brand-navy text-white shadow-sm" : "text-zinc-500 dark:text-zinc-400"
                                )}>{label}</button>
                        ))}
                    </div>

                    {view === "search" && (
                        <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="선수명 또는 코치명 검색..."
                                className="w-full pl-9 pr-8 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs sm:text-sm text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/40"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {view === "search" ? (
                <div className="mt-2">
                    <div className="mb-4 px-1 flex items-center justify-between">
                        <div className="flex items-baseline gap-2">
                            <span className="font-bold text-lg text-zinc-900 dark:text-zinc-50">
                                오늘 이후 예약 일정
                            </span>
                            <span className="text-xs text-zinc-400">{upcomingSearchEvents.length}건</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2.5">
                        {upcomingSearchEvents.length === 0 ? (
                            <div className="py-12 text-center text-zinc-400 text-sm font-medium bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                                {searchQuery.trim()
                                    ? `"${searchQuery.trim()}"에 해당하는 오늘 이후 예약이 없습니다.`
                                    : "오늘 이후 등록된 예약 일정이 없습니다."}
                            </div>
                        ) : (
                            upcomingSearchEvents.map((event) => renderEventCard(event, true))
                        )}
                    </div>
                </div>
            ) : (
                <>
                    {/* Centered Navigation Row */}
                    <div className="flex items-center justify-center gap-4 py-2">
                        <button type="button" onClick={() => navigate("prev")} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                            <ChevronLeft size={20} />
                        </button>
                        <div className="flex items-center gap-3">
                            <span className="text-base font-bold text-zinc-900 dark:text-zinc-200">{headerLabel}</span>
                            <button type="button" onClick={() => navigate("today")}
                                className="px-3 py-1 rounded-lg text-xs font-semibold border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-zinc-600 dark:text-zinc-400">오늘</button>
                        </div>
                        <button type="button" onClick={() => navigate("next")} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                        <div className="grid grid-cols-7 border-b border-zinc-100 dark:border-zinc-800">
                            {WEEK_DAYS.map((day, i) => (
                                <div key={day} className={cn("py-2 text-center text-xs font-semibold", i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-zinc-500 dark:text-zinc-400")}>{day}</div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7">
                            {days.map((day, idx) => {
                                const dayEvents = getEventsForDay(day);
                                const isToday = isSameDay(day, new Date());
                                const isSelected = isSameDay(day, selectedDate);
                                const isOutsideMonth = view === "month" && !isSameMonth(day, currentDate);
                                const dow = day.getDay();
                                return (
                                    <button key={idx} type="button" onClick={() => { setSelectedDate(day); onSelectSlot?.(day); }}
                                        className={cn("relative flex flex-col items-center py-2 min-h-[60px] sm:min-h-[80px] border-b border-r border-zinc-100 dark:border-zinc-800 transition-colors",
                                            isSelected ? "bg-sky-50 dark:bg-sky-900/40" : "hover:bg-zinc-50 dark:hover:bg-zinc-800",
                                            isOutsideMonth && !isSelected ? "opacity-40" : "",
                                            idx % 7 === 6 ? "border-r-0" : ""
                                        )}>
                                        <span className={cn("w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium mb-1",
                                            isToday ? "bg-blue-500 text-white" : "",
                                            isSelected && !isToday ? "bg-sky-200 text-sky-800 dark:bg-sky-700 dark:text-sky-100 font-bold" : "",
                                            !isToday && !isSelected && dow === 0 ? "text-red-500" : "",
                                            !isToday && !isSelected && dow === 6 ? "text-blue-500" : ""
                                        )}>{format(day, "d")}</span>
                                        {dayEvents.length > 0 && (
                                            <div className="flex items-center justify-center gap-1 px-0.5">
                                                <span className={cn("block w-1.5 h-1.5 rounded-full shrink-0", EVENT_COLORS[dayEvents[0].type].dot)} />
                                                <span className="text-[10px] leading-none text-zinc-500 dark:text-zinc-400 font-semibold">({dayEvents.length}건)</span>
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="mt-8">
                        <div className="mb-4 px-1 flex items-center justify-between">
                            <div className="flex items-baseline gap-2">
                                <span className="font-bold text-lg text-zinc-900 dark:text-zinc-50">{format(selectedDate, "M월 d일 (EEE)", { locale: ko })} 일정</span>
                                <span className="text-xs text-zinc-400">{displayEvents.length}건</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2.5">
                            {displayEvents.length === 0 ? (
                                <div className="py-12 text-center text-zinc-400 text-sm font-medium bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">등록된 일정이 없습니다.</div>
                            ) : (
                                displayEvents.map((event) => renderEventCard(event, false))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
