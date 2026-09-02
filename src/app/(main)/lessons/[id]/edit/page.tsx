"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { Plus, ChevronLeft, Calendar, FileText, Image as ImageIcon, Upload, Flag, Search, X, ChevronDown, ChevronUp, Paperclip, CheckCircle2, Check, Video, BookOpen } from "lucide-react";
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
import { LinkedJournalCard } from "@/components/training-plan/LinkedJournalCard";
import { LinkedLessonCard } from "@/components/training-plan/LinkedLessonCard";
import { JournalHistoryModal } from "@/components/training-plan/JournalHistoryModal";
import { fetchJournalsByAthlete, Journal } from "@/lib/journal-sync";

const partOptions: { key: LessonType; label: string }[] = [
    { key: "shot", label: "Shot" },
    { key: "pitch", label: "Pitch" },
    { key: "bunker", label: "Bunker" },
    { key: "approach", label: "Approach" },
    { key: "putt", label: "Putt" },
    { key: "physical", label: "Physical" },
    { key: "field", label: "Field" },
    { key: "etc", label: "Etc" },
];

export default function EditLessonPage() {
    const router = useRouter();
    const params = useParams();
    const { id } = params;

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [selectedPlayer, setSelectedPlayer] = useState("");
    const [lessonDate, setLessonDate] = useState("");
    const [selectedPart, setSelectedPart] = useState<LessonType | "">("");
    const [lessonContent, setLessonContent] = useState("");

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

    // Recent History
    const [recentLessons, setRecentLessons] = useState<LessonRecord[]>([]);
    const [recentScorecard, setRecentScorecard] = useState<any | null>(null);

    // Modals & History
    const [isReferenceModalOpen, setIsReferenceModalOpen] = useState(false);
    const [isLessonHistoryModalOpen, setIsLessonHistoryModalOpen] = useState(false);
    const [historySelectedPart, setHistorySelectedPart] = useState<LessonType | "">("");
    const [historySearchQuery, setHistorySearchQuery] = useState("");
    const [historyDisplayLimit, setHistoryDisplayLimit] = useState(10);
    const [allLessons, setAllLessons] = useState<LessonRecord[]>([]);
    const [connectedLessonId, setConnectedLessonId] = useState<string | null>(null);

    // Journal State
    const [allJournals, setAllJournals] = useState<Journal[]>([]);
    const [selectedJournalId, setSelectedJournalId] = useState<string | null>(null);
    const [isJournalHistoryModalOpen, setIsJournalHistoryModalOpen] = useState(false);
    const selectedJournal = useMemo(() => allJournals.find(j => j.id === selectedJournalId) || null, [allJournals, selectedJournalId]);

    const handleResumeNavigate = (url: string) => {
        const DRAFT_KEY = `lesson_edit_draft_${id}`;
        const draft = {
            selectedPart,
            lessonDate,
            lessonContent,
            selectedImages
        };
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        const separator = url.includes("?") ? "&" : "?";
        router.push(`${url}${separator}resumeEdit=${id}`);
    };

    // Fetch initial data
    useEffect(() => {
        if (sessionStorage.getItem('openJournalHistoryModal') === 'true') {
            setIsJournalHistoryModalOpen(true);
            sessionStorage.removeItem('openJournalHistoryModal');
        }

        const fetchInitialData = async () => {
            if (!id) return;
            setIsLoading(true);
            try {
                const supabase = createClient();
                const { data, error } = await supabase
                    .from("records")
                    .select(`*, user:users!records_user_id_fkey(name)`)
                    .eq("id", id)
                    .single();

                if (error) throw error;

                const templates = await fetchLessonTemplates();
                setDbTemplates(templates);


                const DRAFT_KEY = `lesson_edit_draft_${id}`;
                const draftStr = sessionStorage.getItem(DRAFT_KEY);
                let draftData = null;
                if (draftStr) {
                    try {
                        draftData = JSON.parse(draftStr);
                    } catch (e) { }
                    sessionStorage.removeItem(DRAFT_KEY);
                }

                setSelectedPlayer(data.user?.name || "");
                setLessonDate(draftData?.lessonDate || ((data.created_at) ? new Date(data.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }) : "") || "");
                setSelectedPart(draftData?.selectedPart || data.category as LessonType || "");
                setLessonContent(draftData?.lessonContent !== undefined ? draftData.lessonContent : data.content || "");
                setAfterLessonContent(""); // Not used anymore in UI

                const allMedia = parseMediaUrls(data.media_urls);
                const fileUrls = allMedia.filter(url => !url.startsWith('template:') && !url.startsWith('after:'));
                const afterUrls = allMedia.filter(url => url.startsWith('after:')).map(url => url.replace('after:', ''));
                const templateIds = allMedia
                    .filter(url => url.startsWith('template:'))
                    .map(url => url.replace('template:', ''));

                setExistingMediaUrls(fileUrls);
                setExistingAfterMediaUrls(afterUrls);


                if (draftData?.selectedImages) {
                    setSelectedImages(draftData.selectedImages);
                } else {
                    setSelectedImages(templateIds);
                }

                // Fetch history if player exists
                if (data.user?.name) {
                    const [lessons, scorecard, allL, journals] = await Promise.all([
                        fetchRecentLessonsByPlayer(data.user.name),
                        fetchRecentScorecard(data.user.name),
                        fetchAllLessonsByPlayer(data.user.name),
                        fetchJournalsByAthlete(data.user.name)
                    ]);
                    setRecentLessons(lessons);
                    setRecentScorecard(scorecard);
                    setAllLessons(allL);
                    setConnectedLessonId(data.connected_lesson_id || null);
                    setAllJournals(journals);
                    if (journals.length > 0) setSelectedJournalId(journals[0].id);
                }

            } catch (err) {
                console.error("Failed to fetch lesson details:", err);
                alert("레슨 정보를 불러오는데 실패했습니다.");
                router.back();
            } finally {
                setIsLoading(false);
            }
        };

        fetchInitialData();
    }, [id, router]);

    const handlePlayerSelect = async (name: string) => {
        setSelectedPlayer(name);
        const [lessons, scorecard, allL, journals] = await Promise.all([
            fetchRecentLessonsByPlayer(name),
            fetchRecentScorecard(name),
            fetchAllLessonsByPlayer(name),
            fetchJournalsByAthlete(name)
        ]);
        setRecentLessons(lessons);
        setRecentScorecard(scorecard);
        setAllLessons(allL);
        setAllJournals(journals);
        if (journals.length > 0) setSelectedJournalId(journals[0].id);
        else setSelectedJournalId(null);
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

            // Format templates
            const templateUrls = selectedImages.map(tid => `template:${tid}`);
            const afterFormattedUrls = [...existingAfterMediaUrls, ...newAfterMediaUrls].map(url => `after:${url}`);

            // Combine all media
            const allMedia = [...existingMediaUrls, ...newMediaUrls, ...templateUrls, ...afterFormattedUrls];



            const updateData: any = {
                playerName: selectedPlayer,
                category: selectedPart as LessonType,
                title: selectedPlayer, // Automatic title
                content: lessonContent,
                media_urls: allMedia,
                date: lessonDate,
                connectedLessonId,
            };



            await updateLessonRecord(id as string, updateData);

            alert("레슨이 성공적으로 수정되었습니다.");
            router.push(`/lessons/${id}`);
            router.refresh();
        } catch (error) {
            console.error("Failed to update lesson:", error);
            alert("레슨 수정에 실패했습니다.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const showHistory = !!selectedPlayer && !!selectedPart;
    const filteredRecentLessons = useMemo(() => {
        if (!selectedPart) return [];
        return recentLessons.filter(l => l.category === selectedPart).slice(0, 3);
    }, [recentLessons, selectedPart]);

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
                        <PageTitle>
                            레슨 수정
                        </PageTitle>
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
                                    레슨 일자 <span className="text-brand-red">*</span>
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
                            {/* Swing Error / Lesson History Box */}
                            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 rounded-2xl shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                        <FileText size={18} className="text-brand-navy dark:text-brand-navy-light" /> 레슨 히스토리
                                    </h3>
                                    {connectedLessonId && (
                                        <span className="text-xs font-bold text-brand-navy dark:text-brand-navy-light bg-brand-navy/10 px-2 py-1 rounded-md">
                                            연결됨
                                        </span>
                                    )}
                                </div>
                                <LinkedLessonCard
                                    part={connectedLessonId ? (allLessons.find(l => l.id === connectedLessonId)?.category || selectedPart) : selectedPart}
                                    lesson={connectedLessonId ? (allLessons.find(l => l.id === connectedLessonId) || null) : (recentLessons.find(l => l.category === selectedPart) || recentLessons[0] || null)}
                                    onMoreClick={() => setIsLessonHistoryModalOpen(true)}
                                    onConnectClick={() => {
                                        const lessonToConnect = connectedLessonId
                                            ? allLessons.find(l => l.id === connectedLessonId)
                                            : (recentLessons.find(l => l.category === selectedPart) || recentLessons[0]);

                                        if (lessonToConnect) {
                                            if (connectedLessonId === lessonToConnect.id) {
                                                setConnectedLessonId(null);
                                            } else {
                                                setConnectedLessonId(lessonToConnect.id);
                                            }
                                        }
                                    }}
                                    isConnected={!!connectedLessonId}
                                    readOnly={false}
                                />
                            </section>

                            {/* Training Journal Box */}
                            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 rounded-2xl shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <SectionTitle>
                                        <FileText size={18} className="text-brand-navy dark:text-brand-navy-light" /> 훈련 일지
                                    </SectionTitle>
                                </div>
                                <LinkedJournalCard
                                    journal={selectedJournal}
                                    onMoreClick={() => setIsJournalHistoryModalOpen(true)}
                                    readOnly={false}
                                />
                            </section>

                            {/* Lesson Reference Data Box */}
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
                                    <FileUploadButton label="바로 촬영" icon={<Video size={16} className="text-zinc-500" />} accept="video/*" capture="environment" onChange={handleFileChange} />
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

                    {/* 교정후 (After) */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-6">
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-2">
                            <CheckCircle2 size={20} className="text-brand-navy dark:text-brand-navy-light" /> 교정후 (After)
                        </h3>


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
                                                <img src={url} alt="첨부" className="w-full h-full object-contain" />
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
                                                    <img src={url} alt="새 첨부" className="w-full h-full object-contain" />
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
                                    <FileUploadButton label="바로 촬영" icon={<Video size={16} className="text-zinc-500" />} accept="video/*" capture="environment" onChange={handleAfterFileChange} />
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

                    {/* ── 레슨 내용 ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-4">
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            <FileText size={20} className="text-emerald-500" /> 레슨 내용
                        </h3>
                        <textarea
                            rows={6}
                            value={lessonContent}
                            onChange={(e) => setLessonContent(e.target.value)}
                            placeholder=""
                            className="w-full p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all resize-y leading-relaxed"
                        />
                    </section>



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

            {/* Journal History Modal */}
            <JournalHistoryModal
                isOpen={isJournalHistoryModalOpen}
                onClose={() => setIsJournalHistoryModalOpen(false)}
                allJournals={allJournals}
                onSelectJournal={(journalId) => {
                    setSelectedJournalId(journalId);
                    setIsJournalHistoryModalOpen(false);
                }}
                connectedJournalId={selectedJournalId}
            />

            {/* Lesson History Modal */}
            {isLessonHistoryModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setIsLessonHistoryModalOpen(false)}>
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col" style={{ height: '85vh' }} onClick={(e) => e.stopPropagation()}>
                        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 shrink-0">
                            <SectionTitle>
                                레슨 히스토리 찾아보기
                            </SectionTitle>
                            <button onClick={() => setIsLessonHistoryModalOpen(false)} className="px-4 py-1.5 bg-brand-navy text-white text-sm font-bold rounded-xl hover:bg-brand-navy-light transition-colors">
                                {connectedLessonId ? "레슨 연결" : "선택 완료"}
                            </button>
                        </div>
                        <div className="p-4 shrink-0 border-b border-zinc-200 dark:border-zinc-800">
                            <CategoryTabs options={partOptions} value={historySelectedPart} onChange={setHistorySelectedPart} />
                            <div className="relative w-full mt-2">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="레슨 내용 검색..."
                                    value={historySearchQuery}
                                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all"
                                />
                            </div>
                        </div>
                        <div className="p-4 space-y-3 overflow-y-auto flex-1 bg-zinc-50/50 dark:bg-zinc-900 min-h-[300px]">
                            {(() => {
                                const effectivePart = historySelectedPart || selectedPart;
                                const historyItems = allLessons.filter(l =>
                                    l.category === effectivePart &&
                                    (!historySearchQuery || l.content.toLowerCase().includes(historySearchQuery.toLowerCase()))
                                );
                                const displayedHistory = historyItems.slice(0, historyDisplayLimit);

                                return (
                                    <>
                                        {displayedHistory.map(lesson => {
                                            const isConnected = connectedLessonId === lesson.id;
                                            return (
                                                <div
                                                    key={lesson.id}
                                                    onClick={() => {
                                                        setConnectedLessonId(lesson.id);
                                                        setIsLessonHistoryModalOpen(false);
                                                    }}
                                                    className={cn(
                                                        "bg-white dark:bg-zinc-800 border rounded-xl overflow-hidden shadow-sm p-4 transition-all relative cursor-pointer",
                                                        isConnected
                                                            ? "border-brand-navy dark:border-brand-navy-light shadow-brand-navy/10 ring-1 ring-brand-navy"
                                                            : "border-zinc-200 dark:border-zinc-700 hover:border-brand-navy/50"
                                                    )}
                                                >
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-bold text-brand-navy dark:text-brand-navy-light uppercase px-1.5 py-0.5 bg-brand-navy/5 dark:bg-brand-navy/20 rounded-md">
                                                                {partOptions.find(p => p.key === lesson.category)?.label || lesson.category}
                                                            </span>

                                                            {lesson.coachName && (
                                                                <span className="text-[11px] font-medium text-zinc-500">
                                                                    {lesson.coachName}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[11px] text-zinc-400 font-medium">
                                                                {lesson.created_at ? new Date(lesson.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }).slice(5).replace(/-/g, ".") : ""}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed mt-2 mb-2">
                                                        {lesson.content}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                        {historyItems.length === 0 && (
                                            <div className="py-8 text-center text-zinc-500 text-sm">
                                                검색된 레슨 기록이 없습니다.
                                            </div>
                                        )}
                                        {historyItems.length > historyDisplayLimit && (
                                            <div className="py-4 flex justify-center">
                                                <button
                                                    type="button"
                                                    onClick={() => setHistoryDisplayLimit(prev => prev + 10)}
                                                    className="px-6 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm rounded-xl text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                                                >
                                                    더 보기 ({historyItems.length - historyDisplayLimit}개 남음) ▼
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )
                            })()}
                        </div>
                    </div>
                </div>
            )}

            <ReferenceDataModal
                isOpen={isReferenceModalOpen}
                onClose={() => setIsReferenceModalOpen(false)}
                playerName={selectedPlayer}
            />
        </div>
    );
}
