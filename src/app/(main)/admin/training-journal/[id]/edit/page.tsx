"use client";
import { FileUploadButton } from "@/components/ui/FileUploadButton";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
    ChevronLeft,
    Calendar,
    Upload,
    X,
    BookOpen,
    Paperclip,
    CheckCircle2,
    Check,
    Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DatePickerInput } from "@/components/ui/DatePickerInput";
import { Journal, JournalType, calculateShotRatio, getPlainText, fetchJournalById, updateJournal } from "@/lib/journal-sync";
import { uploadFile } from "@/lib/storage-sync";

import { PageTitle, SectionTitle, LabelText } from "@/components/ui/Typography";

type ShotType = "good" | "miss" | "field";

export default function EditJournalPage() {
    const router = useRouter();
    const params = useParams();
    const { id } = params;

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // ── Form State ──────────────────────────────────────────────────
    const [trainingDate, setTrainingDate] = useState("");
    const [shotType, setShotType] = useState<ShotType>("good");
    const [content, setContent] = useState("");
    const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
    const [existingMedia, setExistingMedia] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (id) {
            fetchJournalById(id as string).then(data => {
                if (data) {
                    setTrainingDate(data.date);
                    setShotType(data.type === "all" ? "good" : data.type as ShotType);
                    setContent(getPlainText(data.content));
                    setExistingMedia(data.media_urls || []);
                }
                setIsLoading(false);
            });
        }
    }, [id]);

    // ── Shot Ratio (Mock for UI) ─────────────────────────────────────
    const ratio = { good: 12, miss: 4, total: 16, goodPct: 75, missPct: 25 };

    // ── File Upload ──────────────────────────────────────────────────
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setAttachedFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
        }
        e.target.value = "";
    };

    const removeFile = (index: number) => {
        setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
    };

    // ── Submit ───────────────────────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        try {
            setIsSubmitting(true);

            // 1. Upload new files
            const newMediaUrls: string[] = [];
            for (const file of attachedFiles) {
                const url = await uploadFile(file, 'records', `journal/${Date.now()}`);
                if (url) newMediaUrls.push(url);
            }

            // 2. Update Journal
            await updateJournal(id as string, {
                type: shotType as any,
                date: trainingDate,
                content: content,
                media_urls: [...existingMedia, ...newMediaUrls],
            });
            alert("수정이 완료되었습니다.");
            router.push(`/admin/training-journal/${id}`);
        } catch (err) {
            console.error("Error updating journal:", err);
            alert("수정에 실패했습니다.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const placeholderText = useMemo(() => {
        if (shotType === "good") {
            return "굿샷을 반복할수 있도록 훈련중 잘된 점을 상세히 기록해 주세요";
        }
        if (shotType === "miss") {
            return "미스샷을 반복하지 않도록 훈련중 안된 점을 상세히 기록해 주세요";
        }
        if (shotType === "field") {
            return "라운드중 느낀점을 상세히 기록해 주세요";
        }
        return "훈련 내용을 상세히 기록해 주세요";
    }, [shotType]);

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
                        <PageTitle>
                            훈련일지 수정
                        </PageTitle>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">

                    {/* ── 1. 훈련 일자 ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm space-y-3">
                        <LabelText>
                            훈련 일자 <span className="text-brand-red">*</span>
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

                    {/* ── 2. 굿샷/미스샷 비중 ── */}
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

                    {/* ── 3. 구분 선택 ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm space-y-3">
                        <LabelText>
                            구분 선택 <span className="text-brand-red">*</span>
                        </LabelText>
                        <div className="grid grid-cols-2 gap-3">
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
                        </div>
                        <div className="text-[12px] text-zinc-500 mt-2">
                            * 실수보다 굿샷 내용을 70% 이상 기록하는 것이 효과적입니다.
                        </div>
                    </section>

                    {/* ── 4. 내용 ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm space-y-3">
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
                    </section>

                    {/* ── 5. 첨부파일 ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm space-y-3">
                        <LabelText>
                            첨부파일
                        </LabelText>
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:border-brand-navy/60 hover:text-brand-navy dark:hover:text-brand-navy-light transition-all w-full justify-center"
                        >
                            <Upload size={16} />
                            파일 선택 (이미지, 영상)
                        </button>
                        <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleFileChange} />

                        <div className="space-y-4">
                            {existingMedia.length > 0 && (
                                <div className="space-y-2">
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
                                <div className="space-y-2">
                                    <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">새로 추가된 파일</p>
                                    <ul className="space-y-2">
                                        {attachedFiles.map((file, idx) => (
                                            <li key={idx} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Paperclip size={14} className="text-zinc-400 shrink-0" />
                                                    <span className="text-xs text-zinc-700 dark:text-zinc-300 truncate">{file.name}</span>
                                                    <span className="text-[10px] text-zinc-400 shrink-0">({(file.size / 1024).toFixed(0)} KB)</span>
                                                </div>
                                                <button type="button" onClick={() => removeFile(idx)} className="shrink-0 p-1 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 transition-colors">
                                                    <X size={14} />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {existingMedia.length === 0 && attachedFiles.length === 0 && (
                                <p className="text-xs text-zinc-400 text-center py-4">첨부된 파일이 없습니다.</p>
                            )}
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
        </div>
    );
}