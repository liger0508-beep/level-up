"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { ChevronLeft, Calendar, FileText, Image as ImageIcon, Upload, Flag, Search, X, ChevronDown, ChevronUp, Paperclip, CheckCircle2, Check } from "lucide-react";
import { LessonType } from "@/components/lesson/LessonCard";
import { cn } from "@/lib/utils";
import { DatePickerInput } from "@/components/ui/DatePickerInput";
import { TopicPickerSheet } from "@/components/ui/TopicPickerSheet";
import { AthleteSearch } from "@/components/ui/AthleteSearch";
import { createClient } from "@/lib/supabase/client";
import { LessonTemplate, fetchLessonTemplates } from "@/lib/lesson-template-sync";
import { fetchRecentLessonsByPlayer, fetchRecentScorecard, updateLessonRecord, LessonRecord } from "@/lib/lesson-sync";
import { uploadFiles } from "@/lib/storage-sync";
import { parseMediaUrls } from "@/lib/analysis-sync";

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

    // Recent History
    const [recentLessons, setRecentLessons] = useState<LessonRecord[]>([]);
    const [recentScorecard, setRecentScorecard] = useState<any | null>(null);

    // Fetch initial data
    useEffect(() => {
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

                setSelectedPlayer(data.user?.name || "");
                setLessonDate(data.created_at?.split('T')[0] || "");
                setSelectedPart(data.category as LessonType || "");
                setLessonContent(data.content || "");

                const allMedia = parseMediaUrls(data.media_urls);
                const fileUrls = allMedia.filter(url => !url.startsWith('template:'));
                const templateIds = allMedia
                    .filter(url => url.startsWith('template:'))
                    .map(url => url.replace('template:', ''));

                setExistingMediaUrls(fileUrls);
                setSelectedImages(templateIds);

                // Fetch history if player exists
                if (data.user?.name) {
                    const [lessons, scorecard] = await Promise.all([
                        fetchRecentLessonsByPlayer(data.user.name),
                        fetchRecentScorecard(data.user.name)
                    ]);
                    setRecentLessons(lessons);
                    setRecentScorecard(scorecard);
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
        const [lessons, scorecard] = await Promise.all([
            fetchRecentLessonsByPlayer(name),
            fetchRecentScorecard(name)
        ]);
        setRecentLessons(lessons);
        setRecentScorecard(scorecard);
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPlayer || !selectedPart || !lessonDate || isSubmitting) return;

        setIsSubmitting(true);
        try {
            // Upload new files
            let newMediaUrls: string[] = [];
            if (attachedFiles.length > 0) {
                newMediaUrls = await uploadFiles(attachedFiles, 'records');
            }

            // Format templates
            const templateUrls = selectedImages.map(tid => `template:${tid}`);

            // Combine all media
            const allMedia = [...existingMediaUrls, ...newMediaUrls, ...templateUrls];

            await updateLessonRecord(id as string, {
                playerName: selectedPlayer,
                category: selectedPart as LessonType,
                title: selectedPlayer, // Automatic title
                content: lessonContent,
                media_urls: allMedia,
                date: lessonDate,
            });

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
                        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                            레슨 수정
                        </h1>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-2 relative">
                                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                    선수 선택 <span className="text-brand-red">*</span>
                                </label>
                                <AthleteSearch
                                    multi={false}
                                    selectedNames={selectedPlayer ? [selectedPlayer] : []}
                                    onSelect={(name) => handlePlayerSelect(name)}
                                    onRemove={() => setSelectedPlayer("")}
                                    placeholder="선수 이름을 검색하세요..."
                                />
                            </div>

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
                                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all"
                                    />
                                </div>
                            </div>

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
                                                    : "bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-brand-navy/50"
                                            )}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>

                    {showHistory && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm flex flex-col">
                                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                                    <FileText size={18} className="text-brand-navy dark:text-brand-navy-light" />
                                    이전 레슨 내용 (최근 3건)
                                </h3>
                                <div className="space-y-3 flex-1">
                                    {filteredRecentLessons.length > 0 ? (
                                        filteredRecentLessons.map(lesson => (
                                            <Link
                                                key={lesson.id}
                                                href={`/lessons/${lesson.id}`}
                                                target="_blank"
                                                className="block p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-800/30 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 uppercase">
                                                        {partOptions.find(o => o.key === lesson.category)?.label || lesson.category}
                                                    </span>
                                                    <span className="text-xs text-zinc-400">{lesson.created_at?.split('T')[0]}</span>
                                                </div>
                                                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate mt-1">
                                                    {lesson.title}
                                                </p>
                                            </Link>
                                        ))
                                    ) : (
                                        <div className="h-full flex items-center justify-center p-4 text-sm text-zinc-400">
                                            해당 파트의 이전 레슨 기록이 없습니다.
                                        </div>
                                    )}
                                </div>
                            </section>

                            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm flex flex-col">
                                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                                    <Flag size={18} className="text-brand-red" />
                                    최근 스코어 카드 요약
                                </h3>
                                {recentScorecard ? (
                                    <Link
                                        href={`/scores/${recentScorecard.id}`}
                                        target="_blank"
                                        className="block flex-1 rounded-xl border border-zinc-100 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-800/30 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors p-4 space-y-3"
                                    >
                                        <div className="flex justify-between items-baseline mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-2xl font-black text-brand-navy dark:text-white">{recentScorecard.score || 'N/A'}</span>
                                                <span className="text-xs text-zinc-500">타</span>
                                            </div>
                                            <span className="text-xs text-zinc-400">{recentScorecard.created_at?.split('T')[0]} • {recentScorecard.course || '코스 미지정'}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
                                            <div className="flex justify-between">
                                                <span className="text-zinc-500">티샷</span>
                                                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{recentScorecard.teeShot || '-'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-zinc-500">아이언샷</span>
                                                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{recentScorecard.iron || '-'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-zinc-500">피치샷</span>
                                                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{recentScorecard.pitch || '-'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-zinc-500">그린주변</span>
                                                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{recentScorecard.aroundGreen || '-'}</span>
                                            </div>
                                            <div className="flex justify-between col-span-2">
                                                <span className="text-zinc-500">퍼팅</span>
                                                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{recentScorecard.putting || '-'}</span>
                                            </div>
                                        </div>
                                    </Link>
                                ) : (
                                    <div className="flex-1 flex items-center justify-center p-4 text-sm text-zinc-400 border border-zinc-100 dark:border-zinc-800/50 rounded-xl bg-zinc-50/50 dark:bg-zinc-800/30">
                                        최근 스코어 카드 기록이 없습니다.
                                    </div>
                                )}
                            </section>
                        </div>
                    )}

                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-6">
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                레슨 내용
                            </label>
                            <textarea
                                rows={6}
                                value={lessonContent}
                                onChange={(e) => setLessonContent(e.target.value)}
                                placeholder="레슨 내용을 상세히 기록해주세요..."
                                className="w-full p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all resize-y"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                파일 첨부 (비디오/이미지)
                            </label>
                            <div className="flex flex-col gap-3">
                                <div className="flex flex-wrap gap-2">
                                    {existingMediaUrls.map((url, idx) => (
                                        <div key={`existing-${idx}`} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                                            <Paperclip size={14} className="text-zinc-400" />
                                            <span className="text-xs text-zinc-600 dark:text-zinc-300 max-w-[150px] truncate">기존 파일 {idx + 1}</span>
                                            <button type="button" onClick={() => removeExistingMedia(idx)} className="text-zinc-400 hover:text-brand-red ml-1"><X size={14} /></button>
                                        </div>
                                    ))}
                                    {attachedFiles.map((file, idx) => (
                                        <div key={`new-${idx}`} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                                            <Paperclip size={14} className="text-zinc-400" />
                                            <span className="text-xs text-zinc-600 dark:text-zinc-300 max-w-[150px] truncate">{file.name}</span>
                                            <button type="button" onClick={() => removeFile(idx)} className="text-zinc-400 hover:text-brand-red ml-1"><X size={14} /></button>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex items-center gap-4">
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                    >
                                        <Upload size={16} className="text-zinc-500" /> 파일 추가
                                    </button>
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

                        <div className="space-y-3 relative">
                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                시스템 스윙오류 템플릿
                            </label>
                            
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
                                trigger={
                                    <button
                                        type="button"
                                        className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:text-brand-navy hover:border-brand-navy hover:bg-brand-navy/5 transition-all font-medium text-sm"
                                    >
                                        <Search size={16} />
                                        스윙오류 검색 및 선택
                                    </button>
                                }
                            />
                        </div>
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
        </div>
    );
}
