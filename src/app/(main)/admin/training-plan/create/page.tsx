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
} from "lucide-react";
import { cn, formatLocalDate } from "@/lib/utils";
import { DatePickerInput } from "@/components/ui/DatePickerInput";
import { AthleteSearch } from "@/components/ui/AthleteSearch";

import { LinkedLessonCard } from "@/components/training-plan/LinkedLessonCard";
import { LinkedJournalCard } from "@/components/training-plan/LinkedJournalCard";
import { LessonHistoryModal } from "@/components/training-plan/LessonHistoryModal";
import { JournalHistoryModal } from "@/components/training-plan/JournalHistoryModal";
import { PageTitle, SectionTitle, LabelText } from "@/components/ui/Typography";
import { fetchLatestLessonsPerCategory, fetchAllLessonsByPlayer, LessonRecord } from "@/lib/lesson-sync";
import { fetchPlans, savePlan, calculateShotRatio, PlanType, PLAN_TYPE_LABELS, fetchPlansByAthlete, Plan } from "@/lib/plan-sync";
import { fetchJournalsByAthlete, Journal, JOURNAL_TYPE_LABELS, JOURNAL_TYPE_COLORS } from "@/lib/journal-sync";
import { createClient } from "@/lib/supabase/client";
import { fetchLatestScoreByPlayer, ScoreData } from "@/lib/score-sync";
import { uploadFile } from "@/lib/storage-sync";
import { Target, AlertTriangle, FileText, ChevronRight, TrendingDown, TrendingUp, Activity, MapPin } from "lucide-react";
import { CategoryTabs } from "@/components/ui/CategoryTabs";
import ReferenceDataModal from "@/components/lesson/ReferenceDataModal";

const mockPlayers = ["이수진", "최민준", "김지윤", "박도윤", "이지원", "한상욱"];

const partOptions = [
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

    // ── Form State ──────────────────────────────────────────────────
    const [searchQuery, setSearchQuery] = useState("");
    const [planSearchQuery, setPlanSearchQuery] = useState("");
    const [planSelectedPart, setPlanSelectedPart] = useState<string>("shot");
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
    const [allLessons, setAllLessons] = useState<LessonRecord[]>([]);

    // Journal State
    const [recentJournal, setRecentJournal] = useState<Journal | null>(null);
    const [allJournals, setAllJournals] = useState<Journal[]>([]);
    const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
    const [isReferenceModalOpen, setIsReferenceModalOpen] = useState(false);

    // ── Lesson Integration State ─────────────────────────────────────
    const [selectedLessons, setSelectedLessons] = useState<Record<string, LessonRecord | null>>({});
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [historyModalTargetPart, setHistoryModalTargetPart] = useState<string>("");

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
        const data = { selectedPlayer, trainingDate, title, content, selectedLessons };
        sessionStorage.setItem(PLAN_TEMP_KEY, JSON.stringify(data));
    }, [selectedPlayer, trainingDate, title, content, selectedLessons]);

    // ── Fetch Player Plans for Ratio ──────────────────────────

    useEffect(() => {
        if (selectedPlayer) {
            fetchPlansByAthlete(selectedPlayer).then(setPlayerPlans);
            fetchAllLessonsByPlayer(selectedPlayer).then(setAllLessons);
            fetchLatestLessonsPerCategory(selectedPlayer).then(lessons => {
                // Initialize selectedLessons with the latest for each part
                const initialSelected: Record<string, LessonRecord | null> = {};
                partOptions.forEach(opt => {
                    if (lessons[opt.key]) {
                        initialSelected[opt.key] = lessons[opt.key];
                    }
                });
                setSelectedLessons(initialSelected);
            });
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
            setAllLessons([]);
            setSelectedLessons({});
            setRecentJournal(null);
            setAllJournals([]);
        }
    }, [selectedPlayer]);


    useEffect(() => {
        if (selectedPlayer) {
            fetchLatestScoreByPlayer(selectedPlayer, trainingDate).then(setLatestScore);
        } else {
            setLatestScore(null);
        }
    }, [selectedPlayer, trainingDate]);

    useEffect(() => {
        if (sessionStorage.getItem('openLessonHistoryModal') === 'true') {
            setIsHistoryModalOpen(true);
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
            const linkedLessonIds = Object.values(selectedLessons)
                .filter(Boolean)
                .map(l => l!.id);
            const parts = Object.keys(selectedLessons).filter(part => selectedLessons[part] !== null);

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




                    {/* ── 최근 훈련 일지 (Recent Journal) ── */}
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

                    {/* ── 최근 라운드 정보 (Recent Round Summary) ── */}
                    {selectedPlayer && (
                        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 rounded-2xl shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <SectionTitle>
                                    <BookOpen size={18} className="text-brand-navy dark:text-brand-navy-light" /> 최근 라운드 정보
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

                    {/* ── 레슨 연동 (Lesson Integration) ── */}
                    {selectedPlayer && (
                        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm space-y-4">
                            <div className="flex items-center justify-between mb-4">
                                <SectionTitle>
                                    <BookOpen size={16} className="text-brand-navy" />
                                    파트별 레슨 내용
                                </SectionTitle>
                            </div>
                            <CategoryTabs options={partOptions} value={planSelectedPart} onChange={setPlanSelectedPart} />
                            <div className="relative w-full mt-2 mb-4">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="레슨 내용 검색..."
                                    value={planSearchQuery}
                                    onChange={(e) => setPlanSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all"
                                />
                            </div>
                            <div className="grid grid-cols-1 gap-4">
                                {(() => {
                                    if (!planSelectedPart) return null;

                                    if (planSearchQuery) {
                                        const searchResults = allLessons.filter(l =>
                                            l.category === planSelectedPart &&
                                            l.content.toLowerCase().includes(planSearchQuery.toLowerCase())
                                        ).slice(0, 5);

                                        if (searchResults.length === 0) {
                                            return <div className="text-sm text-zinc-500 py-8 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">검색 결과가 없습니다.</div>;
                                        }

                                        return searchResults.map(lesson => (
                                            <div key={lesson.id} onClick={() => {
                                                setSelectedLessons(prev => ({ ...prev, [lesson.category]: lesson }));
                                                setPlanSearchQuery("");
                                            }} className="cursor-pointer hover:ring-2 hover:ring-brand-navy rounded-2xl transition-all ring-offset-2 dark:ring-offset-zinc-950">
                                                <LinkedLessonCard part={lesson.category} lesson={lesson} readOnly />
                                            </div>
                                        ));
                                    }

                                    const lesson = selectedLessons[planSelectedPart];
                                    if (!lesson) {
                                        return (
                                            <div className="flex flex-col items-center justify-center text-zinc-400 min-h-[120px] bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800/50">
                                                <span className="text-sm font-semibold text-zinc-500">레슨 내용이 없습니다</span>
                                            </div>
                                        );
                                    }

                                    return (
                                        <LinkedLessonCard
                                            part={planSelectedPart}
                                            lesson={lesson}
                                            onMoreClick={() => {
                                                setHistoryModalTargetPart(planSelectedPart);
                                                setIsHistoryModalOpen(true);
                                            }}
                                        />
                                    );
                                })()}
                            </div>
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

            <LessonHistoryModal
                isOpen={isHistoryModalOpen}
                onClose={() => setIsHistoryModalOpen(false)}
                allLessons={allLessons}
                initialPart={historyModalTargetPart}
                connectedLessonId={historyModalTargetPart ? selectedLessons[historyModalTargetPart]?.id : null}
                readOnly={false}
                onSelectLesson={(lessonId) => {
                    const lesson = allLessons.find(l => l.id === lessonId);
                    if (lesson) {
                        setSelectedLessons(prev => ({
                            ...prev,
                            [lesson.category]: lesson
                        }));
                    }
                    setIsHistoryModalOpen(false);
                }}
            />

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
            <ReferenceDataModal
                isOpen={isReferenceModalOpen}
                onClose={() => setIsReferenceModalOpen(false)}
                playerName={selectedPlayer}
            />
        </div>

    );
}