"use client";

export const dynamic = "force-dynamic";

import React, { useState, useMemo, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, Calendar, CheckCircle2, ChevronLeft, ChevronRight, Edit2, Flag, Image as ImageIcon, MapPin, Search, Trash2, Upload, Video, X, FileText, User, Circle, CornerDownRight, Plus, Check, ChevronDown, ChevronUp, Paperclip } from "lucide-react";
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
import { fetchRecentLessonsByPlayer, fetchAllLessonsByPlayer, saveLessonRecord, LessonRecord } from "@/lib/lesson-sync";
import { LessonHistoryModal } from "@/components/lesson/LessonHistoryModal";
import { LinkedLessonCard } from "@/components/training-plan/LinkedLessonCard";
import { uploadFiles } from "@/lib/storage-sync";
import { saveCompletedItem, saveEvent } from "@/lib/schedule-sync";
import { formatLocalDate } from "@/lib/utils";
import { CustomVideoPlayer } from "@/components/ui/CustomVideoPlayer";

const ALL_SLOTS = [
    "07:00", "07:30", "08:00", "08:30", "09:00", "09:30",
    "10:00", "10:30", "11:00", "11:30", "12:00", "12:30",
    "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
    "16:00", "16:30", "17:00", "17:30", "18:00", "18:30",
];
const AM_SLOTS = ALL_SLOTS.filter((s) => parseInt(s) < 13);
const PM_SLOTS = ALL_SLOTS.filter((s) => parseInt(s) >= 13);

function slotLabel(slot: string) {
    const h = parseInt(slot.split(":")[0]);
    const m = slot.split(":")[1];
    return `${h > 12 ? h - 12 : h}:${m}`;
}

// Mock Data for demonstration
const mockPlayers = ["이수진", "최민준", "김지윤", "박도윤"];

const mockRecentLessons: { id: string; date: string; type: LessonType; title: string }[] = [
    { id: "1", date: "2026-03-05", type: "shot", title: "[기본기] 드라이버 슬라이스 교정" },
    { id: "2", date: "2026-03-02", type: "physical", title: "[예습] 어깨 가동성 훈련" },
    { id: "3", date: "2026-02-28", type: "approach", title: "[복습] 30m 어프로치" },
    { id: "4", date: "2026-02-20", type: "field", title: "[기본기] 실전 코스 매니지먼트" },
];

const partOptions: { key: string; label: string }[] = [
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

const mockRecentScore = {
    id: "s1",
    date: "2026-03-04",
    course: "레이크힐스 CC",
    score: 82,
    teeShot: "Fairway 60%",
    iron: "GIR 45%",
    pitch: "Scrambling 30%",
    aroundGreen: "Sand Save 50%",
    putting: "32 Putts",
    challengeFocus: "백스윙 템포 유지",
    strongPoint: "드라이버 비거리 안정적",
};

const dummyImages = [
    "https://images.unsplash.com/photo-1587394625514-6d9b3a3250b7?auto=format&fit=crop&q=80&w=200&h=200",
    "https://images.unsplash.com/photo-1593111774640-36fbb0143891?auto=format&fit=crop&q=80&w=200&h=200",
    "https://images.unsplash.com/photo-1586227740560-8cf2732c1531?auto=format&fit=crop&q=80&w=200&h=200",
    "https://images.unsplash.com/photo-1535136104956-f1b21abdbf1f?auto=format&fit=crop&q=80&w=200&h=200",
];

// (Supabase used for templates)

export default function CreateLessonPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center text-zinc-400">페이지 로딩 중...</div>}>
            <CreateLessonContent />
        </Suspense>
    );
}

function CreateLessonContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const DRAFT_KEY = "lesson_create_draft";

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
    const [isPlayerDropdownOpen, setIsPlayerDropdownOpen] = useState(false);
    const [currentCoachName, setCurrentCoachName] = useState("코치");
    const [isAborting, setIsAborting] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const [currentCoachId, setCurrentCoachId] = useState<string | null>(null);
    const [isTimeModified, setIsTimeModified] = useState(false);

    const [lessonDate, setLessonDate] = useState(() => formatLocalDate());

    // ── Consolidate Mount Logic (Draft + Params) ──────────────────
    useEffect(() => {
        // Check if we need to reopen history modal
        if (sessionStorage.getItem('openLessonHistoryModal') === 'true') {
            setIsLessonHistoryModalOpen(true);
            sessionStorage.removeItem('openLessonHistoryModal');
        }


        // Load Draft from SessionStorage
        const draft = sessionStorage.getItem(DRAFT_KEY);
        if (draft) {
            try {
                const data = JSON.parse(draft);
                if (data.selectedPlayers) setSelectedPlayers(data.selectedPlayers);
                if (data.selectedPart) setSelectedPart(data.selectedPart as LessonType);
                if (data.lessonDate) { setLessonDate(data.lessonDate); setIsTimeModified(true); }
                if (data.startSlot) { setStartSlot(data.startSlot); setIsTimeModified(true); }
                if (data.endSlot) { setEndSlot(data.endSlot); setIsTimeModified(true); }
                if (data.period) setPeriod(data.period);
                if (data.lessonContent) setLessonContent(data.lessonContent);
            } catch (e) {
                console.error("Failed to load lesson draft:", e);
            }
        }

        // 3. Overwrite with Search Params (Highest Priority)
        const playerParam = searchParams.get("player");
        const typeParam = searchParams.get("type");
        const startParam = searchParams.get("start");
        const endParam = searchParams.get("end");

        if (playerParam) setSelectedPlayers([playerParam]);
        if (typeParam) setSelectedPart(typeParam as LessonType);

        if (startParam && ALL_SLOTS.includes(startParam)) {
            setStartSlot(startParam);
            const hour = parseInt(startParam.split(":")[0]);
            setPeriod(hour >= 13 ? "pm" : "am");
            setIsTimeModified(true);
        }
        if (endParam && ALL_SLOTS.includes(endParam)) {
            setEndSlot(endParam);
            setIsTimeModified(true);
        }

        // 3. RBAC & Coach Info
        const supabase = createClient();
        supabase.auth.getUser().then(async ({ data: { user } }) => {
            if (user) {
                const { data: dbUser } = await supabase
                    .from("users")
                    .select("name, role")
                    .eq("id", user.id)
                    .maybeSingle();

                if (dbUser?.name) {
                    setCurrentCoachName(dbUser.name);
                } else if (user.user_metadata?.name) {
                    setCurrentCoachName(user.user_metadata.name);
                }

                if (dbUser && dbUser.role !== 'coach' && dbUser.role !== 'admin') {
                    alert("레슨 작성 권한이 없습니다.");
                    router.push("/lessons");
                }
            } else {
                router.push("/login");
            }
        });

        setIsLoaded(true);
    }, [searchParams, router]);

    const [startSlot, setStartSlot] = useState<string | null>(() => {
        const now = new Date();
        const h = now.getHours().toString().padStart(2, '0');
        const m = now.getMinutes().toString().padStart(2, '0');
        return `${h}:${m}`;
    });
    const [endSlot, setEndSlot] = useState<string | null>(() => {
        const now = new Date();
        const future = new Date(now.getTime() + 60 * 60000); // 1 hour later
        const h = future.getHours().toString().padStart(2, '0');
        const m = future.getMinutes().toString().padStart(2, '0');
        return `${h}:${m}`;
    });
    const [period, setPeriod] = useState<"am" | "pm">(() => {
        const now = new Date();
        const future = new Date(now.getTime() + 30 * 60000);
        return future.getHours() >= 13 ? "pm" : "am";
    });

    const slots = period === "am" ? AM_SLOTS : PM_SLOTS;

    const handleSlotClick = (slot: string) => {
        setIsTimeModified(true);
        if (!startSlot || (startSlot && endSlot)) {
            setStartSlot(slot);
            setEndSlot(null);
        } else {
            const si = ALL_SLOTS.indexOf(startSlot);
            const ei = ALL_SLOTS.indexOf(slot);
            if (ei >= si) {
                setEndSlot(slot);
            } else {
                setEndSlot(startSlot);
                setStartSlot(slot);
            }
        }
    };

    const isInRange = (slot: string) => {
        if (!startSlot) return false;
        const si = ALL_SLOTS.indexOf(startSlot);
        const ci = ALL_SLOTS.indexOf(slot);
        if (!endSlot) return slot === startSlot;
        const ei = ALL_SLOTS.indexOf(endSlot);
        return ci >= si && ci <= ei;
    };

    const timeLabel = useMemo(() => {
        if (!startSlot) return "시간을 선택하세요";
        if (!endSlot) return `${slotLabel(startSlot)} ~ (종료 시간 선택)`;
        return `${slotLabel(startSlot)} ~ ${slotLabel(endSlot)}`;
    }, [startSlot, endSlot]);

    const [selectedPart, setSelectedPart] = useState<string>("shot");
    const [lessonContent, setLessonContent] = useState("");
    const [dbTemplates, setDbTemplates] = useState<LessonTemplate[]>([]);
    const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false);
    const templateDropdownRef = useRef<HTMLDivElement>(null);

    // Lesson History Modal
    const [isLessonHistoryModalOpen, setIsLessonHistoryModalOpen] = useState(false);
    const [historySelectedPart, setHistorySelectedPart] = useState<string>(() => {
        if (typeof window !== 'undefined') {
            return sessionStorage.getItem('lessonHistoryTab') || "all";
        }
        return "all";
    });

    useEffect(() => {
        sessionStorage.setItem('lessonHistoryTab', historySelectedPart);
    }, [historySelectedPart]);
    const [historySearchQuery, setHistorySearchQuery] = useState("");
    const [historyDisplayLimit, setHistoryDisplayLimit] = useState(10);

    const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    // After (교정후) files
    const [afterAttachedFiles, setAfterAttachedFiles] = useState<File[]>([]);
    const afterFileInputRef = useRef<HTMLInputElement>(null);

    const [connectedLessonId, setConnectedLessonId] = useState<string | null>(null);

    const [recentLessons, setRecentLessons] = useState<LessonRecord[]>([]);
    const [allLessons, setAllLessons] = useState<LessonRecord[]>([]);

    // No Goal Editing State Needed

    const isFormValid = useMemo(() => {
        return selectedPlayers.length > 0 && !!selectedPart;
    }, [selectedPlayers, selectedPart]);

    // ── Draft Persistence ──────────────────────────────────────────

    // Save Draft
    useEffect(() => {
        if (!isLoaded || isAborting) return;

        const draft = {
            selectedPlayers,
            selectedPart,
            lessonDate,
            startSlot,
            endSlot,
            period,
            lessonContent
        };
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }, [selectedPlayers, selectedPart, lessonDate, startSlot, endSlot, period, lessonContent, isAborting]);

    useEffect(() => {
        fetchLessonTemplates().then(data => setDbTemplates([...data].reverse()));
    }, []);

    useEffect(() => {
        const fetchUser = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setCurrentCoachId(user.id);
                const { data: dbUser } = await supabase.from("users").select("name").eq("id", user.id).maybeSingle();
                if (dbUser?.name) setCurrentCoachName(dbUser.name);
            }
        };
        fetchUser();
    }, []);

    const lastSelectedPlayer = selectedPlayers[selectedPlayers.length - 1];

    useEffect(() => {
        if (lastSelectedPlayer) {
            Promise.all([
                fetchRecentLessonsByPlayer(lastSelectedPlayer, selectedPart === "all" ? undefined : selectedPart)
            ]).then(([lessons]) => {
                setRecentLessons(lessons);
            });
        } else {
            setRecentLessons([]);
        }
    }, [lastSelectedPlayer, selectedPart]);

    // 히스토리 모달용 레슨 기록(더 보기 클릭 시 서버에서 추가 패치)
    useEffect(() => {
        if (lastSelectedPlayer) {
            // 히스토리 탭이 "all"이 아닐 때도, 트리를 구성하기 위해 전체를 가져와야 하므로 카테고리 필터를 넣지 않습니다.
            fetchAllLessonsByPlayer(lastSelectedPlayer, undefined, historyDisplayLimit).then(setAllLessons);
        } else {
            setAllLessons([]);
        }
    }, [lastSelectedPlayer, historyDisplayLimit]);




    // Filter players based on search query
    const visiblePlayers = useMemo(() => {
        return mockPlayers.filter((p) => p.includes(searchQuery));
    }, [searchQuery]);

    const handlePlayerAdd = (p: string) => {
        // 새 선수 선택 시 임시 저장된 탭 초기화
        sessionStorage.removeItem('journalHistoryTab');
        sessionStorage.removeItem('lessonHistoryTab');
        setHistorySelectedPart("all");

        if (!selectedPlayers.includes(p)) {
            setSelectedPlayers(prev => [...prev, p]);
        }
        setSearchQuery("");
        setIsPlayerDropdownOpen(false);
    };

    const handlePlayerRemove = (p: string) => {
        // 선수 목록에서 제거될 때도 (필요하다면) 초기화
        sessionStorage.removeItem('journalHistoryTab');
        sessionStorage.removeItem('lessonHistoryTab');
        setHistorySelectedPart("all");

        setSelectedPlayers(prev => prev.filter(n => n !== p));
    };


    const handleResumeNavigate = (url: string) => {
        sessionStorage.setItem("resume_lesson_create", "true");
        router.push(url);
    };

    const handleAbort = () => {
        setIsAborting(true);
        sessionStorage.removeItem(DRAFT_KEY);
        router.back();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setAttachedFiles(prev => [...prev, ...newFiles]);
        }
    };

    const removeFile = (index: number) => {
        setAttachedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleAfterFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setAfterAttachedFiles(prev => [...prev, ...newFiles]);
        }
    };

    const removeAfterFile = (index: number) => {
        setAfterAttachedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const [materialFiles, setMaterialFiles] = useState<File[]>([]);
    const materialFileInputRef = useRef<HTMLInputElement>(null);

    const handleMaterialFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setMaterialFiles(prev => [...prev, ...newFiles]);
        }
    };

    const removeMaterialFile = (index: number) => {
        setMaterialFiles(prev => prev.filter((_, i) => i !== index));
    };



    const handleSubmit = async (e?: React.FormEvent, redirectToTraining: boolean = false) => {
        if (e) e.preventDefault();

        if (selectedPlayers.length === 0) {
            alert("선수를 선택해주세요.");
            return;
        }

        if (!selectedPart) {
            alert("레슨 파트를 선택해주세요.");
            return;
        }

        try {
            setIsUploading(true);

            // 1. Upload files to Supabase Storage
            const uploadedUrls = attachedFiles.length > 0 ? await uploadFiles(attachedFiles, 'records') : [];

            // 2. Combine with swing error IDs (templates)
            // Upload after files
            const afterUploadedUrls = afterAttachedFiles.length > 0 ? await uploadFiles(afterAttachedFiles, 'records') : [];
            const materialUploadedUrls = materialFiles.length > 0 ? await uploadFiles(materialFiles, 'records') : [];

            const allMedia = [
                ...uploadedUrls,
                ...afterUploadedUrls.map(url => `after:${url}`),
                ...materialUploadedUrls.map(url => `material:${url}`)
            ];

            const scheduleId = searchParams.get("scheduleId");
            const now = new Date();
            const currentHour = now.getHours().toString().padStart(2, '0');
            const currentMinute = now.getMinutes().toString().padStart(2, '0');
            const currentTime = `${currentHour}:${currentMinute}`;

            const finalDate = isTimeModified ? lessonDate : formatLocalDate(now);
            const finalStartTime = isTimeModified ? (startSlot || currentTime) : currentTime;
            const finalEndTime = isTimeModified ? (endSlot || currentTime) : currentTime;

            for (const player of selectedPlayers) {
                // Prepend training type to title
                const derivedTitle = player;

                await saveLessonRecord({
                    playerName: player,
                    coachName: currentCoachName,
                    category: selectedPart as LessonType,
                    title: derivedTitle,
                    content: lessonContent,
                    media_urls: allMedia,
                    date: finalDate,
                    startTime: finalStartTime,
                    endTime: finalEndTime,
                    connectedLessonId
                });

                // 4. Mark as completed in schedule
                await saveCompletedItem({
                    participantName: player,
                    date: finalDate,
                    type: "lesson",
                    scheduleId: scheduleId || undefined
                });

                // 5. Create a new completed schedule event if one doesn't exist
                if (!scheduleId) {
                    const start = new Date(`${finalDate}T${finalStartTime}:00`);
                    const end = new Date(`${finalDate}T${finalEndTime}:00`);

                    await saveEvent({
                        id: crypto.randomUUID(),
                        title: `${player} 레슨 (${selectedPart})`,
                        start,
                        end,
                        type: "lesson",
                        category: selectedPart as string,
                        participantName: player,
                        coachName: currentCoachName,
                        status: "completed"
                    });
                }
            }

            // Clear Draft on success
            sessionStorage.removeItem(DRAFT_KEY);




            if (redirectToTraining) {
                const lastPlayer = selectedPlayers[selectedPlayers.length - 1];
                router.push(`/training/create?player=${lastPlayer}&type=${selectedPart}&date=${lessonDate}&start=${startSlot}`);
            } else {
                alert(`${selectedPlayers.length}명의 레슨이 등록되었습니다.`);
                router.push("/lessons");
            }
        } catch (err: any) {
            console.error("Lesson registration detailed error:", err);
            const errorMsg = err.message || "권한이 없거나 데이터베이스 오류가 발생했습니다.";
            alert(`레슨 등록 실패: ${errorMsg}\n상세: ${err.details || "없음"}`);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4 sm:px-8 py-6">
            <div className="max-w-3xl mx-auto">

                {/* ── Header ── */}
                <div className="flex items-center gap-3 mb-8">
                    <button
                        onClick={handleAbort}
                        className="p-2 -ml-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-50 transition-colors"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <div className="flex items-center gap-2">
                        <BookOpen size={24} className="text-brand-navy dark:text-brand-navy-light shrink-0" />
                        <PageTitle>레슨 작성</PageTitle>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">

                    {/* ── 1. Basic Info ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {/* 1. Player Selection (Search/Autocomplete) */}
                            <div className="space-y-4 md:col-span-2">
                                <LabelText>
                                    선수 선택 <span className="text-brand-red">*</span>
                                </LabelText>
                                <AthleteSearch
                                    multi={true}
                                    selectedNames={selectedPlayers}
                                    onSelect={handlePlayerAdd}
                                    onRemove={handlePlayerRemove}
                                    placeholder="선수 이름을 검색하여 추가하세요..."
                                />
                            </div>

                            {/* 2. Part Selection */}
                            <div className="space-y-2 md:col-span-2">
                                <LabelText>
                                    파트 선택 <span className="text-brand-red">*</span>
                                </LabelText>
                                <CategoryTabs options={partOptions.filter(opt => opt.key !== 'all')} value={selectedPart} onChange={setSelectedPart} />
                            </div>



                            {/* 4. Date Selection */}
                            <div className="space-y-2">
                                <LabelText>
                                    레슨 일자 <span className="text-brand-red">*</span>
                                </LabelText>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                    <DatePickerInput
                                        value={lessonDate}
                                        onChange={(e) => { setLessonDate(e.target.value); setIsTimeModified(true); }}
                                        required
                                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all text-center"
                                    />
                                </div>
                            </div>


                        </div>
                    </section>

                    {/* ── 2. History & Analysis (Conditional) ── */}
                    {selectedPlayers.length > 0 && selectedPart && (
                        <div className="space-y-6">



                            {/* Swing Error / Lesson History Box */}
                            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 rounded-2xl shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <SectionTitle>
                                        <FileText size={18} className="text-brand-navy dark:text-brand-navy-light" /> 레슨 히스토리
                                    </SectionTitle>
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

                        </div>
                    )}


                    {/* ── 3. 교정전 (Before) ── */}
                    <section id="before-correction-section" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-6">
                        <SectionTitle className="mb-6">
                            <CheckCircle2 size={20} className="text-zinc-400" /> 교정전 (Before)
                        </SectionTitle>


                        {/* File Attachment */}
                        <div className="space-y-2">
                            <div className="flex flex-col gap-3">
                                {attachedFiles.length > 0 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
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
                                )}
                                <div className="flex items-center gap-4">
                                    <FileUploadButton label="파일 추가" multiple onChange={handleFileChange} accept="image/*,video/*" />
                                    <FileUploadButton label="바로 촬영" icon={<Video size={16} className="text-zinc-500" />} accept="video/*" capture="environment" onChange={handleFileChange} />
                                </div>
                            </div>
                        </div>

                    </section>

                    {/* ── 교정후 (After) ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-6">
                        <SectionTitle className="mb-6">
                            <CheckCircle2 size={20} className="text-brand-navy dark:text-brand-navy-light" /> 교정후 (After)
                        </SectionTitle>

                        <div className="space-y-2">
                            <div className="flex flex-col gap-3">
                                {afterAttachedFiles.length > 0 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
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
                                )}
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

                    {/* ── 레슨 자료 ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-6">
                        <SectionTitle className="mb-6">
                            <FileText size={20} className="text-zinc-500" /> 레슨 자료
                        </SectionTitle>

                        <div className="space-y-2">
                            <div className="flex flex-col gap-3">
                                {materialFiles.length > 0 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
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
                                                        <img src={url} alt="레슨 자료" className="w-full h-full object-contain bg-black" />
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

                    {/* ── 레슨 내용 ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <SectionTitle>
                                <FileText size={20} className="text-emerald-500" /> 레슨 내용
                            </SectionTitle>
                            {connectedLessonId && (
                                <span className="text-xs font-bold text-brand-navy dark:text-brand-navy-light bg-brand-navy/10 dark:bg-brand-navy/20 px-2.5 py-1 rounded-md">
                                    레슨 연결됨
                                </span>
                            )}
                        </div>
                        <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-2 mt-2 space-y-1">
                            <p>* 최근 레슨 내용 확인 및 진행사항 점검</p>
                            <p>* 레슨 목표 방향에 맞는 레슨 내용 작성</p>
                        </div>
                        <div className="flex flex-col gap-2">
                            <textarea
                                rows={6}
                                value={lessonContent}
                                onChange={(e) => setLessonContent(e.target.value)}
                                placeholder=""
                                className="w-full p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all resize-y"
                            />
                            {!connectedLessonId && (
                                <div className="flex items-center justify-between p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl text-zinc-500 dark:text-zinc-400 text-sm">
                                    <X size={16} className="shrink-0 text-zinc-400" />
                                    <span className="flex-1 text-center whitespace-nowrap text-[12px] sm:text-sm tracking-tight">기존 레슨과 연결되지 않은 신규 레슨 입니다.</span>
                                    <X size={16} className="shrink-0 text-zinc-400" />
                                </div>
                            )}
                        </div>
                    </section>
                    {/* ── 4. Footers / Actions ── */}
                    <div className="flex flex-row items-center justify-between sm:justify-end gap-1.5 sm:gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800 w-full">
                        <button
                            type="button"
                            onClick={handleAbort}
                            disabled={isUploading}
                            className="px-3 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
                        >
                            취소
                        </button>
                        <div className="flex flex-row items-center gap-1.5 sm:gap-3 shrink-0">
                            <button
                                type="submit"
                                disabled={isUploading || !isFormValid}
                                className="bg-brand-red hover:bg-brand-red-dark disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-400 text-white px-3 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-sm flex items-center gap-1.5 whitespace-nowrap shrink-0"
                            >
                                {isUploading ? (
                                    <>
                                        <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        등록중
                                    </>
                                ) : (
                                    "레슨등록"
                                )}
                            </button>

                        </div>
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
                connectedLessonId={connectedLessonId}
                setConnectedLessonId={setConnectedLessonId}
                partOptions={partOptions}
                readOnly={false}
            />


        </div>
    );
}