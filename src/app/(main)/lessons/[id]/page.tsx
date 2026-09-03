"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Edit2, Trash2, ChevronLeft, ChevronRight, MoreVertical, CheckCircle2, User, Flag, MessageSquare, Send, Calendar, Clock, BookOpen, FileText, MapPin, Paperclip, X, Upload, Video } from "lucide-react";
import { FileUploadButton } from "@/components/ui/FileUploadButton";
import { PageTitle, SectionTitle, BodyText, Caption, Badge } from "@/components/ui/Typography";
import Image from "next/image";

import { createClient } from "@/lib/supabase/client";
import { fetchLessonTemplates, LessonTemplate } from "@/lib/lesson-template-sync";
import { parseMediaUrls, fetchComments, saveComment, updateComment, deleteComment, AnalysisComment } from "@/lib/analysis-sync";
import { cn } from "@/lib/utils";
import { CustomVideoPlayer } from "@/components/ui/CustomVideoPlayer";
import dynamic from 'next/dynamic';

const PDFViewer = dynamic(() => import("@/components/ui/PDFViewer"), { ssr: false });

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
    const [currentUser, setCurrentUser] = useState<{ id: string; name: string; role?: string } | null>(null);
    const [directorComment, setDirectorComment] = useState("");
    const [isEditingDirectorComment, setIsEditingDirectorComment] = useState(false);
    const [directorCommentInput, setDirectorCommentInput] = useState("");

    const [isCorrectionFormOpen, setIsCorrectionFormOpen] = useState(false);
    const [correctionContent, setCorrectionContent] = useState("");
    const [correctionFiles, setCorrectionFiles] = useState<File[]>([]);
    const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);

    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
    const [editingCommentText, setEditingCommentText] = useState("");
    const [isUpdatingComment, setIsUpdatingComment] = useState(false);

    useEffect(() => {
        // 모바일 크롬 등에서 이전 페이지의 스크롤 위치가 유지되는 현상 방지
        window.scrollTo({ top: 0, left: 0, behavior: "instant" as any });

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
                // 1. Kick off all independent queries in parallel
                const userPromise = supabase.auth.getUser();
                const recordPromise = supabase
                    .from("records")
                    .select(`
                        id,
                        user_id,
                        type,
                        category,
                        title,
                        content,
                        media_urls,
                        is_corrected,
                        correction_content,
                        correction_media,
                        created_at,
                        coach_id,
                        connected_lesson_id,
                        user:users!records_user_id_fkey(id, name),
                        coach:users!records_coach_id_fkey(id, name)
                    `)
                    .eq("id", id)
                    .single();

                const commentsPromise = fetchComments(id as string);
                const templatesPromise = fetchLessonTemplates();

                const [userRes, recordRes, commentsData, templatesData] = await Promise.all([
                    userPromise,
                    recordPromise,
                    commentsPromise,
                    templatesPromise
                ]);

                // Load user profile non-blocking
                const user = userRes.data?.user;
                if (user) {
                    supabase.from("users").select("role, name").eq("id", user.id).single().then(({ data: profile }) => {
                        if (profile) {
                            setCurrentUser({ id: user.id, name: profile.name || 'User', role: profile.role });
                        }
                    });
                }

                if (recordRes.error) throw recordRes.error;
                const data = recordRes.data;

                setComments(commentsData);
                setDbTemplates(templatesData);

                // 3. Parse media_urls and split content
                const allMedia = parseMediaUrls(data.media_urls);
                const beforeMediaFiles = allMedia.filter(url => url.startsWith('http')).map(url => ({
                    type: url.match(/\.(mp4|mov|webm)$/i) ? 'video' : 'image',
                    url
                }));
                const afterMediaFiles = allMedia.filter(url => url.startsWith('after:http')).map(url => {
                    const actualUrl = url.replace('after:', '');
                    return {
                        type: actualUrl.match(/\.(mp4|mov|webm)$/i) ? 'video' : 'image',
                        url: actualUrl
                    };
                });
                const materialMediaFiles = allMedia.filter(url => url.startsWith('material:http')).map(url => {
                    const actualUrl = url.replace('material:', '');
                    const isPdf = actualUrl.match(/\.(pdf)(\?|$)/i);
                    const isVideo = actualUrl.match(/\.(mp4|mov|webm)(\?|$)/i);
                    const isImage = actualUrl.match(/\.(jpg|jpeg|png|gif|webp|heic)(\?|$)/i);
                    
                    let type = 'document';
                    if (isPdf) type = 'pdf';
                    else if (isVideo) type = 'video';
                    else if (isImage) type = 'image';
                    
                    return { type, url: actualUrl, name: decodeURIComponent(actualUrl.split('/').pop()?.split('?')[0] || '첨부 파일') };
                });
                const templateIds = allMedia
                    .filter(url => url.startsWith('template:'))
                    .map(url => url.replace('template:', ''));

                const templates = templatesData.filter(t => templateIds.includes(t.id));

                let rawContent = data.content || "";
                let parsedDirectorComment = "";
                const dIndex = rawContent.indexOf("[감독 코멘트]");
                if (dIndex !== -1) {
                    parsedDirectorComment = rawContent.substring(dIndex + 8).trim();
                    rawContent = rawContent.substring(0, dIndex).trim();
                }

                setDirectorComment(parsedDirectorComment);
                setDirectorCommentInput(parsedDirectorComment);

                let beforeContent = rawContent;
                let afterContent = "";
                const afterSplitIndex = beforeContent.indexOf("[교정 후]");
                if (afterSplitIndex !== -1) {
                    afterContent = beforeContent.substring(afterSplitIndex + 7).trim();
                    beforeContent = beforeContent.substring(0, afterSplitIndex).trim();
                }

                let parentGoalContent = "";
                let isConnectedLesson = false;
                let isParentCoreLesson = false;

                if (data.connected_lesson_id) {
                    const [parentLessonRes, childCountRes] = await Promise.all([
                        supabase.from("records").select("content").eq("id", data.connected_lesson_id).single(),
                        supabase.from("records").select("id", { count: "exact", head: true }).eq("connected_lesson_id", data.connected_lesson_id)
                    ]);

                    if (parentLessonRes.data && parentLessonRes.data.content) {
                        let gContent = parentLessonRes.data.content;
                        const gDIndex = gContent.indexOf("[감독 코멘트]");
                        if (gDIndex !== -1) gContent = gContent.substring(0, gDIndex).trim();
                        const gAfterIndex = gContent.indexOf("[교정 후]");
                        if (gAfterIndex !== -1) gContent = gContent.substring(0, gAfterIndex).trim();
                        parentGoalContent = gContent;
                        isConnectedLesson = true;
                    }

                    if (childCountRes.count && childCountRes.count >= 2) {
                        isParentCoreLesson = true;
                    }
                }

                setLesson({
                    id: data.id,
                    coach_id: data.coach_id,
                    writer: (data.coach as any)?.[0]?.name || (data.coach as any)?.name || "Unknown",
                    player: (data.user as any)?.[0]?.name || (data.user as any)?.name || "Unknown",
                    type: data.category,
                    typeLabel: data.category?.toUpperCase(),
                    date: ((data.created_at) ? new Date(data.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }) : ""),
                    time: ((data.created_at) ? new Date(data.created_at).toLocaleTimeString('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' }) : "09:00"),
                    title: data.title || "제목 없음",
                    content: beforeContent,
                    afterContent: afterContent,
                    parentGoalContent,
                    selectedImages: templates.map(t => ({ url: t.imageUrl, title: t.title })),
                    media: beforeMediaFiles,
                    afterMedia: afterMediaFiles,
                    materialMedia: materialMediaFiles,
                    isConnectedLesson,
                    isParentCoreLesson,
                    is_corrected: data.is_corrected,
                    correction_content: data.correction_content,
                    correction_media: (data.correction_media || []).map((url: string) => ({
                        type: url.match(/\.(mp4|mov|webm)$/i) ? 'video' : 'image',
                        url
                    })),
                });
            } catch (err) {
                console.error("Failed to fetch lesson detail:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [id]);

    const handleSaveDirectorComment = async () => {
        try {
            const { updateLessonRecord } = await import("@/lib/lesson-sync");

            let newContent = lesson.content;
            if (lesson.afterContent) {
                newContent += `\n\n[교정 후]\n${lesson.afterContent}`;
            }
            if (directorCommentInput.trim()) {
                newContent += `\n\n[감독 코멘트]\n${directorCommentInput.trim()}`;
            }

            await updateLessonRecord(id as string, {
                content: newContent
            });

            if (directorCommentInput.trim() && !directorComment && lesson.coach_id && lesson.coach_id !== currentUser?.id) {
                const supabase = createClient();
                const todayStr = new Date().toISOString().split('T')[0];
                await supabase.from("todos").insert({
                    user_id: lesson.coach_id,
                    assigner_id: currentUser?.id,
                    title: `[${lesson.player}] 감독 코멘트 확인`,
                    content: `[${lesson.typeLabel}] 레슨에 감독 코멘트가 작성되었습니다.\n\n코멘트 내용: ${directorCommentInput.trim()}`,
                    due_date: todayStr,
                    is_completed: false,
                    priority: "high"
                });
            }

            setDirectorComment(directorCommentInput.trim());
            setIsEditingDirectorComment(false);
        } catch (e) {
            alert("저장에 실패했습니다.");
        }
    };

    const handleCorrectionSubmit = async () => {
        if (!correctionContent.trim() && correctionFiles.length === 0) return;
        setIsSubmittingCorrection(true);
        try {
            const { updateLessonRecord } = await import("@/lib/lesson-sync");
            let uploadedUrls: string[] = [];
            if (correctionFiles.length > 0) {
                const { uploadFiles } = await import("@/lib/storage-sync");
                uploadedUrls = await uploadFiles(correctionFiles, 'records');
            }
            await updateLessonRecord(id as string, {
                is_corrected: true,
                correction_content: correctionContent,
                correction_media: uploadedUrls
            });
            setLesson((prev: any) => ({
                ...prev,
                is_corrected: true,
                correction_content: correctionContent,
                correction_media: uploadedUrls.map((url: string) => ({
                    type: url.match(/\.(mp4|mov|webm)$/i) ? 'video' : 'image',
                    url
                }))
            }));
            setIsCorrectionFormOpen(false);
        } catch (e) {
            alert("저장에 실패했습니다.");
        } finally {
            setIsSubmittingCorrection(false);
        }
    };

    const [newComment, setNewComment] = useState("");
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const [commentFile, setCommentFile] = useState<File | null>(null);
    const [commentPreviewUrl, setCommentPreviewUrl] = useState<string | null>(null);
    const commentFileRef = useRef<HTMLInputElement>(null);
    const carouselRef = useRef<HTMLDivElement>(null);
    const contentCarouselRef = useRef<HTMLDivElement>(null);
    const afterCarouselRef = useRef<HTMLDivElement>(null);
    const materialCarouselRef = useRef<HTMLDivElement>(null);

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

    const scrollAfterCarousel = (direction: "left" | "right") => {
        if (afterCarouselRef.current) {
            const scrollAmount = afterCarouselRef.current.clientWidth;
            afterCarouselRef.current.scrollBy({
                left: direction === "left" ? -scrollAmount : scrollAmount,
                behavior: "smooth"
            });
        }
    };

    const scrollMaterialCarousel = (direction: "left" | "right") => {
        if (materialCarouselRef.current) {
            const scrollAmount = materialCarouselRef.current.clientWidth;
            materialCarouselRef.current.scrollBy({
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
                            <PageTitle className="text-lg">레슨 상세</PageTitle>
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
                            <Badge variant="zinc" className="bg-zinc-800 text-white dark:bg-zinc-700">
                                {lesson.typeLabel}
                            </Badge>
                            <Caption className="flex items-center gap-1.5">
                                <Calendar size={14} />
                                {lesson.date} {lesson.time}
                            </Caption>
                        </div>
                    </div>

                    <SectionTitle>
                        {derivedTitle}
                    </SectionTitle>

                    <div className="flex items-center gap-4 pt-4 border-t border-zinc-100 dark:border-zinc-800/50">
                        <div className="flex items-center gap-2 flex-1">
                            <div className="w-8 h-8 rounded-full bg-brand-navy/10 flex items-center justify-center text-brand-navy dark:bg-brand-navy-light/20 dark:text-brand-navy-light">
                                <User size={16} />
                            </div>
                            <div>
                                <p className="text-[10px] text-zinc-500">작성자</p>
                                <p className="font-semibold text-zinc-900 dark:text-zinc-100">{lesson.writer}</p>
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



                {/* ── 2.5 감독 코멘트 ── */}
                {directorComment && (
                    <div className="space-y-4 pt-2">
                        <div className="flex items-center justify-between px-1">
                            <SectionTitle>
                                <FileText size={20} className="text-brand-navy" /> 감독 코멘트
                            </SectionTitle>
                            {currentUser?.role && ["admin", "manager"].includes(currentUser.role) && (
                                <button
                                    onClick={() => {
                                        setDirectorCommentInput(directorComment);
                                        setIsEditingDirectorComment(true);
                                        setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100);
                                    }}
                                    className="text-xs font-bold text-zinc-500 hover:text-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                    수정
                                </button>
                            )}
                        </div>

                        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm">
                            <BodyText className="whitespace-pre-line">
                                {directorComment}
                            </BodyText>
                        </section>
                    </div>
                )}

                {/* ── 2.2 부모 목표 내용 (Parent Goal / Connected Lesson) ── */}
                {lesson.parentGoalContent && (
                    <div className="space-y-4 pt-2">
                        <SectionTitle className="px-1">
                            <Flag size={20} className="text-brand-red" /> {lesson.isParentCoreLesson ? "핵심 레슨" : (lesson.isConnectedLesson ? "연결 레슨 내용" : "목표")}
                        </SectionTitle>
                        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm">
                            <BodyText className="whitespace-pre-line">
                                {lesson.parentGoalContent}
                            </BodyText>
                        </section>
                    </div>
                )}

                {/* ── 3. 교정전 (Before) ── */}
                {(lesson.media?.length > 0 || lesson.selectedImages?.length > 0) && (
                    <div className="space-y-4">
                        <SectionTitle className="px-1">
                            <CheckCircle2 size={20} className="text-zinc-400" /> 교정전
                        </SectionTitle>

                        {/* Before Media Gallery */}
                        {lesson.media && lesson.media.length > 0 && (
                            <section className="bg-transparent relative group">
                                <div
                                    ref={carouselRef}
                                    className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-2 scrollbar-hide"
                                >
                                    {lesson.media.map((item: any, idx: number) => (
                                        <div key={idx} className="shrink-0 w-full aspect-[2/3] sm:aspect-[4/3] snap-center rounded-3xl overflow-hidden shadow-sm relative border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 py-4 sm:py-8 px-2 sm:px-4 flex items-center justify-center">
                                            {item.type === "video" ? (
                                                <CustomVideoPlayer src={item.url} className="w-full h-full" />
                                            ) : (
                                                <img src={item.url} alt={`Before Media ${idx + 1}`} className="w-full h-full object-contain rounded-2xl" />
                                            )}
                                            {lesson.media.length > 1 && (
                                                <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full z-10 pointer-events-none">
                                                    {idx + 1} / {lesson.media.length}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {lesson.media.length > 1 && (
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

                        {/* Before Templates (Swing Errors) */}
                        {lesson.selectedImages && lesson.selectedImages.length > 0 && (
                            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-4">
                                <h4 className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 pb-2 border-b border-zinc-100 dark:border-zinc-800">스윙 오류</h4>
                                <div className="w-full sm:max-w-sm mx-auto aspect-[4/3] rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 relative group/content">
                                    <div ref={contentCarouselRef} className="flex overflow-x-auto snap-x snap-mandatory h-full scrollbar-hide">
                                        {lesson.selectedImages.map((img: { url: string; title: string }, idx: number) => (
                                            <div key={idx} className="shrink-0 w-full h-full snap-center relative">
                                                <img src={img.url} alt={img.title} className="w-full h-full object-cover" />
                                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8">
                                                    <p className="text-white text-xs font-bold truncate">{img.title}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {lesson.selectedImages.length > 1 && (
                                        <>
                                            <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded-full z-10">{lesson.selectedImages.length} images</div>
                                            <button onClick={() => scrollContentCarousel("left")} className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 bg-white/80 dark:bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover/content:opacity-100 transition-opacity"><ChevronLeft size={14} /></button>
                                            <button onClick={() => scrollContentCarousel("right")} className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 bg-white/80 dark:bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover/content:opacity-100 transition-opacity"><ChevronRight size={14} /></button>
                                        </>
                                    )}
                                </div>
                            </section>
                        )}
                    </div>
                )}

                {/* ── 4. 교정후 (After) ── */}
                {lesson.afterMedia?.length > 0 && (
                    <div className="space-y-4 pt-4">
                        <SectionTitle className="px-1">
                            <CheckCircle2 size={20} className="text-brand-navy dark:text-brand-navy-light" /> 교정후
                        </SectionTitle>

                        {/* After Media Gallery */}
                        {lesson.afterMedia && lesson.afterMedia.length > 0 && (
                            <section className="bg-transparent relative group">
                                <div
                                    ref={afterCarouselRef}
                                    className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-2 scrollbar-hide"
                                >
                                    {lesson.afterMedia.map((item: any, idx: number) => (
                                        <div key={idx} className="shrink-0 w-full aspect-[2/3] sm:aspect-[4/3] snap-center rounded-3xl overflow-hidden shadow-sm relative border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 py-4 sm:py-8 px-2 sm:px-4 flex items-center justify-center">
                                            {item.type === "video" ? (
                                                <CustomVideoPlayer src={item.url} className="w-full h-full" />
                                            ) : (
                                                <img src={item.url} alt={`After Media ${idx + 1}`} className="w-full h-full object-contain rounded-2xl" />
                                            )}
                                            {lesson.afterMedia.length > 1 && (
                                                <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full z-10 pointer-events-none">
                                                    {idx + 1} / {lesson.afterMedia.length}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {lesson.afterMedia.length > 1 && (
                                    <>
                                        <button onClick={() => scrollAfterCarousel("left")} className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 dark:bg-black/60 backdrop-blur-sm hover:bg-white dark:hover:bg-black text-zinc-800 dark:text-zinc-200 rounded-full items-center justify-center shadow-lg transition-all opacity-0 group-hover:opacity-100 z-10">
                                            <ChevronLeft size={24} />
                                        </button>
                                        <button onClick={() => scrollAfterCarousel("right")} className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 dark:bg-black/60 backdrop-blur-sm hover:bg-white dark:hover:bg-black text-zinc-800 dark:text-zinc-200 rounded-full items-center justify-center shadow-lg transition-all opacity-0 group-hover:opacity-100 z-10">
                                            <ChevronRight size={24} />
                                        </button>
                                    </>
                                )}
                            </section>
                        )}

                        {/* After Content */}
                        {lesson.afterContent && (
                            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-6">
                                <div className="space-y-3">
                                    <h4 className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 pb-2 border-b border-zinc-100 dark:border-zinc-800">레슨 내용</h4>
                                    <BodyText className="whitespace-pre-line">
                                        {lesson.afterContent}
                                    </BodyText>
                                </div>
                            </section>
                        )}
                    </div>
                )}

                {/* ── 5. 레슨 내용 ── */}
                {lesson.content && (
                    <div className="space-y-4">
                        <SectionTitle className="px-1">
                            <FileText size={20} className="text-emerald-500" /> 레슨 내용
                        </SectionTitle>
                        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm">
                            <BodyText className="whitespace-pre-line">
                                {lesson.content}
                            </BodyText>
                        </section>
                    </div>
                )}

                {/* ── 6. 레슨 자료 ── */}
                {lesson.materialMedia?.length > 0 && (
                    <div className="space-y-4 pt-4">
                        <SectionTitle className="px-1">
                            <FileText size={20} className="text-zinc-500" /> 레슨 자료
                        </SectionTitle>
                        <section className="bg-transparent relative group">
                            <div
                                ref={materialCarouselRef}
                                className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-2 scrollbar-hide"
                            >
                                {lesson.materialMedia.map((item: any, idx: number) => (
                                    <div key={`material-${idx}`} className="shrink-0 w-full aspect-[4/3] snap-center rounded-3xl overflow-hidden shadow-sm relative border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 py-4 sm:py-8 px-2 sm:px-4 flex items-center justify-center">
                                        {item.type === 'pdf' ? (
                                            <PDFViewer file={item.url} className="w-full h-full max-w-full" />
                                        ) : item.type === 'video' ? (
                                            <CustomVideoPlayer src={item.url} className="w-full h-full" hideCustomControls />
                                        ) : item.type === 'image' ? (
                                            <img src={item.url} alt="레슨 자료" className="w-full h-full object-contain rounded-2xl" />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center text-zinc-500 p-4">
                                                <FileText size={48} className="mb-2 opacity-50 text-brand-navy" />
                                                <span className="text-sm font-medium text-center truncate w-full px-4">{item.name}</span>
                                                <span className="text-[11px] opacity-70">문서 파일</span>
                                            </div>
                                        )}
                                        {lesson.materialMedia.length > 1 && (
                                            <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full z-10 pointer-events-none">
                                                {idx + 1} / {lesson.materialMedia.length}
                                            </div>
                                        )}
                                        <a
                                            href={item.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="absolute top-3 left-3 w-7 h-7 flex items-center justify-center bg-black/60 hover:bg-brand-navy text-white rounded-full transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 z-30"
                                            title="새 창에서 열기 / 다운로드"
                                        >
                                            <Upload size={14} className="rotate-180" />
                                        </a>
                                    </div>
                                ))}
                            </div>
                            {lesson.materialMedia.length > 1 && (
                                <>
                                    <button onClick={() => scrollMaterialCarousel("left")} className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 dark:bg-black/60 backdrop-blur-sm hover:bg-white dark:hover:bg-black text-zinc-800 dark:text-zinc-200 rounded-full items-center justify-center shadow-lg transition-all opacity-0 group-hover:opacity-100 z-10">
                                        <ChevronLeft size={24} />
                                    </button>
                                    <button onClick={() => scrollMaterialCarousel("right")} className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 dark:bg-black/60 backdrop-blur-sm hover:bg-white dark:hover:bg-black text-zinc-800 dark:text-zinc-200 rounded-full items-center justify-center shadow-lg transition-all opacity-0 group-hover:opacity-100 z-10">
                                        <ChevronRight size={24} />
                                    </button>
                                </>
                            )}
                        </section>
                    </div>
                )}

                {/* ── 5. Related Score Context ── */}
                {lesson.relatedScore && (
                    <section className="bg-gradient-to-br from-brand-navy/5 to-transparent dark:from-brand-navy/10 dark:to-transparent border border-brand-navy/20 dark:border-brand-navy/30 p-5 rounded-3xl shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-brand-navy/5 dark:bg-brand-navy-light/5 rounded-full blur-2xl"></div>
                        <SectionTitle className="text-sm text-brand-navy dark:text-brand-navy-light mb-4">
                            <Flag size={16} />
                            레슨 전 라운딩 요약
                        </SectionTitle>
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
                            <FileUploadButton iconOnly icon={<Paperclip size={18} />} accept="image/*,video/*" onChange={handleCommentFileChange} disabled={isSubmittingComment} />
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

                {/* ── 7. 감독 코멘트 작성 폼 (Bottom Accordion) ── */}
                {currentUser?.role && ["admin", "manager"].includes(currentUser.role) && (
                    <div className="mt-8 space-y-4">
                        {!isEditingDirectorComment ? (
                            <div className="flex justify-end">
                                <button
                                    onClick={() => {
                                        setDirectorCommentInput(directorComment);
                                        setIsEditingDirectorComment(true);
                                        setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 50);
                                    }}
                                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all bg-brand-navy text-white hover:bg-brand-navy/90 active:scale-95 whitespace-nowrap"
                                >
                                    {directorComment ? "감독 코멘트 수정" : "감독 코멘트 작성"}
                                </button>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-zinc-900 border border-brand-navy/30 dark:border-brand-navy/30 p-4 sm:p-6 rounded-3xl shadow-md space-y-4 animate-in slide-in-from-bottom-4 duration-300">
                                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                    <FileText size={20} className="text-brand-navy" /> {directorComment ? "감독 코멘트 수정" : "감독 코멘트 작성"}
                                </h3>
                                <textarea
                                    value={directorCommentInput}
                                    onChange={(e) => setDirectorCommentInput(e.target.value)}
                                    rows={4}
                                    className="w-full p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-navy/30 text-sm"
                                    placeholder="감독 코멘트를 입력하세요..."
                                />
                                <div className="flex justify-end gap-2">
                                    <button
                                        onClick={() => setIsEditingDirectorComment(false)}
                                        className="px-4 py-2 bg-zinc-100 text-zinc-600 rounded-xl text-sm font-bold hover:bg-zinc-200 transition-colors"
                                    >
                                        취소
                                    </button>
                                    <button
                                        onClick={handleSaveDirectorComment}
                                        className="px-4 py-2 bg-brand-navy text-white rounded-xl text-sm font-bold hover:bg-brand-navy/90 transition-colors"
                                    >
                                        저장
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}