"use client";

import { useState, useEffect, useRef } from "react";
import {
    ChevronLeft,
    ChevronRight,
    Trash2,
    Plus,
    Save,
    Car,
    Check,
    AlertCircle,
    Calendar,
    X,
} from "lucide-react";
import {
    CoachTrip,
    CoachTripCategory,
    getStoredCoachTrips,
    saveAllCoachTrips
} from "@/lib/coach-trip-sync";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DatePickerInput } from "@/components/ui/DatePickerInput";
import { CoachSearch } from "@/components/ui/CoachSearch";

const CATEGORIES: CoachTripCategory[] = ["대회 출장", "필드 레슨", "기타"];
const CATEGORY_COLORS: Record<CoachTripCategory, string> = {
    "대회 출장": "bg-blue-100 text-blue-700 border-transparent",
    "필드 레슨": "bg-emerald-100 text-emerald-700 border-transparent",
    "기타": "bg-white border-zinc-200 text-zinc-700",
};

export default function CoachTripAdminPage() {
    const [allTrips, setAllTrips] = useState<CoachTrip[]>([]);
    const [hasMounted, setHasMounted] = useState(false);
    const [savedOk, setSavedOk] = useState(false);
    const [deletedIds, setDeletedIds] = useState<string[]>([]);
    const endInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    const today = new Date();
    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);

    // Track participants input (for legacy or just managing state before save)
    // Actually with CoachSearch, we'll update the 'participants' array in allTrips directly.
    const [participantInput, setParticipantInput] = useState<Record<string, string>>({});

    useEffect(() => {
        setHasMounted(true);
        getStoredCoachTrips().then(stored => {
            // Initial sort: Date descending
            stored.sort((a, b) => {
                const aDate = a.date.split("~")[0].trim();
                const bDate = b.date.split("~")[0].trim();
                return bDate.localeCompare(aDate);
            });

            setAllTrips(stored);

            const inputs: Record<string, string> = {};
            stored.forEach(t => { inputs[t.id] = t.participants.join(", "); });
            setParticipantInput(inputs);
        });
    }, []);

    // Visible trips for current month - NO automatic sorting here to prevent jumping
    const monthTrips = allTrips.filter(t => {
        const y = t.year ?? viewYear;
        const startStr = t.date.split("~")[0].trim();
        const month = parseInt(startStr.split("-")[0]);
        return y === viewYear && (isNaN(month) || month === viewMonth);
    });

    const navigate = (dir: "prev" | "next") => {
        if (dir === "prev") {
            if (viewMonth === 1) { setViewMonth(12); setViewYear(y => y - 1); }
            else setViewMonth(m => m - 1);
        } else {
            if (viewMonth === 12) { setViewMonth(1); setViewYear(y => y + 1); }
            else setViewMonth(m => m + 1);
        }
    };

    const handleAddRow = () => {
        const newId = crypto.randomUUID();
        const newTrip: CoachTrip = {
            id: newId,
            date: "",
            year: viewYear,
            venue: "",
            category: "대회 출장",
            participants: [],
            remarks: "",
        };
        setAllTrips(prev => [...prev, newTrip]);
        setParticipantInput(prev => ({ ...prev, [newId]: "" }));
    };

    const handleUpdate = (id: string, field: keyof CoachTrip, value: any) => {
        setAllTrips(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
    };

    const handleDateChange = (id: string, type: "start" | "end", dateVal: string) => {
        setAllTrips(prev => prev.map(t => {
            if (t.id !== id) return t;
            let start = "";
            let end = "";
            if (t.date) {
                const parts = t.date.split("~").map(s => s.trim());
                start = parts[0] || "";
                end = parts[1] || "";
            }
            const md = dateVal ? dateVal.slice(5) : "";
            if (type === "start") start = md;
            if (type === "end") end = md;

            let newDate = "";
            if (start && end && start !== end) newDate = `${start} ~ ${end}`;
            else if (start) newDate = start;

            return { ...t, date: newDate };
        }));

        if (type === "start" && dateVal) {
            setTimeout(() => {
                try {
                    // Try to open the one that's currently visible
                    const isMobile = window.innerWidth < 768;
                    const ref = isMobile ? endInputRefs.current[`mobile-${id}`] : endInputRefs.current[id];
                    ref?.showPicker?.();
                } catch (err) {
                    console.warn("Browser blocked auto-opening picker:", err);
                }
            }, 50);
        }
    };

    const handleDelete = (id: string, venue?: string) => {
        if (!window.confirm(`"${venue || "이 출장 일정"}"을(를) 정말 삭제하시겠습니까?`)) return;
        setAllTrips(prev => prev.filter(t => t.id !== id));
        setDeletedIds(prev => [...prev, id]);
        setParticipantInput(prev => { const n = { ...prev }; delete n[id]; return n; });
    };

    const handleSave = async () => {
        try {
            // Commit latest changes to DB
            await saveAllCoachTrips(allTrips, deletedIds);
            setDeletedIds([]); // Clear deleted tracking after successful save

            // Re-fetch or re-sort local state descending
            const sorted = [...allTrips].sort((a, b) => {
                const aDate = a.date.split("~")[0].trim();
                const bDate = b.date.split("~")[0].trim();
                return bDate.localeCompare(aDate);
            });
            setAllTrips(sorted);
            
            setSavedOk(true);
            setTimeout(() => setSavedOk(false), 2500);
        } catch (err) {
            console.error("Save failed:", err);
            alert("저장에 실패했습니다.");
        }
    };

    if (!hasMounted) return null;

    const MONTH_LABEL = `${viewYear}년 ${viewMonth}월`;

    const getStartInputDate = (t: CoachTrip) => {
        if (!t.date) return "";
        const md = t.date.split("~")[0].trim();
        return `${viewYear}-${md}`;
    };
    const getEndInputDate = (t: CoachTrip) => {
        if (!t.date) return "";
        const parts = t.date.split("~").map(s => s.trim());
        const md = parts.length > 1 ? parts[1] : parts[0];
        return `${viewYear}-${md}`;
    };

    return (
        <div className="p-4 sm:p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-brand-navy rounded-xl flex items-center justify-center text-white shrink-0">
                        <Car size={22} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">출장 스케쥴 등록</h1>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">월별 출장 일정을 등록하고 관리하세요.</p>
                    </div>
                </div>
            </div>

            {/* Month Navigator */}
            <div className="flex items-center justify-center gap-4 mb-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 px-4 py-3 shadow-sm max-w-sm mx-auto">
                <button
                    onClick={() => navigate("prev")}
                    className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                    <ChevronLeft size={18} />
                </button>
                <span className="text-base font-bold text-zinc-900 dark:text-zinc-50 min-w-[110px] text-center">{MONTH_LABEL}</span>
                <button
                    onClick={() => navigate("next")}
                    className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                    <ChevronRight size={18} />
                </button>
            </div>

            {/* Empty State */}
            {monthTrips.length === 0 && (
                <div className="text-center py-10 bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 text-zinc-400 text-sm">
                    이 달에 등록된 출장 일정이 없습니다.
                </div>
            )}

            {/* Desktop Layout */}
            <div className="hidden md:flex flex-col gap-3">
                {monthTrips.map((t, index) => (
                    <div
                        key={t.id}
                        className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative"
                        style={{ zIndex: monthTrips.length - index }}
                    >
                        {/* Row 1: Category / Date / Venue / Remarks / Delete */}
                        <div className="flex items-end gap-3 px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 rounded-t-2xl">
                            <div className="flex flex-col gap-1 shrink-0">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1">구분</span>
                                <select
                                    className={cn(
                                        "h-[34px] text-xs font-bold px-3 rounded-lg border cursor-pointer focus:outline-none appearance-none text-center min-w-[100px]",
                                        CATEGORY_COLORS[t.category]
                                    )}
                                    value={t.category}
                                    onChange={(e) => handleUpdate(t.id, "category", e.target.value as CoachTripCategory)}
                                >
                                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                            </div>

                            <div className="flex flex-col gap-1 shrink-0">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1">일정</span>
                                <div className="flex items-center gap-1.5">
                                    <DatePickerInput
                                        className="h-[34px] min-h-[34px] w-[110px] px-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs text-center"
                                        value={getStartInputDate(t)}
                                        onChange={(e) => handleDateChange(t.id, "start", e.target.value)}
                                    />
                                    <span className="text-zinc-400 text-xs">~</span>
                                    <DatePickerInput
                                        ref={el => { endInputRefs.current[t.id] = el; }}
                                        className="h-[34px] min-h-[34px] w-[110px] px-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs text-center"
                                        value={getEndInputDate(t)}
                                        onChange={(e) => handleDateChange(t.id, "end", e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1">출장지</span>
                                <input
                                    type="text"
                                    placeholder="출장 장소"
                                    className="h-[34px] w-full px-3 bg-transparent dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs"
                                    value={t.venue}
                                    onChange={(e) => handleUpdate(t.id, "venue", e.target.value)}
                                />
                            </div>

                            <div className="flex flex-col gap-1 flex-[1.5] min-w-[150px]">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1">내용</span>
                                <input
                                    type="text"
                                    placeholder="내용"
                                    className="h-[34px] w-full px-3 bg-transparent dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs"
                                    value={t.remarks}
                                    onChange={(e) => handleUpdate(t.id, "remarks", e.target.value)}
                                />
                            </div>

                            <div className="flex flex-col justify-end pb-1.5 shrink-0">
                                <button
                                    onClick={() => handleDelete(t.id, t.venue)}
                                    className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Row 2: Participants */}
                        <div className="flex items-center gap-2.5 px-5 py-3 bg-white dark:bg-zinc-800/30 rounded-b-2xl">
                            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider shrink-0">출장자 배정</span>
                            <div className="flex-1 flex flex-wrap items-center gap-1.5">
                                {t.participants.map(name => (
                                    <div key={name} className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md text-[11px] font-bold text-zinc-700 dark:text-zinc-300 shadow-sm transition-all">
                                        <span>{name}</span>
                                        <button onClick={() => {
                                            const next = t.participants.filter(p => p !== name);
                                            handleUpdate(t.id, "participants", next);
                                        }} className="text-zinc-300 hover:text-red-500">
                                            <X size={11} />
                                        </button>
                                    </div>
                                ))}
                                <div className="w-[180px]">
                                    <CoachSearch
                                        selectedNames={t.participants}
                                        showChips={false}
                                        onSelect={(name) => {
                                            const next = [...t.participants, name];
                                            handleUpdate(t.id, "participants", next);
                                        }}
                                        placeholder="코치 추가"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Mobile Layout */}
            <div className="md:hidden flex flex-col gap-3">
                {monthTrips.map((t, index) => (
                    <div
                        key={t.id}
                        className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative"
                        style={{ zIndex: monthTrips.length - index }}
                    >
                        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-transparent dark:bg-zinc-800/50 rounded-t-2xl">
                            <select
                                className={cn(
                                    "text-[13px] font-bold px-4 py-2 rounded-xl border cursor-pointer focus:outline-none appearance-none min-w-[110px] text-center",
                                    CATEGORY_COLORS[t.category]
                                )}
                                value={t.category}
                                onChange={(e) => handleUpdate(t.id, "category", e.target.value as CoachTripCategory)}
                            >
                                {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                            <button
                                onClick={() => handleDelete(t.id, t.venue)}
                                className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                            >
                                <Trash2 size={15} />
                            </button>
                        </div>

                        <div className="p-4 flex flex-col gap-3">
                            <div className="flex flex-col gap-1 bg-transparent dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
                                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <Calendar size={12} /> 출장 일정
                                </label>
                                <div className="flex items-center gap-2 mt-1">
                                    <DatePickerInput
                                        className="w-full px-2 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-[13px]"
                                        value={getStartInputDate(t)}
                                        onChange={(e) => handleDateChange(t.id, "start", e.target.value)}
                                    />
                                    <span className="text-zinc-300 font-light">~</span>
                                    <DatePickerInput
                                        ref={el => { endInputRefs.current[`mobile-${t.id}`] = el; }}
                                        className="w-full px-2 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-[13px]"
                                        value={getEndInputDate(t)}
                                        onChange={(e) => handleDateChange(t.id, "end", e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">출장지</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 bg-transparent dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-[13px]"
                                    value={t.venue}
                                    onChange={(e) => handleUpdate(t.id, "venue", e.target.value)}
                                    placeholder="장소 입력"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">출장자 배정</label>
                                <CoachSearch
                                    selectedNames={t.participants}
                                    onSelect={(name) => {
                                        const next = [...t.participants, name];
                                        handleUpdate(t.id, "participants", next);
                                    }}
                                    onRemove={(name) => {
                                        const next = t.participants.filter(p => p !== name);
                                        handleUpdate(t.id, "participants", next);
                                    }}
                                    placeholder="코치 선택"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">내용</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 bg-transparent dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-[13px]"
                                    value={t.remarks}
                                    onChange={(e) => handleUpdate(t.id, "remarks", e.target.value)}
                                    placeholder="내용 입력"
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add & Save buttons */}
            <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
                <button
                    onClick={handleAddRow}
                    className="flex-1 w-full flex items-center justify-center gap-2 py-3.5 bg-white dark:bg-zinc-900 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl text-sm font-semibold text-brand-navy dark:text-brand-navy-light hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all active:scale-[0.99]"
                >
                    <Plus size={18} /> {MONTH_LABEL} 출장 일정 추가
                </button>
                <button
                    onClick={handleSave}
                    className={cn(
                        "w-full sm:w-[160px] flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-semibold shadow-sm transition-all active:scale-95",
                        savedOk
                            ? "bg-emerald-500 text-white"
                            : "bg-brand-navy hover:bg-brand-navy-dark text-white"
                    )}
                >
                    {savedOk ? <Check size={18} /> : <Save size={18} />}
                    {savedOk ? "저장 완료" : "일정 저장하기"}
                </button>
            </div>

            {/* Footer */}
            <div className="mt-5 flex justify-between items-center text-xs text-zinc-400 pb-10">
                <p></p>
                <Link href="/schedule/coach-trips" className="flex items-center gap-1 hover:text-brand-navy transition-colors">
                    출장 스케쥴 <ChevronRight size={12} />
                </Link>
            </div>
        </div>
    );
}
