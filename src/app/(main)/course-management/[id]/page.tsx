"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { 
    Flag, 
    ChevronLeft, 
    MoreVertical, 
    Calendar, 
    MessageSquare, 
    User, 
    Edit2, 
    Trash2, 
    X,
    Play,
    Send,
    Paperclip
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AthleteSearch } from "@/components/ui/AthleteSearch";
import { 
    CourseManagementRecord, 
    fetchCourseRecordById, 
    deleteCourseRecord, 
    COURSE_CAT_LABELS, 
    COURSE_CAT_COLORS 
} from "@/lib/course-management-sync";
import { fetchComments, saveComment, AnalysisComment } from "@/lib/analysis-sync";
import { cn, getYoutubeEmbedUrl } from "@/lib/utils";

export default function CourseManagementDetailPage() {
    const router = useRouter();
    const params = useParams();
    const { id } = params as { id: string };

    const [record, setRecord] = useState<CourseManagementRecord | null>(null);
    const [comments, setComments] = useState<AnalysisComment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Comment State
    const [newComment, setNewComment] = useState("");
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);

    // Send to Athletes State
    const [selectedAthletes, setSelectedAthletes] = useState<string[]>([]);
    const [sendToAll, setSendToAll] = useState(false);
    const [isSending, setIsSending] = useState(false);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            if (!id) return;
            setIsLoading(true);
            try {
                const [recordData, commentsData] = await Promise.all([
                    fetchCourseRecordById(id),
                    fetchComments(id)
                ]);
                setRecord(recordData);
                setComments(commentsData);

                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                
                if (user) {
                    const { data: dbUser } = await supabase
                        .from("users")
                        .select("role")
                        .eq("id", user.id)
                        .maybeSingle();
                        
                    setCurrentUser({ ...user, role: dbUser?.role });
                } else {
                    setCurrentUser(null);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [id]);

    const handleDelete = async () => {
        if (!confirm("정말 삭제하시겠습니까?")) return;
        try {
            await deleteCourseRecord(id);
            alert("삭제되었습니다.");
            router.push("/course-management");
        } catch (err) {
            alert("삭제에 실패했습니다.");
        }
    };

    const handleCommentSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!newComment.trim() || isSubmittingComment || !currentUser) return;

        try {
            setIsSubmittingComment(true);
            await saveComment({
                recordId: id,
                userId: currentUser.id,
                content: newComment.trim()
            });
            setNewComment("");
            const updated = await fetchComments(id);
            setComments(updated);
        } catch (err) {
            alert("댓글 등록에 실패했습니다.");
        } finally {
            setIsSubmittingComment(false);
        }
    };

    const handleSendToAthletes = async () => {
        if (selectedAthletes.length === 0) return;
        if (!confirm(`${selectedAthletes.length}명의 선수에게 이 골프IQ 내용을 전달하시겠습니까?`)) return;

        try {
            setIsSending(true);
            const supabase = createClient();
            
            // 1. Get user IDs from names
            const { data: users, error: userError } = await supabase
                .from("users")
                .select("id, name")
                .in("name", selectedAthletes);
                
            if (userError || !users) throw new Error("사용자 조회 실패");

            // 2. Prepare Todo Inserts
            const todayStr = new Date().toISOString().split('T')[0];
            const contentPreview = record?.content ? (record.content.length > 50 ? record.content.substring(0, 50) + '...' : record.content) : '';
            const inserts = users.map(u => ({
                user_id: u.id,
                assigner_id: currentUser?.id,
                title: `[골프IQ 전달] ${record?.title || '새 내용'}:::ID:::${id}`,
                content: `코치님이 골프IQ 내용을 공유했습니다.\n\n${contentPreview}`,
                due_date: todayStr,
                is_completed: false,
                priority: "medium"
            }));

            // 3. Insert Todos
            const { error: insertError } = await supabase
                .from("todos")
                .insert(inserts);

            if (insertError) throw insertError;

            alert("선수들의 To-Do 리스트에 성공적으로 추가되었습니다.");
            setSelectedAthletes([]);
        } catch (err) {
            console.error(err);
            alert("전달에 실패했습니다.");
        } finally {
            setIsSending(false);
        }
    };

    if (isLoading) return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-brand-navy/20 border-t-brand-navy rounded-full animate-spin"></div>
        </div>
    );

    if (!record) return (
        <div className="min-h-screen flex items-center justify-center text-zinc-500">
            게시물을 찾을 수 없습니다. (ID: {id})
        </div>
    );

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-24">
            {/* Header */}
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
                            <Flag size={18} className="text-brand-navy shrink-0" />
                            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                                골프IQ 상세
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
                            <div className="absolute right-0 mt-2 w-36 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg overflow-hidden z-50">
                                <button
                                    onClick={() => router.push(`/course-management/${id}/edit`)}
                                    className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2"
                                >
                                    <Edit2 size={16} /> 수정
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="w-full text-left px-4 py-3 text-sm font-medium text-brand-red hover:bg-brand-red/5 flex items-center gap-2 border-t border-zinc-100 dark:border-zinc-800"
                                >
                                    <Trash2 size={16} /> 삭제
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 sm:px-8 py-6 space-y-6">
                {/* 1. Core Info */}
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <span className={cn(
                            "text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider",
                            COURSE_CAT_COLORS[record.category].bg,
                            COURSE_CAT_COLORS[record.category].text
                        )}>
                            {COURSE_CAT_LABELS[record.category]}
                        </span>
                        <span className="text-sm font-medium text-zinc-400 flex items-center gap-1.5">
                            <Calendar size={14} />
                            {record.date.replace(/-/g, ".")}
                        </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {record.title.split(", ").map((kw, idx) => (
                            <span key={idx} className="px-3 py-1.5 rounded-xl bg-brand-navy/5 dark:bg-brand-navy/20 text-brand-navy dark:text-brand-navy-light text-base font-bold border border-brand-navy/10">
                                #{kw}
                            </span>
                        ))}
                    </div>

                    <div className="flex items-center gap-4 pt-4 border-t border-zinc-100 dark:border-zinc-800/50">
                        <div className="flex items-center gap-2 flex-1">
                            <div className="w-8 h-8 rounded-full bg-brand-navy/10 flex items-center justify-center text-brand-navy">
                                <User size={16} />
                            </div>
                            <div>
                                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">Coach</p>
                                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-none">{record.coachName}</p>
                            </div>
                        </div>
                        <div className="w-px h-8 bg-zinc-100 dark:bg-zinc-800"></div>
                        <div className="flex items-center gap-2 flex-1">
                            <div className="w-8 h-8 rounded-full bg-brand-navy/10 flex items-center justify-center text-brand-navy">
                                <User size={16} />
                            </div>
                            <div>
                                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">Player</p>
                                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-none">{record.playerName}</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 2. Hero Media */}
                {record.media_urls && record.media_urls.length > 0 && (
                    <section className="bg-black rounded-3xl overflow-hidden shadow-xl aspect-[4/5] sm:aspect-[4/3] border border-zinc-200 dark:border-zinc-800 relative group">
                        {record.media_urls[0].includes("youtube.com") || record.media_urls[0].includes("youtu.be") ? (
                            <iframe
                                src={getYoutubeEmbedUrl(record.media_urls[0]) || ""}
                                className="w-full h-full"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            />
                        ) : (
                            <video
                                src={record.media_urls[0]}
                                controls
                                className="w-full h-full object-contain"
                            />
                        )}
                    </section>
                )}

                {/* 3. Content */}
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm">
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Management Keyword</h3>
                    <div className="text-base text-zinc-700 dark:text-zinc-300 whitespace-pre-line leading-relaxed">
                        {record.content}
                    </div>
                </section>

                {/* 3.5 Send to Athletes (Coach/Admin only) */}
                {currentUser && (currentUser.role === 'coach' || currentUser.role === 'admin') && (
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Send size={18} className="text-brand-navy dark:text-brand-navy-light" />
                            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">선수에게 내용 전달 (To-Do 추가)</h3>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                            <div className="flex-1 w-full relative z-10">
                                <AthleteSearch
                                    multi={true}
                                    selectedNames={selectedAthletes}
                                    onSelect={(name) => setSelectedAthletes(prev => [...prev, name])}
                                    onRemove={(name) => setSelectedAthletes(prev => prev.filter(n => n !== name))}
                                    placeholder="전달할 선수를 검색하세요..."
                                />
                            </div>
                            <button
                                onClick={() => { setSendToAll(false); handleSendToAthletes(); }}
                                disabled={selectedAthletes.length === 0 || isSending}
                                className="w-full sm:w-auto bg-brand-navy hover:bg-brand-navy-dark text-white h-10 px-4 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0 flex items-center justify-center gap-2"
                            >
                                <Send size={16} />
                                {isSending ? "전달 중..." : "전달하기"}
                            </button>
                            <button
                                onClick={() => { setSendToAll(true); handleSendToAthletes(); }}
                                disabled={isSending}
                                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white h-10 px-4 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0 flex items-center justify-center gap-2"
                            >
                                전체 선수에게 전달
                            </button>
                        </div>
                    </section>
                )}

                {/* 4. Comments */}
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <MessageSquare size={16} className="text-zinc-400" />
                            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">댓글 ({comments.length})</h3>
                        </div>
                    </div>

                    <div className="divide-y divide-zinc-50 dark:divide-zinc-800">
                        {comments.map(c => (
                            <div key={c.id} className="px-6 py-4 space-y-1">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{c.author}</span>
                                        <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded uppercase tracking-tighter font-bold">{c.role}</span>
                                    </div>
                                    <span className="text-[10px] text-zinc-400">{c.time}</span>
                                </div>
                                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{c.text}</p>
                            </div>
                        ))}
                        {comments.length === 0 && (
                            <div className="py-12 text-center text-zinc-400 text-sm font-medium">아직 댓글이 없습니다.</div>
                        )}
                    </div>

                    <div className="p-4 bg-zinc-50/50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800">
                        <div className="relative">
                            <textarea
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="피드백이나 질문을 남겨보세요..."
                                rows={2}
                                className="w-full pl-4 pr-12 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all resize-none"
                            />
                            <button
                                onClick={handleCommentSubmit}
                                disabled={!newComment.trim() || isSubmittingComment}
                                className="absolute right-3 bottom-3 p-2 rounded-xl bg-brand-navy text-white disabled:opacity-30 transition-all hover:scale-105 active:scale-95"
                            >
                                <Send size={18} />
                            </button>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}
