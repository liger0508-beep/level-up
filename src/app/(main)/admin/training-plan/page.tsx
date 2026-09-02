"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from 'next/link';
import {
    MessageSquare,
    Plus,
    Search,
    ChevronLeft,
    ChevronRight,
    SlidersHorizontal,
    Megaphone
} from "lucide-react";
import { Plan, PlanType, PLAN_TYPE_LABELS, getPlainText, PLAN_TYPE_COLORS, fetchPlans } from "@/lib/plan-sync";
import { PlanTable } from "@/components/training-plan/PlanTable";
import { cn, formatLocalDate } from "@/lib/utils";
import { DatePickerInput } from "@/components/ui/DatePickerInput";
import { DatePresets, DatePresetType } from "@/components/ui/DatePresets";
import { createClient } from "@/lib/supabase/client";

import { PageTitle, SectionTitle, LabelText } from "@/components/ui/Typography";

export default function TrainingPlanPage() {
    const [activeType, setActiveType] = useState<PlanType>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [displayLimit, setDisplayLimit] = useState(20);
    const [activePreset, setActivePreset] = useState<DatePresetType>("custom");
    const [allPlans, setAllPlans] = useState<Plan[]>([]);
    const [recentPlans, setRecentPlans] = useState<Plan[]>([]);
    const [totalPlanCount, setTotalPlanCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState<"list" | "content">("list");

    const [allAthletes, setAllAthletes] = useState<string[]>([]);
    const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());
    const [selectAll, setSelectAll] = useState(true);
    const [playerSearchQuery, setPlayerSearchQuery] = useState("");
    const [userRole, setUserRole] = useState("athlete");

    const scrollRef = useRef<HTMLDivElement>(null);

    const mapPlanRow = (item: any): Plan => ({
        id: item.id,
        type: (item.category as PlanType) || "good",
        title: item.title,
        content: item.content,
        date: item.training_start,
        author: (Array.isArray(item.coach) ? item.coach[0]?.name : item.coach?.name) || "알 수 없음",
        athleteName: (Array.isArray(item.user) ? item.user[0]?.name : item.user?.name) || "알 수 없음",
        isImportant: item.is_important || false,
        keywords: item.keywords || [],
        media_urls: item.media_urls || [],
        linkedLessonIds: (item.keywords || []).filter((k: string) => k.startsWith("lesson_id:")).map((k: string) => k.replace("lesson_id:", "")),
        parts: (item.keywords || []).filter((k: string) => k.startsWith("part:")).map((k: string) => k.replace("part:", "")),
        createdAt: item.inserted_at,
    });

    useEffect(() => {
        const loadInitial = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            let currentRole = "athlete";
            
            if (user) {
                const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
                if (profile) {
                    currentRole = profile.role || "athlete";
                    setUserRole(currentRole);
                }
            }

            // Fetch Athletes for filter
            if (['coach', 'admin', 'office', 'total', 'superadmin'].includes(currentRole)) {
                const { data: athletesData } = await supabase.from("users").select("name").eq("role", "athlete").order("name");
                if (athletesData) {
                    const athleteNames = athletesData.map(a => a.name);
                    setAllAthletes(athleteNames);
                    
                    let initialSelected = new Set(athleteNames);
                    let initialSelectAll = true;
                    
                    if (typeof window !== "undefined") {
                        const isFromDetail = sessionStorage.getItem("gla_plan_keep_alive") === "true";
                        if (isFromDetail) {
                            const stored = sessionStorage.getItem("gla_plan_filter");
                            if (stored) {
                                try {
                                    const parsed = JSON.parse(stored);
                                    if (parsed.activeType !== undefined) setActiveType(parsed.activeType);
                                    if (parsed.searchQuery !== undefined) setSearchQuery(parsed.searchQuery);
                                    if (parsed.startDate !== undefined) setStartDate(parsed.startDate);
                                    if (parsed.endDate !== undefined) setEndDate(parsed.endDate);
                                    if (parsed.activePreset !== undefined) setActivePreset(parsed.activePreset);
                                    if (parsed.displayLimit !== undefined) setDisplayLimit(parsed.displayLimit);
                                    if (parsed.viewMode !== undefined) setViewMode(parsed.viewMode);
                                    if (parsed.selectAll !== undefined) {
                                        initialSelectAll = parsed.selectAll;
                                        setSelectAll(parsed.selectAll);
                                    }
                                    if (initialSelectAll) {
                                        initialSelected = new Set(athleteNames);
                                    } else if (parsed.selectedPlayers) {
                                        initialSelected = new Set(parsed.selectedPlayers);
                                    }
                                } catch (e) { }
                            }
                            setTimeout(() => sessionStorage.removeItem("gla_plan_keep_alive"), 100);
                        } else {
                            sessionStorage.removeItem("gla_plan_filter");
                            sessionStorage.removeItem("gla_plan_scroll");
                        }
                    }
                    setSelectedPlayers(initialSelected);
                }
            }

            // Fetch Recent Plans (today's non-field plans)
            const todayStr = formatLocalDate();
            let recentQuery = supabase
                .from("records")
                .select(`
                    id, title, content, category, media_urls, training_start, is_important, keywords, inserted_at,
                    user:users!records_user_id_fkey(name),
                    coach:users!records_coach_id_fkey(name)
                `)
                .eq("type", "plan")
                .neq("category", "field")
                .eq("training_start", todayStr)
                .order("inserted_at", { ascending: false })
                .limit(4);
            
            if (currentRole === 'athlete' && user) {
                 recentQuery = recentQuery.eq("user_id", user.id);
            }
            const { data: recentData } = await recentQuery;
            if (recentData) setRecentPlans(recentData.map(mapPlanRow));
            
            if (currentRole === 'athlete') setIsLoading(false);
        };
        
        loadInitial();
    }, []);

    // Server-side Pagination & Filtering
    useEffect(() => {
        if (isLoading && ['coach', 'admin', 'office', 'total', 'superadmin'].includes(userRole) && allAthletes.length === 0) return; // Wait until athletes load

        const fetchFiltered = async () => {
            const supabase = createClient();
            let query = supabase
                .from("records")
                .select(`
                    id, title, content, category, media_urls, training_start, is_important, keywords, inserted_at,
                    user:users!records_user_id_fkey(id, name),
                    coach:users!records_coach_id_fkey(name)
                `, { count: 'exact' })
                .eq("type", "plan")
                .neq("category", "field");

            if (userRole === 'athlete') {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) query = query.eq("user_id", user.id);
            } else {
                if (!selectAll && selectedPlayers.size > 0) {
                    const { data: usersData } = await supabase.from("users").select("id").in("name", Array.from(selectedPlayers));
                    const userIds = usersData?.map(u => u.id) || [];
                    if (userIds.length > 0) query = query.in("user_id", userIds);
                    else query = query.eq("user_id", "00000000-0000-0000-0000-000000000000");
                } else if (!selectAll && selectedPlayers.size === 0) {
                    query = query.eq("user_id", "00000000-0000-0000-0000-000000000000");
                }
            }

            if (activeType !== "all") query = query.eq("category", activeType);
            if (startDate) query = query.gte("training_start", startDate);
            if (endDate) query = query.lte("training_start", endDate);

            if (searchQuery) {
                query = query.or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`);
            }

            query = query
                .order("training_start", { ascending: false })
                .order("inserted_at", { ascending: false })
                .limit(displayLimit);

            const { data, count, error } = await query;
            if (error || !data) return;

            setTotalPlanCount(count || 0);
            setAllPlans(data.map(mapPlanRow));
            setIsLoading(false);
        };

        const debounceTimer = setTimeout(() => {
            fetchFiltered();
        }, 300);
        return () => clearTimeout(debounceTimer);

    }, [userRole, activeType, searchQuery, startDate, endDate, selectAll, selectedPlayers, displayLimit, allAthletes.length, isLoading]);

    // Save filter state
    useEffect(() => {
        if (allAthletes.length === 0) return;
        sessionStorage.setItem("gla_plan_filter", JSON.stringify({
            activeType,
            searchQuery,
            startDate,
            endDate,
            activePreset,
            displayLimit,
            selectAll,
            selectedPlayers: Array.from(selectedPlayers)
        }));
    }, [activeType, searchQuery, startDate, endDate, activePreset, displayLimit, selectAll, selectedPlayers, allAthletes]);

    // Scroll state management
    useEffect(() => {
        if (typeof window !== "undefined" && !isLoading) {
            const savedScroll = sessionStorage.getItem("gla_plan_scroll");
            if (savedScroll) {
                setTimeout(() => {
                    window.scrollTo({ top: parseInt(savedScroll, 10), behavior: 'instant' });
                }, 100);
                sessionStorage.removeItem("gla_plan_scroll");
            }

            const handleScroll = () => {
                sessionStorage.setItem("gla_plan_scroll", window.scrollY.toString());
            };
            window.addEventListener("scroll", handleScroll);
            return () => window.removeEventListener("scroll", handleScroll);
        }
    }, [isLoading]);

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

        setPlayerSearchQuery("");
    };

    const visiblePlayersArr = useMemo(() => {
        const queryMatches = playerSearchQuery
            ? allAthletes.filter((p) => p.toLowerCase().includes(playerSearchQuery.toLowerCase()))
            : [];

        if (selectAll && !playerSearchQuery) return [];

        const selectedList = selectAll ? [] : Array.from(selectedPlayers);
        const combined = new Set([...selectedList, ...queryMatches]);
        return Array.from(combined);
    }, [playerSearchQuery, allAthletes, selectAll, selectedPlayers]);

    // Client side filtering is now replaced by server-side filtering

    return (
        <div className="p-4 sm:p-8 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <MessageSquare size={24} className="text-brand-navy dark:text-brand-navy-light shrink-0" />
                    <PageTitle>
                        훈련계획
                    </PageTitle>
                </div>
                <Link
                    href="/admin/training-plan/create"
                    className="bg-brand-red hover:bg-brand-red-dark text-white px-5 py-2 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1.5 shrink-0"
                >
                    <Plus size={18} />
                    작성
                </Link>
            </div>

            {/* ── Recent Plans (Top Carousel) ── */}
            <div className="mb-4">
                <div className="flex items-center justify-between mb-3 px-1">
                    <SectionTitle>
                        <Megaphone size={16} className="text-brand-navy dark:text-brand-navy-light" />
                        오늘 등록한 게시물
                    </SectionTitle>
                </div>

                <div className="relative group/scroll">
                    <button
                        onClick={() => scroll("left")}
                        className="absolute left-[-20px] top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full shadow-lg flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-brand-navy dark:hover:text-brand-navy-light transition-all opacity-0 group-hover/scroll:opacity-100 hidden md:flex"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <button
                        onClick={() => scroll("right")}
                        className="absolute right-[-20px] top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full shadow-lg flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-brand-navy dark:hover:text-brand-navy-light transition-all opacity-0 group-hover/scroll:opacity-100 hidden md:flex"
                    >
                        <ChevronRight size={20} />
                    </button>

                    <div
                        ref={scrollRef}
                        className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide -mx-1 px-1"
                    >
                        {recentPlans.map((plan) => (
                            <Link
                                key={plan.id}
                                href={`/admin/training-plan/${plan.id}`}
                                onClick={() => sessionStorage.setItem("gla_plan_keep_alive", "true")}
                                className="flex-shrink-0 w-64 md:w-72 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm hover:border-brand-navy/50 hover:shadow-md transition-all active:scale-95 cursor-pointer group"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className={cn(
                                        "text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider",
                                        PLAN_TYPE_COLORS[plan.type].bg,
                                        PLAN_TYPE_COLORS[plan.type].text
                                    )}>
                                        {PLAN_TYPE_LABELS[plan.type]}
                                    </span>
                                    {plan.isImportant && (
                                        <span className="text-[10px] font-black text-brand-red ml-auto uppercase italic">Important</span>
                                    )}
                                </div>
                                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-brand-navy dark:group-hover:text-brand-navy-light transition-colors line-clamp-1 mb-3 text-[15px]">
                                    {plan.author}
                                </h3>
                                <div className="text-[11px] text-zinc-400 font-medium flex items-center justify-end gap-2 mt-auto pt-2 border-t border-zinc-50 dark:border-zinc-800/50">
                                    <span>{plan.date.slice(5).replace(/-/g, ".")}</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Filter Bar ── */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 mb-6 shadow-sm">
                <div className="flex items-center gap-2">
                    <LabelText className="w-16 shrink-0 text-center">
                        일자
                    </LabelText>
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <DatePickerInput
                            value={startDate}
                            onClick={(e) => (e.target as any).showPicker?.()}
                            onChange={(e) => { setStartDate(e.target.value); setActivePreset("custom"); }}
                            className="flex-1 min-w-0 px-2 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-[13px] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all text-center cursor-pointer"
                        />
                        <span className="text-zinc-400 shrink-0 text-xs">~</span>
                        <DatePickerInput
                            value={endDate}
                            onClick={(e) => (e.target as any).showPicker?.()}
                            onChange={(e) => { setEndDate(e.target.value); setActivePreset("custom"); }}
                            className="flex-1 min-w-0 px-2 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-[13px] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all text-center cursor-pointer"
                        />
                    </div>
                    {(startDate || endDate) && (
                        <button
                            onClick={() => { setStartDate(""); setEndDate(""); setActivePreset(undefined as any); }}
                            className="shrink-0 px-2 text-xs font-bold text-zinc-400 hover:text-zinc-600 transition-colors"
                        >
                            초기화
                        </button>
                    )}
                </div>

                {['coach', 'admin', 'office', 'total', 'superadmin'].includes(userRole) ? (
                    <>
                        {/* ── Player Search ── */}
                        <div className="flex items-center gap-2 mt-3">
                            <LabelText className="w-16 shrink-0 text-center">
                                선수 검색
                            </LabelText>
                            <div className="relative flex-1">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                                <input
                                    type="text"
                                    placeholder="선수 검색..."
                                    value={playerSearchQuery}
                                    onChange={(e) => setPlayerSearchQuery(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && playerSearchQuery.trim()) {
                                            const match = allAthletes.find((p) =>
                                                p.toLowerCase().includes(playerSearchQuery.toLowerCase())
                                            );
                                            if (match) togglePlayer(match);
                                        }
                                    }}
                                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all"
                                />
                            </div>
                        </div>

                        {/* ── Player Chips ── */}
                        {visiblePlayersArr.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3 max-h-32 overflow-y-auto pr-1 custom-scrollbar" style={{ paddingLeft: '88px' }}>
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
                ) : (
                    <>
                        {/* ── Content Search ── */}
                        <div className="flex items-center gap-2 mt-3">
                            <LabelText className="w-16 shrink-0 text-center">
                                검색
                            </LabelText>
                            <div className="relative flex-1">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                                <input
                                    type="text"
                                    placeholder="제목 또는 내용 검색..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all"
                                />
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* ── Plan List section ── */}
            <section>
                <div className="flex items-center justify-between mb-4 px-1">
                    <div className="flex items-center gap-3">
                        <SectionTitle>
                            조회 결과
                        </SectionTitle>
                        <div className="flex items-center bg-white dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                            <button
                                onClick={() => setViewMode("list")}
                                className={cn(
                                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200",
                                    viewMode === "list"
                                        ? "bg-brand-navy text-white shadow-sm"
                                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100"
                                )}
                            >
                                리스트
                            </button>
                            <button
                                onClick={() => setViewMode("content")}
                                className={cn(
                                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200",
                                    viewMode === "content"
                                        ? "bg-brand-navy text-white shadow-sm"
                                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100"
                                )}
                            >
                                내용
                            </button>
                        </div>
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

                <div className="md:bg-white md:dark:bg-zinc-900 md:border md:border-zinc-200 md:dark:border-zinc-800 md:rounded-2xl md:p-5 md:shadow-sm md:overflow-hidden min-h-[300px] mt-2">
                    {allPlans.length > 0 ? (
                        <>
                            <PlanTable plans={allPlans} viewMode={viewMode} />
                            {totalPlanCount > allPlans.length && (
                                <div className="mt-8 flex justify-center">
                                    <button
                                        onClick={() => setDisplayLimit(prev => prev + 20)}
                                        className="px-8 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all active:scale-95 shadow-sm"
                                    >
                                        더 보기 ({totalPlanCount - allPlans.length}건 남음)
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
                            <Megaphone size={40} className="mb-4 text-zinc-200" />
                            <p className="text-sm font-medium">검색 결과가 없습니다.</p>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
