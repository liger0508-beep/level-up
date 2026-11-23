"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    ChevronLeft,
    Calendar,
    Upload,
    X,
    Search,
    BookOpen,
    Paperclip,
    CheckCircle2,
    Trophy,
    BarChart3,
    ArrowRight,
    Flag,
} from "lucide-react";
import { cn, formatLocalDate } from "@/lib/utils";
import { DatePickerInput } from "@/components/ui/DatePickerInput";
import { AthleteSearch } from "@/components/ui/AthleteSearch";

import { LinkedLessonCard } from "@/components/training-plan/LinkedLessonCard";
import { LinkedJournalCard } from "@/components/training-plan/LinkedJournalCard";
import { LinkedPlanCard } from "@/components/training-plan/LinkedPlanCard";
import { LessonHistoryModal } from "@/components/lesson/LessonHistoryModal";
import { JournalHistoryModal } from "@/components/training-plan/JournalHistoryModal";
import { PlanHistoryModal } from "@/components/training-plan/PlanHistoryModal";
import { PageTitle, SectionTitle, LabelText } from "@/components/ui/Typography";
import { fetchRecentLessonsByPlayer, fetchAllLessonsByPlayer, LessonRecord } from "@/lib/lesson-sync";
import { fetchPlans, savePlan, calculateShotRatio, PlanType, PLAN_TYPE_LABELS, fetchPlansByAthlete, Plan } from "@/lib/plan-sync";
import { fetchJournalsByAthlete, Journal, JOURNAL_TYPE_LABELS, JOURNAL_TYPE_COLORS } from "@/lib/journal-sync";
import { createClient } from "@/lib/supabase/client";
import { fetchLatestScoreByPlayer, ScoreData } from "@/lib/score-sync";
import { uploadFile } from "@/lib/storage-sync";
import { Target, AlertTriangle, FileText, ChevronRight, TrendingDown, TrendingUp, Activity, MapPin } from "lucide-react";
import ReferenceDataModal from "@/components/lesson/ReferenceDataModal";

function extractGoalFromContent(content: string): string {
    if (!content) return "";
    const goalIndex = content.indexOf("[목표 설정]");
    if (goalIndex === -1) return "";
    let afterGoal = content.substring(goalIndex + "[목표 설정]".length);
    const nextMarkerRegex = /\n\s*\[(분석 내용 - 선수|분석 내용 - 코치|메모|교정 후)\]/;
    const match = afterGoal.match(nextMarkerRegex);
    if (match && match.index !== undefined) {
        afterGoal = afterGoal.substring(0, match.index);
    }
    return afterGoal.trim();
}

const mockPlayers = ["이수진", "최민준", "김지윤", "박도윤", "이지원", "한상욱"];

const partOptions = [
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

export default function CreatePlanPage() {
    const router = useRouter();

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedPlayer, setSelectedPlayer] = useState("");
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [trainingDate, setTrainingDate] = useState(() =>
        formatLocalDate()
    );
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [userRole, setUserRole] = useState<string | null>(null);
    const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
    const [latestScore, setLatestScore] = useState<ScoreData | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [currentUserName, setCurrentUserName] = useState<string | null>(null);
    const [playerPlans, setPlayerPlans] = useState<Plan[]>([]);
    const [recentLessons, setRecentLessons] = useState<LessonRecord[]>([]);
    const [allLessons, setAllLessons] = useState<LessonRecord[]>([]);
    const [allAnalyses, setAllAnalyses] = useState<LessonRecord[]>([]);

    // Journal State
    const [recentJournal, setRecentJournal] = useState<Journal | null>(null);
    const [allJournals, setAllJournals] = useState<Journal[]>([]);
    const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
    const [isReferenceModalOpen, setIsReferenceModalOpen] = useState(false);

    // Plan State
    const [recentPlan, setRecentPlan] = useState<Plan | null>(null);
    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);

    // Goal, Analysis, Lesson History Modals
    const [isGoalHistoryModalOpen, setIsGoalHistoryModalOpen] = useState(false);
    const [isAnalysisHistoryModalOpen, setIsAnalysisHistoryModalOpen] = useState(false);
    const [analysisHistorySelectedPart, setAnalysisHistorySelectedPart] = useState<string>("all");
    const [analysisHistorySearchQuery, setAnalysisHistorySearchQuery] = useState("");
    const [analysisHistoryDisplayLimit, setAnalysisHistoryDisplayLimit] = useState(10);

    const [isLessonHistoryModalOpen, setIsLessonHistoryModalOpen] = useState(false);
    const [historySelectedPart, setHistorySelectedPart] = useState<string>("all");
    const [historySearchQuery, setHistorySearchQuery] = useState("");
    const [historyDisplayLimit, setHistoryDisplayLimit] = useState(10);

    const analysisGoals = useMemo(() => {
        return allAnalyses
            .map(a => ({
                id: a.id,
                category: a.category,
                created_at: a.created_at,
                coachName: a.coachName,
                goal: extractGoalFromContent(a.content),
            }))
            .filter(item => item.goal.length > 0);
    }, [allAnalyses]);

    const latestGoal = analysisGoals[0] || null;

    const analysisModalPartOptions = useMemo(
        () => partOptions.filter(opt => !["pitch", "bunker", "physical", "field", "etc"].includes(opt.key)),
        []
    );

    const fileInputRef = useRef<HTMLInputElement>(null);

    const PLAN_TEMP_KEY = "plan_create_temp";

    useEffect(() => {
        const temp = sessionStorage.getItem(PLAN_TEMP_KEY);
        if (temp) {
            try {
                const data = JSON.parse(temp);
                if (data.selectedPlayer) setSelectedPlayer(data.selectedPlayer);
                if (data.trainingDate) setTrainingDate(data.trainingDate);
                if (data.title) setTitle(data.title);
                if (data.content) setContent(data.content);
            } catch (e) { }
        }
    }, []);

    const isInitialMount = useRef(true);

    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        const data = { selectedPlayer, trainingDate, title, content };
        sessionStorage.setItem(PLAN_TEMP_KEY, JSON.stringify(data));
    }, [selectedPlayer, trainingDate, title, content]);

    // ── Fetch Player Plans, Lessons, Analyses, Journals ──────────────────────────

    useEffect(() => {
        if (selectedPlayer) {
            fetchPlansByAthlete(selectedPlayer).then(plans => {
                setPlayerPlans(plans);
                if (plans.length > 0) {
                    setRecentPlan(plans[0]);
                } else {
                    setRecentPlan(null);
                }
            });
            fetchRecentLessonsByPlayer(selectedPlayer, undefined, "lesson").then(setRecentLessons);
            fetchAllLessonsByPlayer(selectedPlayer, undefined, historyDisplayLimit).then(setAllLessons);
            fetchAllLessonsByPlayer(selectedPlayer, undefined, 50, "analysis").then(setAllAnalyses);
            fetchJournalsByAthlete(selectedPlayer).then(journals => {
                setAllJournals(journals);
                if (journals.length > 0) {
                    setRecentJournal(journals[0]);
                } else {
                    setRecentJournal(null);
                }
            });
        } else {
            setPlayerPlans([]);
            setRecentPlan(null);
            setRecentLessons([]);
            setAllLessons([]);
            setAllAnalyses([]);
            setRecentJournal(null);
            setAllJournals([]);
        }
    }, [selectedPlayer, historyDisplayLimit]);


    useEffect(() => {
        if (selectedPlayer) {
            fetchLatestScoreByPlayer(selectedPlayer, trainingDate).then(setLatestScore);
        } else {
            setLatestScore(null);
        }
    }, [selectedPlayer, trainingDate]);

    useEffect(() => {
        if (sessionStorage.getItem('openLessonHistoryModal') === 'true') {
            setIsLessonHistoryModalOpen(true);
            sessionStorage.removeItem('openLessonHistoryModal');
        }
        if (sessionStorage.getItem('openJournalHistoryModal') === 'true') {
            setIsJournalModalOpen(true);
            sessionStorage.removeItem('openJournalHistoryModal');
        }

        const supabase = createClient();
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) {
                setCurrentUserId(user.id);
                supabase.from("users")
                    .select("role, name")
                    .eq("id", user.id)
                    .single()
                    .then(({ data }) => {
                        if (data) {
                            setUserRole(data.role);
                            setCurrentUserName(data.name);
                            if (data.role === "athlete") {
                                setSelectedPlayer(data.name);
                            }
                        }
                    });
            }
        });
    }, []);

    // ── Player Filter ────────────────────────────────────────────────
    const visiblePlayers = useMemo(
        () => mockPlayers.filter((p) => p.includes(searchQuery)),
        [searchQuery]
    );

    const handlePlayerSelect = (name: string) => {
        setSelectedPlayer(name);
        setSearchQuery("");
        setIsDropdownOpen(false);
    };

    // ── Shot Ratio ───────────────────────────────────────────────────


    // ── File Upload ──────────────────────────────────────────────────
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setAttachedFiles((prev) => [...prev, ...newFiles]);
        }
        e.target.value = "";
    };

    const removeFile = (index: number) => {
        setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
    };

    // ── Submit ───────────────────────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPlayer || isSubmitting) return;

        try {
            setIsSubmitting(true);
            const supabase = createClient();

            // 1. Get athlete's user_id
            const { data: athleteData } = await supabase
                .from("users")
                .select("id")
                .eq("name", selectedPlayer)
                .limit(1)
                .single();

            if (!athleteData) throw new Error("선수 정보를 찾을 수 없습니다.");

            // 2. Upload files
            const media_urls: string[] = [];
            for (const file of attachedFiles) {
                const url = await uploadFile(file, 'records', `plan/${Date.now()}`);
                if (url) media_urls.push(url);
            }


            // 3. Save Plan
            const latestLesson = recentLessons[0];
            const linkedLessonIds = latestLesson ? [latestLesson.id] : [];
            const parts = latestLesson?.category ? [latestLesson.category] : [];

            await savePlan({
                type: "all",
                title: title || `${selectedPlayer}의 훈련 계획`,
                content,
                date: trainingDate,
                userId: athleteData.id,
                coachId: userRole === 'athlete' ? athleteData.id : (currentUserId || ""),
                isImportant: false, // Default
                media_urls,
                linkedLessonIds,
                parts,
            });

            fetch("/api/push/trigger", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    eventType: "training_plan_created",
                    relatedUserIds: [athleteData.id],
                    variables: {
                        athleteName: selectedPlayer,
                        coachName: currentUserName || "코치",
                        title: title || `${selectedPlayer}의 훈련 계획`,
                    },
                    url: "/admin/training-plan",
                }),
            }).catch(() => {});


            sessionStorage.removeItem(PLAN_TEMP_KEY);

            alert("훈련계획가 등록되었습니다.");
            sessionStorage.removeItem(PLAN_TEMP_KEY);
            router.push("/admin/training-plan");
        } catch (err: any) {
            console.error("Error submitting plan:", err?.message || err);
            alert("등록에 실패했습니다.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const placeholderText = "훈련 내용을 상세히 기록해 주세요";

    const isValid = !!trainingDate && !!content.trim();

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4 sm:px-8 py-6">
            <div className="max-w-2xl mx-auto">

                {/* ── Page Header ── */}
                <div className="flex items-center gap-3 mb-8">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-50 transition-colors"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <div className="flex items-center gap-2">
                        <BookOpen size={22} className="text-brand-navy dark:text-brand-navy-light" />
                        <PageTitle>훈련계획 작성</PageTitle>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">

                    {/* ── 1. 선수 선택 ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm space-y-3">
                        <LabelText>선수 선택</LabelText>
                        {userRole === "athlete" ? (
                            <div className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-sm font-bold text-zinc-900 dark:text-zinc-100">
                                {selectedPlayer}
                            </div>
                        ) : (
                            <AthleteSearch
                                multi={false}
                                selectedNames={selectedPlayer ? [selectedPlayer] : []}
                                onSelect={(name: string) => setSelectedPlayer(name)}
                                onRemove={() => setSelectedPlayer("")}
                                placeholder="선수 이름 검색..."
                            />
                        )}
                    </section>

                    {/* ── 2. 계획 작성일자 ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm space-y-3">
                        <LabelText>
                            계획 작성일자 <span className="text-brand-red">*</span>
                        </LabelText>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                            <DatePickerInput
                                value={trainingDate}
                                onChange={(e) => setTrainingDate(e.target.value)}
                                required
                                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all"
                            />
                        </div>
                    </section>




                    {/* ── 1. 목표 (Analysis Goal Box) ── */}
                    {selectedPlayer && (
                        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 rounded-2xl shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <SectionTitle>
                                    <Flag size={18} className="text-amber-500" /> 목표
                                </SectionTitle>
                            </div>
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl flex flex-col relative transition-all hover:border-brand-navy/30">
                                {latestGoal ? (
                                    <>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-black px-2 py-0.5 rounded-md bg-brand-navy/10 text-brand-navy dark:bg-brand-navy/20 dark:text-brand-navy-light uppercase">
                                                    {latestGoal.category}
                                                </span>
                                                {latestGoal.coachName && (
                                                    <span className="text-xs font-medium text-zinc-500">{latestGoal.coachName}</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex-1 min-h-0 flex flex-col">
                                            <div className="text-sm text-zinc-900 dark:text-zinc-100 mt-2 mb-2 whitespace-pre-wrap break-words">
                                                {latestGoal.goal}
                                            </div>
                                            <div className="text-[10px] text-zinc-400 mt-2">
                                                {latestGoal.created_at ? new Date(latestGoal.created_at).toLocaleDateString() : ""}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex-1 min-h-[60px] flex items-center justify-center text-xs text-zinc-400 italic">
                                        등록된 목표가 없습니다.
                                    </div>
                                )}

                                {analysisGoals.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                                        <div />
                                        <button
                                            type="button"
                                            onClick={() => setIsGoalHistoryModalOpen(true)}
                                            className="flex items-center gap-1 text-[11px] font-bold text-zinc-500 hover:text-brand-navy transition-colors"
                                        >
                                            <FileText size={12} />
                                            더보기 (이전 목표 보기)
                                            <ChevronRight size={12} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    {/* ── 2. 최근 분석 기록 (Analysis History Box) ── */}
                    {selectedPlayer && (
                        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 rounded-2xl shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <SectionTitle>
                                    <FileText size={18} className="text-brand-navy dark:text-brand-navy-light" /> 최근 분석 기록
                                </SectionTitle>
                            </div>
                            <LinkedLessonCard
                                part={allAnalyses[0]?.category || "shot"}
                                lesson={allAnalyses[0] || null}
                                onMoreClick={() => setIsAnalysisHistoryModalOpen(true)}
                                moreText="더보기 (다른 분석 찾기)"
                                emptyText="선택된 분석 기록이 없습니다."
                                readOnly={false}
                            />
                        </section>
                    )}

                    {/* ── 3. 최근 레슨 기록 (Recent Lesson History Box) ── */}
                    {selectedPlayer && (
                        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 rounded-2xl shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <SectionTitle>
                                    <FileText size={18} className="text-brand-navy dark:text-brand-navy-light" /> 최근 레슨 기록
                                </SectionTitle>
                            </div>
                            <LinkedLessonCard
                                part={recentLessons[0]?.category || "shot"}
                                lesson={recentLessons[0] || null}
                                onMoreClick={() => setIsLessonHistoryModalOpen(true)}
                                readOnly={false}
                            />
                        </section>
                    )}

                    {/* ── 4. 최근 라운드 기록 (Recent Round Summary) ── */}
                    {selectedPlayer && (
                        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 rounded-2xl shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <SectionTitle>
                                    <BookOpen size={18} className="text-brand-navy dark:text-brand-navy-light" /> 최근 라운드 기록
                                </SectionTitle>
                                <button
                                    type="button"
                                    onClick={() => setIsReferenceModalOpen(true)}
                                    className="text-xs font-bold text-zinc-500 hover:text-brand-navy flex items-center gap-1 transition-colors"
                                >
                                    <FileText size={12} /> 더보기 <ChevronRight size={12} />
                                </button>
                            </div>
                            {latestScore ? (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-zinc-500 pl-[26px]">
                                        <Calendar size={12} />
                                        <span>{latestScore.date.substring(5)}</span>
                                        <div className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600"></div>
                                        <MapPin size={12} />
                                        <span>{latestScore.courseName}</span>
                                    </div>
                                    {/* SCORE Banner */}
                                    {(() => {
                                        const scoreDiff = latestScore.score - (latestScore.totalPar || 72);
                                        const scoreDiffStr = scoreDiff > 0 ? `+${scoreDiff}` : scoreDiff === 0 ? "E" : `${scoreDiff}`;
                                        const isUnderPar = scoreDiff < 0;
                                        const isOverPar = scoreDiff > 0;
                                        const scoreBgClass = isUnderPar ? "bg-red-50 border-red-100" : isOverPar ? "bg-blue-50 border-blue-100" : "bg-zinc-100 border-zinc-200";
                                        const scoreTextClass = isUnderPar ? "text-red-500" : isOverPar ? "text-blue-500" : "text-zinc-900";

                                        return (
                                            <section className={cn("border rounded-[3rem] p-6 sm:p-10 flex flex-col items-center justify-center relative overflow-hidden shadow-sm", scoreBgClass)}>
                                                <div className={cn("absolute right-0 top-0 opacity-[0.03] pointer-events-none transform translate-x-1/4 -translate-y-1/4", scoreTextClass)}>
                                                    <Activity size={240} strokeWidth={1} />
                                                </div>

                                                <div className={cn("flex items-center gap-2 mb-2 font-bold text-sm tracking-widest relative z-10 uppercase self-start sm:self-center", scoreTextClass)}>
                                                    <Activity size={18} /> SCORE
                                                </div>

                                                <div className="flex flex-row items-baseline gap-1.5 sm:gap-2 relative z-10 text-brand-navy mt-1 sm:mt-2 whitespace-nowrap">
                                                        <div className="flex items-baseline gap-1.5 sm:gap-2">
                                                            <span className={cn("text-2xl font-black tracking-tighter", scoreTextClass)}>{latestScore.score}</span>
                                                            <span className={cn("text-lg font-bold", scoreTextClass)}>
                                                                ({scoreDiffStr})
                                                            </span>
                                                        </div>
                                                        <span className="text-sm font-bold text-zinc-500 ml-1 sm:ml-2">/ par {latestScore.totalPar || 72}</span>
                                                    </div>

                                                </section>
                                        );
                                    })()}

                                    {/* 부문별 스코어 */}
                                    {latestScore.sectorChanges && (
                                        <section className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 shadow-sm border border-zinc-200/60 dark:border-zinc-800/60">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400">
                                                        <Target size={18} />
                                                    </div>
                                                    <SectionTitle>부문별 스코어</SectionTitle>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                {latestScore.sectorChanges.map((sc: any, idx: number) => {
                                                    const isPositive = parseFloat(sc.value) > 0;
                                                    return (
                                                        <div key={idx} className={cn(
                                                            "p-3 sm:p-4 rounded-[1.5rem] sm:rounded-[2rem] border flex flex-col gap-2 sm:gap-3 transition-all",
                                                            isPositive ? "bg-blue-50/30 border-blue-100" : "bg-red-50/30 border-red-100"
                                                        )}>
                                                            <div className="flex flex-col">
                                                                <p className="text-[13px] font-black text-zinc-400 uppercase tracking-tight">{sc.type}</p>
                                                                <p className={cn("text-2xl font-black tracking-tighter text-right mt-1", isPositive ? "text-blue-500" : "text-red-500")}>
                                                                    {sc.value}
                                                                </p>
                                                            </div>
                                                            <div className="space-y-1.5 pt-3 mt-1 border-t border-zinc-100/50">
                                                                {sc.items.map((item: any, iIdx: number) => {
                                                                    const isItemPos = parseFloat(item.sg) > 0;
                                                                    return (
                                                                        <div key={iIdx} className="flex justify-between items-center text-[12px] sm:text-[13px] font-bold tracking-tight">
                                                                            <span className="text-zinc-500 whitespace-nowrap">{item.name}</span>
                                                                            <span className={isItemPos ? "text-blue-500" : "text-red-500"}>
                                                                                {isItemPos ? "+" : ""}{item.sg.toFixed(1)}
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </section>
                                    )}
                                </div>
                            ) : (
                                <div className="text-sm text-zinc-400 py-8 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
                                    최근 라운드 정보가 없습니다.
                                </div>
                            )}
                        </section>
                    )}

                    {/* ── 5. 훈련계획 (Recent Plan) ── */}
                    {selectedPlayer && (
                        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm space-y-4">
                            <div className="flex items-center justify-between mb-2">
                                <SectionTitle>
                                    <FileText size={18} className="text-brand-navy dark:text-brand-navy-light" /> 훈련 계획
                                </SectionTitle>
                            </div>

                            <LinkedPlanCard
                                plan={recentPlan}
                                onMoreClick={() => setIsPlanModalOpen(true)}
                                onRemove={() => setRecentPlan(null)}
                                readOnly={false}
                            />
                        </section>
                    )}

                    {/* ── 6. 훈련일지 (Recent Journal) ── */}
                    {selectedPlayer && (
                        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm space-y-4">
                            <div className="flex items-center justify-between mb-2">
                                <SectionTitle>
                                    <FileText size={18} className="text-brand-navy dark:text-brand-navy-light" /> 훈련 일지
                                </SectionTitle>
                            </div>

                            <LinkedJournalCard
                                journal={recentJournal}
                                onMoreClick={() => setIsJournalModalOpen(true)}
                                onRemove={() => setRecentJournal(null)}
                                readOnly={false}
                            />
                        </section>
                    )}

                    {/* ── 5. 제목 & 내용 ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm space-y-4">
                        <div className="space-y-2">
                            <LabelText>
                                핵심 훈련 내용 <span className="text-brand-red">*</span>
                            </LabelText>
                            <textarea
                                rows={6}
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="오늘 훈련할 핵심 내용을 기록해 주세요"
                                className="w-full p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all resize-y"
                            />
                        </div>
                    </section>


                    {/* ── Actions ── */}
                    <div className="flex items-center justify-end gap-3 pt-2 pb-8">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={!isValid || isSubmitting}
                            className={cn(
                                "px-6 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm",
                                (isValid && !isSubmitting)
                                    ? "bg-brand-red hover:bg-brand-red-dark text-white active:scale-95"
                                    : "bg-zinc-200 dark:bg-zinc-700 text-zinc-400 cursor-not-allowed"
                            )}
                        >
                            {isSubmitting ? "등록 중..." : "등록하기"}
                        </button>
                    </div>

                </form>
            </div>

            {/* Lesson History Modal */}
            <LessonHistoryModal
                isOpen={isLessonHistoryModalOpen}
                onClose={() => setIsLessonHistoryModalOpen(false)}
                allLessons={allLessons}
                historySelectedPart={historySelectedPart}
                setHistorySelectedPart={setHistorySelectedPart}
                historySearchQuery={historySearchQuery}
                setHistorySearchQuery={setHistorySearchQuery}
                historyDisplayLimit={historyDisplayLimit}
                setHistoryDisplayLimit={setHistoryDisplayLimit}
                connectedLessonId={null}
                setConnectedLessonId={() => {}}
                partOptions={partOptions}
                readOnly={true}
            />

            {/* Analysis History Modal */}
            <LessonHistoryModal
                isOpen={isAnalysisHistoryModalOpen}
                onClose={() => setIsAnalysisHistoryModalOpen(false)}
                allLessons={allAnalyses}
                historySelectedPart={analysisHistorySelectedPart}
                setHistorySelectedPart={setAnalysisHistorySelectedPart}
                historySearchQuery={analysisHistorySearchQuery}
                setHistorySearchQuery={setAnalysisHistorySearchQuery}
                historyDisplayLimit={analysisHistoryDisplayLimit}
                setHistoryDisplayLimit={setAnalysisHistoryDisplayLimit}
                connectedLessonId={null}
                setConnectedLessonId={() => {}}
                partOptions={analysisModalPartOptions}
                readOnly={true}
                title="최근 분석 기록 찾아보기"
                itemType="analysis"
            />

            {/* Analysis Goal History Modal */}
            {isGoalHistoryModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setIsGoalHistoryModalOpen(false)}>
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
                        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 shrink-0">
                            <div className="flex items-center gap-3">
                                <button type="button" onClick={() => setIsGoalHistoryModalOpen(false)} className="p-1.5 text-zinc-400 hover:text-zinc-900 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 transition-colors">
                                    <ChevronLeft size={20} />
                                </button>
                                <SectionTitle>
                                    <Flag size={18} className="text-amber-500" /> 목표 기록 찾아보기
                                </SectionTitle>
                            </div>
                            <button type="button" onClick={() => setIsGoalHistoryModalOpen(false)} className="p-1.5 text-zinc-400 hover:text-zinc-600 rounded-lg">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4 sm:p-5 space-y-3 overflow-y-auto flex-1 bg-zinc-50/50 dark:bg-zinc-900/30">
                            {analysisGoals.map((item) => (
                                <div
                                    key={item.id}
                                    onClick={() => router.push(`/analysis/${item.id}`)}
                                    className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 hover:border-amber-400/70 rounded-2xl p-4 sm:p-5 shadow-sm transition-all cursor-pointer space-y-2"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase px-2 py-0.5 bg-amber-500/10 rounded-md">
                                                {item.category}
                                            </span>
                                            {item.coachName && (
                                                <span className="text-xs font-medium text-zinc-500">
                                                    {item.coachName}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-xs text-zinc-400 font-medium">
                                            {item.created_at ? new Date(item.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }).slice(2).replace(/-/g, '.') : ""}
                                        </span>
                                    </div>
                                    <p className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-line leading-relaxed">
                                        {item.goal}
                                    </p>
                                </div>
                            ))}
                            {analysisGoals.length === 0 && (
                                <div className="py-10 text-center text-zinc-500 text-sm">
                                    등록된 분석 목표가 없습니다.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <JournalHistoryModal
                isOpen={isJournalModalOpen}
                onClose={() => setIsJournalModalOpen(false)}
                allJournals={allJournals}
                readOnly={false}
                onSelectJournal={(journalId) => {
                    const journal = allJournals.find(j => j.id === journalId);
                    if (journal) {
                        setRecentJournal(journal);
                    }
                    setIsJournalModalOpen(false);
                }}
                connectedJournalId={recentJournal?.id}
            />
            <PlanHistoryModal
                isOpen={isPlanModalOpen}
                onClose={() => setIsPlanModalOpen(false)}
                allPlans={playerPlans}
                readOnly={false}
                onSelectPlan={(planId) => {
                    const plan = playerPlans.find(p => p.id === planId);
                    if (plan) {
                        setRecentPlan(plan);
                    }
                    setIsPlanModalOpen(false);
                }}
                connectedPlanId={recentPlan?.id}
            />
            <ReferenceDataModal
                isOpen={isReferenceModalOpen}
                onClose={() => setIsReferenceModalOpen(false)}
                playerName={selectedPlayer}
            />
        </div>

    );
}