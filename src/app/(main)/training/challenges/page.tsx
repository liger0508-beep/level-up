"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from 'next/link';
import { useRouter } from "next/navigation";
import { TestData, TestType, mockTests, mockTodayTests, TEST_TYPE_LABELS, fetchTestsByPlayer, TestRecord } from "@/lib/test-sync";
import { TestTable } from "@/components/training/TestTable";
import { ClipboardList, Plus, Search, Calendar, ChevronLeft, ChevronRight, Trophy, Medal, Crown } from "lucide-react";
import { CategoryTabs } from "@/components/ui/CategoryTabs";
import { getTodayScheduledItems } from "@/lib/schedule-sync";
import { DatePickerInput } from "@/components/ui/DatePickerInput";
import { createClient } from "@/lib/supabase/client";
import { DatePresets, DatePresetType } from "@/components/ui/DatePresets";
import { cn, formatScore } from "@/lib/utils";

import { PageTitle, SectionTitle, LabelText } from "@/components/ui/Typography";

// ── Filter categories ────────────────────────────────────────
type FilterType = "all" | "shot" | "short_game" | "putting";

const filterButtons: { key: FilterType; label: string }[] = [
    { key: "all", label: "ALL" },
    { key: "shot", label: "샷" },
    { key: "short_game", label: "숏게임" },
    { key: "putting", label: "퍼팅" },
];

const categories = [
    { key: "shot", label: "샷", color: "from-amber-400 to-orange-500", icon: <Trophy size={18} /> },
    { key: "short_game", label: "숏게임", color: "from-emerald-400 to-teal-500", icon: <Medal size={18} /> },
    { key: "putting", label: "퍼팅", color: "from-violet-400 to-fuchsia-500", icon: <Crown size={18} /> }
];

export default function ChallengesPage() {
    const router = useRouter();
    const [allTests, setAllTests] = useState<TestData[]>([]);
    const [totalTestCount, setTotalTestCount] = useState(0);
    const [leaderboardRecords, setLeaderboardRecords] = useState<any[]>([]);
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
    const [userName, setUserName] = useState<string>("");

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
                setUserName(profile.name);

                // Fetch LEAN data for leaderboard (no raw_shot_data)
                const { data: leanData } = await supabase
                    .from("test_sessions")
                    .select(`
                        id,
                        category,
                        total_score,
                        created_at,
                        athlete:users!test_sessions_user_id_fkey(name)
                    `)
                    .order("inserted_at", { ascending: false });

                if (leanData) {
                    const mappedLean = leanData.map((r: any) => ({
                        type: r.category,
                        playerName: r.athlete?.name || "Unknown",
                        date: r.created_at ? new Date(r.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }) : "",
                        totalScore: r.total_score || 0
                    }));
                    setLeaderboardRecords(mappedLean);
                }

                // Athletes for chips
                const { data: athletesData } = await supabase.from("users").select("name").eq("role", "athlete");
                if (athletesData) {
                    const players = athletesData.map((a: any) => a.name);
                    setAllAthletes(players);
                    setSelectedPlayers(new Set(players));
                    setSelectAll(true);
                }

            } catch (err) {
                console.error("Error loading tests:", err);
            } finally {
                setIsLoading(false);
            }
        };

        loadInitialData();
    }, []);

    // New useEffect for Server-side Pagination
    useEffect(() => {
        if (isLoading || !userRole) return;

        const fetchFilteredTests = async () => {
            const supabase = createClient();
            let query = supabase
                .from("test_sessions")
                .select(`
                    id, category, title, raw_shot_data, total_score, created_at,
                    athlete:users!test_sessions_user_id_fkey(name),
                    coach:users!test_sessions_coach_id_fkey(name)
                `, { count: 'exact' });

            if (activeFilter !== "all") {
                if (activeFilter === "shot") {
                    query = query.in("category", ["shot", "driver", "iron", "wood_iron"]);
                } else if (activeFilter === "short_game") {
                    query = query.in("category", ["around_green", "short_game", "approach", "bunker", "pitch", "A/G"]);
                } else if (activeFilter === "putting") {
                    query = query.in("category", ["putting", "long_putt", "middle_putt", "short_putt"]);
                }
            }
            if (startDate) {
                query = query.gte("created_at", startDate);
            }
            if (endDate) {
                query = query.lte("created_at", endDate + " 23:59:59");
            }

            if ((userRole === 'coach' || userRole === 'admin') && !selectAll && selectedPlayers.size > 0) {
                const { data: usersData } = await supabase.from("users").select("id").in("name", Array.from(selectedPlayers));
                const userIds = usersData?.map(u => u.id) || [];
                if (userIds.length > 0) {
                    query = query.in("user_id", userIds);
                } else {
                    query = query.eq("user_id", "00000000-0000-0000-0000-000000000000");
                }
            } else if (userRole === 'athlete') {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    query = query.eq("user_id", user.id);
                }
            }

            query = query.order("inserted_at", { ascending: false }).limit(displayLimit);

            const { data, count, error } = await query;
            if (error || !data) return;

            setTotalTestCount(count || 0);

            const mapped: TestData[] = data.map((r: any) => {
                const parsedContent = typeof r.raw_shot_data === 'string' ? JSON.parse(r.raw_shot_data) : r.raw_shot_data;
                const displayScore = r.total_score !== undefined && r.total_score !== null ? r.total_score : (parsedContent?.totalScore || 0);
                return {
                    id: r.id,
                    type: r.category,
                    title: r.title,
                    playerName: r.athlete?.name || "Unknown",
                    coachName: r.coach?.name || "Unknown",
                    comment: displayScore !== undefined ? `점수: ${Number(displayScore).toFixed(2)}` : "",
                    date: r.created_at ? new Date(r.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }) : "",
                    totalScore: Number(displayScore)
                };
            });

            setAllTests(mapped);
        };

        fetchFilteredTests();
    }, [isLoading, activeFilter, startDate, endDate, selectAll, selectedPlayers, displayLimit, userRole]);

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

    // Client side filtering is now replaced by server-side filtering

    const leaderboardData = useMemo(() => {
        if (leaderboardRecords.length === 0) return [];

        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        return categories.map(cat => {
            const catTests = leaderboardRecords.filter(t => {
                if (cat.key === "shot") return t.type === "shot" || t.type === "driver" || t.type === "iron" || t.type === "wood_iron";
                if (cat.key === "short_game") return t.type === "around_green" || t.type === "short_game" || t.type === "approach" || t.type === "bunker" || t.type === "pitch";
                if (cat.key === "putting") return t.type === "putting" || t.type === "long_putt" || t.type === "middle_putt" || t.type === "short_putt";
                if (cat.key === "physical") return t.type === "physical";
                if (cat.key === "etc") return t.type === "etc";
                return false;
            });

            const weekly = catTests
                .filter(t => new Date(t.date) >= startOfWeek)
                .sort((a, b) => (a.totalScore || 0) - (b.totalScore || 0))[0];

            const monthly = catTests
                .filter(t => new Date(t.date) >= startOfMonth)
                .sort((a, b) => (a.totalScore || 0) - (b.totalScore || 0))[0];

            const myRecord = catTests
                .filter(t => t.playerName === userName)
                .sort((a, b) => (a.totalScore || 0) - (b.totalScore || 0))[0];

            return {
                ...cat,
                weekly,
                monthly,
                myRecord
            };
        });
    }, [leaderboardRecords, userName]);

    const todayCompletedTests = useMemo(() => {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const today = `${yyyy}-${mm}-${dd}`;
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
                    <PageTitle>
                        Challenge
                    </PageTitle>
                </div>
                {(userRole === 'coach' || userRole === 'admin' || userRole === 'athlete') && (
                    <Link
                        href="/training/challenges/create"
                        className="bg-brand-red hover:bg-brand-red-dark text-white px-5 py-2 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1.5 shrink-0"
                    >
                        <Plus size={18} />
                        작성
                    </Link>
                )}
            </div>

            {/* ── 🏆 Leaderboard (Hall of Fame) ── */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-4 px-1">
                    <div className="flex items-center gap-2 min-w-0">
                        <Trophy size={18} className="text-amber-500 shrink-0" />
                        <SectionTitle>
                            명예의 전당 <span className="hidden xs:inline">(HALL OF FAME)</span>
                        </SectionTitle>
                    </div>
                    <Link
                        href="/training/rankings"
                        className="px-2.5 sm:px-3 py-1 bg-amber-500 text-[10px] font-bold text-white rounded-full hover:bg-amber-600 shadow-sm shadow-amber-500/20 transition-all active:scale-95 flex items-center gap-1 shrink-0 whitespace-nowrap"
                    >
                        전체 랭킹보기 <ChevronRight size={12} />
                    </Link>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:gap-4 pb-4 -mx-1 px-1">
                    {leaderboardData.map((data) => (
                        <button
                            key={data.key}
                            onClick={() => router.push(`/training/rankings?category=${data.key}`)}
                            className={cn(
                                "rounded-2xl sm:rounded-[1.5rem] p-3 sm:p-4 border shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] text-left cursor-pointer group flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6",
                                "bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800"
                            )}
                        >
                            <div className="flex items-center gap-2 sm:w-32 shrink-0 mb-3 sm:mb-0">
                                <div className={cn("p-1.5 sm:p-2 rounded-xl bg-gradient-to-br text-white shadow-md shrink-0", data.color)}>
                                    {data.icon}
                                </div>
                                <span className="text-[13px] sm:text-sm font-black text-zinc-400 uppercase tracking-widest">{data.label}</span>
                            </div>

                            <div className="flex flex-col w-full flex-1 gap-1.5 sm:gap-2">
                                {/* Monthly */}
                                <div className="flex items-center justify-between gap-2 bg-zinc-50/50 dark:bg-zinc-800/30 px-3 py-1.5 sm:py-2 rounded-lg">
                                    <span className="text-[11px] sm:text-[12px] font-bold text-zinc-500 dark:text-zinc-400 shrink-0 w-[64px] sm:w-[72px]">이번 달 1위</span>
                                    {data.monthly ? (
                                        <div className="flex items-center justify-end flex-1 gap-2 min-w-0">
                                            <span className="text-[11px] sm:text-[13px] font-bold text-zinc-800 dark:text-zinc-100 truncate text-right">{data.monthly.playerName}</span>
                                            <span className={cn(
                                                "text-[12px] sm:text-[14px] font-black italic shrink-0 w-[42px] sm:w-[48px] text-right",
                                                data.monthly.totalScore! < 0 ? "text-brand-red" : data.monthly.totalScore! > 0 ? "text-blue-600" : "text-zinc-900 dark:text-zinc-50"
                                            )}>
                                                {data.monthly.totalScore !== undefined ? formatScore(data.monthly.totalScore) : "0.0"}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-[10px] sm:text-[11px] text-zinc-400 italic text-right flex-1">데이터 없음</span>
                                    )}
                                </div>

                                {/* Weekly */}
                                <div className="flex items-center justify-between gap-2 bg-zinc-50/50 dark:bg-zinc-800/30 px-3 py-1.5 sm:py-2 rounded-lg">
                                    <span className="text-[11px] sm:text-[12px] font-bold text-zinc-500 dark:text-zinc-400 shrink-0 w-[64px] sm:w-[72px]">이번 주 1위</span>
                                    {data.weekly ? (
                                        <div className="flex items-center justify-end flex-1 gap-2 min-w-0">
                                            <span className="text-[11px] sm:text-[13px] font-bold text-zinc-800 dark:text-zinc-100 truncate text-right">{data.weekly.playerName}</span>
                                            <span className={cn(
                                                "text-[12px] sm:text-[14px] font-black italic shrink-0 w-[42px] sm:w-[48px] text-right",
                                                data.weekly.totalScore! < 0 ? "text-brand-red" : data.weekly.totalScore! > 0 ? "text-blue-600" : "text-zinc-900 dark:text-zinc-50"
                                            )}>
                                                {data.weekly.totalScore !== undefined ? formatScore(data.weekly.totalScore) : "0.0"}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-[10px] sm:text-[11px] text-zinc-400 italic text-right flex-1">데이터 없음</span>
                                    )}
                                </div>

                                {/* My Record */}
                                <div className="flex items-center justify-between gap-2 bg-zinc-50/50 dark:bg-zinc-800/30 px-3 py-1.5 sm:py-2 rounded-lg">
                                    <span className="text-[11px] sm:text-[12px] font-bold text-zinc-500 dark:text-zinc-400 shrink-0 w-[64px] sm:w-[72px]">내 기록</span>
                                    {data.myRecord ? (
                                        <div className="flex items-center justify-end flex-1 gap-2 min-w-0">
                                            <span className="text-[11px] sm:text-[13px] font-bold text-zinc-800 dark:text-zinc-100 truncate text-right">{data.myRecord.playerName}</span>
                                            <span className={cn(
                                                "text-[12px] sm:text-[14px] font-black italic shrink-0 w-[42px] sm:w-[48px] text-right",
                                                data.myRecord.totalScore! < 0 ? "text-brand-red" : data.myRecord.totalScore! > 0 ? "text-blue-600" : "text-zinc-900 dark:text-zinc-50"
                                            )}>
                                                {data.myRecord.totalScore !== undefined ? formatScore(data.myRecord.totalScore) : "0.0"}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-[10px] sm:text-[11px] text-zinc-400 italic text-right flex-1">기록 없음</span>
                                    )}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Filter Buttons ── */}
            <CategoryTabs options={filterButtons} value={activeFilter} onChange={setActiveFilter} />



            {/* ── Filter & Search Section ── */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 mb-6">
                {/* Date range */}
                <div className="flex items-center gap-2">
                    <LabelText>
                        챌린지 일자
                    </LabelText>
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

                {/* Player Search & Select All */}
                {(userRole === 'coach' || userRole === 'admin') && (
                    <>
                        <div className="flex items-center gap-2 mt-3">
                            <LabelText>
                                선수 검색
                            </LabelText>
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
                            <div className="flex flex-wrap gap-2 mt-3 max-h-32 overflow-y-auto pr-1 custom-scrollbar" style={{ paddingLeft: '104px' }}>
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
                    </>
                )}
            </div>

            {/* ── Results List ── */}
            <section>
                <div className="flex items-center justify-between mb-4 px-1">
                    <div className="flex items-center gap-2">
                        <SectionTitle>
                            조회 결과
                        </SectionTitle>
                        <span className="text-xs text-zinc-400 font-medium">
                            ({totalTestCount}건)
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

                <div className="overflow-hidden">
                    {isLoading ? (
                        <div className="py-20 flex flex-col items-center justify-center gap-3">
                            <div className="w-8 h-8 border-4 border-zinc-200 border-t-brand-navy rounded-full animate-spin"></div>
                            <p className="text-sm text-zinc-400 font-medium">데이터를 불러오는 중...</p>
                        </div>
                    ) : allTests.length > 0 ? (
                        <>
                            <TestTable tests={allTests} totalCount={totalTestCount} basePath="/training/challenges" />
                            {totalTestCount > allTests.length && (
                                <div className="mt-8 flex justify-center">
                                    <button
                                        onClick={() => setDisplayLimit(prev => prev + 20)}
                                        className="px-8 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 text-sm font-bold text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all active:scale-95 shadow-sm"
                                    >
                                        더 보기 ({totalTestCount - allTests.length}건 남음)
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