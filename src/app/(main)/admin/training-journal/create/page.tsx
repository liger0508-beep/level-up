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
import { cn } from "@/lib/utils";
import { DatePickerInput } from "@/components/ui/DatePickerInput";
import { AthleteSearch } from "@/components/ui/AthleteSearch";
import { fetchJournals, saveJournal, calculateShotRatio, JournalType, JOURNAL_TYPE_LABELS } from "@/lib/journal-sync";
import { createClient } from "@/lib/supabase/client";
import { fetchLatestScoreByPlayer, ScoreData } from "@/lib/score-sync";
import { uploadFile } from "@/lib/storage-sync";

const mockPlayers = ["이수진", "최민준", "김지윤", "박도윤", "이지원", "한상욱"];

type ShotType = "good" | "miss" | "field";

export default function CreateJournalPage() {
    const router = useRouter();

    // ── Form State ──────────────────────────────────────────────────
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedPlayer, setSelectedPlayer] = useState("");
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [trainingDate, setTrainingDate] = useState(() =>
        new Date().toISOString().split("T")[0]
    );
    const [shotType, setShotType] = useState<ShotType | null>(null);
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [keywords, setKeywords] = useState<string[]>([]);
    const [keywordInput, setKeywordInput] = useState("");
    const [userRole, setUserRole] = useState<string | null>(null);
    const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
    const [latestScore, setLatestScore] = useState<ScoreData | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [currentUserName, setCurrentUserName] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (shotType === "field" && selectedPlayer) {
            fetchLatestScoreByPlayer(selectedPlayer).then(setLatestScore);
        } else {
            setLatestScore(null);
        }
    }, [shotType, selectedPlayer]);

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
    const ratio = useMemo(
        () => calculateShotRatio([]),
        []
    );

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
        if (!shotType || !selectedPlayer || isSubmitting) return;

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
                const url = await uploadFile(file, 'records', `journal/${Date.now()}`);
                if (url) media_urls.push(url);
            }

            // 3. Save Journal
            await saveJournal({
                type: shotType,
                title: title || `${selectedPlayer}의 ${JOURNAL_TYPE_LABELS[shotType]}`,
                content,
                date: trainingDate,
                userId: athleteData.id,
                coachId: userRole === 'athlete' ? athleteData.id : (currentUserId || ""),
                isImportant: false, // Default
                keywords,
                media_urls,
            });

            alert("훈련일지가 등록되었습니다.");
            router.push("/admin/training-journal");
        } catch (err: any) {
            console.error("Error submitting journal:", err?.message || err);
            alert("등록에 실패했습니다.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const isValid = !!trainingDate && !!shotType && !!content.trim();

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
                        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                            훈련일지 작성
                        </h1>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">

                    {/* ── 1. 선수 선택 ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm space-y-3">
                        <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                            선수 선택
                        </label>
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

                    {/* ── 2. 일지 작성일자 ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm space-y-3">
                        <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                            일지 작성일자 <span className="text-brand-red">*</span>
                        </label>
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

                    {/* ── 3. 굿샷/미스샷 비중 ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm space-y-4">
                        <div className="h-12 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex">
                            {ratio.goodPct > 0 && (
                                <div
                                    className="h-full bg-blue-500 flex items-center justify-center transition-all duration-500"
                                    style={{ width: `${ratio.goodPct}%` }}
                                >
                                    <span className="text-[11px] font-bold text-white whitespace-nowrap px-1">
                                        굿샷 {ratio.goodPct}%
                                    </span>
                                </div>
                            )}
                            {ratio.missPct > 0 && (
                                <div className="h-full bg-orange-400 flex items-center justify-center transition-all duration-500 flex-1">
                                    <span className="text-[11px] font-bold text-white whitespace-nowrap px-1">
                                        미스샷 {ratio.missPct}%
                                    </span>
                                </div>
                            )}
                            {ratio.total === 0 && (
                                <div className="h-full w-full flex items-center justify-center">
                                    <span className="text-[11px] text-zinc-400">데이터 없음</span>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                                <span className="text-[11px] text-zinc-500">굿샷 {ratio.good}건</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block" />
                                <span className="text-[11px] text-zinc-500">미스샷 {ratio.miss}건</span>
                            </div>
                        </div>
                    </section>

                    {/* ── 4. 굿샷 / 미스샷 선택 ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm space-y-3">
                        <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                            구분 선택 <span className="text-brand-red">*</span>
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            <button
                                type="button"
                                onClick={() => setShotType("good")}
                                className={cn(
                                    "relative flex flex-col items-center justify-center gap-2 py-5 rounded-2xl border-2 font-bold text-sm transition-all duration-200 active:scale-95",
                                    shotType === "good"
                                        ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-md shadow-blue-500/10"
                                        : "border-zinc-200 dark:border-zinc-700 bg-transparent text-zinc-500 dark:text-zinc-400 hover:border-blue-300"
                                )}
                            >
                                {shotType === "good" && (
                                    <CheckCircle2 size={16} className="absolute top-3 right-3 text-blue-500" />
                                )}
                                <span className="text-2xl">🎯</span>
                                <span>굿샷</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setShotType("miss")}
                                className={cn(
                                    "relative flex flex-col items-center justify-center gap-2 py-5 rounded-2xl border-2 font-bold text-sm transition-all duration-200 active:scale-95",
                                    shotType === "miss"
                                        ? "border-orange-400 bg-orange-50 dark:bg-orange-400/10 text-orange-500 dark:text-orange-400 shadow-md shadow-orange-400/10"
                                        : "border-zinc-200 dark:border-zinc-700 bg-transparent text-zinc-500 dark:text-zinc-400 hover:border-orange-300"
                                )}
                            >
                                {shotType === "miss" && (
                                    <CheckCircle2 size={16} className="absolute top-3 right-3 text-orange-400" />
                                )}
                                <span className="text-2xl">⚠️</span>
                                <span>미스샷</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setShotType("field")}
                                className={cn(
                                    "relative flex flex-col items-center justify-center gap-2 py-5 rounded-2xl border-2 font-bold text-sm transition-all duration-200 active:scale-95",
                                    shotType === "field"
                                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-md shadow-indigo-500/10"
                                        : "border-zinc-200 dark:border-zinc-700 bg-transparent text-zinc-500 dark:text-zinc-400 hover:border-indigo-300"
                                )}
                            >
                                {shotType === "field" && (
                                    <CheckCircle2 size={16} className="absolute top-3 right-3 text-indigo-500" />
                                )}
                                <span className="text-2xl">📝</span>
                                <span>필드노트</span>
                            </button>
                        </div>
                    </section>

                    {/* ── 4.5 키워드 작성 ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm space-y-3">
                        <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                            키워드 작성
                        </label>
                        <div className="space-y-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="키워드 입력 후 Enter (예: 테이크백, 릴리즈...)"
                                    value={keywordInput}
                                    onChange={(e) => setKeywordInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            const val = keywordInput.trim();
                                            if (val && !keywords.includes(val)) {
                                                setKeywords([...keywords, val]);
                                                setKeywordInput("");
                                            }
                                        }
                                    }}
                                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all font-medium"
                                />
                            </div>

                            {keywords.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {keywords.map((kw) => (
                                        <div
                                            key={kw}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-all hover:bg-zinc-200 dark:hover:bg-zinc-700"
                                        >
                                            <span>#{kw}</span>
                                            <button
                                                type="button"
                                                onClick={() => setKeywords(keywords.filter(k => k !== kw))}
                                                className="p-0.5 rounded-full hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* ── Latest Score (Field Note Only) ── */}
                        {shotType === "field" && (
                            <div className="mt-5 pt-5 border-t border-zinc-100 dark:border-zinc-800/50">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <Trophy size={14} className="text-amber-500" />
                                        <h3 className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">최근 스코어 정보</h3>
                                    </div>
                                    {latestScore && (
                                        <span className="text-[10px] font-medium text-zinc-400">{latestScore.date.replace(/-/g, ".")}</span>
                                    )}
                                </div>
                                
                                {latestScore ? (
                                    <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                                        <div className="space-y-1">
                                            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{latestScore.courseName}</p>
                                            <p className="text-[11px] text-zinc-500">{latestScore.title}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <div className={cn(
                                                    "text-xl font-black tracking-tight",
                                                    latestScore.score < 72 ? "text-red-500" : latestScore.score > 72 ? "text-blue-500" : "text-zinc-900 dark:text-zinc-100"
                                                )}>
                                                    {latestScore.score}타
                                                </div>
                                                <p className="text-[10px] text-zinc-400 font-medium">최종 스코어</p>
                                            </div>
                                            <Link 
                                                href={`/scores/${latestScore.id}`}
                                                className="w-8 h-8 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-brand-navy transition-colors shadow-sm"
                                            >
                                                <ArrowRight size={14} />
                                            </Link>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-6 border border-dashed border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center gap-2">
                                        <BarChart3 size={20} className="text-zinc-300" />
                                        <p className="text-xs text-zinc-400">등록된 최신 스코어가 없습니다.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </section>

                    {/* ── 5. 제목 & 내용 ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm space-y-4">
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                내용 <span className="text-brand-red">*</span>
                            </label>
                            <textarea
                                rows={6}
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="훈련 내용을 상세히 기록해주세요..."
                                className="w-full p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all resize-y"
                            />
                        </div>
                    </section>

                    {/* ── 6. 첨부파일 ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm space-y-3">
                        <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                            첨부파일
                        </label>
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:border-brand-navy/60 hover:text-brand-navy dark:hover:text-brand-navy-light transition-all w-full justify-center"
                        >
                            <Upload size={16} />
                            파일 선택 (이미지, 영상)
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept="image/*,video/*"
                            className="hidden"
                            onChange={handleFileChange}
                        />

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
                        {attachedFiles.length === 0 && (
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
                            등록하기
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
