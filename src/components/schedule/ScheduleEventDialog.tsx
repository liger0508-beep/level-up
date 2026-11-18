"use client";

import React, { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScheduleEvent } from "./ScheduleCalendar";
import { DatePickerInput } from "@/components/ui/DatePickerInput";
import { AthleteSearch } from "@/components/ui/AthleteSearch";
import { createClient } from "@/lib/supabase/client";

interface ScheduleEventDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (event: Omit<ScheduleEvent, "id">) => void;
    onDelete?: (id: string) => void;
    editEvent?: ScheduleEvent;
    initialDate?: Date;
    currentCoachName?: string;
    currentRole?: "coach" | "athlete";
    currentUserName?: string;
    currentUserBranch?: string;
}

const EVENT_TYPES: { value: ScheduleEvent["type"]; label: string; color: string }[] = [
    { value: "analysis", label: "분석", color: "bg-orange-500" },
    { value: "lesson", label: "레슨", color: "bg-blue-500" },
    { value: "consultation", label: "상담", color: "bg-amber-500" },
    { value: "other", label: "기타", color: "bg-zinc-400" },
];

const ATHLETE_TIME_SLOTS = [
    { key: "09:00", label: "9시", start: "09:00", end: "10:00" },
    { key: "10:00", label: "10시", start: "10:00", end: "11:00" },
    { key: "11:00", label: "11시", start: "11:00", end: "12:00" },
    { key: "14:00", label: "14시", start: "14:00", end: "15:00" },
    { key: "15:00", label: "15시", start: "15:00", end: "16:00" },
    { key: "16:00", label: "16시", start: "16:00", end: "17:00" },
    { key: "17:00", label: "17시", start: "17:00", end: "18:00" },
];

const COACH_TIME_SLOTS = [
    { key: "08:00", label: "8시", start: "08:00", end: "09:00" },
    { key: "09:00", label: "9시", start: "09:00", end: "10:00" },
    { key: "10:00", label: "10시", start: "10:00", end: "11:00" },
    { key: "11:00", label: "11시", start: "11:00", end: "12:00" },
    { key: "13:00", label: "13시", start: "13:00", end: "14:00" },
    { key: "14:00", label: "14시", start: "14:00", end: "15:00" },
    { key: "15:00", label: "15시", start: "15:00", end: "16:00" },
    { key: "16:00", label: "16시", start: "16:00", end: "17:00" },
    { key: "17:00", label: "17시", start: "17:00", end: "18:00" },
    { key: "18:00", label: "18시", start: "18:00", end: "19:00" },
    { key: "19:00", label: "19시", start: "19:00", end: "20:00" },
    { key: "20:00", label: "20시", start: "20:00", end: "21:00" },
];

// Auto-generate title based on event type and participants
function autoTitle(type: ScheduleEvent["type"], participants: string[]): string {
    const typeLabel = EVENT_TYPES.find((t) => t.value === type)?.label || "예약";
    const namePart = participants.length > 0 ? (participants.length === 1 ? participants[0] : `${participants[0]} 외 ${participants.length - 1}명`) : "";
    if (type === "analysis") return namePart ? `[분석] ${namePart}` : "[분석]";
    if (type === "consultation") return namePart ? `[상담] ${namePart}` : "[상담]";
    if (type === "lesson") return namePart ? `${namePart} 레슨` : "레슨";
    return namePart ? `${namePart} 기타` : "기타";
}

export function ScheduleEventDialog({
    isOpen,
    onClose,
    onSave,
    onDelete,
    editEvent,
    initialDate,
    currentCoachName = "",
    currentRole = "coach",
    currentUserName = "",
    currentUserBranch = ""
}: ScheduleEventDialogProps) {
    const today = initialDate || new Date();
    const [title, setTitle] = useState("");
    const [titleManuallySet, setTitleManuallySet] = useState(false);
    const [eventType, setEventType] = useState<ScheduleEvent["type"]>("analysis");
    const [otherNote, setOtherNote] = useState("");
    const [date, setDate] = useState(format(today, "yyyy-MM-dd"));
    const [startSlot, setStartSlot] = useState<string | null>(null);
    const [endSlot, setEndSlot] = useState<string | null>(null);
    const [participants, setParticipants] = useState<string[]>([]);
    const [coachName, setCoachName] = useState("성시우 감독");
    const [coaches, setCoaches] = useState<{ id: string; name: string; branch?: string; role?: string; status?: string }[]>([]);
    const [occupiedSlots, setOccupiedSlots] = useState<string[]>([]);
    const [customSlots, setCustomSlots] = useState<typeof COACH_TIME_SLOTS | null>(null);
    const [isLoadingSlots, setIsLoadingSlots] = useState(false);
    const [isSelectingRangeEnd, setIsSelectingRangeEnd] = useState(false);
    const [athleteAnalysisCount, setAthleteAnalysisCount] = useState<number>(0);

    useEffect(() => {
        const fetchCoaches = async () => {
            const supabase = createClient();
            const { data } = await supabase
                .from("users")
                .select("id, name, branch, role, status")
                .in("role", ["coach", "admin", "headquarter"])
                .order("name", { ascending: true });
            if (data) {
                setCoaches(data.filter((c: any) => c.status !== "휴직" && c.status !== "퇴직"));
            }
        };
        fetchCoaches();
    }, []);

    const availableCoaches = useMemo(() => {
        if (eventType === "analysis") {
            return [{ id: "sung-siwoo", name: "성시우 감독", originalName: "성시우" }];
        }

        // For lesson, consultation, other
        const filtered = coaches.filter(c => c.name !== "성시우");

        if (currentRole === "athlete" && currentUserBranch) {
            const branchCoaches = filtered.filter(c => c.branch === currentUserBranch);
            if (branchCoaches.length > 0) {
                return branchCoaches.map(c => ({ id: c.id, name: c.name, originalName: c.name }));
            }
        }

        return filtered.map(c => ({ id: c.id, name: c.name, originalName: c.name }));
    }, [eventType, currentRole, currentUserBranch, coaches]);

    const resetForm = () => {
        setTitle("");
        setTitleManuallySet(false);
        setEventType("analysis");
        setOtherNote("");
        setDate(format(today, "yyyy-MM-dd"));
        setStartSlot(null);
        setEndSlot(null);
        setIsSelectingRangeEnd(false);
        setCoachName("성시우 감독");
        if (currentRole === "athlete" && currentUserName) {
            setParticipants([currentUserName]);
        } else {
            setParticipants([]);
        }
    };

    // Auto-update coach selection based on eventType and role
    useEffect(() => {
        if (eventType === "analysis") {
            setCoachName("성시우 감독");
        } else {
            if (coachName === "성시우 감독" || coachName === "성시우" || !coachName) {
                if (currentRole === "coach" && currentCoachName) {
                    setCoachName(currentCoachName);
                } else if (availableCoaches.length > 0) {
                    setCoachName(availableCoaches[0].originalName || availableCoaches[0].name);
                } else {
                    setCoachName("");
                }
            }
        }
    }, [eventType, currentRole, currentCoachName, availableCoaches]);

    // Fetch occupied slots for the selected coach on the given date
    useEffect(() => {
        if (!isOpen || !date || (!coachName && currentRole !== "athlete")) {
            setOccupiedSlots([]);
            return;
        }

        let isMounted = true;
        setIsLoadingSlots(true);

        const cleanCoach = coachName.replace(/ (감독|코치|프로)$/, '').trim();
        const athleteParam = currentRole === "athlete" && currentUserName ? `&athleteName=${encodeURIComponent(currentUserName)}` : "";
        fetch(`/api/schedules?coachName=${encodeURIComponent(cleanCoach)}&date=${date}&excludeId=${editEvent?.id || ""}${athleteParam}&_t=${Date.now()}`, { cache: "no-store" })
            .then((res) => res.json())
            .then((data) => {
                if (isMounted) {
                    setOccupiedSlots(data.occupiedSlots || []);
                    setCustomSlots(
                        Array.isArray(data.resolvedSlots) && data.resolvedSlots.length > 0
                            ? data.resolvedSlots
                            : null
                    );
                    if (typeof data.athleteAnalysisMonthlyCount === "number") {
                        setAthleteAnalysisCount(data.athleteAnalysisMonthlyCount);
                    }
                }
            })
            .catch((err) => {
                console.error("Failed to fetch occupied slots:", err);
                if (isMounted) {
                    setOccupiedSlots([]);
                    setCustomSlots(null);
                }
            })
            .finally(() => {
                if (isMounted) setIsLoadingSlots(false);
            });

        return () => {
            isMounted = false;
        };
    }, [isOpen, coachName, date, editEvent?.id, currentRole, currentUserName]);

    // If currently selected slot is occupied, reset it
    useEffect(() => {
        if (startSlot && occupiedSlots.includes(startSlot)) {
            setStartSlot(null);
            setEndSlot(null);
        }
    }, [occupiedSlots, startSlot]);

    // Effect to populate form when editEvent changes
    useEffect(() => {
        if (editEvent) {
            setTitle(editEvent.title);
            setTitleManuallySet(true);
            setEventType(editEvent.type);
            if (editEvent.type === "other") {
                const match = editEvent.title?.match(/^기타 \((.*)\)$/);
                setOtherNote(match ? match[1] : (editEvent.title === "기타" ? "" : editEvent.title || ""));
            } else {
                setOtherNote("");
            }
            setDate(format(editEvent.start, "yyyy-MM-dd"));
            const s = format(editEvent.start, "HH:mm");
            const e = format(editEvent.end, "HH:mm");
            setStartSlot(s);
            setEndSlot(e === s ? null : e);
            setIsSelectingRangeEnd(false);
            setParticipants(editEvent.participantName ? editEvent.participantName.split(", ") : []);
            const cName = editEvent.coachName === "성시우" ? "성시우 감독" : (editEvent.coachName || "");
            setCoachName(cName);
        } else {
            resetForm();
        }
    }, [editEvent, isOpen, initialDate, currentRole, currentUserName]);

    // Auto-title: update whenever type or participants change, unless user manually typed
    const effectiveTitle = useMemo(() => {
        if (eventType === "other") {
            return otherNote.trim() ? `기타 (${otherNote.trim()})` : "기타";
        }
        if (titleManuallySet && title) return title;
        return autoTitle(eventType, participants);
    }, [eventType, otherNote, participants, title, titleManuallySet]);

    const handleTitleChange = (val: string) => {
        setTitle(val);
        setTitleManuallySet(val.length > 0);
    };

    const removeParticipant = (name: string) => {
        setParticipants((prev) => prev.filter((p) => p !== name));
    };

    const activeTimeSlots = customSlots || (currentRole === "athlete" ? ATHLETE_TIME_SLOTS : COACH_TIME_SLOTS);

    // Time slot logic (athlete: 1 slot toggle, coach/admin: 2-click continuous range -> single card)
    const handleSlotClick = (slot: typeof COACH_TIME_SLOTS[0]) => {
        if (currentRole === "athlete") {
            if (startSlot === slot.start) {
                setStartSlot(null);
                setEndSlot(null);
            } else {
                setStartSlot(slot.start);
                setEndSlot(slot.end);
            }
            return;
        }

        // Coach / Admin: continuous range selection
        if (!startSlot || !isSelectingRangeEnd) {
            setStartSlot(slot.start);
            setEndSlot(slot.end);
            setIsSelectingRangeEnd(true);
            return;
        }

        if (startSlot === slot.start && endSlot === slot.end) {
            setStartSlot(null);
            setEndSlot(null);
            setIsSelectingRangeEnd(false);
            return;
        }

        const idxA = activeTimeSlots.findIndex((s) => s.start === startSlot);
        const idxB = activeTimeSlots.findIndex((s) => s.start === slot.start);
        if (idxA !== -1 && idxB !== -1) {
            const minIdx = Math.min(idxA, idxB);
            const maxIdx = Math.max(idxA, idxB);
            setStartSlot(activeTimeSlots[minIdx].start);
            setEndSlot(activeTimeSlots[maxIdx].end);
            setIsSelectingRangeEnd(false);
        } else {
            setStartSlot(slot.start);
            setEndSlot(slot.end);
            setIsSelectingRangeEnd(false);
        }
    };

    const timeLabel = useMemo(() => {
        if (!startSlot) return "시간을 선택하세요";
        const effectiveEnd = endSlot || startSlot;
        const covered = activeTimeSlots.filter((s) => s.start >= startSlot && s.end <= effectiveEnd);
        if (covered.length > 1) {
            return `${startSlot} ~ ${effectiveEnd} (${covered.length}타임 연속)`;
        }
        const matched = activeTimeSlots.find((s) => s.start === startSlot);
        if (matched) return `${matched.label} (${matched.start} ~ ${matched.end})`;
        return `${startSlot} ~ ${effectiveEnd}`;
    }, [startSlot, endSlot, activeTimeSlots]);

    const isAthleteAnalysisLimitReached =
        currentRole === "athlete" && eventType === "analysis" && athleteAnalysisCount >= 2;

    const handleSave = () => {
        const finalTitle = effectiveTitle;
        if (isAthleteAnalysisLimitReached) {
            alert("분석 예약은 한 달에 2회까지만 가능합니다.");
            return;
        }
        if (!startSlot) {
            alert("시간을 선택해주세요.");
            return;
        }
        if (currentRole === "athlete" && !coachName) {
            alert("담당 코치를 선택해주세요.");
            return;
        }
        if (currentRole === "athlete" && startSlot && occupiedSlots.includes(startSlot)) {
            alert("선택하신 시간대에 코치의 기존 일정이 있어 예약할 수 없습니다.");
            return;
        }
        if (currentRole !== "athlete" && eventType !== "other" && participants.length === 0) {
            alert("참여 선수를 검색하여 선택해주세요.");
            return;
        }
        const end = endSlot || startSlot;
        const cleanCoach = (coachName || "").replace(/ 감독$/, "").trim();
        onSave({
            title: finalTitle,
            type: eventType,
            start: new Date(`${date}T${startSlot}:00`),
            end: new Date(`${date}T${end}:00`),
            participantName: participants.join(", ") || undefined,
            coachName: cleanCoach || undefined,
        });
        resetForm();
        onClose();
    };

    if (!isOpen) return null;

    const isSlotOccupied = Boolean(startSlot && occupiedSlots.includes(startSlot));
    const isSaveDisabled = Boolean(
        !effectiveTitle ||
        !startSlot ||
        isAthleteAnalysisLimitReached ||
        (currentRole === "athlete" && (!coachName || isSlotOccupied)) ||
        (currentRole !== "athlete" && eventType !== "other" && participants.length === 0)
    );

    const selfName = currentUserName || currentCoachName;
    const isSelfIncluded = Boolean(selfName && participants.includes(selfName));

    const inputCls = "w-full px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-zinc-100 placeholder:text-zinc-400";

    return (
        <>
            <div className="fixed inset-0 bg-black/40 z-50 animate-in fade-in duration-300" onClick={onClose} />

            <div className={cn(
                "fixed z-50",
                "inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-md sm:w-full sm:max-h-[90vh]",
                "animate-slide-up sm:animate-in sm:fade-in sm:duration-300"
            )}>
                <div className="bg-white dark:bg-zinc-900 rounded-t-[2.5rem] sm:rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 max-h-[90vh] sm:max-h-[85vh] flex flex-col">

                    {/* Handle bar (mobile) */}
                    <div className="flex justify-center pt-4 pb-1 sm:hidden">
                        <div className="w-12 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                    </div>

                    {/* Header */}
                    <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
                        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                            {editEvent ? "예약 수정" : "예약 등록"}
                        </h2>
                        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                            <X size={20} className="text-zinc-500" />
                        </button>
                    </div>

                    {/* Form (scrollable) */}
                    <div className="px-3 sm:px-5 py-3 pb-8 flex flex-col gap-3 overflow-y-auto flex-1 min-h-0">

                        {/* 1. Reservation type */}
                        <div>
                            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2">예약 유형</label>
                            <div className="grid grid-cols-4 gap-2">
                                {EVENT_TYPES.map((t) => (
                                    <button key={t.value} type="button" onClick={() => setEventType(t.value)}
                                        className={cn(
                                            "h-[42px] flex items-center justify-center gap-1.5 px-2 rounded-xl border-2 transition-all text-xs font-semibold",
                                            eventType === t.value
                                                ? "border-brand-navy dark:border-brand-navy-light bg-brand-navy/5 dark:bg-brand-navy/20 text-brand-navy dark:text-brand-navy-light font-bold"
                                                : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 text-zinc-600 dark:text-zinc-400"
                                        )}>
                                        <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", t.color)} />
                                        <span>{t.label}</span>
                                    </button>
                                ))}
                            </div>
                            {currentRole === "athlete" && eventType === "analysis" && (
                                <div
                                    className={cn(
                                        "mt-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold border",
                                        isAthleteAnalysisLimitReached
                                            ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400"
                                            : "bg-blue-50/70 dark:bg-blue-950/20 border-blue-200/70 dark:border-blue-800/50 text-blue-700 dark:text-blue-300"
                                    )}
                                >
                                    {isAthleteAnalysisLimitReached
                                        ? `이번 달(${date.slice(0, 7)}) 분석 예약 2회를 모두 사용했습니다. (월 2회 제한)`
                                        : `이번 달(${date.slice(0, 7)}) 분석 예약: ${athleteAnalysisCount}/2회 사용`}
                                </div>
                            )}
                            {eventType === "other" && (
                                <div className="mt-2.5">
                                    <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                                        기타 내용 <span className="text-zinc-400 font-normal">(선택)</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={otherNote}
                                        onChange={(e) => setOtherNote(e.target.value)}
                                        placeholder="내용을 입력하세요 (예: 외부 미팅, 장비 점검)"
                                        className={inputCls}
                                    />
                                </div>
                            )}
                        </div>

                        {/* 2. Coach */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                                    담당 코치 <span className="text-red-500">*</span>
                                </label>
                                {eventType === "analysis" ? (
                                    <span className="text-[11px] font-semibold text-orange-600 dark:text-orange-400">분석 전담 감독</span>
                                ) : currentUserBranch && currentRole === "athlete" ? (
                                    <span className="text-[11px] font-medium text-zinc-400">{currentUserBranch} 코치진</span>
                                ) : null}
                            </div>

                            <div
                                className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-hide scroll-smooth [&::-webkit-scrollbar]:hidden"
                                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                                onWheel={(e) => {
                                    if (e.deltaY !== 0) {
                                        e.currentTarget.scrollLeft += e.deltaY;
                                    }
                                }}
                            >
                                {availableCoaches.map((c) => {
                                    const isSelected = coachName === c.name || coachName === c.originalName;
                                    return (
                                        <button
                                            key={c.id}
                                            type="button"
                                            onClick={() => setCoachName(c.originalName || c.name)}
                                            className={cn(
                                                "h-[42px] shrink-0 px-4 rounded-xl text-sm font-semibold transition-all border shadow-sm whitespace-nowrap flex items-center justify-center",
                                                isSelected
                                                    ? "bg-brand-navy border-brand-navy text-white font-bold scale-[1.02] shadow"
                                                    : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-zinc-400 text-zinc-700 dark:text-zinc-200"
                                            )}
                                        >
                                            {c.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 3. Participants */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                                    참여 선수 {eventType !== "other" && <span className="text-red-500">*</span>}
                                </label>
                                {currentRole !== "athlete" && selfName && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (isSelfIncluded) {
                                                removeParticipant(selfName);
                                            } else {
                                                setParticipants(prev => [...prev, selfName]);
                                            }
                                        }}
                                        className={cn(
                                            "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border",
                                            isSelfIncluded
                                                ? "bg-brand-navy border-brand-navy text-white"
                                                : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-brand-navy"
                                        )}
                                    >
                                        {isSelfIncluded ? `✓ 본인 (${selfName})` : `+ 본인 (${selfName})`}
                                    </button>
                                )}
                            </div>
                            {currentRole === "athlete" ? (
                                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-bold text-zinc-800 dark:text-zinc-200">
                                    <span>{currentUserName || "본인"}</span>
                                    <span className="text-xs font-normal text-zinc-400">(본인 계정)</span>
                                </div>
                            ) : (
                                <AthleteSearch
                                    selectedNames={participants}
                                    onSelect={(name) => {
                                        if (!participants.includes(name)) {
                                            setParticipants(prev => [...prev, name]);
                                        }
                                    }}
                                    onRemove={removeParticipant}
                                />
                            )}
                        </div>

                        {/* 4. Date */}
                        <div>
                            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">날짜</label>
                            <DatePickerInput
                                value={date}
                                onChange={(e: any) => {
                                    const val = e?.target?.value ?? e;
                                    if (typeof val === "string") setDate(val);
                                }}
                                className="w-full py-2 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-semibold text-zinc-800 dark:text-zinc-100"
                            />
                        </div>

                        {/* 5. Time slots */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                                    시간 <span className="text-red-500">*</span>
                                </label>
                                {currentRole !== "athlete" && (
                                    <span className="text-[11px] text-zinc-400">
                                        {isSelectingRangeEnd
                                            ? "종료 타임을 클릭하세요 (같은 타임 재클릭 시 해제)"
                                            : "시작·종료 타임 클릭 시 연속 선택"}
                                    </span>
                                )}
                            </div>

                            <div className={cn(
                                "grid gap-2 mb-2",
                                activeTimeSlots.length <= 7 ? "grid-cols-4 sm:grid-cols-7" : "grid-cols-4 sm:grid-cols-6"
                            )}>
                                {activeTimeSlots.map((slot) => {
                                    const selected = Boolean(
                                        startSlot &&
                                        (endSlot
                                            ? slot.start >= startSlot && slot.end <= endSlot
                                            : slot.start === startSlot)
                                    );
                                    const isOccupied = occupiedSlots.includes(slot.start);
                                    const isAthleteBlocked = currentRole === "athlete" && isOccupied;

                                    return (
                                        <button
                                            key={slot.key}
                                            type="button"
                                            disabled={isAthleteBlocked}
                                            onClick={() => !isAthleteBlocked && handleSlotClick(slot)}
                                            title={isOccupied ? "해당 시간에 코치의 일정이 이미 등록되어 있습니다." : ""}
                                            className={cn(
                                                "h-[42px] rounded-xl text-sm font-semibold transition-all text-center border shadow-sm relative flex flex-col items-center justify-center overflow-hidden",
                                                isOccupied
                                                    ? "bg-zinc-100 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500" +
                                                      (isAthleteBlocked ? " cursor-not-allowed opacity-75" : " hover:border-zinc-300 dark:hover:border-zinc-700")
                                                    : selected
                                                    ? "bg-brand-navy border-brand-navy text-white font-bold scale-[1.02] shadow"
                                                    : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-zinc-400 text-zinc-700 dark:text-zinc-200"
                                            )}
                                        >
                                            {/* Diagonal Slash Line when occupied */}
                                            {isOccupied && (
                                                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                                    <svg
                                                        className="w-full h-full text-zinc-300 dark:text-zinc-600"
                                                        preserveAspectRatio="none"
                                                        viewBox="0 0 100 100"
                                                    >
                                                        <line
                                                            x1="10"
                                                            y1="90"
                                                            x2="90"
                                                            y2="10"
                                                            stroke="currentColor"
                                                            strokeWidth="2"
                                                            strokeLinecap="round"
                                                        />
                                                    </svg>
                                                </div>
                                            )}

                                            <span className={cn("relative z-10 leading-none", isOccupied && "text-zinc-400 dark:text-zinc-500 text-xs")}>
                                                {slot.label}
                                            </span>
                                            {isOccupied && (
                                                <span className="relative z-10 text-[9px] font-medium text-zinc-400 dark:text-zinc-500 leading-none mt-0.5">
                                                    (예약됨)
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="flex items-center justify-between text-xs text-zinc-400 pt-1 border-t border-zinc-100 dark:border-zinc-800">
                                <span>선택: <strong className="text-zinc-700 dark:text-zinc-200">{timeLabel}</strong></span>
                            </div>
                        </div>

                    </div>

                    {/* Footer (Bottom-right action buttons) */}
                    <div className="flex-shrink-0 flex items-center justify-between px-6 py-3.5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 sm:rounded-b-2xl">
                        <div>
                            {editEvent && onDelete && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (confirm("예약을 삭제하시겠습니까?")) {
                                            onDelete(editEvent.id);
                                            onClose();
                                        }
                                    }}
                                    className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                >
                                    삭제
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={isSaveDisabled}
                                title={!startSlot ? "시간을 선택해주세요" : (currentRole === "athlete" && !coachName) ? "담당 코치를 선택해주세요" : (currentRole === "athlete" && isSlotOccupied) ? "선택하신 시간대에 코치 일정이 있어 예약할 수 없습니다" : !effectiveTitle ? "선수 또는 제목을 입력해주세요" : ""}
                                className={cn(
                                    "px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors shadow-sm",
                                    !isSaveDisabled
                                        ? "bg-brand-red text-white hover:bg-brand-red-dark"
                                        : "bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600 cursor-not-allowed"
                                )}
                            >
                                {editEvent ? "수정" : "예약"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
