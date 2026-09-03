"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from 'next/link';
import { LessonData, LessonType } from "@/components/lesson/LessonCard";
import { LessonTable } from "@/components/lesson/LessonTable";
import { BookOpen, Plus, Search, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { CategoryTabs } from "@/components/ui/CategoryTabs";
import { PlayerLessonHistoryModal } from "@/components/lesson/PlayerLessonHistoryModal";
import { getTodayScheduledItems } from "@/lib/schedule-sync";
import { DatePickerInput } from "@/components/ui/DatePickerInput";
import { fetchAthletes } from "@/lib/athlete-sync";
import { createClient } from "@/lib/supabase/client";
import { DatePresets, DatePresetType } from "@/components/ui/DatePresets";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { PageTitle, SectionTitle, LabelText } from "@/components/ui/Typography";

// ── Mock data ────────────────────────────────────────────────
const mockLessons: LessonData[] = [
    {
        id: "1",
        type: "shot",
        title: "드라이버 스윙 교정",
        playerName: "김민수",
        coachName: "박코치",
        comment:
            "오늘 드라이버 스윙에서 백스윙 시 왼쪽 팔이 과하게 접히는 문제를 집중적으로 교정했습니다. 하프스윙 드릴을 활용하여 팔의 연결감을 유지하는 연습을 진행했고, 후반부에는 눈에 띄는 개선이 있었습니다. 꾸준한 반복 연습이 필요합니다.",
        date: "2026-03-07",
    },
    {
        id: "2",
        type: "putt",
        title: "퍼팅 거리감 훈련",
        playerName: "이수진",
        coachName: "박코치",
        comment:
            "3m ~ 5m 거리의 퍼팅 거리감 훈련을 실시했습니다. 임팩트 시 손목 움직임을 최소화하는 것이 포인트이며, 반복 연습 후 거리 편차가 줄어드는 것을 확인했습니다.",
        date: "2026-03-06",
    },
    {
        id: "3",
        type: "physical",
        title: "코어 안정성 트레이닝",
        playerName: "박현우",
        coachName: "김피지컬코치",
        comment:
            "골프 스윙 시 필요한 코어 안정성을 위한 기초 트레이닝을 진행했습니다. 플랭크, 데드버그, 힙 브릿지 위주로 구성했으며 특히 회전 안정성에 집중했습니다. 주 3회 꾸준한 반복이 권장됩니다.",
        date: "2026-03-05",
    },
    {
        id: "4",
        type: "shot",
        title: "아이언 임팩트 개선",
        playerName: "정세민",
        coachName: "박코치",
        comment:
            "7번 아이언 기준으로 다운블로우 임팩트를 만들기 위한 드릴을 진행했습니다. 체중 이동 타이밍이 잡히기 시작했습니다.",
        date: "2026-03-04",
    },
    {
        id: "5",
        type: "bunker",
        title: "벙커 탈출 기초",
        playerName: "김민수",
        coachName: "박코치",
        comment:
            "그린사이드 벙커에서 기본 탈출 기술을 연습했습니다. 오픈 스탠스와 바운스 활용에 대해 집중 지도하였고, 반복을 통해 성공률이 향상되었습니다.",
        date: "2026-03-03",
    },
    {
        id: "6",
        type: "physical",
        title: "유연성 & 가동 범위 평가",
        playerName: "이수진",
        coachName: "김피지컬코치",
        comment:
            "선수의 어깨, 고관절 가동범위를 측정하고 유연성 프로그램을 설계했습니다. 고관절 내회전이 제한적이어서 추가 스트레칭을 권장합니다.",
        date: "2026-03-02",
    },
    {
        id: "7",
        type: "field",
        title: "실전 코스 매니지먼트",
        playerName: "최민준",
        coachName: "박코스명장",
        date: "2026-03-01",
        comment: "18홀 동반 필드 레슨을 진행했습니다. 에이밍과 거리 계산 등 실전 매니지먼트에 집중했으며, 바람 계산 요령을 추가로 지도했습니다.",
    },
];

const mockTodaySchedule = [
    { id: "s1", playerName: "김민수", time: "14:00~15:00", type: "shot" as LessonType },
    { id: "s2", playerName: "이지원", time: "15:30~16:30", type: "approach" as LessonType },
    { id: "s3", playerName: "박현우", time: "17:00~18:00", type: "physical" as LessonType },
    { id: "s4", playerName: "최민준", time: "09:30~11:00", type: "field" as LessonType },
    { id: "s5", playerName: "정세민", time: "11:30~12:30", type: "shot" as LessonType },
];

// ── Filter categories ────────────────────────────────────────
type FilterType = "all" | LessonType;

const filterButtons: { key: FilterType; label: string }[] = [
    { key: "all", label: "ALL" },
    { key: "shot", label: "Shot" },
    { key: "pitch", label: "Pitch" },
    { key: "bunker", label: "Bunker" },
    { key: "approach", label: "Approach" },
    { key: "putt", label: "Putt" },
    { key: "physical", label: "Physical" },
    { key: "field", label: "Field" },
    { key: "etc", label: "Etc" },
];

// mockPlayers/allPlayers shifted to component state

// ── Page component ───────────────────────────────────────────
export default function LessonsPage() {
    const [activeFilter, setActiveFilter] = useState<FilterType>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectAll, setSelectAll] = useState(true);
    const [todaySchedule, setTodaySchedule] = useState<any[]>([]);
    const [allAthletes, setAllAthletes] = useState<string[]>([]);
    const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());
    const [activePreset, setActivePreset] = useState<DatePresetType | undefined>(undefined);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [displayLimit, setDisplayLimit] = useState(20);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState<"list" | "content">("list");
    const [isPlayerHistoryModalOpen, setIsPlayerHistoryModalOpen] = useState(false);
    const [totalLessonCount, setTotalLessonCount] = useState(0);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = sessionStorage.getItem('openPlayerLessonHistoryModal');
            if (saved === 'true') {
                setIsPlayerHistoryModalOpen(true);
            }
        }
    }, []);

    const [realLessons, setRealLessons] = useState<LessonData[]>([]);

    useEffect(() => {
        setIsLoading(true);
        const supabase = createClient();

        const fetchData = async () => {
            const [athletes, { data: { user } }] = await Promise.all([
                fetchAthletes(),
                supabase.auth.getUser()
            ]);

            setAllAthletes(athletes);

            let initialSelectAll = true;
            let initialSelectedPlayers = new Set(athletes);

            try {
                let stored = sessionStorage.getItem("gla_lessons_filter");
                const isFromDetail = sessionStorage.getItem("gla_lessons_keep_alive") === "true";
                const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
                const isReload = navEntries.length > 0 && navEntries[0].type === 'reload';

                if (!isFromDetail && !isReload) {
                    sessionStorage.removeItem("gla_lessons_filter");
                    sessionStorage.removeItem("gla_lessons_scroll");
                    stored = null;
                } else {
                    // React Strict Mode (개발 환경)의 2번 렌더링으로 인해 바로 삭제하면 필터가 초기화되는 버그 방지
                    setTimeout(() => {
                        sessionStorage.removeItem("gla_lessons_keep_alive");
                    }, 500);
                }

                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (parsed.activeFilter) setActiveFilter(parsed.activeFilter);
                    if (parsed.searchQuery !== undefined) setSearchQuery(parsed.searchQuery);
                    if (parsed.startDate !== undefined) setStartDate(parsed.startDate);
                    if (parsed.endDate !== undefined) setEndDate(parsed.endDate);
                    if (parsed.activePreset !== undefined) setActivePreset(parsed.activePreset);
                    if (parsed.selectAll !== undefined) {
                        initialSelectAll = parsed.selectAll;
                        setSelectAll(parsed.selectAll);
                    }
                    if (parsed.displayLimit) setDisplayLimit(parsed.displayLimit);
                    if (parsed.viewMode) setViewMode(parsed.viewMode);

                    if (initialSelectAll) {
                        initialSelectedPlayers = new Set(athletes);
                    } else if (parsed.selectedPlayers) {
                        initialSelectedPlayers = new Set(parsed.selectedPlayers);
                    }
                    setSelectedPlayers(initialSelectedPlayers);
                } else {
                    setSelectedPlayers(initialSelectedPlayers);
                }
            } catch (e) {
                console.warn("Failed to restore lessons filter", e);
                setSelectedPlayers(initialSelectedPlayers);
            }

            let currentRole = "athlete";
            if (user) {
                const { data: dbUser } = await supabase
                    .from("users")
                    .select("role")
                    .eq("id", user.id)
                    .maybeSingle();
                currentRole = dbUser?.role || "athlete";
                setUserRole(currentRole);
            }

            // Fetch actual lessons from DB is now handled in a separate useEffect for pagination

            // Fetch today's schedule out of the new 'schedules' table
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
                .eq("event_type", "lesson")
                .gte("start_time", startOfDay.toISOString())
                .lte("start_time", endOfDay.toISOString())
                .order("start_time", { ascending: true });

            if (currentRole === 'athlete' && user) {
                scheduleQuery = scheduleQuery.eq("user_id", user.id);
            }

            const { data: scheduleData, error: scheduleError } = await scheduleQuery;
            if (!scheduleError && scheduleData) {
                const formattedSchedules = scheduleData.map((item: any) => {
                    const dStart = new Date(item.start_time);
                    const dEnd = new Date(item.end_time);
                    const timeStr = `${dStart.getHours().toString().padStart(2, '0')}:${dStart.getMinutes().toString().padStart(2, '0')}~${dEnd.getHours().toString().padStart(2, '0')}:${dEnd.getMinutes().toString().padStart(2, '0')}`;

                    return {
                        id: item.id,
                        playerName: item.users?.name || "알수없음",
                        title: item.title,
                        time: timeStr,
                        type: item.event_type,
                        status: item.status || "scheduled"
                    };
                });
                setTodaySchedule(formattedSchedules);
            }

            setIsLoading(false);
        };

        fetchData();
    }, []);

    // New useEffect for Server-side Pagination
    useEffect(() => {
        if (isLoading) return; // Wait until initial setup is done

        const fetchFilteredLessons = async () => {
            const supabase = createClient();
            let query = supabase
                .from("records")
                .select(`
                    id, type, category, title, content, is_corrected, created_at, connected_lesson_id, user_id,
                    users!records_user_id_fkey(name),
                    coach:users!records_coach_id_fkey(name)
                `, { count: 'exact' })
                .eq("type", "lesson");

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

            query = query.order("created_at", { ascending: false }).limit(displayLimit);

            const { data: lessonsData, error: lessonsError, count } = await query;
            if (lessonsError || !lessonsData) return;

            setTotalLessonCount(count || 0);

            const parentIdsToFetch = new Set<string>();
            lessonsData.forEach((item: any) => {
                if (item.connected_lesson_id) {
                    const parentExists = lessonsData.some((l: any) => l.id === item.connected_lesson_id);
                    if (!parentExists) {
                        parentIdsToFetch.add(item.connected_lesson_id);
                    }
                }
            });

            let finalLessonsData = [...lessonsData];

            if (parentIdsToFetch.size > 0) {
                const { data: parentData } = await supabase.from("records").select(`
                    id, type, category, title, content, is_corrected, created_at, connected_lesson_id, user_id,
                    users!records_user_id_fkey(name),
                    coach:users!records_coach_id_fkey(name)
                `).in("id", Array.from(parentIdsToFetch));
                
                if (parentData) {
                    finalLessonsData = [...finalLessonsData, ...parentData];
                }
            }

            const formatted: LessonData[] = finalLessonsData.map((item: any) => ({
                id: item.id,
                type: item.category as LessonType,
                title: item.title || "",
                playerName: item.users?.name || "Unknown",
                coachName: item.coach?.name || "Unknown",
                comment: item.content || "",
                date: item.created_at ? format(new Date(item.created_at), 'yyyy-MM-dd') : "",
                is_corrected: item.is_corrected,
                created_at: item.created_at,
                connected_lesson_id: item.connected_lesson_id,
                hasDirectorComment: typeof item.content === 'string' && item.content.includes("[감독 코멘트]")
            }));

            // Deduplicate
            const uniqueFormatted = Array.from(new Map(formatted.map(item => [item.id, item])).values());
            
            setRealLessons(uniqueFormatted);
        };

        fetchFilteredLessons();
    }, [activeFilter, selectAll, selectedPlayers, startDate, endDate, displayLimit, isLoading]);

    const [scrollRestored, setScrollRestored] = useState(false);

    // Save filter state to sessionStorage whenever it changes
    useEffect(() => {
        // Skip saving if athletes haven't loaded yet to avoid overwriting with empty state
        if (allAthletes.length === 0) return;

        try {
            sessionStorage.setItem("gla_lessons_filter", JSON.stringify({
                activeFilter,
                searchQuery,
                selectAll,
                selectedPlayers: Array.from(selectedPlayers),
                startDate,
                endDate,
                activePreset,
                displayLimit,
                viewMode
            }));
        } catch (e) {
            console.warn("Failed to save lessons filter", e);
        }
    }, [activeFilter, searchQuery, selectAll, selectedPlayers, startDate, endDate, activePreset, displayLimit, viewMode, allAthletes]);

    // Scroll Preservation logic is now handled in LessonTable's handleRowClick

    // Restore scroll after data is loaded and rendered
    useEffect(() => {
        if (!isLoading && !scrollRestored) {
            const savedScroll = sessionStorage.getItem("gla_lessons_scroll");
            if (savedScroll) {
                setTimeout(() => {
                    requestAnimationFrame(() => {
                        window.scrollTo({ top: parseInt(savedScroll, 10), behavior: 'auto' });
                    });
                }, 200);
            }
            setScrollRestored(true);
        }
    }, [isLoading, scrollRestored]);

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

    // Group lessons (Thread View)
    const groupedLessons = useMemo(() => {
        // 1. Build a map of all lessons for quick lookup
        const lessonMap = new Map<string, LessonData>();
        realLessons.forEach(l => lessonMap.set(l.id, { ...l, subLessons: [] }));

        // 2. Resolve roots and descendants
        const rootLessons: LessonData[] = [];

        const getRootId = (id: string): string => {
            let current = lessonMap.get(id);
            const visited = new Set<string>();
            while (current?.connected_lesson_id) {
                if (visited.has(current.id)) break; // Prevent infinite loops
                visited.add(current.id);
                const parent = lessonMap.get(current.connected_lesson_id);
                if (!parent) break;
                current = parent;
            }
            return current?.id || id;
        };

        const treeMap = new Map<string, LessonData[]>();

        realLessons.forEach(l => {
            const rootId = getRootId(l.id);
            if (rootId === l.id) {
                if (!treeMap.has(rootId)) treeMap.set(rootId, []);
            } else {
                if (!treeMap.has(rootId)) treeMap.set(rootId, []);
                treeMap.get(rootId)!.push(lessonMap.get(l.id)!);
            }
        });

        // 3. Assemble roots and apply core badge
        Array.from(treeMap.keys()).forEach(rootId => {
            const root = lessonMap.get(rootId);
            if (root) {
                const descendants = treeMap.get(rootId)!;
                descendants.sort((a, b) => {
                    const dateA = new Date(a.created_at || a.date).getTime();
                    const dateB = new Date(b.created_at || b.date).getTime();
                    return dateB - dateA;
                });

                root.subLessons = descendants;

                if (descendants.length >= 2) {
                    root.is_core_lesson = true;
                }

                rootLessons.push(root);
            }
        });

        rootLessons.sort((a, b) => {
            let maxDateA = new Date(a.created_at || a.date).getTime();
            if (a.subLessons && a.subLessons.length > 0) {
                const latestSubA = new Date(a.subLessons[0].created_at || a.subLessons[0].date).getTime();
                if (latestSubA > maxDateA) maxDateA = latestSubA;
            }

            let maxDateB = new Date(b.created_at || b.date).getTime();
            if (b.subLessons && b.subLessons.length > 0) {
                const latestSubB = new Date(b.subLessons[0].created_at || b.subLessons[0].date).getTime();
                if (latestSubB > maxDateB) maxDateB = latestSubB;
            }

            return maxDateB - maxDateA;
        });

        // 4. Apply filters
        return rootLessons.filter(root => {
            const typeMatch = (l: LessonData) => activeFilter === "all" || l.type === activeFilter;
            const playerMatch = (l: LessonData) => selectedPlayers.has(l.playerName);
            const dateMatch = (l: LessonData) => (!startDate || l.date >= startDate) && (!endDate || l.date <= endDate);

            const isMatch = (l: LessonData) => typeMatch(l) && playerMatch(l) && dateMatch(l);

            if (isMatch(root)) return true;
            if (root.subLessons?.some(sub => isMatch(sub))) return true;

            return false;
        });
    }, [realLessons, activeFilter, selectedPlayers, startDate, endDate]);

    const displayedLessons = useMemo(() => {
        return groupedLessons.slice(0, displayLimit);
    }, [groupedLessons, displayLimit]);

    const filteredTodaySchedule = useMemo(() => {
        if (activeFilter === "all") return todaySchedule;
        return (todaySchedule as any[]).filter(item =>
            item.type === activeFilter || item.type === "lesson"
        );
    }, [todaySchedule, activeFilter]);

    return (
        <div className="p-4 sm:p-8 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <BookOpen size={24} className="text-brand-navy dark:text-brand-navy-light shrink-0" />
                    <PageTitle>Lesson</PageTitle>
                </div>
                {(userRole === 'coach' || userRole === 'admin') && (
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={() => setIsPlayerHistoryModalOpen(true)}
                            className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm active:scale-95"
                            title="선수별 레슨 히스토리 검색"
                        >
                            <Search size={18} />
                        </button>
                        <Link
                            href="/lessons/create"
                            className="bg-brand-red hover:bg-brand-red-dark text-white px-5 py-2 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
                        >
                            <Plus size={18} />
                            작성
                        </Link>
                    </div>
                )}
            </div>

            <PlayerLessonHistoryModal
                isOpen={isPlayerHistoryModalOpen}
                onClose={() => {
                    setIsPlayerHistoryModalOpen(false);
                    sessionStorage.removeItem('openPlayerLessonHistoryModal');
                }}
                allAthletes={allAthletes}
            />

            {/* ── Filter Buttons ── */}
            <CategoryTabs options={filterButtons} value={activeFilter} onChange={setActiveFilter} />



            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 mb-6">
                {/* Date Range: 레슨일자 */}
                <div className="flex items-center gap-2">
                    <LabelText className="w-24 shrink-0 text-center">
                        레슨 일자
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
                            onClick={() => { setStartDate(""); setEndDate(""); setActivePreset(undefined as any); }}
                            className="shrink-0 px-1 py-2 text-xs font-bold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                        >
                            초기화
                        </button>
                    )}
                </div>


            </div>

            {/* ── Lesson Table ── */}
            <section>
                <div className="flex items-center justify-between mb-4">
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
                        activePreset={activePreset as DatePresetType}
                        onPresetChange={(start, end, preset) => {
                            setStartDate(start);
                            setEndDate(end);
                            setActivePreset(preset);
                        }}
                    />
                </div>
                <div className="mt-2">
                    {displayedLessons.length > 0 ? (
                        <>
                            <LessonTable lessons={displayedLessons} totalCount={totalLessonCount} viewMode={viewMode} userRole={userRole} />
                            {totalLessonCount > displayLimit && (
                                <div className="mt-6 flex justify-center">
                                    <button
                                        onClick={() => setDisplayLimit(prev => prev + 20)}
                                        className="px-6 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all active:scale-95"
                                    >
                                        더 보기 ({totalLessonCount - displayLimit > 0 ? totalLessonCount - displayLimit : 0}건 남음)
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <p className="text-zinc-400 text-sm text-center py-8">
                            조건에 맞는 레슨이 없습니다.
                        </p>
                    )}
                </div>
            </section >
        </div >
    );
}
