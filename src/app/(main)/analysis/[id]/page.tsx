"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Activity, ChevronLeft, ChevronRight, MoreVertical, Calendar, MessageSquare, Send, User, Edit2, Trash2, Paperclip, X } from "lucide-react";

import { fetchAnalysisById, AnalysisRecord, fetchComments, saveComment, updateComment, deleteComment, deleteAnalysisRecord, AnalysisComment } from "@/lib/analysis-sync";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { uploadFile } from "@/lib/storage-sync";

export default function AnalysisDetailPage() {
    const router = useRouter();
    const params = useParams();
    const { id } = params;

    const [analysis, setAnalysis] = useState<AnalysisRecord | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const [newComment, setNewComment] = useState("");
    const [commentFile, setCommentFile] = useState<File | null>(null);
    const [commentPreviewUrl, setCommentPreviewUrl] = useState<string | null>(null);
    const commentFileRef = useRef<HTMLInputElement>(null);
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const [comments, setComments] = useState<AnalysisComment[]>([]);

    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
    const [editingCommentText, setEditingCommentText] = useState("");
    const [isUpdatingComment, setIsUpdatingComment] = useState(false);

    const carouselRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (id) {
            const loadData = async () => {
                const [analysisData, commentsData] = await Promise.all([
                    fetchAnalysisById(id as string),
                    fetchComments(id as string)
                ]);
                setAnalysis(analysisData);
                setComments(commentsData);
                setIsLoading(false);
            };
            loadData();
        }

        // Load current user
        const supabase = createClient();
        supabase.auth.getUser().then(({ data }) => {
            if (data.user) {
                supabase.from("users").select("id, name").eq("id", data.user.id).single().then(({ data: userData }) => {
                    if (userData) {
                        setCurrentUser({ id: userData.id, name: userData.name });
                    }
                });
            }
        });
    }, [id]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleDelete = async () => {
        setIsMenuOpen(false);
        const confirmDelete = window.confirm("분석 내용을 삭제하시겠습니까?");
        if (confirmDelete) {
            try {
                await deleteAnalysisRecord(id as string);
                alert("삭제되었습니다.");
                router.push("/analysis");
            } catch (err) {
                alert("삭제에 실패했습니다.");
            }
        }
    };

    const handleEdit = () => {
        setIsMenuOpen(false);
        router.push(`/analysis/${id}/edit`);
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

    const handleCommentSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if ((!newComment.trim() && !commentFile) || !id || !currentUser || isSubmittingComment) return;

        setIsSubmittingComment(true);
        try {
            let mediaUrl = undefined;
            if (commentFile) {
                mediaUrl = await uploadFile(commentFile, 'records', `comments/${id}`);
            }

            await saveComment({
                recordId: id as string,
                userId: currentUser.id,
                content: newComment.trim(),
                mediaUrl: mediaUrl,
                mediaType: commentFile?.type
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

    if (isLoading) return <div className="min-h-screen flex items-center justify-center">로딩 중...</div>;
    if (!analysis) return <div className="min-h-screen flex items-center justify-center">분석 정보를 찾을 수 없습니다.</div>;

    const mediaList = analysis.media_urls?.map(url => ({
        type: /\.(mp4|webm|ogg|mov)(?:\?.*)?$/i.test(url) ? "video" : "image",
        url: typeof url === 'string' ? url.trim() : url
    })) || [];

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-24">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-zinc-50/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
                <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-50 transition-colors">
                            <ChevronLeft size={24} />
                        </button>
                        <div className="flex items-center gap-2">
                            <Activity size={18} className="text-brand-navy dark:text-brand-navy-light shrink-0" />
                            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">분석 상세</h1>
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
                                <button onClick={handleDelete} className="w-full text-left px-4 py-3 text-sm font-medium text-brand-red hover:bg-brand-red/5 flex items-center gap-2 transition-colors border-t border-zinc-100 dark:border-zinc-800">
                                    <Trash2 size={16} className="text-brand-red/70" /> 삭제
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
                {/* Core Info */}
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-brand-navy dark:bg-brand-navy-light text-white uppercase tracking-wider">
                                {analysis.type}
                            </span>
                            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                                <Calendar size={14} /> {analysis.date} {analysis.time && <span className="ml-1 opacity-70">{analysis.time}</span>}
                            </span>
                        </div>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-50 truncate" title={analysis.title}>{analysis.title}</h2>
                    <div className="flex items-center gap-4 pt-4 border-t border-zinc-100 dark:border-zinc-800/50">
                        <div className="flex items-center gap-2 flex-1">
                            <div className="w-8 h-8 rounded-full bg-brand-navy/10 flex items-center justify-center text-brand-navy dark:bg-brand-navy-light/20 dark:text-brand-navy-light">
                                <User size={16} />
                            </div>
                            <div>
                                <p className="text-[10px] text-zinc-500">담당 코치</p>
                                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{analysis.coachName}</p>
                            </div>
                        </div>
                        <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-800"></div>
                        <div className="flex items-center gap-2 flex-1">
                            <div className="w-8 h-8 rounded-full bg-brand-navy/10 flex items-center justify-center text-brand-navy dark:bg-brand-navy-light/20 dark:text-brand-navy-light">
                                <User size={16} />
                            </div>
                            <div>
                                <p className="text-[10px] text-zinc-500">선수</p>
                                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{analysis.playerName}</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Media Gallery */}
                {mediaList.length > 0 && (
                    <section className="relative group">
                        <div ref={carouselRef} className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-2 scrollbar-hide">
                            {mediaList.map((item, idx) => (
                                <div key={idx} className="shrink-0 w-full aspect-[4/5] sm:aspect-[4/3] snap-center rounded-3xl overflow-hidden shadow-sm relative border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
                                    {item.type === "video" ? (
                                        <video src={item.url} controls playsInline className="w-full h-full object-contain" />
                                    ) : (
                                        <div className="w-full h-full relative">
                                            <img
                                                src={item.url}
                                                alt={`Analysis Media ${idx + 1}`}
                                                className="w-full h-full object-contain transition-opacity duration-300"
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    target.style.display = 'none';
                                                    target.parentElement?.classList.add('flex', 'items-center', 'justify-center');
                                                    if (target.parentElement) {
                                                        const p = document.createElement('p');
                                                        p.className = 'text-xs text-zinc-500 text-center px-4';
                                                        p.innerText = '이미지를 불러올 수 없습니다. URL이나 접근 권한(Bucket Public 여부)을 확인해주세요.\n' + item.url;
                                                        target.parentElement.appendChild(p);
                                                    }
                                                }}
                                            />
                                        </div>
                                    )}
                                    {mediaList.length > 1 && (
                                        <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold px-3 py-1.5 rounded-full z-10">
                                            {idx + 1} / {mediaList.length}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        {mediaList.length > 1 && (
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

                {/* Content */}
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-4">
                    <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800/50 pb-3">분석 내용</h3>
                    <div className="prose prose-zinc dark:prose-invert max-w-none text-zinc-700 dark:text-zinc-300 whitespace-pre-line leading-relaxed text-sm">
                        {analysis.comment}
                    </div>
                </section>

                {/* Comments Section */}
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
                            placeholder={currentUser ? "댓글을 입력하세요..." : "로그인이 필요합니다."}
                            disabled={!currentUser || isSubmittingComment}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleCommentSubmit();
                                }
                            }}
                            className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all resize-none disabled:opacity-50"
                        />
                        {commentFile && (
                            <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 relative group">
                                {commentFile.type.startsWith("image/") && commentPreviewUrl ? (
                                    <img src={commentPreviewUrl} className="w-full max-h-48 object-cover" alt="미리보기" />
                                ) : (
                                    <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-500 truncate">{commentFile.name}</div>
                                )}
                                <button onClick={() => { setCommentFile(null); setCommentPreviewUrl(null); }} className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1"><X size={12} /></button>
                            </div>
                        )}
                        <div className="flex items-center justify-between">
                            <button
                                type="button"
                                disabled={!currentUser || isSubmittingComment}
                                onClick={() => commentFileRef.current?.click()}
                                className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-brand-navy transition-colors disabled:opacity-50"
                            >
                                <Paperclip size={14} /> 파일 첨부
                            </button>
                            <input ref={commentFileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleCommentFileChange} />
                            <button
                                onClick={() => handleCommentSubmit()}
                                disabled={(!newComment.trim() && !commentFile) || !currentUser || isSubmittingComment}
                                className={cn(
                                    "flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                                    (newComment.trim() || commentFile) && currentUser && !isSubmittingComment
                                        ? "bg-brand-navy text-white hover:bg-brand-navy/90 active:scale-95"
                                        : "bg-zinc-200 dark:bg-zinc-700 text-zinc-400 cursor-not-allowed"
                                )}
                            >
                                <Send size={12} /> {isSubmittingComment ? "저장 중..." : "등록"}
                            </button>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}
