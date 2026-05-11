"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from 'next/link';
import { useRouter } from "next/navigation";
import { TestData, TestType, mockTests, mockTodayTests, TEST_TYPE_LABELS, fetchTestsByPlayer, TestRecord } from "@/lib/test-sync";
import { TestTable } from "@/components/training/TestTable";
import { ClipboardList, Plus, Search, Calendar, ChevronLeft, ChevronRight, Trophy, Medal, Crown } from "lucide-react";
import { getTodayScheduledItems } from "@/lib/schedule-sync";
import { DatePickerInput } from "@/components/ui/DatePickerInput";
import { createClient } from "@/lib/supabase/client";
import { DatePresets, DatePresetType } from "@/components/ui/DatePresets";
import { cn } from "@/lib/utils";

// ── Filter categories ────────────────────────────────────────
type FilterType = "all" | "shot" | "around_green" | "putting";

const filterButtons: { key: FilterType; label: string }[] = [
    { key: "all", label: "ALL" },
    { key: "shot", label: "Shot" },
    { key: "around_green", label: "Around Green" },
    { key: "putting", label: "Putt" },
];

const categories = [
    { key: "shot", label: "Shot", color: "from-amber-400 to-orange-500", icon: <Trophy size={18} /> },
    { key: "around_green", label: "Around Green", color: "from-emerald-400 to-teal-500", icon: <Medal size={18} /> },
    { key: "putting", label: "Putt", color: "from-violet-400 to-fuchsia-500", icon: <Crown size={18} /> }
];

export default function TestsPage() {
    const router = useRouter();
    const [allTests, setAllTests] = useState<TestData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState<FilterType>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectAll, setSelectAll] = useState(true);
    const [allAthletes, setAllAthletes] = useState<string[]>([]);
    const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [activePreset, setActivePreset] = useState<DatePresetType>("custom");
    const [displayLimit, setDisplayLimit] = useState(20);
    const [userRole, setUserRole] = useState<string | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                setIsLoading(true);
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                
                if (!user) return;

                const { data: profile } = await supabase
                    .from("users")
                    .select("name, role, assigned_athletes")
                    .eq("id", user.id)
                    .maybeSingle();

                if (!profile) return;
                setUserRole(profile.role);

                // Fetch tests based on role
                let fetchedRecords: TestRecord[] = [];
                if (profile.role === 'athlete') {
                    fetchedRecords = await fetchTestsByPlayer(profile.name);
                } else {
                    // For coach/admin, fetch all records with type='test'
                    const { data } = await supabase
                        .from("records")
                        .select(`
                            id,
                            type,
                            category,
                            title,
                            content,
                            score,
                            media_urls,
                            created_at,
                            users!records_user_id_fkey(name),
                            coach:users!records_coach_id_fkey(name)
                        `)
                        .eq("type", "test")
                        .order("created_at", { ascending: false });
                    
                    if (data) {
                        fetchedRecords = data.map((r: any) => ({
                            id: r.id,
                            type: "test",
                            category: r.category as TestType,
                            title: r.title || "",
                            content: r.content,
                            media_urls: r.media_urls || [],
                            created_at: r.created_at,
                            playerName: r.users?.name || "Unknown",
                            coachName: r.coach?.name || "Unknown"
                        }));
                    }

                    // If coach, filter by assigned athletes
                    if (profile.role === 'coach' && profile.assigned_athletes) {
                        const assignedNames = profile.assigned_athletes.split(',').map((n: string) => n.trim());
                        fetchedRecords = fetchedRecords.filter(r => assignedNames.includes(r.playerName));
                    }
                }

                const mapped: TestData[] = fetchedRecords.map(r => {
                    // content might be a string or object depending on how Supabase returns it
                    const parsedContent = typeof r.content === 'string' ? JSON.parse(r.content) : r.content;
                    const displayScore = r.score !== undefined && r.score !== null ? r.score : (parsedContent?.totalScore || 0);

                    return {
                        id: r.id,
                        type: r.category,
                        title: r.title,
                        playerName: r.playerName,
                        coachName: r.coachName,
                        comment: displayScore !== undefined ? `점수: ${Number(displayScore).toFixed(2)}` : "",
                        date: r.created_at.split('T')[0],
                        totalScore: Number(displayScore)
                    };
                });

                setAllTests(mapped);
                
                const players = Array.from(new Set(mapped.map(t => t.playerName)));
                setAllAthletes(players);
                setSelectedPlayers(new Set(players));
                setSelectAll(true);

            } catch (err) {
                console.error("Error loading tests:", err);
            } finally {
                setIsLoading(false);
            }
        };

        loadInitialData();
    }, []);

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

    const filteredTests = useMemo(() => {
        return allTests.filter((t) => {
            let typeMatch = activeFilter === "all";
            if (activeFilter === "shot") {
                typeMatch = t.type === "shot" || t.type === "driver" || t.type === "iron" || t.type === "wood_iron";
            } else if (activeFilter === "around_green") {
                typeMatch = t.type === "around_green" || t.type === "approach" || t.type === "bunker" || t.type === "pitch";
            } else if (activeFilter === "putting") {
                typeMatch = t.type === "putting" || t.type === "long_putt" || t.type === "middle_putt" || t.type === "short_putt";
            }
            
            const playerMatch = selectedPlayers.has(t.playerName);
            const afterStart = !startDate || t.date >= startDate;
            const beforeEnd = !endDate || t.date <= endDate;
            return typeMatch && playerMatch && afterStart && beforeEnd;
        });
    }, [allTests, activeFilter, selectedPlayers, startDate, endDate]);

    const displayedTests = useMemo(() => {
        return filteredTests.slice(0, displayLimit);
    }, [filteredTests, displayLimit]);

    const leaderboardData = useMemo(() => {
        if (allTests.length === 0) return [];
        
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0,0,0,0);
        
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        return categories.map(cat => {
            const catTests = allTests.filter(t => {
                if (cat.key === "shot") return t.type === "shot" || t.type === "driver" || t.type === "iron" || t.type === "wood_iron";
                if (cat.key === "around_green") return t.type === "around_green" || t.type === "approach" || t.type === "bunker" || t.type === "pitch";
                if (cat.key === "putting") return t.type === "putting" || t.type === "long_putt" || t.type === "middle_putt" || t.type === "short_putt";
                return false;
            });
            
            const weekly = catTests
                .filter(t => new Date(t.date) >= startOfWeek)
                .sort((a, b) => (a.totalScore || 0) - (b.totalScore || 0))[0];
                
            const monthly = catTests
                .filter(t => new Date(t.date) >= startOfMonth)
                .sort((a, b) => (a.totalScore || 0) - (b.totalScore || 0))[0];
                
            return {
                ...cat,
                weekly,
                monthly
            };
        });
    }, [allTests]);
    
    const todayCompletedTests = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        return allTests.filter(t => t.date === today);
    }, [allTests]);

    const todayBestSummary = useMemo(() => {
        const todayTests = todayCompletedTests;
        
        const getBest = (categories: string[]) => {
            const filtered = todayTests.filter(t => categories.includes(t.type));
            if (filtered.length === 0) return null;
            return Math.min(...filtered.map(t => t.totalScore || 0));
        };

        const shot = getBest(["shot", "driver", "iron", "wood_iron"]);
        const around = getBest(["around_green", "approach", "bunker", "pitch", "A/G"]);
        const putting = getBest(["putting", "long_putt", "middle_putt", "short_putt"]);
        
        const total = (shot ?? 0) + (around ?? 0) + (putting ?? 0);
        
        return { shot, around, putting, total, hasAny: shot !== null || around !== null || putting !== null };
    }, [todayCompletedTests]);

    const playerChips = useMemo(() => {
        const queryMatches = searchQuery
            ? allAthletes.filter((p) => p.toLowerCase().includes(searchQuery.toLowerCase()))
            : [];
        const selectedArr = selectAll ? [] : Array.from(selectedPlayers);
        return Array.from(new Set([...selectedArr, ...queryMatches]));
    }, [searchQuery, selectedPlayers, selectAll, allAthletes]);

    return (
        <div className="p-4 sm:p-8 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <ClipboardList size={24} className="text-brand-navy dark:text-brand-navy-light shrink-0" />
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                        Test
                    </h1>
                </div>
                {(userRole === 'coach' || userRole === 'admin') && (
                    <Link
                        href="/training/tests/create"
                        className="bg-brand-red hover:bg-brand-red-dark text-white px-5 py-2 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1.5 shrink-0"
                    >
                        <Plus size={18} />
                        작성
                    </Link>
                )}
            </div>

            {/* ── 🏆 Leaderboard (Hall of Fame) ── */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-4 px-1">
                    <div className="flex items-center gap-2">
                        <Trophy size={18} className="text-amber-500" />
                        <h2 className="text-lg font-black text-zinc-800 dark:text-zinc-100 tracking-tight">명예의 전당 (HALL OF FAME)</h2>
                    </div>
                    <Link 
                        href="/training/rankings"
                        className="px-3 py-1 bg-amber-500 text-[10px] font-bold text-white rounded-full hover:bg-amber-600 shadow-sm shadow-amber-500/20 transition-all active:scale-95 flex items-center gap-1"
                    >
                        전체 랭킹보기 <ChevronRight size={12} />
                    </Link>
                </div>
                
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-1 px-1">
                    {userRole === 'athlete' && (
                        <div className="sticky left-0 z-10 flex-shrink-0 w-64 bg-brand-navy dark:bg-zinc-900 border border-brand-navy dark:border-zinc-800 p-6 rounded-[2rem] shadow-xl text-white mr-2">
                            <div className="flex items-center gap-2 mb-4">
                                <Trophy size={18} className="text-amber-400" />
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Today's Personal Best</span>
                            </div>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-bold opacity-60">Shot</span>
                                    <span className="text-sm font-black italic">{todayBestSummary.shot !== null ? (todayBestSummary.shot > 0 ? `+${todayBestSummary.shot.toFixed(2)}` : todayBestSummary.shot.toFixed(2)) : "-"}</span>
                                </div>
                                <div className="h-[1px] bg-white/10 w-full" />
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-bold opacity-60">Around Green</span>
                                    <span className="text-sm font-black italic">{todayBestSummary.around !== null ? (todayBestSummary.around > 0 ? `+${todayBestSummary.around.toFixed(2)}` : todayBestSummary.around.toFixed(2)) : "-"}</span>
                                </div>
                                <div className="h-[1px] bg-white/10 w-full" />
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-bold opacity-60">Putting</span>
                                    <span className="text-sm font-black italic">{todayBestSummary.putting !== null ? (todayBestSummary.putting > 0 ? `+${todayBestSummary.putting.toFixed(2)}` : todayBestSummary.putting.toFixed(2)) : "-"}</span>
                                </div>
                                <div className="pt-2 mt-4 border-t border-white/20 flex justify-between items-center">
                                    <span className="text-xs font-black uppercase text-amber-400">Total Today</span>
                                    <span className="text-2xl font-black italic text-amber-400">
                                        {todayBestSummary.total > 0 ? `+${todayBestSummary.total.toFixed(2)}` : todayBestSummary.total.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                    {leaderboardData.map((data) => (
                        <button 
                            key={data.key} 
                            onClick={() => router.push(`/training/rankings?category=${data.key}`)}
                            className={cn(
                                "flex-shrink-0 w-64 rounded-[2rem] p-5 border shadow-lg transition-all hover:scale-[1.05] hover:shadow-xl active:scale-[0.98] text-left cursor-pointer group",
                                "bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800"
                            )}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className={cn("p-2 rounded-xl bg-gradient-to-br text-white shadow-md", data.color)}>
                                    {data.icon}
                                </div>
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{data.label}</span>
                            </div>

                            <div className="space-y-4">
                                {/* Weekly */}
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-zinc-400">이번 주 최고</span>
                                        <span className="text-[10px] font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-md">WEEKLY</span>
                                    </div>
                                    {data.weekly ? (
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{data.weekly.playerName}</span>
                                            <span className="text-sm font-black italic text-zinc-800 dark:text-zinc-200">
                                                {data.weekly.totalScore !== undefined ? (
                                                    data.weekly.totalScore > 0 ? `+${data.weekly.totalScore.toFixed(2)}` : data.weekly.totalScore.toFixed(2)
                                                ) : "0.00"}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-[11px] text-zinc-300 italic">데이터 없음</span>
                                    )}
                                </div>

                                <div className="h-[1px] bg-zinc-100 dark:bg-zinc-800 w-full" />

                                {/* Monthly */}
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-zinc-400">이번 달 최고</span>
                                        <span className="text-[10px] font-bold text-amber-500 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-md">MONTHLY</span>
                                    </div>
                                    {data.monthly ? (
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{data.monthly.playerName}</span>
                                            <span className="text-sm font-black italic text-zinc-800 dark:text-zinc-200">
                                                {data.monthly.totalScore !== undefined ? (
                                                    data.monthly.totalScore > 0 ? `+${data.monthly.totalScore.toFixed(2)}` : data.monthly.totalScore.toFixed(2)
                                                ) : "0.00"}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-[11px] text-zinc-300 italic">데이터 없음</span>
                                    )}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Filter Buttons ── */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
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

            {/* ── Today's Completed Tests ── */}
            <div className="mb-4">
                <div className="flex items-center justify-between mb-3 px-1">
                    <h2 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                        <Calendar size={16} className="text-brand-navy dark:text-brand-navy-light" />
                        오늘 완료한 테스트
                    </h2>
                    <span className="text-[10px] text-zinc-400 font-medium">등록된 테스트 결과를 확인하세요.</span>
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
                        {todayCompletedTests.length > 0 ? (
                            todayCompletedTests.map((t) => (
                                <button
                                    key={t.id}
                                    onClick={() => router.push(`/training/tests/${t.id}`)}
                                    className="flex-shrink-0 w-40 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3.5 rounded-2xl shadow-sm hover:border-brand-navy/50 hover:shadow-md transition-all active:scale-95 text-left"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="w-6 h-6 rounded-full bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-300 font-black italic text-[9px] border border-zinc-100 dark:border-zinc-700">
                                            {t.playerName[0]}
                                        </div>
                                        <span className="text-[9px] font-black text-brand-navy uppercase tracking-widest px-1.5 py-0.5 bg-brand-navy/5 rounded-md">
                                            {TEST_TYPE_LABELS[t.type] || t.type}
                                        </span>
                                    </div>
                                    <div className="text-sm font-bold text-zinc-900 dark:text-zinc-50 mb-1">
                                        {t.playerName}
                                    </div>
                                    <div className={cn(
                                        "text-lg font-black italic tracking-tighter",
                                        (t.totalScore || 0) > 0 ? "text-blue-600" : (t.totalScore || 0) < 0 ? "text-brand-red" : "text-zinc-400"
                                    )}>
                                        {(t.totalScore || 0) > 0 ? `+${t.totalScore?.toFixed(2)}` : t.totalScore?.toFixed(2)}
                                        <span className="text-[9px] uppercase ml-1 not-italic opacity-40 font-bold">pts</span>
                                    </div>
                                </button>
                            ))
                        ) : (
                            <div className="text-xs text-zinc-400 py-4 px-2 italic">오늘 완료된 테스트가 없습니다.</div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Filter & Search Section ── */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 mb-6">
                {/* Date range */}
                <div className="flex items-center gap-2">
                    <label className="w-24 shrink-0 text-center text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                        테스트 일자
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

                {/* Player search */}
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

                {/* Player Chips */}
                {playerChips.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                        {playerChips.map((name) => {
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

            {/* ── Results List ── */}
            <section>
                <div className="flex items-center justify-between mb-4 px-1">
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-200 tracking-tight">
                            조회 결과
                        </h2>
                        <span className="text-xs text-zinc-400 font-medium">
                            ({filteredTests.length}건)
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

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 shadow-sm overflow-hidden">
                    {isLoading ? (
                        <div className="py-20 flex flex-col items-center justify-center gap-3">
                            <div className="w-8 h-8 border-4 border-zinc-200 border-t-brand-navy rounded-full animate-spin"></div>
                            <p className="text-sm text-zinc-400 font-medium">데이터를 불러오는 중...</p>
                        </div>
                    ) : displayedTests.length > 0 ? (
                        <>
                            <TestTable tests={displayedTests} />
                            {filteredTests.length > displayLimit && (
                                <div className="mt-8 flex justify-center">
                                    <button
                                        onClick={() => setDisplayLimit(prev => prev + 20)}
                                        className="px-8 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all active:scale-95 shadow-sm"
                                    >
                                        더 보기 ({filteredTests.length - displayLimit}건 남음)
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
                            <ClipboardList size={40} strokeWidth={1} className="mb-3 opacity-20" />
                            <p className="text-sm font-medium">검색 결과가 없습니다.</p>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
