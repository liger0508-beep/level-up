"use client";
import { fetchComments, saveComment, updateComment, deleteComment, AnalysisComment } from "@/lib/analysis-sync";
import { MessageSquare, Send, Paperclip, X } from "lucide-react";
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
    CheckCircle2,
    Vote as VoteIcon,
    BarChart3,
    Trophy,
    Clock,
    ChevronRight,
    Users,
    ClipboardList
} from "lucide-react";
import { 
    getPollById, 
    deletePoll, 
    castVote, 
    getUserVote,
    getPollVoters,
    getRecurringPollHistory,
    Vote,
    VoteType,
    VOTE_TYPE_LABELS, 
    VOTE_TYPE_COLORS 
} from "@/lib/vote-sync";
import { createClient } from "@/lib/supabase/client";
import { cn, getKstDateStr } from "@/lib/utils";

export default function PollDetailPage() {
    const router = useRouter();
    const params = useParams();
    const { id } = params as { id: string };

    const [vote, setVote] = useState<Vote | null>(null);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
    const [userVotedOptionIds, setUserVotedOptionIds] = useState<string[]>([]);
    const [voters, setVoters] = useState<{ optionId: string; userName: string }[]>([]);
    const [recurringHistory, setRecurringHistory] = useState<any[]>([]);
    const [selectedHistoryDate, setSelectedHistoryDate] = useState(() => {
        return getKstDateStr();
    });
    const [selectedHistoryOption, setSelectedHistoryOption] = useState<string>("all");
    const filterContainerRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [showVoterList, setShowVoterList] = useState(false);
    const [comments, setComments] = useState<AnalysisComment[]>([]);
    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
    const [editingCommentText, setEditingCommentText] = useState("");
    const [isUpdatingComment, setIsUpdatingComment] = useState(false);
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const [newComment, setNewComment] = useState("");
    const [commentFile, setCommentFile] = useState<File | null>(null);
    const [commentPreviewUrl, setCommentPreviewUrl] = useState<string | null>(null);
    const [currentUser, setCurrentUser] = useState<{ id: string; name: string; role?: string; branch?: string } | null>(null);
    const commentFileRef = useRef<HTMLInputElement>(null);


    
    useEffect(() => {
        if (id) {
            fetchComments(id as string).then(setComments);
        }

    }, [id]);

    useEffect(() => {

        fetchData();

        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [id]);

    useEffect(() => {
        checkScroll();
        window.addEventListener("resize", checkScroll);
        return () => window.removeEventListener("resize", checkScroll);
    }, [vote, selectedHistoryDate]);

    const checkScroll = () => {
        if (filterContainerRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = filterContainerRef.current;
            setCanScrollLeft(scrollLeft > 0);
            setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
        }
    };

    const scrollFilter = (direction: "left" | "right") => {
        if (filterContainerRef.current) {
            const scrollAmount = 200;
            filterContainerRef.current.scrollBy({
                left: direction === "left" ? -scrollAmount : scrollAmount,
                behavior: "smooth"
            });
        }
    };

    const fetchData = async () => {
        try {
            const data = await getPollById(id);
            if (data) {
                setVote(data);
                setShowResults(data.status === "closed");
                
                // Fetch voters
                const votersData = await getPollVoters(id);
                setVoters(votersData);
                
                if (data.isRecurring) {
                    const history = await getRecurringPollHistory(id);
                    setRecurringHistory(history);
                }
                
                // Get actual user first
                const supabase = createClient();
                const { data: userData } = await supabase.auth.getUser();
                const currentUserId = userData?.user?.id;

                if (currentUserId) {
                    setUserId(currentUserId);
                    // Fetch role and branch
                    const { data: profile } = await supabase.from("users").select("role, branch").eq("id", currentUserId).single();
                    if (profile) {
                        setCurrentUser(prev => prev ? { ...prev, role: profile.role, branch: profile.branch } : { id: currentUserId, name: userData?.user?.user_metadata?.name || 'User', role: profile.role, branch: profile.branch });
                    }
                    
                    // Check if user already voted
                    const votedOptions = await getUserVote(id, currentUserId);
                    setUserVotedOptionIds(votedOptions);
                    if (votedOptions.length > 0) {
                        setSelectedOptionIds(votedOptions);
                        setShowResults(true);
                    }
                }
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    
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
                    type: "poll",
                    category: "system",
                    title: "Poll Record",
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
        if (window.confirm("투표를 삭제하시겠습니까?")) {
            try {
                await deletePoll(id);
                alert("삭제되었습니다.");
                router.push("/admin/polls");
            } catch (error) {
                console.error(error);
                alert("삭제에 실패했습니다.");
            }
        }
    };

    const handleVoteSubmit = async () => {
        if (selectedOptionIds.length === 0 && userVotedOptionIds.length === 0) {
            alert("투표할 항목을 선택해주세요.");
            return;
        }

        if (selectedOptionIds.length === 0 && userVotedOptionIds.length > 0) {
            if (!confirm("참여한 투표를 취소하시겠습니까?")) {
                return;
            }
        }

        try {
            if (!userId) {
                alert("투표를 하려면 로그인이 필요합니다.");
                return;
            }
            setIsSubmitting(true);
            await castVote(id, selectedOptionIds, userId);
            alert("투표가 완료되었습니다.");
            await fetchData(); // Refresh data
        } catch (error: any) {
            console.error("Vote submission error:", error.message || error);
            if (error.message?.includes("unique constraint") || error.code === "23505") {
                alert("이미 이 투표에 참여하셨습니다.");
            } else {
                alert(`투표 처리에 실패했습니다: ${error.message || "다시 시도해 주세요"}`);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    // Removed individual toggleVoters function

    const handleDateChange = (days: number) => {
        const current = new Date(selectedHistoryDate);
        current.setDate(current.getDate() + days);
        setSelectedHistoryDate(getKstDateStr(current));
    };

    // Filter history based on UI selection
    const filteredHistory = recurringHistory.filter(item => {
        const matchesDate = item.voteDate === selectedHistoryDate;
        const matchesOption = selectedHistoryOption === "all" || item.optionId === selectedHistoryOption;
        return matchesDate && matchesOption;
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="w-8 h-8 border-4 border-brand-navy/20 border-t-brand-navy rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!vote) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen gap-4">
                <p className="text-zinc-500 font-medium">존재하지 않거나 삭제된 투표입니다.</p>
                <button onClick={() => router.push("/admin/polls")} className="px-6 py-2 bg-brand-navy text-white rounded-xl font-bold">목록으로</button>
            </div>
        );
    }

    const isPastEndDate = vote.endDate 
        ? new Date() > new Date(`${vote.endDate}T${vote.endTime || '23:59:59'}`) 
        : false;
    const isVotingActive = vote.status === "ongoing" && !isPastEndDate;

    // Keep options in original order without sorting
    const displayOptions = vote.options;
    const maxVotes = Math.max(...vote.options.map(o => o.votes), 0);

    const pollTypes = vote.type.split(',').map(t => t.trim());
    const isMasterBranch = currentUser?.role === 'office' || currentUser?.role === 'headquarter';
    const hasRolePermission = isMasterBranch || pollTypes.includes("all") || (currentUser?.role && pollTypes.includes(currentUser.role));
    
    const pollBranches = vote.branch.split(',').map(b => b.trim());
    const hasBranchPermission = isMasterBranch || pollBranches.includes("전체") || (currentUser?.branch && pollBranches.includes(currentUser.branch));
    
    const canVote = hasRolePermission && hasBranchPermission;

    const isAuthor = currentUser?.id && vote.authorId === currentUser.id;
    const isAdmin = currentUser?.role === "admin";
    const isCoach = currentUser?.role === "coach";
    const canEditOrDelete = isAuthor || isAdmin;
    
    // Admins, coaches, and office staff can always view results
    const canViewResults = canVote || canEditOrDelete || isCoach || isMasterBranch;

    if (!canViewResults) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-white dark:bg-zinc-950">
                <p className="text-zinc-500 font-medium">이 투표에 접근할 권한이 없습니다.</p>
                <button onClick={() => router.push("/")} className="px-6 py-2 bg-brand-navy text-white rounded-xl font-bold transition-transform active:scale-95">
                    돌아가기
                </button>
            </div>
        );
    }

    const canSeeRoster = currentUser?.role === 'super_admin' || currentUser?.role === 'superadmin' || currentUser?.role === 'admin' || currentUser?.role === 'coach' || currentUser?.role === 'headquarter' || currentUser?.role === 'office';
    const showRosterButton = vote?.status === "closed" && canSeeRoster;

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
                            <VoteIcon size={18} className="text-brand-navy dark:text-brand-navy-light shrink-0" />
                            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                                투표 상세
                            </h1>
                        </div>
                    </div>

                    {canEditOrDelete && (
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
                                        href={`/admin/polls/${id}/edit`}
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
                    )}
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 sm:px-8 py-6 space-y-6">
                {/* ── Vote Info Card ── */}
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {vote.type.split(',').map(t => {
                                const styles = VOTE_TYPE_COLORS[t as VoteType] || VOTE_TYPE_COLORS['all'];
                                return (
                                    <span key={t} className={cn(
                                        "text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider border",
                                        styles.bg,
                                        styles.text,
                                        styles.border
                                    )}>
                                        {VOTE_TYPE_LABELS[t as VoteType]}
                                    </span>
                                );
                            })}
                            {vote.branch.split(',').map(b => (
                                <span key={b} className="text-[10px] font-bold px-3 py-1 rounded-full border bg-zinc-100 text-zinc-500 border-zinc-200">
                                    {b}
                                </span>
                            ))}
                            {vote.isImportant && (
                                <span className="text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 px-2 py-1 rounded-full">
                                    중요
                                </span>
                            )}
                            <span className={cn(
                                "text-[10px] font-bold px-3 py-1 rounded-full border",
                                (!isVotingActive)
                                    ? "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800/50 dark:text-zinc-400 dark:border-zinc-700"
                                    : "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                            )}>
                                {!isVotingActive ? "종료됨" : "진행 중"}
                            </span>
                        </div>
                    </div>

                    <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-50 leading-tight">
                        {vote.title}
                    </h2>

                    <div className="flex items-center justify-between sm:justify-start gap-y-4 gap-x-2 sm:gap-x-6 pt-5 border-t border-zinc-100 dark:border-zinc-800/50 w-full overflow-hidden">
                        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
                            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-brand-navy/5 flex items-center justify-center text-brand-navy dark:bg-brand-navy-light/10 dark:text-brand-navy-light shrink-0">
                                <User className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] text-zinc-400 font-medium">작성자</p>
                                <p className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">{vote.author}</p>
                            </div>
                        </div>
                        <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-800 hidden sm:block shrink-0"></div>
                        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
                            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-brand-navy/5 flex items-center justify-center text-brand-navy dark:bg-brand-navy-light/10 dark:text-brand-navy-light shrink-0">
                                <Calendar className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] text-zinc-400 font-medium">투표 기간</p>
                                <p className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                    {vote.startDate.substring(5)} ~ {vote.endDate.substring(5)}
                                </p>
                            </div>
                        </div>
                        <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-800 hidden sm:block shrink-0"></div>
                        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
                            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-brand-navy/5 flex items-center justify-center text-brand-navy dark:bg-brand-navy-light/10 dark:text-brand-navy-light shrink-0">
                                <BarChart3 className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] text-zinc-400 font-medium">참여자</p>
                                <p className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">{vote.totalParticipants}명</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── Content (Description) ── */}
                {vote.description && vote.description.replace(/<[^>]*>/g, '').trim() !== "" && (
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl shadow-sm min-h-[100px] ql-snow">
                        <div 
                            className="ql-editor !p-0 text-zinc-700 dark:text-zinc-300"
                            dangerouslySetInnerHTML={{ __html: vote.description }}
                        />
                    </section>
                )}

                {/* ── Voting & Results ── */}
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-6">
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                {(() => {
                                    const now = new Date();
                                    const effectiveDate = new Date(now.getTime() - 6 * 60 * 60 * 1000);
                                    const mm = String(effectiveDate.getMonth() + 1).padStart(2, '0');
                                    const dd = String(effectiveDate.getDate()).padStart(2, '0');
                                    const prefix = vote.isRecurring ? `${mm}/${dd} ` : "";
                                    return prefix + (isVotingActive && !showResults && canVote ? "투표 항목" : "투표 결과");
                                })()}
                            </h3>
                        </div>
                        {(!isVotingActive || vote.status === "ongoing") && (
                            <div className="flex items-center gap-2">
                                {(showResults || !isVotingActive || !canVote) && (
                                    <button
                                        onClick={() => setShowVoterList(!showVoterList)}
                                        className="text-[12px] font-bold text-zinc-500 hover:text-brand-navy transition-colors px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-brand-navy/5 dark:hover:bg-brand-navy-light/10"
                                    >
                                        {showVoterList ? "명단 접기" : "명단보기"}
                                    </button>
                                )}
                                {canVote && isVotingActive && (
                                    <button
                                        onClick={() => setShowResults(!showResults)}
                                        className="text-[12px] font-bold text-zinc-500 hover:text-brand-navy transition-colors px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-brand-navy/5 dark:hover:bg-brand-navy-light/10"
                                    >
                                        {showResults ? "투표하기" : "결과보기"}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        {isVotingActive && !showResults && canVote ? (
                            // Ongoing: Voting Form
                            <>
                                {displayOptions.map((opt) => (
                                    <button
                                        key={opt.id}
                                        onClick={() => {
                                            if (vote.allowMultiple) {
                                                setSelectedOptionIds(prev => 
                                                    prev.includes(opt.id) ? prev.filter(id => id !== opt.id) : [...prev, opt.id]
                                                );
                                            } else {
                                                setSelectedOptionIds(prev => prev.includes(opt.id) ? [] : [opt.id]);
                                            }
                                        }}
                                        className={cn(
                                            "w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all active:scale-[0.99] text-left",
                                            selectedOptionIds.includes(opt.id)
                                                ? "border-brand-navy bg-brand-navy/5 dark:bg-brand-navy-light/5"
                                                : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                                        )}
                                    >
                                        <span className={cn(
                                            "font-semibold",
                                            selectedOptionIds.includes(opt.id) ? "text-brand-navy dark:text-brand-navy-light" : "text-zinc-700 dark:text-zinc-300"
                                        )}>
                                            {opt.text}
                                        </span>
                                        <div className={cn(
                                            "w-5 h-5 flex items-center justify-center shrink-0 transition-all",
                                            vote.allowMultiple ? "rounded" : "rounded-full",
                                            selectedOptionIds.includes(opt.id)
                                                ? "bg-brand-navy border-2 border-brand-navy"
                                                : "border-2 border-zinc-300 dark:border-zinc-600"
                                        )}>
                                            {selectedOptionIds.includes(opt.id) && <CheckCircle2 size={12} className="text-white" />}
                                        </div>
                                    </button>
                                ))}

                                <button
                                    onClick={handleVoteSubmit}
                                    disabled={
                                        isSubmitting || 
                                        (userVotedOptionIds.length === 0 && selectedOptionIds.length === 0) || 
                                        (selectedOptionIds.length === userVotedOptionIds.length &&
                                        selectedOptionIds.every(id => userVotedOptionIds.includes(id)) &&
                                        userVotedOptionIds.every(id => selectedOptionIds.includes(id)))
                                    }
                                    className="w-full mt-6 bg-brand-navy hover:bg-brand-navy-dark text-white disabled:bg-zinc-300 dark:disabled:bg-zinc-800 disabled:text-zinc-500 py-4 rounded-xl font-bold text-base transition-all active:scale-[0.99]"
                                >
                                    {isSubmitting ? "처리 중..." : (userVotedOptionIds.length > 0 ? (
                                        selectedOptionIds.length === userVotedOptionIds.length && selectedOptionIds.every(id => userVotedOptionIds.includes(id)) && userVotedOptionIds.every(id => selectedOptionIds.includes(id))
                                        ? "이미 참여하신 항목입니다" : (selectedOptionIds.length === 0 ? "투표 취소하기" : "투표 변경하기")
                                    ) : "투표하기")}
                                </button>
                            </>
                        ) : (
                            // Results View
                            <div className="space-y-5">
                                {displayOptions.map((opt, i) => {
                                    const percentage = Math.round((opt.votes / Math.max(vote.totalParticipants, 1)) * 100);
                                    const isTop = opt.votes > 0 && opt.votes === maxVotes;
                                    const isUserChoice = userVotedOptionIds.includes(opt.id);

                                    if (showVoterList) {
                                        return (
                                            <div key={opt.id} className="py-4 border-b border-zinc-100 dark:border-zinc-800 last:border-0 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                                        {opt.text}
                                                        <span className="text-xs font-medium text-zinc-400">({opt.votes}명)</span>
                                                    </h4>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {opt.votes > 0 ? (
                                                        voters
                                                            .filter(v => v.optionId === opt.id)
                                                            .map((v, j) => (
                                                                <span key={j} className="bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-lg text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                                                                    {v.userName}
                                                                </span>
                                                            ))
                                                    ) : (
                                                        <span className="text-xs text-zinc-300 dark:text-zinc-600">투표자 없음</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    }
                                    return (
                                        <div key={`${opt.id}_${i}`} className="space-y-2 group">
                                            <div className="flex justify-between items-end text-sm">
                                                <div className="flex items-center gap-2">
                                                    {isTop && <Trophy size={16} className="text-amber-500 mb-0.5" />}
                                                    <span className={cn(
                                                        "font-bold flex items-center gap-2",
                                                        isTop ? "text-brand-navy dark:text-brand-navy-light" : "text-zinc-700 dark:text-zinc-300"
                                                    )}>
                                                        {opt.text}
                                                        {isUserChoice && <span className="text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded ml-1">나의 선택</span>}
                                                    </span>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span className={cn(
                                                        "font-black text-lg",
                                                        isTop ? "text-brand-navy dark:text-brand-navy-light" : "text-zinc-900 dark:text-zinc-100"
                                                    )}>
                                                        {opt.votes}명 <span className="text-sm text-zinc-500 font-semibold tracking-normal">({percentage}%)</span>
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="h-3 md:h-4 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden shadow-inner">
                                                <div
                                                    className={cn(
                                                        "h-full rounded-full transition-all duration-1000",
                                                        isTop
                                                            ? "bg-gradient-to-r from-brand-navy to-blue-500 dark:from-brand-navy-dark dark:to-brand-navy-light"
                                                            : "bg-zinc-400 dark:bg-zinc-600 group-hover:bg-zinc-500 dark:group-hover:bg-zinc-500"
                                                    )}
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </section>

                {/* ── Final Roster ── */}
                {vote.finalRoster && canSeeRoster && (
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-6 animate-in fade-in slide-in-from-bottom-4">
                        <div className="flex items-center gap-2 px-1">
                            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                <Users size={18} className="text-brand-navy" /> 최종 명단
                            </h3>
                        </div>
                        <div className="space-y-6">
                            {Object.entries(vote.finalRoster.groupedData || {}).map(([optionText, items]: [string, any]) => (
                                <div key={optionText} className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm">
                                    <div className="bg-zinc-100 dark:bg-zinc-800 px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
                                        <h4 className="font-bold text-zinc-800 dark:text-zinc-100">{optionText} 명단 ({items.length}명)</h4>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-center min-w-[360px] border-collapse bg-white dark:bg-zinc-900">
                                            <thead className="text-zinc-500 font-bold border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30">
                                                <tr>
                                                    <th className="py-2.5 px-2 border border-zinc-200 dark:border-zinc-700 w-12">NO</th>
                                                    <th className="py-2.5 px-2 border border-zinc-200 dark:border-zinc-700 w-24">구분</th>
                                                    <th className="py-2.5 px-2 border border-zinc-200 dark:border-zinc-700 w-28">선수명</th>
                                                    <th className="py-2.5 px-2 border border-zinc-200 dark:border-zinc-700">연락처</th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-zinc-800 dark:text-zinc-200 font-medium">
                                                {items.map((item: any, idx: number) => (
                                                    <tr key={idx}>
                                                        <td className="py-2 px-2 border border-zinc-200 dark:border-zinc-700 text-orange-600 dark:text-orange-400 font-bold bg-orange-50/30 dark:bg-orange-900/10">{item.no}</td>
                                                        <td className="py-2 px-2 border border-zinc-200 dark:border-zinc-700">{item.category}</td>
                                                        <td className="py-2 px-2 border border-zinc-200 dark:border-zinc-700">{item.userName}</td>
                                                        <td className="py-2 px-2 border border-zinc-200 dark:border-zinc-700">{item.phone}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}



                
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
                                        {(currentUser?.id === c.userId || currentUser?.role === 'super_admin') && (
                                            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
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
                <div className={`flex ${showRosterButton ? 'justify-between' : 'justify-center'} items-center pt-4`}>
                    <button
                        onClick={() => router.push("/admin/polls")}
                        className="px-8 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all active:scale-95"
                    >
                        목록으로 돌아가기
                    </button>
                    {showRosterButton && (
                        <button
                            onClick={() => router.push(`/admin/polls/${id}/roster`)}
                            className="px-8 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-sm font-bold bg-brand-navy hover:bg-brand-navy-light text-white transition-all active:scale-95 flex items-center gap-2"
                        >
                            <ClipboardList size={18} /> 명단 정리하기
                        </button>
                    )}
                </div>
            </main>
            <style jsx global>{`
                .ql-editor p:empty {
                    min-height: 1.6em;
                    display: block;
                }
            `}</style>
        </div>
    );
}
