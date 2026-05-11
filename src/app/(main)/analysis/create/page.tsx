"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Calendar, FileText, Upload, Flag, Search, X, Paperclip } from "lucide-react";
import { AnalysisType } from "@/components/analysis/AnalysisCard";
import { cn } from "@/lib/utils";
import { DatePickerInput } from "@/components/ui/DatePickerInput";
import { createClient } from "@/lib/supabase/client";
import { AthleteSearch } from "@/components/ui/AthleteSearch";
import { saveAnalysisRecord, fetchAnalysisRecords, AnalysisRecord } from "@/lib/analysis-sync";
import { uploadFiles } from "@/lib/storage-sync";
import { formatLocalDate } from "@/lib/utils";

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

// Remove mock data - using real DB data


const partOptions: { key: AnalysisType; label: string }[] = [
    { key: "shot", label: "Shot" },
    { key: "short_game", label: "Short Game" },
    { key: "physical", label: "Physical" },
    { key: "etc", label: "Etc" },
];

export default function CreateAnalysisPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedPlayer, setSelectedPlayer] = useState("");
    const [isPlayerDropdownOpen, setIsPlayerDropdownOpen] = useState(false);
    const [currentCoachName, setCurrentCoachName] = useState("코치");
    const [analysisHistory, setAnalysisHistory] = useState<AnalysisRecord[]>([]);

    // Initialize state from search params
    useEffect(() => {
        const playerParam = searchParams.get("player");
        const typeParam = searchParams.get("type");
        const startParam = searchParams.get("start");
        const endParam = searchParams.get("end");

        if (playerParam) setSelectedPlayer(playerParam);
        if (typeParam) setSelectedPart(typeParam as AnalysisType);

        if (startParam && ALL_SLOTS.includes(startParam)) {
            setStartSlot(startParam);
            const hour = parseInt(startParam.split(":")[0]);
            setPeriod(hour >= 13 ? "pm" : "am");
        }
        // Fetch current user (coach/admin) name from DB
        const supabase = createClient();
        supabase.auth.getUser().then(async ({ data: { user } }) => {
            if (user) {
                const { data: dbUser } = await supabase
                    .from("users")
                    .select("name, role")
                    .eq("id", user.id)
                    .maybeSingle();

                // RBAC: Only coaches and admins can access this page
                if (dbUser && dbUser.role !== 'coach' && dbUser.role !== 'admin') {
                    alert("분석 작성 권한이 없습니다.");
                    router.push("/analysis");
                    return;
                }

                if (dbUser?.name) {
                    setCurrentCoachName(dbUser.name);
                } else if (user.user_metadata?.name) {
                    setCurrentCoachName(user.user_metadata.name);
                }
            } else {
                // If not logged in, redirect to login
                router.push("/login");
            }
        });
    }, [searchParams]);

    // Fetch history when player is selected
    useEffect(() => {
        if (selectedPlayer) {
            fetchAnalysisRecords().then(records => {
                const playerHistory = records.filter(r => r.playerName === selectedPlayer);
                setAnalysisHistory(playerHistory);
            });
        } else {
            setAnalysisHistory([]);
        }
    }, [selectedPlayer]);

    const [analysisDate, setAnalysisDate] = useState(() => {
        return formatLocalDate();
    });

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

    const [selectedPart, setSelectedPart] = useState<AnalysisType | "">("");
    const [analysisContent, setAnalysisContent] = useState("");
    const [selectedImages, setSelectedImages] = useState<string[]>([]);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    // Filter players based on search query (No longer used as AthleteSearch handles it)
    const visiblePlayers = useMemo(() => {
        return [];
    }, []);

    const handlePlayerSelect = (p: string) => {
        setSelectedPlayer(p);
        setSearchQuery("");
        setIsPlayerDropdownOpen(false);
    };

    const showHistory = !!selectedPlayer && !!selectedPart;

    // Filter history by selected part and limit to 3
    const filteredRecentAnalysis = useMemo(() => {
        if (!selectedPart) return [];
        return analysisHistory
            .filter(item => item.type === selectedPart)
            .slice(0, 3);
    }, [selectedPart, analysisHistory]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const filesArray = Array.from(e.target.files);
            setSelectedFiles(prev => [...prev, ...filesArray]);
        }
    };

    const removeFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedPlayer) return alert("선수를 선택해주세요.");
        if (!selectedPart) return alert("파트를 선택해주세요.");
        if (!analysisContent) return alert("분석 내용을 입력해주세요.");

        try {
            setIsUploading(true);

            // 1. Upload files to Supabase Storage
            const uploadedUrls = await uploadFiles(selectedFiles);

            // 2. Save Analysis Record to database
            await saveAnalysisRecord({
                playerName: selectedPlayer,
                coachName: currentCoachName,
                type: selectedPart as AnalysisType,
                title: `${selectedPlayer} 분석 (${selectedPart})`,
                content: analysisContent,
                media_urls: [...selectedImages, ...uploadedUrls],
                date: analysisDate,
                time: startSlot || undefined
            });

            // 3. Optional: Sync with database schedule
            if (typeof window !== "undefined") {
                const { saveCompletedItem, getStoredEvents, saveEvent } = require("@/lib/schedule-sync");
                const { isSameDay } = require("date-fns");

                const scheduleId = searchParams.get("scheduleId");
                await saveCompletedItem({
                    participantName: selectedPlayer,
                    date: analysisDate,
                    type: "analysis",
                    time: startSlot || undefined,
                    scheduleId: scheduleId || undefined
                });

                const events = await getStoredEvents();
                const hasExisting = events.some((ev: any) =>
                    ev.participantName === selectedPlayer &&
                    isSameDay(new Date(ev.start), new Date(analysisDate)) &&
                    ev.type === "analysis"
                );

                if (!hasExisting && startSlot && endSlot) {
                    const start = new Date(`${analysisDate}T${startSlot}:00`);
                    const end = new Date(`${analysisDate}T${endSlot}:00`);

                    await saveEvent({
                        id: crypto.randomUUID(),
                        title: `${selectedPlayer} 분석 (${selectedPart || "기타"})`,
                        start,
                        end,
                        type: "analysis",
                        category: selectedPart || undefined,
                        participantName: selectedPlayer,
                        coachName: currentCoachName,
                        status: "completed"
                    });
                }
            }

            alert(`분석이 성공적으로 등록되었습니다.`);
            router.push("/analysis");
        } catch (err: any) {
            console.error("Submit failed:", err);
            alert(`등록 실패: ${err.message || "알 수 없는 오류가 발생했습니다."}`);
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
                        onClick={() => router.back()}
                        className="p-2 -ml-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-50 transition-colors"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                        분석 작성
                    </h1>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">

                    {/* ── 1. Basic Info ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                            <div className="space-y-4 md:col-span-2">
                                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                    선수 선택 <span className="text-brand-red">*</span>
                                </label>
                                <AthleteSearch
                                    multi={false}
                                    selectedNames={selectedPlayer ? [selectedPlayer] : []}
                                    onSelect={(name: string) => setSelectedPlayer(name)}
                                    onRemove={() => setSelectedPlayer("")}
                                    placeholder="선수 이름을 검색하여 선택하세요..."
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
                                    분석 일자 <span className="text-brand-red">*</span>
                                </label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                    <DatePickerInput

                                        value={analysisDate}
                                        onChange={(e) => setAnalysisDate(e.target.value)}
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
                                            period === "am" ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 shadow-sm" : "text-zinc-500 dark:text-zinc-400"
                                        )}>오전</button>
                                    <button type="button" onClick={() => setPeriod("pm")}
                                        className={cn("px-4 py-1.5 rounded-md text-xs font-semibold transition-all",
                                            period === "pm" ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 shadow-sm" : "text-zinc-500 dark:text-zinc-400"
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

                    {/* ── 2. History (Conditional) ── */}
                    {showHistory && (
                        <div className="grid grid-cols-1 gap-6">
                            {/* Recent Analysis Box */}
                            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm flex flex-col">
                                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                                    <FileText size={18} className="text-brand-navy dark:text-brand-navy-light" />
                                    이전 분석 내역 (최근 3건)
                                </h3>
                                <div className="space-y-3 flex-1">
                                    {filteredRecentAnalysis.length > 0 ? (
                                        filteredRecentAnalysis.map(analysis => (
                                            <Link
                                                key={analysis.id}
                                                href={`/analysis/${analysis.id}`}
                                                className="block p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-800/30 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 uppercase">
                                                        {partOptions.find(o => o.key === analysis.type)?.label || analysis.type}
                                                    </span>
                                                    <span className="text-xs text-zinc-400">{analysis.date}</span>
                                                </div>
                                                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate mt-1">
                                                    {analysis.title}
                                                </p>
                                            </Link>
                                        ))
                                    ) : (
                                        <div className="h-full flex items-center justify-center p-4 text-sm text-zinc-400">
                                            해당 파트의 이전 분석 기록이 없습니다.
                                        </div>
                                    )}
                                </div>
                            </section>
                        </div>
                    )}


                    {/* ── 3. Content Input ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-6">

                        {/* Text Content */}
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                분석 내용
                            </label>
                            <textarea
                                rows={6}
                                value={analysisContent}
                                onChange={(e) => setAnalysisContent(e.target.value)}
                                placeholder="분석 내용을 상세히 기록해주세요..."
                                className="w-full p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all resize-y"
                            />
                        </div>

                        {/* File Attachment */}
                        <div className="space-y-4">
                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                첨부파일
                            </label>
                            <div className="flex flex-wrap items-center gap-4">
                                <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer transition-colors">
                                    <Upload size={16} className="text-zinc-500" />
                                    파일 추가
                                    <input
                                        type="file"
                                        multiple
                                        accept="image/*,video/*"
                                        className="hidden"
                                        onChange={handleFileChange}
                                        disabled={isUploading}
                                    />
                                </label>
                                <span className="text-xs text-zinc-400">
                                    {selectedFiles.length === 0 ? "선택된 파일 없음" : `${selectedFiles.length}개의 파일 선택됨`}
                                </span>
                            </div>

                            {/* Selected Files List */}
                            {selectedFiles.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                                    {selectedFiles.map((file, idx) => (
                                        <div
                                            key={idx}
                                            className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700"
                                        >
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <Paperclip size={14} className="text-zinc-400 shrink-0" />
                                                <span className="text-xs text-zinc-600 dark:text-zinc-300 truncate">
                                                    {file.name}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeFile(idx)}
                                                className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full text-zinc-400 hover:text-brand-red transition-colors"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                    </section>

                    {/* ── 4. Footers / Actions ── */}
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
                            disabled={isUploading}
                            className={cn(
                                "bg-brand-red hover:bg-brand-red-dark text-white px-8 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm active:scale-95 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:scale-100",
                                isUploading && "cursor-not-allowed opacity-70"
                            )}
                        >
                            {isUploading ? "업로드 및 저장 중..." : "분석 등록"}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
