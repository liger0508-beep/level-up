"use client";

import { useState, useMemo, useEffect } from "react";
import Link from 'next/link';
import { TrainingData, TrainingType } from "@/components/training/TrainingCard";
import { TrainingTable } from "@/components/training/TrainingTable";
import { fetchTrainingRecords, TrainingRecord } from "@/lib/training-sync";
import { Dumbbell, Plus, Search, Calendar, ChevronLeft, ChevronRight, TrendingUp, ClipboardList, CheckCircle2 } from "lucide-react";
import { DatePickerInput } from "@/components/ui/DatePickerInput";
import { fetchAthletes } from "@/lib/athlete-sync";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useRef } from "react";
import { DatePresets, DatePresetType } from "@/components/ui/DatePresets";

// ── Mock data ────────────────────────────────────────────────
const mockTrainings: TrainingData[] = [
    {
        id: "1",
        type: "shot",
        title: "[기본기] 드라이버 스윙 교정 훈련",
        playerName: "김민수",
        coachName: "박코치",
        comment:
            "오늘 드라이버 스윙에서 백스윙 시 왼쪽 팔이 과하게 접히는 문제를 집중적으로 교정했습니다. 하프스윙 드릴을 활용하여 팔의 연결감을 유지하는 연습을 진행했고, 후반부에는 눈에 띄는 개선이 있었습니다. 꾸준한 반복 연습이 필요합니다.",
        date: "2026-03-07",
    },
    {
        id: "2",
        type: "putt",
        title: "[예습] 퍼팅 거리감 훈련",
        playerName: "이수진",
        coachName: "박코치",
        comment:
            "3m ~ 5m 거리의 퍼팅 거리감 훈련을 실시했습니다. 임팩트 시 손목 움직임을 최소화하는 것이 포인트이며, 반복 연습 후 거리 편차가 줄어드는 것을 확인했습니다.",
        date: "2026-03-06",
    },
    {
        id: "3",
        type: "physical",
        title: "[복습] 코어 안정성 트레이닝",
        playerName: "박현우",
        coachName: "김피지컬코치",
        comment:
            "골프 스윙 시 필요한 코어 안정성을 위한 기초 트레이닝을 진행했습니다. 플랭크, 데드버그, 힙 브릿지 위주로 구성했으며 특히 회전 안정성에 집중했습니다. 주 3회 꾸준한 반복이 권장됩니다.",
        date: "2026-03-05",
    },
    {
        id: "4",
        type: "shot",
        title: "[기본기] 아이언 임팩트 훈련",
        playerName: "정세민",
        coachName: "박코치",
        comment:
            "7번 아이언 기준으로 다운블로우 임팩트를 만들기 위한 드릴을 진행했습니다. 체중 이동 타이밍이 잡히기 시작했습니다.",
        date: "2026-03-04",
    },
    {
        id: "5",
        type: "bunker",
        title: "[복습] 벙커 탈출 기초 훈련",
        playerName: "김민수",
        coachName: "박코치",
        comment:
            "그린사이드 벙커에서 기본 탈출 기술을 연습했습니다. 오픈 스탠스와 바운스 활용에 대해 집중 지도하였고, 반복을 통해 성공률이 향상되었습니다.",
        date: "2026-03-03",
    },
];

// ── Filter categories ────────────────────────────────────────
type FilterType = "all" | TrainingType;

const filterButtons: { key: FilterType; label: string }[] = [
    { key: "all", label: "ALL" },
    { key: "shot", label: "Shot" },
    { key: "pitch", label: "Pitch" },
    { key: "bunker", label: "Bunker" },
    { key: "approach", label: "Approach" },
    { key: "putt", label: "Putt" },
    { key: "physical", label: "Physical" },
    { key: "etc", label: "Etc" },
];

// ── Unique player list (from data) ───────────────────────────
// allPlayers shifted to component state

// ── Page component ───────────────────────────────────────────
export default function TrainingsPage() {
    const [trainings, setTrainings] = useState<TrainingRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState<FilterType>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectAll, setSelectAll] = useState(true);
    const [allAthletes, setAllAthletes] = useState<string[]>([]);
    const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [displayLimit, setDisplayLimit] = useState(20);
    const [todaySchedule, setTodaySchedule] = useState<any[]>([]);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [activePreset, setActivePreset] = useState<DatePresetType>("custom");
    const [summaryStats, setSummaryStats] = useState({
        total: 0,
        completed: 0,
        completionRate: 0,
        thisMonthCount: 0,
        thisMonthCompleted: 0
    });
    const scrollRef = useRef<HTMLDivElement>(null);

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

    const loadInitialData = async () => {
        setIsLoading(true);
        const supabase = createClient();
        try {
            const [athletes, records, { data: { user } }] = await Promise.all([
                fetchAthletes(),
                fetchTrainingRecords(),
                supabase.auth.getUser()
            ]);
            setAllAthletes(athletes);
            if (selectedPlayers.size === 0 && !searchQuery) {
                setSelectedPlayers(new Set(athletes));
            }
            setTrainings(records);

            let role = "athlete";
            if (user) {
                const { data: dbUser } = await supabase
                    .from("users")
                    .select("role")
                    .eq("id", user.id)
                    .maybeSingle();
                role = dbUser?.role || "athlete";
                setUserRole(role);
            }

            // Fetch today's schedule for Athlete or identify completions for Coach/Admin
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date();
            endOfDay.setHours(23, 59, 59, 999);
            const now = new Date();
            const todayStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;

            if (role === 'athlete' && user) {
                // 1. Fetch fixed schedules
                const { data: scheduleData } = await supabase
                    .from("schedules")
                    .select(`
                        id,
                        title,
                        event_type,
                        start_time,
                        end_time,
                        status,
                        users!schedules_user_id_fkey(name)
                    `)
                    .gte("start_time", startOfDay.toISOString())
                    .lte("start_time", endOfDay.toISOString())
                    .eq("event_type", "training")
                    .order("start_time", { ascending: true });

                // 2. Fetch assigned training periods (from records)
                const { data: periodData } = await supabase
                    .from("records")
                    .select(`
                        id,
                        title,
                        category,
                        training_start,
                        training_end,
                        users!records_user_id_fkey(name)
                    `)
                    .eq("user_id", user.id)
                    .eq("type", "training")
                    .lte("training_start", todayStr)
                    .gte("training_end", todayStr);

                const formattedSchedules = (scheduleData || []).map((item: any) => {
                    const dStart = new Date(item.start_time);
                    const dEnd = new Date(item.end_time);
                    const timeStr = `${dStart.getHours().toString().padStart(2, '0')}:${dStart.getMinutes().toString().padStart(2, '0')}~${dEnd.getHours().toString().padStart(2, '0')}:${dEnd.getMinutes().toString().padStart(2, '0')}`;

                    return {
                        id: item.id,
                        playerName: item.users?.name || "알수없음",
                        title: item.title,
                        time: timeStr,
                        type: item.event_type,
                        status: item.status || "scheduled",
                        isSchedule: true
                    };
                });

                const formattedPeriods = (periodData || []).map((item: any) => {
                    const endDate = item.training_end ? item.training_end.slice(5).replace("-", ".") : "";
                    return {
                        id: item.id,
                        playerName: item.users?.name || "알수없음",
                        title: item.title,
                        time: endDate ? `~ ${endDate}` : "상시 훈련",
                        type: item.category || "etc",
                        isSchedule: true
                    };
                });
                setTodaySchedule([...formattedSchedules, ...formattedPeriods]);
            } else {
                // For Coach/Admin, show both scheduled and completed today
                const { data: scheduleData } = await supabase
                    .from("schedules")
                    .select(`
                        id,
                        title,
                        event_type,
                        start_time,
                        end_time,
                        status,
                        users!schedules_user_id_fkey(name)
                    `)
                    .gte("start_time", startOfDay.toISOString())
                    .lte("start_time", endOfDay.toISOString())
                    .eq("event_type", "training")
                    .order("start_time", { ascending: true });

                const formattedSchedules = (scheduleData || []).map((item: any) => {
                    const dStart = new Date(item.start_time);
                    const dEnd = new Date(item.end_time);
                    const timeStr = `${dStart.getHours().toString().padStart(2, '0')}:${dStart.getMinutes().toString().padStart(2, '0')}~${dEnd.getHours().toString().padStart(2, '0')}:${dEnd.getMinutes().toString().padStart(2, '0')}`;

                    return {
                        id: item.id,
                        playerName: item.users?.name || "알수없음",
                        title: item.title,
                        time: timeStr,
                        type: item.event_type,
                        status: item.status || "scheduled",
                        isSchedule: true
                    };
                });

                const completedFromRecords = records.filter(t => 
                    t.completion_logs?.some(log => {
                        try {
                            let timestamp = log;
                            if (log.startsWith('{')) {
                                timestamp = JSON.parse(log).timestamp;
                            }
                            const logDate = new Date(timestamp);
                            return logDate >= startOfDay && logDate <= endOfDay;
                        } catch {
                            return false;
                        }
                    })
                ).map(t => ({
                    id: t.id,
                    playerName: t.playerName,
                    title: t.title,
                    time: "오늘 완료됨",
                    type: t.type,
                    status: "completed",
                    isSchedule: false
                }));
                setTodaySchedule([...formattedSchedules, ...completedFromRecords]);
            }

            // --- Calculate Summary Stats ---
            const currentMonth = new Date().toISOString().slice(0, 7);
            const { data: profile } = await supabase.from("users").select("id, role, assigned_athletes").eq("id", user?.id).single();
            
            let relevantTrainings = records;
            if (role === 'athlete' && user) {
                relevantTrainings = records.filter(r => r.user_id === user.id);
            } else if (role === 'coach' && profile?.assigned_athletes) {
                const assignedNames = profile.assigned_athletes.split(',').map((n: string) => n.trim());
                relevantTrainings = records.filter(r => assignedNames.includes(r.playerName));
            }
            
            const completedCount = relevantTrainings.filter(r => r.completion_logs && r.completion_logs.length > 0).length;
            const thisMonth = relevantTrainings.filter(r => r.date.startsWith(currentMonth)).length;
            const thisMonthCompleted = relevantTrainings.filter(r => 
                r.date.startsWith(currentMonth) && 
                r.completion_logs && 
                r.completion_logs.length > 0
            ).length;
            const rate = relevantTrainings.length > 0 ? (completedCount / relevantTrainings.length) * 100 : 0;

            setSummaryStats({
                total: relevantTrainings.length,
                completed: completedCount,
                completionRate: Math.round(rate),
                thisMonthCount: thisMonth,
                thisMonthCompleted: thisMonthCompleted
            });

        } catch (error) {
            console.error("Failed to load data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadInitialData();
    }, []);

    // Toggle individual player
    const togglePlayer = (name: string) => {
        setSelectedPlayers((prev) => {
            let next: Set<string>;

            if (selectAll) {
                // If "All" was selected, clicking a player exclusively selects them
                next = new Set([name]);
                setSelectAll(false);
            } else {
                next = new Set(prev);
                if (next.has(name)) {
                    next.delete(name);
                } else {
                    next.add(name);
                }
            }

            if (next.size === 0) {
                setSelectAll(true);
                return new Set(allAthletes);
            }

            if (next.size === allAthletes.length) {
                setSelectAll(true);
                return new Set(allAthletes);
            }

            return next;
        });

        // Always clear the search query when a player is selected via chips
        setSearchQuery("");
    };

    // Toggle all
    const toggleSelectAll = () => {
        setSelectAll(true);
        setSelectedPlayers(new Set(allAthletes));
        setSearchQuery("");
    };

    // Filtered players:
    // If there is a search query, show matches.
    // Ensure currently selected players (when not Select All) are always visible as chips so they can be deselected.
    const visiblePlayersArr = useMemo(() => {
        const queryMatches = searchQuery
            ? allAthletes.filter((p) => p.toLowerCase().includes(searchQuery.toLowerCase()))
            : [];

        const selectedArr = selectAll ? [] : Array.from(selectedPlayers);

        return Array.from(new Set([...selectedArr, ...queryMatches]));
    }, [searchQuery, selectedPlayers, selectAll, allAthletes]);

    // Final filtered trainings
    const filteredTrainings = useMemo(() => {
        return trainings.filter((t) => {
            const typeMatch = activeFilter === "all" || t.type === activeFilter;
            const playerMatch = selectedPlayers.has(t.playerName);
            const afterStart = !startDate || t.date >= startDate;
            const beforeEnd = !endDate || t.date <= endDate;
            return typeMatch && playerMatch && afterStart && beforeEnd;
        });
    }, [trainings, activeFilter, selectedPlayers, startDate, endDate]);

    const displayedTrainings = useMemo(() => {
        return filteredTrainings.slice(0, displayLimit);
    }, [filteredTrainings, displayLimit]);

    const filteredSchedule = useMemo(() => {
        return todaySchedule.filter(s => {
            const typeMatch = activeFilter === "all" || s.type === activeFilter;
            return typeMatch;
        });
    }, [todaySchedule, activeFilter]);

    return (
        <div className="p-4 sm:p-8 max-w-4xl mx-auto">
            {/* ── Header ── */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <Dumbbell size={24} className="text-brand-navy dark:text-brand-navy-light shrink-0" />
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                        Training
                    </h1>
                </div>
                {(userRole === 'coach' || userRole === 'admin') && (
                    <Link
                        href="/training/create"
                        className="bg-brand-red hover:bg-brand-red-dark text-white px-5 py-2 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1.5 shrink-0"
                    >
                        <Plus size={18} />
                        작성
                    </Link>
                )}
            </div>

            {/* ── Analytical Summary ── */}
            {!isLoading && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-10">
                    <div className="bg-transparent border border-zinc-200 dark:border-zinc-800 p-5 rounded-[2rem] flex flex-col justify-between min-h-[120px] relative overflow-hidden group hover:border-emerald-500 transition-all">
                        <div className="flex items-center gap-2 text-zinc-400 mb-2">
                            <TrendingUp size={16} />
                            <span className="text-[10px] font-black uppercase tracking-widest">{userRole === 'athlete' ? "훈련 완료율" : "전체 완료율"}</span>
                        </div>
                        <div className="flex flex-col items-end">
                            <div className="flex items-baseline gap-1">
                                <p className="text-3xl font-black text-emerald-500 tracking-tighter italic">{summaryStats.completionRate}%</p>
                            </div>
                        </div>
                        <div className="absolute right-[-10px] bottom-[-10px] opacity-[0.03] group-hover:opacity-[0.05] transition-opacity text-emerald-500">
                            <TrendingUp size={80} />
                        </div>
                    </div>

                    <div className="bg-transparent border border-zinc-200 dark:border-zinc-800 p-5 rounded-[2rem] flex flex-col justify-between min-h-[120px] relative overflow-hidden group hover:border-brand-navy transition-all">
                        <div className="flex items-center gap-2 text-zinc-400 mb-2">
                            <ClipboardList size={16} />
                            <span className="text-[10px] font-black uppercase tracking-widest">이달의 배정 건수</span>
                        </div>
                        <div className="flex flex-col items-end">
                            <div className="flex items-baseline gap-1">
                                <p className="text-3xl font-black text-zinc-900 dark:text-zinc-50 tracking-tighter italic">{summaryStats.thisMonthCount}</p>
                                <span className="text-xs font-bold text-zinc-400">건</span>
                            </div>
                        </div>
                        <div className="absolute right-[-10px] bottom-[-10px] opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                            <ClipboardList size={80} />
                        </div>
                    </div>

                    <div className="hidden md:flex bg-transparent border border-zinc-200 dark:border-zinc-800 p-5 rounded-[2rem] flex-col justify-between min-h-[120px] relative overflow-hidden group transition-all col-span-1 hover:border-brand-red">
                        <div className="flex items-center gap-2 text-zinc-400 mb-2">
                            <CheckCircle2 size={16} />
                            <span className="text-[10px] font-black uppercase tracking-widest">이달의 완료 건수</span>
                        </div>
                        <div className="flex flex-col items-end">
                            <div className="flex items-baseline gap-1">
                                <p className="text-3xl font-black text-zinc-900 dark:text-zinc-50 tracking-tighter italic">{summaryStats.thisMonthCompleted}</p>
                                <span className="text-xs font-bold text-zinc-400">건</span>
                            </div>
                        </div>
                        <div className="absolute right-[-10px] bottom-[-10px] opacity-[0.03] group-hover:opacity-[0.05] transition-opacity text-brand-red">
                            <CheckCircle2 size={80} />
                        </div>
                    </div>
                </div>
            )}

            {/* ── Filter Buttons ── */}
            <div className="flex flex-nowrap gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                {filterButtons.map((btn) => {
                    const isActive = activeFilter === btn.key;
                    return (
                        <button
                            key={btn.key}
                            onClick={() => setActiveFilter(btn.key)}
                            className={`whitespace-nowrap shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200
                                ${isActive
                                    ? "bg-brand-navy text-white shadow-md border border-brand-navy"
                                    : "bg-transparent dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-brand-navy-light dark:hover:bg-brand-navy-dark hover:text-brand-navy dark:hover:text-white"
                                }`}
                        >
                            {btn.label}
                        </button>
                    );
                })}
            </div>

            {/* ── Today's Scheduled/Completed Trainings ── */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-3 px-1">
                    <h2 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                        <Calendar size={16} className="text-brand-navy dark:text-brand-navy-light" />
                        {userRole === 'athlete' ? "오늘 예약된 훈련" : "오늘 완료된 훈련"}
                    </h2>
                    {userRole !== 'athlete' && <span className="text-[10px] text-zinc-400 font-medium">실시간 훈련 완료 현황</span>}
                    {userRole === 'athlete' && <span className="text-[10px] text-zinc-400 font-medium">클릭 시 자동 입력 작성</span>}
                </div>

                <div className="relative group/scroll">
                    {/* Desktop Navigation Arrows */}
                    {filteredSchedule.length > 0 && (
                        <>
                            <button
                                onClick={() => scroll("left")}
                                className="absolute left-[-20px] top-[calc(50%-8px)] -translate-y-1/2 z-10 w-10 h-10 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full shadow-lg flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-brand-navy dark:hover:text-brand-navy-light transition-all opacity-0 group-hover/scroll:opacity-100 hidden md:flex"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <button
                                onClick={() => scroll("right")}
                                className="absolute right-[-20px] top-[calc(50%-8px)] -translate-y-1/2 z-10 w-10 h-10 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full shadow-lg flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-brand-navy dark:hover:text-brand-navy-light transition-all opacity-0 group-hover/scroll:opacity-100 hidden md:flex"
                            >
                                <ChevronRight size={20} />
                            </button>
                        </>
                    )}

                    <div
                        ref={scrollRef}
                        className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide -mx-1 px-1"
                    >
                        {filteredSchedule.length > 0 ? (
                            filteredSchedule.map((s) => {
                                const isCompleted = s.status === "completed";
                                const canCreate = (userRole === 'coach' || userRole === 'admin') && !isCompleted;
                                const isPeriodRecord = s.isSchedule && s.time.startsWith('~');
                                const href = (s.isSchedule && !isPeriodRecord && canCreate)
                                    ? `/training/create?player=${encodeURIComponent(s.playerName)}&start=${s.time.split('~')[0]}&end=${s.time.split('~')[1]}&type=${s.type}`
                                    : (s.isSchedule ? "#" : `/training/${s.id}`);

                                return (
                                    <div
                                        key={s.id}
                                        className={cn(
                                            "flex-shrink-0 w-40 border p-3.5 rounded-2xl shadow-sm transition-all active:scale-95 cursor-pointer group",
                                            isCompleted
                                                ? "bg-zinc-100 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 opacity-60"
                                                : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-brand-navy/50 hover:shadow-md",
                                            !canCreate && !isCompleted && "opacity-80"
                                        )}
                                    >
                                        <Link href={href} className={cn(!canCreate && !isCompleted && !s.isSchedule ? "" : "block w-full h-full")}>
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex flex-wrap items-center gap-1">
                                                    {s.title?.includes("[기본기]") && (
                                                        <span className="text-[11px] font-black text-brand-red">
                                                            기본기
                                                        </span>
                                                    )}
                                                    {s.title?.includes("[예습]") && (
                                                        <span className="text-[11px] font-black text-brand-navy">
                                                            예습
                                                        </span>
                                                    )}
                                                    {s.title?.includes("[복습]") && (
                                                        <span className="text-[11px] font-black text-zinc-500">
                                                            복습
                                                        </span>
                                                    )}
                                                    {(s.title?.includes("[기본기]") || s.title?.includes("[예습]") || s.title?.includes("[복습]")) && (
                                                        <span className="text-zinc-300">|</span>
                                                    )}
                                                    <span className={cn(
                                                        "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md",
                                                        isCompleted 
                                                            ? "text-zinc-400 bg-zinc-200 dark:bg-zinc-700" 
                                                            : "text-brand-navy dark:text-brand-navy-light bg-brand-navy/5 dark:bg-brand-navy/20"
                                                    )}>
                                                        {isCompleted ? "completed" : s.type}
                                                    </span>
                                                </div>
                                                {s.isSchedule && canCreate && !isCompleted && <Plus size={14} className="text-zinc-300 group-hover:text-brand-navy transition-colors" />}
                                            </div>
                                            <div className={cn(
                                                "text-sm font-bold mb-1",
                                                isCompleted ? "text-zinc-400" : "text-zinc-900 dark:text-zinc-50"
                                            )}>
                                                {s.playerName}
                                            </div>
                                            <div className={cn(
                                                "text-[11px] font-medium",
                                                isCompleted ? "text-emerald-500/60" : (s.isSchedule ? "text-zinc-400" : "text-emerald-500")
                                            )}>
                                                {s.time}
                                            </div>
                                        </Link>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="w-full py-6 flex flex-col items-center justify-center">
                                <p className="text-[11px] text-zinc-400 font-medium">
                                    {userRole === 'athlete' ? "오늘 예정된 훈련 일정이 없습니다." : "오늘 훈련을 완료한 선수가 없습니다."}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 mb-6">
                {/* Date Range: 훈련일자 */}
                <div className="flex items-center gap-2">
                    <label className="w-24 shrink-0 text-center text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                        훈련 일자
                    </label>
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                        <DatePickerInput

                            value={startDate}
                            onClick={(e) => (e.target as any).showPicker?.()}
                            onChange={(e) => { setStartDate(e.target.value); setActivePreset("custom"); }}
                            className="no-year-date flex-1 min-w-0 px-2 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-[13px] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all text-center cursor-pointer"
                        />
                        <span className="text-zinc-400 shrink-0 text-xs">~</span>
                        <DatePickerInput

                            value={endDate}
                            onClick={(e) => (e.target as any).showPicker?.()}
                            onChange={(e) => { setEndDate(e.target.value); setActivePreset("custom"); }}
                            className="no-year-date flex-1 min-w-0 px-2 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-[13px] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all text-center cursor-pointer"
                        />
                    </div>
                    {(startDate || endDate) && (
                        <button
                            onClick={() => { setStartDate(""); setEndDate(""); }}
                            className="shrink-0 px-1 py-2 text-xs font-bold text-brand-red hover:bg-brand-red-light dark:hover:bg-brand-red-dark/30 transition-colors"
                        >
                            초기화
                        </button>
                    )}
                </div>

                {/* Player Search & Select All */}
                <div className="flex items-center gap-2 mt-3">
                    <label className="w-24 shrink-0 text-center text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                        선수 검색
                    </label>
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input
                            type="text"
                            placeholder="선수 검색..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && searchQuery.trim()) {
                                    const match = allAthletes.find((p) =>
                                        p.toLowerCase().includes(searchQuery.toLowerCase())
                                    );
                                    if (match) {
                                        togglePlayer(match);
                                        // searchQuery is cleared inside togglePlayer
                                    }
                                }
                            }}
                            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all"
                        />
                    </div>
                </div>

                {/* Player Chips */}
                {visiblePlayersArr.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                        {visiblePlayersArr.map((name) => {
                            const isSelected = selectedPlayers.has(name);
                            return (
                                <button
                                    key={name}
                                    onClick={() => togglePlayer(name)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 shrink-0
                                        ${isSelected
                                            ? "bg-brand-navy/10 text-brand-navy border-brand-navy dark:bg-brand-navy/30 dark:text-white"
                                            : "bg-white dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-brand-navy"
                                        }`}
                                >
                                    {name}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── Training List ── */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-8 h-8 border-4 border-brand-navy border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-zinc-500 text-sm">훈련 기록을 불러오는 중...</p>
                </div>
            ) : filteredTrainings.length > 0 ? (
                <>
                    <div className="space-y-4 mb-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
                                    조회 결과
                                </h2>
                                <span className="text-xs text-zinc-400">
                                    ({filteredTrainings.length}건)
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
                    </div>
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
                        {displayedTrainings.length > 0 ? (
                            <>
                                <TrainingTable trainings={displayedTrainings} totalCount={filteredTrainings.length} onUpdate={loadInitialData} />
                                {filteredTrainings.length > displayLimit && (
                                    <div className="mt-6 flex justify-center">
                                        <button
                                            onClick={() => setDisplayLimit(prev => prev + 20)}
                                            className="px-6 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all active:scale-95"
                                        >
                                            더 보기 ({filteredTrainings.length - displayLimit}건 남음)
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <p className="text-zinc-400 text-sm text-center py-8">
                                조건에 맞는 훈련 기록이 없습니다.
                            </p>
                        )}
                    </div>
                </>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
                    <Search size={48} className="text-zinc-200 dark:text-zinc-800 mb-4" />
                    <p className="text-zinc-500 dark:text-zinc-400 font-medium">검색 결과가 없습니다.</p>
                </div>
            )}
        </div>
    );
}
