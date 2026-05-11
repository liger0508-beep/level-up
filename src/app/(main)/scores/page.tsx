"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from 'next/link';
import { ScoreTable, ScoreData } from "@/components/score/ScoreTable";
import { BookOpen, Plus, Search, Calendar, ChevronLeft, ChevronRight, BarChart3, Trophy, Loader2 } from "lucide-react";
import { DatePickerInput } from "@/components/ui/DatePickerInput";
import { fetchAthletes } from "@/lib/athlete-sync";
import { createClient } from "@/lib/supabase/client";
import { formatLocalDate } from "@/lib/utils";

// ── Supabase & Data Fetching ───────────────────────────────

export default function ScoresPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectAll, setSelectAll] = useState(true);
    const [allAthletes, setAllAthletes] = useState<string[]>([]);
    const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [displayLimit, setDisplayLimit] = useState(20);
    
    const [allScores, setAllScores] = useState<ScoreData[]>([]);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [summaryStats, setSummaryStats] = useState({
        avg: 0,
        best: 0,
        bestPlayerName: "",
        totalRounds: 0,
        thisMonthRounds: 0
    });

    useEffect(() => {
        const loadData = async () => {
            const supabase = createClient();
            
            // 1. Get user role
            const { data: { user } } = await supabase.auth.getUser();
            let role = null;
            if (user) {
                const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
                role = profile?.role || null;
                setUserRole(role);
            }

            // 2. Fetch Athletes
            const athletes = await fetchAthletes();
            setAllAthletes(athletes);
            setSelectedPlayers(new Set(athletes));

            // 3. Fetch Scorecards
            const { data: scorecards, error } = await supabase
                .from("scorecards")
                .select(`
                    id, 
                    total_score, 
                    course_name, 
                    round_date, 
                    memo,
                    athlete:users!scorecards_athlete_id_fkey(id, name),
                    coach:users!scorecards_coach_id_fkey(name)
                `)
                .order("round_date", { ascending: false });

            if (scorecards) {
                const mapped: ScoreData[] = scorecards.map(s => ({
                    id: s.id,
                    score: s.total_score || 0,
                    title: `${s.course_name} 라운드`,
                    playerName: (s.athlete as any)?.name || "미지정",
                    coachName: (s.coach as any)?.name || "미지정",
                    courseName: s.course_name,
                    comment: s.memo || "",
                    date: s.round_date
                }));
                setAllScores(mapped);

                // Calculate summary
                const currentMonth = new Date().toISOString().slice(0, 7);
                const { data: profile } = await supabase.from("users").select("id, role, assigned_athletes").eq("id", user?.id).single();
                
                let relevantScores = mapped;
                if (role === 'athlete') {
                    relevantScores = mapped.filter(s => (scorecards.find(sc => sc.id === s.id)?.athlete as any)?.id === user?.id);
                } else if (role === 'coach' && profile?.assigned_athletes) {
                    const assignedNames = profile.assigned_athletes.split(',').map((n: string) => n.trim());
                    relevantScores = mapped.filter(s => assignedNames.includes(s.playerName));
                }
                
                if (relevantScores.length > 0) {
                    const avg = relevantScores.reduce((sum, s) => sum + s.score, 0) / relevantScores.length;
                    
                    // Find best score and the player who achieved it
                    let bestScore = relevantScores[0].score;
                    let bestPlayer = relevantScores[0].playerName;
                    
                    relevantScores.forEach(s => {
                        if (s.score < bestScore) {
                            bestScore = s.score;
                            bestPlayer = s.playerName;
                        }
                    });

                    const thisMonth = relevantScores.filter(s => s.date.startsWith(currentMonth)).length;
                    setSummaryStats({
                        avg: Math.round(avg * 10) / 10,
                        best: bestScore,
                        bestPlayerName: bestPlayer,
                        totalRounds: relevantScores.length,
                        thisMonthRounds: thisMonth
                    });
                }
            }
            setLoading(false);
        };
        loadData();
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
            if (next.size === 0 || next.size === allAthletes.length) {
                setSelectAll(true);
                return new Set(allAthletes);
            }
            return next;
        });
        setSearchQuery("");
    };

    const visiblePlayersArr = useMemo(() => {
        const queryMatches = searchQuery
            ? allAthletes.filter((p) => p.toLowerCase().includes(searchQuery.toLowerCase()))
            : [];
        const selectedArr = selectAll ? [] : Array.from(selectedPlayers);
        return Array.from(new Set([...selectedArr, ...queryMatches]));
    }, [searchQuery, selectedPlayers, selectAll, allAthletes]);

    const todayStr = formatLocalDate();
    
    const todayScores = useMemo(() => {
        return allScores.filter(s => s.date === todayStr);
    }, [allScores, todayStr]);

    const filteredScores = useMemo(() => {
        return allScores.filter((l) => {
            const playerMatch = selectedPlayers.has(l.playerName);
            const afterStart = !startDate || l.date >= startDate;
            const beforeEnd = !endDate || l.date <= endDate;
            return playerMatch && afterStart && beforeEnd;
        });
    }, [allScores, selectedPlayers, startDate, endDate]);

    const displayedScores = useMemo(() => {
        return filteredScores.slice(0, displayLimit);
    }, [filteredScores, displayLimit]);

    return (
        <div className="p-4 sm:p-8 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <Trophy size={24} className="text-brand-navy dark:text-brand-navy-light shrink-0" />
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                        Score
                    </h1>
                </div>
                <Link
                    href="/scores/create"
                    className="bg-brand-red hover:bg-brand-red-dark text-white px-5 py-2 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1.5 shrink-0"
                >
                    <Plus size={18} />
                    작성
                </Link>
            </div>

            {loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="w-8 h-8 text-brand-navy animate-spin" />
                    <p className="text-zinc-500 text-sm font-medium">데이터를 불러오는 중...</p>
                </div>
            ) : (
                <>
                    {/* ── Analytical Summary ── */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-10">
                        <div className="bg-transparent border border-zinc-200 dark:border-zinc-800 p-5 rounded-[2rem] flex flex-col justify-between min-h-[120px] relative overflow-hidden group hover:border-brand-navy transition-all">
                            <div className="flex items-center gap-2 text-zinc-400 mb-2">
                                <BarChart3 size={16} />
                                <span className="text-[10px] font-black uppercase tracking-widest">{userRole === 'athlete' ? "나의 평균 타수" : "전체 평균 타수"}</span>
                            </div>
                            <div className="flex flex-col items-end">
                                <div className="flex items-baseline gap-1">
                                    <p className="text-3xl font-black text-zinc-900 dark:text-zinc-50 tracking-tighter italic">{summaryStats.avg || "--"}</p>
                                    <span className="text-xs font-bold text-zinc-400">타</span>
                                </div>
                            </div>
                            <div className="absolute right-[-10px] bottom-[-10px] opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                                <BarChart3 size={80} />
                            </div>
                        </div>

                        <div className="bg-transparent border border-zinc-200 dark:border-zinc-800 p-5 rounded-[2rem] flex flex-col justify-between min-h-[120px] relative overflow-hidden group hover:border-brand-red transition-all">
                            <div className="flex items-center gap-2 text-zinc-400 mb-2">
                                <Trophy size={16} />
                                <span className="text-[10px] font-black uppercase tracking-widest">{userRole === 'athlete' ? "나의 베스트" : "최고 기록"}</span>
                            </div>
                            <div className="flex flex-col items-end">
                                {userRole !== 'athlete' && summaryStats.bestPlayerName && (
                                    <span className="text-[10px] font-bold text-zinc-400 mb-1">{summaryStats.bestPlayerName} 선수</span>
                                )}
                                <div className="flex items-baseline gap-1">
                                    <p className="text-3xl font-black text-brand-red tracking-tighter italic">{summaryStats.best || "--"}</p>
                                    <span className="text-xs font-bold text-zinc-400">타</span>
                                </div>
                            </div>
                            <div className="absolute right-[-10px] bottom-[-10px] opacity-[0.03] group-hover:opacity-[0.05] transition-opacity text-brand-red">
                                <Trophy size={80} />
                            </div>
                        </div>

                        <div className="hidden md:flex bg-transparent border border-brand-navy/30 p-5 rounded-[2rem] flex-col justify-between min-h-[120px] relative overflow-hidden group transition-all col-span-1 hover:border-brand-navy">
                            <div className="flex items-center gap-2 text-brand-navy dark:text-brand-navy-light mb-2">
                                <Calendar size={16} />
                                <span className="text-[10px] font-black uppercase tracking-widest">이달의 라운드</span>
                            </div>
                            <div className="flex flex-col items-end">
                                <div className="flex items-baseline gap-1">
                                    <p className="text-3xl font-black text-brand-navy dark:text-brand-navy-light tracking-tighter italic">{summaryStats.thisMonthRounds}</p>
                                    <span className="text-xs font-bold text-zinc-400">회</span>
                                </div>
                            </div>
                            <div className="absolute right-[-10px] bottom-[-10px] opacity-[0.03] group-hover:opacity-[0.05] transition-opacity text-brand-navy">
                                <Calendar size={80} />
                            </div>
                        </div>
                    </div>
                    {/* ── Today's Uploaded Scores ── */}
            <div className="mb-4">
                <div className="flex items-center justify-between mb-3 px-1">
                    <h2 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                        <Calendar size={16} className="text-brand-navy dark:text-brand-navy-light" />
                        오늘 업로드된 스코어
                    </h2>
                </div>

                <div className="relative group/scroll">
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
                        {todayScores.length > 0 ? todayScores.map((s) => (
                            <Link
                                key={s.id}
                                href={`/scores/${s.id}`}
                                className="flex-shrink-0 w-44 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm hover:border-brand-navy/50 hover:shadow-md transition-all active:scale-95 cursor-pointer group"
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[15px] font-bold text-zinc-900 dark:text-zinc-50 truncate pr-2">
                                        {s.playerName}
                                    </span>
                                    <BarChart3 size={14} className="text-zinc-300 group-hover:text-brand-navy transition-colors shrink-0" />
                                </div>
                                <div className="text-right">
                                    <div className={`text-[17px] font-black tracking-tight mb-0.5 ${s.score < 72 ? "text-red-500" : s.score > 72 ? "text-blue-500" : "text-zinc-900 dark:text-zinc-100"}`}>
                                        {s.score}타
                                    </div>
                                    <div className="text-[11px] text-zinc-500 font-medium truncate">
                                        {s.courseName}
                                    </div>
                                </div>
                            </Link>
                        )) : (
                            <div className="flex-1 py-10 flex flex-col items-center justify-center bg-zinc-50/50 dark:bg-zinc-900/50 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
                                <p className="text-zinc-400 text-xs font-medium">오늘 업로드된 스코어가 없습니다.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>


            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 mb-6">
                <div className="flex items-center gap-2">
                    <label className="w-24 shrink-0 text-center text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                        스코어 일자
                    </label>
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                        <DatePickerInput
                            value={startDate}
                            onClick={(e) => (e.target as any).showPicker?.()}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="no-year-date flex-1 min-w-0 px-2 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-[13px] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all text-center cursor-pointer"
                        />
                        <span className="text-zinc-400 shrink-0 text-xs">~</span>
                        <DatePickerInput
                            value={endDate}
                            onClick={(e) => (e.target as any).showPicker?.()}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="no-year-date flex-1 min-w-0 px-2 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-[13px] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all text-center cursor-pointer"
                        />
                    </div>
                </div>

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
                            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all"
                        />
                    </div>
                </div>

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

            <section>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-200">
                            조회 결과
                        </h2>
                        <span className="text-xs text-zinc-400 font-medium">
                            ({filteredScores.length}건)
                        </span>
                    </div>
                </div>
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
                    {displayedScores.length > 0 ? (
                        <>
                            <ScoreTable scores={displayedScores} />
                            {filteredScores.length > displayLimit && (
                                <div className="mt-6 flex justify-center">
                                    <button
                                        onClick={() => setDisplayLimit(prev => prev + 20)}
                                        className="px-6 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all active:scale-95"
                                    >
                                        더 보기 ({filteredScores.length - displayLimit}건 남음)
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <p className="text-zinc-400 text-sm text-center py-8">
                            조건에 맞는 스코어가 없습니다.
                        </p>
                    )}
                </div>
            </section >
                </>
            )}
        </div >
    );
}
