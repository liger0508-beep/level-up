"use client";
import { FileUploadButton } from "@/components/ui/FileUploadButton";

import { useState, useRef, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
    BookOpen,
    ChevronLeft,
    Calendar,
    User,
    MoreVertical,
    Trash2,
    Edit2,
    Play,
    Search,
    ChevronRight,
    MessageCircle,
    MessageSquare,
    Paperclip,
    Send,
    X,
    CheckCircle2,
} from "lucide-react";
import {
    Plan,
    PLAN_TYPE_LABELS,
    PLAN_TYPE_COLORS,
    PlanType,
    fetchPlanById,
    deletePlan,
    fetchPlansByAthlete,
} from "@/lib/plan-sync";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { fetchComments, saveComment, updateComment, deleteComment, AnalysisComment } from "@/lib/analysis-sync";
import { uploadFile } from "@/lib/storage-sync";
import { PageTitle, SectionTitle, LabelText } from "@/components/ui/Typography";
import { CustomVideoPlayer } from "@/components/ui/CustomVideoPlayer";

export default function PlanDetailPage() {
    const router = useRouter();
    const params = useParams();
    const { id } = params;

    const [plan, setPlan] = useState<Plan | null>(null);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [isLoading, setIsLoading] = useState(true);



    // ── Comment State ─────────────────────────────────────────────
    const [comments, setComments] = useState<AnalysisComment[]>([]);
    const [newComment, setNewComment] = useState("");
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const [commentFile, setCommentFile] = useState<File | null>(null);
    const [commentPreviewUrl, setCommentPreviewUrl] = useState<string | null>(null);
    const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
    const [editingCommentText, setEditingCommentText] = useState("");
    const [isUpdatingComment, setIsUpdatingComment] = useState(false);
    const commentFileInputRef = useRef<HTMLInputElement>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const mediaCarouselRef = useRef<HTMLDivElement>(null);
    const scrollMediaCarousel = (direction: "left" | "right") => {
        if (mediaCarouselRef.current) {
            const { scrollLeft, clientWidth } = mediaCarouselRef.current;
            const scrollTo = direction === "left" ? scrollLeft - clientWidth : scrollLeft + clientWidth;
            mediaCarouselRef.current.scrollTo({ left: scrollTo, behavior: "smooth" });
        }
    };


    useEffect(() => {
        async function loadData() {
            if (!id) return;
            setIsLoading(true);
            try {
                const data = await fetchPlanById(id as string);
                if (data) {
                    const [listData, commentData] = await Promise.all([
                        fetchPlansByAthlete(data.athleteName),
                        fetchComments(id as string)
                    ]);
                    setPlan(data);
                    setPlans(listData);
                    setComments(commentData);

                }

                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: profile } = await supabase.from('users').select('name').eq('id', user.id).single();
                    setCurrentUser({ id: user.id, name: profile?.name || "알 수 없음" });
                }
            } catch (error) {
                console.error("Error loading plan details:", error);
            } finally {
                setIsLoading(false);
            }
        }
        loadData();
    }, [id]);

    const handleDelete = async () => {
        setIsMenuOpen(false);
        if (window.confirm("훈련계획를 삭제하시겠습니까?")) {
            try {
                await deletePlan(id as string);
                alert("삭제되었습니다.");
                router.push("/admin/training-plan");
            } catch (err) {
                alert("삭제에 실패했습니다.");
            }
        }
    };

    // ── Comment Handlers ──────────────────────────────────────────
    const handleCommentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setCommentFile(file);
            const url = URL.createObjectURL(file);
            setCommentPreviewUrl(url);
        }
    };

    const handleCommentSubmit = async (e?: React.FormEvent | React.KeyboardEvent) => {
        if (e) e.preventDefault();
        if (!newComment.trim() && !commentFile) return;

        try {
            setIsSubmittingComment(true);
            if (!currentUser) {
                alert("로그인이 필요합니다.");
                return;
            }

            let fileUrl = undefined;
            let fileType = undefined;

            if (commentFile) {
                fileUrl = await uploadFile(commentFile, 'records', `comments/${id}`);
                fileType = commentFile.type;
            }

            await saveComment({
                recordId: id as string,
                userId: currentUser.id,
                content: newComment.trim(),
                mediaUrl: fileUrl,
                mediaType: fileType
            });

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

    if (isLoading) return <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center text-zinc-400">로딩 중...</div>;
    if (!plan) return <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center text-zinc-400">일지를 찾을 수 없습니다.</div>;

    const styles = PLAN_TYPE_COLORS[plan.type];


    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-20">

            {/* ── Sticky Header ── */}
            <header className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
                <div className="max-w-3xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.back()}
                            className="p-2 -ml-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-50 transition-colors"
                        >
                            <ChevronLeft size={24} />
                        </button>
                        <div className="flex items-center gap-2">
                            <BookOpen size={18} className="text-brand-navy dark:text-brand-navy-light shrink-0" />
                            <PageTitle>훈련계획 상세</PageTitle>
                        </div>
                    </div>

                    <div className="relative">
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="p-2 -mr-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                        >
                            <MoreVertical size={20} />
                        </button>
                        {isMenuOpen && (
                            <div className="absolute right-0 mt-2 w-36 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg overflow-hidden z-50">
                                <Link
                                    href={`/admin/training-plan/${id}/edit`}
                                    className="w-full text-left px-4 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2 transition-colors"
                                >
                                    <Edit2 size={16} className="text-zinc-400" />
                                    수정
                                </Link>
                                <button
                                    onClick={handleDelete}
                                    className="w-full text-left px-4 py-3 text-sm font-medium text-brand-red hover:bg-brand-red/5 flex items-center gap-2 transition-colors border-t border-zinc-100 dark:border-zinc-800"
                                >
                                    <Trash2 size={16} className="text-brand-red/70" />
                                    삭제
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 sm:px-8 py-6 space-y-5">

                {/* ── 1. Basic Info ── */}
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm space-y-4">
                    {/* Type Badge */}
                    <div className="flex items-center gap-2">
                        <span className={cn(
                            "inline-flex items-center justify-center px-3 py-1 rounded-full text-[11px] font-bold tracking-wide",
                            styles.bg, styles.text
                        )}>
                            {PLAN_TYPE_LABELS[plan.type]}
                        </span>
                    </div>

                    {/* Meta: Author + Date */}
                    <div className="flex items-center gap-4 pt-4 border-t border-zinc-100 dark:border-zinc-800/50">
                        <div className="flex items-center gap-2 flex-1">
                            <div className="w-8 h-8 rounded-full bg-brand-navy/10 flex items-center justify-center text-brand-navy dark:bg-brand-navy-light/20 dark:text-brand-navy-light">
                                <User size={16} />
                            </div>
                            <div>
                                <p className="text-[10px] text-zinc-500">작성자</p>
                                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{plan.author}</p>
                            </div>
                        </div>
                        <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-800"></div>
                        <div className="flex items-center gap-2 flex-1">
                            <div className="w-8 h-8 rounded-full bg-brand-navy/10 flex items-center justify-center text-brand-navy dark:bg-brand-navy-light/20 dark:text-brand-navy-light">
                                <Calendar size={16} />
                            </div>
                            <div>
                                <p className="text-[10px] text-zinc-500">훈련 일자</p>
                                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{plan.date.slice(5).replace(/-/g, ".")}</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── 2. Attached Media ── */}
                {plan.media_urls && plan.media_urls.length > 0 && (
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
                        <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                            <Play size={14} className="text-zinc-400" />
                            <h3 className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">첨부 파일</h3>
                        </div>

                        <div className="p-4 bg-transparent relative group">
                            <div
                                ref={mediaCarouselRef}
                                className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-2 scrollbar-hide"
                            >
                                {plan.media_urls.map((url, idx) => {
                                    const isVideo = url.toLowerCase().includes('.mp4') || url.toLowerCase().includes('.mov') || url.toLowerCase().includes('.webm');
                                    return (
                                        <div key={idx} className="shrink-0 w-full aspect-[2/3] sm:aspect-[4/3] snap-center rounded-3xl overflow-hidden shadow-sm relative border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 py-4 sm:py-8 px-2 sm:px-4 flex items-center justify-center">
                                            {isVideo ? (
                                                <CustomVideoPlayer src={url} className="w-full h-full" />
                                            ) : (
                                                <img
                                                    src={url}
                                                    alt={`첨부파일 ${idx + 1}`}
                                                    className="w-full h-full object-contain rounded-2xl"
                                                />
                                            )}
                                            {plan.media_urls!.length > 1 && (
                                                <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full z-10 pointer-events-none">
                                                    {idx + 1} / {plan.media_urls!.length}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            {plan.media_urls!.length > 1 && (
                                <>
                                    <button onClick={() => scrollMediaCarousel("left")} className="hidden sm:flex absolute left-6 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 dark:bg-black/60 backdrop-blur-sm hover:bg-white dark:hover:bg-black text-zinc-800 dark:text-zinc-200 rounded-full items-center justify-center shadow-lg transition-all opacity-0 group-hover:opacity-100 z-10">
                                        <ChevronLeft size={24} />
                                    </button>
                                    <button onClick={() => scrollMediaCarousel("right")} className="hidden sm:flex absolute right-6 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 dark:bg-black/60 backdrop-blur-sm hover:bg-white dark:hover:bg-black text-zinc-800 dark:text-zinc-200 rounded-full items-center justify-center shadow-lg transition-all opacity-0 group-hover:opacity-100 z-10">
                                        <ChevronRight size={24} />
                                    </button>
                                </>
                            )}
                        </div>
                    </section>
                )}


                {/* ── 3. Content ── */}
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm min-h-[140px]">
                    <div
                        className="prose prose-sm sm:prose-base prose-zinc dark:prose-invert max-w-none text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{ __html: plan.content }}
                    />
                </section>

                {/* ── Comments ── */}

                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                        <MessageSquare size={14} className="text-zinc-400" />
                        <h3 className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">
                            댓글 {comments.length}건
                        </h3>
                    </div>

                    <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto">
                        {comments.map((c) => (
                            <div key={c.id} className="flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-200 dark:border-zinc-700">
                                    <User size={14} className="text-zinc-400" />
                                </div>
                                <div className="flex-1 space-y-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{c.author}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-zinc-400 font-medium">
                                                {c.time}
                                            </span>
                                            {currentUser?.id === c.userId && (
                                                <div className="flex items-center gap-1 ml-1">
                                                    <button
                                                        onClick={() => {
                                                            setEditingCommentId(c.id);
                                                            setEditingCommentText(c.text);
                                                        }}
                                                        className="text-zinc-400 hover:text-brand-navy"
                                                    >
                                                        <Edit2 size={12} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteComment(c.id)}
                                                        className="text-zinc-400 hover:text-brand-red"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {editingCommentId === c.id ? (
                                        <div className="space-y-2 mt-1">
                                            <textarea
                                                value={editingCommentText}
                                                onChange={(e) => setEditingCommentText(e.target.value)}
                                                className="w-full p-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-brand-navy/30 focus:outline-none"
                                                rows={2}
                                            />
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => setEditingCommentId(null)}
                                                    className="px-2 py-1 text-[10px] font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
                                                >
                                                    취소
                                                </button>
                                                <button
                                                    onClick={() => handleEditComment(c.id)}
                                                    className="px-2 py-1 text-[10px] font-bold bg-brand-navy text-white rounded hover:bg-brand-navy/90"
                                                >
                                                    수정완료
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed break-words">{c.text}</p>
                                            {c.fileUrl && (
                                                <div className="mt-2 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-white">
                                                    {c.fileType?.startsWith("image/") ? (
                                                        <img src={c.fileUrl} alt="첨부 이미지" className="max-h-48 w-auto object-contain" />
                                                    ) : c.fileType?.startsWith("video/") ? (
                                                        <video src={c.fileUrl} controls className="max-h-48 w-full" />
                                                    ) : (
                                                        <div className="flex items-center gap-2 p-2 bg-zinc-50 dark:bg-zinc-800/50">
                                                            <Paperclip size={12} className="text-zinc-400" />
                                                            <span className="text-[11px] text-zinc-500 truncate">첨부 파일</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                        {comments.length === 0 && (
                            <p className="text-sm text-zinc-400 text-center py-6">아직 댓글이 없습니다.</p>
                        )}
                    </div>

                    {/* Compose */}
                    <div className="border-t border-zinc-100 dark:border-zinc-800 px-4 py-3 space-y-2">
                        <textarea
                            rows={2}
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="댓글을 입력하세요..."
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleCommentSubmit();
                                }
                            }}
                            className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all resize-none"
                        />
                        {/* Compose attachment preview */}
                        {commentFile && (
                            <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700">
                                {commentFile.type.startsWith("image/") && commentPreviewUrl ? (
                                    <div className="relative group">
                                        <img src={commentPreviewUrl} alt={commentFile.name} className="w-full max-h-48 object-contain bg-white" />
                                        <button
                                            onClick={() => { setCommentFile(null); setCommentPreviewUrl(null); }}
                                            className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition-colors"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ) : commentFile.type.startsWith("video/") && commentPreviewUrl ? (
                                    <div className="relative group">
                                        <video src={commentPreviewUrl} className="w-full max-h-40" controls />
                                        <button
                                            onClick={() => { setCommentFile(null); setCommentPreviewUrl(null); }}
                                            className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition-colors"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-800">
                                        <Paperclip size={12} className="text-zinc-400 shrink-0" />
                                        <span className="text-xs text-zinc-600 dark:text-zinc-300 truncate flex-1">{commentFile.name}</span>
                                        <button onClick={() => { setCommentFile(null); setCommentPreviewUrl(null); }} className="shrink-0 text-zinc-400 hover:text-zinc-600">
                                            <X size={12} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => commentFileInputRef.current?.click()}
                                className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-brand-navy dark:hover:text-brand-navy-light transition-colors"
                            >
                                <Paperclip size={14} />
                                파일 첨부
                            </button>
                            <input
                                ref={commentFileInputRef}
                                type="file"
                                accept="image/*,video/*"
                                className="hidden"
                                onChange={handleCommentFileChange}
                            />
                            <button
                                onClick={() => handleCommentSubmit()}
                                disabled={isSubmittingComment || (!newComment.trim() && !commentFile)}
                                className={cn(
                                    "flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                                    (newComment.trim() || commentFile) && !isSubmittingComment
                                        ? "bg-brand-navy text-white hover:bg-brand-navy/90 active:scale-95"
                                        : "bg-zinc-200 dark:bg-zinc-700 text-zinc-400 cursor-not-allowed"
                                )}
                            >
                                {isSubmittingComment ? (
                                    <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <Send size={12} />
                                )}
                                등록
                            </button>
                        </div>
                    </div>
                </section>



                {/* ── Back Button ── */}
                <div className="flex justify-center pt-2">
                    <button
                        onClick={() => router.push("/admin/training-plan")}
                        className="px-8 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all active:scale-95"
                    >
                        목록으로 돌아가기
                    </button>
                </div>

            </main>
        </div>
    );
}