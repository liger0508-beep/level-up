"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { Plus, ChevronLeft, Calendar, FileText, Image as ImageIcon, Upload, Flag, Search, X, ChevronDown, ChevronUp, Paperclip, CheckCircle2, Check, Video, BookOpen, LineChart, Sparkles, RotateCcw, MessageSquare } from "lucide-react";
import { CategoryTabs } from "@/components/ui/CategoryTabs";
import { FileUploadButton } from "@/components/ui/FileUploadButton";
import { PageTitle, SectionTitle, LabelText, BodyText, Caption } from "@/components/ui/Typography";
import { LessonType } from "@/components/lesson/LessonCard";
import { cn } from "@/lib/utils";
import { DatePickerInput } from "@/components/ui/DatePickerInput";
import { TopicPickerSheet } from "@/components/ui/TopicPickerSheet";
import { AthleteSearch } from "@/components/ui/AthleteSearch";
import { createClient } from "@/lib/supabase/client";
import { LessonTemplate, fetchLessonTemplates } from "@/lib/lesson-template-sync";
import { fetchRecentLessonsByPlayer, fetchRecentScorecard, updateLessonRecord, LessonRecord, fetchAllLessonsByPlayer } from "@/lib/lesson-sync";
import { uploadFiles } from "@/lib/storage-sync";
import { parseMediaUrls } from "@/lib/analysis-sync";
import { CustomVideoPlayer } from "@/components/ui/CustomVideoPlayer";
import ReferenceDataModal from "@/components/lesson/ReferenceDataModal";
import { LinkedLessonCard } from "@/components/training-plan/LinkedLessonCard";
import { LessonHistoryModal } from "@/components/lesson/LessonHistoryModal";
import { VoiceInputButton } from "@/components/ui/VoiceInputButton";

const partOptions: { key: LessonType; label: string }[] = [
    { key: "shot", label: "Shot" },
    { key: "approach", label: "Approach" },
    { key: "putt", label: "Putt" },
];

const analysisModalPartOptions: { key: string; label: string }[] = [
    { key: "all", label: "ALL" },
    { key: "shot", label: "Shot" },
    { key: "approach", label: "Approach" },
    { key: "putt", label: "Putt" },
];

const lessonModalPartOptions: { key: string; label: string }[] = [
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

export default function EditAnalysisPage() {
    const router = useRouter();
    const params = useParams();
    const { id } = params;

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [selectedPlayer, setSelectedPlayer] = useState("");
    const [lessonDate, setLessonDate] = useState("");
    const [selectedPart, setSelectedPart] = useState<LessonType | "">("");
    const [goalContent, setGoalContent] = useState("");
    const [lessonContent, setLessonContent] = useState("");
    const [coachContent, setCoachContent] = useState("");
    const [memoContent, setMemoContent] = useState("");
    const [existingMemo, setExistingMemo] = useState("");
    const [coachId, setCoachId] = useState<string | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

    // AI Helper States
    const [goalAiLoadingMode, setGoalAiLoadingMode] = useState<"summarize" | "expand" | null>(null);
    const [aiLoadingMode, setAiLoadingMode] = useState<"summarize" | "expand" | null>(null);
    const [coachAiLoadingMode, setCoachAiLoadingMode] = useState<"summarize" | "expand" | null>(null);
    const [prevGoalContent, setPrevGoalContent] = useState<string | null>(null);
    const [prevLessonContent, setPrevLessonContent] = useState<string | null>(null);
    const [prevCoachContent, setPrevCoachContent] = useState<string | null>(null);

    // Templates (Swing Errors)
    const [dbTemplates, setDbTemplates] = useState<LessonTemplate[]>([]);
    const [selectedImages, setSelectedImages] = useState<string[]>([]);
    const [isTemplateSheetOpen, setIsTemplateSheetOpen] = useState(false);

    // Media (Files)
    const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
    const [existingMediaUrls, setExistingMediaUrls] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // After Lesson
    const [afterLessonContent, setAfterLessonContent] = useState("");
    const [afterAttachedFiles, setAfterAttachedFiles] = useState<File[]>([]);
    const [existingAfterMediaUrls, setExistingAfterMediaUrls] = useState<string[]>([]);
    const afterFileInputRef = useRef<HTMLInputElement>(null);

    // Material
    const [materialFiles, setMaterialFiles] = useState<File[]>([]);
    const [existingMaterialUrls, setExistingMaterialUrls] = useState<string[]>([]);
    const materialFileInputRef = useRef<HTMLInputElement>(null);

    // Recent History (Analyses & Lessons Separated)
    const [recentAnalyses, setRecentAnalyses] = useState<LessonRecord[]>([]);
    const [recentLessons, setRecentLessons] = useState<LessonRecord[]>([]);
    const [allAnalyses, setAllAnalyses] = useState<LessonRecord[]>([]);
    const [allLessons, setAllLessons] = useState<LessonRecord[]>([]);
    const [recentScorecard, setRecentScorecard] = useState<any | null>(null);

    // Modals
    const [isAnalysisHistoryModalOpen, setIsAnalysisHistoryModalOpen] = useState(false);
    const [isLessonHistoryModalOpen, setIsLessonHistoryModalOpen] = useState(false);
    const [isReferenceModalOpen, setIsReferenceModalOpen] = useState(false);
    const [analysisHistorySelectedPart, setAnalysisHistorySelectedPart] = useState<string>("all");
    const [analysisHistorySearchQuery, setAnalysisHistorySearchQuery] = useState("");
    const [analysisHistoryDisplayLimit, setAnalysisHistoryDisplayLimit] = useState(10);

    const [lessonHistorySelectedPart, setLessonHistorySelectedPart] = useState<string>("all");
    const [lessonHistorySearchQuery, setLessonHistorySearchQuery] = useState("");
    const [lessonHistoryDisplayLimit, setLessonHistoryDisplayLimit] = useState(10);

    const handleResumeNavigate = (url: string) => {
        const DRAFT_KEY = `analysis_edit_draft_${id}`;
        const draft = {
            selectedPart,
            lessonDate,
            goalContent,
            lessonContent,
            coachContent,
            memoContent,
            selectedImages
        };
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        const separator = url.includes("?") ? "&" : "?";
        router.push(`${url}${separator}resumeEdit=${id}`);
    };

    // Fetch initial data
    useEffect(() => {
        const fetchInitialData = async () => {
            if (!id) return;
            setIsLoading(true);
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    setCurrentUserId(user.id);
                    const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
                    if (profile?.role) setCurrentUserRole(profile.role);
                }

                const { data, error } = await supabase
                    .from("records")
                    .select(`*, user:users!records_user_id_fkey(name)`)
                    .eq("id", id)
                    .single();

                if (error) throw error;
                setCoachId(data.coach_id || null);

                const templates = await fetchLessonTemplates();
                setDbTemplates(templates);

                const DRAFT_KEY = `analysis_edit_draft_${id}`;
                const draftStr = sessionStorage.getItem(DRAFT_KEY);
                let draftData = null;
                if (draftStr) {
                    try {
                        draftData = JSON.parse(draftStr);
                    } catch (e) { }
                    sessionStorage.removeItem(DRAFT_KEY);
                }

                let rawContent = data.content || "";
                let memoContentFromData = "";
                const memoIndex = rawContent.indexOf("[메모]");
                if (memoIndex !== -1) {
                    memoContentFromData = rawContent.substring(memoIndex + "[메모]".length).trim();
                    rawContent = rawContent.substring(0, memoIndex).trim();
                }

                let coachContentFromData = "";
                const coachIndex = rawContent.indexOf("[분석 내용 - 코치]");
                if (coachIndex !== -1) {
                    coachContentFromData = rawContent.substring(coachIndex + "[분석 내용 - 코치]".length).trim();
                    rawContent = rawContent.substring(0, coachIndex).trim();
                }

                let goalContentFromData = "";
                let playerContentFromData = rawContent;
                const goalIndex = playerContentFromData.indexOf("[목표 설정]");
                if (goalIndex !== -1) {
                    const playerIndex = playerContentFromData.indexOf("[분석 내용 - 선수]");
                    if (playerIndex !== -1) {
                        goalContentFromData = playerContentFromData.substring(goalIndex + "[목표 설정]".length, playerIndex).trim();
                        playerContentFromData = playerContentFromData.substring(playerIndex + "[분석 내용 - 선수]".length).trim();
                    } else {
                        goalContentFromData = playerContentFromData.substring(goalIndex + "[목표 설정]".length).trim();
                        playerContentFromData = "";
                    }
                } else {
                    const playerIndex = playerContentFromData.indexOf("[분석 내용 - 선수]");
                    if (playerIndex !== -1) {
                        playerContentFromData = playerContentFromData.substring(playerIndex + "[분석 내용 - 선수]".length).trim();
                    }
                }

                setSelectedPlayer(data.user?.name || "");
                setLessonDate(draftData?.lessonDate || ((data.created_at) ? new Date(data.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }) : "") || "");
                setSelectedPart(draftData?.selectedPart || data.category as LessonType || "");
                setGoalContent(draftData?.goalContent !== undefined ? draftData.goalContent : goalContentFromData);
                setLessonContent(draftData?.lessonContent !== undefined ? draftData.lessonContent : playerContentFromData);
                setCoachContent(draftData?.coachContent !== undefined ? draftData.coachContent : coachContentFromData);
                setMemoContent(draftData?.memoContent !== undefined ? draftData.memoContent : memoContentFromData);
                setExistingMemo(memoContentFromData);
                setAfterLessonContent("");

                const allMedia = parseMediaUrls(data.media_urls);
                const fileUrls = allMedia.filter(url => !url.startsWith('template:') && !url.startsWith('after:') && !url.startsWith('material:'));
                const afterUrls = allMedia.filter(url => url.startsWith('after:')).map(url => url.replace('after:', ''));
                const materialUrls = allMedia.filter(url => url.startsWith('material:')).map(url => url.replace('material:', ''));
                const templateIds = allMedia
                    .filter(url => url.startsWith('template:'))
                    .map(url => url.replace('template:', ''));

                setExistingMediaUrls(fileUrls);
                setExistingAfterMediaUrls(afterUrls);
                setExistingMaterialUrls(materialUrls);

                if (draftData?.selectedImages) {
                    setSelectedImages(draftData.selectedImages);
                } else {
                    setSelectedImages(templateIds);
                }

                // Fetch history if player exists
                if (data.user?.name) {
                    const [analyses, lessons, allA, allL, scorecard] = await Promise.all([
                        fetchRecentLessonsByPlayer(data.user.name, undefined, "analysis"),
                        fetchRecentLessonsByPlayer(data.user.name, undefined, "lesson"),
                        fetchAllLessonsByPlayer(data.user.name, undefined, 10, "analysis"),
                        fetchAllLessonsByPlayer(data.user.name, undefined, 10, "lesson"),
                        fetchRecentScorecard(data.user.name)
                    ]);
                    setRecentAnalyses(analyses);
                    setRecentLessons(lessons);
                    setAllAnalyses(allA);
                    setAllLessons(allL);
                    setRecentScorecard(scorecard);
                }

            } catch (err) {
                console.error("Failed to fetch analysis details:", err);
                alert("분석 정보를 불러오는데 실패했습니다.");
                router.back();
            } finally {
                setIsLoading(false);
            }
        };

        fetchInitialData();
    }, [id, router]);

    const handlePlayerSelect = async (name: string) => {
        setSelectedPlayer(name);
        const [analyses, lessons, allA, allL, scorecard] = await Promise.all([
            fetchRecentLessonsByPlayer(name, undefined, "analysis"),
            fetchRecentLessonsByPlayer(name, undefined, "lesson"),
            fetchAllLessonsByPlayer(name, undefined, 10, "analysis"),
            fetchAllLessonsByPlayer(name, undefined, 10, "lesson"),
            fetchRecentScorecard(name)
        ]);
        setRecentAnalyses(analyses);
        setRecentLessons(lessons);
        setAllAnalyses(allA);
        setAllLessons(allL);
        setRecentScorecard(scorecard);
    };

    useEffect(() => {
        if (selectedPlayer) {
            fetchAllLessonsByPlayer(selectedPlayer, undefined, analysisHistoryDisplayLimit, "analysis").then(setAllAnalyses);
        }
    }, [selectedPlayer, analysisHistoryDisplayLimit]);

    useEffect(() => {
        if (selectedPlayer) {
            fetchAllLessonsByPlayer(selectedPlayer, undefined, lessonHistoryDisplayLimit, "lesson").then(setAllLessons);
        }
    }, [selectedPlayer, lessonHistoryDisplayLimit]);

    // AI Helpers
    const handleGoalAiHelper = async (mode: "summarize" | "expand") => {
        if (!goalContent.trim()) {
            alert("먼저 목표 설정 내용을 간단히 입력해 주세요.");
            return;
        }
        setGoalAiLoadingMode(mode);
        try {
            const res = await fetch("/api/ai/lesson-helper", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: goalContent,
                    mode,
                    category: selectedPart,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "AI 처리 실패");

            setPrevGoalContent(goalContent);
            setGoalContent(data.result);
        } catch (err: any) {
            alert(err?.message || "AI 처리 중 오류가 발생했습니다.");
        } finally {
            setGoalAiLoadingMode(null);
        }
    };

    const handleAiHelper = async (mode: "summarize" | "expand") => {
        if (!lessonContent.trim()) {
            alert("먼저 분석 내용을 간단히 입력해 주세요.");
            return;
        }
        setAiLoadingMode(mode);
        try {
            const res = await fetch("/api/ai/lesson-helper", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: lessonContent,
                    mode,
                    category: selectedPart,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "AI 처리 실패");

            setPrevLessonContent(lessonContent);
            setLessonContent(data.result);
        } catch (err: any) {
            alert(err?.message || "AI 처리 중 오류가 발생했습니다.");
        } finally {
            setAiLoadingMode(null);
        }
    };

    const handleCoachAiHelper = async (mode: "summarize" | "expand") => {
        if (!coachContent.trim()) {
            alert("먼저 코치 분석 내용을 간단히 입력해 주세요.");
            return;
        }
        setCoachAiLoadingMode(mode);
        try {
            const res = await fetch("/api/ai/lesson-helper", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: coachContent,
                    mode,
                    category: selectedPart,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "AI 처리 실패");

            setPrevCoachContent(coachContent);
            setCoachContent(data.result);
        } catch (err: any) {
            alert(err?.message || "AI 처리 중 오류가 발생했습니다.");
        } finally {
            setCoachAiLoadingMode(null);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const filesArray = Array.from(e.target.files);
            setAttachedFiles(prev => [...prev, ...filesArray]);
        }
    };

    const removeFile = (index: number) => {
        setAttachedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const removeExistingMedia = (index: number) => {
        setExistingMediaUrls(prev => prev.filter((_, i) => i !== index));
    };

    const handleAfterFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const filesArray = Array.from(e.target.files);
            setAfterAttachedFiles(prev => [...prev, ...filesArray]);
        }
    };

    const removeAfterFile = (index: number) => {
        setAfterAttachedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const removeExistingAfterMedia = (index: number) => {
        setExistingAfterMediaUrls(prev => prev.filter((_, i) => i !== index));
    };

    const handleMaterialFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const filesArray = Array.from(e.target.files);
            setMaterialFiles(prev => [...prev, ...filesArray]);
        }
    };

    const removeMaterialFile = (index: number) => {
        setMaterialFiles(prev => prev.filter((_, i) => i !== index));
    };

    const removeExistingMaterial = (index: number) => {
        setExistingMaterialUrls(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPlayer || !selectedPart || !lessonDate || isSubmitting) return;

        setIsSubmitting(true);
        try {
            let newMediaUrls: string[] = [];
            if (attachedFiles.length > 0) {
                newMediaUrls = await uploadFiles(attachedFiles, 'records');
            }

            let newAfterMediaUrls: string[] = [];
            if (afterAttachedFiles.length > 0) {
                newAfterMediaUrls = await uploadFiles(afterAttachedFiles, 'records');
            }

            let newMaterialUrls: string[] = [];
            if (materialFiles.length > 0) {
                newMaterialUrls = await uploadFiles(materialFiles, 'records');
            }

            // Format templates
            const templateUrls = selectedImages.map(tid => `template:${tid}`);
            const afterFormattedUrls = [...existingAfterMediaUrls, ...newAfterMediaUrls].map(url => `after:${url}`);
            const materialFormattedUrls = [...existingMaterialUrls, ...newMaterialUrls].map(url => `material:${url}`);

            // Combine all media
            const allMedia = [...existingMediaUrls, ...newMediaUrls, ...templateUrls, ...afterFormattedUrls, ...materialFormattedUrls];

            let finalContent = "";
            if (goalContent.trim()) {
                finalContent += `[목표 설정]\n${goalContent.trim()}\n\n[분석 내용 - 선수]\n`;
            }
            finalContent += lessonContent.trim();
            if (coachContent.trim()) {
                finalContent += `\n\n[분석 내용 - 코치]\n${coachContent.trim()}`;
            }
            const isAuthorCheck = Boolean(currentUserId && (coachId === currentUserId || currentUserRole === "super_admin"));
            const finalMemo = isAuthorCheck ? memoContent.trim() : existingMemo;
            if (finalMemo) {
                finalContent += `\n\n[메모]\n${finalMemo}`;
            }

            const updateData: any = {
                playerName: selectedPlayer,
                category: selectedPart as LessonType,
                title: selectedPlayer, // Automatic title
                content: finalContent,
                media_urls: allMedia,
                date: lessonDate,
            };

            await updateLessonRecord(id as string, updateData);

            alert("분석이 성공적으로 수정되었습니다.");
            router.push(`/analysis/${id}`);
            router.refresh();
        } catch (error) {
            console.error("Failed to update analysis:", error);
            alert("분석 수정에 실패했습니다.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center">로딩 중...</div>;
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4 sm:px-8 py-6">
            <div className="max-w-3xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.back()}
                            className="p-2 -ml-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-50 transition-colors"
                        >
                            <ChevronLeft size={24} />
                        </button>
                        <div className="flex items-center gap-2">
                            <LineChart size={24} className="text-brand-navy dark:text-brand-navy-light shrink-0" />
                            <PageTitle>
                                분석 수정
                            </PageTitle>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-2 relative">
                                <LabelText>
                                    선수 선택 <span className="text-brand-red">*</span>
                                </LabelText>
                                <AthleteSearch
                                    multi={false}
                                    selectedNames={selectedPlayer ? [selectedPlayer] : []}
                                    onSelect={(name) => handlePlayerSelect(name)}
                                    onRemove={() => setSelectedPlayer("")}
                                    placeholder="선수 이름을 검색하세요..."
                                />
                            </div>

                            <div className="space-y-2">
                                <LabelText>
                                    분석 일자 <span className="text-brand-red">*</span>
                                </LabelText>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                    <DatePickerInput
                                        value={lessonDate}
                                        onChange={(e) => setLessonDate(e.target.value)}
                                        required
                                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <LabelText>
                                    파트 선택 <span className="text-brand-red">*</span>
                                </LabelText>
                                <CategoryTabs options={partOptions} value={selectedPart} onChange={setSelectedPart} />
                            </div>
                        </div>
                    </section>

                    {/* ── 2. History & Analysis (Conditional) ── */}
                    {selectedPlayer && selectedPart && (
                        <div className="space-y-6">
                            {/* Analysis History Box */}
                            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 rounded-2xl shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <SectionTitle>
                                        <FileText size={18} className="text-brand-navy dark:text-brand-navy-light" /> 최근 분석 기록
                                    </SectionTitle>
                                </div>
                                <LinkedLessonCard
                                    part={selectedPart}
                                    lesson={recentAnalyses.find(l => l.category === selectedPart) || recentAnalyses[0] || null}
                                    onMoreClick={() => setIsAnalysisHistoryModalOpen(true)}
                                    moreText="더보기 (다른 분석 찾기)"
                                    emptyText="선택된 분석 기록이 없습니다."
                                    readOnly={false}
                                />
                            </section>

                            {/* Lesson History Box */}
                            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 rounded-2xl shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <SectionTitle>
                                        <FileText size={18} className="text-brand-navy dark:text-brand-navy-light" /> 최근 레슨 기록
                                    </SectionTitle>
                                </div>
                                <LinkedLessonCard
                                    part={selectedPart}
                                    lesson={recentLessons.find(l => l.category === selectedPart) || recentLessons[0] || null}
                                    onMoreClick={() => setIsLessonHistoryModalOpen(true)}
                                    moreText="더보기 (다른 레슨 찾기)"
                                    emptyText="선택된 레슨 기록이 없습니다."
                                    readOnly={false}
                                />
                            </section>

                            {/* Reference Data Box */}
                            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 rounded-2xl shadow-sm">
                                <div className="flex items-center justify-between">
                                    <SectionTitle>
                                        <BookOpen size={18} className="text-brand-navy dark:text-brand-navy-light" /> 최근 라운드 정보
                                    </SectionTitle>
                                    <button
                                        type="button"
                                        onClick={() => setIsReferenceModalOpen(true)}
                                        className="px-4 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm text-sm font-semibold text-zinc-700 dark:text-zinc-300 text-center hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                                    >
                                        확인하기
                                    </button>
                                </div>
                            </section>
                        </div>
                    )}

                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-6">
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-2">
                            <CheckCircle2 size={20} className="text-zinc-400" /> 교정전 (Before)
                        </h3>

                        <div className="space-y-2">
                            <LabelText>
                                파일 첨부
                            </LabelText>
                            <div className="flex flex-col gap-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                                    {existingMediaUrls.map((url, idx) => (
                                        <div key={`existing-${idx}`} className="relative group rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-black w-full aspect-video">
                                            {/\.(mp4|webm|ogg|mov|MOV|MP4)$/i.test(url) ? (
                                                <CustomVideoPlayer src={url} className="w-full h-full" hideCustomControls />
                                            ) : (
                                                <img src={url} alt="첨부" className="w-full h-full object-contain" />
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => removeExistingMedia(idx)}
                                                className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-red-500 text-white rounded-lg transition-colors opacity-100 z-10"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))}
                                    {attachedFiles.map((file, idx) => {
                                        const url = URL.createObjectURL(file);
                                        return (
                                            <div key={`new-${idx}`} className="relative group rounded-xl overflow-hidden border-2 border-brand-navy border-dashed bg-black w-full aspect-video">
                                                {file.type.startsWith('video/') ? (
                                                    <CustomVideoPlayer src={url} className="w-full h-full" hideCustomControls />
                                                ) : (
                                                    <img src={url} alt="새 첨부" className="w-full h-full object-contain" />
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => removeFile(idx)}
                                                    className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-red-500 text-white rounded-lg transition-colors opacity-100 z-10"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="flex items-center gap-4">
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                    >
                                        <Upload size={16} className="text-zinc-500" /> 파일 추가
                                    </button>
                                    <FileUploadButton label="바로 촬영" icon={<Video size={16} className="text-zinc-500" />} accept="video/*" onChange={handleFileChange} />
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        multiple
                                        className="hidden"
                                        onChange={handleFileChange}
                                        accept="image/*,video/*"
                                    />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* ── 교정후 (After) ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-6">
                        <SectionTitle className="mb-6">
                            <CheckCircle2 size={20} className="text-brand-navy dark:text-brand-navy-light" /> 교정후
                        </SectionTitle>

                        <div className="space-y-2">
                            <LabelText>
                                파일 첨부
                            </LabelText>
                            <div className="flex flex-col gap-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                                    {existingAfterMediaUrls.map((url, idx) => (
                                        <div key={`existing-after-${idx}`} className="relative group rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-black w-full aspect-video">
                                            {/\.(mp4|webm|ogg|mov|MOV|MP4)$/i.test(url) ? (
                                                <CustomVideoPlayer src={url} className="w-full h-full" hideCustomControls />
                                            ) : (
                                                <img src={url} alt="교정후 첨부" className="w-full h-full object-contain" />
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => removeExistingAfterMedia(idx)}
                                                className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-red-500 text-white rounded-lg transition-colors opacity-100 z-10"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))}
                                    {afterAttachedFiles.map((file, idx) => {
                                        const url = URL.createObjectURL(file);
                                        return (
                                            <div key={`new-after-${idx}`} className="relative group rounded-xl overflow-hidden border-2 border-brand-navy border-dashed bg-black w-full aspect-video">
                                                {file.type.startsWith('video/') ? (
                                                    <CustomVideoPlayer src={url} className="w-full h-full" hideCustomControls />
                                                ) : (
                                                    <img src={url} alt="새 교정후 첨부" className="w-full h-full object-contain" />
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => removeAfterFile(idx)}
                                                    className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-red-500 text-white rounded-lg transition-colors opacity-100 z-10"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="flex items-center gap-4">
                                    <button
                                        type="button"
                                        onClick={() => afterFileInputRef.current?.click()}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                    >
                                        <Upload size={16} className="text-zinc-500" /> 파일 추가
                                    </button>
                                    <FileUploadButton label="바로 촬영" icon={<Video size={16} className="text-zinc-500" />} accept="video/*" onChange={handleAfterFileChange} />
                                    <input
                                        type="file"
                                        ref={afterFileInputRef}
                                        multiple
                                        className="hidden"
                                        onChange={handleAfterFileChange}
                                        accept="image/*,video/*"
                                    />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* ── 분석자료 ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-6">
                        <SectionTitle className="mb-6">
                            <FileText size={20} className="text-zinc-500" /> 분석자료
                        </SectionTitle>

                        <div className="space-y-2">
                            <div className="flex flex-col gap-3">
                                {(existingMaterialUrls.length > 0 || materialFiles.length > 0) && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                                        {existingMaterialUrls.map((url, idx) => {
                                            const actualUrl = url.split('?')[0];
                                            const isPdf = actualUrl.toLowerCase().endsWith('.pdf');
                                            const isVideo = /\.(mp4|webm|ogg|mov|MOV|MP4)$/i.test(actualUrl);
                                            const isImage = /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(actualUrl);
                                            const name = decodeURIComponent(actualUrl.split('/').pop() || '첨부 파일');
                                            return (
                                                <div key={`existing-material-${idx}`} className="relative group rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 w-full aspect-video flex items-center justify-center">
                                                    {isVideo ? (
                                                        <CustomVideoPlayer src={url} className="w-full h-full bg-black" hideCustomControls />
                                                    ) : isImage ? (
                                                        <img src={url} alt="분석자료" className="w-full h-full object-contain bg-black" />
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center text-zinc-500 p-4">
                                                            <FileText size={48} className="mb-2 opacity-50 text-brand-navy" />
                                                            <span className="text-sm font-medium text-center truncate w-full px-4">{name}</span>
                                                            <span className="text-[11px] opacity-70">{isPdf ? 'PDF 문서' : '문서 파일'}</span>
                                                        </div>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => removeExistingMaterial(idx)}
                                                        className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-red-500 text-white rounded-lg transition-colors opacity-100 z-20"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                        {materialFiles.map((file, idx) => {
                                            const url = URL.createObjectURL(file);
                                            const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
                                            const isVideo = file.type.startsWith('video/');
                                            const isImage = file.type.startsWith('image/');

                                            return (
                                                <div key={`material-${idx}`} className="relative group rounded-xl overflow-hidden border-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 w-full aspect-video flex items-center justify-center">
                                                    {isVideo ? (
                                                        <CustomVideoPlayer src={url} className="w-full h-full bg-black" hideCustomControls />
                                                    ) : isImage ? (
                                                        <img src={url} alt="분석자료" className="w-full h-full object-contain bg-black" />
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center text-zinc-500 p-4">
                                                            <FileText size={48} className="mb-2 opacity-50 text-brand-navy" />
                                                            <span className="text-sm font-medium text-center truncate w-full px-4">{file.name}</span>
                                                            <span className="text-[11px] opacity-70">{isPdf ? 'PDF 문서' : '문서 파일'}</span>
                                                        </div>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => removeMaterialFile(idx)}
                                                        className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-red-500 text-white rounded-lg transition-colors opacity-100 z-20"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                <div className="flex items-center gap-4">
                                    <button
                                        type="button"
                                        onClick={() => materialFileInputRef.current?.click()}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                    >
                                        <Upload size={16} className="text-zinc-500" /> 파일 추가
                                    </button>
                                    <input
                                        type="file"
                                        ref={materialFileInputRef}
                                        multiple
                                        className="hidden"
                                        onChange={handleMaterialFileChange}
                                        accept="*/*"
                                    />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* ── 스윙오류 ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                <ImageIcon size={18} className="text-orange-500" /> 스윙오류
                            </h3>
                            <button
                                type="button"
                                onClick={() => handleResumeNavigate('/system/lesson-list?mode=select')}
                                className="w-24 shrink-0 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm text-sm font-semibold text-zinc-700 dark:text-zinc-300 text-center hover:bg-zinc-50 dark:hover:bg-zinc-700"
                            >
                                {selectedImages.length > 0 ? "추가" : "찾아보기"}
                            </button>
                        </div>

                        {selectedImages.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-4">
                                {selectedImages.map((val) => {
                                    const template = dbTemplates.find(t => t.id === val);
                                    return (
                                        <span key={val} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300 text-sm font-medium border border-blue-200 dark:border-blue-800/50 shadow-sm">
                                            {template?.title || val}
                                            <button
                                                type="button"
                                                onClick={() => setSelectedImages(prev => prev.filter(v => v !== val))}
                                                className="p-0.5 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800/50 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
                                            >
                                                <X size={14} />
                                            </button>
                                        </span>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    {/* ── 목표 설정 ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <SectionTitle>
                                <Flag size={20} className="text-amber-500" /> 목표 설정
                            </SectionTitle>
                        </div>
                        <div className="flex flex-col gap-3">
                            <textarea
                                rows={4}
                                value={goalContent}
                                onChange={(e) => setGoalContent(e.target.value)}
                                placeholder="목표 설정을 간략하게 적은 후, 하단 AI 버튼을 누르면 전문적이고 조리 있게 정리해 드립니다."
                                className="w-full p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all resize-y"
                            />
                            <div className="flex items-center justify-between gap-2 pt-1">
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <VoiceInputButton
                                        disabled={goalAiLoadingMode !== null}
                                        onTranscript={(spoken) =>
                                            setGoalContent((prev) => (prev ? `${prev} ${spoken}` : spoken))
                                        }
                                    />
                                    {prevGoalContent !== null && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setGoalContent(prevGoalContent);
                                                setPrevGoalContent(null);
                                            }}
                                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0"
                                        >
                                            <RotateCcw size={13} className="shrink-0" />
                                            <span>되돌리기</span>
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                                    <button
                                        type="button"
                                        disabled={goalAiLoadingMode !== null}
                                        onClick={() => handleGoalAiHelper("summarize")}
                                        className="flex items-center gap-1 px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold border border-indigo-200 dark:border-indigo-700/60 bg-indigo-50/70 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all shadow-sm disabled:opacity-50 whitespace-nowrap shrink-0"
                                    >
                                        {goalAiLoadingMode === "summarize" ? (
                                            <div className="w-3.5 h-3.5 border-2 border-indigo-400/40 border-t-indigo-600 rounded-full animate-spin shrink-0" />
                                        ) : (
                                            <Sparkles size={14} className="shrink-0" />
                                        )}
                                        <span>AI 다듬기</span>
                                    </button>
                                    <button
                                        type="button"
                                        disabled={goalAiLoadingMode !== null}
                                        onClick={() => handleGoalAiHelper("expand")}
                                        className="flex items-center gap-1 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 shadow-sm hover:shadow transition-all disabled:opacity-50 whitespace-nowrap shrink-0"
                                    >
                                        {goalAiLoadingMode === "expand" ? (
                                            <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin shrink-0" />
                                        ) : (
                                            <Sparkles size={14} className="shrink-0" />
                                        )}
                                        <span>AI 보완</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* ── 분석 내용 - 선수 ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <SectionTitle>
                                <FileText size={20} className="text-emerald-500" /> 분석 내용 - 선수
                            </SectionTitle>
                        </div>
                        <div className="flex flex-col gap-3">
                            <textarea
                                rows={6}
                                value={lessonContent}
                                onChange={(e) => setLessonContent(e.target.value)}
                                placeholder="선수용 분석 내용을 간략하게 적은 후, 하단 AI 버튼을 누르면 전문적이고 조리 있게 정리해 드립니다."
                                className="w-full p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all resize-y"
                            />
                            <div className="flex items-center justify-between gap-2 pt-1">
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <VoiceInputButton
                                        disabled={aiLoadingMode !== null}
                                        onTranscript={(spoken) =>
                                            setLessonContent((prev) => (prev ? `${prev} ${spoken}` : spoken))
                                        }
                                    />
                                    {prevLessonContent !== null && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setLessonContent(prevLessonContent);
                                                setPrevLessonContent(null);
                                            }}
                                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0"
                                        >
                                            <RotateCcw size={13} className="shrink-0" />
                                            <span>되돌리기</span>
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                                    <button
                                        type="button"
                                        disabled={aiLoadingMode !== null}
                                        onClick={() => handleAiHelper("summarize")}
                                        className="flex items-center gap-1 px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold border border-indigo-200 dark:border-indigo-700/60 bg-indigo-50/70 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all shadow-sm disabled:opacity-50 whitespace-nowrap shrink-0"
                                    >
                                        {aiLoadingMode === "summarize" ? (
                                            <div className="w-3.5 h-3.5 border-2 border-indigo-400/40 border-t-indigo-600 rounded-full animate-spin shrink-0" />
                                        ) : (
                                            <Sparkles size={14} className="shrink-0" />
                                        )}
                                        <span>AI 다듬기</span>
                                    </button>
                                    <button
                                        type="button"
                                        disabled={aiLoadingMode !== null}
                                        onClick={() => handleAiHelper("expand")}
                                        className="flex items-center gap-1 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 shadow-sm hover:shadow transition-all disabled:opacity-50 whitespace-nowrap shrink-0"
                                    >
                                        {aiLoadingMode === "expand" ? (
                                            <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin shrink-0" />
                                        ) : (
                                            <Sparkles size={14} className="shrink-0" />
                                        )}
                                        <span>AI 보완</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* ── 분석 내용 - 코치 ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <SectionTitle>
                                <FileText size={20} className="text-blue-500" /> 분석 내용 - 코치
                            </SectionTitle>
                        </div>
                        <div className="flex flex-col gap-3">
                            <textarea
                                rows={6}
                                value={coachContent}
                                onChange={(e) => setCoachContent(e.target.value)}
                                placeholder="코치 분석 내용을 간략하게 적은 후, 하단 AI 버튼을 누르면 전문적이고 조리 있게 정리해 드립니다."
                                className="w-full p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all resize-y"
                            />
                            <div className="flex items-center justify-between gap-2 pt-1">
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <VoiceInputButton
                                        disabled={coachAiLoadingMode !== null}
                                        onTranscript={(spoken) =>
                                            setCoachContent((prev) => (prev ? `${prev} ${spoken}` : spoken))
                                        }
                                    />
                                    {prevCoachContent !== null && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setCoachContent(prevCoachContent);
                                                setPrevCoachContent(null);
                                            }}
                                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0"
                                        >
                                            <RotateCcw size={13} className="shrink-0" />
                                            <span>되돌리기</span>
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                                    <button
                                        type="button"
                                        disabled={coachAiLoadingMode !== null}
                                        onClick={() => handleCoachAiHelper("summarize")}
                                        className="flex items-center gap-1 px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold border border-indigo-200 dark:border-indigo-700/60 bg-indigo-50/70 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all shadow-sm disabled:opacity-50 whitespace-nowrap shrink-0"
                                    >
                                        {coachAiLoadingMode === "summarize" ? (
                                            <div className="w-3.5 h-3.5 border-2 border-indigo-400/40 border-t-indigo-600 rounded-full animate-spin shrink-0" />
                                        ) : (
                                            <Sparkles size={14} className="shrink-0" />
                                        )}
                                        <span>AI 다듬기</span>
                                    </button>
                                    <button
                                        type="button"
                                        disabled={coachAiLoadingMode !== null}
                                        onClick={() => handleCoachAiHelper("expand")}
                                        className="flex items-center gap-1 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 shadow-sm hover:shadow transition-all disabled:opacity-50 whitespace-nowrap shrink-0"
                                    >
                                        {coachAiLoadingMode === "expand" ? (
                                            <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin shrink-0" />
                                        ) : (
                                            <Sparkles size={14} className="shrink-0" />
                                        )}
                                        <span>AI 보완</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* ── 메모 (작성자 본인만 열람/수정 가능) ── */}
                    {Boolean(currentUserId && (coachId === currentUserId || currentUserRole === "super_admin")) && (
                        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-4">
                            <div className="flex items-center justify-between">
                                <SectionTitle>
                                    <MessageSquare size={20} className="text-zinc-500" /> 메모
                                </SectionTitle>
                                <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 font-medium">
                                    작성자 전용 (비공개)
                                </span>
                            </div>
                            <div className="flex flex-col gap-3">
                                <textarea
                                    rows={4}
                                    value={memoContent}
                                    onChange={(e) => setMemoContent(e.target.value)}
                                    placeholder="작성자 본인만 볼 수 있는 비공개 메모입니다. (다른 코치·선수·학부모 비공개)"
                                    className="w-full p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all resize-y"
                                />
                            </div>
                        </section>
                    )}

                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={!selectedPlayer || !selectedPart || !lessonDate || isSubmitting}
                            className="bg-brand-red hover:bg-brand-red-dark disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm"
                        >
                            {isSubmitting ? "저장 중..." : "수정 내용 저장"}
                        </button>
                    </div>
                </form>
            </div>

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

            {/* Lesson History Modal */}
            <LessonHistoryModal
                isOpen={isLessonHistoryModalOpen}
                onClose={() => setIsLessonHistoryModalOpen(false)}
                allLessons={allLessons}
                historySelectedPart={lessonHistorySelectedPart}
                setHistorySelectedPart={setLessonHistorySelectedPart}
                historySearchQuery={lessonHistorySearchQuery}
                setHistorySearchQuery={setLessonHistorySearchQuery}
                historyDisplayLimit={lessonHistoryDisplayLimit}
                setHistoryDisplayLimit={setLessonHistoryDisplayLimit}
                connectedLessonId={null}
                setConnectedLessonId={() => {}}
                partOptions={lessonModalPartOptions}
                readOnly={true}
                title="최근 레슨 기록 찾아보기"
                itemType="lesson"
            />

            {/* Round Reference Modal */}
            <ReferenceDataModal
                isOpen={isReferenceModalOpen}
                onClose={() => setIsReferenceModalOpen(false)}
                playerName={selectedPlayer}
            />
        </div>
    );
}
