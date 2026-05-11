"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { BookOpen, ChevronLeft, ChevronRight, MoreVertical, Calendar, Download, AlertCircle, MessageSquare, Send, Flag, MapPin, User, CheckCircle2, Edit2, Trash2, Paperclip, X } from "lucide-react";
import Image from "next/image";

import { createClient } from "@/lib/supabase/client";
import { fetchLessonTemplates, LessonTemplate } from "@/lib/lesson-template-sync";
import { parseMediaUrls, fetchComments, saveComment, updateComment, deleteComment, AnalysisComment } from "@/lib/analysis-sync";
import { cn } from "@/lib/utils";

export default function LessonDetailPage() {
    const router = useRouter();
    const params = useParams();
    const { id } = params;

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const [lesson, setLesson] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [comments, setComments] = useState<AnalysisComment[]>([]);
    const [dbTemplates, setDbTemplates] = useState<LessonTemplate[]>([]);
    const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);

    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
    const [editingCommentText, setEditingCommentText] = useState("");
    const [isUpdatingComment, setIsUpdatingComment] = useState(false);

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
        const confirmDelete = window.confirm("레슨 내용을 삭제하시겠습니까?");
        if (confirmDelete) {
            const supabase = createClient();
            const { error } = await supabase.from("records").delete().eq("id", id);
            if (error) {
                alert("삭제에 실패했습니다.");
            } else {
                alert("삭제되었습니다.");
                router.push("/lessons");
            }
        }
    };

    const handleEdit = () => {
        setIsMenuOpen(false);
        router.push(`/lessons/${id}/edit`);
    };

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

                // 1. Fetch lesson record
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
                        user:users!records_user_id_fkey(name),
                        coach:users!records_coach_id_fkey(name)
                    `)
                    .eq("id", id)
                    .single();
                
                if (error) throw error;

                // 2. Fetch comments and templates in parallel
                const [commentsData, templatesData] = await Promise.all([
                    fetchComments(id as string),
                    fetchLessonTemplates()
                ]);

                setComments(commentsData);
                setDbTemplates(templatesData);

                // 3. Parse media_urls
                const allMedia = parseMediaUrls(data.media_urls);
                const mediaFiles = allMedia.filter(url => url.startsWith('http')).map(url => ({
                    type: url.match(/\.(mp4|mov|webm)$/i) ? 'video' : 'image',
                    url
                }));
                const templateIds = allMedia
                    .filter(url => url.startsWith('template:'))
                    .map(url => url.replace('template:', ''));

                const templates = templatesData.filter(t => templateIds.includes(t.id));

                setLesson({
                    id: data.id,
                    writer: (data.coach as any)?.[0]?.name || (data.coach as any)?.name || "Unknown",
                    player: (data.user as any)?.[0]?.name || (data.user as any)?.name || "Unknown",
                    type: data.category,
                    typeLabel: data.category?.toUpperCase(),
                    date: data.created_at?.split('T')[0],
                    time: data.created_at?.split('T')[1]?.slice(0, 5),
                    title: data.title || "제목 없음",
                    content: data.content || "",
                    selectedImages: templates.map(t => ({ url: t.imageUrl, title: t.title })),
                    media: mediaFiles,
                });
            } catch (err) {
                console.error("Failed to fetch lesson detail:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [id]);

    const [newComment, setNewComment] = useState("");
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const [commentFile, setCommentFile] = useState<File | null>(null);
    const [commentPreviewUrl, setCommentPreviewUrl] = useState<string | null>(null);
    const commentFileRef = useRef<HTMLInputElement>(null);
    const carouselRef = useRef<HTMLDivElement>(null);
    const contentCarouselRef = useRef<HTMLDivElement>(null);

    const handleCommentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;
        setCommentFile(file);
        setCommentPreviewUrl(file ? URL.createObjectURL(file) : null);
        e.target.value = "";
    };

    const scrollContentCarousel = (direction: "left" | "right") => {
        if (contentCarouselRef.current) {
            const scrollAmount = contentCarouselRef.current.clientWidth;
            contentCarouselRef.current.scrollBy({
                left: direction === "left" ? -scrollAmount : scrollAmount,
                behavior: "smooth"
            });
        }
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

    if (isLoading) {
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-brand-navy/20 border-t-brand-navy rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!lesson) {
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
                <p className="text-zinc-500">레슨 정보를 찾을 수 없습니다.</p>
            </div>
        );
    }

    const derivedTitle = lesson.title;

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-24">
            {/* ── 1. Header ── */}
            <header className="sticky top-0 z-40 bg-zinc-50/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
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
                            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                                레슨 상세
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
                                <button
                                    onClick={handleEdit}
                                    className="w-full text-left px-4 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2 transition-colors"
                                >
                                    <Edit2 size={16} className="text-zinc-400" />
                                    수정
                                </button>
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

                {/* ── 2. Core Info (Moved up) ── */}
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-brand-navy dark:bg-brand-navy-light text-white uppercase tracking-wider">
                                {lesson.typeLabel}
                            </span>
                             <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                                <Calendar size={14} />
                                {lesson.date} {lesson.time}
                            </span>
                        </div>
                    </div>

                    <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-50 truncate" title={derivedTitle}>
                        {derivedTitle}
                    </h2>

                    <div className="flex items-center gap-4 pt-4 border-t border-zinc-100 dark:border-zinc-800/50">
                        <div className="flex items-center gap-2 flex-1">
                            <div className="w-8 h-8 rounded-full bg-brand-navy/10 flex items-center justify-center text-brand-navy dark:bg-brand-navy-light/20 dark:text-brand-navy-light">
                                <User size={16} />
                            </div>
                            <div>
                                <p className="text-[10px] text-zinc-500">담당 코치</p>
                                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{lesson.writer}</p>
                            </div>
                        </div>
                        <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-800"></div>
                        <div className="flex items-center gap-2 flex-1">
                            <div className="w-8 h-8 rounded-full bg-brand-navy/10 flex items-center justify-center text-brand-navy dark:bg-brand-navy-light/20 dark:text-brand-navy-light">
                                <User size={16} />
                            </div>
                            <div>
                                <p className="text-[10px] text-zinc-500">선수</p>
                                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{lesson.player}</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── 3. Hero Media Gallery (Swipeable, Unified Images & Videos) ── */}
                {lesson.media && lesson.media.length > 0 && (
                    <section className="bg-transparent relative group">
                        <div
                            ref={carouselRef}
                            className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-2 scrollbar-hide"
                        >
                            {lesson.media.map((item: any, idx: number) => (
                                <div key={idx} className="shrink-0 w-full aspect-[4/5] sm:aspect-[4/3] snap-center rounded-3xl overflow-hidden shadow-sm relative border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
                                    {item.type === "video" ? (
                                        <video
                                            src={item.url}
                                            controls
                                            playsInline
                                            className="w-full h-full object-contain"
                                        />
                                    ) : (
                                        <img
                                            src={item.url}
                                            alt={`Lesson Media ${idx + 1}`}
                                            className="w-full h-full object-contain"
                                        />
                                    )}
                                    {lesson.media.length > 1 && (
                                        <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full z-10 pointer-events-none">
                                            {idx + 1} / {lesson.media.length}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        {/* Navigation Arrows (Desktop) */}
                        {lesson.media.length > 1 && (
                            <>
                                <button
                                    onClick={() => scrollCarousel("left")}
                                    className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 dark:bg-black/60 backdrop-blur-sm hover:bg-white dark:hover:bg-black text-zinc-800 dark:text-zinc-200 rounded-full items-center justify-center shadow-lg transition-all opacity-0 group-hover:opacity-100 z-10"
                                >
                                    <ChevronLeft size={24} />
                                </button>
                                <button
                                    onClick={() => scrollCarousel("right")}
                                    className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 dark:bg-black/60 backdrop-blur-sm hover:bg-white dark:hover:bg-black text-zinc-800 dark:text-zinc-200 rounded-full items-center justify-center shadow-lg transition-all opacity-0 group-hover:opacity-100 z-10"
                                >
                                    <ChevronRight size={24} />
                                </button>
                            </>
                        )}
                    </section>
                )}

                {/* ── 4. Content ── */}
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-4">
                    <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800/50 pb-3">
                        레슨 내용
                    </h3>
                    <div className="flex flex-col sm:flex-row gap-5">
                        {lesson.selectedImages && lesson.selectedImages.length > 0 && (
                            <div className="shrink-0 w-full sm:w-1/3 aspect-[4/3] sm:aspect-square rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 relative group/content">
                                <div
                                    ref={contentCarouselRef}
                                    className="flex overflow-x-auto snap-x snap-mandatory h-full scrollbar-hide"
                                >
                                    {lesson.selectedImages.map((img: { url: string; title: string }, idx: number) => (
                                        <div key={idx} className="shrink-0 w-full h-full snap-center relative">
                                            <img
                                                src={img.url}
                                                alt={img.title}
                                                className="w-full h-full object-cover"
                                            />
                                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8">
                                                <p className="text-white text-xs font-bold truncate">
                                                    {img.title}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {lesson.selectedImages.length > 1 && (
                                    <>
                                        <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded-full z-10">
                                            {lesson.selectedImages.length} images
                                        </div>
                                        <button
                                            onClick={() => scrollContentCarousel("left")}
                                            className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 bg-white/80 dark:bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover/content:opacity-100 transition-opacity"
                                        >
                                            <ChevronLeft size={14} />
                                        </button>
                                        <button
                                            onClick={() => scrollContentCarousel("right")}
                                            className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 bg-white/80 dark:bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover/content:opacity-100 transition-opacity"
                                        >
                                            <ChevronRight size={14} />
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                        <div className="flex-1 prose prose-sm sm:prose-base prose-zinc dark:prose-invert max-w-none text-zinc-700 dark:text-zinc-300 whitespace-pre-line leading-relaxed">
                            {lesson.content}
                        </div>
                    </div>
                </section>

                {/* ── 5. Related Score Context ── */}
                {lesson.relatedScore && (
                    <section className="bg-gradient-to-br from-brand-navy/5 to-transparent dark:from-brand-navy/10 dark:to-transparent border border-brand-navy/20 dark:border-brand-navy/30 p-5 rounded-3xl shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-brand-navy/5 dark:bg-brand-navy-light/5 rounded-full blur-2xl"></div>
                        <h3 className="text-sm font-bold text-brand-navy dark:text-brand-navy-light flex items-center gap-2 mb-4">
                            <Flag size={16} />
                            레슨 전 라운딩 요약
                        </h3>
                        <Link href={`/scores/${lesson.relatedScore.id}`} className="block block space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-black text-brand-navy dark:text-white leading-none">
                                        {lesson.relatedScore.score}
                                    </span>
                                    <span className="text-sm font-semibold text-zinc-500">타</span>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center justify-end gap-1.5"><MapPin size={14} className="text-zinc-400" />{lesson.relatedScore.course}</p>
                                    <p className="text-xs text-zinc-500">{lesson.relatedScore.date}</p>
                                </div>
                            </div>

                            <div className="grid gap-2 text-sm mt-2">
                                <div className="bg-white/60 dark:bg-zinc-900/60 backdrop-blur-sm p-2.5 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 flex gap-3 items-center">
                                    <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded bg-orange-500/10 text-orange-500">CHALLENGE</span>
                                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{lesson.relatedScore.challengeFocus}</span>
                                </div>
                                <div className="bg-white/60 dark:bg-zinc-900/60 backdrop-blur-sm p-2.5 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 flex gap-3 items-center">
                                    <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded bg-brand-navy/10 text-brand-navy dark:bg-brand-navy-light/20 dark:text-brand-navy-light">STRONG</span>
                                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{lesson.relatedScore.strongPoint}</span>
                                </div>
                            </div>
                        </Link>
                    </section>
                )}

                {/* ── 6. Comments Section ── */}
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
                                        <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded leading-none">{c.role}</span>
                                        {currentUser?.id === c.userId && (
                                            <div className="hidden group-hover:flex items-center gap-1 ml-2">
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
                                    <img src={c.fileUrl} className="mt-2 rounded-xl max-h-60 w-auto object-contain bg-white border border-zinc-200 dark:border-zinc-700" alt="첨부" />
                                )}
                                {c.fileUrl && c.fileType?.startsWith("video/") && (
                                    <video src={c.fileUrl} controls className="mt-2 rounded-xl max-h-60 w-full border border-zinc-200 dark:border-zinc-700" />
                                )}
                            </div>
                        ))}
                        {comments.length === 0 && (
                            <p className="text-sm text-zinc-400 text-center py-8">아직 댓글이 없습니다.</p>
                        )}
                    </div>

                    <div className="border-t border-zinc-100 dark:border-zinc-800 px-4 py-3 space-y-2 bg-zinc-50/50 dark:bg-zinc-900/50">
                        <textarea
                            rows={2}
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="댓글이나 질문을 남겨보세요..."
                            disabled={isSubmittingComment}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleCommentSubmit(e);
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
                                disabled={isSubmittingComment}
                                onClick={() => commentFileRef.current?.click()}
                                className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-brand-navy transition-colors disabled:opacity-50"
                            >
                                <Paperclip size={14} /> 파일 첨부
                            </button>
                            <input ref={commentFileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleCommentFileChange} />
                            <button
                                onClick={handleCommentSubmit}
                                disabled={(!newComment.trim() && !commentFile) || isSubmittingComment}
                                className={cn(
                                    "flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                                    (newComment.trim() || commentFile) && !isSubmittingComment
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
