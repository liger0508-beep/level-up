"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { 
    Users, 
    Calendar, 
    MapPin, 
    Search, 
    CheckCircle2, 
    XCircle, 
    BarChart3, 
    Clock, 
    Trash2,
    Monitor,
    Plus,
    ChevronLeft,
    ChevronRight,
    ArrowRight,
    ClipboardCheck,
    Calendar as CalendarIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { 
    fetchAttendance, 
    checkInAthlete, 
    deleteAttendance, 
    AttendanceRecord,
    fetchMonthlyAttendance 
} from "@/lib/attendance-sync";
import { getStoredTournaments } from "@/lib/tournament-sync";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from "date-fns";
import { ko } from "date-fns/locale";

const BRANCHES = ["조이마루점", "구미점"];

export default function AttendancePage() {
    const [activeTab, setActiveTab] = useState<"daily" | "stats">("daily");
    const [selectedDate, setSelectedDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
    const [selectedBranch, setSelectedBranch] = useState("조이마루점");
    const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<"checked" | "unchecked">("checked");
    const [searchQuery, setSearchQuery] = useState("");
    const [allAthletes, setAllAthletes] = useState<any[]>([]);

    // Monthly Stats state
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);
    const [monthlyData, setMonthlyData] = useState<any[]>([]);

    const supabase = createClient();

    useEffect(() => {
        loadDailyData();
        loadAthletes();
    }, [selectedDate, selectedBranch]);

    async function loadDailyData() {
        setIsLoading(true);
        const data = await fetchAttendance(selectedDate, selectedBranch);
        setAttendanceList(data);
        setIsLoading(false);
    }

    async function loadAthletes() {
        const { data } = await supabase
            .from("users")
            .select("id, name, branch, phone")
            .eq("role", "athlete")
            .order("name");
        if (data) setAllAthletes(data);
    }

    async function handleCheckIn(athleteId: string, athleteName: string) {
        if (!confirm(`${athleteName} 선수를 출석 처리 하시겠습니까?`)) return;
        try {
            const res = await checkInAthlete(athleteId, selectedBranch);
            if (res.success) {
                loadDailyData();
            } else {
                alert(res.message);
            }
        } catch (err) {
            console.error(err);
            alert("출석 체크에 실패했습니다.");
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("출석 기록을 삭제하시겠습니까?")) return;
        try {
            await deleteAttendance(id);
            loadDailyData();
        } catch (err) {
            alert("삭제 실패");
        }
    }

    const filteredAthletes = useMemo(() => {
        return allAthletes.filter(a => 
            (a.name.includes(searchQuery) || a.phone?.includes(searchQuery)) &&
            !attendanceList.some(att => att.athlete_id === a.id)
        );
    }, [allAthletes, searchQuery, attendanceList]);

    const uncheckedAthletes = useMemo(() => {
        return allAthletes.filter(a => 
            a.branch === selectedBranch &&
            !attendanceList.some(att => att.athlete_id === a.id)
        );
    }, [allAthletes, selectedBranch, attendanceList]);

    // Monthly Stats Logic
    const [statsBranch, setStatsBranch] = useState("조이마루점");
    const [statsSearchQuery, setStatsSearchQuery] = useState("");
    const [statsTournaments, setStatsTournaments] = useState<any[]>([]);

    useEffect(() => {
        if (activeTab === "stats") {
            loadStatsData();
        }
    }, [activeTab, currentMonth, statsBranch]);

    async function loadStatsData() {
        setIsLoading(true);
        try {
            const [attData, tourData] = await Promise.all([
                fetchAllAttendanceForMonth(currentMonth),
                getStoredTournaments()
            ]);
            setMonthlyData(attData);
            setStatsTournaments(tourData);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }

    async function fetchAllAttendanceForMonth(monthDate: Date) {
        const start = format(startOfMonth(monthDate), "yyyy-MM-dd");
        const end = format(endOfMonth(monthDate), "yyyy-MM-dd");
        const { data } = await supabase
            .from("attendance")
            .select("*")
            .gte("date", start)
            .lte("date", end);
        return data || [];
    }

    const statsList = useMemo(() => {
        const daysInMonth = endOfMonth(currentMonth).getDate();
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth() + 1;

        return allAthletes
            .filter(a => a.branch === statsBranch && a.name.includes(statsSearchQuery))
            .map(athlete => {
                const athleteAttendance = monthlyData.filter(d => d.athlete_id === athlete.id);
                const attendanceDays = new Set(athleteAttendance.map(d => d.date)).size;
                
                // Average Time calculation
                let avgTime = "-";
                if (athleteAttendance.length > 0) {
                    const totalMinutes = athleteAttendance.reduce((acc, curr) => {
                        const date = new Date(curr.check_in_at);
                        return acc + (date.getHours() * 60 + date.getMinutes());
                    }, 0);
                    const avgMinutes = Math.round(totalMinutes / athleteAttendance.length);
                    avgTime = `${String(Math.floor(avgMinutes / 60)).padStart(2, '0')}:${String(avgMinutes % 60).padStart(2, '0')}`;
                }

                // Tournament Days calculation
                let tournamentDays = 0;
                statsTournaments.forEach(t => {
                    if (t.year === year && t.players?.includes(athlete.name)) {
                        const parts = t.date.split(" ~ ");
                        if (parts.length === 2) {
                            const [m1, d1] = parts[0].split("-").map(Number);
                            const [m2, d2] = parts[1].split("-").map(Number);
                            if (m1 === month || m2 === month) {
                                const startDay = m1 === month ? d1 : 1;
                                const endDay = m2 === month ? d2 : daysInMonth;
                                tournamentDays += (endDay - startDay + 1);
                            }
                        } else {
                            const [m, d] = t.date.split("-").map(Number);
                            if (m === month) tournamentDays += 1;
                        }
                    }
                });

                const unscheduled = Math.max(0, daysInMonth - attendanceDays - tournamentDays);
                const rate = Math.round(((attendanceDays + tournamentDays) / daysInMonth) * 100);

                return {
                    ...athlete,
                    attendanceDays,
                    avgTime,
                    tournamentDays,
                    unscheduled,
                    rate
                };
            });
    }, [allAthletes, monthlyData, statsTournaments, currentMonth, statsBranch, statsSearchQuery]);

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4 sm:p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-brand-navy flex items-center justify-center text-white shadow-xl shadow-brand-navy/20">
                                <ClipboardCheck size={24} />
                            </div>
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
                                    운영 출석 관리
                                </h1>
                                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-0.5">Operation Attendance Control</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex bg-zinc-200/50 dark:bg-zinc-900/50 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <button 
                            onClick={() => setActiveTab("daily")}
                            className={cn(
                                "px-6 py-2 rounded-lg text-sm font-bold transition-all",
                                activeTab === "daily" ? "bg-white dark:bg-zinc-800 text-brand-navy shadow-sm" : "text-zinc-400 hover:text-zinc-600"
                            )}
                        >
                            일별 현황
                        </button>
                        <button 
                            onClick={() => setActiveTab("stats")}
                            className={cn(
                                "px-6 py-2 rounded-lg text-sm font-bold transition-all",
                                activeTab === "stats" ? "bg-white dark:bg-zinc-800 text-brand-navy shadow-sm" : "text-zinc-400 hover:text-zinc-600"
                            )}
                        >
                            월간 통계
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <Link 
                            href="/operations/attendance/kiosk"
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 transition-all shadow-sm"
                        >
                            <Monitor size={18} className="text-zinc-400" />
                            키오스크 모드
                        </Link>
                    </div>
                </div>

                {activeTab === "daily" ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        {/* Filters */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-zinc-400 uppercase ml-1">날짜 선택</label>
                                <div className="relative">
                                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                    <input 
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm font-bold focus:ring-2 focus:ring-brand-navy/20 outline-none transition-all"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-zinc-400 uppercase ml-1">지점 선택</label>
                                    <div className="flex p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 w-full sm:w-auto overflow-x-auto">
                                        {BRANCHES.map(b => (
                                            <button
                                                key={b}
                                                onClick={() => setSelectedBranch(b)}
                                                className={cn(
                                                    "px-8 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                                                    selectedBranch === b ? "bg-white dark:bg-zinc-800 text-brand-navy shadow-sm" : "text-zinc-900 dark:text-zinc-100 hover:text-zinc-600"
                                                )}
                                            >
                                                {b}
                                            </button>
                                        ))}
                                    </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-zinc-400 uppercase ml-1">상태 필터</label>
                                <div className="flex p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                    <button
                                        onClick={() => setStatusFilter("checked")}
                                        className={cn(
                                            "flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                                            statusFilter === "checked" ? "bg-white dark:bg-zinc-800 text-brand-navy shadow-sm" : "text-zinc-900 dark:text-zinc-100 hover:text-zinc-600"
                                        )}
                                    >
                                        출석 ({attendanceList.length})
                                    </button>
                                    <button
                                        onClick={() => setStatusFilter("unchecked")}
                                        className={cn(
                                            "flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                                            statusFilter === "unchecked" ? "bg-white dark:bg-zinc-800 text-brand-navy shadow-sm" : "text-zinc-900 dark:text-zinc-100 hover:text-zinc-600"
                                        )}
                                    >
                                        미출석 ({uncheckedAthletes.length})
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-zinc-400 uppercase ml-1">선수 검색</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                    <input 
                                        type="text"
                                        placeholder="선수명 검색..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm font-bold focus:ring-2 focus:ring-brand-navy/20 outline-none transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                            {/* Daily Summary Card */}
                            <div className="lg:col-span-1 space-y-4">
                                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-6">
                                    <div>
                                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Total Attendance</p>
                                        <p className="text-4xl font-black text-brand-navy dark:text-brand-navy-light">{attendanceList.length}<span className="text-sm ml-1 opacity-40 font-bold">명</span></p>
                                    </div>
                                    <div className="h-px bg-zinc-100 dark:bg-zinc-800" />
                                    <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">Today Summary</h4>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-zinc-500">최초 출석</span>
                                            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                                                {attendanceList.length > 0 ? format(new Date(attendanceList[attendanceList.length - 1].check_in_at), "HH:mm") : "-"}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-zinc-500">최근 출석</span>
                                            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                                                {attendanceList.length > 0 ? format(new Date(attendanceList[0].check_in_at), "HH:mm") : "-"}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right: List */}
                            <div className="lg:col-span-3 space-y-4">
                                <div className="flex items-center justify-between px-2">
                                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                        {statusFilter === "checked" ? "출석 완료 명단" : "미출석 선수 명단"}
                                        <span className="text-[11px] font-normal text-zinc-400">({selectedDate})</span>
                                    </h3>
                                </div>

                                {isLoading ? (
                                    <div className="h-40 flex items-center justify-center text-zinc-400">
                                        <div className="w-6 h-6 border-2 border-zinc-300 border-t-brand-navy rounded-full animate-spin mr-2" />
                                        불러오는 중...
                                    </div>
                                ) : statusFilter === "checked" ? (
                                    attendanceList.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {attendanceList.map(item => (
                                                <div 
                                                    key={item.id}
                                                    className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl flex items-center justify-between group hover:shadow-md transition-all animate-in fade-in zoom-in-95 duration-300"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-brand-navy/5 flex items-center justify-center text-brand-navy">
                                                            <CheckCircle2 size={18} />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{item.athlete_name}</p>
                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                <Clock size={10} className="text-zinc-400" />
                                                                <p className="text-[10px] font-bold text-brand-navy dark:text-brand-navy-light uppercase">
                                                                    {format(new Date(item.check_in_at), "HH:mm:ss")} 출석
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button 
                                                        onClick={() => handleDelete(item.id)}
                                                        className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="py-20 flex flex-col items-center justify-center gap-3 bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-[2rem]">
                                            <Users size={40} className="text-zinc-200" />
                                            <p className="text-sm text-zinc-400 font-medium">아직 출석한 선수가 없습니다.</p>
                                        </div>
                                    )
                                ) : (
                                    uncheckedAthletes.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {uncheckedAthletes.map(a => (
                                                <button
                                                    key={a.id}
                                                    onClick={() => handleCheckIn(a.id, a.name)}
                                                    className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl flex items-center justify-between group hover:border-brand-navy hover:bg-brand-navy/5 transition-all text-left shadow-sm"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                                                            <Users size={18} />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{a.name}</p>
                                                            <p className="text-[10px] text-zinc-400 font-medium">{a.phone || "번호 없음"}</p>
                                                        </div>
                                                    </div>
                                                    <div className="w-8 h-8 rounded-full bg-brand-navy/10 text-brand-navy flex items-center justify-center group-hover:bg-brand-navy group-hover:text-white transition-colors">
                                                        <Plus size={16} />
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="py-20 flex flex-col items-center justify-center gap-3 bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-[2rem]">
                                            <CheckCircle2 size={40} className="text-emerald-200" />
                                            <p className="text-sm text-zinc-400 font-medium">모든 선수가 출석했습니다!</p>
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        {/* Monthly Stats Dashboard */}
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm space-y-6">
                            <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                                        className="w-10 h-10 rounded-xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                                    >
                                        <ChevronLeft size={20} />
                                    </button>
                                    <div className="px-6 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-sm font-black text-zinc-900 dark:text-zinc-100 min-w-[140px] text-center uppercase tracking-tighter">
                                        {format(currentMonth, "yyyy. MM")}
                                    </div>
                                    <button 
                                        onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                                        className="w-10 h-10 rounded-xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                                    >
                                        <ChevronRight size={20} />
                                    </button>
                                </div>

                                <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                                    <div className="flex p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 w-full sm:w-auto overflow-x-auto">
                                        {BRANCHES.map(b => (
                                            <button
                                                key={b}
                                                onClick={() => setStatsBranch(b)}
                                                className={cn(
                                                    "px-8 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                                                    statsBranch === b ? "bg-white dark:bg-zinc-800 text-brand-navy shadow-sm" : "text-zinc-900 dark:text-zinc-100 hover:text-zinc-600"
                                                )}
                                            >
                                                {b}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="relative w-full sm:w-64">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                                        <input 
                                            type="text"
                                            placeholder="선수명 검색..."
                                            value={statsSearchQuery}
                                            onChange={(e) => setStatsSearchQuery(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-bold focus:ring-2 focus:ring-brand-navy/20 outline-none transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Stats Content - Responsive View */}
                            <div className="space-y-4">
                                {/* Desktop Table View (Hidden on Mobile) */}
                                <div className="hidden sm:block overflow-x-auto -mx-6 sm:mx-0">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-zinc-100 dark:border-zinc-800">
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">선수명</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-center">총 출석일</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-center">평균 출석 시간</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-center">대회 참가일</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-center">미일정</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">출석률(%)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                                            {statsList.length > 0 ? statsList.map(item => (
                                                <tr key={item.id} className="group hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100 text-[10px] font-bold">
                                                                {item.name[0]}
                                                            </div>
                                                            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{item.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="text-sm font-black text-zinc-900 dark:text-zinc-100">{item.attendanceDays}</span>
                                                        <span className="text-[10px] ml-1 text-zinc-400">일</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="text-xs font-bold text-zinc-500">{item.avgTime}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="text-sm font-bold text-amber-600 dark:text-amber-500">{item.tournamentDays}</span>
                                                        <span className="text-[10px] ml-1 text-zinc-400">일</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="text-sm font-bold text-zinc-400">{item.unscheduled}</span>
                                                        <span className="text-[10px] ml-1 text-zinc-400">일</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex flex-col items-end gap-1">
                                                            <span className={cn(
                                                                "text-sm font-black",
                                                                item.rate >= 90 ? "text-emerald-500" : 
                                                                item.rate >= 70 ? "text-brand-navy" : 
                                                                "text-zinc-400"
                                                            )}>
                                                                {item.rate}%
                                                            </span>
                                                            <div className="w-16 h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                                                <div 
                                                                    className={cn(
                                                                        "h-full rounded-full transition-all duration-1000",
                                                                        item.rate >= 90 ? "bg-emerald-500" : 
                                                                        item.rate >= 70 ? "bg-brand-navy" : 
                                                                        "bg-zinc-300"
                                                                    )}
                                                                    style={{ width: `${item.rate}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr>
                                                    <td colSpan={6} className="py-20 text-center">
                                                        <Users size={32} className="mx-auto text-zinc-200 mb-2" />
                                                        <p className="text-sm text-zinc-400 font-medium">조건에 맞는 선수가 없습니다.</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile Card View (Hidden on Desktop) */}
                                <div className="sm:hidden space-y-2">
                                    {statsList.length > 0 ? statsList.map(item => (
                                        <div key={item.id} className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-4 rounded-2xl flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100 text-xs font-bold">
                                                    {item.name[0]}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{item.name}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-tighter">출석 {item.attendanceDays}일</span>
                                                        <span className="text-[10px] text-zinc-200 dark:text-zinc-700">•</span>
                                                        <span className="text-[10px] text-amber-600 font-bold uppercase tracking-tighter">대회 {item.tournamentDays}일</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className={cn(
                                                    "text-sm font-black",
                                                    item.rate >= 90 ? "text-emerald-500" : 
                                                    item.rate >= 70 ? "text-brand-navy" : 
                                                    "text-zinc-400"
                                                )}>
                                                    {item.rate}%
                                                </p>
                                                <div className="w-12 h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full mt-1 overflow-hidden ml-auto">
                                                    <div 
                                                        className={cn(
                                                            "h-full rounded-full transition-all duration-700",
                                                            item.rate >= 90 ? "bg-emerald-500" : 
                                                            item.rate >= 70 ? "bg-brand-navy" : 
                                                            "bg-zinc-300"
                                                        )}
                                                        style={{ width: `${item.rate}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="py-10 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-zinc-200">
                                            <p className="text-xs text-zinc-400">데이터가 없습니다.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
