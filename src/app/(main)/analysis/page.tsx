"use client";

import { useState, useMemo, useRef } from "react";
import Link from "next/link";
import { Activity, Plus, Search, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { AnalysisData, AnalysisType } from "@/components/analysis/AnalysisCard";
import { AnalysisTable } from "@/components/analysis/AnalysisTable";
import { getTodayScheduledItems } from "@/lib/schedule-sync";
import { DatePickerInput } from "@/components/ui/DatePickerInput";
import { fetchAthletes } from "@/lib/athlete-sync";
import { useEffect } from "react";
import { fetchAnalysisRecords, AnalysisRecord } from "@/lib/analysis-sync";
import { createClient } from "@/lib/supabase/client";
import { DatePresets, DatePresetType } from "@/components/ui/DatePresets";
import { cn } from "@/lib/utils";

// ── Dummy Data ──
const mockAnalysis: AnalysisData[] = [
    {
        id: "a1",
        type: "shot",
        title: "드라이버 스윙 궤도 분석",
        playerName: "김민수",
        coachName: "최원일",
        comment: "백스윙 탑에서 헤드가 쳐지는 현상 발견, 테이크어웨이 구간 교정이 필요합니다.",
        date: "2024-03-01",
    },
    {
        id: "a2",
        type: "physical",
        title: "코어 모빌리티 측정결과",
        playerName: "이지원",
        coachName: "김서준",
        comment: "흉추 회전 범위가 이전에 비해 15도 증가했습니다. 꾸준한 루틴을 권장합니다.",
        date: "2024-02-28",
    },
    {
        id: "a3",
        type: "short_game",
        title: "퍼팅 스트로크 템포 분석",
        playerName: "박지호",
        coachName: "최원일",
        comment: "백스트로크 대비 팔로우가 짧습니다. 1:2 비율을 염두에 두고 연습하면 좋습니다.",
        date: "2024-02-27",
    },
    {
        id: "a4",
        type: "shot",
        title: "아이언 임팩트 포지션 검토",
        playerName: "김예은",
        coachName: "최원일",
        comment: "다운블로우 진입 구간이 좋습니다. 다만 손목 코킹이 조금 빨리 풀리는 경향이 있습니다.",
        date: "2024-02-26",
    },
    {
        id: "a5",
        type: "short_game",
        title: "어프로치 탄도 분석",
        playerName: "정세민",
        coachName: "이동국",
        comment: "클럽 페이스 오프닝 각도가 일정하지 않습니다. 바운스 활용을 위해 열린 상태를 유지하세요.",
        date: "2024-02-25",
    },
];

const mockTodaySchedule = [
    { id: "sa1", playerName: "김지윤", time: "10:00~11:30", type: "shot" as AnalysisType },
    { id: "sa2", playerName: "박도윤", time: "13:30~15:00", type: "short_game" as AnalysisType },
    { id: "sa3", playerName: "이지원", time: "16:00~17:00", type: "physical" as AnalysisType },
];

// mockPlayers/allPlayers shifted to component state

const filterButtons: { label: string; key: AnalysisType | "all" }[] = [
    { label: "ALL", key: "all" },
    { label: "Shot", key: "shot" },
    { label: "Short Game", key: "short_game" },
    { label: "Physical", key: "physical" },
    { label: "Etc", key: "etc" },
];

export default function AnalysisPage() {
    const [activeFilter, setActiveFilter] = useState<AnalysisType | "all">("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectAll, setSelectAll] = useState(true);
    const [allAthletes, setAllAthletes] = useState<string[]>([]);
    const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [todaySchedule, setTodaySchedule] = useState<any[]>([]);
    const [displayLimit, setDisplayLimit] = useState(20);
    const [analysisList, setAnalysisList] = useState<AnalysisRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [activePreset, setActivePreset] = useState<DatePresetType>("custom");

    useEffect(() => {
        setIsLoading(true);
        const supabase = createClient();
        Promise.all([
            fetchAthletes(),
            fetchAnalysisRecords(),
            supabase.auth.getUser()
        ]).then(async ([athletes, records, { data: { user } }]) => {
            setAllAthletes(athletes);
            setSelectedPlayers(new Set(athletes));
            setAnalysisList(records);

            if (user) {
                const { data: dbUser } = await supabase
                    .from("users")
                    .select("role")
                    .eq("id", user.id)
                    .maybeSingle();
                setUserRole(dbUser?.role || "athlete");
            }

            setIsLoading(false);
        });

        // Fetch today's schedule
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        let scheduleQuery = supabase
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
            .order("start_time", { ascending: true });

        // For analysis, we look for items with event_type 'lesson' AND title containing '[분석]'
        // OR we just show all lessons since analysis is a sub-type of lesson in this DB
        // Based on schedule-sync.ts mapping, analysis maps to 'lesson' in DB but has '[분석]' in title.

        scheduleQuery.then(({ data: scheduleData, error: scheduleError }) => {
            if (!scheduleError && scheduleData) {
                const formattedSchedules = scheduleData
                    .filter((item: any) => item.title.includes("[분석]"))
                    .map((item: any) => {
                        const dStart = new Date(item.start_time);
                        const dEnd = new Date(item.end_time);
                        const timeStr = `${dStart.getHours().toString().padStart(2, '0')}:${dStart.getMinutes().toString().padStart(2, '0')}~${dEnd.getHours().toString().padStart(2, '0')}:${dEnd.getMinutes().toString().padStart(2, '0')}`;

                        return {
                            id: item.id,
                            playerName: item.users?.name || "알수없음",
                            title: item.title,
                            time: timeStr,
                            type: "analysis",
                            status: item.status || "scheduled"
                        };
                    });
                setTodaySchedule(formattedSchedules);
            }
        });
    }, []);

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

    // Toggle individual player
    const togglePlayer = (name: string) => {
        setSelectedPlayers((prev) => {
            let next: Set<string>;

            if (selectAll) {
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

        setSearchQuery("");
    };

    const toggleSelectAll = () => {
        setSelectAll(true);
        setSelectedPlayers(new Set(allAthletes));
        setSearchQuery("");
    };

    const visiblePlayersArr = useMemo(() => {
        const queryMatches = searchQuery
            ? allAthletes.filter((p) => p.toLowerCase().includes(searchQuery.toLowerCase()))
            : [];

        const selectedArr = selectAll ? [] : Array.from(selectedPlayers);

        return Array.from(new Set([...selectedArr, ...queryMatches]));
    }, [searchQuery, selectedPlayers, selectAll, allAthletes]);

    // Final filtered analysis
    const filteredAnalysis = useMemo(() => {
        return analysisList.filter((l) => {
            const typeMatch = activeFilter === "all" || l.type === activeFilter;
            const playerMatch = selectedPlayers.has(l.playerName);
            const afterStart = !startDate || l.date >= startDate;
            const beforeEnd = !endDate || l.date <= endDate;
            return typeMatch && playerMatch && afterStart && beforeEnd;
        });
    }, [analysisList, activeFilter, selectedPlayers, startDate, endDate]);

    const displayedAnalysis = useMemo(() => {
        return filteredAnalysis.slice(0, displayLimit);
    }, [filteredAnalysis, displayLimit]);

    const handleReservationClick = (playerName: string, type: AnalysisType) => {
        setActiveFilter(type);
        setSearchQuery(playerName);
    };

    const filteredTodaySchedule = useMemo(() => {
        if (activeFilter === "all") return todaySchedule;
        return (todaySchedule as any[]).filter(item =>
            item.type === activeFilter || item.type === "analysis"
        );
    }, [todaySchedule, activeFilter]);

    return (
        <div className="p-4 sm:p-8 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <Activity size={24} className="text-brand-navy dark:text-brand-navy-light shrink-0" />
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                        Analysis
                    </h1>
                </div>
                {(userRole === 'coach' || userRole === 'admin') && (
                    <Link
                        href="/analysis/create"
                        className="bg-brand-red hover:bg-brand-red-dark text-white px-5 py-2 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1.5 shrink-0"
                    >
                        <Plus size={18} />
                        작성
                    </Link>
                )}
            </div>

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
                                    ? "bg-brand-navy text-white shadow-md"
                                    : "bg-transparent text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-brand-navy-light dark:hover:bg-brand-navy-dark hover:text-brand-navy dark:hover:text-white"
                                }`}
                        >
                            {btn.label}
                        </button>
                    );
                })}
            </div>

            {/* ── Today's Scheduled Analysis ── */}
            <div className="mb-4">
                <div className="flex items-center justify-between mb-3 px-1">
                    <h2 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                        <Calendar size={16} className="text-brand-navy dark:text-brand-navy-light" />
                        오늘 완료한 분석
                    </h2>
                    <span className="text-[10px] text-zinc-400 font-medium">체크 표시된 항목은 등록 완료됨</span>
                </div>

                <div className="relative group/scroll">
                    {/* Desktop Navigation Arrows */}
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

                    <div
                        ref={scrollRef}
                        className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide -mx-1 px-1"
                    >
                        {(filteredTodaySchedule as any[]).map((s) => {
                            const isCompleted = s.status === "completed";
                            const canCreate = (userRole === 'coach' || userRole === 'admin') && !isCompleted;

                            return (
                                <Link
                                    key={s.id}
                                    href={canCreate ? `/analysis/create?player=${encodeURIComponent(s.playerName)}&start=${s.time.split('~')[0]}&end=${s.time.split('~')[1]}&type=${s.type}&scheduleId=${s.id}` : "#"}
                                    className={cn(
                                        "flex-shrink-0 w-40 border p-3.5 rounded-2xl shadow-sm transition-all active:scale-95 cursor-pointer group",
                                        isCompleted
                                            ? "bg-zinc-100 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 opacity-60 pointer-events-none"
                                            : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-brand-navy/50 hover:shadow-md",
                                        !canCreate && !isCompleted && "pointer-events-none opacity-80"
                                    )}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={cn(
                                            "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md",
                                            isCompleted ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-400" : "bg-brand-navy/5 dark:bg-brand-navy/20 text-brand-navy dark:text-brand-navy-light"
                                        )}>
                                            {isCompleted ? "completed" : "analysis"}
                                        </span>
                                        {!isCompleted && canCreate && <Plus size={14} className="text-zinc-300 group-hover:text-brand-navy transition-colors" />}
                                    </div>
                                    <div className={cn(
                                        "text-sm font-bold mb-1",
                                        isCompleted ? "text-zinc-400" : "text-zinc-900 dark:text-zinc-50"
                                    )}>
                                        {s.playerName}
                                    </div>
                                    <div className={cn(
                                        "text-[11px] font-medium",
                                        isCompleted ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-400"
                                    )}>
                                        {s.time}
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </div >

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 mb-6">
                {/* Date Range: 분석 일자 */}
                <div className="flex items-center gap-2">
                    <label className="w-24 shrink-0 text-center text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                        분석 일자
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
                            className="shrink-0 px-1 py-2 text-xs font-bold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
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
                )
                }
            </div >

            {/* ── Analysis Table ── */}
            < section >
                <div className="flex items-center justify-between mb-4 mt-6">
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
                            조회 결과
                        </h2>
                        <span className="text-xs text-zinc-400">
                            ({filteredAnalysis.length}건)
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

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
                    {isLoading ? (
                        <div className="py-12 text-center text-zinc-500">데이터를 불러오는 중...</div>
                    ) : displayedAnalysis.length > 0 ? (
                        <>
                            <AnalysisTable analyses={displayedAnalysis} />
                            {filteredAnalysis.length > displayLimit && (
                                <div className="mt-6 flex justify-center">
                                    <button
                                        onClick={() => setDisplayLimit(prev => prev + 20)}
                                        className="px-6 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all active:scale-95"
                                    >
                                        더 보기 ({filteredAnalysis.length - displayLimit}건 남음)
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="py-12 text-center text-zinc-500 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
                            등록된 분석 결과가 없습니다.
                        </div>
                    )}
                </div>
            </section >
        </div >
    );
}
