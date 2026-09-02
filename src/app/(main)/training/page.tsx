"use client";

import { useState, useMemo, useEffect } from "react";
import Link from 'next/link';
import { TrainingData, TrainingType } from "@/components/training/TrainingCard";
import { TrainingTable } from "@/components/training/TrainingTable";
import { fetchTrainingRecords, TrainingRecord } from "@/lib/training-sync";
import { Dumbbell, Plus, Search, Calendar, ChevronLeft, ChevronRight, TrendingUp, ClipboardList, CheckCircle2 } from "lucide-react";
import { CategoryTabs } from "@/components/ui/CategoryTabs";
import { DatePickerInput } from "@/components/ui/DatePickerInput";
import { fetchAthletes } from "@/lib/athlete-sync";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useRef } from "react";
import { DatePresets, DatePresetType } from "@/components/ui/DatePresets";
import { PageTitle, SectionTitle, LabelText } from "@/components/ui/Typography";

// ── Mock data ────────────────────────────────────────────────
const mockTrainings: TrainingData[] = [
    {
        id: "1",
        type: "basic",
        title: "[기본기] 드라이버 스윙 교정 훈련",
        playerName: "김민수",
        coachName: "박코치",
        comment:
            "오늘 드라이버 스윙에서 백스윙 시 왼쪽 팔이 과하게 접히는 문제를 집중적으로 교정했습니다. 하프스윙 드릴을 활용하여 팔의 연결감을 유지하는 연습을 진행했고, 후반부에는 눈에 띄는 개선이 있었습니다. 꾸준한 반복 연습이 필요합니다.",
        date: "2026-03-07",
    },
    {
        id: "2",
        type: "preview",
        title: "[예습] 퍼팅 거리감 훈련",
        playerName: "이수진",
        coachName: "박코치",
        comment:
            "3m ~ 5m 거리의 퍼팅 거리감 훈련을 실시했습니다. 임팩트 시 손목 움직임을 최소화하는 것이 포인트이며, 반복 연습 후 거리 편차가 줄어드는 것을 확인했습니다.",
        date: "2026-03-06",
    },
    {
        id: "3",
        type: "review",
        title: "[복습] 코어 안정성 트레이닝",
        playerName: "박현우",
        coachName: "김피지컬코치",
        comment:
            "골프 스윙 시 필요한 코어 안정성을 위한 기초 트레이닝을 진행했습니다. 플랭크, 데드버그, 힙 브릿지 위주로 구성했으며 특히 회전 안정성에 집중했습니다. 주 3회 꾸준한 반복이 권장됩니다.",
        date: "2026-03-05",
    },
    {
        id: "4",
        type: "basic",
        title: "[기본기] 아이언 임팩트 훈련",
        playerName: "정세민",
        coachName: "박코치",
        comment:
            "7번 아이언 기준으로 다운블로우 임팩트를 만들기 위한 드릴을 진행했습니다. 체중 이동 타이밍이 잡히기 시작했습니다.",
        date: "2026-03-04",
    },
    {
        id: "5",
        type: "review",
        title: "[복습] 벙커 탈출 기초 훈련",
        playerName: "김민수",
        coachName: "박코치",
        comment:
            "그린사이드 벙커에서 기본 탈출 기술을 연습했습니다. 오픈 스탠스와 바운스 활용에 대해 집중 지도하였고, 반복을 통해 성공률이 향상되었습니다.",
        date: "2026-03-03",
    },
];

// ── Filter categories ────────────────────────────────────────
type FilterType = "all" | TrainingType | "lesson_review" | "swing_pose";

const filterButtons: { key: FilterType; label: string }[] = [
    { key: "all", label: "전체" },
    { key: "preview", label: "예습" },
    { key: "review", label: "복습" },
    { key: "lesson_review", label: "스윙키" },
];

// ── Unique player list (from data) ───────────────────────────
// allPlayers shifted to component state

// ── Page component ───────────────────────────────────────────
export default function TrainingsPage() {
    const [trainings, setTrainings] = useState<TrainingRecord[]>([]);
    const [totalTrainingCount, setTotalTrainingCount] = useState(0);
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
            const [athletes, { data: { user } }] = await Promise.all([
                fetchAthletes(),
                supabase.auth.getUser()
            ]);
            setAllAthletes(athletes);

            try {
                const isFromDetail = sessionStorage.getItem("gla_training_keep_alive") === "true";
                if (isFromDetail) {
                    const stored = sessionStorage.getItem("gla_training_filter");
                    if (stored) {
                        const parsed = JSON.parse(stored);
                        if (parsed.activeFilter) setActiveFilter(parsed.activeFilter);
                        if (parsed.searchQuery !== undefined) setSearchQuery(parsed.searchQuery);
                        if (parsed.startDate !== undefined) setStartDate(parsed.startDate);
                        if (parsed.endDate !== undefined) setEndDate(parsed.endDate);
                        if (parsed.activePreset) setActivePreset(parsed.activePreset);
                        if (parsed.selectAll !== undefined) setSelectAll(parsed.selectAll);

                        if (parsed.selectAll) {
                            setSelectedPlayers(new Set(athletes));
                        } else if (parsed.selectedPlayers) {
                            setSelectedPlayers(new Set(parsed.selectedPlayers));
                        } else {
                            setSelectedPlayers(new Set(athletes));
                        }
                    } else {
                        if (selectedPlayers.size === 0 && !searchQuery) {
                            setSelectedPlayers(new Set(athletes));
                        }
                    }
                    setTimeout(() => {
                        sessionStorage.removeItem("gla_training_keep_alive");
                    }, 100);
                } else {
                    sessionStorage.removeItem("gla_training_filter");
                    sessionStorage.removeItem("gla_training_scroll");
                    if (selectedPlayers.size === 0 && !searchQuery) {
                        setSelectedPlayers(new Set(athletes));
                    }
                }
            } catch (e) {
                console.warn("Failed to restore training filter", e);
                if (selectedPlayers.size === 0 && !searchQuery) {
                    setSelectedPlayers(new Set(athletes));
                }
            }

            // setTrainings(records); - Removed for server-side pagination

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

                const completedFromRecords: any[] = [];
                setTodaySchedule([...formattedSchedules, ...completedFromRecords]);
            }
        } catch (error) {
            console.error("Failed to load data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadInitialData();
    }, []);

    // New useEffect for Server-side Pagination
    useEffect(() => {
        if (isLoading) return; // Wait until initial setup is done

        const fetchFilteredTrainings = async () => {
            const supabase = createClient();
            let query = supabase
                .from("records")
                .select(`
                    id, type, category, title, content, media_urls, created_at, training_start, training_end, completion_logs, template_settings, total_count, user_id,
                    users!records_user_id_fkey(name),
                    coach:users!records_coach_id_fkey(name)
                `, { count: 'exact' })
                .eq("type", "training");

            if (activeFilter !== "all") {
                query = query.eq("category", activeFilter);
            }
            if (startDate) {
                query = query.gte("created_at", startDate);
            }
            if (endDate) {
                query = query.lte("created_at", endDate + " 23:59:59");
            }
            if (!selectAll && selectedPlayers.size > 0) {
                const { data: usersData } = await supabase.from("users").select("id").in("name", Array.from(selectedPlayers));
                const userIds = usersData?.map(u => u.id) || [];
                if (userIds.length > 0) {
                    query = query.in("user_id", userIds);
                } else {
                    query = query.eq("user_id", "00000000-0000-0000-0000-000000000000"); // return nothing
                }
            }

            query = query.order("inserted_at", { ascending: false }).limit(displayLimit);

            const { data: trainingsData, error: trainingsError, count } = await query;
            if (trainingsError || !trainingsData) return;

            setTotalTrainingCount(count || 0);

            const mappedData = trainingsData.map((r: any) => {
                let mappedType = r.category;
                if (!["basic", "preview", "review", "lesson_review", "swing_pose"].includes(r.category)) {
                    if (r.title?.includes("[예습]")) mappedType = "preview";
                    else if (r.title?.includes("[복습]")) mappedType = "review";
                    else mappedType = "basic";
                }
                return {
                    id: r.id,
                    type: mappedType,
                    title: r.title,
                    content: r.content,
                    media_urls: r.media_urls,
                    created_at: r.created_at,
                    date: r.created_at.split("T")[0],
                    training_start: r.training_start,
                    training_end: r.training_end,
                    completion_logs: r.completion_logs,
                    template_settings: r.template_settings,
                    total_count: r.total_count,
                    playerName: r.users?.name || "알 수 없음",
                    coachName: r.coach?.name || "알 수 없음",
                    user_id: r.user_id
                };
            });

            setTrainings(mappedData);
        };

        fetchFilteredTrainings();
    }, [isLoading, activeFilter, startDate, endDate, selectAll, selectedPlayers, displayLimit]);

    // Scroll state management
    useEffect(() => {
        if (typeof window !== "undefined" && !isLoading) {
            const savedScroll = sessionStorage.getItem("gla_training_scroll");
            if (savedScroll) {
                setTimeout(() => {
                    window.scrollTo({ top: parseInt(savedScroll, 10), behavior: 'instant' });
                }, 100);
                sessionStorage.removeItem("gla_training_scroll");
            }

            const handleScroll = () => {
                sessionStorage.setItem("gla_training_scroll", window.scrollY.toString());
            };
            window.addEventListener("scroll", handleScroll);
            return () => window.removeEventListener("scroll", handleScroll);
        }
    }, [isLoading]);

    // Save filter state to sessionStorage whenever it changes
    useEffect(() => {
        if (allAthletes.length === 0) return;

        try {
            sessionStorage.setItem("gla_training_filter", JSON.stringify({
                activeFilter,
                searchQuery,
                selectAll,
                selectedPlayers: Array.from(selectedPlayers),
                startDate,
                endDate,
                activePreset
            }));
        } catch (e) {
            console.warn("Failed to save training filter", e);
        }
    }, [activeFilter, searchQuery, selectAll, selectedPlayers, startDate, endDate, activePreset, allAthletes]);

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
                    <PageTitle>Training</PageTitle>
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

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 mb-6">
                {/* Date Range: 훈련일자 */}
                <div className="flex items-center gap-2">
                    <LabelText className="w-24 shrink-0 text-center">
                        훈련 일자
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
                {(userRole === 'coach' || userRole === 'admin') && (
                    <>
                        <div className="flex items-center gap-2 mt-3">
                            <LabelText className="w-24 shrink-0 text-center">
                                선수 검색
                            </LabelText>
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

            {/* ── Training List ── */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-8 h-8 border-4 border-brand-navy border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-zinc-500 text-sm">훈련 기록을 불러오는 중...</p>
                </div>
            ) : trainings.length > 0 ? (
                <>
                    <div className="space-y-4 mb-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <SectionTitle>조회 결과</SectionTitle>
                                <span className="text-xs text-zinc-400">
                                    ({totalTrainingCount}건)
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
                    <div className="mt-2">
                        {trainings.length > 0 ? (
                            <>
                                <TrainingTable trainings={trainings} totalCount={totalTrainingCount} onUpdate={loadInitialData} basePath="/training" />
                                {totalTrainingCount > trainings.length && (
                                    <div className="mt-6 flex justify-center">
                                        <button
                                            onClick={() => setDisplayLimit(prev => prev + 20)}
                                            className="px-6 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all active:scale-95"
                                        >
                                            더 보기 ({totalTrainingCount - trainings.length}건 남음)
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