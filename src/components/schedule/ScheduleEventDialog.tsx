"use client";

import React, { useState, useMemo } from "react";
import { format } from "date-fns";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScheduleEvent } from "./ScheduleCalendar";
import { DatePickerInput } from "@/components/ui/DatePickerInput";
import { AthleteSearch } from "@/components/ui/AthleteSearch";

interface ScheduleEventDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (event: Omit<ScheduleEvent, "id">) => void;
    onDelete?: (id: string) => void;
    editEvent?: ScheduleEvent;
    initialDate?: Date;
    currentCoachName?: string;
}

const EVENT_TYPES: { value: ScheduleEvent["type"]; label: string; color: string }[] = [
    { value: "analysis", label: "측정", color: "bg-orange-500" },
    { value: "lesson", label: "레슨", color: "bg-blue-500" },
    { value: "training", label: "훈련", color: "bg-emerald-500" },
    { value: "consultation", label: "상담", color: "bg-amber-500" },
    { value: "other", label: "기타", color: "bg-zinc-400" },
];

const CATEGORIES: Record<string, { value: string; label: string }[]> = {
    lesson: [
        { value: "shot", label: "Shot" },
        { value: "pitch", label: "Pitch" },
        { value: "bunker", label: "Bunker" },
        { value: "approach", label: "Approach" },
        { value: "putt", label: "Putt" },
        { value: "physical", label: "Physical" },
        { value: "etc", label: "Etc" },
        { value: "field", label: "Field" },
    ],
    analysis: [
        { value: "shot", label: "Shot" },
        { value: "short_game", label: "Short Game" },
        { value: "physical", label: "Physical" },
        { value: "etc", label: "Etc" },
    ],
    training: [
        { value: "shot", label: "Shot" },
        { value: "pitch", label: "Pitch" },
        { value: "bunker", label: "Bunker" },
        { value: "approach", label: "Approach" },
        { value: "putt", label: "Putt" },
        { value: "physical", label: "Physical" },
        { value: "etc", label: "Etc" },
    ],
};

const ALL_SLOTS = [
    "07:00", "07:30", "08:00", "08:30", "09:00", "09:30",
    "10:00", "10:30", "11:00", "11:30", "12:00", "12:30",
    "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
    "16:00", "16:30", "17:00", "17:30", "18:00", "18:30",
];
const AM_SLOTS = ALL_SLOTS.filter((s) => parseInt(s) < 13);
const PM_SLOTS = ALL_SLOTS.filter((s) => parseInt(s) >= 13);

function slotLabel(slot: string) {
    const h = parseInt(slot.split(":")[0]);
    const m = slot.split(":")[1];
    return `${h > 12 ? h - 12 : h}:${m}`;
}

type Period = "am" | "pm";

// Auto-generate title based on event type and participants
function autoTitle(type: ScheduleEvent["type"], participants: string[]): string {
    const typeLabel = EVENT_TYPES.find((t) => t.value === type)?.label || "";
    if (participants.length === 0) return "";
    if (participants.length === 1) return `${typeLabel} ${participants[0]}`;
    return `${typeLabel} ${participants[0]} 외 ${participants.length - 1}명`;
}

export function ScheduleEventDialog({
    isOpen,
    onClose,
    onSave,
    onDelete,
    editEvent,
    initialDate,
    currentCoachName = ""
}: ScheduleEventDialogProps) {
    const today = initialDate || new Date();
    const [title, setTitle] = useState("");
    const [titleManuallySet, setTitleManuallySet] = useState(false);
    const [eventType, setEventType] = useState<ScheduleEvent["type"]>("lesson");
    const [date, setDate] = useState(format(today, "yyyy-MM-dd"));
    const [startSlot, setStartSlot] = useState<string | null>(null);
    const [endSlot, setEndSlot] = useState<string | null>(null);
    const [isAllDay, setIsAllDay] = useState(false);
    const [period, setPeriod] = useState<Period>("am");
    const [participants, setParticipants] = useState<string[]>([]);
    const [participantInput, setParticipantInput] = useState("");
    const [coachName, setCoachName] = useState(currentCoachName);
    const [category, setCategory] = useState<string | null>(null);

    // Effect to populate form when editEvent changes
    React.useEffect(() => {
        if (editEvent) {
            setTitle(editEvent.title);
            setTitleManuallySet(true);
            setEventType(editEvent.type);
            setDate(format(editEvent.start, "yyyy-MM-dd"));
            const s = format(editEvent.start, "HH:mm");
            const e = format(editEvent.end, "HH:mm");
            setStartSlot(s);
            setEndSlot(e === s ? null : e);
            const hour = editEvent.start.getHours();
            setPeriod(hour >= 13 ? "pm" : "am");
            setParticipants(editEvent.participantName ? editEvent.participantName.split(", ") : []);
            setCoachName(editEvent.coachName || "");
            setCategory(editEvent.category || null);
            setIsAllDay(s === "08:00" && e === "18:00");
        } else {
            resetForm();
        }
    }, [editEvent, isOpen]);

    const slots = period === "am" ? AM_SLOTS : PM_SLOTS;
    const availableCategories = CATEGORIES[eventType] || [];

    // Auto-title: update whenever type or participants change, unless user manually typed
    const effectiveTitle = useMemo(() => {
        if (titleManuallySet && title) return title;
        return autoTitle(eventType, participants);
    }, [eventType, participants, title, titleManuallySet]);

    const handleTitleChange = (val: string) => {
        setTitle(val);
        setTitleManuallySet(val.length > 0);
    };

    // Participant management
    const addParticipant = () => {
        const name = participantInput.trim();
        if (name && !participants.includes(name)) {
            setParticipants((prev) => [...prev, name]);
        }
        setParticipantInput("");
    };

    const removeParticipant = (name: string) => {
        setParticipants((prev) => prev.filter((p) => p !== name));
    };

    const handleParticipantKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") { e.preventDefault(); addParticipant(); }
    };

    // Time slot logic
    const handleSlotClick = (slot: string) => {
        if (isAllDay) setIsAllDay(false);
        if (!startSlot || (startSlot && endSlot)) {
            setStartSlot(slot); setEndSlot(null);
        } else {
            const si = ALL_SLOTS.indexOf(startSlot);
            const ei = ALL_SLOTS.indexOf(slot);
            if (ei >= si) { setEndSlot(slot); }
            else { setEndSlot(startSlot); setStartSlot(slot); }
        }
    };

    const handleAllDay = () => { setIsAllDay(true); setStartSlot("08:00"); setEndSlot("18:00"); };

    const isInRange = (slot: string) => {
        if (!startSlot) return false;
        const si = ALL_SLOTS.indexOf(startSlot);
        const ci = ALL_SLOTS.indexOf(slot);
        if (!endSlot) return slot === startSlot;
        const ei = ALL_SLOTS.indexOf(endSlot);
        return ci >= si && ci <= ei;
    };
    const isStart = (slot: string) => slot === startSlot;
    const isEnd = (slot: string) => slot === endSlot;

    const timeLabel = useMemo(() => {
        if (isAllDay) return "종일 (08:00 ~ 18:00)";
        if (!startSlot) return "시간을 선택하세요";
        if (!endSlot) return `${slotLabel(startSlot)} ~ (종료 시간 선택)`;
        return `${slotLabel(startSlot)} ~ ${slotLabel(endSlot)}`;
    }, [startSlot, endSlot, isAllDay]);

    const resetForm = () => {
        setTitle(""); setTitleManuallySet(false); setEventType("lesson");
        setDate(format(today, "yyyy-MM-dd"));
        setStartSlot(null); setEndSlot(null); setIsAllDay(false); setPeriod("am");
        setParticipants([]); setParticipantInput(""); setCoachName(currentCoachName);
    };

    const handleSave = () => {
        const finalTitle = effectiveTitle;
        if (!finalTitle || !startSlot) return;
        const end = endSlot || startSlot;
        onSave({
            title: finalTitle,
            type: eventType,
            category: category || undefined,
            start: new Date(`${date}T${startSlot}:00`),
            end: new Date(`${date}T${end}:00`),
            participantName: participants.join(", ") || undefined,
            coachName: coachName.trim() || undefined,
        });
        resetForm();
        setCategory(null);
        onClose();
    };

    if (!isOpen) return null;

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
                            {editEvent ? "일정 수정" : "일정 등록"}
                        </h2>
                        <div className="flex items-center gap-2">
                            {editEvent && onDelete && (
                                <button
                                    onClick={() => {
                                        if (confirm("일정을 삭제하시겠습니까?")) {
                                            onDelete(editEvent.id);
                                            onClose();
                                        }
                                    }}
                                    className="px-3 py-2 rounded-lg text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                >
                                    삭제
                                </button>
                            )}
                            <button onClick={handleSave} disabled={!effectiveTitle || !startSlot}
                                className={cn(
                                    "px-5 py-2 rounded-lg text-sm font-semibold transition-colors",
                                    effectiveTitle && startSlot
                                        ? "bg-red-500 text-white hover:bg-red-600"
                                        : "bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600 cursor-not-allowed"
                                )}
                            >
                                {editEvent ? "수정" : "등록"}
                            </button>
                            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                                <X size={20} className="text-zinc-500" />
                            </button>
                        </div>
                    </div>

                    {/* Form (scrollable) */}
                    <div className="px-3 sm:px-5 py-3 pb-8 flex flex-col gap-3 overflow-y-auto flex-1 min-h-0">

                        {/* 1. Event type */}
                        <div>
                            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2">일정 유형</label>
                            <div className="grid grid-cols-6 gap-1.5">
                                {EVENT_TYPES.map((t) => (
                                    <button key={t.value} type="button" onClick={() => setEventType(t.value)}
                                        className={cn(
                                            "flex flex-col items-center gap-1 py-2 rounded-xl border-2 transition-all text-[10px] sm:text-xs font-medium",
                                            eventType === t.value
                                                ? "border-zinc-900 dark:border-zinc-100 bg-transparent dark:bg-zinc-800"
                                                : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300"
                                        )}>
                                        <span className={cn("w-3 h-3 rounded-full", t.color)} />
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 1.5 Category selection (conditionally shown) */}
                        {availableCategories.length > 0 && (
                            <div>
                                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2">상세 파트</label>
                                <div className="flex flex-nowrap overflow-x-auto gap-2 pb-2 scrollbar-hide">
                                    {availableCategories.map((cat) => (
                                        <button key={cat.value} type="button" onClick={() => setCategory(cat.value)}
                                            className={cn(
                                                "px-4 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap shrink-0",
                                                category === cat.value
                                                    ? "bg-zinc-900 border-zinc-900 text-white dark:bg-zinc-100 dark:border-zinc-100 dark:text-zinc-900"
                                                    : "bg-transparent border-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400"
                                            )}>
                                            {cat.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 2. Coach (auto-filled) */}
                        <div>
                            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">담당 코치</label>
                            <input type="text" value={coachName} onChange={(e) => setCoachName(e.target.value)}
                                placeholder="자동 입력됨" className={cn(inputCls, "bg-transparent dark:bg-zinc-800/60")} />
                        </div>

                        {/* 3. Participants (multi-select chips) */}
                        <div>
                            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2">참여 선수</label>
                            <AthleteSearch
                                selectedNames={participants}
                                onSelect={(name) => {
                                    if (!participants.includes(name)) {
                                        setParticipants(prev => [...prev, name]);
                                    }
                                }}
                                onRemove={(name) => {
                                    setParticipants(prev => prev.filter(p => p !== name));
                                }}
                                placeholder="선수 이름을 검색하여 선택하세요..."
                            />
                        </div>

                        {/* 4. Title (auto-generated or manual - only shown for 'other') */}
                        {eventType === "other" && (
                            <div>
                                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">제목</label>
                                <input type="text"
                                    value={titleManuallySet ? title : effectiveTitle}
                                    onChange={(e) => handleTitleChange(e.target.value)}
                                    placeholder="직접 입력"
                                    className={cn(inputCls, !titleManuallySet ? "bg-transparent dark:bg-zinc-800/60" : "")} />
                            </div>
                        )}

                        {/* 5. Date */}
                        <div>
                            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">날짜</label>
                            <DatePickerInput value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
                        </div>

                        {/* 6. Time */}
                        <div>
                            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2">시간</label>
                            <div className="flex items-center mb-2">
                                <div className="flex bg-transparent border border-zinc-200 dark:bg-zinc-800 rounded-lg p-0.5">
                                    <button type="button" onClick={() => { setPeriod("am"); setIsAllDay(false); }}
                                        className={cn("px-4 py-1.5 rounded-md text-xs font-semibold transition-all",
                                            period === "am" && !isAllDay ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 shadow-sm" : "text-zinc-500 dark:text-zinc-400"
                                        )}>오전</button>
                                    <button type="button" onClick={() => { setPeriod("pm"); setIsAllDay(false); }}
                                        className={cn("px-4 py-1.5 rounded-md text-xs font-semibold transition-all",
                                            period === "pm" && !isAllDay ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 shadow-sm" : "text-zinc-500 dark:text-zinc-400"
                                        )}>오후</button>
                                    <button type="button" onClick={handleAllDay}
                                        className={cn("px-4 py-1.5 rounded-md text-xs font-semibold transition-all",
                                            isAllDay ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 shadow-sm" : "text-zinc-500 dark:text-zinc-400"
                                        )}>종일</button>
                                </div>
                            </div>

                            {!isAllDay && (
                                <div style={{ minHeight: "7rem" }}>
                                    <div className="grid grid-cols-6 gap-1.5">
                                        {slots.map((slot) => (
                                            <button key={slot} type="button" onClick={() => handleSlotClick(slot)}
                                                className={cn(
                                                    "py-2 rounded-lg text-xs font-medium transition-all border",
                                                    isStart(slot) || isEnd(slot)
                                                        ? "bg-blue-500 text-white border-blue-500"
                                                        : isInRange(slot)
                                                            ? "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800"
                                                            : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400"
                                                )}>
                                                {slotLabel(slot)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                                선택: <span className="font-semibold text-zinc-800 dark:text-zinc-200">{timeLabel}</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div >
        </>
    );
}
