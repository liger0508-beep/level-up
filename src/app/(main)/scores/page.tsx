"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from 'next/link';
import { useRouter } from "next/navigation";
import { ScoreTable, ScoreData } from "@/components/score/ScoreTable";
import { BookOpen, Plus, Search, Calendar, ChevronLeft, ChevronRight, BarChart3, Trophy, Loader2 } from "lucide-react";
import { DatePickerInput } from "@/components/ui/DatePickerInput";
import { fetchAthletes } from "@/lib/athlete-sync";
import { createClient } from "@/lib/supabase/client";
import { formatLocalDate } from "@/lib/utils";
import { DatePresets, DatePresetType } from "@/components/ui/DatePresets";

// ── Supabase & Data Fetching ───────────────────────────────

export default function ScoresPage() {
    const router = useRouter();
    const [showDraftPopup, setShowDraftPopup] = useState(false);
    const [draftToResume, setDraftToResume] = useState<string | null>(null);

    const [searchQuery, setSearchQuery] = useState("");
    const [selectAll, setSelectAll] = useState(true);
    const [allAthletes, setAllAthletes] = useState<string[]>([]);
    const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [displayLimit, setDisplayLimit] = useState(20);
    const [activePreset, setActivePreset] = useState<DatePresetType>("custom");
    
    const [allScores, setAllScores] = useState<ScoreData[]>([]);
    const [todayScores, setTodayScores] = useState<ScoreData[]>([]);
    const [totalScoreCount, setTotalScoreCount] = useState(0);
    const [draftScore, setDraftScore] = useState<ScoreData | null>(null);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [loggedUserName, setLoggedUserName] = useState<string | null>(null);
    const [summaryStats, setSummaryStats] = useState({
        avg: 0,
        avgRounds: 0,
        best: 0,
        bestPlayerName: "",
        bestCourseName: "",
        totalRounds: 0,
        thisMonthRounds: 0
    });

    useEffect(() => {
        const loadData = async () => {
            const supabase = createClient();
            
            // 1. Get user role
            const { data: { user } } = await supabase.auth.getUser();
            let role = null;
            let userName = null;
            if (user) {
                const { data: profile } = await supabase.from("users").select("role, name").eq("id", user.id).single();
                role = profile?.role || null;
                userName = profile?.name || null;
                setUserRole(role);
                setLoggedUserName(userName);
            }

            // 2. Fetch Athletes
            const athletes = await fetchAthletes();
            setAllAthletes(athletes);
            
            try {
                const isFromDetail = sessionStorage.getItem("gla_scores_keep_alive") === "true";
                if (isFromDetail) {
                    const stored = sessionStorage.getItem("gla_scores_filter");
                    if (stored) {
                        const parsed = JSON.parse(stored);
                        if (parsed.startDate !== undefined) setStartDate(parsed.startDate);
                        if (parsed.endDate !== undefined) setEndDate(parsed.endDate);
                        if (parsed.activePreset) setActivePreset(parsed.activePreset);
                        
                        if (role !== 'athlete' && role !== 'parent') {
                            if (parsed.searchQuery !== undefined) setSearchQuery(parsed.searchQuery);
                            if (parsed.selectAll !== undefined) setSelectAll(parsed.selectAll);
                            
                            if (parsed.selectAll) {
                                setSelectedPlayers(new Set(athletes));
                            } else if (parsed.selectedPlayers) {
                                setSelectedPlayers(new Set(parsed.selectedPlayers));
                            } else {
                                setSelectedPlayers(new Set(athletes));
                            }
                        } else {
                            if (userName) setSelectedPlayers(new Set([userName]));
                            else setSelectedPlayers(new Set());
                        }
                    } else {
                        if (role === 'athlete' || role === 'parent') {
                            if (userName) setSelectedPlayers(new Set([userName]));
                            else setSelectedPlayers(new Set());
                        } else {
                            setSelectedPlayers(new Set(athletes));
                        }
                    }
                    setTimeout(() => {
                        sessionStorage.removeItem("gla_scores_keep_alive");
                    }, 100);
                } else {
                    sessionStorage.removeItem("gla_scores_filter");
                    sessionStorage.removeItem("gla_scores_scroll");
                    if (role === 'athlete' || role === 'parent') {
                        if (userName) setSelectedPlayers(new Set([userName]));
                        else setSelectedPlayers(new Set());
                    } else {
                        setSelectedPlayers(new Set(athletes));
                    }
                }
            } catch (e) {
                console.warn("Failed to restore scores filter", e);
                if (role === 'athlete' || role === 'parent') {
                    if (userName) setSelectedPlayers(new Set([userName]));
                    else setSelectedPlayers(new Set());
                } else {
                    setSelectedPlayers(new Set(athletes));
                }
            }

            // 2.5 Cleanup old drafts (created > 24h ago and not final)
            try {
                const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
                await supabase
                    .from("scorecards")
                    .delete()
                    .eq("is_final", false)
                    .lt("created_at", twentyFourHoursAgo);
            } catch (err) {
                console.error("Cleanup error:", err);
            }

            // 3. Fetch Today's Scores (Lean)
            const todayStr = formatLocalDate();
            let todayQuery = supabase
                .from("scorecards")
                .select(`
                    id, total_score, course_name, round_date, created_at, memo, hole_count, is_final,
                    athlete:users!scorecards_athlete_id_fkey(id, name),
                    coach:users!scorecards_coach_id_fkey(name),
                    holes:scorecard_holes(score, par)
                `)
                .eq("round_date", todayStr)
                .neq("is_final", false);

            if (role === 'athlete' && user?.id) {
                todayQuery = todayQuery.eq("athlete_id", user.id);
            } else if (role === 'coach') {
                const { data: profile } = await supabase.from("users").select("assigned_athletes").eq("id", user?.id).single();
                if (profile?.assigned_athletes) {
                    const assignedNames = profile.assigned_athletes.split(',').map((n: string) => n.trim());
                    // we will filter in memory for coach assigned athletes to keep query simple
                }
            }
            const { data: todayData } = await todayQuery;
            
            if (todayData) {
                let filteredToday = todayData;
                if (role === 'coach') {
                    const { data: profile } = await supabase.from("users").select("assigned_athletes").eq("id", user?.id).single();
                    if (profile?.assigned_athletes) {
                        const assignedNames = profile.assigned_athletes.split(',').map((n: string) => n.trim());
                        filteredToday = todayData.filter(s => assignedNames.includes((s.athlete as any)?.name));
                    }
                }
                const mappedToday = filteredToday.map(mapScorecardRow);
                setTodayScores(mappedToday);
            }

            // 4. Fetch User's Draft
            let draftQuery = supabase
                .from("scorecards")
                .select(`
                    id, total_score, course_name, round_date, created_at, memo, hole_count, is_final,
                    athlete:users!scorecards_athlete_id_fkey(id, name),
                    coach:users!scorecards_coach_id_fkey(name),
                    holes:scorecard_holes(score, par)
                `)
                .eq("is_final", false)
                .limit(1);
            
            if (role === 'athlete' && user?.id) {
                draftQuery = draftQuery.eq("athlete_id", user.id);
            } else if (userName) {
                draftQuery = draftQuery.eq("coach_id", user?.id); // coach's drafts
            }
            const { data: draftData } = await draftQuery;
            if (draftData && draftData.length > 0) {
                setDraftScore(mapScorecardRow(draftData[0]));
            }

            // 5. Calculate Stats for the last 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10);
            const currentMonth = new Date().toISOString().slice(0, 7);
            
            let statsQuery = supabase
                .from("scorecards")
                .select(`
                    id, total_score, course_name, round_date, hole_count, is_final,
                    athlete:users!scorecards_athlete_id_fkey(id, name),
                    holes:scorecard_holes(score)
                `)
                .gte("round_date", thirtyDaysAgoStr)
                .eq("is_final", true)
                .eq("hole_count", 18);
                
            if (role === 'athlete' && user?.id) {
                statsQuery = statsQuery.eq("athlete_id", user.id);
            }
            const { data: statsData } = await statsQuery;

            if (statsData) {
                let relevantStats = statsData;
                if (role === 'coach') {
                    const { data: profile } = await supabase.from("users").select("assigned_athletes").eq("id", user?.id).single();
                    if (profile?.assigned_athletes) {
                        const assignedNames = profile.assigned_athletes.split(',').map((n: string) => n.trim());
                        relevantStats = statsData.filter(s => assignedNames.includes((s.athlete as any)?.name));
                    }
                }

                if (relevantStats.length > 0) {
                    const fullRounds = relevantStats.filter(s => {
                        const holes = (s as any).holes || [];
                        const completedCount = holes.filter((h: any) => h.score > 0 && h.score !== -1).length;
                        return completedCount === 18;
                    });

                    let recentAvg = 0;
                    if (fullRounds.length > 0) {
                        recentAvg = fullRounds.reduce((sum, s) => sum + (s.total_score || 0), 0) / fullRounds.length;
                    }

                    let bestScore = 0;
                    let bestPlayer = "";
                    let bestCourse = "";
                    if (fullRounds.length > 0) {
                        bestScore = fullRounds[0].total_score || 0;
                        bestPlayer = (fullRounds[0].athlete as any)?.name || "";
                        bestCourse = fullRounds[0].course_name;
                        fullRounds.forEach(s => {
                            if ((s.total_score || 0) < bestScore) {
                                bestScore = s.total_score || 0;
                                bestPlayer = (s.athlete as any)?.name || "";
                                bestCourse = s.course_name;
                            }
                        });
                    }

                    const thisMonth = relevantStats.filter(s => s.round_date.startsWith(currentMonth)).length;
                    setSummaryStats({
                        avg: Math.round(recentAvg * 10) / 10,
                        avgRounds: fullRounds.length,
                        best: bestScore,
                        bestPlayerName: bestPlayer,
                        bestCourseName: bestCourse,
                        totalRounds: relevantStats.length,
                        thisMonthRounds: thisMonth
                    });
                }
            }
            setLoading(false);
        };
        loadData();
    }, []);

    // Helper for mapping
    const mapScorecardRow = (s: any): ScoreData => {
        const holes = s.holes || [];
        let completedCount = holes.filter((h: any) => h.score > 0 && h.score !== -1).length;
        
        if (s.is_final === false && s.hole_count) {
            completedCount = s.hole_count;
        }

        let relativeScore = undefined;
        if (s.is_final === false) {
            const validHoles = holes.filter((h: any) => h.score > 0 && h.score !== -1 && h.par > 0);
            if (validHoles.length > 0) {
                const totalScore = validHoles.reduce((acc: number, h: any) => acc + h.score, 0);
                const totalPar = validHoles.reduce((acc: number, h: any) => acc + h.par, 0);
                relativeScore = totalScore - totalPar;
            } else {
                relativeScore = s.total_score || 0; // fallback
            }
        }

        return {
            id: s.id,
            score: s.total_score || 0,
            title: `${s.course_name} 라운드`,
            playerName: (s.athlete as any)?.name || "미지정",
            coachName: (s.coach as any)?.name || "미지정",
            courseName: s.course_name,
            comment: s.memo || "",
            date: s.round_date,
            createdAt: s.created_at,
            completedHoles: completedCount,
            holeCount: s.hole_count || (completedCount > 9 ? 18 : 9),
            isFinal: s.is_final,
            relativeScore
        };
    };

    // New useEffect for Server-side Pagination
    useEffect(() => {
        if (loading || !userRole) return;

        const fetchFilteredScores = async () => {
            const supabase = createClient();
            let query = supabase
                .from("scorecards")
                .select(`
                    id, total_score, course_name, round_date, created_at, memo, hole_count, is_final,
                    athlete:users!scorecards_athlete_id_fkey(id, name),
                    coach:users!scorecards_coach_id_fkey(name),
                    holes:scorecard_holes(score, par)
                `, { count: 'exact' });
                
            // Apply Filters
            if (startDate) query = query.gte("round_date", startDate);
            if (endDate) query = query.lte("round_date", endDate);
            
            if (userRole === 'coach' || userRole === 'admin') {
                if (!selectAll && selectedPlayers.size > 0) {
                    const { data: usersData } = await supabase.from("users").select("id").in("name", Array.from(selectedPlayers));
                    const userIds = usersData?.map(u => u.id) || [];
                    if (userIds.length > 0) query = query.in("athlete_id", userIds);
                    else query = query.eq("athlete_id", "00000000-0000-0000-0000-000000000000");
                }
            } else if (userRole === 'athlete') {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) query = query.eq("athlete_id", user.id);
            }
            
            // Order: Drafts (false) first, then by round_date DESC, then created_at DESC
            query = query
                .order("is_final", { ascending: true })
                .order("round_date", { ascending: false })
                .order("created_at", { ascending: false })
                .limit(displayLimit);
                
            const { data, count, error } = await query;
            if (error || !data) return;
            
            setTotalScoreCount(count || 0);
            
            const mapped = data.map(mapScorecardRow);
            
            // Deduplicate for React keys safety
            const uniqueMapped = Array.from(new Map(mapped.map(m => [m.id, m])).values());
            setAllScores(uniqueMapped);
        };

        fetchFilteredScores();
    }, [loading, startDate, endDate, selectAll, selectedPlayers, displayLimit, userRole]);

    // Scroll state management
    useEffect(() => {
        if (typeof window !== "undefined" && !loading) {
            const savedScroll = sessionStorage.getItem("gla_scores_scroll");
            if (savedScroll) {
                window.scrollTo(0, parseInt(savedScroll, 10));
                sessionStorage.removeItem("gla_scores_scroll");
            }
            
            const handleScroll = () => {
                sessionStorage.setItem("gla_scores_scroll", window.scrollY.toString());
            };
            window.addEventListener("scroll", handleScroll);
            return () => window.removeEventListener("scroll", handleScroll);
        }
    }, [loading]);

    // Save filter state to sessionStorage whenever it changes
    useEffect(() => {
        if (allAthletes.length === 0) return;
        
        try {
            sessionStorage.setItem("gla_scores_filter", JSON.stringify({
                searchQuery,
                selectAll,
                selectedPlayers: Array.from(selectedPlayers),
                startDate,
                endDate,
                activePreset
            }));
        } catch (e) {
            console.warn("Failed to save scores filter", e);
        }
    }, [searchQuery, selectAll, selectedPlayers, startDate, endDate, activePreset, allAthletes]);

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

    // Client side filtering is now replaced by server-side filtering

    return (
        <div className="p-4 sm:p-8 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <Trophy size={24} className="text-brand-navy dark:text-brand-navy-light shrink-0" />
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                        Score
                    </h1>
                </div>
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        if (draftScore) {
                            setDraftToResume(draftScore.id);
                            setShowDraftPopup(true);
                        } else {
                            router.push("/scores/create");
                        }
                    }}
                    className="bg-brand-red hover:bg-brand-red-dark text-white px-5 py-2 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1.5 shrink-0"
                >
                    <Plus size={18} />
                    작성
                </button>
            </div>

            {loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="w-8 h-8 text-brand-navy animate-spin" />
                    <p className="text-zinc-500 text-sm font-medium">데이터를 불러오는 중...</p>
                </div>
            ) : (
                <>
                    {/* ── Analytical Summary ── */}
                    <div className="grid grid-cols-2 gap-3 mb-10">
                        <div className="bg-white border border-zinc-200 dark:border-zinc-800 p-5 rounded-[2rem] flex flex-col justify-between min-h-[120px] relative overflow-hidden group hover:border-brand-navy transition-all">
                            <div className="flex items-center gap-2 text-zinc-400 mb-2">
                                <BarChart3 size={16} />
                                <span className="text-[10px] font-black uppercase tracking-tight whitespace-nowrap">{userRole === 'athlete' ? "나의 평균 타수 (30일)" : "평균 타수 (30일)"}</span>
                            </div>
                            <div className="flex flex-col items-end">
                                <div className="flex items-baseline gap-1">
                                    <p className={`text-3xl font-black tracking-tighter italic ${summaryStats.avg > 0 ? (summaryStats.avg < 72 ? "text-red-500" : summaryStats.avg > 72 ? "text-blue-500" : "text-zinc-900 dark:text-zinc-50") : "text-zinc-900 dark:text-zinc-50"}`}>
                                        {summaryStats.avg > 0 ? summaryStats.avg.toFixed(1) : "--"}
                                    </p>
                                    <span className="text-xs font-bold text-zinc-400">
                                        타 {summaryStats.avg > 0 ? `(${summaryStats.avgRounds}회)` : ""}
                                    </span>
                                </div>
                            </div>
                            <div className="absolute right-[-10px] bottom-[-10px] opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                                <BarChart3 size={80} />
                            </div>
                        </div>

                        <div className="bg-white border border-zinc-200 dark:border-zinc-800 p-5 rounded-[2rem] flex flex-col justify-between min-h-[120px] relative overflow-hidden group hover:border-brand-red transition-all">
                            <div className="flex items-center gap-2 text-zinc-400 mb-2">
                                <Trophy size={16} />
                                <span className="text-[10px] font-black uppercase tracking-tight whitespace-nowrap">{userRole === 'athlete' ? "나의 베스트 (30일)" : "최저 타수 (30일)"}</span>
                            </div>
                            <div className="flex items-end justify-between w-full relative z-10">
                                <div className="mb-1">
                                    {summaryStats.bestPlayerName && (
                                        <span className="text-[11px] font-bold text-zinc-400">
                                            {userRole !== 'athlete' ? `${summaryStats.bestPlayerName} ` : ""}
                                            {summaryStats.bestCourseName ? `(${summaryStats.bestCourseName})` : ""}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <p className={`text-3xl font-black tracking-tighter italic ${summaryStats.best > 0 ? (summaryStats.best < 72 ? "text-red-500" : summaryStats.best > 72 ? "text-blue-500" : "text-zinc-900 dark:text-zinc-50") : "text-zinc-900 dark:text-zinc-50"}`}>
                                        {summaryStats.best || "--"}
                                    </p>
                                    <span className="text-xs font-bold text-zinc-400">타</span>
                                </div>
                            </div>
                            <div className="absolute right-[-10px] bottom-[-10px] opacity-[0.03] group-hover:opacity-[0.05] transition-opacity text-brand-red">
                                <Trophy size={80} />
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
                                onClick={() => sessionStorage.setItem("gla_scores_keep_alive", "true")}
                                className="flex-shrink-0 w-44 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm hover:border-brand-navy/50 hover:shadow-md transition-all active:scale-95 cursor-pointer group"
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[15px] font-bold text-zinc-900 dark:text-zinc-50 truncate pr-2">
                                        {s.playerName}
                                    </span>
                                    <BarChart3 size={14} className="text-zinc-300 group-hover:text-brand-navy transition-colors shrink-0" />
                                </div>
                                <div className="text-right">
                                    <div className={`text-[17px] font-black tracking-tight mb-0.5 ${s.isFinal === false ? (s.relativeScore !== undefined ? (s.relativeScore < 0 ? "text-red-500" : s.relativeScore > 0 ? "text-blue-500" : "text-zinc-900 dark:text-zinc-100") : "text-zinc-900 dark:text-zinc-100") : (s.score < (s.holeCount === 9 ? 36 : 72) ? "text-red-500" : s.score > (s.holeCount === 9 ? 36 : 72) ? "text-blue-500" : "text-zinc-900 dark:text-zinc-100")}`}>
                                        {s.isFinal === false ? (
                                            s.relativeScore !== undefined ? (s.relativeScore > 0 ? `+${s.relativeScore}` : s.relativeScore === 0 ? "E" : s.relativeScore) : `${s.score}타`
                                        ) : `${s.score}타`}
                                        {s.holeCount === 9 ? (
                                            <span className="ml-1 text-[11px] text-zinc-400 font-bold italic tracking-tighter">(9H)</span>
                                        ) : (s.completedHoles !== undefined && s.completedHoles > 0 && s.completedHoles < 18 && (
                                            <span className="ml-1 text-[11px] text-zinc-400 font-bold italic tracking-tighter">({s.completedHoles}H)</span>
                                        ))}
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
                </div>

                {userRole !== 'athlete' && userRole !== 'parent' && (
                    <>
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
                            <div className="flex flex-wrap gap-2 mt-3 max-h-32 overflow-y-auto pr-1 custom-scrollbar" style={{ paddingLeft: '104px' }}>
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
                    </>
                )}
            </div>

            <section>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-200">
                            조회 결과
                        </h2>
                        <span className="text-xs text-zinc-400 font-medium">
                            ({totalScoreCount}건)
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
                <div className="mt-2">
                    {allScores.length > 0 ? (
                        <>
                            <ScoreTable scores={allScores} totalCount={totalScoreCount} />
                            {totalScoreCount > allScores.length && (
                                <div className="mt-6 flex justify-center">
                                    <button
                                        onClick={() => setDisplayLimit(prev => prev + 20)}
                                        className="px-6 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all active:scale-95"
                                    >
                                        더 보기 ({totalScoreCount - allScores.length}건 남음)
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

            {showDraftPopup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowDraftPopup(false)}>
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mb-2">작성중인 스코어카드가 있습니다</h3>
                        <p className="text-sm text-zinc-500 mb-6">스코어카드를 이어서 작성하시겠습니까?</p>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => {
                                    setShowDraftPopup(false);
                                    router.push("/scores/create");
                                }}
                                className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                            >
                                신규 작성하기
                            </button>
                            <button 
                                onClick={() => {
                                    setShowDraftPopup(false);
                                    if (draftToResume) {
                                        router.push(`/scores/create?id=${draftToResume}`);
                                    }
                                }}
                                className="flex-1 py-2.5 rounded-xl bg-brand-navy text-white font-semibold text-sm hover:bg-brand-navy-dark transition-colors"
                            >
                                이어서 작성하기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
