"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
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
import { LessonHistoryModal } from "@/components/training-plan/LessonHistoryModal";
import { PageTitle, SectionTitle, LabelText } from "@/components/ui/Typography";
import { fetchLatestLessonsPerCategory, fetchAllLessonsByPlayer, LessonRecord } from "@/lib/lesson-sync";
import { fetchPlans, savePlan, calculateShotRatio, PlanType, PLAN_TYPE_LABELS, fetchPlansByAthlete, Plan, fetchPlanById, updatePlan, getPlainText } from "@/lib/plan-sync";
import { createClient } from "@/lib/supabase/client";
import { fetchLatestScoreByPlayer, ScoreData } from "@/lib/score-sync";
import { uploadFile } from "@/lib/storage-sync";
import { Target, AlertTriangle, FileText, ChevronRight, TrendingDown, TrendingUp } from "lucide-react";
import { FileUploadButton } from "@/components/ui/FileUploadButton";

const mockPlayers = ["이수진", "최민준", "김지윤", "박도윤", "이지원", "한상욱"];



export default function EditPlanPage() {
    const router = useRouter();
    const params = useParams();
    const { id } = params;

    // ── Form State ──────────────────────────────────────────────────
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedPlayer, setSelectedPlayer] = useState("");
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [trainingDate, setTrainingDate] = useState("");
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [userRole, setUserRole] = useState<string | null>(null);
    const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
    const [existingMedia, setExistingMedia] = useState<string[]>([]);
    const [latestScore, setLatestScore] = useState<ScoreData | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [fetchedPlan, setFetchedPlan] = useState<any>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [currentUserName, setCurrentUserName] = useState<string | null>(null);
    const [playerPlans, setPlayerPlans] = useState<Plan[]>([]);

    // ── Lesson Integration State ─────────────────────────────────────
    const [allLessons, setAllLessons] = useState<LessonRecord[]>([]);
    const [selectedLessons, setSelectedLessons] = useState<Record<string, LessonRecord | null>>({});
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [historyModalTargetPart, setHistoryModalTargetPart] = useState<string>("");

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (id) {
            fetchPlanById(id as string).then(data => {
                if (data) {
                    setFetchedPlan(data);
                    setSelectedPlayer(data.athleteName);
                    setTrainingDate(data.date);
                    setTitle(data.title);
                    setContent(getPlainText(data.content));
                    setExistingMedia(data.media_urls || []);
                }
                setIsLoading(false);
            });
        }
    }, [id]);

    // ── Fetch Player Plans for Ratio ──────────────────────────

    useEffect(() => {
        if (selectedPlayer) {
            fetchPlansByAthlete(selectedPlayer).then(setPlayerPlans);
            fetchAllLessonsByPlayer(selectedPlayer).then(lessons => {
                setAllLessons(lessons);
                if (fetchedPlan && fetchedPlan.linkedLessonIds && fetchedPlan.linkedLessonIds.length > 0) {
                    const initialSelected: Record<string, LessonRecord | null> = {};
                    fetchedPlan.linkedLessonIds.forEach((lessonId: string) => {
                        const lesson = lessons.find(l => l.id === lessonId);
                        if (lesson) {
                            initialSelected[lesson.category] = lesson;
                        }
                    });
                    setSelectedLessons(initialSelected);
                } else {
                    fetchLatestLessonsPerCategory(selectedPlayer).then(latestLessons => {
                        const initialSelected: Record<string, LessonRecord | null> = {};
                        ["shot", "putt", "field", "physical"].forEach(part => {
                            if (latestLessons[part]) {
                                initialSelected[part] = latestLessons[part];
                            }
                        });
                        setSelectedLessons(initialSelected);
                    });
                }
            });
        } else {
            setPlayerPlans([]);
            setAllLessons([]);
            setSelectedLessons({});
        }
    }, [selectedPlayer, fetchedPlan]);


    useEffect(() => {
        setLatestScore(null);
    }, [selectedPlayer, trainingDate]);

    useEffect(() => {
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
            const newMediaUrls: string[] = [];
            for (const file of attachedFiles) {
                const url = await uploadFile(file, 'records', `plan/${Date.now()}`);
                if (url) newMediaUrls.push(url);
            }

            const linkedLessonIds = Object.values(selectedLessons)
                .filter(Boolean)
                .map(l => l!.id);
            const parts = Object.keys(selectedLessons).filter(part => selectedLessons[part] !== null);

            await updatePlan(id as string, {
                title: title || `${selectedPlayer}의 훈련 계획`,
                content,
                date: trainingDate,
                media_urls: [...existingMedia, ...newMediaUrls],
                linkedLessonIds,
                parts,
            });

            alert("수정이 완료되었습니다.");
            router.push(`/admin/training-plan/${id}`);
        } catch (err: any) {
            console.error("Error submitting plan:", err?.message || err);
            alert("수정에 실패했습니다.");
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
                        <PageTitle>훈련계획 수정</PageTitle>
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




                    {/* ── 레슨 연동 (Lesson Integration) ── */}
                    {selectedPlayer && (
                        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm space-y-4">
                            <div className="flex items-center justify-between mb-2">
                                <SectionTitle>
                                    <BookOpen size={16} className="text-brand-navy" />
                                    파트별 집중 훈련 항목
                                </SectionTitle>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {Object.keys(selectedLessons).map(part => (
                                    <LinkedLessonCard
                                        key={part}
                                        part={part}
                                        lesson={selectedLessons[part]}
                                        onRemove={() => {
                                            setSelectedLessons(prev => {
                                                const next = { ...prev };
                                                delete next[part];
                                                return next;
                                            });
                                        }}
                                        onMoreClick={() => {
                                            setHistoryModalTargetPart(part);
                                            setIsHistoryModalOpen(true);
                                        }}
                                    />
                                ))}
                                {/* Button to add a new part if not all parts are present */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setHistoryModalTargetPart("");
                                        setIsHistoryModalOpen(true);
                                    }}
                                    className="border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col items-center justify-center text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:border-brand-navy/30 transition-all min-h-[120px]"
                                >
                                    <span className="text-sm font-bold text-zinc-500 mb-1">+ 다른 파트 레슨 추가</span>
                                </button>
                            </div>
                        </section>
                    )}

                    {/* ── 5. 제목 & 내용 ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm space-y-4">
                        <div className="space-y-2">
                            <LabelText>
                                내용 <span className="text-brand-red">*</span>
                            </LabelText>
                            <textarea
                                rows={6}
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder={placeholderText}
                                className="w-full p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all resize-y"
                            />
                        </div>
                    </section>

                    {/* ── 6. 첨부파일 ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm space-y-3">
                        <LabelText>첨부파일</LabelText>
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center w-fit gap-2 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                        >
                            <Upload size={16} className="text-zinc-500" />
                            파일 추가
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept="image/*,video/*"
                            className="hidden"
                            onChange={handleFileChange}
                        />

                        {existingMedia.length > 0 && (
                            <div className="space-y-2 mt-3">
                                <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">기존 첨부파일</p>
                                <ul className="grid grid-cols-2 gap-2">
                                    {existingMedia.map((url, idx) => {
                                        const isVideo = url.toLowerCase().includes('.mp4') || url.toLowerCase().includes('.mov') || url.toLowerCase().includes('.webm');
                                        return (
                                            <li key={idx} className="relative aspect-video rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 group">
                                                {isVideo ? (
                                                    <video src={url} className="w-full h-full object-cover" />
                                                ) : (
                                                    <img src={url} alt="기존 파일" className="w-full h-full object-cover" />
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => setExistingMedia(prev => prev.filter((_, i) => i !== idx))}
                                                    className="absolute top-1.5 right-1.5 p-1 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        )}

                        {attachedFiles.length > 0 && (
                            <ul className="space-y-2 mt-3">
                                {attachedFiles.map((file, idx) => (
                                    <li
                                        key={idx}
                                        className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <Paperclip size={14} className="text-zinc-400 shrink-0" />
                                            <span className="text-xs text-zinc-700 dark:text-zinc-300 truncate">
                                                {file.name}
                                            </span>
                                            <span className="text-[10px] text-zinc-400 shrink-0">
                                                ({(file.size / 1024).toFixed(0)} KB)
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeFile(idx)}
                                            className="shrink-0 p-1 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-600 transition-colors"
                                        >
                                            <X size={14} />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {attachedFiles.length === 0 && existingMedia.length === 0 && (
                            <p className="text-xs text-zinc-400 text-center mt-2">선택된 파일 없음</p>
                        )}
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
                            disabled={!isValid}
                            className={cn(
                                "px-6 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm",
                                isValid
                                    ? "bg-brand-red hover:bg-brand-red-dark text-white active:scale-95"
                                    : "bg-zinc-200 dark:bg-zinc-700 text-zinc-400 cursor-not-allowed"
                            )}
                        >
                            수정 완료
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
        </div>

    );
}