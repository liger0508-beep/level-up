"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
    ChevronLeft, 
    Flag, 
    Upload, 
    X, 
    Link as LinkIcon, 
    Play,
    Paperclip,
    User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AthleteSearch } from "@/components/ui/AthleteSearch";
import { DatePickerInput } from "@/components/ui/DatePickerInput";
import { 
    COURSE_CAT_LABELS, 
    saveCourseRecord 
} from "@/lib/course-management-sync";
import { uploadFiles } from "@/lib/storage-sync";
import { createClient } from "@/lib/supabase/client";

export default function CreateCourseManagementPage() {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [selectedPlayer, setSelectedPlayer] = useState(""); // Empty means "전체"
    const [category, setCategory] = useState("shot");
    const [keywords, setKeywords] = useState<string[]>([]);
    const [keywordInput, setKeywordInput] = useState("");
    const [content, setContent] = useState("");
    const [date, setDate] = useState(() => {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    });
    const [videoUrl, setVideoUrl] = useState("");
    const [attachedFiles, setAttachedFiles] = useState<File[]>([]);

    const [isDraftLoaded, setIsDraftLoaded] = useState(false);
    const DRAFT_KEY = "gla_course_management_draft";

    useEffect(() => {
        try {
            const draft = sessionStorage.getItem(DRAFT_KEY);
            if (draft) {
                const parsed = JSON.parse(draft);
                if (parsed.selectedPlayer) setSelectedPlayer(parsed.selectedPlayer);
                if (parsed.category) setCategory(parsed.category);
                if (parsed.keywords) setKeywords(parsed.keywords);
                if (parsed.keywordInput !== undefined) setKeywordInput(parsed.keywordInput);
                if (parsed.content) setContent(parsed.content);
                if (parsed.date) setDate(parsed.date);
                if (parsed.videoUrl !== undefined) setVideoUrl(parsed.videoUrl);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsDraftLoaded(true);
        }
    }, []);

    useEffect(() => {
        if (!isDraftLoaded) return;
        try {
            sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
                selectedPlayer, category, keywords, keywordInput, content, date, videoUrl
            }));
        } catch (e) {}
    }, [isDraftLoaded, selectedPlayer, category, keywords, keywordInput, content, date, videoUrl]);

    // RBAC
    useEffect(() => {
        const supabase = createClient();
        supabase.auth.getUser().then(async ({ data: { user } }) => {
            if (user) {
                const { data: dbUser } = await supabase
                    .from("users")
                    .select("role")
                    .eq("id", user.id)
                    .maybeSingle();

                if (dbUser && dbUser.role !== 'coach' && dbUser.role !== 'admin') {
                    alert("작성 권한이 없습니다.");
                    router.push("/course-management");
                }
            } else {
                router.push("/login");
            }
        });
    }, [router]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setAttachedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };

    const removeFile = (index: number) => {
        setAttachedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (keywords.length === 0) {
            alert("키워드를 하나 이상 입력해주세요.");
            return;
        }

        try {
            setIsSubmitting(true);

            // 1. Upload files
            const uploadedUrls = await uploadFiles(attachedFiles, 'records');

            // 2. Combine with Video URL
            const allMedia = [...uploadedUrls];
            if (videoUrl.trim()) {
                allMedia.unshift(videoUrl.trim());
            }

            // 3. Save
            await saveCourseRecord({
                playerName: selectedPlayer || "전체",
                category,
                title: keywords.join(", "),
                content,
                media_urls: allMedia,
                date
            });

            alert("골프IQ 기록이 등록되었습니다.");
            sessionStorage.removeItem(DRAFT_KEY);
            router.push("/course-management");
        } catch (err: any) {
            console.error("Course Save Error:", err.message || err);
            alert("등록에 실패했습니다.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4 sm:px-8 py-6">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-3 mb-8">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-50 transition-colors"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <div className="flex items-center gap-2">
                        <Flag size={24} className="text-brand-navy" />
                        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                            골프IQ 작성
                        </h1>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6 pb-20">
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-6">
                        {/* Keywords Tag Input */}
                        <div className="space-y-3">
                            <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300">
                                키워드
                            </label>
                            
                            {/* Selected Keyword Chips */}
                            {keywords.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {keywords.map((kw, idx) => (
                                        <span key={idx} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-navy text-white text-xs font-bold shadow-sm animate-in fade-in zoom-in duration-200">
                                            {kw}
                                            <button 
                                                type="button" 
                                                onClick={() => setKeywords(prev => prev.filter((_, i) => i !== idx))}
                                                className="hover:text-brand-red transition-colors"
                                            >
                                                <X size={12} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}

                            <div className="relative group">
                                <input
                                    type="text"
                                    value={keywordInput}
                                    onChange={(e) => setKeywordInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === ",") {
                                            e.preventDefault();
                                            const val = keywordInput.trim().replace(/,$/, "");
                                            if (val && !keywords.includes(val)) {
                                                setKeywords(prev => [...prev, val]);
                                                setKeywordInput("");
                                            }
                                        }
                                    }}
                                    placeholder="키워드를 입력하고 엔터를 누르세요..."
                                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all"
                                />
                            </div>
                        </div>

                        {/* Player Selection */}
                        <div className="space-y-3">
                            <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                                <User size={16} className="text-brand-navy" />
                                대상 선수 (미선택 시 전체 공개)
                            </label>
                            <AthleteSearch
                                multi={false}
                                selectedNames={selectedPlayer ? [selectedPlayer] : []}
                                onSelect={(name) => setSelectedPlayer(name)}
                                onRemove={() => setSelectedPlayer("")}
                                placeholder="선수 이름을 검색하세요..."
                            />
                        </div>

                        {/* Category & Date */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-3">
                                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300">
                                    유형 선택
                                </label>
                                <select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40"
                                >
                                    {Object.entries(COURSE_CAT_LABELS).map(([key, label]) => (
                                        key !== "all" && <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-3">
                                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300">
                                    작성 일자
                                </label>
                                <DatePickerInput
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 text-center"
                                />
                            </div>
                        </div>

                        {/* Media Section */}
                        <div className="space-y-4 pt-2">
                            <label className="block text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                <Play size={18} className="text-brand-red" />
                                영상 미디어 추가
                            </label>
                            
                            {/* Video URL */}
                            <div className="relative">
                                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                <input
                                    type="url"
                                    value={videoUrl}
                                    onChange={(e) => setVideoUrl(e.target.value)}
                                    placeholder="유튜브 또는 영상 URL 입력..."
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40"
                                />
                            </div>

                            {/* File Upload */}
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors">
                                        <Upload size={16} className="text-zinc-500" />
                                        파일 첨부
                                        <input type="file" multiple onChange={handleFileChange} className="hidden" accept="video/*" />
                                    </label>
                                    <span className="text-xs text-zinc-400">
                                        {attachedFiles.length === 0 ? "업로드할 영상 파일을 선택하세요" : `${attachedFiles.length}개의 파일 선택됨`}
                                    </span>
                                </div>
                                {attachedFiles.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {attachedFiles.map((file, idx) => (
                                            <div key={idx} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700">
                                                <Paperclip size={14} className="text-zinc-400" />
                                                <span className="text-xs text-zinc-600 dark:text-zinc-300 truncate max-w-[200px]">{file.name}</span>
                                                <button type="button" onClick={() => removeFile(idx)} className="text-zinc-400 hover:text-brand-red">
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Content */}
                        <div className="space-y-3 pt-2">
                            <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300">
                                상세 내용
                            </label>
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                rows={8}
                                placeholder="내용을 입력하세요..."
                                className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 resize-none"
                            />
                        </div>
                    </section>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-end gap-3 pt-6 border-t border-zinc-200 dark:border-zinc-800 mt-6">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="px-6 py-2.5 rounded-xl text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors border border-zinc-200 dark:border-zinc-800"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-brand-navy hover:bg-brand-navy-dark text-white px-8 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-2"
                        >
                            {isSubmitting ? "등록 중..." : "작성 완료"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
