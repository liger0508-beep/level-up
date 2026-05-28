const fs = require('fs');
const path = require('path');

function replaceInDetail(filePath) {
    const newContent = `"use client";
import { fetchComments, saveComment, updateComment, deleteComment, AnalysisComment } from "@/lib/analysis-sync";
import { MessageSquare, Paperclip, X, ChevronDown, ChevronUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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
    Megaphone,
    Map
} from "lucide-react";
import { getCourseInfoById, deleteCourseInfo, CourseInfo } from "@/lib/course-info-sync";
import { cn } from "@/lib/utils";

export default function CourseInfoDetailPage() {
    const router = useRouter();
    const params = useParams();
    const { id } = params;

    const [courseInfo, setCourseInfo] = useState<CourseInfo | null>(null);
    const [parsedContent, setParsedContent] = useState<any>(null);
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
    const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
    const commentFileRef = useRef<HTMLInputElement>(null);
    const [openHoles, setOpenHoles] = useState<Record<number, boolean>>({});

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
            getCourseInfoById(id as string).then(data => {
                if (data) {
                    setCourseInfo(data);
                    try {
                        setParsedContent(JSON.parse(data.content));
                    } catch (e) {
                        setParsedContent({ courseDescription: data.content, courseInput: "", holes: {} });
                    }
                }
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

    const toggleHole = (holeNum: number) => {
        setOpenHoles(prev => ({ ...prev, [holeNum]: !prev[holeNum] }));
    };

    const handleCommentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;
        setCommentFile(file);
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
                fileUrl = await uploadFile(commentFile, 'records', \`comments/\${id}\`);
                fileType = commentFile.type;
            }

            // Ensure a dummy record exists for foreign key constraint in comments table
            const { data: existingRecord } = await supabase.from("records").select("id").eq("id", id).maybeSingle();
            if (!existingRecord) {
                await supabase.from("records").insert({
                    id: id as string,
                    user_id: user.id,
                    coach_id: user.id,
                    type: "courseInfo",
                    category: "system",
                    title: "CourseInfo Record",
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
        if (window.confirm("코스 정보를 삭제하시겠습니까?")) {
            try {
                await deleteCourseInfo(id as string);
                alert("삭제되었습니다.");
                router.push("/course-info");
            } catch (err) {
                console.error(err);
                alert("삭제 중 오류가 발생했습니다.");
            }
        }
    };

    if (loading) return <div className="flex items-center justify-center min-h-screen">로딩 중...</div>;
    if (!courseInfo || !parsedContent) return <div className="flex items-center justify-center min-h-screen">코스 정보를 찾을 수 없습니다.</div>;

    const { courseDescription, courseInput, holes } = parsedContent;

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
                            <Map size={18} className="text-brand-navy dark:text-brand-navy-light shrink-0" />
                            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                                코스 정보 상세
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
                                    href={\`/course-info/\${id}/edit\`}
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
                {/* ── CourseInfo Info ── */}
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-5">
                    
                    <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-50 leading-tight">
                        {courseInfo.title}
                    </h2>
                    
                    {courseInput && (
                        <div className="inline-block bg-zinc-100 dark:bg-zinc-800 text-sm font-semibold text-zinc-700 dark:text-zinc-300 px-4 py-2 rounded-xl">
                            {courseInput}
                        </div>
                    )}

                    <div className="flex items-center gap-4 pt-5 border-t border-zinc-100 dark:border-zinc-800/50">
                        <div className="flex items-center gap-2 flex-1">
                            <div className="w-8 h-8 rounded-full bg-brand-navy/5 flex items-center justify-center text-brand-navy dark:bg-brand-navy-light/10 dark:text-brand-navy-light">
                                <User size={16} />
                            </div>
                            <div>
                                <p className="text-[10px] text-zinc-500 font-medium leading-none mb-1">작성자</p>
                                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-none">{courseInfo.author || "알 수 없음"}</p>
                            </div>
                        </div>
                        <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-800"></div>
                        <div className="flex items-center gap-2 flex-1">
                            <div className="w-8 h-8 rounded-full bg-brand-navy/5 flex items-center justify-center text-brand-navy dark:bg-brand-navy-light/10 dark:text-brand-navy-light">
                                <Calendar size={16} />
                            </div>
                            <div>
                                <p className="text-[10px] text-zinc-500 font-medium leading-none mb-1">작성일</p>
                                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-none">{courseInfo.date.replace(/-/g, ".")}</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── Content (Text) ── */}
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl shadow-sm min-h-[150px]">
                    <div className="whitespace-pre-wrap text-sm sm:text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
                        {courseDescription || "작성된 상세 내용이 없습니다."}
                    </div>
                </section>
                
                {/* ── Hole Information Accordion ── */}
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-4">
                    <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-200 mb-4">홀별 추가 정보</h3>
                    <div className="space-y-3">
                        {Array.from({ length: 18 }, (_, i) => i + 1).map((hole) => {
                            const hasInfo = !!holes[hole];
                            return (
                                <div key={hole} className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-zinc-50 dark:bg-zinc-800/50">
                                    <button
                                        type="button"
                                        onClick={() => toggleHole(hole)}
                                        className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span>{hole}번 홀</span>
                                            {hasInfo && (
                                                <span className="text-[10px] bg-brand-navy text-white px-2 py-0.5 rounded-full">정보 있음</span>
                                            )}
                                        </div>
                                        {openHoles[hole] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                    </button>
                                    {openHoles[hole] && (
                                        <div className="p-4 pt-0 border-t border-zinc-200 dark:border-zinc-800">
                                            <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                                                {holes[hole] || "등록된 추가 정보가 없습니다."}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
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

                <div className="flex justify-center pt-4">
                    <button
                        onClick={() => router.push("/course-info")}
                        className="px-8 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all active:scale-95"
                    >
                        목록으로 돌아가기
                    </button>
                </div>
            </main>
        </div>
    );
}
`;
    fs.writeFileSync(filePath, newContent, 'utf-8');
}

replaceInDetail(path.join(__dirname, 'src/app/(main)/course-info/[id]/page.tsx'));
console.log("Detail page rewritten.");
