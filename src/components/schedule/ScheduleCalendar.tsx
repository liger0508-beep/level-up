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
import { ChevronLeft, ChevronRight, Plus, Calendar } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

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

type CalendarView = "2week" | "week";
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
    analysis: "측정",
    lesson: "레슨",
    training: "훈련",
    consultation: "상담",
    other: "기타",
};

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

export function ScheduleCalendar({ events, onSelectEvent, onSelectSlot, onAddEvent, onEditEvent, currentRole = "coach", initialView = "week", hideFilters = false }: ScheduleCalendarProps) {
    const router = useRouter();
    const [view, setView] = useState<CalendarView>(initialView);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [userFilter, setUserFilter] = useState<UserFilter>("all");
    const [typeFilter, setTypeFilter] = useState<EventTypeFilter>("all");
    const [hasMounted, setHasMounted] = useState(false);

    React.useEffect(() => {
        setHasMounted(true);
    }, []);

    const navigate = (direction: "prev" | "next" | "today") => {
        if (direction === "today") { setCurrentDate(new Date()); setSelectedDate(new Date()); return; }
        if (view === "2week") setCurrentDate(direction === "next" ? addWeeks(currentDate, 2) : addWeeks(currentDate, -2));
        if (view === "week") setCurrentDate(direction === "next" ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    };

    const days = useMemo(() => {
        if (view === "2week") {
            const start = startOfWeek(currentDate, { weekStartsOn: 0 });
            return eachDayOfInterval({ start, end: addDays(start, 13) });
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

    const headerLabel = useMemo(() => {
        const s = startOfWeek(currentDate, { weekStartsOn: 0 });
        if (view === "2week") {
            return `${format(s, "M월 d일", { locale: ko })} ~ ${format(addDays(s, 13), "M월 d일", { locale: ko })}`;
        }
        return `${format(s, "M월 d일", { locale: ko })} ~ ${format(addDays(s, 6), "M월 d일", { locale: ko })}`;
    }, [view, currentDate]);

    const WEEK_DAYS = ["일", "월", "화", "수", "목", "금", "토"];

    const VIEW_TABS: { key: CalendarView; label: string }[] = [
        { key: "2week", label: "2주" },
        { key: "week", label: "주간" },
    ];

    const USER_TABS: { key: UserFilter; label: string }[] = [
        { key: "me", label: "본인" },
        { key: "all", label: "전체" },
    ];

    if (!hasMounted) {
        return <div className="min-h-[400px] flex items-center justify-center text-zinc-400">Loading Calendar...</div>;
    }

    return (
        <div className="flex flex-col gap-3">
            {/* Event Type Filter */}
            {!hideFilters && (
                <div className="flex flex-nowrap justify-start items-center gap-1.5 mb-2 overflow-x-auto scrollbar-hide pb-1">
                    <button
                        type="button"
                        onClick={() => setTypeFilter("all")}
                        className={cn(
                            "flex items-center gap-1 px-4 py-2 rounded-full text-sm font-semibold border transition-all duration-200 shrink-0",
                            typeFilter === "all"
                                ? "bg-brand-navy text-white border-brand-navy shadow-md"
                                : "bg-white text-zinc-600 border-zinc-200 hover:bg-brand-navy-light hover:text-brand-navy dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 dark:hover:bg-brand-navy-dark dark:hover:text-white"
                        )}
                    >전체</button>
                    {Object.entries(EVENT_TYPE_LABELS).map(([type, label]) => {
                        const t = type as ScheduleEvent["type"];
                        return (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setTypeFilter(t)}
                                className={cn(
                                    "flex items-center gap-1 px-4 py-2 rounded-full text-sm font-semibold border transition-all duration-200 shrink-0",
                                    typeFilter === t
                                        ? "bg-brand-navy text-white border-brand-navy shadow-md"
                                        : "bg-white text-zinc-600 border-zinc-200 hover:bg-brand-navy-light hover:text-brand-navy dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 dark:hover:bg-brand-navy-dark dark:hover:text-white"
                                )}
                            >{label}</button>
                        );
                    })}
                </div>
            )}

            {/* View Switch Row */}
            {!hideFilters && (
                <div className="flex items-center justify-start mb-1">
                    <div className="flex bg-transparent dark:bg-zinc-800 rounded-lg p-0.5 border border-zinc-200 dark:border-zinc-700">
                        {VIEW_TABS.map(({ key, label }) => (
                            <button key={key} type="button" onClick={() => setView(key)}
                                className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                                    view === key ? "bg-brand-navy text-white shadow-sm" : "text-zinc-500 dark:text-zinc-400"
                                )}>{label}</button>
                        ))}
                    </div>
                </div>
            )}

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
                        const dow = day.getDay();
                        return (
                            <button key={idx} type="button" onClick={() => { setSelectedDate(day); onSelectSlot?.(day); }}
                                className={cn("relative flex flex-col items-center py-2 min-h-[60px] sm:min-h-[80px] border-b border-r border-zinc-100 dark:border-zinc-800 transition-colors",
                                    isSelected ? "bg-sky-50 dark:bg-sky-900/40" : "hover:bg-zinc-50 dark:hover:bg-zinc-800",
                                    idx % 7 === 6 ? "border-r-0" : ""
                                )}>
                                <span className={cn("w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium mb-1",
                                    isToday ? "bg-blue-500 text-white" : "",
                                    isSelected && !isToday ? "bg-sky-200 text-sky-800 dark:bg-sky-700 dark:text-sky-100 font-bold" : "",
                                    !isToday && !isSelected && dow === 0 ? "text-red-500" : "",
                                    !isToday && !isSelected && dow === 6 ? "text-blue-500" : ""
                                )}>{format(day, "d")}</span>
                                <div className="flex flex-wrap justify-center gap-0.5 px-0.5">
                                    {dayEvents.slice(0, 3).map((e) => (<span key={e.id} className={cn("block w-1.5 h-1.5 rounded-full", EVENT_COLORS[e.type].dot)} />))}
                                    {dayEvents.length > 3 && (<span className="text-[9px] leading-none text-zinc-400">+{dayEvents.length - 3}</span>)}
                                </div>
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
                        displayEvents.map((event) => {
                            const eventTime = format(event.start, "HH:mm");
                            const completed = event.status === "completed";
                            const colors = EVENT_COLORS[event.type];
                            const borderMap: Record<ScheduleEvent["type"], string> = {
                                analysis: completed ? "border-l-zinc-300" : "border-l-orange-500",
                                lesson: completed ? "border-l-zinc-300" : "border-l-blue-500",
                                training: completed ? "border-l-zinc-300" : "border-l-indigo-500",
                                consultation: completed ? "border-l-zinc-300" : "border-l-amber-500",
                                other: "border-l-zinc-400",
                            };
                            const labelColorMap: Record<ScheduleEvent["type"], string> = {
                                analysis: completed ? "text-zinc-400" : "text-orange-700 dark:text-orange-400",
                                lesson: completed ? "text-zinc-400" : "text-blue-700 dark:text-blue-400",
                                training: completed ? "text-zinc-400" : "text-indigo-700 dark:text-indigo-400",
                                consultation: completed ? "text-zinc-400" : "text-amber-700 dark:text-amber-400",
                                other: completed ? "text-zinc-400" : "text-zinc-600 dark:text-zinc-400",
                            };
                            return (
                                <div
                                    key={event.id}
                                    className={cn(
                                        "bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[2.5rem] py-4 px-6 transition-all hover:shadow-md w-full cursor-pointer",
                                        completed ? "opacity-80" : ""
                                    )}
                                    onClick={() => onEditEvent?.(event)}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 shrink-0">
                                                <Calendar size={16} />
                                            </div>
                                            <span className="text-sm font-bold text-zinc-600 dark:text-zinc-300">
                                                {EVENT_TYPE_LABELS[event.type]}{event.category ? `(${event.category.slice(0, 1)})` : ""}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0 mr-2">
                                            {event.groupCount > 1 && (
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-navy/10 text-brand-navy shrink-0">
                                                    +{event.groupCount - 1}
                                                </span>
                                            )}
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (completed) return;
                                                    const params = new URLSearchParams({
                                                        player: event.participantName || "",
                                                        type: event.category || "shot",
                                                        start: format(event.start, "HH:mm"),
                                                        end: format(event.end, "HH:mm"),
                                                        scheduleId: event.id
                                                    });
                                                    if (event.type === "lesson") router.push(`/lessons/create?${params.toString()}`);
                                                    else if (event.type === "analysis") router.push(`/analysis/create?${params.toString()}`);
                                                    else if (event.type === "training") router.push(`/training/create?${params.toString()}`);
                                                    else if (event.type === "consultation") router.push(`/consultations/create?${params.toString()}`);
                                                }}
                                                className={cn(
                                                    "text-center text-[10px] px-3 py-1.5 rounded-lg font-bold shrink-0 transition-all",
                                                    completed
                                                        ? "bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500 cursor-default"
                                                        : "bg-brand-navy text-white hover:bg-brand-navy-dark active:scale-95 shadow-sm"
                                                )}
                                            >
                                                {completed ? "완료" : EVENT_TYPE_LABELS[event.type]}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-end justify-between mt-3">
                                        <span className="text-[11px] font-bold text-zinc-400 shrink-0 mb-0.5 pl-[40px]">
                                            {format(event.start, "HH:mm")} <span className="opacity-40 font-normal mx-0.5">|</span> {event.coachName || "코치"}
                                        </span>
                                        <span className="text-sm font-bold text-zinc-600 dark:text-zinc-300 truncate mr-2">
                                            {event.participantName || event.title}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
