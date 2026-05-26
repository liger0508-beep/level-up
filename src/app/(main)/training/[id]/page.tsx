"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { BookOpen, ChevronLeft, ChevronRight, MoreVertical, Calendar, Download, AlertCircle, MessageSquare, Send, Flag, MapPin, User, CheckCircle2, Edit2, Trash2, Layers, Paperclip, X, Play, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchTrainingTemplates, TrainingTemplate } from "@/lib/training-template-sync";
import { saveTrainingRecord, fetchRecentTrainingsByPlayer, TrainingRecord } from "@/lib/training-sync";
import { parseMediaUrls, fetchComments, saveComment, updateComment, deleteComment, AnalysisComment } from "@/lib/analysis-sync";
import { cn } from "@/lib/utils";
import { TrainingType } from "@/components/training/TrainingCard";
import { uploadFile } from "@/lib/storage-sync";

const typeBadgeConfig: Record<string, { label: string; bg: string; text: string; labelColor: string; accentBorder: string }> = {
    shot: { label: "Shot", bg: "bg-emerald-500", text: "text-white", labelColor: "text-emerald-500", accentBorder: "border-l-emerald-500" },
    short_game: { label: "Short Game", bg: "bg-cyan-500", text: "text-white", labelColor: "text-cyan-500", accentBorder: "border-l-cyan-500" },
    physical: { label: "Physical", bg: "bg-amber-500", text: "text-white", labelColor: "text-amber-500", accentBorder: "border-l-amber-500" },
    field: { label: "Field", bg: "bg-brand-navy", text: "text-white", labelColor: "text-brand-navy", accentBorder: "border-l-brand-navy" },
    etc: { label: "Etc", bg: "bg-violet-500", text: "text-white", labelColor: "text-violet-500", accentBorder: "border-l-violet-500" },
};

export default function TrainingDetailPage() {
    const router = useRouter();
    const params = useParams();
    const { id } = params;

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const [training, setTraining] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [comments, setComments] = useState<AnalysisComment[]>([]);
    const [dbTemplates, setDbTemplates] = useState<TrainingTemplate[]>([]);
    const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);

    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
    const [editingCommentText, setEditingCommentText] = useState("");
    const [isUpdatingComment, setIsUpdatingComment] = useState(false);
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);

    const [newComment, setNewComment] = useState("");
    const [commentFile, setCommentFile] = useState<File | null>(null);
    const [commentPreviewUrl, setCommentPreviewUrl] = useState<string | null>(null);
    const commentFileRef = useRef<HTMLInputElement>(null);
    const carouselRef = useRef<HTMLDivElement>(null);
    const contentCarouselRef = useRef<HTMLDivElement>(null);

    // ── Completion Video State ─────────────────────────────────────
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [completionVideo, setCompletionVideo] = useState<File | null>(null);
    const [completionVideoPreview, setCompletionVideoPreview] = useState<string | null>(null);
    const [isUploadingVideo, setIsUploadingVideo] = useState(false);
    const completionVideoInputRef = useRef<HTMLInputElement>(null);
    const [expandedSessionIndex, setExpandedSessionIndex] = useState<number | null>(null);
    const [showAllHistory, setShowAllHistory] = useState(false);

    // ── Review Training State ─────────────────────────────────────
    const [reviewData, setReviewData] = useState<{
        scorecardId: string;
        analysis: any[];
        completedHoles: number[];
    } | null>(null);
    const [selectedFocusHole, setSelectedFocusHole] = useState<number | null>(null);
    const [expandedReviewIdx, setExpandedReviewIdx] = useState<number | null>(null);

    const CATEGORY_TO_FIELD: Record<string, string> = {
        "티샷 비거리": "distSG_DriverDist",
        "티샷 정확도": "distSG_DriverAcc",
        "180M이상": "distSG_180Plus",
        "150-179M": "distSG_150_179",
        "120-149M": "distSG_120_149",
        "90-119M": "distSG_90_119",
        "피치샷": "distSG_Pitch31_89",
        "벙커": "distSG_Bunker",
        "어프로치": "distSG_Approach",
        "9M이상": "distSG_Putt9Plus",
        "4-8M": "distSG_Putt4_8",
        "2-3M": "distSG_Putt2_3",
        "1M": "distSG_Putt1",
    };

    const LOCATION_ABBR_REV: Record<string, string> = {
        "TE": "티박스",
        "FW": "페어웨이",
        "RO": "러프",
        "FB": "페어웨이 벙커",
        "GR": "그린",
        "GA": "그린 주변 어프로치",
        "GB": "그린 주변 벙커",
        "HI": "홀인",
        "PA": "패널티구역",
        "OB": "오비",
        "PS": "벌타",
        "FO": "숲속",
        "-": "-"
    };

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            if (!id) return;
            setIsLoading(true);
            const supabase = createClient();
            
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    setCurrentUser({ id: user.id, name: user.user_metadata?.name || 'User' });
                }

                // 1. Fetch training record
                const { data, error } = await supabase
                    .from("records")
                    .select(`
                        id,
                        type,
                        category,
                        title,
                        content,
                        media_urls,
                        created_at,
                        training_start,
                        training_end,
                        completion_logs,
                        template_settings,
                        total_count,
                        user:users!records_user_id_fkey(name),
                        coach:users!records_coach_id_fkey(name)
                    `)
                    .eq("id", id)
                    .single();
                
                if (error) throw error;

                // 2. Fetch comments and templates in parallel
                const [commentsData, templatesData] = await Promise.all([
                    fetchComments(id as string),
                    fetchTrainingTemplates()
                ]);

                setComments(commentsData);
                setDbTemplates(templatesData);

                // 3. Parse media_urls
                const allMedia = parseMediaUrls(data.media_urls);
                const attachedMedia = allMedia.filter(url => url.startsWith('http')).map(url => ({
                    type: url.match(/\.(mp4|mov|webm)$/i) ? 'video' : 'image',
                    url
                }));
                const templateIds = allMedia
                    .filter(url => url.startsWith('template:'))
                    .map(url => url.replace('template:', ''));

                // Prioritize customized settings from the record, fallback to template defaults
                const templates = (data.template_settings && data.template_settings.length > 0)
                    ? data.template_settings.map((s: any) => {
                        const original = templatesData.find(t => t.id === s.id);
                        return { ...original, ...s };
                    })
                    : templatesData.filter(t => templateIds.includes(t.id));

                const templateMedia = templates
                    .filter((t: any) => t.mediaUrl)
                    .map((t: any) => ({
                        type: (t.mediaType?.startsWith('video') || t.mediaUrl?.match(/\.(mp4|mov|webm)$/i)) ? 'video' : 'image',
                        url: t.mediaUrl,
                        title: t.title
                    }));

                setTraining({
                    id: data.id,
                    writer: (data.coach as any)?.[0]?.name || (data.coach as any)?.name || "Unknown",
                    player: (data.user as any)?.[0]?.name || (data.user as any)?.name || "Unknown",
                    type: data.category,
                    date: data.created_at?.split('T')[0],
                    time: data.created_at?.split('T')[1]?.slice(0, 5),
                    training_start: data.training_start,
                    training_end: data.training_end,
                    title: data.title || "제목 없음",
                    content: data.content || "",
                    media: [...templateMedia, ...attachedMedia],
                    templates: templates,
                    completion_logs: data.completion_logs || [],
                    total_count: data.total_count || 0
                });

                const reviewSetting = (data.template_settings || []).find((s: any) => s.type === "review_scorecard");
                if (reviewSetting && reviewSetting.scorecardId) {
                    try {
                        const { calculateScorecardAnalysis } = await import("@/lib/score-calculations");
                        const analysis = await calculateScorecardAnalysis(reviewSetting.scorecardId);
                        
                        setReviewData({
                            scorecardId: reviewSetting.scorecardId,
                            analysis,
                            completedHoles: reviewSetting.completedHoles || []
                        });
                    } catch (innerErr) {
                        console.error("Failed to calculate scorecard analysis:", innerErr);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch training detail:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [id]);

    const getLogs = (logs: any): string[] => {
        if (!logs) return [];
        if (Array.isArray(logs)) return logs;
        if (typeof logs === 'string') {
            try {
                const parsed = JSON.parse(logs);
                return Array.isArray(parsed) ? parsed : [];
            } catch {
                return [logs];
            }
        }
        return [];
    };

    const [isCompleting, setIsCompleting] = useState(false);

    const handleCompleteTraining = () => {
        if (!training || isCompleting) return;
        setIsUploadModalOpen(true);
    };

    const handleCompletionVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;
        setCompletionVideo(file);
        if (file) {
            setCompletionVideoPreview(URL.createObjectURL(file));
        } else {
            setCompletionVideoPreview(null);
        }
    };

    const handleUploadAndComplete = async () => {
        if (!training || !completionVideo || isUploadingVideo) return;
        
        setIsUploadingVideo(true);
        try {
            const supabase = createClient();
            
            // 1. Upload Video
            const videoUrl = await uploadFile(completionVideo, 'records', `training-completion/${id}/${Date.now()}`);
            if (!videoUrl) throw new Error("Video upload failed");

            // 2. Prepare Log
            const now = new Date().toISOString();
            const logEntry = JSON.stringify({
                timestamp: now,
                mediaUrl: videoUrl,
                mediaType: completionVideo.type
            });

            const currentLogs = getLogs(training.completion_logs);
            const newLogs = [...currentLogs, logEntry];
            
            // 3. Update DB
            const { error } = await supabase
                .from("records")
                .update({ completion_logs: newLogs })
                .eq("id", id);

            if (error) throw error;

            // 4. Update UI
            setTraining({ ...training, completion_logs: newLogs });
            setIsUploadModalOpen(false);
            setCompletionVideo(null);
            setCompletionVideoPreview(null);
            alert("훈련 완료가 영상과 함께 기록되었습니다!");
        } catch (err) {
            console.error("Failed to complete training with video:", err);
            alert("훈련 완료 처리에 실패했습니다.");
        } finally {
            setIsUploadingVideo(false);
        }
    };

    const calculateProgress = () => {
        if (!training) return 0;
        
        if (training.title?.includes("[복습]") && reviewData) {
            const completed = reviewData.completedHoles.length;
            const total = 15;
            return Math.min(Math.round((completed / total) * 100), 100);
        }

        const total = training.total_count || 7;
        const logs = getLogs(training.completion_logs);
        const completed = logs.length;
        return Math.min(Math.round((completed / total) * 100), 100);
    };

    const handleDelete = async () => {
        setIsMenuOpen(false);
        if (window.confirm("훈련 내용을 삭제하시겠습니까?")) {
            const supabase = createClient();
            const { error } = await supabase.from("records").delete().eq("id", id);
            if (error) {
                alert("삭제에 실패했습니다.");
            } else {
                alert("삭제되었습니다.");
                router.push("/training");
            }
        }
    };

    const handleEdit = () => {
        setIsMenuOpen(false);
        router.push(`/training/${id}/edit`);
    };

    const handleCommentSubmit = async (e?: React.FormEvent | React.KeyboardEvent) => {
        if (e) e.preventDefault();
        if (!newComment.trim() && !commentFile) return;

        try {
            setIsSubmittingComment(true);
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            let fileUrl = undefined;
            let fileType = undefined;

            if (commentFile) {
                const { uploadFile } = await import("@/lib/storage-sync");
                fileUrl = await uploadFile(commentFile, 'records', `comments/${id}`);
                fileType = commentFile.type;
            }

            await saveComment({
                recordId: id as string,
                userId: user.id,
                content: newComment.trim(),
                mediaUrl: fileUrl,
                mediaType: fileType
            });

            // Refresh comments
            const updatedComments = await fetchComments(id as string);
            setComments(updatedComments);

            setNewComment("");
            setCommentFile(null);
            setCommentPreviewUrl(null);
        } catch (err) {
            console.error("Failed to save comment:", err);
            alert("댓글 저장에 실패했습니다.");
        } finally {
            setIsSubmittingComment(false);
        }
    };

    const handleEditComment = async (commentId: string) => {
        if (!editingCommentText.trim() || isUpdatingComment) return;
        setIsUpdatingComment(true);
        try {
            await updateComment(commentId, editingCommentText.trim());
            setComments(comments.map(c => c.id === commentId ? { ...c, text: editingCommentText.trim() } : c));
            setEditingCommentId(null);
        } catch (err) {
            alert("댓글 수정에 실패했습니다.");
        } finally {
            setIsUpdatingComment(false);
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!confirm("이 댓글을 삭제하시겠습니까?")) return;
        try {
            await deleteComment(commentId);
            setComments(comments.filter(c => c.id !== commentId));
        } catch (err) {
            alert("댓글 삭제에 실패했습니다.");
        }
    };

    const handleCommentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;
        setCommentFile(file);
        setCommentPreviewUrl(file ? URL.createObjectURL(file) : null);
        e.target.value = "";
    };

    const scrollCarousel = (direction: "left" | "right") => {
        if (carouselRef.current) {
            const scrollAmount = carouselRef.current.clientWidth;
            carouselRef.current.scrollBy({
                left: direction === "left" ? -scrollAmount : scrollAmount,
                behavior: "smooth"
            });
        }
    };

    if (isLoading) return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-brand-navy/20 border-t-brand-navy rounded-full animate-spin"></div>
        </div>
    );
    
    if (!training) return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
            <p className="text-zinc-500">훈련 정보를 찾을 수 없습니다.</p>
        </div>
    );

    const badge = typeBadgeConfig[training.type] || typeBadgeConfig.etc;
    const derivedTitle = training.title;

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-24">
            {/* ── 1. Header ── */}
            <header className="sticky top-0 z-40 bg-zinc-50/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
                <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-50 transition-colors">
                            <ChevronLeft size={24} />
                        </button>
                        <div className="flex items-center gap-2">
                            <Layers size={18} className="text-brand-navy dark:text-brand-navy-light shrink-0" />
                            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">훈련 상세</h1>
                        </div>
                    </div>
                    <div className="relative" ref={menuRef}>
                        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 -mr-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                            <MoreVertical size={20} />
                        </button>
                        {isMenuOpen && (
                            <div className="absolute right-0 mt-2 w-36 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg overflow-hidden z-50 animate-in fade-in zoom-in-95 origin-top-right duration-100">
                                <button onClick={handleEdit} className="w-full text-left px-4 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2 transition-colors">
                                    <Edit2 size={16} className="text-zinc-400" /> 수정
                                </button>
                                <button onClick={handleDelete} className="w-full text-left px-4 py-3 text-sm font-medium text-brand-red hover:bg-brand-red/5 flex items-center gap-2 transition-colors border-t border-zinc-100 dark:border-zinc-800"
                                >
                                    <Trash2 size={16} className="text-brand-red/70" /> 삭제
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
                {/* ── 2. Core Info ── */}
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold px-3 py-1 rounded-full text-white uppercase tracking-wider ${badge.bg}`}>
                                {badge.label}
                            </span>
                            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                                <Calendar size={14} /> {training.date} {training.time}
                            </span>
                        </div>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-50 truncate" title={derivedTitle}>{derivedTitle}</h2>
                    
                    {/* Training Period */}
                    {training.training_start && training.training_end && (
                        <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 bg-zinc-50 dark:bg-zinc-800/50 w-fit px-3 py-1.5 rounded-lg border border-zinc-100 dark:border-zinc-800">
                            <span className="text-zinc-400">훈련 기간 ({Math.ceil((new Date(training.training_end).getTime() - new Date(training.training_start).getTime()) / (1000 * 60 * 60 * 24)) + 1}일):</span>
                            <span className="text-zinc-700 dark:text-zinc-300">
                                {training.training_start} ~ {training.training_end}
                            </span>
                        </div>
                    )}

                    <div className="flex items-center gap-4 pt-4 border-t border-zinc-100 dark:border-zinc-800/50">
                        <div className="flex items-center gap-2 flex-1">
                            <div className="w-8 h-8 rounded-full bg-brand-navy/10 flex items-center justify-center text-brand-navy dark:bg-brand-navy-light/20 dark:text-brand-navy-light">
                                <User size={16} />
                            </div>
                            <div>
                                <p className="text-[10px] text-zinc-500">담당 코치</p>
                                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{training.writer}</p>
                            </div>
                        </div>
                        <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-800"></div>
                        <div className="flex items-center gap-2 flex-1">
                            <div className="w-8 h-8 rounded-full bg-brand-navy/10 flex items-center justify-center text-brand-navy dark:bg-brand-navy-light/20 dark:text-brand-navy-light">
                                <User size={16} />
                            </div>
                            <div>
                                <p className="text-[10px] text-zinc-500">선수</p>
                                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{training.player}</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── 3. Media Gallery ── */}
                {training.media && training.media.length > 0 && (
                    <section className="relative group">
                        <div ref={carouselRef} className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-2 scrollbar-hide">
                            {training.media.map((item: any, idx: number) => (
                                <div key={idx} className="shrink-0 w-full aspect-[4/5] sm:aspect-[4/3] snap-center rounded-3xl overflow-hidden shadow-sm relative border border-zinc-200 dark:border-zinc-800 bg-black">
                                    {item.type === "video" ? (
                                        <video src={item.url} controls playsInline className="w-full h-full object-contain" />
                                    ) : (
                                        <img src={item.url} alt={`Training Media ${idx + 1}`} className="w-full h-full object-contain" />
                                    )}
                                    {training.media.length > 1 && (
                                        <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold px-3 py-1.5 rounded-full z-10">
                                            {idx + 1} / {training.media.length}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        {training.media.length > 1 && (
                            <>
                                <button onClick={() => scrollCarousel("left")} className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 dark:bg-black/60 backdrop-blur-sm hover:bg-white dark:hover:bg-black text-zinc-800 dark:text-zinc-200 rounded-full items-center justify-center shadow-lg transition-all opacity-0 group-hover:opacity-100 z-10">
                                    <ChevronLeft size={24} />
                                </button>
                                <button onClick={() => scrollCarousel("right")} className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 dark:bg-black/60 backdrop-blur-sm hover:bg-white dark:hover:bg-black text-zinc-800 dark:text-zinc-200 rounded-full items-center justify-center shadow-lg transition-all opacity-0 group-hover:opacity-100 z-10">
                                    <ChevronRight size={24} />
                                </button>
                            </>
                        )}
                    </section>
                )}

                {/* ── 4. Progress & Training Content ── */}
                <div className="space-y-6">
                    {/* Progress Bar */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-3">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                <CheckCircle2 size={16} className="text-brand-navy" />
                                훈련 진행률
                            </h3>
                            <span className="text-[11px] text-zinc-400 font-medium">
                                {training.title?.includes("[복습]") && reviewData
                                    ? `${reviewData.completedHoles.length}회 완료 / 총 15회 기준`
                                    : `${training.completion_logs?.length || 0}회 완료 / 총 ${training.total_count || 0}회 기준`}
                            </span>
                        </div>
                        <div className="w-full h-12 bg-zinc-100 dark:bg-zinc-800 rounded-2xl overflow-hidden relative shadow-inner border border-zinc-200 dark:border-zinc-700">
                            <div 
                                className="h-full bg-brand-navy transition-all duration-500 ease-out flex items-center justify-center shadow-lg" 
                                style={{ width: `${calculateProgress()}%` }}
                            >
                                {calculateProgress() >= 15 && (
                                    <span className="text-sm font-black text-white drop-shadow-sm">{calculateProgress()}%</span>
                                )}
                            </div>
                            {calculateProgress() < 15 && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <span className="text-sm font-black text-brand-navy">{calculateProgress()}%</span>
                                </div>
                            )}
                        </div>

                        {!training.title?.includes("[복습]") && (
                            <button 
                                onClick={handleCompleteTraining}
                                disabled={isUploadingVideo}
                                className={cn(
                                    "w-full py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95 mt-2",
                                    isUploadingVideo 
                                        ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
                                        : "bg-brand-red hover:bg-brand-red-dark text-white shadow-brand-red/20"
                                )}
                            >
                                <CheckCircle2 size={18} />
                                <span>훈련 완료 ({training.completion_logs?.length || 0}회 / {training.total_count || 0}회)</span>
                            </button>
                        )}
                    </section>

                    {/* ── 4-1. Training History (List Style) ── */}
                    {training.completion_logs && training.completion_logs.length > 0 && (
                        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-4">
                            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                    <Play size={16} className="text-brand-navy" />
                                    훈련 히스토리
                                </h3>
                                <span className="text-[10px] text-zinc-400 font-medium">최신순</span>
                            </div>

                            <div className="space-y-3">
                                {(() => {
                                    const reversedLogs = [...training.completion_logs].reverse();
                                    const displayedLogs = showAllHistory ? reversedLogs : reversedLogs.slice(0, 3);
                                    
                                    return displayedLogs.map((log: string, idx: number) => {
                                        // Since it's reversed, we need to calculate the original index for labeling
                                        const originalIndex = training.completion_logs.length - 1 - idx;
                                        let timestamp, mediaUrl, mediaType;
                                        try {
                                            const data = JSON.parse(log);
                                            timestamp = data.timestamp;
                                            mediaUrl = data.mediaUrl;
                                            mediaType = data.mediaType;
                                        } catch {
                                            timestamp = log;
                                        }

                                        const date = new Date(timestamp);
                                        const mm = (date.getMonth() + 1).toString().padStart(2, '0');
                                        const dd = date.getDate().toString().padStart(2, '0');
                                        const isExpanded = expandedSessionIndex === originalIndex;
                                        
                                        return (
                                            <div key={originalIndex} className="group">
                                                <div 
                                                    onClick={() => setExpandedSessionIndex(isExpanded ? null : originalIndex)}
                                                    className={cn(
                                                        "flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all",
                                                        isExpanded 
                                                            ? "bg-brand-navy text-white shadow-md shadow-brand-navy/20" 
                                                            : "bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <span className={cn(
                                                            "text-xs font-bold",
                                                            isExpanded ? "text-white" : "text-zinc-900 dark:text-zinc-100"
                                                        )}>
                                                            {originalIndex + 1}회차:
                                                        </span>
                                                        <span className={cn(
                                                            "text-[11px] font-medium",
                                                            isExpanded ? "text-white/80" : "text-zinc-500"
                                                        )}>
                                                            {mm}.{dd}
                                                        </span>
                                                    </div>
                                                    <button className={cn(
                                                        "text-[10px] font-bold flex items-center gap-1 px-3 py-1.5 rounded-full transition-all",
                                                        isExpanded 
                                                            ? "bg-white/20 text-white" 
                                                            : "bg-white dark:bg-zinc-900 text-brand-navy border border-zinc-200 dark:border-zinc-700"
                                                    )}>
                                                        훈련 영상보기
                                                        <ChevronRight size={12} className={cn("transition-transform", isExpanded && "rotate-90")} />
                                                    </button>
                                                </div>

                                                {/* Expandable Video Area */}
                                                {isExpanded && (
                                                    <div className="mt-3 animate-in slide-in-from-top-2 duration-300">
                                                        <div className="relative aspect-video rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-black shadow-inner">
                                                            {mediaUrl ? (
                                                                mediaType?.startsWith('video') ? (
                                                                    <video 
                                                                        src={mediaUrl} 
                                                                        controls 
                                                                        autoPlay
                                                                        playsInline 
                                                                        className="w-full h-full object-contain" 
                                                                    />
                                                                ) : (
                                                                    <img src={mediaUrl} alt="Log" className="w-full h-full object-contain" />
                                                                )
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-400">
                                                                    <AlertCircle size={24} />
                                                                    <span className="text-xs ml-2">영상을 불러올 수 없습니다.</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    });
                                })()}

                                {training.completion_logs.length > 3 && !showAllHistory && (
                                    <button 
                                        onClick={() => setShowAllHistory(true)}
                                        className="w-full py-3 text-xs font-bold text-zinc-400 hover:text-brand-navy transition-colors flex items-center justify-center gap-1.5 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl mt-2"
                                    >
                                        <span>이전 히스토리 더보기</span>
                                        <ChevronDown size={14} />
                                    </button>
                                )}
                            </div>
                        </section>
                    )}

                    {/* ── Review Training Plan UI ── */}
                    {reviewData && (
                        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-6">
                            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                    <BookOpen size={16} className="text-orange-500" />
                                    복습 훈련 (집중 관리 홀)
                                </h3>
                                <span className="text-[11px] text-zinc-400 font-medium">완료: {reviewData.completedHoles.length} / 전체 {reviewData.analysis?.length || 0}개</span>
                            </div>

                            <div className="space-y-3">
                                {(() => {
                                    const cats = Object.entries(CATEGORY_TO_FIELD).map(([name, field]) => ({
                                        name,
                                        sg: reviewData.analysis.reduce((s, h) => s + (h.summary as any)[field], 0)
                                    }));
                                    const sumPosSG = cats.filter(c => c.sg > 0).reduce((s, c) => s + c.sg, 0);
                                    const positiveCats = cats.map(c => ({
                                        ...c,
                                        percent: c.sg > 0 ? (c.sg / sumPosSG) * 100 : 0
                                    })).filter(c => c.sg > 0).sort((a, b) => b.percent - a.percent).slice(0, 5);

                                    return positiveCats.map((cat, idx) => {
                                        const catName = cat.name;
                                        const field = CATEGORY_TO_FIELD[catName];
                                        
                                        const focusHolesForCat = [...reviewData.analysis]
                                            .filter(h => (h.summary as any)[field] > 0)
                                            .sort((a, b) => (b.summary as any)[field] - (a.summary as any)[field])
                                            .slice(0, 3)
                                            .sort((a, b) => a.holeNumber - b.holeNumber)
                                            .map(h => {
                                                const shots = h.shots || [];
                                                let worstShotInfo = null;
                                                
                                                const relevantShots = shots.filter((s: any) => {
                                                    if (catName.includes("티샷")) return s.shotLabel.startsWith("TE");
                                                    if (catName === "벙커") return s.shotLabel.startsWith("GB");
                                                    if (catName === "어프로치") return s.attemptDistance <= 30 && !s.shotLabel.startsWith("GR") && !s.shotLabel.startsWith("GB") && !s.shotLabel.startsWith("TE");
                                                    if (catName === "피치샷") return s.attemptDistance >= 31 && s.attemptDistance < 90 && !s.shotLabel.startsWith("GR") && !s.shotLabel.startsWith("GB") && !s.shotLabel.startsWith("TE");
                                                    if (catName.includes("180M이상")) return s.attemptDistance >= 180 && !s.shotLabel.startsWith("GR") && !s.shotLabel.startsWith("GB");
                                                    if (catName.includes("150-179M")) return s.attemptDistance >= 150 && s.attemptDistance < 180 && !s.shotLabel.startsWith("GR") && !s.shotLabel.startsWith("GB");
                                                    if (catName.includes("120-149M")) return s.attemptDistance >= 120 && s.attemptDistance < 150 && !s.shotLabel.startsWith("GR") && !s.shotLabel.startsWith("GB");
                                                    if (catName.includes("90-119M")) return s.attemptDistance >= 90 && s.attemptDistance < 120 && !s.shotLabel.startsWith("GR") && !s.shotLabel.startsWith("GB");
                                                    if (catName.includes("9M이상") || catName.includes("4-8M") || catName.includes("2-3M") || catName.includes("1M")) return s.shotLabel.startsWith("GR");
                                                    return true;
                                                });

                                                if (relevantShots.length > 0) {
                                                    // Get the one with the lowest SG (worst shot for this category)
                                                    const s = relevantShots.sort((a: any, b: any) => a.shotSG - b.shotSG)[0];
                                                    const startAbbr = s.shotLabel.split('/')[0].trim();
                                                    worstShotInfo = {
                                                        attempt: `${LOCATION_ABBR_REV[startAbbr] || startAbbr} / ${s.attemptDistance > 0 ? s.attemptDistance + 'm' : "-"}`,
                                                        result: LOCATION_ABBR_REV[s.landingLabel] || s.landingLabel || "알수없음",
                                                        isPenalty: ['OB', 'PA', 'PS'].includes(s.landingLabel)
                                                    };
                                                }

                                                return { ...h, worstShotInfo };
                                            });

                                        if (focusHolesForCat.length === 0) return null;

                                    const isExpanded = expandedReviewIdx === idx;
                                    const rankNumber = idx + 1;

                                    return (
                                        <div key={catName} className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                                            <button 
                                                onClick={() => {
                                                    setExpandedReviewIdx(isExpanded ? null : idx);
                                                    if (!isExpanded && focusHolesForCat.length > 0 && selectedFocusHole === null) {
                                                        setSelectedFocusHole(focusHolesForCat[0].holeNumber);
                                                    }
                                                }}
                                                className={cn(
                                                    "w-full flex items-center justify-between p-4 transition-colors",
                                                    isExpanded ? "bg-orange-50 dark:bg-orange-950/20" : "bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className={cn(
                                                        "flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0",
                                                        "bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400"
                                                    )}>
                                                        {rankNumber}
                                                    </span>
                                                    <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{catName}</span>
                                                    <span className="text-[11px] font-medium text-orange-500 bg-orange-100 dark:bg-orange-500/20 px-2 py-0.5 rounded-full">
                                                        {focusHolesForCat.length}개 홀
                                                    </span>
                                                </div>
                                                <ChevronDown size={18} className={cn("text-zinc-400 transition-transform", isExpanded && "rotate-180")} />
                                            </button>

                                            {isExpanded && (
                                                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/30 border-t border-zinc-200 dark:border-zinc-800">
                                                    <div className="grid grid-cols-3 gap-2 mb-4">
                                                        {focusHolesForCat.map((h) => {
                                                            const isHoleSelected = selectedFocusHole === h.holeNumber;
                                                            return (
                                                                <button 
                                                                    key={h.holeNumber} 
                                                                    onClick={() => setSelectedFocusHole(h.holeNumber)}
                                                                    className={cn(
                                                                        "flex flex-col items-center gap-0.5 w-full p-2 rounded-2xl transition-all border-2 relative",
                                                                        isHoleSelected 
                                                                            ? "bg-orange-500 border-zinc-900 text-white shadow-md" 
                                                                            : "bg-white dark:bg-zinc-800 border-zinc-100 dark:border-zinc-800 text-orange-500 hover:border-orange-200"
                                                                    )}
                                                                >
                                                                    {reviewData.completedHoles.includes(h.holeNumber) && (
                                                                        <div className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm">
                                                                            <CheckCircle2 size={10} />
                                                                        </div>
                                                                    )}
                                                                    <span className={cn("text-[8px] font-black uppercase tracking-tighter", isHoleSelected ? "text-orange-100" : "text-zinc-400")}>HOLE</span>
                                                                    <span className={cn("text-lg font-black tracking-tighter")}>{h.holeNumber}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>

                                                    {selectedFocusHole !== null && (
                                                        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm overflow-hidden">
                                                            <div className="bg-orange-500 px-4 py-2 flex items-center justify-between">
                                                                <span className="text-[11px] font-bold text-white uppercase tracking-wider">{selectedFocusHole}번 홀 집중 분석</span>
                                                            </div>
                                                            {(() => {
                                                                const hData = focusHolesForCat.find(h => h.holeNumber === selectedFocusHole);
                                                                if (!hData) return <div className="p-4 text-center text-zinc-500 text-xs">데이터 없음</div>;
                                                                
                                                                return (
                                                                    <div className="p-4 space-y-1">
                                                                        <div className="flex items-center p-3 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/30">
                                                                            <div className="w-1 h-4 bg-zinc-300 dark:bg-zinc-600 rounded-full mr-3 shrink-0"></div>
                                                                            <span className="text-[10px] font-bold text-zinc-400 w-12 shrink-0">시도</span>
                                                                            <span className="flex-1 text-[13px] font-semibold text-zinc-700 dark:text-zinc-300 truncate">
                                                                                {hData.worstShotInfo?.attempt || "-"}
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex items-center justify-between p-3 rounded-xl bg-orange-50/30 dark:bg-orange-950/10">
                                                                            <div className="flex items-center flex-1 min-w-0">
                                                                                <div className={cn("w-1 h-4 rounded-full mr-3 shrink-0", hData.worstShotInfo?.isPenalty ? "bg-red-500" : "bg-orange-500")}></div>
                                                                                <span className="text-[10px] font-bold text-zinc-400 w-12 shrink-0">결과</span>
                                                                                <span className={cn("flex-1 text-[13px] font-bold text-left whitespace-nowrap overflow-hidden text-ellipsis", hData.worstShotInfo?.isPenalty ? "text-red-500" : "text-zinc-900 dark:text-zinc-100")}>
                                                                                    {hData.worstShotInfo?.isPenalty ? "패널티" : hData.worstShotInfo?.result}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="pt-2 flex justify-end">
                                                                            <button 
                                                                                onClick={async () => {
                                                                                    const isCompleted = reviewData.completedHoles.includes(hData.holeNumber);
                                                                                    const newCompleted = isCompleted 
                                                                                        ? reviewData.completedHoles.filter((h: any) => h !== hData.holeNumber) 
                                                                                        : [...reviewData.completedHoles, hData.holeNumber];
                                                                                    
                                                                                    setReviewData({ ...reviewData, completedHoles: newCompleted });
                                                                                    
                                                                                    try {
                                                                                        const supabase = createClient();
                                                                                        const { data: recordData } = await supabase.from("records").select("template_settings").eq("id", id).single();
                                                                                        const currentSettings = recordData?.template_settings || [];
                                                                                        const updatedSettings = currentSettings.map((s: any) => 
                                                                                            s.type === "review_scorecard" ? { ...s, completedHoles: newCompleted } : s
                                                                                        );
                                                                                        await supabase.from("records").update({ template_settings: updatedSettings }).eq("id", id);
                                                                                    } catch (e) {
                                                                                        console.error(e);
                                                                                    }
                                                                                }}
                                                                                className={cn(
                                                                                    "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95",
                                                                                    reviewData.completedHoles.includes(hData.holeNumber)
                                                                                        ? "bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800/50"
                                                                                        : "bg-orange-500 text-white hover:bg-orange-600 border border-orange-600"
                                                                                )}
                                                                            >
                                                                                {reviewData.completedHoles.includes(hData.holeNumber) ? (
                                                                                    <>
                                                                                        <CheckCircle2 size={14} />
                                                                                        훈련 완료됨
                                                                                    </>
                                                                                ) : (
                                                                                    "훈련 완료"
                                                                                )}
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                });
                                })()}
                            </div>
                        </section>
                    )}

                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-6">
                        <div className="border-b border-zinc-100 dark:border-zinc-800/50 pb-4">
                            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-4">훈련 정보</h3>
                            <div className="grid grid-cols-1 gap-4">
                                <div className="flex flex-col gap-1">
                                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-tight">훈련명</span>
                                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{training.title}</p>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-tight">훈련 기간</span>
                                    <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                        {training.training_start} ~ {training.training_end}
                                    </p>
                                </div>
                                
                                {training.templates && training.templates.length > 0 ? (
                                    <>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-tight">훈련 목적</span>
                                            <div className="space-y-1">
                                                {training.templates.map((t: any) => t.purpose).filter(Boolean).map((p: string, i: number) => (
                                                    <p key={i} className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">• {p}</p>
                                                )) || <p className="text-sm text-zinc-400">등록된 목적이 없습니다.</p>}
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-tight">훈련 목표</span>
                                            <div className="space-y-1">
                                                {training.templates.map((t: any) => t.goal).filter(Boolean).map((g: string, i: number) => (
                                                    <p key={i} className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">• {g}</p>
                                                )) || <p className="text-sm text-zinc-400">등록된 목표가 없습니다.</p>}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700">
                                        <p className="text-xs text-zinc-500 text-center">연결된 훈련 컨텐츠 정보가 없습니다.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {training.content && (
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                    <BookOpen size={14} className="text-zinc-400" />
                                    코치 코멘트 및 상세 내용
                                </h3>
                                <div className="prose prose-zinc dark:prose-invert max-w-none text-zinc-700 dark:text-zinc-300 whitespace-pre-line leading-relaxed text-sm bg-zinc-50 dark:bg-zinc-800/30 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                                    {training.content}
                                </div>
                            </div>
                        )}


                    </section>
                </div>

                {/* ── 5. Feedback Section (Identical to Lesson) ── */}
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden mb-8">
                    <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                        <MessageSquare size={14} className="text-zinc-400" />
                        <h3 className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">댓글 {comments.length}건</h3>
                    </div>

                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {comments.map(c => (
                            <div key={c.id} className="px-5 py-4 space-y-1 group">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{c.author}</span>
                                        {currentUser?.id === c.userId && (
                                            <div className="hidden group-hover:flex items-center gap-1">
                                                <button onClick={() => { setEditingCommentId(c.id); setEditingCommentText(c.text); }} className="p-1 text-zinc-400 hover:text-brand-navy"><Edit2 size={12} /></button>
                                                <button onClick={() => handleDeleteComment(c.id)} className="p-1 text-zinc-400 hover:text-brand-red"><Trash2 size={12} /></button>
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-[11px] text-zinc-400 font-medium">{c.time}</span>
                                </div>
                                {editingCommentId === c.id ? (
                                    <div className="mt-2 space-y-2">
                                        <textarea
                                            rows={2}
                                            value={editingCommentText}
                                            onChange={(e) => setEditingCommentText(e.target.value)}
                                            className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all resize-none"
                                        />
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => setEditingCommentId(null)} className="px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">취소</button>
                                            <button onClick={() => handleEditComment(c.id)} disabled={isUpdatingComment} className="px-3 py-1.5 text-xs bg-brand-navy text-white rounded-lg hover:bg-brand-navy/90 transition-colors disabled:opacity-50">저장</button>
                                        </div>
                                    </div>
                                ) : (
                                    c.text && <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{c.text}</p>
                                )}
                                {c.fileUrl && c.fileType?.startsWith("image/") && (
                                    <img src={c.fileUrl} className="mt-2 rounded-xl max-h-60 w-auto object-cover border border-zinc-200 dark:border-zinc-700" alt="첨부" />
                                )}
                                {c.fileUrl && c.fileType?.startsWith("video/") && (
                                    <video src={c.fileUrl} controls className="mt-2 rounded-xl max-h-60 w-full border border-zinc-200 dark:border-zinc-700" />
                                )}
                            </div>
                        ))}
                        {comments.length === 0 && (
                            <p className="text-sm text-zinc-400 text-center py-6">아직 댓글이 없습니다.</p>
                        )}
                    </div>

                    <div className="border-t border-zinc-100 dark:border-zinc-800 px-4 py-3 space-y-2">
                        <textarea
                            rows={2}
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleCommentSubmit();
                                }
                            }}
                            placeholder="메시지를 입력하세요..."
                            className="w-full px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all resize-none"
                        />
                        <div className="flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => commentFileRef.current?.click()}
                                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:text-brand-navy transition-colors"
                            >
                                <Paperclip size={14} />
                                {commentFile ? commentFile.name : "파일 첨부"}
                            </button>
                            <input ref={commentFileRef} type="file" className="hidden" onChange={handleCommentFileChange} />
                            <button
                                onClick={() => handleCommentSubmit()}
                                disabled={isSubmittingComment || (!newComment.trim() && !commentFile)}
                                className="px-4 py-1.5 bg-brand-navy text-white text-xs font-bold rounded-xl hover:bg-brand-navy/90 transition-all disabled:opacity-50"
                            >
                                전송
                            </button>
                        </div>
                    </div>
                </section>
            </main>

            {/* ── Completion Video Modal ── */}
            {isUploadModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-bottom-4 duration-300">
                        <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50">
                            <div>
                                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">훈련 완료 인증</h3>
                                <p className="text-xs text-zinc-500 mt-0.5">{training.completion_logs?.length + 1}회차 영상을 업로드해주세요.</p>
                            </div>
                            <button 
                                onClick={() => {
                                    setIsUploadModalOpen(false);
                                    setCompletionVideo(null);
                                    setCompletionVideoPreview(null);
                                }}
                                className="p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-6">
                            <div className="space-y-4">
                                {completionVideoPreview ? (
                                    <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-zinc-200 dark:border-zinc-800 group">
                                        <video src={completionVideoPreview} controls className="w-full h-full object-contain" />
                                        <button 
                                            onClick={() => {
                                                setCompletionVideo(null);
                                                setCompletionVideoPreview(null);
                                            }}
                                            className="absolute top-3 right-3 p-2 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <button 
                                        onClick={() => completionVideoInputRef.current?.click()}
                                        className="w-full aspect-video rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 flex flex-col items-center justify-center gap-3 text-zinc-400 hover:border-brand-navy hover:text-brand-navy transition-all"
                                    >
                                        <div className="w-12 h-12 rounded-full bg-white dark:bg-zinc-900 flex items-center justify-center shadow-sm">
                                            <Paperclip size={20} />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-bold">훈련 영상 선택</p>
                                            <p className="text-[11px] opacity-60 mt-1">MP4, MOV 파일 가능 (최대 50MB)</p>
                                        </div>
                                    </button>
                                )}
                                <input 
                                    ref={completionVideoInputRef}
                                    type="file" 
                                    accept="video/*" 
                                    className="hidden" 
                                    onChange={handleCompletionVideoChange} 
                                />
                            </div>

                            <button
                                onClick={handleUploadAndComplete}
                                disabled={!completionVideo || isUploadingVideo}
                                className={cn(
                                    "w-full py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg active:scale-[0.98]",
                                    completionVideo && !isUploadingVideo
                                        ? "bg-brand-red text-white hover:bg-brand-red-dark shadow-brand-red/20"
                                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
                                )}
                            >
                                {isUploadingVideo ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                        <span>업로드 중...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={20} />
                                        <span>훈련 완료 저장하기</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
