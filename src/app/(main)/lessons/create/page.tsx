"use client";

export const dynamic = "force-dynamic";

import React, { useState, useMemo, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, Calendar, CheckCircle2, ChevronLeft, ChevronRight, Edit2, Flag, Image as ImageIcon, MapPin, Search, Trash2, Upload, Video, X, FileText, User, Circle, CornerDownRight, Plus, Check, ChevronDown, ChevronUp, Paperclip, Sparkles, RotateCcw } from "lucide-react";
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
import { LinkedJournalCard } from "@/components/training-plan/LinkedJournalCard";
import { JournalHistoryModal } from "@/components/training-plan/JournalHistoryModal";
import ReferenceDataModal from "@/components/lesson/ReferenceDataModal";
import { fetchJournalsByAthlete, Journal } from "@/lib/journal-sync";
import { uploadFiles } from "@/lib/storage-sync";
import { formatLocalDate } from "@/lib/utils";
import { CustomVideoPlayer } from "@/components/ui/CustomVideoPlayer";
import { VoiceInputButton } from "@/components/ui/VoiceInputButton";

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

function extractCoachContentFromAnalysis(content: string): string {
    if (!content) return "";
    const coachIndex = content.indexOf("[분석 내용 - 코치]");
    if (coachIndex === -1) return "";
    let afterCoach = content.substring(coachIndex + "[분석 내용 - 코치]".length);
    const memoIndex = afterCoach.indexOf("[메모]");
    if (memoIndex !== -1) {
        afterCoach = afterCoach.substring(0, memoIndex);
    }
    return afterCoach.trim();
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

const analysisModalPartOptions: { key: string; label: string }[] = [
    { key: "all", label: "ALL" },
    { key: "shot", label: "Shot" },
    { key: "approach", label: "Approach" },
    { key: "putt", label: "Putt" },
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
        const dateParam = searchParams.get("date");

        if (playerParam) setSelectedPlayers([playerParam]);
        if (typeParam) setSelectedPart(typeParam as LessonType);
        if (dateParam) {
            setLessonDate(dateParam);
            setIsTimeModified(true);
        }

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
        supabase.auth.getUser().then(async ({ data: { user } }: { data: { user: any } }) => {
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
    const [aiLoadingMode, setAiLoadingMode] = useState<"summarize" | "expand" | null>(null);
    const [prevLessonContent, setPrevLessonContent] = useState<string | null>(null);

    const handleAiHelper = async (mode: "summarize" | "expand") => {
        if (!lessonContent.trim()) {
            alert("먼저 레슨 내용을 간단히 입력해 주세요.");
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

    // Reference & Journal State
    const [isReferenceModalOpen, setIsReferenceModalOpen] = useState(false);
    const [allJournals, setAllJournals] = useState<Journal[]>([]);
    const [selectedJournalId, setSelectedJournalId] = useState<string | null>(null);
    const [isJournalHistoryModalOpen, setIsJournalHistoryModalOpen] = useState(false);
    const selectedJournal = useMemo(() => allJournals.find(j => j.id === selectedJournalId) || null, [allJournals, selectedJournalId]);

    const [recentLessons, setRecentLessons] = useState<LessonRecord[]>([]);
    const [allLessons, setAllLessons] = useState<LessonRecord[]>([]);
    const [allAnalyses, setAllAnalyses] = useState<LessonRecord[]>([]);
    const [isGoalHistoryModalOpen, setIsGoalHistoryModalOpen] = useState(false);

    const [isAnalysisHistoryModalOpen, setIsAnalysisHistoryModalOpen] = useState(false);
    const [analysisHistorySelectedPart, setAnalysisHistorySelectedPart] = useState<string>("all");
    const [analysisHistorySearchQuery, setAnalysisHistorySearchQuery] = useState("");
    const [analysisHistoryDisplayLimit, setAnalysisHistoryDisplayLimit] = useState(10);
    const [isCoachNoteHistoryModalOpen, setIsCoachNoteHistoryModalOpen] = useState(false);

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

    const analysisCoachNotes = useMemo(() => {
        return allAnalyses
            .map(a => ({
                id: a.id,
                category: a.category,
                created_at: a.created_at,
                coachName: a.coachName,
                coachContent: extractCoachContentFromAnalysis(a.content),
            }))
            .filter(item => item.coachContent.length > 0);
    }, [allAnalyses]);

    const latestCoachNote = analysisCoachNotes[0] || null;

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
                fetchRecentLessonsByPlayer(lastSelectedPlayer, selectedPart === "all" ? undefined : selectedPart),
                fetchJournalsByAthlete(lastSelectedPlayer)
            ]).then(([lessons, journals]) => {
                setRecentLessons(lessons);
                setAllJournals(journals);
                if (journals.length > 0) {
                    setSelectedJournalId(journals[0].id);
                } else {
                    setSelectedJournalId(null);
                }
            });
        } else {
            setRecentLessons([]);
            setAllJournals([]);
            setSelectedJournalId(null);
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

    // 분석 목표 설정 조회
    useEffect(() => {
        if (lastSelectedPlayer) {
            fetchAllLessonsByPlayer(lastSelectedPlayer, undefined, 50, "analysis").then(setAllAnalyses);
        } else {
            setAllAnalyses([]);
        }
    }, [lastSelectedPlayer]);




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
                });
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

                    {/* ── 2. History & Reference (Conditional) ── */}
                    {selectedPlayers.length > 0 && selectedPart && (
                        <div className="space-y-6">
                            {/* Analysis Goal Box */}
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

                            {/* Analysis History Box */}
                            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 rounded-2xl shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <SectionTitle>
                                        <FileText size={18} className="text-brand-navy dark:text-brand-navy-light" /> 최근 분석 기록
                                    </SectionTitle>
                                </div>
                                <LinkedLessonCard
                                    part={selectedPart}
                                    lesson={allAnalyses.find(l => l.category === selectedPart) || allAnalyses[0] || null}
                                    onMoreClick={() => setIsAnalysisHistoryModalOpen(true)}
                                    moreText="더보기 (다른 분석 찾기)"
                                    emptyText="선택된 분석 기록이 없습니다."
                                    readOnly={false}
                                />
                            </section>

                            {/* Analysis Coach Note Box */}
                            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 rounded-2xl shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <SectionTitle>
                                        <FileText size={18} className="text-blue-500" /> 분석 내용 - 코치
                                    </SectionTitle>
                                </div>
                                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl flex flex-col relative transition-all hover:border-brand-navy/30">
                                    {latestCoachNote ? (
                                        <>
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-black px-2 py-0.5 rounded-md bg-brand-navy/10 text-brand-navy dark:bg-brand-navy/20 dark:text-brand-navy-light uppercase">
                                                        {latestCoachNote.category}
                                                    </span>
                                                    {latestCoachNote.coachName && (
                                                        <span className="text-xs font-medium text-zinc-500">{latestCoachNote.coachName}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex-1 min-h-0 flex flex-col">
                                                <div className="text-sm text-zinc-900 dark:text-zinc-100 mt-2 mb-2 whitespace-pre-wrap break-words">
                                                    {latestCoachNote.coachContent}
                                                </div>
                                                <div className="text-[10px] text-zinc-400 mt-2">
                                                    {latestCoachNote.created_at ? new Date(latestCoachNote.created_at).toLocaleDateString() : ""}
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex-1 min-h-[60px] flex items-center justify-center text-xs text-zinc-400 italic">
                                            등록된 코치 공유 내용이 없습니다.
                                        </div>
                                    )}

                                    {analysisCoachNotes.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                                            <div />
                                            <button
                                                type="button"
                                                onClick={() => setIsCoachNoteHistoryModalOpen(true)}
                                                className="flex items-center gap-1 text-[11px] font-bold text-zinc-500 hover:text-brand-navy transition-colors"
                                            >
                                                <FileText size={12} />
                                                더보기 (이전 코치 내용 보기)
                                                <ChevronRight size={12} />
                                            </button>
                                        </div>
                                    )}
                                </div>
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
                                    <FileUploadButton label="바로 촬영" icon={<Video size={16} className="text-zinc-500" />} accept="video/*" onChange={handleFileChange} />
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
                        <div className="flex flex-col gap-3">
                            <textarea
                                rows={6}
                                value={lessonContent}
                                onChange={(e) => setLessonContent(e.target.value)}
                                placeholder="레슨 내용을 간략하게 적은 후, 하단 AI 버튼을 누르면 전문적이고 조리 있게 정리해 드립니다."
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

            {/* Analysis Coach Note History Modal */}
            {isCoachNoteHistoryModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setIsCoachNoteHistoryModalOpen(false)}>
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
                        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 shrink-0">
                            <div className="flex items-center gap-3">
                                <button type="button" onClick={() => setIsCoachNoteHistoryModalOpen(false)} className="p-1.5 text-zinc-400 hover:text-zinc-900 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 transition-colors">
                                    <ChevronLeft size={20} />
                                </button>
                                <SectionTitle>
                                    <FileText size={18} className="text-blue-500" /> 분석 내용 - 코치 기록 찾아보기
                                </SectionTitle>
                            </div>
                            <button type="button" onClick={() => setIsCoachNoteHistoryModalOpen(false)} className="p-1.5 text-zinc-400 hover:text-zinc-600 rounded-lg">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4 sm:p-5 space-y-3 overflow-y-auto flex-1 bg-zinc-50/50 dark:bg-zinc-900/30">
                            {analysisCoachNotes.map((item) => (
                                <div
                                    key={item.id}
                                    onClick={() => router.push(`/analysis/${item.id}`)}
                                    className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 hover:border-blue-400/70 rounded-2xl p-4 sm:p-5 shadow-sm transition-all cursor-pointer space-y-2"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase px-2 py-0.5 bg-blue-500/10 rounded-md">
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
                                        {item.coachContent}
                                    </p>
                                </div>
                            ))}
                            {analysisCoachNotes.length === 0 && (
                                <div className="py-10 text-center text-zinc-500 text-sm">
                                    등록된 코치 공유 내용이 없습니다.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <ReferenceDataModal
                isOpen={isReferenceModalOpen}
                onClose={() => setIsReferenceModalOpen(false)}
                playerName={lastSelectedPlayer || ""}
            />
        </div>
    );
}