"use client";
import { fetchComments, saveComment, updateComment, deleteComment, AnalysisComment } from "@/lib/analysis-sync";
import { MessageSquare, Send, Paperclip, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import "react-quill-new/dist/quill.snow.css";

import { useState, useRef, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
    ChevronLeft,
    MoreVertical,
    Calendar,
    User,
    Edit2,
    Trash2,
    Megaphone
} from "lucide-react";
import { getNoticeById, deleteNotice, NOTICE_TYPE_LABELS, NoticeType, NOTICE_TYPE_COLORS, Notice } from "@/lib/notice-sync";
import { cn } from "@/lib/utils";

export default function NoticeDetailPage() {
    const router = useRouter();
    const params = useParams();
    const { id } = params;

    const [notice, setNotice] = useState<Notice | null>(null);
    const [loading, setLoading] = useState(true);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const [comments, setComments] = useState<AnalysisComment[]>([]);
    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
    const [editingCommentText, setEditingCommentText] = useState("");
    const [isUpdatingComment, setIsUpdatingComment] = useState(false);
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const [newComment, setNewComment] = useState("");
    const [commentFile, setCommentFile] = useState<File | null>(null);
    const [commentPreviewUrl, setCommentPreviewUrl] = useState<string | null>(null);
    const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
    const commentFileRef = useRef<HTMLInputElement>(null);


    
    useEffect(() => {
        if (id) {
            fetchComments(id as string).then(setComments);
        }
        createClient().auth.getUser().then(({ data }) => {
            if (data?.user) setCurrentUser({ id: data.user.id, name: data.user.user_metadata?.name || 'User' });
        });
    }, [id]);

    useEffect(() => {
        if (id) {
            getNoticeById(id as string).then(data => {
                setNotice(data);
                setLoading(false);
            });
        }
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

    
    const handleCommentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;
        setCommentFile(file);
        setCommentPreviewUrl(file ? URL.createObjectURL(file) : null);
        e.target.value = "";
    };

    const handleCommentSubmit = async (e?: React.FormEvent | React.KeyboardEvent) => {
        if (e) e.preventDefault();
        if (!newComment.trim() && !commentFile) return;

        try {
            setIsSubmittingComment(true);
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                alert("로그인이 필요합니다.");
                return;
            }

            let fileUrl = undefined;
            let fileType = undefined;

            if (commentFile) {
                const { uploadFile } = await import("@/lib/storage-sync");
                fileUrl = await uploadFile(commentFile, 'records', `comments/${id}`);
                fileType = commentFile.type;
            }

            // Ensure a dummy record exists for foreign key constraint in comments table
            const { data: existingRecord } = await supabase.from("records").select("id").eq("id", id).maybeSingle();
            if (!existingRecord) {
                await supabase.from("records").insert({
                    id: id as string,
                    user_id: user.id,
                    coach_id: user.id,
                    type: "notice",
                    category: "system",
                    title: "Notice Record",
                    content: ""
                });
            }

            await saveComment({
                recordId: id as string,
                userId: user.id,
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
            console.error(err);
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

    const handleDelete = async () => {
        setIsMenuOpen(false);
        if (window.confirm("공지사항을 삭제하시겠습니까?")) {
            try {
                await deleteNotice(id as string);
                alert("삭제되었습니다.");
                router.push("/community");
            } catch (err) {
                console.error(err);
                alert("삭제 중 오류가 발생했습니다.");
            }
        }
    };

    if (loading) return <div className="flex items-center justify-center min-h-screen">로딩 중...</div>;
    if (!notice) return <div className="flex items-center justify-center min-h-screen">공지사항을 찾을 수 없습니다.</div>;

    return (
        <div className="min-h-screen bg-white dark:bg-zinc-950 pb-20">
            {/* ── Header ── */}
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
                            <Megaphone size={18} className="text-brand-navy dark:text-brand-navy-light shrink-0" />
                            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                                공지 상세
                            </h1>
                        </div>
                    </div>

                    <div className="relative" ref={menuRef}>
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="p-2 -mr-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                        >
                            <MoreVertical size={20} />
                        </button>

                        {isMenuOpen && (
                            <div className="absolute right-0 mt-2 w-36 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg overflow-hidden z-50 animate-in fade-in zoom-in-95 origin-top-right duration-100">
                                <Link
                                    href={`/community/${id}/edit`}
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

            <main className="max-w-3xl mx-auto px-4 sm:px-8 py-6 space-y-6">
                {/* ── Notice Info ── */}
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className={cn(
                                "text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider border",
                                NOTICE_TYPE_COLORS[notice.type].bg,
                                NOTICE_TYPE_COLORS[notice.type].text,
                                NOTICE_TYPE_COLORS[notice.type].border
                            )}>
                                {NOTICE_TYPE_LABELS[notice.type]}
                            </span>
                            <span className="text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                                {notice.branch}
                            </span>
                            {notice.isImportant && (
                                <span className="text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 px-2 py-1 rounded-full">
                                    중요
                                </span>
                            )}
                        </div>
                    </div>

                    <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-50 leading-tight">
                        {notice.title}
                    </h2>

                    <div className="flex items-center gap-4 pt-5 border-t border-zinc-100 dark:border-zinc-800/50">
                        <div className="flex items-center gap-2 flex-1">
                            <div className="w-8 h-8 rounded-full bg-brand-navy/5 flex items-center justify-center text-brand-navy dark:bg-brand-navy-light/10 dark:text-brand-navy-light">
                                <User size={16} />
                            </div>
                            <div>
                                <p className="text-[10px] text-zinc-500 font-medium leading-none mb-1">작성자</p>
                                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-none">{notice.author}</p>
                            </div>
                        </div>
                        <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-800"></div>
                        <div className="flex items-center gap-2 flex-1">
                            <div className="w-8 h-8 rounded-full bg-brand-navy/5 flex items-center justify-center text-brand-navy dark:bg-brand-navy-light/10 dark:text-brand-navy-light">
                                <Calendar size={16} />
                            </div>
                            <div>
                                <p className="text-[10px] text-zinc-500 font-medium leading-none mb-1">작성일</p>
                                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-none">{notice.date.replace(/-/g, ".")}</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── Content (Rich Text) ── */}
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl shadow-sm min-h-[200px] ql-snow">
                    <div
                        className="ql-editor px-0 py-0 max-w-none text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap [&>p]:m-0"
                        dangerouslySetInnerHTML={{ __html: notice.content.replace(/<p>\s*<\/p>/g, '<p><br></p>') }}
                    />
                </section>

                
                {/* ── Feedback Section ── */}
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

                {/* ── Footer Actions ── */}
                <div className="flex justify-center pt-4">
                    <button
                        onClick={() => router.push("/community")}
                        className="px-8 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all active:scale-95"
                    >
                        목록으로 돌아가기
                    </button>
                </div>
            </main>
        </div>
    );
}
