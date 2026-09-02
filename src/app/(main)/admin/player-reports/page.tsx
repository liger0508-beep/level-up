"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { AthleteSearch } from "@/components/ui/AthleteSearch";
import { fetchScorecards } from "@/lib/scorecard-sync";
import { calculateScorecardAnalysis, HoleAnalysis } from "@/lib/score-calculations";
import {
    FileText,
    TrendingUp,
    Award,
    Activity,
    Calendar,
    Users,
    BarChart3,
    Target,
    ChevronRight,
    Download,
    ChevronDown,
    Zap,
    TrendingDown,
    BrainCircuit,
    Sparkles,
    Printer,
    Pencil,
    Trophy,
    Paperclip,
    CheckCircle2,
    ExternalLink,
    AlertCircle,
    User,
    Play,
    Flag,
    Plus,
    X,
    MessageSquare,
    Link as LinkIcon,
    Dumbbell,
    Search
} from "lucide-react";
import { cn, formatScore } from "@/lib/utils";
import Link from "next/link";
import ReportLessonDetail from "@/components/ReportLessonDetail";
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    ReferenceLine
} from "recharts";
import { Info, Trophy as TrophyIcon } from "lucide-react";
import { ScorecardDetailTable } from "@/components/score/ScorecardDetailTable";


import { PageTitle, SectionTitle, LabelText } from "@/components/ui/Typography";

interface Athlete {
    id: string;
    name: string;
    branch: string;
    coach_name?: string | null;
}

const roundToOne = (num: number | undefined) => {
    if (num === undefined || num === null) return "0";
    const val = Number(Math.round(Number(num + "e1")) + "e-1");
    return val % 1 === 0 ? val.toString() : val.toFixed(1);
};

// UI Components from statistics page
const SectionHeader = ({ title, icon: Icon, badge, className }: { title: string; icon: any; badge?: string; className?: string }) => (
    <div className={cn("flex items-center justify-between mb-4", className)}>
        <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400">
                <Icon size={18} />
            </div>
            <SectionTitle>{title}</SectionTitle>
        </div>
        {badge && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-brand-navy/5 text-brand-navy dark:bg-brand-navy/20 dark:text-brand-navy-light border border-brand-navy/10">
                {badge}
            </span>
        )}
    </div>
);

const SummaryBox = ({ label, value, icon: Icon, colorClass = "text-brand-navy" }: { label: React.ReactNode; value: string | number; icon: any; colorClass?: string }) => {
    const isPositive = typeof value === 'string' && value.startsWith('+');
    const isNegative = typeof value === 'string' && value.startsWith('-');
    const displayColor = isPositive ? "text-blue-500" : isNegative ? "text-red-500" : colorClass;

    return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-5 py-7 rounded-[2.5rem] shadow-sm flex flex-col items-start justify-between min-h-[190px] print:min-h-[160px]">
            <div className="flex flex-col items-start gap-2 mb-2 text-[11px] font-black text-zinc-400 text-left">
                <Icon size={20} className="text-zinc-400/80 shrink-0" />
                <div className="leading-tight">
                    {label}
                </div>
            </div>
            <div className="w-full flex items-baseline justify-end">
                <span className={cn("text-2xl font-black tracking-tighter", displayColor)}>{value}</span>
            </div>
        </div>
    );
};

const IndicatorCard = ({ label, value, unit, icon: Icon, colorClass = "text-brand-navy" }: { label: string; value: string | number; unit?: string; icon: any; colorClass?: string }) => (
    <div className="bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800/50 p-4 rounded-2xl flex flex-col justify-between h-full">
        <div className="flex items-center gap-1.5 mb-3 text-[12px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-tight">
            <Icon size={14} className="text-zinc-400 shrink-0" />
            {label}
        </div>
        <div className="flex items-baseline justify-end gap-1">
            <span className={cn("text-2xl font-black tracking-tighter", colorClass)}>{value}</span>
            {unit && <span className="text-[12px] font-bold text-zinc-400 ml-0.5">{unit}</span>}
        </div>
    </div>
);

const FeedbackEditor = ({ value, onChange }: { value: string, onChange: (val: string) => void }) => {
    const [localVal, setLocalVal] = useState(value);

    useEffect(() => {
        setLocalVal(value);
    }, [value]);

    return (
        <textarea
            value={localVal}
            onChange={(e) => setLocalVal(e.target.value)}
            onBlur={() => onChange(localVal)}
            placeholder="이번 달 훈련 성과 및 향후 계획에 대한 코멘트를 작성해주세요..."
            className="w-full h-48 p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl resize-none text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy text-zinc-900 dark:text-zinc-100"
        />
    );
};

export default function AthleteReportPage() {
    const supabase = createClient();
    const [savedReportId, setSavedReportId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [athletes, setAthletes] = useState<Athlete[]>([]);
    const [selectedAthleteId, setSelectedAthleteId] = useState<string>(() => {
        if (typeof window !== "undefined") {
            const saved = sessionStorage.getItem("gla_report_athlete_id");
            if (saved) return saved;
        }
        return "";
    });
    const [selectedMonth, setSelectedMonth] = useState<string>(() => {
        if (typeof window !== "undefined") {
            const saved = sessionStorage.getItem("gla_report_month");
            if (saved) return saved;
        }
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });

    useEffect(() => {
        if (typeof window !== "undefined") {
            sessionStorage.setItem("gla_report_athlete_id", selectedAthleteId);
            sessionStorage.setItem("gla_report_month", selectedMonth);
        }
    }, [selectedAthleteId, selectedMonth]);

    useEffect(() => {
        const handlePopState = (e: PopStateEvent) => {
            if (selectedAthleteId && (!e.state || !e.state.reportDetail)) {
                setSelectedAthleteId("");
                setExcludedIds(new Set());
            }
        };

        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, [selectedAthleteId]);

    // Dynamic Database States
    const [scorecards, setScorecards] = useState<any[]>([]);
    const [tournamentResults, setTournamentResults] = useState<any[]>([]);
    const [analyses, setAnalyses] = useState<any[]>([]);
    const [lessons, setLessons] = useState<any[]>([]);
    const [trainings, setTrainings] = useState<any[]>([]);
    const [tests, setTests] = useState<any[]>([]);

    // Scorecard stats detail map
    const [statsSummary, setStatsSummary] = useState<any>(null);
    const [isDemoData, setIsDemoData] = useState(false);

    // Interactive Dashboard States
    const [mode, setMode] = useState<"score" | "contribution">("score");
    const [sectorViewMode, setSectorViewMode] = useState<'average' | 'trend'>('average');
    const [activeSector, setActiveSector] = useState<'티샷' | '세컨샷' | '그린주변' | '퍼팅'>('티샷');
    const [selectedPlanLabel, setSelectedPlanLabel] = useState<string | null>(null);
    const [viewingScorecardId, setViewingScorecardId] = useState<string | null>(null);
    const [allScorecards, setAllScorecards] = useState<any[]>([]);
    const [analysisMap, setAnalysisMap] = useState<Record<string, HoleAnalysis[]>>({});
    const [holeType, setHoleType] = useState<9 | 18>(18);
    const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
    const [isTagsExpanded, setIsTagsExpanded] = useState(false);
    const [coachFeedback, setCoachFeedback] = useState("");
    const [includedLessonId, setIncludedLessonId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [branchFilter, setBranchFilter] = useState<string>("ALL");
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"ALL" | "COMPLETED" | "INCOMPLETE">("ALL");
    const [coachFilter, setCoachFilter] = useState<string>("ALL");
    const [reportStatuses, setReportStatuses] = useState<Record<string, boolean>>({});
    const [assignedCoaches, setAssignedCoaches] = useState<Record<string, string>>({});

    const [refreshTrigger, setRefreshTrigger] = useState(0);


    useEffect(() => {
        async function init() {
            setIsLoading(true);
            try {
                // Get current user profile
                const { data: { user: authUser } } = await supabase.auth.getUser();
                if (!authUser) return;

                const { data: profile } = await supabase
                    .from("users")
                    .select("id, name, role, branch")
                    .eq("id", authUser.id)
                    .single();

                if (profile) {
                    setUser(profile);

                    // Fetch athlete list if coach or admin
                    if (profile.role === "coach" || profile.role === "admin" || profile.role === "head_coach") {
                        const { data: athletesData } = await supabase
                            .from("users")
                            .select("id, name, branch, coach_name")
                            .eq("role", "athlete")
                            .eq("status", "등록")
                            .order("name");

                        if (athletesData) {
                            setAthletes(athletesData);
                        }
                    } else if (profile.role === "athlete") {
                        setSelectedAthleteId(profile.id);
                    }
                }
            } catch (err) {
                console.error("Error initializing Athlete Report:", err);
            } finally {
                setIsLoading(false);
            }
        }
        init();
    }, []);

    const selectedAthleteName = useMemo(() => {
        if (user?.role === "athlete") return user.name;
        const found = athletes.find(a => a.id === selectedAthleteId);
        return found ? found.name : "";
    }, [athletes, selectedAthleteId, user]);

    const selectedAthleteBranch = useMemo(() => {
        if (user?.role === "athlete") return user.branch || "";
        const found = athletes.find(a => a.id === selectedAthleteId);
        return found ? found.branch : "";
    }, [athletes, selectedAthleteId, user]);

    const handleMonthChange = (delta: number) => {
        const [year, month] = selectedMonth.split('-').map(Number);
        const date = new Date(year, month - 1 + delta, 1);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        setSelectedMonth(`${y}-${m}`);
        setExcludedIds(new Set());
    };

    // Fetch report completion statuses
    useEffect(() => {
        async function fetchStatuses() {
            if (!athletes || athletes.length === 0) return;
            try {
                // 1. Fetch report statuses via admin API to bypass RLS
                const res = await fetch(`/api/reports?type=status&month=${selectedMonth}`);
                if (res.ok) {
                    const { data: reports } = await res.json();
                    if (reports) {
                        const statusMap: Record<string, boolean> = {};
                        reports.forEach((r: any) => {
                            statusMap[r.athlete_id] = true;
                        });
                        setReportStatuses(statusMap);
                    }
                }

                // 2. Fetch assigned coaches for this month
                const { data: assignments } = await supabase
                    .from("monthly_assignments")
                    .select(`
                        athlete_id,
                        coach:coach_id (name)
                    `)
                    .eq("month", selectedMonth);

                if (assignments) {
                    const coachMap: Record<string, string> = {};
                    assignments.forEach((a: any) => {
                        if (a.coach && a.coach.name) {
                            coachMap[a.athlete_id] = a.coach.name;
                        }
                    });
                    setAssignedCoaches(coachMap);
                }
            } catch (err) {
                console.error("Error fetching statuses/coaches:", err);
            }
        }
        fetchStatuses();
    }, [athletes, selectedMonth]);

    // Query Data from Supabase when athlete or month changes
    useEffect(() => {
        if (!selectedAthleteId) return;

        async function fetchAthleteMonthlyData() {
            setIsAnalyzing(true);
            setIsDemoData(false);
            try {
                // 1. Fetch practice scorecard rounds
                const scs = await fetchScorecards(selectedAthleteId);
                const monthScs = scs.filter(s => s.round_date && s.round_date.startsWith(selectedMonth));
                setAllScorecards(monthScs);

                const newAnalysisMap: Record<string, HoleAnalysis[]> = {};
                for (const sc of monthScs) {
                    try {
                        const result = await calculateScorecardAnalysis(sc.id);
                        newAnalysisMap[sc.id] = result.filter((v, i, a) => a.findIndex(t => t.holeNumber === v.holeNumber) === i);
                    } catch (e) {
                        console.error(e);
                    }
                }
                setAnalysisMap(newAnalysisMap);

                // 18홀 데이터가 없으면 9홀로 자동 선택 (둘 다 없으면 기본값 18 유지)
                const has18Holes = monthScs.some(s => (newAnalysisMap[s.id]?.length || 0) === 18);
                const has9Holes = monthScs.some(s => (newAnalysisMap[s.id]?.length || 0) === 9);
                if (!has18Holes && has9Holes) {
                    setHoleType(9);
                } else {
                    setHoleType(18);
                }

                // Fetch existing coach feedback if any via admin API to bypass RLS
                const res = await fetch(`/api/reports?type=detail&athlete_id=${selectedAthleteId}&month=${selectedMonth}`);
                if (res.ok) {
                    const { data: reportData } = await res.json();
                    if (reportData) {
                        setSavedReportId(reportData.id);
                        if (reportData.content?.coachFeedback) {
                            setCoachFeedback(reportData.content.coachFeedback);
                        } else {
                            setCoachFeedback("");
                        }
                    } else {
                        setSavedReportId(null);
                        setCoachFeedback("");
                    }
                } else {
                    setSavedReportId(null);
                    setCoachFeedback("");
                }

                // 2. Fetch tournament results
                const { data: tourList } = await supabase
                    .from("tournament_results")
                    .select("*, tournaments(name)")
                    .eq("athlete_name", selectedAthleteName);

                const filteredTours = (tourList || []).filter(t => t.round_date && t.round_date.startsWith(selectedMonth));

                // Group by tournament to keep only the final/highest round row per tournament and calculate the date span
                const uniqueToursMap = new Map<string, any>();
                const tournamentDatesMap = new Map<string, string[]>();

                for (const tour of filteredTours) {
                    const key = tour.tournament_id || tour.tournaments?.name || tour.notes || "unknown";

                    if (tour.round_date) {
                        const currentDates = tournamentDatesMap.get(key) || [];
                        if (!currentDates.includes(tour.round_date)) {
                            currentDates.push(tour.round_date);
                        }
                        tournamentDatesMap.set(key, currentDates);
                    }

                    const existing = uniqueToursMap.get(key);
                    if (!existing || (Number(tour.round_number || 0) > Number(existing.round_number || 0))) {
                        uniqueToursMap.set(key, tour);
                    }
                }

                const finalTours = Array.from(uniqueToursMap.values()).map(tour => {
                    const key = tour.tournament_id || tour.tournaments?.name || tour.notes || "unknown";
                    const dates = tournamentDatesMap.get(key) || [];

                    let dateSpan = "-";
                    if (dates.length > 0) {
                        const sortedDates = [...dates].sort();
                        if (sortedDates.length === 1) {
                            const parts = sortedDates[0].split('-');
                            dateSpan = parts.length >= 3 ? `${parts[1]}/${parts[2]}` : sortedDates[0].substring(5).replace('-', '/');
                        } else {
                            const first = sortedDates[0];
                            const last = sortedDates[sortedDates.length - 1];
                            const firstParts = first.split('-');
                            const lastParts = last.split('-');
                            if (firstParts.length >= 3 && lastParts.length >= 3) {
                                if (firstParts[1] === lastParts[1]) {
                                    dateSpan = `${firstParts[1]}/${firstParts[2]}-${lastParts[2]}`;
                                } else {
                                    dateSpan = `${firstParts[1]}/${firstParts[2]}-${lastParts[1]}/${lastParts[2]}`;
                                }
                            } else {
                                dateSpan = `${first.substring(5).replace('-', '/')}-${last.substring(5).replace('-', '/')}`;
                            }
                        }
                    }

                    return {
                        ...tour,
                        formattedDateSpan: dateSpan
                    };
                });

                setTournamentResults(finalTours);

                // 3. Fetch Analyses, Lessons from 'records' table and Tests from 'test_sessions' table
                const [recordsRes, testsRes, allLessonsRes] = await Promise.all([
                    supabase
                        .from("records")
                        .select(`
                            id, type, category, title, content, score, media_urls, created_at, connected_lesson_id,
                            training_start, training_end, completion_logs, template_settings, total_count,
                            coach:users!records_coach_id_fkey(name)
                        `)
                        .eq("user_id", selectedAthleteId)
                        .in("type", ["analysis", "lesson", "training"])
                        .order("inserted_at", { ascending: false }),
                    supabase
                        .from("test_sessions")
                        .select(`
                            id, category, title, raw_shot_data, total_score, created_at, driver_score, iron_score, short_approach_score, middle_approach_score, long_approach_score, short_bunker_score, long_bunker_score, short_putt_score, middle_putt_score, long_putt_score,
                            coach:users!test_sessions_coach_id_fkey(name)
                        `)
                        .eq("user_id", selectedAthleteId),
                    supabase
                        .from("records")
                        .select("id, category, connected_lesson_id, created_at")
                        .eq("user_id", selectedAthleteId)
                        .eq("type", "lesson")
                ]);

                const coreLessonIds = new Set<string>();
                if (allLessonsRes.data) {
                    const lessonMap = new Map();
                    allLessonsRes.data.forEach(l => lessonMap.set(l.id, l));
                    const treeMap = new Map();
                    const getRootId = (id: string): string => {
                        let curr = lessonMap.get(id);
                        const visited = new Set<string>();
                        while (curr?.connected_lesson_id) {
                            if (visited.has(curr.id)) break;
                            visited.add(curr.id);
                            const p = lessonMap.get(curr.connected_lesson_id);
                            if (!p) break;
                            curr = p;
                        }
                        return curr?.id || id;
                    };
                    allLessonsRes.data.forEach(l => {
                        const rootId = getRootId(l.id);
                        if (!treeMap.has(rootId)) treeMap.set(rootId, []);
                        if (rootId !== l.id) {
                            treeMap.get(rootId).push(l);
                        }
                    });
                    for (const [rootId, descendants] of treeMap.entries()) {
                        if (descendants.length >= 2) coreLessonIds.add(rootId);
                    }
                }

                if (recordsRes.data) {
                    const isInMonth = (dateStr: string | null | undefined) => {
                        if (!dateStr) return false;
                        if (dateStr.length === 7) return dateStr === selectedMonth;
                        const d = new Date(dateStr);
                        if (isNaN(d.getTime())) return dateStr.startsWith(selectedMonth);
                        // Convert to KST (+9 hours) to be safe regardless of browser timezone
                        const kstDate = new Date(d.getTime() + (9 * 60 * 60 * 1000));
                        const m = kstDate.getUTCMonth() + 1;
                        const y = kstDate.getUTCFullYear();
                        return `${y}-${m.toString().padStart(2, '0')}` === selectedMonth;
                    };

                    const monthRecords = recordsRes.data.filter(r =>
                        isInMonth(r.created_at) ||
                        isInMonth(r.training_start)
                    );
                    setAnalyses(monthRecords.filter(r => r.type === "analysis"));
                    setLessons(monthRecords.filter(r => r.type === "lesson").map(l => ({ ...l, is_core_lesson: coreLessonIds.has(l.id) })));
                    setTrainings(recordsRes.data.filter(r =>
                        r.type === "training" && (
                            isInMonth(r.created_at) ||
                            isInMonth(r.training_start) ||
                            isInMonth(r.training_end) ||
                            (r.training_start && r.training_end && r.training_start <= selectedMonth + '-31' && r.training_end >= selectedMonth + '-01')
                        )
                    ));
                }
                if (testsRes.data) {
                    const filteredTests = testsRes.data.filter(r => r.created_at && r.created_at.startsWith(selectedMonth));
                    // Map to expected TestRecord format for UI
                    const mappedTests = filteredTests.map(t => ({
                        ...t,
                        type: "test",
                        score: t.total_score,
                        content: {
                            ...t.raw_shot_data, // keeps the shots if needed
                            driver: { score: t.driver_score },
                            iron: { score: t.iron_score },
                            short_putt: t.short_putt_score,
                            middle_putt: t.middle_putt_score,
                            long_putt: t.long_putt_score,
                            shortApproach: t.short_approach_score,
                            middleApproach: t.middle_approach_score,
                            longApproach: t.long_approach_score,
                            shortBunker: t.short_bunker_score,
                            longBunker: t.long_bunker_score
                        }
                    }));
                    setTests(mappedTests);
                }




            } catch (err) {
                console.error("Error fetching athlete details:", err);
            } finally {
                setIsAnalyzing(false);
            }
        }

        fetchAthleteMonthlyData();
    }, [selectedAthleteId, selectedMonth, selectedAthleteName, refreshTrigger]);

    useEffect(() => {
        if (!allScorecards || allScorecards.length === 0) {
            setSavedReportId(null);
            setIsDemoData(false);
            setStatsSummary(null);
            return;
        }

        const validScs = allScorecards.filter(s => (analysisMap[s.id]?.length || 0) === holeType);
        const filteredScs = validScs.filter(s => !excludedIds.has(s.id));
        setScorecards(filteredScs);

        // 5. Aggregate exact Scorecard analysis calculations like scores/stats/page.tsx
        if (filteredScs.length > 0) {
            let combinedResult: HoleAnalysis[] = [];
            const numRounds = filteredScs.length;

            for (const sc of filteredScs) {
                const uniqueHoles = analysisMap[sc.id] || [];
                combinedResult = combinedResult.concat(uniqueHoles);
            }

            if (combinedResult.length > 0) {
                const teeSG = combinedResult.reduce((s, h) => s + (h.summary.distSG_DriverDist + h.summary.distSG_DriverAcc), 0) / numRounds;
                const secondSG = combinedResult.reduce((s, h) => s + (h.summary.distSG_180Plus + h.summary.distSG_150_179 + h.summary.distSG_120_149 + h.summary.distSG_90_119), 0) / numRounds;
                const greenSG = combinedResult.reduce((s, h) => s + (h.summary.distSG_Pitch31_89 + h.summary.distSG_Bunker + h.summary.distSG_Approach), 0) / numRounds;
                const puttingSG = combinedResult.reduce((s, h) => s + (h.summary.distSG_Putt9Plus + h.summary.distSG_Putt4_8 + h.summary.distSG_Putt2_3 + h.summary.distSG_Putt1), 0) / numRounds;

                const CATEGORY_TO_FIELD: Record<string, string> = {
                    "티샷 비거리": "distSG_DriverDist", "티샷 정확도": "distSG_DriverAcc",
                    "180M이상": "distSG_180Plus", "150-179M": "distSG_150_179",
                    "120-149M": "distSG_120_149", "90-119M": "distSG_90_119",
                    "피치샷": "distSG_Pitch31_89", "벙커": "distSG_Bunker",
                    "어프로치": "distSG_Approach",
                    "9M이상": "distSG_Putt9Plus", "4-8M": "distSG_Putt4_8",
                    "2-3M": "distSG_Putt2_3", "1M": "distSG_Putt1",
                };
                const cats = Object.entries(CATEGORY_TO_FIELD).map(([name, field]) => {
                    const maxSg = Math.max(...combinedResult.map(h => (h.summary as any)[field] || 0));
                    return {
                        name,
                        sg: combinedResult.reduce((s, h) => s + ((h.summary as any)[field] || 0), 0) / numRounds,
                        maxSg
                    };
                });

                const totalAbsSG = cats.reduce((s, c) => s + Math.abs(c.sg), 0);
                const contributions = cats.map(c => ({
                    ...c,
                    percent: totalAbsSG > 0 ? (Math.abs(c.sg) / totalAbsSG) * 100 : 0
                })).sort((a, b) => a.sg - b.sg);

                const longSG = teeSG + secondSG;
                const shortSG = greenSG + puttingSG;
                const longVsShort = shortSG - longSG;

                const avgTotalScore = filteredScs.reduce((s, sc) => s + sc.total_score, 0) / numRounds;
                const playContent = avgTotalScore + ((longVsShort * -1) / 2);
                const scoreVsContent = avgTotalScore - playContent;

                const totalPutts = combinedResult.reduce((s, h) => s + h.summary.putts, 0) / numRounds;
                const sumFirstPuttDist = combinedResult.reduce((s, h) => s + parseFloat(h.summary.firstPuttAttemptDist || "0"), 0);
                const avgFirstPuttDist = combinedResult.length > 0 ? sumFirstPuttDist / combinedResult.length : 0;
                const threePuttCount = combinedResult.filter(h => h.summary.putts >= 3).length / numRounds;
                const totalPA = combinedResult.reduce((s, h) => s + h.summary.paCount, 0) / numRounds;
                const totalOB = combinedResult.reduce((s, h) => s + h.summary.obCount, 0) / numRounds;

                const fwHoles = combinedResult.filter(h => h.summary.fairwayHit !== '-');
                const fwHits = fwHoles.filter(h => h.summary.fairwayHit === 'O').length;
                const fairwayHitRate = fwHoles.length > 0 ? (fwHits / fwHoles.length) * 100 : 0;
                const girHits = combinedResult.filter(h => h.summary.gir === 'O').length;
                const girRate = combinedResult.length > 0 ? (girHits / combinedResult.length) * 100 : 0;

                // Average Remaining Distance stats
                const distStats: Record<string, { sum: number; count: number }> = {
                    "티샷": { sum: 0, count: 0 },
                    "180M이상": { sum: 0, count: 0 },
                    "150-179M": { sum: 0, count: 0 },
                    "120-149M": { sum: 0, count: 0 },
                    "90-119M": { sum: 0, count: 0 },
                    "피치샷": { sum: 0, count: 0 },
                    "벙커": { sum: 0, count: 0 },
                    "어프로치": { sum: 0, count: 0 },
                    "9M이상": { sum: 0, count: 0 },
                    "4-8M": { sum: 0, count: 0 },
                    "2-3M": { sum: 0, count: 0 },
                    "1M": { sum: 0, count: 0 },
                };

                combinedResult.forEach(h => {
                    h.shots.forEach(r => {
                        const label = r.shotLabel.split('/')[0].trim().toUpperCase();
                        const dist = r.attemptDistance;
                        const rem = r.remainingDistance;
                        const landing = (r.landingLabel || "").toUpperCase().trim();

                        if (["PA", "OB", "PS"].includes(landing)) return;

                        if (label === 'TE' && h.par === 4) {
                            distStats["티샷"].sum += rem;
                            distStats["티샷"].count++;
                        }

                        if (label !== 'GR' && label !== 'GB' && dist > 0) {
                            if (dist >= 180) { distStats["180M이상"].sum += rem; distStats["180M이상"].count++; }
                            else if (dist >= 150) { distStats["150-179M"].sum += rem; distStats["150-179M"].count++; }
                            else if (dist >= 120) { distStats["120-149M"].sum += rem; distStats["120-149M"].count++; }
                            else if (dist >= 90) { distStats["90-119M"].sum += rem; distStats["90-119M"].count++; }
                            else if (dist >= 31) { distStats["피치샷"].sum += rem; distStats["피치샷"].count++; }
                        }

                        if (label === 'GB') { distStats["벙커"].sum += rem; distStats["벙커"].count++; }

                        if (label !== 'GR' && label !== 'GB' && label !== 'TE' && dist > 0 && dist <= 30) {
                            distStats["어프로치"].sum += rem; distStats["어프로치"].count++;
                        }

                        if (label === 'GR') {
                            if (dist >= 9) { distStats["9M이상"].sum += rem; distStats["9M이상"].count++; }
                            else if (dist >= 4) { distStats["4-8M"].sum += rem; distStats["4-8M"].count++; }
                            else if (dist >= 2) { distStats["2-3M"].sum += rem; distStats["2-3M"].count++; }
                            else if (dist === 1) { distStats["1M"].sum += rem; distStats["1M"].count++; }
                        }
                    });
                });

                const avgRemainingDists = Object.entries(distStats).map(([lbl, stat]) => ({
                    label: `${lbl} (${stat.count})`,
                    value: stat.count > 0 ? (stat.sum / stat.count).toFixed(1) : "-"
                }));

                const strongPoint = [...cats].sort((a, b) => a.sg - b.sg)[0]?.name || "-";
                const positiveCats = contributions.filter(c => c.maxSg > 0).sort((a, b) => b.sg - a.sg);
                const challengePoint1 = positiveCats[0]?.name || "-";
                const challengePoint2 = positiveCats[1]?.name || "-";

                let totalBogeyOrWorseForBounceBack = 0;
                let totalBounceBacks = 0;
                let totalBirdieOrBetter = 0;

                filteredScs.forEach(sc => {
                    const holes = analysisMap[sc.id] || [];
                    const sortedHoles = [...holes].sort((a, b) => a.holeNumber - b.holeNumber);

                    for (let i = 0; i < sortedHoles.length; i++) {
                        const h = sortedHoles[i];
                        if (h.score > 0 && h.score !== -1) {
                            if (h.score <= h.par - 1) {
                                totalBirdieOrBetter++;
                            }
                            if (h.score >= h.par + 1) {
                                if (i + 1 < sortedHoles.length) {
                                    const nextH = sortedHoles[i + 1];
                                    if (nextH.score > 0 && nextH.score !== -1) {
                                        totalBogeyOrWorseForBounceBack++;
                                        if (nextH.score <= nextH.par - 1) {
                                            totalBounceBacks++;
                                        }
                                    }
                                }
                            }
                        }
                    }
                });

                const bounceBackRate = totalBogeyOrWorseForBounceBack > 0 ? (totalBounceBacks / totalBogeyOrWorseForBounceBack) * 100 : 0;
                const avgBirdieOrBetter = numRounds > 0 ? (totalBirdieOrBetter / numRounds) : 0;

                const trendData = filteredScs
                    .sort((a, b) => new Date(a.round_date).getTime() - new Date(b.round_date).getTime())
                    .map(sc => {
                        const holes = analysisMap[sc.id] || [];
                        const tSG = holes.reduce((s, h) => s + (h.summary.distSG_DriverDist + h.summary.distSG_DriverAcc), 0);
                        const sSG = holes.reduce((s, h) => s + (h.summary.distSG_180Plus + h.summary.distSG_150_179 + h.summary.distSG_120_149 + h.summary.distSG_90_119), 0);
                        const gSG = holes.reduce((s, h) => s + (h.summary.distSG_Pitch31_89 + h.summary.distSG_Bunker + h.summary.distSG_Approach), 0);
                        const pSG = holes.reduce((s, h) => s + (h.summary.distSG_Putt9Plus + h.summary.distSG_Putt4_8 + h.summary.distSG_Putt2_3 + h.summary.distSG_Putt1), 0);

                        return {
                            id: sc.id,
                            date: sc.round_date.substring(5).replace('-', '/'),
                            score: Number(sc.total_score),
                            course: sc.course_name,
                            teeSG: Math.round(tSG * 10) / 10,
                            secondSG: Math.round(sSG * 10) / 10,
                            greenSG: Math.round(gSG * 10) / 10,
                            puttingSG: Math.round(pSG * 10) / 10
                        };
                    });

                const trainingPlan = positiveCats.slice(0, 5).map((c, i) => ({
                    rank: `${i + 1}순위`,
                    label: c.name,
                    pct: Math.round(c.percent),
                    time: [35, 25, 25, 20, 10, 5][i] || 5,
                    color: ["bg-red-500", "bg-orange-500", "bg-emerald-500", "bg-blue-500", "bg-indigo-500", "bg-purple-500"][i] || "bg-zinc-500",
                }));

                setStatsSummary({
                    playContent: roundToOne(playContent),
                    scoreVsContent: formatScore(scoreVsContent),
                    longVsShort: formatScore(longVsShort),
                    averagePar: Math.round(combinedResult.reduce((s, h) => s + h.par, 0) / numRounds),
                    avgMetrics: [
                        { label: "페어웨이 안착률", value: roundToOne(fairwayHitRate), unit: "%" },
                        { label: "그린 적중률", value: roundToOne(girRate), unit: "%" },
                        { label: "평균 퍼트수", value: roundToOne(totalPutts), unit: "개" },
                        { label: "평균 남은 거리", value: roundToOne(avgFirstPuttDist), unit: "m" },
                        { label: "평균 3퍼트 이상", value: roundToOne(threePuttCount), unit: "회" },
                        { label: "평균 패널티/OB", value: roundToOne(totalPA + totalOB), unit: "개" },
                        { label: "바운스백", value: bounceBackRate.toFixed(1), unit: "%" },
                        { label: "버디 이상수", value: roundToOne(avgBirdieOrBetter), unit: "개" }
                    ],
                    sectorChanges: [
                        { type: "티샷", value: formatScore(teeSG), items: cats.slice(0, 2) },
                        { type: "세컨샷", value: formatScore(secondSG), items: cats.slice(2, 6) },
                        { type: "그린주변샷", value: formatScore(greenSG), items: cats.slice(6, 9) },
                        { type: "퍼팅", value: formatScore(puttingSG), items: cats.slice(9, 13) }
                    ],
                    avgRemainingDists,
                    contributions,
                    strongPoint,
                    challengePoint1,
                    challengePoint2,
                    trainingPlan,
                    trendData
                });
            }
        } else {
            setStatsSummary(null);
        }
    }, [allScorecards, analysisMap, holeType, excludedIds]);


    // High fidelity fallback & aggregation calculations
    const stats = useMemo(() => {
        // Average Score Calculation
        let avgScore = 74.2;
        let diffText = "지난달 대비 2.3타 단축";
        if (scorecards.length > 0) {
            const sum = scorecards.reduce((acc, curr) => acc + (curr.total_score || 0), 0);
            avgScore = Number((sum / scorecards.length).toFixed(1));
            diffText = `연습 라운드 ${scorecards.length}회 평균`;
        }

        // Training Completion Calculation
        let completionRate = 88;
        if (trainings.length > 0) {
            const completedCount = trainings.filter(t => t.status === "completed").length;
            completionRate = Math.round((completedCount / trainings.length) * 100);
        }

        return {
            averageScore: avgScore,
            scoreDiffText: diffText,
            trainingCompletionRate: completionRate,
            challengeRank: "A그룹 4위" // Future dev mock
        };
    }, [scorecards, trainings]);

    const handleSaveReport = async () => {
        if (!selectedAthleteId || !selectedMonth) return;
        setIsSaving(true);
        try {
            const reportData = {
                month: selectedMonth,
                excludedIds: Array.from(excludedIds),
                includedLessonIds: includedLessonId ? [includedLessonId] : lessons.length > 0 ? [lessons[0].id] : [],
                coachFeedback,
                statsSummary,
                scorecards: scorecards.map(s => s.id),
                lessons: lessons.map(l => l.id),
                tests: tests.map(t => t.id),
                trainings: trainings.map(t => t.id)
            };

            const res = await fetch('/api/reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    athlete_id: selectedAthleteId,
                    coach_id: user.id,
                    month: selectedMonth,
                    content: reportData
                })
            });
            const result = await res.json();

            if (!res.ok || result.error) {
                throw new Error(result.error || 'Failed to save');
            }

            if (result.data) {
                setSavedReportId(result.data.id);
            }

            alert("레포트 등록이 완료 되었습니다.");
            setSelectedAthleteId("");
        } catch (err) {
            console.error("Error saving report", err);
            alert("저장 중 오류가 발생했습니다.");
        } finally {
            setIsSaving(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const availableCoaches = useMemo(() => {
        const coaches = new Set<string>();
        athletes.forEach(a => {
            if (branchFilter === "ALL" || (a.branch && a.branch.includes(branchFilter))) {
                const coachName = assignedCoaches[a.id];
                if (coachName) {
                    coaches.add(coachName);
                }
            }
        });
        return Array.from(coaches).sort();
    }, [athletes, branchFilter, assignedCoaches]);

    useEffect(() => {
        if (coachFilter !== "ALL" && !availableCoaches.includes(coachFilter)) {
            setCoachFilter("ALL");
        }
    }, [branchFilter, availableCoaches, coachFilter]);

    const filteredAthletes = useMemo(() => {
        return athletes.filter(a => {
            const matchesBranch = branchFilter === "ALL" || (a.branch && a.branch.includes(branchFilter));
            const matchesSearch = !searchQuery || a.name.includes(searchQuery);
            const isCompleted = !!reportStatuses[a.id];
            const matchesStatus = statusFilter === "ALL"
                ? true
                : statusFilter === "COMPLETED" ? isCompleted : !isCompleted;
            const matchesCoach = coachFilter === "ALL" || assignedCoaches[a.id] === coachFilter;

            return matchesBranch && matchesSearch && matchesStatus && matchesCoach;
        });
    }, [athletes, branchFilter, searchQuery, statusFilter, coachFilter, reportStatuses, assignedCoaches]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
                <div className="text-zinc-500 font-bold flex items-center gap-2">
                    <Activity className="animate-spin text-brand-navy" />
                    성장 리포트 불러오는 중...
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-20 print:bg-white print:pb-0">
            {/* Header */}
            <header className="sticky top-0 z-30 bg-zinc-50/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 print:hidden">
                <div className="max-w-5xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {selectedAthleteId ? (
                            <button
                                onClick={() => {
                                    if (window.history.state?.reportDetail) {
                                        window.history.back();
                                    } else {
                                        setSelectedAthleteId("");
                                        setExcludedIds(new Set());
                                    }
                                }}
                                className="p-2 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-xl border border-zinc-200 dark:border-zinc-700 transition-colors flex items-center justify-center group"
                                title="뒤로가기"
                            >
                                <ChevronRight size={20} className="rotate-180 group-hover:-translate-x-0.5 transition-transform" />
                            </button>
                        ) : (
                            <div className="p-2 bg-brand-navy rounded-lg text-white">
                                <FileText size={20} />
                            </div>
                        )}
                        <PageTitle>
                            선수 레포트 작성
                        </PageTitle>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Buttons moved to bottom right */}
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 sm:px-8 py-8 space-y-8 print:py-0 print:px-0 [word-break:keep-all]">

                {/* Print Only Header */}
                <div className="hidden print:block text-center border-b pb-6 mb-8">
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">GLA ATHLETE PERFORMANCE REPORT</p>
                    <PageTitle>{selectedMonth} {selectedAthleteName} 선수 성장 레포트</PageTitle>
                    <p className="text-xs text-zinc-500 mt-2">지점: {selectedAthleteBranch} | 발행일자: {new Date().toLocaleDateString('ko-KR')}</p>
                </div>

                {/* Filter and Selection Section (Hidden in print) */}
                <div className="flex flex-col gap-4 bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm print:hidden">
                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <button
                                    onClick={() => handleMonthChange(-1)}
                                    className="px-3 py-2 rounded-xl bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 transition-colors shrink-0"
                                >
                                    <ChevronRight size={18} className="rotate-180" />
                                </button>
                                <div className="flex items-center justify-center gap-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl flex-1 sm:flex-none sm:w-auto">
                                    <Calendar size={18} className="text-brand-navy shrink-0" />
                                    <input
                                        type="month"
                                        value={selectedMonth}
                                        onChange={(e) => { setSelectedMonth(e.target.value); setExcludedIds(new Set()); }}
                                        className="bg-transparent text-sm font-black text-center text-zinc-900 dark:text-zinc-100 focus:outline-none w-full sm:w-auto cursor-pointer"
                                    />
                                </div>
                                <button
                                    onClick={() => handleMonthChange(1)}
                                    className="px-3 py-2 rounded-xl bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 transition-colors shrink-0"
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </div>

                            {['coach', 'total', 'superadmin', 'admin', 'office'].includes(user?.role || '') && !selectedAthleteId && (
                                <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto md:ml-auto">
                                    <div className="w-full sm:w-64">
                                        <AthleteSearch
                                            onSelect={(name) => setSearchQuery(name)}
                                            onRemove={() => setSearchQuery("")}
                                            selectedNames={searchQuery ? [searchQuery] : []}
                                            placeholder="선수 이름 검색..."
                                            multi={false}
                                            showChips={true}
                                        />
                                    </div>
                                </div>
                            )}
                            {['coach', 'total', 'superadmin', 'admin', 'office'].includes(user?.role || '') && selectedAthleteName && (
                                <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto md:ml-auto">
                                    <div className="flex items-center gap-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-300 whitespace-nowrap shrink-0">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        선택됨: <span className="font-black text-zinc-900 dark:text-white">{selectedAthleteName}</span> ({selectedAthleteBranch})
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Ordered Contents List */}
                {selectedAthleteId ? (
                    <>
                        <div className="space-y-10">



                            {/* SECTION 연습라운드 통계 */}
                            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-5 sm:p-7 shadow-sm space-y-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                                    <div className="flex items-center gap-2">
                                        <Activity size={20} className="text-brand-navy" />
                                        <SectionTitle>연습라운드 통계</SectionTitle>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
                                            <button onClick={() => { setHoleType(9); setExcludedIds(new Set()); }} className={cn("px-4 py-1.5 rounded-lg text-[13px] font-bold transition-all", holeType === 9 ? "bg-white dark:bg-zinc-700 shadow-sm text-brand-navy dark:text-brand-navy-light" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300")}>9홀</button>
                                            <button onClick={() => { setHoleType(18); setExcludedIds(new Set()); }} className={cn("px-4 py-1.5 rounded-lg text-[13px] font-bold transition-all", holeType === 18 ? "bg-white dark:bg-zinc-700 shadow-sm text-brand-navy dark:text-brand-navy-light" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300")}>18홀</button>
                                        </div>
                                        <span className={cn(
                                            "text-xs font-black px-2.5 py-0.5 rounded-full border hidden sm:inline-block",
                                            isDemoData
                                                ? "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/20"
                                                : "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/20"
                                        )}>
                                            {isDemoData ? "데모 데이터" : `실시간 분석 연동 (${scorecards.length}R)`}
                                        </span>
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden mb-6">
                                    <button onClick={() => setIsTagsExpanded(!isTagsExpanded)} className="w-full px-6 py-4 flex items-center justify-between text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <Activity size={16} className="text-brand-navy dark:text-brand-navy-light" />
                                            조회된 리스트 ({allScorecards.filter(sc => (analysisMap[sc.id]?.length || 0) === holeType).length}건 {excludedIds.size > 0 && `/ 제외 ${excludedIds.size}건`})
                                        </div>
                                        <ChevronRight size={18} className={cn("transition-transform", isTagsExpanded ? "rotate-90" : "")} />
                                    </button>
                                    {isTagsExpanded && (
                                        <div className="px-6 pb-6 pt-4 border-t border-zinc-50 dark:border-zinc-800 flex flex-col gap-4">
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                {allScorecards.filter(sc => (analysisMap[sc.id]?.length || 0) === holeType).map(sc => (
                                                    <button key={sc.id} onClick={() => { const next = new Set(excludedIds); if (next.has(sc.id)) next.delete(sc.id); else next.add(sc.id); setExcludedIds(next); }} className={cn("px-4 py-3 rounded-xl text-[11px] font-bold border transition-all flex items-center justify-between", excludedIds.has(sc.id) ? "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500" : "bg-brand-navy/5 dark:bg-brand-navy/20 border-brand-navy/20 dark:border-brand-navy/30 text-brand-navy dark:text-brand-navy-light")}>
                                                        <div className="flex items-center gap-3 truncate mr-2">
                                                            <span className="shrink-0">{sc.round_date.substring(5).replace('-', '/')}</span>
                                                            <span className={cn("shrink-0", excludedIds.has(sc.id) ? "text-zinc-400 dark:text-zinc-500" : "text-brand-navy dark:text-brand-navy-light font-black")}>{sc.total_score}타</span>
                                                            <span className="truncate opacity-80">{sc.course_name}</span>
                                                        </div>
                                                        {excludedIds.has(sc.id) ? <Plus size={12} className="shrink-0" /> : <X size={12} className="shrink-0" />}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="flex justify-end mt-2">
                                                <button
                                                    onClick={() => { setRefreshTrigger(t => t + 1); setIsTagsExpanded(false); }}
                                                    className="px-6 py-2.5 bg-brand-navy text-white text-[13px] font-black rounded-xl hover:opacity-90 transition-all shadow-sm flex items-center gap-2"
                                                >
                                                    <Activity size={14} />
                                                    조회 및 적용
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {isAnalyzing ? (
                                    <div className="py-12 flex flex-col items-center justify-center">
                                        <Activity className="w-8 h-8 text-brand-navy animate-spin mb-2" />
                                        <p className="text-xs font-bold text-zinc-500">연습라운드 샷 분석 데이터 집계 중...</p>
                                    </div>
                                ) : statsSummary ? (
                                    <div className="space-y-6">
                                        {/* Score Trend Chart */}
                                        {statsSummary.trendData && statsSummary.trendData.length > 0 && (
                                            <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 shadow-sm border border-zinc-100 dark:border-zinc-800">
                                                <div className="flex items-center gap-2 mb-4">
                                                    <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400">
                                                        <Activity size={18} />
                                                    </div>
                                                    <SectionTitle>스코어 추이</SectionTitle>
                                                </div>
                                                <div className="h-[200px] w-full mt-4">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <LineChart data={statsSummary.trendData} margin={{ left: 15, right: 15, top: 10, bottom: 10 }}>
                                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                                            <XAxis
                                                                axisLine={false}
                                                                tickLine={false}
                                                                tick={{ fontSize: 10, fontWeight: 700, fill: '#A1A1AA' }}
                                                                dy={10}
                                                                padding={{ left: 20, right: 20 }}
                                                                interval="preserveStartEnd"
                                                                tickFormatter={(val, index) => statsSummary.trendData[index]?.date || ""}
                                                            />
                                                            <YAxis
                                                                hide
                                                                domain={['dataMin - 5', 'dataMax + 5']}
                                                            />
                                                            <Tooltip
                                                                content={({ active, payload }) => {
                                                                    if (active && payload && payload.length) {
                                                                        return (
                                                                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl shadow-xl">
                                                                                <p className="text-[10px] font-bold text-zinc-400 mb-1">{payload[0].payload.date}</p>
                                                                                <p className="text-sm font-black text-brand-navy">{payload[0].value}타</p>
                                                                            </div>
                                                                        );
                                                                    }
                                                                    return null;
                                                                }}
                                                            />
                                                            <ReferenceLine
                                                                y={72}
                                                                stroke="#1e293b"
                                                                strokeDasharray="3 3"
                                                                label={{
                                                                    position: 'insideBottomLeft',
                                                                    value: 'Even Par',
                                                                    fill: '#1e293b',
                                                                    fontSize: 9,
                                                                    fontWeight: 900
                                                                }}
                                                            />
                                                            <Line
                                                                type="linear"
                                                                dataKey="score"
                                                                stroke="#f97316"
                                                                strokeWidth={3}
                                                                dot={(props: any) => {
                                                                    const { cx, cy, payload } = props;
                                                                    const isUnderPar = payload.score < 72;
                                                                    return (
                                                                        <circle
                                                                            key={`dot-${cx}-${cy}`}
                                                                            cx={cx}
                                                                            cy={cy}
                                                                            r={4}
                                                                            fill={isUnderPar ? "#ef4444" : "#f97316"}
                                                                            stroke="#fff"
                                                                            strokeWidth={2}
                                                                        />
                                                                    );
                                                                }}
                                                                activeDot={{ r: 6, fill: '#f97316', stroke: '#fff', strokeWidth: 2 }}
                                                            />
                                                        </LineChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>
                                        )}

                                        {/* Score Card */}
                                        {(() => {
                                            const par = statsSummary.averagePar || 72;
                                            const rel = Math.round(stats.averageScore - par);
                                            const isUnder = rel < 0;
                                            const isOver = rel > 0;
                                            const colorCls = isUnder ? "text-red-500" : isOver ? "text-blue-500" : "text-zinc-900 dark:text-zinc-50";
                                            return (
                                                <div className={cn(
                                                    "p-6 rounded-[2.5rem] shadow-sm border flex items-center justify-center h-32 relative overflow-hidden transition-all",
                                                    isUnder ? "bg-red-50/30 border-red-100 dark:bg-red-900/10 dark:border-red-800/30" :
                                                        isOver ? "bg-blue-50/30 border-blue-100 dark:bg-blue-900/10 dark:border-blue-800/30" :
                                                            "bg-zinc-50/50 border-zinc-200 dark:bg-zinc-800/20 dark:border-zinc-800"
                                                )}>
                                                    <div className="absolute left-6 text-[11px] font-black uppercase tracking-widest opacity-60 text-zinc-400">Score</div>
                                                    <div className="flex items-baseline gap-2">
                                                        <span className={cn("text-4xl font-black", colorCls)}>{stats.averageScore}</span>
                                                        <span className={cn("text-xl font-bold opacity-80", colorCls)}>
                                                            ({rel > 0 ? `+${rel}` : rel === 0 ? "E" : rel})
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* Three Core Metrics Cards */}
                                        <div className="grid grid-cols-3 gap-4">
                                            <SummaryBox label={<>플레이<br />내용</>} value={statsSummary.playContent} icon={Flag} />
                                            <SummaryBox label={<>내용 대비<br />스코어</>} value={statsSummary.scoreVsContent} icon={Target} />
                                            <SummaryBox label={<>롱/숏게임<br />대비</>} value={statsSummary.longVsShort} icon={Zap} />
                                        </div>

                                        {/* 부문별 스코어 */}
                                        <section className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 shadow-sm border border-zinc-200/60 dark:border-zinc-800/60">
                                            <div className="flex flex-col gap-3 mb-6">
                                                <SectionHeader title="부문별 스코어" icon={Target} className="!mb-0" />
                                                <div className="flex justify-end w-full">
                                                    <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl shrink-0 w-fit">
                                                        <button
                                                            onClick={() => setSectorViewMode('average')}
                                                            className={cn(
                                                                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                                                                sectorViewMode === 'average' ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-50" : "text-zinc-400"
                                                            )}
                                                        >
                                                            평균
                                                        </button>
                                                        <button
                                                            onClick={() => setSectorViewMode('trend')}
                                                            className={cn(
                                                                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                                                                sectorViewMode === 'trend' ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-50" : "text-zinc-400"
                                                            )}
                                                        >
                                                            추이
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {sectorViewMode === 'average' ? (
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                    {statsSummary.sectorChanges.map((sc: any, idx: number) => {
                                                        const isPositive = parseFloat(sc.value) > 0;
                                                        return (
                                                            <div key={idx} className={cn(
                                                                "p-3 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] border flex flex-col gap-2 sm:gap-3 transition-all",
                                                                isPositive ? "bg-blue-50/30 border-blue-100 dark:bg-blue-900/10 dark:border-blue-800/30" : "bg-red-50/30 border-red-100 dark:bg-red-900/10 dark:border-red-800/30"
                                                            )}>
                                                                <div className="flex flex-col">
                                                                    <p className="text-[13px] font-black text-zinc-400 uppercase tracking-tight">{sc.type}</p>
                                                                    <p className={cn("text-2xl font-black tracking-tighter text-right mt-1", isPositive ? "text-blue-500" : "text-red-500")}>
                                                                        {sc.value}
                                                                    </p>
                                                                </div>
                                                                <div className="space-y-1.5 pt-3 mt-1 border-t border-zinc-100/50 dark:border-zinc-800/50">
                                                                    {sc.items.map((item: any, iIdx: number) => (
                                                                        <div key={iIdx} className="flex justify-between items-center text-[13px] font-bold">
                                                                            <span className="text-zinc-500 dark:text-zinc-400">{item.name}</span>
                                                                            <span className={item.sg >= 0 ? "text-blue-500" : "text-red-500"}>
                                                                                {item.sg > 0 ? "+" : ""}{item.sg.toFixed(1)}
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="space-y-6">
                                                    <div className="flex items-center justify-center gap-1 sm:gap-2 pb-2 w-full">
                                                        {([
                                                            { label: '티샷', key: 'teeSG', color: 'bg-blue-500' },
                                                            { label: '세컨샷', key: 'secondSG', color: 'bg-emerald-500' },
                                                            { label: '그린주변', key: 'greenSG', color: 'bg-orange-500' },
                                                            { label: '퍼팅', key: 'puttingSG', color: 'bg-indigo-500' }
                                                        ] as any[]).map((item) => {
                                                            const isActive = activeSector === item.label;
                                                            return (
                                                                <button
                                                                    key={item.label}
                                                                    onClick={() => setActiveSector(item.label)}
                                                                    className={cn(
                                                                        "py-1.5 rounded-full text-[10px] sm:text-[12px] font-bold transition-all flex items-center justify-center gap-1 sm:gap-2 border whitespace-nowrap flex-1 sm:flex-none sm:px-4",
                                                                        isActive
                                                                            ? "bg-zinc-900 text-white border-zinc-900 shadow-sm dark:bg-zinc-50 dark:text-zinc-900"
                                                                            : "bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 dark:hover:bg-zinc-700"
                                                                    )}
                                                                >
                                                                    <div className={cn("w-1.5 h-1.5 rounded-full", item.color)} />
                                                                    {item.label}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>

                                                    {statsSummary.trendData && statsSummary.trendData.length > 0 ? (
                                                        <div className="h-[250px] w-full mt-4">
                                                            <ResponsiveContainer width="100%" height="100%">
                                                                <LineChart data={statsSummary.trendData} margin={{ left: 0, right: 10, top: 10, bottom: 10 }}>
                                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                                                    <XAxis
                                                                        axisLine={false}
                                                                        tickLine={false}
                                                                        tick={{ fontSize: 10, fontWeight: 700, fill: '#A1A1AA' }}
                                                                        dy={10}
                                                                        padding={{ left: 15, right: 15 }}
                                                                        tickFormatter={(val, index) => statsSummary.trendData[index]?.date || ""}
                                                                    />
                                                                    <YAxis
                                                                        axisLine={false}
                                                                        tickLine={false}
                                                                        tick={{ fontSize: 10, fontWeight: 700, fill: '#A1A1AA' }}
                                                                        width={35}
                                                                    />
                                                                    <Tooltip
                                                                        content={({ active, payload }) => {
                                                                            if (active && payload && payload.length) {
                                                                                const val = payload[0].value;
                                                                                return (
                                                                                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl shadow-xl">
                                                                                        <p className="text-[10px] font-bold text-zinc-400 mb-1">{payload[0].payload.date}</p>
                                                                                        <p className={cn("text-sm font-black", (val as number) >= 0 ? "text-blue-500" : "text-red-500")}>
                                                                                            {(val as number) > 0 ? "+" : ""}{(val as number).toFixed(1)}
                                                                                        </p>
                                                                                    </div>
                                                                                );
                                                                            }
                                                                            return null;
                                                                        }}
                                                                    />
                                                                    <ReferenceLine y={0} stroke="#ef4444" strokeWidth={2} />
                                                                    <Line
                                                                        type="linear"
                                                                        dataKey={
                                                                            activeSector === '티샷' ? 'teeSG' :
                                                                                activeSector === '세컨샷' ? 'secondSG' :
                                                                                    activeSector === '그린주변' ? 'greenSG' : 'puttingSG'
                                                                        }
                                                                        stroke={
                                                                            activeSector === '티샷' ? '#3b82f6' :
                                                                                activeSector === '세컨샷' ? '#10b981' :
                                                                                    activeSector === '그린주변' ? '#f97316' : '#6366f1'
                                                                        }
                                                                        strokeWidth={3}
                                                                        dot={{ r: 4, fill: '#fff', strokeWidth: 2 }}
                                                                        activeDot={{ r: 6, strokeWidth: 0 }}
                                                                    />
                                                                </LineChart>
                                                            </ResponsiveContainer>
                                                        </div>
                                                    ) : (
                                                        <div className="py-10 text-center">
                                                            <p className="text-zinc-400 font-bold text-sm">추이 데이터가 부족합니다.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </section>

                                        {/* Detailed category bar chart */}
                                        <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 shadow-sm border border-zinc-100 dark:border-zinc-850">
                                            <div className="flex flex-col gap-3 mb-6">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400">
                                                        <BarChart3 size={18} />
                                                    </div>
                                                    <SectionTitle>부문별 세부 항목</SectionTitle>
                                                </div>
                                                <div className="flex justify-end w-full">
                                                    <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl w-fit">
                                                        <button onClick={() => setMode("score")} className={cn("px-4 py-1.5 rounded-lg text-xs font-bold transition-all", mode === "score" ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-50" : "text-zinc-400")}>점수</button>
                                                        <button onClick={() => setMode("contribution")} className={cn("px-4 py-1.5 rounded-lg text-xs font-bold transition-all", mode === "contribution" ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-50" : "text-zinc-400")}>기여도</button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="space-y-1.5 pt-2 relative">
                                                <div
                                                    className={cn(
                                                        "absolute top-0 bottom-0 w-[2px] bg-zinc-200 dark:bg-zinc-800 z-0 transition-all",
                                                        mode === "score"
                                                            ? "left-[calc(50%+45px)] sm:left-[calc(50%+50px)]"
                                                            : "left-[90px] sm:left-[100px]"
                                                    )}
                                                />
                                                {statsSummary.contributions.map((item: any, idx: number) => {
                                                    const val = mode === "score" ? item.sg : item.percent;
                                                    const widthPct = Math.min((Math.abs(val) / (mode === "score" ? 2.5 : 40)) * 45, 45);
                                                    return (
                                                        <div key={idx} className="relative z-10 flex items-center h-6">
                                                            <div className="w-[90px] sm:w-[100px] flex justify-start pl-3 text-[11px] sm:text-[13px] font-bold text-zinc-500 whitespace-nowrap shrink-0">{item.name}</div>
                                                            <div className="flex-1 relative h-full flex items-center">
                                                                {mode === "score" ? (
                                                                    item.sg < 0 ? (
                                                                        <>
                                                                            <div className="absolute right-[50%] h-4 bg-red-500 rounded-sm" style={{ width: `${widthPct}%` }} />
                                                                            <span className="absolute left-[52%] text-[10px] font-black text-red-500">{formatScore(item.sg, 1)}</span>
                                                                        </>
                                                                    ) : item.sg > 0 ? (
                                                                        <>
                                                                            <div className="absolute left-[50%] h-4 bg-blue-500 rounded-sm" style={{ width: `${widthPct}%` }} />
                                                                            <span className="absolute right-[52%] text-[10px] font-black text-blue-500">{formatScore(item.sg, 1)}</span>
                                                                        </>
                                                                    ) : (
                                                                        <span className="absolute left-[52%] text-[10px] font-black text-blue-500">{formatScore(item.sg, 1)}</span>
                                                                    )
                                                                ) : (
                                                                    <div className="flex items-center w-full">
                                                                        <div className={cn("h-4 rounded-sm", item.sg < 0 ? "bg-red-500" : "bg-blue-500")} style={{ width: `${item.percent * 1.5}%` }} />
                                                                        <span className={cn("ml-2 text-[10px] font-black", item.sg < 0 ? "text-red-500" : "text-blue-500")}>{Math.round(item.percent * 10) / 10}%</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* 주요 평균 지표 */}
                                        <section className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 shadow-sm border border-zinc-200/60 dark:border-zinc-800/60">
                                            <SectionHeader title="주요 평균 지표" icon={TrendingDown} />
                                            <div className="grid grid-cols-2 gap-4">
                                                {statsSummary.avgMetrics.map((m: any, idx: number) => (
                                                    <IndicatorCard
                                                        key={idx}
                                                        label={m.label}
                                                        value={m.value}
                                                        unit={m.unit}
                                                        icon={Activity}
                                                    />
                                                ))}
                                            </div>
                                        </section>

                                        {/* Strong / Challenge Point Cards */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-7 shadow-sm border border-zinc-200/60 dark:border-zinc-800/60 flex flex-col items-start justify-start gap-1">
                                                <div className="flex items-center gap-2 mb-4">
                                                    <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/10 flex items-center justify-center text-red-500">
                                                        <TrophyIcon size={18} />
                                                    </div>
                                                    <SectionTitle>Strong Point</SectionTitle>
                                                </div>
                                                <h3 className="w-full text-center text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tighter leading-tight mt-2 flex-1 flex items-center justify-center">{statsSummary.strongPoint}</h3>
                                            </div>
                                            <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-7 shadow-sm border border-zinc-200/60 dark:border-zinc-800/60 flex flex-col items-start justify-start gap-1">
                                                <div className="flex items-center gap-2 mb-4">
                                                    <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-brand-navy dark:text-brand-navy-light">
                                                        <TrendingDown size={18} />
                                                    </div>
                                                    <SectionTitle>Challenge Point</SectionTitle>
                                                </div>
                                                <div className="space-y-4 flex flex-col items-start w-full mt-2 flex-1 justify-center">
                                                    <div className="flex items-center gap-4">
                                                        <span className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[12px] font-black text-zinc-500 shrink-0">1</span>
                                                        <span className="text-[20px] font-black text-zinc-800 dark:text-zinc-200 tracking-tight">{statsSummary.challengePoint1}</span>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <span className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[12px] font-black text-zinc-500 shrink-0">2</span>
                                                        <span className="text-[20px] font-black text-zinc-800 dark:text-zinc-200 tracking-tight">{statsSummary.challengePoint2}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                ) : (
                                    <div className="text-center py-10 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
                                        <AlertCircle size={24} className="mx-auto text-zinc-300 mb-2" />
                                        <p className="text-xs text-zinc-400">해당 월에 완료한 연습 라운드 스코어카드가 없습니다.</p>
                                    </div>
                                )}
                            </section>

                            {/* SECTION 레슨 히스토리 */}
                            {(() => {
                                const coreLessons = lessons.filter((lesson: any) => lesson.is_core_lesson);

                                if (coreLessons.length === 0) return null;

                                return (
                                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-5 sm:p-7 shadow-sm space-y-6">
                                        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
                                            <div className="flex items-center gap-2">
                                                <Award size={20} className="text-brand-navy" />
                                                <SectionTitle>핵심 레슨</SectionTitle>
                                            </div>
                                            <span className="text-xs text-zinc-400 font-bold">{Number(selectedMonth.split('-')[1])}월 레슨 총 {lessons.length}건</span>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {coreLessons.map((lesson) => (
                                                <div key={lesson.id} className="p-5 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl shadow-sm hover:border-brand-navy/30 transition-all">
                                                    <ReportLessonDetail lessonId={lesson.id} />
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                );
                            })()}






                        </div>

                        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-5 sm:p-7 shadow-sm">
                            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-6">
                                <div className="flex items-center gap-2">
                                    <MessageSquare size={20} className="text-brand-navy" />
                                    <SectionTitle>담임 코치 종합 피드백</SectionTitle>
                                </div>
                            </div>

                            <div className="mb-6 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-2xl p-5 border border-indigo-100 dark:border-indigo-900/30">
                                <div className="flex items-center gap-2 mb-3 text-indigo-700 dark:text-indigo-400 font-bold text-sm">
                                    <Info size={16} />
                                    <span>코치 총평 작성시 내용 참고</span>
                                </div>
                                <ul className="space-y-2.5 text-[13px] font-medium text-zinc-600 dark:text-zinc-400 ml-1">
                                    <li className="flex items-center gap-2.5"><div className="w-1.5 h-1.5 rounded-full bg-indigo-400/50" /> 담당 코치명 작성</li>
                                    <li className="flex items-center gap-2.5"><div className="w-1.5 h-1.5 rounded-full bg-indigo-400/50" /> 이번 달 핵심 평가</li>
                                    <li className="flex items-center gap-2.5"><div className="w-1.5 h-1.5 rounded-full bg-indigo-400/50" /> 기술적인 변화 (구체적으로)</li>
                                    <li className="flex items-center gap-2.5"><div className="w-1.5 h-1.5 rounded-full bg-indigo-400/50" /> 현재의 문제점 / 보완점</li>
                                    <li className="flex items-center gap-2.5"><div className="w-1.5 h-1.5 rounded-full bg-indigo-400/50" /> 훈련 태도 및 참여도</li>
                                    <li className="flex items-center gap-2.5"><div className="w-1.5 h-1.5 rounded-full bg-indigo-400/50" /> 다음 달 목표 / 방향</li>
                                </ul>
                            </div>

                            <div className="min-h-[200px]">
                                <FeedbackEditor
                                    value={coachFeedback}
                                    onChange={setCoachFeedback}
                                />
                            </div>
                        </section>

                        <div className="flex justify-end pt-4 print:hidden w-full">
                            <button
                                onClick={handleSaveReport}
                                disabled={isSaving}
                                className="bg-brand-red hover:bg-brand-red-dark disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-400 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-colors shadow-sm flex items-center justify-center gap-1.5 whitespace-nowrap"
                            >
                                {isSaving ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        등록중
                                    </>
                                ) : (
                                    "레포트 등록"
                                )}
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 shadow-sm">
                        <div className="flex flex-col gap-4 mb-4">
                            <div className="flex items-center gap-2">
                                {["ALL", "조이마루", "구미"].map(branch => (
                                    <button
                                        key={branch}
                                        onClick={() => setBranchFilter(branch)}
                                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${branchFilter === branch ? 'bg-brand-navy text-white shadow-md' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'}`}
                                    >
                                        {branch}
                                    </button>
                                ))}
                            </div>
                            <div className="flex items-center gap-2 px-2 w-full justify-between sm:justify-start sm:w-auto flex-wrap">
                                <div className="flex items-center gap-2">
                                    <Users size={20} className="text-zinc-400" />
                                    <h3 className="font-bold text-lg">{branchFilter === "ALL" ? "전체" : branchFilter} 지점 선수 목록</h3>
                                </div>
                                <div className="flex items-center gap-2 ml-auto">
                                    <select
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value as any)}
                                        className="px-3 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-navy/40"
                                    >
                                        <option value="ALL">상태</option>
                                        <option value="COMPLETED">완료</option>
                                        <option value="INCOMPLETE">미작성</option>
                                    </select>
                                    <select
                                        value={coachFilter}
                                        onChange={(e) => setCoachFilter(e.target.value)}
                                        className="px-3 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-navy/40"
                                    >
                                        <option value="ALL">전체 코치</option>
                                        {availableCoaches.map(coach => (
                                            <option key={coach} value={coach}>{coach}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            {filteredAthletes.length > 0 ? (
                                filteredAthletes.map(athlete => (
                                    <div key={athlete.id} className="flex items-center justify-between p-4 rounded-2xl bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800/50 dark:hover:bg-zinc-800 transition-colors border border-zinc-100 dark:border-zinc-700/50">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-white dark:bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-200 dark:border-zinc-700 shadow-sm shrink-0">
                                                <User size={18} className="text-zinc-400" />
                                            </div>
                                            <div>
                                                <div className="font-black text-[15px]">{athlete.name} <span className="text-xs font-medium text-zinc-500 ml-1">{athlete.branch}</span></div>
                                                <div className="text-xs text-zinc-500 mt-0.5">담임 코치: {assignedCoaches[athlete.id] || "미지정"}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {reportStatuses[athlete.id] && (
                                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                                                    <CheckCircle2 size={14} />
                                                    <span className="text-xs font-bold">완료</span>
                                                </div>
                                            )}
                                            <button
                                                onClick={() => {
                                                    window.history.pushState({ reportDetail: true }, "");
                                                    setSelectedAthleteId(athlete.id);
                                                    setExcludedIds(new Set());
                                                }}
                                                className="p-2.5 rounded-xl bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300 hover:text-brand-navy hover:border-brand-navy dark:hover:text-white transition-all shadow-sm group"
                                            >
                                                <Pencil size={18} className="group-hover:scale-110 transition-transform" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="py-12 text-center text-zinc-500 text-sm">조건에 맞는 선수가 없습니다.</div>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}