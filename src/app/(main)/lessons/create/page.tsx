"use client";

export const dynamic = "force-dynamic";

import { useState, useMemo, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Calendar, FileText, Image as ImageIcon, Upload, Flag, Search, X, ChevronDown, ChevronUp, Paperclip, CheckCircle2, Check } from "lucide-react";
import { LessonType } from "@/components/lesson/LessonCard";
import { cn } from "@/lib/utils";
import { DatePickerInput } from "@/components/ui/DatePickerInput";
import { TopicPickerSheet } from "@/components/ui/TopicPickerSheet";
import { AthleteSearch } from "@/components/ui/AthleteSearch";
import { createClient } from "@/lib/supabase/client";
import { LessonTemplate, fetchLessonTemplates } from "@/lib/lesson-template-sync";
import { fetchRecentLessonsByPlayer, saveLessonRecord, LessonRecord } from "@/lib/lesson-sync";
import { fetchLatestScoreByPlayer, ScoreData } from "@/lib/score-sync";
import { uploadFiles } from "@/lib/storage-sync";
import { saveCompletedItem, saveEvent } from "@/lib/schedule-sync";
import { formatLocalDate } from "@/lib/utils";
import { Trophy, AlertTriangle, TrendingDown, TrendingUp, ChevronRight as ChevronRight2 } from "lucide-react";

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

    const [lessonDate, setLessonDate] = useState(() => formatLocalDate());

    // ── Consolidate Mount Logic (Draft + Params) ──────────────────
    useEffect(() => {
        // 1. Check if we should resume from draft
        // Should resume if: 1) We set a flag before navigating away, or 2) It's a page reload
        const navEntries = window.performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
        const isReload = navEntries.length > 0 && navEntries[0].type === "reload";
        const isResumeNavigation = sessionStorage.getItem("resume_lesson_create") === "true";
        
        const shouldClear = !isReload && !isResumeNavigation;
        
        if (shouldClear) {
            localStorage.removeItem(DRAFT_KEY);
        }
        
        // Always consume the flag
        sessionStorage.removeItem("resume_lesson_create");

        // 2. Load Draft from LocalStorage
        const draft = localStorage.getItem(DRAFT_KEY);
        if (draft) {
            try {
                const data = JSON.parse(draft);
                // Only load if updated within the last 10 minutes
                const isRecent = data.updatedAt && (new Date().getTime() - new Date(data.updatedAt).getTime() < 10 * 60 * 1000);
                
                if (isRecent) {
                    if (data.selectedPlayers && data.selectedPlayers.length > 0) {
                        setSelectedPlayers(data.selectedPlayers);
                    }
                    if (data.selectedPart) setSelectedPart(data.selectedPart as LessonType);
                    if (data.lessonDate) setLessonDate(data.lessonDate);
                    if (data.startSlot) setStartSlot(data.startSlot);
                    if (data.endSlot) setEndSlot(data.endSlot);
                    if (data.period) setPeriod(data.period);
                    if (data.lessonContent) setLessonContent(data.lessonContent);
                } else {
                    localStorage.removeItem(DRAFT_KEY);
                }
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
        }
        if (endParam && ALL_SLOTS.includes(endParam)) {
            setEndSlot(endParam);
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

        isInitialMount.current = false;
    }, [searchParams, router]);

    const [startSlot, setStartSlot] = useState<string | null>(() => {
        const now = new Date();
        const future = new Date(now.getTime() + 30 * 60000);
        const h = future.getHours().toString().padStart(2, '0');
        const m = future.getMinutes() < 30 ? "00" : "30";
        const slot = `${h}:${m}`;
        return ALL_SLOTS.includes(slot) ? slot : "09:00";
    });
    const [endSlot, setEndSlot] = useState<string | null>(() => {
        const now = new Date();
        const future = new Date(now.getTime() + 90 * 60000);
        const h = future.getHours().toString().padStart(2, '0');
        const m = future.getMinutes() < 30 ? "00" : "30";
        const slot = `${h}:${m}`;
        return ALL_SLOTS.includes(slot) ? slot : "10:00";
    });
    const [period, setPeriod] = useState<"am" | "pm">(() => {
        const now = new Date();
        const future = new Date(now.getTime() + 30 * 60000);
        return future.getHours() >= 13 ? "pm" : "am";
    });

    const slots = period === "am" ? AM_SLOTS : PM_SLOTS;

    const handleSlotClick = (slot: string) => {
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

    const [selectedPart, setSelectedPart] = useState<LessonType | "">("");
    const [lessonContent, setLessonContent] = useState("");
    const [selectedImages, setSelectedImages] = useState<string[]>([]);
    const [isImagePickerOpen, setIsImagePickerOpen] = useState(true);
    const [templateSearchQuery, setTemplateSearchQuery] = useState("");
    const [dbTemplates, setDbTemplates] = useState<LessonTemplate[]>([]);
    const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false);
    const templateDropdownRef = useRef<HTMLDivElement>(null);

    const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    const [recentLessons, setRecentLessons] = useState<LessonRecord[]>([]);
    const [recentScore, setRecentScore] = useState<ScoreData | null>(null);

    const isFormValid = useMemo(() => {
        return selectedPlayers.length > 0 && !!selectedPart && !!lessonContent.trim();
    }, [selectedPlayers, selectedPart, lessonContent]);

    // ── Draft Persistence ──────────────────────────────────────────
    const isInitialMount = useRef(true);

    // Save Draft
    useEffect(() => {
        if (isInitialMount.current || isAborting) return;
        
        const draft = {
            selectedPlayers,
            selectedPart,
            lessonDate,
            startSlot,
            endSlot,
            period,
            lessonContent,
            updatedAt: new Date().toLocaleString('sv-SE').replace(' ', 'T')
        };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }, [selectedPlayers, selectedPart, lessonDate, startSlot, endSlot, period, lessonContent, isAborting]);

    useEffect(() => {
        fetchLessonTemplates().then(setDbTemplates);
    }, []);

    useEffect(() => {
        const fetchUser = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: dbUser } = await supabase.from("users").select("name").eq("id", user.id).maybeSingle();
                if (dbUser?.name) setCurrentCoachName(dbUser.name);
            }
        };
        fetchUser();
    }, []);

    const lastSelectedPlayer = selectedPlayers[selectedPlayers.length - 1];

    useEffect(() => {
        if (lastSelectedPlayer) {
            fetchRecentLessonsByPlayer(lastSelectedPlayer, selectedPart).then(setRecentLessons);
            fetchLatestScoreByPlayer(lastSelectedPlayer).then(setRecentScore);
        } else {
            setRecentLessons([]);
            setRecentScore(null);
        }
    }, [lastSelectedPlayer, selectedPart]);

    // Close template dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (templateDropdownRef.current && !templateDropdownRef.current.contains(e.target as Node)) {
                setIsTemplateDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredTemplates = useMemo(() => {
        return dbTemplates.filter(t => {
            const searchMatch = t.title.toLowerCase().includes(templateSearchQuery.toLowerCase());
            return searchMatch;
        });
    }, [dbTemplates, templateSearchQuery]);

    // Filter players based on search query
    const visiblePlayers = useMemo(() => {
        return mockPlayers.filter((p) => p.includes(searchQuery));
    }, [searchQuery]);

    const handlePlayerAdd = (p: string) => {
        if (!selectedPlayers.includes(p)) {
            setSelectedPlayers(prev => [...prev, p]);
        }
        setSearchQuery("");
        setIsPlayerDropdownOpen(false);
    };

    const handlePlayerRemove = (p: string) => {
        setSelectedPlayers(prev => prev.filter(n => n !== p));
    };

    const handleTemplateSelect = (templateId: string) => {
        setSelectedImages(prev => 
            prev.includes(templateId) 
                ? prev.filter(v => v !== templateId) 
                : [...prev, templateId]
        );
        setTemplateSearchQuery("");
        setIsTemplateDropdownOpen(false);
    };

    const handleTemplateKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && isTemplateDropdownOpen && filteredTemplates.length > 0) {
            e.preventDefault();
            handleTemplateSelect(filteredTemplates[0].id);
        }
    };



    const handleResumeNavigate = (url: string) => {
        sessionStorage.setItem("resume_lesson_create", "true");
        router.push(url);
    };

    const handleAbort = () => {
        setIsAborting(true);
        localStorage.removeItem(DRAFT_KEY);
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
            const allMedia = [
                ...selectedImages.map(id => `template:${id}`),
                ...uploadedUrls
            ];

            const scheduleId = searchParams.get("scheduleId");

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
                    date: lessonDate,
                    startTime: startSlot || "09:00",
                    endTime: endSlot || "10:00"
                });

                // 4. Mark as completed in schedule
                await saveCompletedItem({
                    participantName: player,
                    date: lessonDate,
                    type: "lesson",
                    scheduleId: scheduleId || undefined
                });
                
                // 5. Create a new completed schedule event if one doesn't exist
                if (!scheduleId) {
                    const start = new Date(`${lessonDate}T${startSlot || "09:00"}:00`);
                    const end = new Date(`${lessonDate}T${endSlot || "10:00"}:00`);
                    
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
            localStorage.removeItem(DRAFT_KEY);

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
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                        레슨 작성
                    </h1>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">

                    {/* ── 1. Basic Info ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {/* 1. Player Selection (Search/Autocomplete) */}
                            <div className="space-y-4 md:col-span-2">
                                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                    선수 선택 <span className="text-brand-red">*</span>
                                </label>
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
                                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                    파트 선택 <span className="text-brand-red">*</span>
                                </label>
                                <div className="flex flex-nowrap overflow-x-auto gap-2 pb-2 -mb-2 scrollbar-hide">
                                    {partOptions.map((opt) => (
                                        <button
                                            key={opt.key}
                                            type="button"
                                            onClick={() => setSelectedPart(opt.key)}
                                            className={cn(
                                                "whitespace-nowrap shrink-0 px-4 py-2.5 rounded-full text-sm font-medium transition-colors border",
                                                selectedPart === opt.key
                                                    ? "bg-brand-navy text-white border-brand-navy"
                                                    : "bg-transparent dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-brand-navy/50"
                                            )}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>



                            {/* 4. Date Selection */}
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                    레슨 일자 <span className="text-brand-red">*</span>
                                </label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                    <DatePickerInput
                                        value={lessonDate}
                                        onChange={(e) => setLessonDate(e.target.value)}
                                        required
                                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all text-center"
                                    />
                                </div>
                            </div>

                            {/* 5. Time Selection */}
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                    시간 선택 <span className="text-brand-red">*</span>
                                </label>

                                <div className="flex bg-transparent border border-zinc-200 dark:bg-zinc-800 rounded-lg p-0.5 w-fit mb-3">
                                    <button type="button" onClick={() => setPeriod("am")}
                                        className={cn("px-4 py-1.5 rounded-md text-xs font-semibold transition-all",
                                            period === "am" ? "bg-brand-navy text-white shadow-sm" : "text-zinc-500 dark:text-zinc-400"
                                        )}>오전</button>
                                    <button type="button" onClick={() => setPeriod("pm")}
                                        className={cn("px-4 py-1.5 rounded-md text-xs font-semibold transition-all",
                                            period === "pm" ? "bg-brand-navy text-white shadow-sm" : "text-zinc-500 dark:text-zinc-400"
                                        )}>오후</button>
                                </div>

                                <div className="grid grid-cols-6 gap-1.5">
                                    {slots.map((slot) => {
                                        const active = isInRange(slot);
                                        const isStart = slot === startSlot;
                                        const isEnd = slot === endSlot;
                                        return (
                                            <button key={slot} type="button" onClick={() => handleSlotClick(slot)}
                                                className={cn(
                                                    "py-2.5 rounded-xl text-xs font-medium transition-all border",
                                                    isStart || isEnd
                                                        ? "bg-brand-navy text-white border-brand-navy shadow-md"
                                                        : active
                                                            ? "bg-brand-navy/10 text-brand-navy border-brand-navy/20 dark:bg-brand-navy/30 dark:text-white"
                                                            : "bg-transparent dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400"
                                                )}>
                                                {slotLabel(slot)}
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                                    선택: <span className="font-semibold text-zinc-800 dark:text-zinc-200">{timeLabel}</span>
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* ── 2. History & Analysis (Conditional) ── */}
                    {selectedPlayers.length > 0 && selectedPart && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                            {/* Recent Lessons Box */}
                            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm flex flex-col">
                                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                                    <FileText size={18} className="text-brand-navy dark:text-brand-navy-light" />
                                    이전 레슨 내용 <span className="text-[11px] font-normal text-zinc-400">({lastSelectedPlayer})</span>
                                </h3>
                                <div className="space-y-4">
                                    {recentLessons.length > 0 ? recentLessons.slice(0, 3).map((lesson) => (
                                        <div key={lesson.id} className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[10px] font-bold text-brand-navy dark:text-brand-navy-light uppercase px-1.5 py-0.5 bg-brand-navy/5 dark:bg-brand-navy/20 rounded-md">
                                                    {lesson.category}
                                                </span>
                                                <span className="text-[10px] text-zinc-400 font-medium">{lesson.created_at.split('T')[0]}</span>
                                            </div>
                                            <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-1">{lesson.title}</h4>
                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                                                {lesson.content}
                                            </p>
                                        </div>
                                    )) : (
                                        <div className="py-8 text-center bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
                                            <p className="text-xs text-zinc-400">이전 레슨 기록이 없습니다.</p>
                                        </div>
                                    )}
                                </div>
                            </section>

                             {/* Recent Scorecard Summary Box (Field Note Style) */}
                             <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm flex flex-col min-h-[200px]">
                                 <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                                     <Trophy size={18} className="text-amber-500" />
                                     최근 라운드 요약 <span className="text-[11px] font-normal text-zinc-400">({lastSelectedPlayer})</span>
                                 </h3>
                                 
                                 {recentScore ? (
                                    <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-[1.5rem] p-5 border border-zinc-100 dark:border-zinc-800 space-y-5 flex-1">
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{recentScore.courseName}</p>
                                                <p className="text-[11px] text-zinc-400 font-medium">{recentScore.title}</p>
                                                <div className="flex items-center gap-1.5 mt-1.5 px-2 py-0.5 w-fit rounded bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold text-zinc-500">
                                                    <Calendar size={10} />
                                                    {recentScore.date.replace(/-/g, ".")}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className={cn(
                                                    "text-2xl font-black tracking-tighter leading-none",
                                                    recentScore.score < 72 ? "text-red-500" : recentScore.score > 72 ? "text-blue-500" : "text-zinc-900 dark:text-zinc-100"
                                                )}>
                                                    {recentScore.score}타
                                                </div>
                                                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mt-1">Final Score</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-4 gap-2">
                                            {[
                                                { label: "티샷", val: recentScore.teeShotSG },
                                                { label: "세컨샷", val: recentScore.secondShotSG },
                                                { label: "그린주변", val: recentScore.aroundGreenSG },
                                                { label: "퍼팅", val: recentScore.puttingSG }
                                            ].map((item, i) => (
                                                <div key={i} className="bg-white dark:bg-zinc-900/50 p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800/60 text-center">
                                                    <p className="text-[10px] font-bold text-zinc-400 mb-1">{item.label}</p>
                                                    <p className={cn(
                                                        "text-[13px] font-black tracking-tight",
                                                        item.val < 0 ? "text-red-500" : item.val > 0 ? "text-blue-500" : "text-zinc-600 dark:text-zinc-400"
                                                    )}>
                                                        {item.val > 0 ? `+${item.val.toFixed(2)}` : item.val.toFixed(2)}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="flex items-start gap-6 pt-1">
                                            <div className="flex-1 space-y-2">
                                                <div className="flex items-center gap-1.5">
                                                    <Trophy size={14} className="text-amber-500" />
                                                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight">Strong</span>
                                                </div>
                                                <div className="px-3 py-2 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-[11px] font-black text-red-600 dark:text-red-400 text-center">
                                                    {recentScore.strongPoint}
                                                </div>
                                            </div>

                                            <div className="flex-[2] space-y-2">
                                                <div className="flex items-center gap-1.5">
                                                    <AlertTriangle size={14} className="text-blue-500" />
                                                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight">Weak</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    {recentScore.weakPoints.map((wp, idx) => (
                                                        <div key={idx} className="flex-1 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 text-[11px] font-black text-blue-600 dark:text-blue-400 text-center">
                                                            {wp}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="pt-2 flex justify-end">
                                            <button 
                                                type="button"
                                                onClick={() => handleResumeNavigate(`/scores/${recentScore.id}`)}
                                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-navy text-white text-[11px] font-bold hover:bg-brand-navy/90 transition-all shadow-md shadow-brand-navy/10 active:scale-95"
                                            >
                                                상세 분석
                                                <ChevronRight2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                 ) : (
                                     <div className="flex-1 flex items-center justify-center py-8 text-center bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
                                         <p className="text-xs text-zinc-400">최근 라운드 기록이 없습니다.</p>
                                     </div>
                                 )}
                             </section>
                        </div>
                    )}


                    {/* ── 3. Content Input ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-6">

                        {/* Text Content */}
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                레슨 내용
                            </label>
                            <textarea
                                rows={6}
                                value={lessonContent}
                                onChange={(e) => setLessonContent(e.target.value)}
                                placeholder="레슨 내용을 상세히 기록해주세요..."
                                className="w-full p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all resize-y"
                            />
                        </div>

                        {/* File Attachment */}
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                첨부파일
                            </label>
                            <div className="space-y-3">
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer transition-colors">
                                        <Upload size={16} className="text-zinc-500" />
                                        파일 선택
                                        <input 
                                            type="file" 
                                            multiple 
                                            onChange={handleFileChange} 
                                            className="hidden" 
                                        />
                                    </label>
                                    <span className="text-xs text-zinc-400">
                                        {attachedFiles.length === 0 ? "선택된 파일 없음" : `${attachedFiles.length}개의 파일 선택됨`}
                                    </span>
                                </div>

                                {attachedFiles.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {attachedFiles.map((file, idx) => (
                                            <div key={idx} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                                                <Paperclip size={14} className="text-zinc-400" />
                                                <span className="text-xs text-zinc-600 dark:text-zinc-300 max-w-[150px] truncate">{file.name}</span>
                                                <button 
                                                    type="button"
                                                    onClick={() => removeFile(idx)}
                                                    className="text-zinc-400 hover:text-brand-red transition-colors"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 스윙 오류 선택 (Transformed from Image Selection) */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                    스윙 오류 선택
                                </label>
                                <div className="flex items-center gap-1.5">
                                    <TopicPickerSheet
                                        items={dbTemplates.map(t => ({ id: t.id, title: t.title, imageUrl: t.imageUrl }))}
                                        selectedValues={selectedImages}
                                        onToggle={(value) => {
                                            setSelectedImages(prev =>
                                                prev.includes(value)
                                                    ? prev.filter(v => v !== value)
                                                    : [...prev, value]
                                            );
                                        }}
                                        placeholder="스윙 오류 검색..."
                                    />
                                        <button
                                            type="button"
                                            onClick={() => handleResumeNavigate("/system/lesson-list")}
                                            className="flex items-center gap-1 text-[11px] font-bold text-zinc-400 hover:text-brand-navy transition-colors"
                                        >
                                            <ImageIcon size={12} />
                                            관리
                                        </button>
                                </div>
                            </div>

                            {/* Search bar for templates with autocomplete dropdown */}
                            <div className="relative" ref={templateDropdownRef}>
                                {/* Selected Chips for Swing Errors */}
                                {selectedImages.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mb-3">
                                        {selectedImages.map((val) => {
                                            const template = dbTemplates.find(t => t.id === val);
                                            return (
                                                <span key={val} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-navy/10 text-brand-navy dark:bg-brand-navy/20 dark:text-brand-navy-light text-xs font-bold border border-brand-navy/20">
                                                    {template?.title || val}
                                                    <button 
                                                        type="button" 
                                                        onClick={() => setSelectedImages(prev => prev.filter(v => v !== val))}
                                                        className="hover:text-brand-red transition-colors"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}

                                <div className="relative group">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-brand-navy transition-colors" size={16} />
                                    <input
                                        type="text"
                                        placeholder="스윙 오류 검색..."
                                        value={templateSearchQuery}
                                        onChange={(e) => {
                                            setTemplateSearchQuery(e.target.value);
                                            setIsTemplateDropdownOpen(true);
                                        }}
                                        onFocus={() => {
                                            if (templateSearchQuery.trim()) setIsTemplateDropdownOpen(true);
                                        }}
                                        onKeyDown={handleTemplateKeyDown}
                                        className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all shadow-sm font-medium"
                                    />
                                </div>

                                {/* Dropdown suggestions */}
                                {isTemplateDropdownOpen && templateSearchQuery.trim() !== "" && (
                                    <div className="absolute z-50 mt-1 w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="p-1">
                                            {filteredTemplates.length > 0 ? (
                                                filteredTemplates.map((template) => {
                                                    const isSelected = selectedImages.includes(template.id) || selectedImages.includes(template.title) || selectedImages.includes(template.imageUrl);
                                                    return (
                                                        <button
                                                            key={template.id}
                                                            type="button"
                                                            onClick={() => handleTemplateSelect(template.id)}
                                                            className={cn(
                                                                "w-full text-left px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all flex items-center justify-between",
                                                                isSelected
                                                                    ? "bg-brand-navy/10 text-brand-navy dark:text-brand-navy-light"
                                                                    : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                                            )}
                                                        >
                                                            <div className="flex items-center gap-2 truncate">
                                                                <span className="truncate">{template.title}</span>
                                                            </div>
                                                            {isSelected && <Check size={14} className="text-brand-navy shrink-0" />}
                                                        </button>
                                                    );
                                                })
                                            ) : (
                                                <div className="px-3 py-4 text-xs text-center text-zinc-500 italic">
                                                    "{templateSearchQuery}" 항목을 찾을 수 없습니다.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* ── 4. Footers / Actions ── */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                        <button
                            type="button"
                            onClick={handleAbort}
                            disabled={isUploading}
                            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={isUploading || !isFormValid}
                            className="bg-brand-red hover:bg-brand-red-dark disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-400 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm flex items-center gap-2"
                        >
                            {isUploading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    등록 중...
                                </>
                            ) : (
                                "레슨 등록"
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={(e) => handleSubmit(undefined, true)}
                            disabled={isUploading || !isFormValid}
                            className="bg-brand-navy hover:bg-brand-navy/90 disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-400 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm flex items-center gap-2"
                        >
                            {isUploading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    등록 중...
                                </>
                            ) : (
                                "레슨 등록 & 훈련 작성"
                            )}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
