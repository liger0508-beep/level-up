"use client";

export const dynamic = "force-dynamic";

import { useState, useMemo, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Calendar, Upload, Search, X, Layers, Image as ImageIcon, Map, Plus } from "lucide-react";
import { TrainingType } from "@/components/training/TrainingCard";
import { cn } from "@/lib/utils";
import { DatePickerInput } from "@/components/ui/DatePickerInput";
import { AthleteSearch } from "@/components/ui/AthleteSearch";
import { TopicPickerSheet } from "@/components/ui/TopicPickerSheet";
import { fetchTrainingTemplates, TrainingTemplate } from "@/lib/training-template-sync";
import { saveTrainingRecord, fetchRecentTrainingsByPlayer, TrainingRecord } from "@/lib/training-sync";
import { createClient } from "@/lib/supabase/client";
import { formatLocalDate } from "@/lib/utils";
import { uploadFiles } from "@/lib/storage-sync";
import { SwingPoseSetup, SwingPoseConfig } from "@/components/training/SwingPoseSetup";

// Mock Data for demonstration
const mockPlayers = ["이수진", "최민준", "김지윤", "박도윤", "김민수", "이지원", "박현우", "정세민"];

const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 1;
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (isNaN(s) || isNaN(e)) return 1;
    return Math.max(1, Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1);
};



const trainingTypeOptions = [
    { key: "lesson_review", label: "스윙키" },
    { key: "basic", label: "기본기" },
    { key: "swing_pose", label: "스윙모션" },
];

export default function CreateTrainingPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center text-zinc-400">페이지 로딩 중...</div>}>
            <CreateTrainingContent />
        </Suspense>
    );
}

function CreateTrainingContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
    const [isPlayerDropdownOpen, setIsPlayerDropdownOpen] = useState(false);
    const [templateSearchQuery, setTemplateSearchQuery] = useState("");
    const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false);
    const templateDropdownRef = useRef<HTMLDivElement>(null);

    const [isSaving, setIsSaving] = useState(false);
    const [templateSettings, setTemplateSettings] = useState<any[]>([]);
    const [dbTemplates, setDbTemplates] = useState<TrainingTemplate[]>([]);
    const [recentTrainings, setRecentTrainings] = useState<TrainingRecord[]>([]);
    const [isLoadingRecent, setIsLoadingRecent] = useState(false);
    const [currentCoachName, setCurrentCoachName] = useState("코치");

    const [trainingDate, setTrainingDate] = useState(() => formatLocalDate());
    const [trainingTime, setTrainingTime] = useState("12:00");
    const [termStart, setTermStart] = useState(() => formatLocalDate());
    const [termEnd, setTermEnd] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 6);
        const offset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - offset).toISOString().split('T')[0];
    });
    const [selectedTrainingType, setSelectedTrainingType] = useState<string>("lesson_review");
    const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
    const [trainingComment, setTrainingComment] = useState("");
    const [totalCount, setTotalCount] = useState(7);
    const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
    const [isDraftLoaded, setIsDraftLoaded] = useState(false);
    
    // States for "lesson_review"
    const [lessonComments, setLessonComments] = useState<string[]>([""]);
    const [goalType, setGoalType] = useState<"count" | "time">("time");
    const [goalCount, setGoalCount] = useState<number | "">(10);
    const [goalTime, setGoalTime] = useState<number | "">(30);
    const [trainingMethod, setTrainingMethod] = useState<"camera" | "voice">("voice");
    const [swingKeyInterval, setSwingKeyInterval] = useState<number | "">(25);

    // States for "swing_pose"
    const [swingPoseConfig, setSwingPoseConfig] = useState<SwingPoseConfig | null>(null);
    const [swingPoseFile, setSwingPoseFile] = useState<File | null>(null);

    const DRAFT_KEY = "gla_training_draft";

    // Restore draft on mount
    useEffect(() => {
        try {
            const draft = sessionStorage.getItem(DRAFT_KEY);
            if (draft) {
                const parsed = JSON.parse(draft);
                if (parsed.selectedPlayers) setSelectedPlayers(parsed.selectedPlayers);
                if (parsed.selectedTrainingType) setSelectedTrainingType(parsed.selectedTrainingType);
                if (parsed.selectedTemplates) setSelectedTemplates(parsed.selectedTemplates);
                if (parsed.templateSettings) setTemplateSettings(parsed.templateSettings);
                if (parsed.trainingDate) setTrainingDate(parsed.trainingDate);
                if (parsed.trainingTime) setTrainingTime(parsed.trainingTime);
                if (parsed.termStart) setTermStart(parsed.termStart);
                if (parsed.termEnd) setTermEnd(parsed.termEnd);
                if (parsed.trainingComment) setTrainingComment(parsed.trainingComment);
                if (parsed.totalCount) setTotalCount(parsed.totalCount);
                if (parsed.lessonComments) setLessonComments(parsed.lessonComments);
                if (parsed.goalType) setGoalType(parsed.goalType);
                if (parsed.goalCount) setGoalCount(parsed.goalCount);
                if (parsed.goalTime) setGoalTime(parsed.goalTime);
                if (parsed.trainingMethod) setTrainingMethod(parsed.trainingMethod);
                if (parsed.swingKeyInterval) setSwingKeyInterval(parsed.swingKeyInterval);
            }
        } catch (e) {
            console.error("Failed to load draft:", e);
        } finally {
            setIsDraftLoaded(true);
        }
    }, [searchParams]);

    // Save draft on change
    useEffect(() => {
        if (!isDraftLoaded) return;
        try {
            const draft = {
                selectedPlayers,
                selectedTrainingType,
                selectedTemplates,
                templateSettings,
                trainingDate,
                trainingTime,
                termStart,
                termEnd,
                trainingComment,
                totalCount,
                lessonComments,
                goalType,
                goalCount,
                goalTime,
                trainingMethod,
                swingKeyInterval
            };
            sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        } catch (e) {
            console.error("Failed to save draft:", e);
        }
    }, [isDraftLoaded, selectedPlayers, selectedTrainingType, selectedTemplates, templateSettings, trainingDate, trainingTime, termStart, termEnd, trainingComment, totalCount, lessonComments, goalType, goalCount, goalTime, trainingMethod, swingKeyInterval]);

    // Initialize state from search params
    useEffect(() => {
        const loadTemplates = async () => {
            const data = await fetchTrainingTemplates();
            setDbTemplates(data);
        };
        loadTemplates();

        const playerParam = searchParams.get("player");
        const typeParam = searchParams.get("type");
        const dateParam = searchParams.get("date");
        const startParam = searchParams.get("start");

        const hasDraft = !!sessionStorage.getItem(DRAFT_KEY);

        if (!hasDraft) {
            if (playerParam) setSelectedPlayers([playerParam]);
            if (typeParam) setSelectedTrainingType(typeParam);
            if (dateParam) {
                setTrainingDate(dateParam);
                setTermStart(dateParam);
                const d = new Date(dateParam);
                d.setDate(d.getDate() + 6);
                const offset = d.getTimezoneOffset() * 60000;
                setTermEnd(new Date(d.getTime() - offset).toISOString().split('T')[0]);
                setTotalCount(7);
            }
            if (startParam) setTrainingTime(startParam);
        }

        // Fetch current user name
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

                // RBAC Check
                if (dbUser && dbUser.role !== 'coach' && dbUser.role !== 'admin') {
                    alert("훈련 작성 권한이 없습니다.");
                    router.push("/training");
                }
            } else {
                router.push("/login");
            }
        });
    }, [searchParams, router]);

    // Fetch recent trainings when players change
    useEffect(() => {
        const loadRecent = async () => {
            if (selectedPlayers.length === 0) {
                setRecentTrainings([]);
                return;
            }
            setIsLoadingRecent(true);
            try {
                // Show for the most recently added player (the last one)
                const lastPlayer = selectedPlayers[selectedPlayers.length - 1];
                const data = await fetchRecentTrainingsByPlayer(lastPlayer);
                setRecentTrainings(data);
            } catch (err) {
                console.error("Failed to load recent trainings:", err);
            } finally {
                setIsLoadingRecent(false);
            }
        };
        loadRecent();
    }, [selectedPlayers]);

    // Filter templates based on search query
    const visibleTemplates = useMemo(() => {
        return dbTemplates.filter((t) =>
            (t.title.toLowerCase().includes(templateSearchQuery.toLowerCase()) || 
             (t.description && t.description.toLowerCase().includes(templateSearchQuery.toLowerCase()))) &&
            !selectedTemplates.includes(t.id)
        );
    }, [templateSearchQuery, dbTemplates, selectedTemplates]);

    // Handle clicks outside for dropdowns
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (templateDropdownRef.current && !templateDropdownRef.current.contains(event.target as Node)) {
                setIsTemplateDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handlePlayerAdd = (p: string) => {
        if (!selectedPlayers.includes(p)) {
            setSelectedPlayers([...selectedPlayers, p]);
        }
        setSearchQuery("");
        setIsPlayerDropdownOpen(false);
    };

    const handlePlayerRemove = (p: string) => {
        setSelectedPlayers(selectedPlayers.filter(name => name !== p));
    };

    const handleTemplateAdd = (id: string) => {
        if (selectedTemplates.includes(id)) return;
        const template = dbTemplates.find(t => t.id === id);
        if (!template) return;

        setSelectedTemplates(prev => [...prev, id]);
        setTemplateSettings(prev => [...prev, {
            id: template.id,
            title: template.title,
            description: template.description || "",
            purpose: template.purpose || "",
            goal: template.goal || "",
            termStart: termStart,
            termEnd: termEnd,
            totalCount: totalCount
        }]);
        setTemplateSearchQuery("");
        setIsTemplateDropdownOpen(false);
    };

    const handleTemplateRemove = (id: string) => {
        setSelectedTemplates(prev => prev.filter(v => v !== id));
        setTemplateSettings(prev => prev.filter(s => s.id !== id));
    };

    const handleTemplateToggle = (id: string) => {
        if (selectedTemplates.includes(id)) {
            handleTemplateRemove(id);
        } else {
            handleTemplateAdd(id);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (selectedPlayers.length === 0) {
            alert("선수를 한 명 이상 선택해주세요.");
            return;
        }

        if (!selectedTrainingType) {
            alert("훈련 유형을 선택해주세요.");
            return;
        }

        if (!termStart || !termEnd) {
            alert("훈련 기간을 입력해주세요.");
            return;
        }

        setIsSaving(true);
        try {
            const typeLabel = trainingTypeOptions.find(opt => opt.key === selectedTrainingType)?.label || "";

            let uploadedUrls: string[] = [];
            if (attachedFiles.length > 0) {
                uploadedUrls = await uploadFiles(attachedFiles, "records");
            }

            for (const player of selectedPlayers) {
                if (selectedTrainingType === "lesson_review") {
                    const finalTitle = typeLabel ? `[${typeLabel}] 훈련` : "훈련";
                    const { error } = await saveTrainingRecord({
                        playerName: player,
                        category: selectedTrainingType,
                        title: finalTitle,
                        content: trainingComment,
                        media_urls: uploadedUrls,
                        date: trainingDate,
                        startTime: trainingTime,
                        training_start: termStart,
                        training_end: termEnd,
                        total_count: (goalTime as number) || 0,
                        template_settings: [{
                            type: "lesson_review",
                            comments: lessonComments.filter(c => c.trim() !== ""),
                            goalType: "time",
                            goalValue: (goalTime as number) || 0,
                            trainingMethod: "voice",
                            swingKeyInterval: (swingKeyInterval as number) || 25
                        }]
                    });
                    if (error) throw new Error(error);
                } else if (templateSettings.length > 0) {
                    for (const setting of templateSettings) {
                        const finalTitle = typeLabel ? `[${typeLabel}] ${setting.title}` : setting.title;
                        const { error } = await saveTrainingRecord({
                            playerName: player,
                            category: selectedTrainingType,
                            title: finalTitle,
                            content: trainingComment,
                            media_urls: uploadedUrls,
                            date: trainingDate,
                            startTime: trainingTime,
                            training_start: setting.termStart || termStart,
                            training_end: setting.termEnd || termEnd,
                            total_count: setting.totalCount || totalCount,
                            template_settings: [{
                                id: setting.id,
                                title: setting.title,
                                description: setting.description,
                                purpose: setting.purpose,
                                goal: setting.goal
                            }]
                        });
                        if (error) throw new Error(error);
                    }
                } else if (selectedTrainingType === "swing_pose") {
                    if (!swingPoseConfig || !swingPoseFile) {
                        throw new Error("스윙 설정을 완료해주세요 (사진 업로드 및 관절 선택).");
                    }
                    let swingUrl = "";
                    const poseUploadedUrls = await uploadFiles([swingPoseFile], "records");
                    if (poseUploadedUrls.length > 0) {
                        swingUrl = poseUploadedUrls[0];
                    }
                    const finalTitle = typeLabel ? `[${typeLabel}] 훈련` : "훈련";
                    const { error } = await saveTrainingRecord({
                        playerName: player,
                        category: selectedTrainingType,
                        title: finalTitle,
                        content: trainingComment,
                        media_urls: [swingUrl],
                        date: trainingDate,
                        startTime: trainingTime,
                        training_start: termStart,
                        training_end: termEnd,
                        total_count: (goalTime as number) || 0,
                        template_settings: [swingPoseConfig]
                    });
                    if (error) throw new Error(error);
                } else {
                    const finalTitle = typeLabel ? `[${typeLabel}] 훈련` : "훈련";
                    const { error } = await saveTrainingRecord({
                        playerName: player,
                        category: selectedTrainingType,
                        title: finalTitle,
                        content: trainingComment,
                        media_urls: uploadedUrls,
                        date: trainingDate,
                        startTime: trainingTime,
                        training_start: termStart,
                        training_end: termEnd,
                        total_count: totalCount,
                        template_settings: []
                    });
                    if (error) throw new Error(error);
                }
            }

            alert(`${selectedPlayers.length}명의 훈련이 등록되었습니다.`);
            sessionStorage.removeItem(DRAFT_KEY);
            router.push("/training");
            router.refresh();
        } catch (error: any) {
            console.error("Failed to save training:", error);
            alert("훈련 등록에 실패했습니다: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4 sm:px-8 py-6">
            <div className="max-w-3xl mx-auto">

                {/* ── Header ── */}
                <div className="flex items-center gap-3 mb-8">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-50 transition-colors"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                        훈련 작성
                    </h1>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">

                    {/* ── 1. Basic Info ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {/* 1. Multi-Player Selection */}
                            <div className="space-y-4 md:col-span-2">
                                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                    선수 선택 <span className="text-brand-red">*</span>
                                </label>
                                <AthleteSearch
                                    multi={true}
                                    selectedNames={selectedPlayers}
                                    onSelect={(name: string) => handlePlayerAdd(name)}
                                    onRemove={(name: string) => handlePlayerRemove(name)}
                                    placeholder="선수 이름을 검색하여 추가하세요..."
                                />
                            </div>



                            {/* 3. Training Type Selection */}
                            <div className="space-y-2 md:col-span-2">
                                <div className="mb-2">
                                    <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                        훈련 유형 <span className="text-brand-red">*</span>
                                    </label>
                                </div>
                                <div className="flex flex-nowrap overflow-x-auto scrollbar-hide gap-2 pb-1">
                                    {trainingTypeOptions.map((opt) => (
                                        <button
                                            key={opt.key}
                                            type="button"
                                            onClick={() => setSelectedTrainingType(opt.key)}
                                            className={cn(
                                                "shrink-0 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border",
                                                selectedTrainingType === opt.key
                                                    ? "bg-brand-navy text-white border-brand-navy shadow-sm"
                                                    : "bg-transparent dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-brand-navy/30"
                                            )}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                             {/* 4. Date Selection */}
                            <div className="space-y-2 md:col-span-2">
                                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                    훈련 일자 <span className="text-brand-red">*</span>
                                </label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                    <DatePickerInput
                                        value={trainingDate}
                                        onChange={(e) => {
                                            const newDate = e.target.value;
                                            setTrainingDate(newDate);
                                            
                                            const d = new Date(newDate);
                                            d.setDate(d.getDate() + 6);
                                            const offset = d.getTimezoneOffset() * 60000;
                                            const newEnd = new Date(d.getTime() - offset).toISOString().split('T')[0];

                                            if (!sessionStorage.getItem(DRAFT_KEY)) {
                                                setTermStart(newDate);
                                                setTermEnd(newEnd);
                                                setTotalCount(7);
                                            } else {
                                                // If draft exists but user manually changes date
                                                setTermStart(newDate);
                                                setTermEnd(newEnd);
                                                setTotalCount(7);
                                            }
                                        }}
                                        required
                                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all text-center"
                                    />
                                </div>
                            </div>
                        </div>
                    </section>


                    {/* ── Recent Training Status ── */}
                    {selectedPlayers.length > 0 && (
                        <section className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                    <Layers size={16} className="text-brand-navy" />
                                    최근 훈련 현황 <span className="text-[11px] font-normal text-zinc-400">({selectedPlayers[selectedPlayers.length - 1]})</span>
                                </h3>
                            </div>

                            {isLoadingRecent ? (
                                <div className="py-4 text-center">
                                    <div className="w-5 h-5 border-2 border-brand-navy border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                    <p className="text-[11px] text-zinc-400">최근 기록을 불러오는 중...</p>
                                </div>
                            ) : recentTrainings.length > 0 ? (
                                <div className="grid gap-3">
                                    {recentTrainings.map((train) => {
                                        let parsedLogs: string[] = [];
                                        if (Array.isArray(train.completion_logs)) {
                                            parsedLogs = train.completion_logs;
                                        } else if (typeof train.completion_logs === 'string') {
                                            try {
                                                const parsed = JSON.parse(train.completion_logs);
                                                parsedLogs = Array.isArray(parsed) ? parsed : [];
                                            } catch {
                                                parsedLogs = [(train.completion_logs as string)];
                                            }
                                        }

                                        let progressPercent = 0;
                                        const reviewSetting = train.template_settings?.find((s: any) => s.type === "review_scorecard");
                                        
                                        if (reviewSetting) {
                                            const completedCount = reviewSetting.completedHoles?.length || 0;
                                            progressPercent = Math.min(100, Math.round((completedCount / (train.total_count || 1)) * 100));
                                        } else {
                                            progressPercent = Math.min(100, Math.round(((parsedLogs.length) / (train.total_count || 7)) * 100));
                                        }
                                        
                                        let displayType = train.type;
                                        let displayTitle = train.title;
                                        let trainingMethod = "";
                                        
                                        const match = train.title.match(/^\[(.*?)\]\s*(.*)$/);
                                        if (match) {
                                            trainingMethod = match[1];
                                            displayTitle = match[2];
                                        }

                                        return (
                                        <div key={train.id} className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 shadow-sm relative flex flex-col gap-1">
                                            {/* Line 1: Type | Method */}
                                            <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide">
                                                {displayType} {trainingMethod ? `| ${trainingMethod}` : ""}
                                            </div>
                                            
                                            {/* Line 2: Title */}
                                            <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 pr-16 truncate">
                                                {displayTitle}
                                            </div>
                                            
                                            {/* Line 3: Progress Rate */}
                                            <div className="flex items-center gap-2 mt-1">
                                                <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden max-w-[120px]">
                                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${progressPercent}%` }} />
                                                </div>
                                                <span className="text-[11px] font-bold text-blue-500">
                                                    {progressPercent}% 진행
                                                </span>
                                            </div>

                                            {/* Date: Bottom Right */}
                                            <div className="absolute bottom-4 right-4 text-[10px] text-zinc-400">
                                                {new Date(train.created_at).toLocaleDateString()}
                                            </div>
                                        </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="py-6 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                                    <p className="text-xs text-zinc-400">등록된 최근 훈련 기록이 없습니다.</p>
                                </div>
                            )}
                        </section>
                    )}


                    {/* ── 2. Training Content & Comment ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-6">

                        {/* File Attachment */}
                        {selectedTrainingType !== "swing_pose" && selectedTrainingType !== "lesson_review" && (
                            <div className="space-y-2 mb-6">
                                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                    첨부파일
                                </label>
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer transition-colors">
                                        <Upload size={16} className="text-zinc-500" />
                                        파일 선택
                                        <input 
                                            type="file" 
                                            className="hidden" 
                                            multiple
                                            accept="image/*,video/*"
                                            onChange={(e) => {
                                                if (e.target.files) {
                                                    setAttachedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                                                }
                                            }}
                                        />
                                    </label>
                                    <span className="text-xs text-zinc-400">
                                        {attachedFiles.length > 0 ? `${attachedFiles.length}개의 파일 선택됨` : "선택된 파일 없음"}
                                    </span>
                                </div>
                                {attachedFiles.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {attachedFiles.map((file, i) => (
                                            <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 rounded-lg border border-zinc-200 dark:border-zinc-700">
                                                <ImageIcon size={12} className="text-zinc-400" />
                                                <span className="max-w-[150px] truncate">{file.name}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setAttachedFiles(prev => prev.filter((_, idx) => idx !== i))}
                                                    className="p-0.5 hover:text-brand-red transition-colors ml-1"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        )}

                        {selectedTrainingType === "swing_pose" && (
                            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                                <SwingPoseSetup 
                                    onChange={(config) => setSwingPoseConfig(config)}
                                    onImageSelected={(file) => setSwingPoseFile(file)}
                                />

                                {/* Goal Setting (Swing Pose) */}
                                <div className="space-y-4 mt-8">
                                    <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                        성공 횟수 목표 <span className="text-brand-red">*</span>
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="number"
                                            value={goalCount}
                                            onChange={(e) => setGoalCount(parseInt(e.target.value) || 0)}
                                            className="w-full flex-1 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all font-bold"
                                        />
                                        <span className="text-sm text-zinc-500 whitespace-nowrap">회</span>
                                    </div>
                                    <p className="text-[11px] text-zinc-400">
                                        * 설정된 판정 타이밍에 목표 각도를 위 횟수만큼 성공해야 훈련이 완료됩니다.
                                    </p>
                                </div>
                            </div>
                        )}

                        {selectedTrainingType === "lesson_review" ? (
                            <div className="space-y-8 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                                {/* Lesson Comments */}
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                            코멘트 설정 (최대 5개) <span className="text-brand-red">*</span>
                                        </label>
                                    </div>
                                    <div className="space-y-2">
                                        {lessonComments.map((comment, index) => (
                                            <div key={index} className="flex items-start gap-2">
                                                <div className="flex-1">
                                                    <textarea
                                                        rows={1}
                                                        value={comment}
                                                        onChange={(e) => {
                                                            const newComments = [...lessonComments];
                                                            newComments[index] = e.target.value;
                                                            setLessonComments(newComments);
                                                        }}
                                                        placeholder={`코멘트 ${index + 1} 입력...`}
                                                        className="w-full p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all resize-y"
                                                    />
                                                </div>
                                                {lessonComments.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newComments = lessonComments.filter((_, i) => i !== index);
                                                            setLessonComments(newComments);
                                                        }}
                                                        className="p-2.5 text-zinc-400 hover:text-brand-red transition-colors bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 mt-1"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        {lessonComments.length < 5 && (
                                            <div className="flex justify-end">
                                                <button
                                                    type="button"
                                                    onClick={() => setLessonComments([...lessonComments, ""])}
                                                    className="flex items-center gap-1 text-xs font-bold text-brand-navy hover:text-brand-navy/80 transition-colors mt-2"
                                                >
                                                    <Plus size={14} /> 코멘트 추가
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-zinc-400">
                                        * 입력된 코멘트는 훈련 시 순차적으로 반복 재생됩니다.
                                    </p>
                                </div>

                                {/* Goal and Interval Settings */}
                                <div className="grid grid-cols-2 gap-6">
                                    {/* Goal Setting */}
                                    <div className="space-y-3">
                                        <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                            훈련 목표 (시간) <span className="text-brand-red">*</span>
                                        </label>
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    type="number"
                                                    value={goalTime}
                                                    onChange={(e) => setGoalTime(e.target.value === "" ? "" : parseInt(e.target.value))}
                                                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all font-bold"
                                                />
                                                <span className="text-sm text-zinc-500 whitespace-nowrap">분</span>
                                            </div>
                                            <p className="text-[11px] text-zinc-400">
                                                * 훈련을 진행할 총 시간입니다.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Swing Key Interval */}
                                    <div className="space-y-3">
                                        <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                            스윙키 간격 <span className="text-brand-red">*</span>
                                        </label>
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    type="number"
                                                    value={swingKeyInterval}
                                                    onChange={(e) => setSwingKeyInterval(e.target.value === "" ? "" : parseInt(e.target.value))}
                                                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all font-bold"
                                                    min="1"
                                                />
                                                <span className="text-sm text-zinc-500 whitespace-nowrap">초</span>
                                            </div>
                                            <p className="text-[11px] text-zinc-400">
                                                * 코멘트 자동 반복 재생 간격입니다.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Training Duration (Reused) */}
                                <div className="space-y-4">
                                    <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                        훈련 기간 {termStart && termEnd && (
                                            <span className="text-brand-navy dark:text-brand-navy-light ml-1 underline underline-offset-4 decoration-2">
                                                ({Math.ceil((new Date(termEnd).getTime() - new Date(termStart).getTime()) / (1000 * 60 * 60 * 24)) + 1}일)
                                            </span>
                                        )} <span className="text-brand-red">*</span>
                                    </label>
                                    <div className="flex items-center gap-4">
                                        <div className="flex-1 relative">
                                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                            <DatePickerInput
                                                value={termStart}
                                                onChange={(e) => {
                                                    const newVal = e.target.value;
                                                    setTermStart(newVal);
                                                    setTotalCount(calculateDays(newVal, termEnd));
                                                }}
                                                placeholder="시작일"
                                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all text-center"
                                            />
                                        </div>
                                        <span className="text-zinc-400 text-sm">~</span>
                                        <div className="flex-1 relative">
                                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                            <DatePickerInput
                                                value={termEnd}
                                                onChange={(e) => {
                                                    const newVal = e.target.value;
                                                    setTermEnd(newVal);
                                                    setTotalCount(calculateDays(termStart, newVal));
                                                }}
                                                placeholder="종료일"
                                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all text-center"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                        {/* Training Comment */}
                        <div className="space-y-2 mb-6">
                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                훈련 코멘트
                            </label>
                            <textarea
                                rows={4}
                                value={trainingComment}
                                onChange={(e) => setTrainingComment(e.target.value)}
                                placeholder="코치님의 코멘트를 자유롭게 입력해주세요..."
                                className="w-full p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all resize-y"
                            />
                        </div>

                        {/* Global Training Period Selection (Hidden if templates selected) */}
                        {selectedTemplates.length === 0 && (
                            <>
                                <div className="space-y-4 mb-6">
                                    <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                        훈련 기간 {termStart && termEnd && (
                                            <span className="text-brand-navy dark:text-brand-navy-light ml-1 underline underline-offset-4 decoration-2">
                                                ({Math.ceil((new Date(termEnd).getTime() - new Date(termStart).getTime()) / (1000 * 60 * 60 * 24)) + 1}일)
                                            </span>
                                        )} <span className="text-brand-red">*</span>
                                    </label>
                                    <div className="flex items-center gap-4">
                                        <div className="flex-1 relative">
                                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                            <DatePickerInput
                                                value={termStart}
                                                onChange={(e) => {
                                                    const newVal = e.target.value;
                                                    setTermStart(newVal);
                                                    setTotalCount(calculateDays(newVal, termEnd));
                                                }}
                                                placeholder="시작일"
                                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all text-center"
                                            />
                                        </div>
                                        <span className="text-zinc-400 text-sm">~</span>
                                        <div className="flex-1 relative">
                                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                            <DatePickerInput
                                                value={termEnd}
                                                onChange={(e) => {
                                                    const newVal = e.target.value;
                                                    setTermEnd(newVal);
                                                    setTotalCount(calculateDays(termStart, newVal));
                                                }}
                                                placeholder="종료일"
                                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all text-center"
                                            />
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-zinc-400">
                                        * 선택 사항입니다. 특정 기간 동안 진행되는 훈련인 경우 지정해주세요.
                                    </p>
                                </div>

                                {selectedTrainingType !== "swing_pose" && (
                                <div className="space-y-4 mb-8">
                                    <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                        훈련 총 횟수 <span className="text-brand-red">*</span>
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <input 
                                            type="number"
                                            value={totalCount}
                                            onChange={(e) => setTotalCount(parseInt(e.target.value) || 0)}
                                            className="w-24 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all text-zinc-900 dark:text-zinc-100 font-bold"
                                        />
                                        <span className="text-sm text-zinc-500">회</span>
                                    </div>
                                    <p className="text-[11px] text-zinc-400">
                                        * 훈련 진행률을 계산하는 기준이 됩니다. (기본값: 기간에 따른 1일 1회)
                                    </p>
                                </div>
                                )}
                            </>
                        )}

                        {selectedTrainingType !== "swing_pose" && (
                            <>
                        {/* Training Content Selection */}
                        <div className="space-y-4 relative pt-6 border-t border-zinc-100 dark:border-zinc-800">
                            <div className="flex items-center justify-between">
                                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                    훈련 컨텐츠
                                </label>
                            </div>

                            {selectedTemplates.length > 0 ? (
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                    {selectedTemplates.map((val, index) => {
                                        const template = dbTemplates.find(t => t.id === val);
                                        return (
                                            <span key={`${val}-${index}`} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300 text-sm font-medium border border-blue-200 dark:border-blue-800/50 shadow-sm">
                                                {template?.title || val}
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleTemplateRemove(val)}
                                                    className="p-0.5 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800/50 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </span>
                                        );
                                    })}
                                    <button
                                        type="button"
                                        onClick={() => router.push('/system/training-list?mode=select')}
                                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-sm font-medium border border-zinc-200 dark:border-zinc-700 shadow-sm"
                                    >
                                        <Plus size={16} />
                                        추가
                                    </button>
                                </div>
                            ) : (
                                <div className="py-4 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-800/30">
                                    <button
                                        type="button"
                                        onClick={() => router.push('/system/training-list?mode=select')}
                                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white border border-zinc-200 text-sm font-bold text-zinc-700 shadow-sm hover:bg-zinc-50 transition-colors"
                                    >
                                        <Search size={16} />
                                        훈련 찾아보기
                                    </button>
                                </div>
                            )}
                        </div>



                        {/* Selected Template Details */}
                        {templateSettings.length > 0 && (
                            <div className="space-y-6 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                    <Layers size={16} className="text-blue-500" />
                                    선택된 훈련 컨텐츠 상세 설정
                                </h3>
                                
                                <div className="space-y-4">
                                    {templateSettings.map((setting) => (
                                        <div key={setting.id} className="bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-4 space-y-4 relative overflow-hidden">
                                            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{setting.title}</h4>
                                                <button 
                                                    type="button"
                                                    onClick={() => handleTemplateRemove(setting.id)}
                                                    className="text-zinc-400 hover:text-brand-red transition-colors"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-1 gap-4 text-xs">
                                                <div className="space-y-1">
                                                    <span className="font-bold text-zinc-400 uppercase tracking-tight">훈련 방법</span>
                                                    <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed bg-white dark:bg-zinc-900/50 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
                                                        {setting.description || "설명 없음"}
                                                    </p>
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="font-bold text-zinc-400 uppercase tracking-tight">훈련 목적</span>
                                                    <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed bg-white dark:bg-zinc-900/50 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
                                                        {setting.purpose || "목적 없음"}
                                                    </p>
                                                </div>

                                                {/* Individual Training Period */}
                                                <div className="space-y-2 mt-2">
                                                    <label className="block font-bold text-blue-500 dark:text-blue-400 uppercase tracking-tight">
                                                        이 훈련의 개별 기간/횟수 설정
                                                    </label>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                                                            <div className="flex-1 relative">
                                                                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                                                                <DatePickerInput
                                                                    value={setting.termStart}
                                                                    onChange={(e) => {
                                                                        const newVal = e.target.value;
                                                                        setTemplateSettings(prev => prev.map(s => s.id === setting.id ? { ...s, termStart: newVal, totalCount: calculateDays(newVal, s.termEnd) } : s));
                                                                    }}
                                                                    className="w-full pl-8 pr-2 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 text-center"
                                                                />
                                                            </div>
                                                            <span className="text-zinc-400">~</span>
                                                            <div className="flex-1 relative">
                                                                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                                                                <DatePickerInput
                                                                    value={setting.termEnd}
                                                                    onChange={(e) => {
                                                                        const newVal = e.target.value;
                                                                        setTemplateSettings(prev => prev.map(s => s.id === setting.id ? { ...s, termEnd: newVal, totalCount: calculateDays(s.termStart, newVal) } : s));
                                                                    }}
                                                                    className="w-full pl-8 pr-2 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 text-center"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <input 
                                                                type="number"
                                                                value={setting.totalCount}
                                                                onChange={(e) => {
                                                                    const newVal = parseInt(e.target.value) || 0;
                                                                    setTemplateSettings(prev => prev.map(s => s.id === setting.id ? { ...s, totalCount: newVal } : s));
                                                                }}
                                                                className="w-16 px-2 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-center font-bold text-zinc-900 dark:text-zinc-100"
                                                            />
                                                            <span className="text-xs text-zinc-500">회</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="block font-bold text-blue-500 dark:text-blue-400 uppercase tracking-tight">
                                                        훈련 목표 (변경 가능)
                                                    </label>
                                                    <textarea
                                                        value={setting.goal}
                                                        onChange={(e) => {
                                                            const newVal = e.target.value;
                                                            setTemplateSettings(prev => prev.map(s => s.id === setting.id ? { ...s, goal: newVal } : s));
                                                        }}
                                                        placeholder="훈련 목표를 입력하세요..."
                                                        className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-brand-navy/40 transition-all min-h-[60px] resize-none"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                            </>
                        )}
                        </>
                        )}




                    </section>

                    {/* ── 3. Footers / Actions ── */}
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
                            disabled={isSaving}
                            className={cn(
                                "bg-brand-red hover:bg-brand-red-dark text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm",
                                isSaving && "opacity-50 cursor-not-allowed"
                            )}
                        >
                            {isSaving ? "등록 중..." : "훈련 등록"}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
