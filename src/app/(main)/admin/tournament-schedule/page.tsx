"use client";

import { useState, useEffect, useRef } from "react";
import {
    ChevronLeft,
    ChevronRight,
    Trash2,
    Plus,
    Save,
    Trophy,
    Check,
    AlertCircle,
    Calendar,
    X,
} from "lucide-react";
import {
    Tournament,
    TournamentCategory,
    getStoredTournaments,
    saveAllTournaments
} from "@/lib/tournament-sync";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DatePickerInput } from "@/components/ui/DatePickerInput";
import { AthleteSearch } from "@/components/ui/AthleteSearch";
import { fetchAthletes } from "@/lib/athlete-sync";

const CATEGORIES: TournamentCategory[] = ["KGA", "KPGA", "KLPGA", "대학연맹", "중고연맹", "기타"];
const CATEGORY_COLORS: Record<TournamentCategory, string> = {
    KGA: "bg-red-100 text-red-700 border-transparent",
    KPGA: "bg-blue-100 text-blue-700 border-transparent",
    KLPGA: "bg-purple-100 text-purple-700 border-transparent",
    대학연맹: "bg-emerald-100 text-emerald-700 border-transparent",
    중고연맹: "bg-orange-100 text-orange-700 border-transparent",
    기타: "bg-white border-zinc-200 text-zinc-700",
};

export default function TournamentAdminPage() {
    const [allTournaments, setAllTournaments] = useState<Tournament[]>([]);
    const [athletes, setAthletes] = useState<string[]>([]);
    const endInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
    const [hasMounted, setHasMounted] = useState(false);
    const [savedOk, setSavedOk] = useState(false);
    const [deletedIds, setDeletedIds] = useState<string[]>([]);
    const originalTournamentsRef = useRef<Tournament[]>([]);

    // Month navigation
    const today = new Date();
    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth() + 1); // 1-12

    // Player autocomplete state per row: rowId -> { query, suggestions, errors }
    const [playerInput, setPlayerInput] = useState<Record<string, string>>({});
    const [playerErrors, setPlayerErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        setHasMounted(true);
        getStoredTournaments().then(stored => {
            // Migrate old records: if they have 'date' without 'year', assign year from date string
            const migrated = stored.map(t => {
                if (!t.year) {
                    const match = t.date.match(/^(\d{4})-/);
                    return { ...t, year: match ? parseInt(match[1]) : viewYear };
                }
                return t;
            });
            
            // Initial sort: Date descending
            migrated.sort((a, b) => {
                const aDate = a.date.split("~")[0].trim();
                const bDate = b.date.split("~")[0].trim();
                return bDate.localeCompare(aDate);
            });

            setAllTournaments(migrated);
            originalTournamentsRef.current = JSON.parse(JSON.stringify(migrated)); // deep copy

            // Initialize playerInput from existing players
            const inputs: Record<string, string> = {};
            migrated.forEach(t => { inputs[t.id] = t.players.join(", "); });
            setPlayerInput(inputs);
        });

        // Fetch registered athletes from Supabase using centralized helper
        fetchAthletes().then(setAthletes);
    }, []);

    // Tournaments visible for the current month/year
    const monthTournaments = allTournaments
        .filter(t => {
            const y = t.year ?? viewYear;
            const startStr = t.date.split("~")[0].trim();
            const month = parseInt(startStr.split("-")[0]); // MM from MM-DD
            // Allow row to be visible if the month is not yet valid (e.g. newly added row)
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
        const newTournament: Tournament = {
            id: newId,
            date: "",
            year: viewYear,
            name: "",
            venue: "",
            category: "KGA",
            players: [],
        };
        setAllTournaments(prev => [...prev, newTournament]);
        setPlayerInput(prev => ({ ...prev, [newId]: "" }));
    };

    const handleUpdate = (id: string, field: keyof Tournament, value: any) => {
        setAllTournaments(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
    };

    // Date Picker Handlers
    const handleDateChange = (id: string, type: "start" | "end", dateVal: string) => {
        setAllTournaments(prev => prev.map(t => {
            if (t.id !== id) return t;
            // Parse existing
            let start = "";
            let end = "";
            if (t.date) {
                const parts = t.date.split("~").map(s => s.trim());
                start = parts[0] || "";
                end = parts[1] || "";
            }

            // Extract MM-DD from YYYY-MM-DD input
            const md = dateVal ? dateVal.slice(5) : "";

            if (type === "start") start = md;
            if (type === "end") end = md;

            // Construct new string
            let newDate = "";
            if (start && end && start !== end) newDate = `${start} ~ ${end}`;
            else if (start) newDate = start;

            return { ...t, date: newDate };
        }));

        if (type === "start" && dateVal) {
            setTimeout(() => {
                try {
                    const isMobile = window.innerWidth < 768;
                    const ref = isMobile ? endInputRefs.current[`mobile-${id}`] : endInputRefs.current[id];
                    ref?.showPicker?.();
                } catch (err) {
                    console.warn("Browser blocked auto-opening picker:", err);
                }
            }, 50);
        }
    };

    const handleDelete = (id: string, name?: string) => {
        if (!window.confirm(`"${name || "이 일정"}"을(를) 정말 삭제하시겠습니까?`)) return;
        setAllTournaments(prev => prev.filter(t => t.id !== id));
        setDeletedIds(prev => [...prev, id]);
        setPlayerInput(prev => { const n = { ...prev }; delete n[id]; return n; });
        setPlayerErrors(prev => { const n = { ...prev }; delete n[id]; return n; });
    };

    const handleSave = async () => {
        // 0. Clean up completely empty rows (usually newly added but left empty)
        const validTournaments = allTournaments.filter(t => t.name.trim() || t.date.trim());
        const validMonthTournaments = monthTournaments.filter(t => t.name.trim() || t.date.trim());

        // 1. Required field validation (Name, Date)
        for (const t of validMonthTournaments) {
            if (!t.name.trim()) {
                alert("대회명을 입력해 주세요.");
                return;
            }
            if (!t.date.trim()) {
                alert(`"${t.name}"의 대회 일정을 입력해 주세요.`);
                return;
            }
        }

        // 2. Athlete validation (only for currently visible tournaments)
        const errors: Record<string, string> = {};
        const invalidDetails: string[] = [];
        let hasError = false;

        const normalizedAthletes = athletes.map(a => a.normalize("NFC"));

        validMonthTournaments.forEach(t => {
            const raw = playerInput[t.id] ?? "";
            const names = raw.split(",").map(s => s.trim().normalize("NFC")).filter(Boolean);
            
            if (normalizedAthletes.length > 0) {
                const invalid = names.filter(name => !normalizedAthletes.includes(name));
                if (invalid.length > 0) {
                    const msg = `등록되지 않은 선수: ${invalid.join(", ")}`;
                    errors[t.id] = msg;
                    invalidDetails.push(`[${t.date}] ${t.name} : ${invalid.join(", ")}`);
                    hasError = true;
                }
            }
        });

        setPlayerErrors(errors);
        if (hasError) {
            alert(`선수 명단에 등록되지 않은 이름이 있습니다.\n\n${invalidDetails.join("\n")}\n\n선수 관리에서 이름을 확인해 주세요.`);
            return;
        }

        // 3. Commit latest playerInput to actual players array before saving
        const toSave = validTournaments.map(t => ({
            ...t,
            players: (playerInput[t.id] ?? "").split(",").map((s: string) => s.trim()).filter(Boolean),
        })).filter(t => {
            const orig = originalTournamentsRef.current.find(o => o.id === t.id);
            if (!orig) return true; // new tournament
            return orig.name !== t.name || 
                   orig.date !== t.date || 
                   orig.year !== t.year || 
                   orig.venue !== t.venue || 
                   orig.category !== t.category || 
                   JSON.stringify(orig.players) !== JSON.stringify(t.players);
        });
        
        try {
            if (toSave.length === 0 && deletedIds.length === 0) {
                // Nothing changed
                setSavedOk(true);
                setTimeout(() => setSavedOk(false), 2500);
                return;
            }
            await saveAllTournaments(toSave, deletedIds);
            setDeletedIds([]); // Clear deleted tracking after successful save
            
            // Re-fetch or update local state to ensure consistency
            const updatedAll = allTournaments.map(t => ({
                ...t,
                players: (playerInput[t.id] ?? "").split(",").map((s: string) => s.trim()).filter(Boolean),
            })).filter(t => t.name.trim() || t.date.trim());

            updatedAll.sort((a, b) => {
                const aDate = a.date.split("~")[0].trim();
                const bDate = b.date.split("~")[0].trim();
                return bDate.localeCompare(aDate);
            });
            
            setAllTournaments(updatedAll);
            originalTournamentsRef.current = JSON.parse(JSON.stringify(updatedAll));

            setSavedOk(true);
            setTimeout(() => setSavedOk(false), 2500);
        } catch (err: any) {
            console.error("Save failed:", err);
            alert("저장에 실패했습니다: " + JSON.stringify(err));
        }
    };

    if (!hasMounted) return null;

    const MONTH_LABEL = `${viewYear}년 ${viewMonth}월`;

    // Helper to get YYYY-MM-DD for date inputs
    const getStartInputDate = (t: Tournament) => {
        if (!t.date) return "";
        const md = t.date.split("~")[0].trim();
        return `${viewYear}-${md}`;
    };
    const getEndInputDate = (t: Tournament) => {
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
                        <Trophy size={22} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">대회 스케쥴 등록</h1>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">월별 대회 일정을 등록하고 관리하세요.</p>
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
            {monthTournaments.length === 0 && (
                <div className="text-center py-10 bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 text-zinc-400 text-sm">
                    이 달에 등록된 대회가 없습니다.
                </div>
            )}

            {/* Responsive Layout: Desktop Table / Mobile Cards */}
            {/* Desktop 2-Row Card Layout */}
            <div className="hidden md:flex flex-col gap-3">
                {monthTournaments.length > 0 && monthTournaments.map((t, index) => (
                    <div
                        key={t.id}
                        className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative"
                        style={{ zIndex: monthTournaments.length - index }}
                    >
                        {/* Row 1: 대회 구분 / 일정 / 대회명 / 장소 / 삭제 */}
                        <div className="flex items-end gap-3 px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 rounded-t-2xl">
                            <div className="flex flex-col gap-1 shrink-0">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1">구분</span>
                                <select
                                    className={cn(
                                        "h-[34px] text-xs font-bold px-3 rounded-lg border cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-navy appearance-none text-center min-w-[80px]",
                                        CATEGORY_COLORS[t.category]
                                    )}
                                    value={t.category}
                                    onChange={(e) => handleUpdate(t.id, "category", e.target.value as TournamentCategory)}
                                >
                                    {CATEGORIES.map(cat => (
                                        <option key={cat} value={cat} className="text-center">{cat}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex flex-col gap-1 shrink-0">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1">일정</span>
                                <div className="flex items-center gap-1.5">
                                    <DatePickerInput
                                        className="h-[34px] min-h-[34px] w-[110px] px-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:border-brand-navy focus:ring-1 focus:ring-brand-navy outline-none text-xs transition-all text-zinc-600 dark:text-zinc-300 text-center"
                                        value={getStartInputDate(t)}
                                        onChange={(e) => handleDateChange(t.id, "start", e.target.value)}
                                    />
                                    <span className="text-zinc-400 text-xs">~</span>
                                    <DatePickerInput
                                        ref={el => { endInputRefs.current[t.id] = el; }}
                                        className="h-[34px] min-h-[34px] w-[110px] px-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:border-brand-navy focus:ring-1 focus:ring-brand-navy outline-none text-xs transition-all text-zinc-600 dark:text-zinc-300 text-center"
                                        value={getEndInputDate(t)}
                                        onChange={(e) => handleDateChange(t.id, "end", e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1">대회명</span>
                                <input
                                    type="text"
                                    placeholder="대회명"
                                    className="h-[34px] w-full px-3 bg-transparent dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:border-brand-navy focus:ring-1 focus:ring-brand-navy outline-none text-xs font-medium transition-all"
                                    value={t.name}
                                    onChange={(e) => handleUpdate(t.id, "name", e.target.value)}
                                />
                            </div>

                            <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1">대회 장소</span>
                                <input
                                    type="text"
                                    placeholder="장소"
                                    className="h-[34px] w-full px-3 bg-transparent dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:border-brand-navy focus:ring-1 focus:ring-brand-navy outline-none text-xs transition-all"
                                    value={t.venue}
                                    onChange={(e) => handleUpdate(t.id, "venue", e.target.value)}
                                />
                            </div>

                            <div className="flex flex-col justify-end pb-1.5 shrink-0">
                                <button
                                    onClick={() => handleDelete(t.id, t.name)}
                                    className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Row 2: 선수명 + 선수 추가 */}
                        <div className="flex items-center gap-2.5 px-5 py-3 bg-white dark:bg-zinc-800/30 rounded-b-2xl">
                            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider shrink-0">선수</span>
                            <div className="flex flex-wrap items-center gap-1.5 flex-1">
                                {t.players.map((name) => (
                                    <div
                                        key={name}
                                        className="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md text-[11px] font-bold text-zinc-700 dark:text-zinc-300 shadow-sm transition-all hover:border-zinc-300 dark:hover:border-zinc-600"
                                    >
                                        <span>{name}</span>
                                        <button
                                            onClick={() => {
                                                const newPlayers = t.players.filter(p => p !== name);
                                                handleUpdate(t.id, "players", newPlayers);
                                                setPlayerInput(prev => ({ ...prev, [t.id]: newPlayers.join(", ") }));
                                            }}
                                            className="text-zinc-300 hover:text-red-500 transition-colors"
                                        >
                                            <X size={11} />
                                        </button>
                                    </div>
                                ))}
                                <div className="w-[180px]">
                                    <AthleteSearch
                                        selectedNames={t.players}
                                        showChips={false}
                                        onSelect={(name) => {
                                            const newPlayers = [...t.players, name];
                                            handleUpdate(t.id, "players", newPlayers);
                                            setPlayerInput(prev => ({ ...prev, [t.id]: newPlayers.join(", ") }));
                                        }}
                                        placeholder="선수 추가"
                                    />
                                </div>
                            </div>
                            {playerErrors[t.id] && (
                                <p className="text-red-500 text-[10px] italic">{playerErrors[t.id]}</p>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Mobile Cards Layout */}
            <div className="md:hidden flex flex-col gap-3">
                {monthTournaments.map((t, index) => {
                    const err = playerErrors[t.id];
                    return (
                        <div
                            key={t.id}
                            className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative"
                            style={{ zIndex: monthTournaments.length - index }}
                        >
                            {/* Card header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-transparent dark:bg-zinc-800/50 rounded-t-2xl">
                                <select
                                    className={cn(
                                        "text-[13px] font-bold px-4 py-2 rounded-xl border cursor-pointer focus:outline-none appearance-none min-w-[110px] text-center",
                                        CATEGORY_COLORS[t.category]
                                    )}
                                    value={t.category}
                                    onChange={(e) => handleUpdate(t.id, "category", e.target.value as TournamentCategory)}
                                >
                                    {CATEGORIES.map(cat => (
                                        <option key={cat} value={cat} className="text-center">{cat}</option>
                                    ))}
                                </select>
                                <button
                                    onClick={() => handleDelete(t.id, t.name)}
                                    className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                >
                                    <Trash2 size={15} />
                                </button>
                            </div>

                            {/* Fields grid */}
                            <div className="p-4 flex flex-col gap-3">
                                {/* Date Box with Picker */}
                                <div className="flex flex-col gap-1 bg-transparent dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
                                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                                        <Calendar size={12} /> 대회 일정
                                    </label>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className="flex flex-col flex-1 gap-1">
                                            <span className="text-[10px] text-zinc-500 font-medium">시작일</span>
                                            <DatePickerInput

                                                className="w-full px-2 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:border-brand-navy focus:ring-1 focus:ring-brand-navy outline-none text-[13px] transition-all"
                                                value={getStartInputDate(t)}
                                                onChange={(e) => handleDateChange(t.id, "start", e.target.value)}
                                            />
                                        </div>
                                        <span className="text-zinc-300 font-light mt-4">-</span>
                                        <div className="flex flex-col flex-1 gap-1">
                                            <span className="text-[10px] text-zinc-500 font-medium">종료일</span>
                                            <DatePickerInput
                                                ref={el => { endInputRefs.current[`mobile-${t.id}`] = el; }}
                                                className="w-full px-2 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:border-brand-navy focus:ring-1 focus:ring-brand-navy outline-none text-[13px] transition-all"
                                                value={getEndInputDate(t)}
                                                onChange={(e) => handleDateChange(t.id, "end", e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Tournament name */}
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">대회명</label>
                                    <input
                                        type="text"
                                        placeholder="대회명 입력"
                                        className="w-full px-3 py-2 bg-transparent dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:border-brand-navy focus:ring-1 focus:ring-brand-navy outline-none text-[13px] font-medium transition-all"
                                        value={t.name}
                                        onChange={(e) => handleUpdate(t.id, "name", e.target.value)}
                                    />
                                </div>

                                {/* Venue */}
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">대회 장소</label>
                                    <input
                                        type="text"
                                        placeholder="장소 입력"
                                        className="w-full px-3 py-2 bg-transparent dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:border-brand-navy focus:ring-1 focus:ring-brand-navy outline-none text-[13px] transition-all"
                                        value={t.venue}
                                        onChange={(e) => handleUpdate(t.id, "venue", e.target.value)}
                                    />
                                </div>

                                {/* Players */}
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">선수명</label>
                                    <AthleteSearch
                                        selectedNames={t.players}
                                        onSelect={(name) => {
                                            const newPlayers = [...t.players, name];
                                            handleUpdate(t.id, "players", newPlayers);
                                            setPlayerInput(prev => ({ ...prev, [t.id]: newPlayers.join(", ") }));
                                        }}
                                        onRemove={(name) => {
                                            const newPlayers = t.players.filter(p => p !== name);
                                            handleUpdate(t.id, "players", newPlayers);
                                            setPlayerInput(prev => ({ ...prev, [t.id]: newPlayers.join(", ") }));
                                        }}
                                        placeholder="선수 선택"
                                    />
                                    {err && (
                                        <div className="flex items-center gap-1.5 text-red-500 text-xs mt-0.5">
                                            <AlertCircle size={12} />
                                            <span>{err}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Add & Save buttons */}
            <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
                <button
                    onClick={handleAddRow}
                    className="flex-1 w-full flex items-center justify-center gap-2 py-3.5 bg-white dark:bg-zinc-900 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl text-sm font-semibold text-brand-navy dark:text-brand-navy-light hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all active:scale-[0.99]"
                >
                    <Plus size={18} /> {MONTH_LABEL} 대회 일정 추가
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
                <Link href="/schedule/tournaments" className="flex items-center gap-1 hover:text-brand-navy transition-colors">
                    대회 스케쥴 <ChevronRight size={12} />
                </Link>
            </div>
        </div>
    );
}
