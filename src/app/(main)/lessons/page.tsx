"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from 'next/link';
import { LessonData, LessonType } from "@/components/lesson/LessonCard";
import { LessonTable } from "@/components/lesson/LessonTable";
import { BookOpen, Plus, Search, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { getTodayScheduledItems } from "@/lib/schedule-sync";
import { DatePickerInput } from "@/components/ui/DatePickerInput";
import { fetchAthletes } from "@/lib/athlete-sync";
import { createClient } from "@/lib/supabase/client";
import { DatePresets, DatePresetType } from "@/components/ui/DatePresets";
import { cn } from "@/lib/utils";

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
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [displayLimit, setDisplayLimit] = useState(20);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activePreset, setActivePreset] = useState<DatePresetType>("custom");

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
            setSelectedPlayers(new Set(athletes));

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

            // Fetch actual lessons from DB
            const { data: lessonsData, error: lessonsError } = await supabase
                .from("records")
                .select(`
                    id,
                    type,
                    category,
                    title,
                    content,
                    created_at,
                    users!records_user_id_fkey(name),
                    coach:users!records_coach_id_fkey(name)
                `)
                .eq("type", "lesson")
                .order("created_at", { ascending: false });

            if (!lessonsError && lessonsData) {
                const formatted: LessonData[] = lessonsData.map((item: any) => ({
                    id: item.id,
                    type: item.category as LessonType,
                    title: item.title || "",
                    playerName: item.users?.name || "Unknown",
                    coachName: item.coach?.name || "Unknown",
                    comment: item.content || "",
                    date: item.created_at.split("T")[0]
                }));
                setRealLessons(formatted);
            }

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

    // Final filtered lessons
    const filteredLessons = useMemo(() => {
        return realLessons.filter((l) => {
            const typeMatch = activeFilter === "all" || l.type === activeFilter;
            const playerMatch = selectedPlayers.has(l.playerName);
            const afterStart = !startDate || l.date >= startDate;
            const beforeEnd = !endDate || l.date <= endDate;
            return typeMatch && playerMatch && afterStart && beforeEnd;
        });
    }, [activeFilter, selectedPlayers, startDate, endDate, realLessons]);

    const displayedLessons = useMemo(() => {
        return filteredLessons.slice(0, displayLimit);
    }, [filteredLessons, displayLimit]);

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
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                        Lesson
                    </h1>
                </div>
                {(userRole === 'coach' || userRole === 'admin') && (
                    <Link
                        href="/lessons/create"
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

            {/* ── Today's Completed Lessons ── */}
            <div className="mb-4">
                <div className="flex items-center justify-between mb-3 px-1">
                    <h2 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                        <Calendar size={16} className="text-brand-navy dark:text-brand-navy-light" />
                        오늘의 레슨
                    </h2>
                    <span className="text-[10px] text-zinc-400 font-medium">일정을 클릭하여 레슨을 기록하세요.</span>
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
                                    href={canCreate ? `/lessons/create?player=${encodeURIComponent(s.playerName)}&start=${s.time.split('~')[0]}&end=${s.time.split('~')[1]}&type=${s.type}&scheduleId=${s.id}` : "#"}
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
                                            "text-[10px] font-bold px-1.5 py-0.5 rounded-md",
                                            isCompleted ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-400" : "bg-brand-navy/5 dark:bg-brand-navy/20 text-brand-navy dark:text-brand-navy-light"
                                        )}>
                                            {isCompleted ? "완료" : "예약"}
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
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 mb-6">
                {/* Date Range: 레슨일자 */}
                <div className="flex items-center gap-2">
                    <label className="w-24 shrink-0 text-center text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                        레슨 일자
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
                )}
            </div>

            {/* ── Lesson Table ── */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-200">
                            조회 결과
                        </h2>
                        <span className="text-xs text-zinc-400 font-medium">
                            ({filteredLessons.length}건)
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
                    {displayedLessons.length > 0 ? (
                        <>
                            <LessonTable lessons={displayedLessons} />
                            {filteredLessons.length > displayLimit && (
                                <div className="mt-6 flex justify-center">
                                    <button
                                        onClick={() => setDisplayLimit(prev => prev + 20)}
                                        className="px-6 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all active:scale-95"
                                    >
                                        더 보기 ({filteredLessons.length - displayLimit}건 남음)
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

