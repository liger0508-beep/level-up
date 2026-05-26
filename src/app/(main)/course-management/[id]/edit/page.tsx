"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
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
    fetchCourseRecordById,
    updateCourseRecord 
} from "@/lib/course-management-sync";
import { uploadFiles } from "@/lib/storage-sync";
import { createClient } from "@/lib/supabase/client";

export default function EditCourseManagementPage() {
    const router = useRouter();
    const params = useParams();
    const { id } = params as { id: string };

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [selectedPlayer, setSelectedPlayer] = useState(""); // Empty means "전체"
    const [category, setCategory] = useState("shot");
    const [keywords, setKeywords] = useState<string[]>([]);
    const [keywordInput, setKeywordInput] = useState("");
    const [content, setContent] = useState("");
    const [date, setDate] = useState("");
    const [videoUrl, setVideoUrl] = useState("");
    const [existingMedia, setExistingMedia] = useState<string[]>([]);
    const [attachedFiles, setAttachedFiles] = useState<File[]>([]);

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

    // Fetch existing record
    useEffect(() => {
        const fetchRecord = async () => {
            try {
                const record = await fetchCourseRecordById(id);
                if (!record) {
                    alert("게시글을 찾을 수 없습니다.");
                    router.push("/course-management");
                    return;
                }
                
                setSelectedPlayer(record.playerName === "전체" ? "" : record.playerName);
                setCategory(record.category);
                setKeywords(record.title ? record.title.split(", ") : []);
                setContent(record.content);
                setDate(record.date);

                const urls = record.media_urls || [];
                const extVideo = urls.find(u => u.includes("youtube.com") || u.includes("youtu.be"));
                if (extVideo) {
                    setVideoUrl(extVideo);
                    setExistingMedia(urls.filter(u => u !== extVideo));
                } else {
                    setExistingMedia(urls);
                }
            } catch (err) {
                console.error(err);
                alert("데이터를 불러오는데 실패했습니다.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchRecord();
    }, [id, router]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setAttachedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };

    const removeAttachedFile = (index: number) => {
        setAttachedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const removeExistingMedia = (index: number) => {
        setExistingMedia(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (keywords.length === 0) {
            alert("키워드를 하나 이상 입력해주세요.");
            return;
        }

        try {
            setIsSubmitting(true);

            // 1. Upload new files
            let newUploadedUrls: string[] = [];
            if (attachedFiles.length > 0) {
                newUploadedUrls = await uploadFiles(attachedFiles, 'records');
            }

            // 2. Combine all media
            const allMedia = [...existingMedia, ...newUploadedUrls];
            if (videoUrl.trim()) {
                allMedia.unshift(videoUrl.trim());
            }

            // 3. Update
            await updateCourseRecord(id, {
                playerName: selectedPlayer || "전체",
                category,
                title: keywords.join(", "),
                content,
                media_urls: allMedia,
                date
            });

            alert("골프IQ 기록이 수정되었습니다.");
            router.push(`/course-management/${id}`);
        } catch (err: any) {
            console.error("Course Update Error:", err.message || err);
            alert("수정에 실패했습니다.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-brand-navy/20 border-t-brand-navy rounded-full animate-spin"></div>
            </div>
        );
    }

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
                            골프IQ 수정
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
                                        추가 업로드할 영상 파일을 선택하세요
                                    </span>
                                </div>

                                {/* Existing Media */}
                                {existingMedia.length > 0 && (
                                    <div className="flex flex-col gap-2 mb-2">
                                        <span className="text-xs font-bold text-zinc-500">기존 업로드 파일:</span>
                                        <div className="flex flex-wrap gap-2">
                                            {existingMedia.map((url, idx) => (
                                                <div key={idx} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700">
                                                    <Paperclip size={14} className="text-zinc-400" />
                                                    <span className="text-xs text-zinc-600 dark:text-zinc-300 truncate max-w-[200px]">기존 파일 {idx + 1}</span>
                                                    <button type="button" onClick={() => removeExistingMedia(idx)} className="text-zinc-400 hover:text-brand-red">
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* New Attached Files */}
                                {attachedFiles.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {attachedFiles.map((file, idx) => (
                                            <div key={idx} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700">
                                                <Paperclip size={14} className="text-zinc-400" />
                                                <span className="text-xs text-zinc-600 dark:text-zinc-300 truncate max-w-[200px]">{file.name}</span>
                                                <button type="button" onClick={() => removeAttachedFile(idx)} className="text-zinc-400 hover:text-brand-red">
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
                            {isSubmitting ? "수정 중..." : "수정 완료"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
