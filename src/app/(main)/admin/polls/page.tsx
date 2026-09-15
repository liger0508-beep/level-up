"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
    Search,
    Calendar as CalendarIcon,
    ChevronRight,
    Plus,
    Filter,
    Clock,
    User,
    BarChart3,
    Trophy,
    Vote as VoteIcon,
    AlertCircle,
    CheckCircle2,
    SlidersHorizontal
} from "lucide-react";
import {
    getPolls,
    Vote,
    VoteType,
    VOTE_TYPE_LABELS,
    VOTE_TYPE_COLORS,
    VoteStatus
} from "@/lib/vote-sync";
import { cn } from "@/lib/utils";
import { DatePickerInput } from "@/components/ui/DatePickerInput";
import { DatePresets, DatePresetType } from "@/components/ui/DatePresets";
import { createClient } from "@/lib/supabase/client";

export default function VoteListPage() {
    const router = useRouter();
    const [polls, setPolls] = useState<Vote[]>([]);
    const [totalPollCount, setTotalPollCount] = useState(0);
    const [ongoingVotes, setOngoingVotes] = useState<Vote[]>([]);
    const [activeOngoingIndex, setActiveOngoingIndex] = useState(0);
    const ongoingScrollRef = useRef<HTMLDivElement>(null);
    const [displayLimit, setDisplayLimit] = useState(20);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeFilter, setActiveFilter] = useState<VoteType | "all">("all");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [activePreset, setActivePreset] = useState<DatePresetType>("custom");
    const [userRole, setUserRole] = useState<string | null>(null);
    const [userBranch, setUserBranch] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [userLoaded, setUserLoaded] = useState(false);

    // Helper removed, using formatPollFromDb from lib/vote-sync instead
    useEffect(() => {
        const loadInitial = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            let currentRole = null;
            let currentBranch = null;
            let currentUserId = null;

            if (user) {
                const { data } = await supabase.from("users").select("role, branch").eq("id", user.id).maybeSingle();
                if (data) {
                    currentRole = data.role;
                    currentBranch = data.branch;
                    currentUserId = user.id;
                    setUserRole(currentRole);
                    setUserBranch(currentBranch);
                    setUserId(currentUserId);
                }
            }
            setUserLoaded(true);

            const applyPermissions = (q: any) => {
                const isMasterBranch = currentBranch === '오피스' || currentBranch === '총괄';
                if (currentRole !== 'admin' && !isMasterBranch) {
                    const branchCond = `or(branch.ilike.*전체*,branch.ilike.*${currentBranch || ''}*)`;
                    let filterStr = branchCond;
                    
                    if (currentRole !== 'coach') {
                        const roleCond = `or(type.ilike.*all*,type.ilike.*${currentRole || ''}*)`;
                        filterStr = `and(${branchCond},${roleCond})`;
                    }
                    
                    if (currentUserId) {
                        filterStr = `${filterStr},author_id.eq.${currentUserId}`;
                    }
                    
                    return q.or(filterStr);
                }
                return q;
            };

            // Fetch ongoing votes
            let ongoingQuery = supabase
                .from("polls")
                .select(`*, users!polls_author_id_fkey(name)`)
                .eq("status", "ongoing")
                .order("created_at", { ascending: false })
                .limit(20);
            
            ongoingQuery = applyPermissions(ongoingQuery);
            let { data: ongoingVoteData } = await ongoingQuery;

            if (ongoingVoteData && ongoingVoteData.length > 0) {
                const { overrideWithTodayVotes, formatPollFromDb } = await import("@/lib/vote-sync");
                const formatted = ongoingVoteData.map(formatPollFromDb);
                const overridden = await overrideWithTodayVotes(formatted);
                const trulyOngoing = overridden.filter(p => p.status === "ongoing");
                setOngoingVotes(trulyOngoing.slice(0, 5));
            }
        };
        
        loadInitial();
    }, []);

    // Server-side Pagination & Filtering
    useEffect(() => {
        if (!userLoaded) return;

        const fetchFilteredPolls = async () => {
            setLoading(true);
            const supabase = createClient();
            let query = supabase
                .from("polls")
                .select(`*, users!polls_author_id_fkey(name)`, { count: 'exact' });

            const isMasterBranch = userBranch === '오피스' || userBranch === '총괄';
            if (userRole !== 'admin' && !isMasterBranch) {
                const branchFilter = `branch.ilike.%전체%,branch.ilike.%${userBranch || ''}%,author_id.eq.${userId || ''}`;
                query = query.or(branchFilter);
                
                if (userRole !== 'coach') {
                    const roleFilter = `type.ilike.%all%,type.ilike.%${userRole || ''}%,author_id.eq.${userId || ''}`;
                    query = query.or(roleFilter);
                }
            }

            if (activeFilter !== "all") {
                query = query.ilike("type", `%${activeFilter}%`);
            }

            if (searchTerm) {
                query = query.or(`title.ilike.%${searchTerm}%`);
            }

            if (startDate) query = query.gte("start_date", startDate);
            if (endDate) query = query.lte("end_date", endDate);

            query = query
                .order("created_at", { ascending: false })
                .limit(displayLimit);

            const { data, count, error } = await query;
            if (error || !data) {
                setLoading(false);
                return;
            }

            const { overrideWithTodayVotes, formatPollFromDb } = await import("@/lib/vote-sync");
            const formatted = data.map(formatPollFromDb);
            const overridden = await overrideWithTodayVotes(formatted);

            setTotalPollCount(count || 0);
            setPolls(overridden);
            setLoading(false);
        };

        const debounceTimer = setTimeout(() => {
            fetchFilteredPolls();
        }, 300);

        return () => clearTimeout(debounceTimer);
    }, [activeFilter, searchTerm, startDate, endDate, displayLimit, userLoaded, userRole, userBranch, userId]);

    // Client side filtering is now replaced by server-side filtering

    const todayStr = useMemo(() => {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }, []);



    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="w-8 h-8 border-4 border-brand-navy/20 border-t-brand-navy rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-8 max-w-4xl mx-auto">
            {/* ── Header ── */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <VoteIcon size={24} className="text-brand-navy dark:text-brand-navy-light shrink-0" />
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                        투표
                    </h1>
                </div>
                {(userRole === 'admin' || userRole === 'coach') && (
                    <button
                        onClick={() => router.push("/admin/polls/create")}
                        className="bg-brand-red hover:bg-brand-red-dark text-white px-5 py-2 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1.5 shrink-0"
                    >
                        <Plus size={18} />
                        작성
                    </button>
                )}
            </div>



            {/* ── Ongoing Votes Carousel ── */}
            {ongoingVotes.length > 0 && (
                <section className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                        <Clock size={16} className="text-zinc-500" />
                        <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-100">진행중 투표 현황</h2>
                    </div>

                    <div className="relative">
                        <div
                            ref={ongoingScrollRef}
                            className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                            onScroll={(e) => {
                                const scrollLeft = e.currentTarget.scrollLeft;
                                const width = e.currentTarget.clientWidth;
                                const index = Math.round(scrollLeft / width);
                                setActiveOngoingIndex(index);
                            }}
                        >
                            {ongoingVotes.map((vote) => {
                                const top3Options = [...vote.options].slice(0, 3);
                                const optionsSortedByVotes = [...vote.options].sort((a, b) => b.votes - a.votes);

                                return (
                                    <div
                                        key={vote.id}
                                        onClick={() => router.push(`/admin/polls/${vote.id}`)}
                                        className="w-full min-w-full snap-center shrink-0 group relative bg-white dark:bg-zinc-900 rounded-2xl p-5 cursor-pointer active:scale-[0.99] transition-all border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md hover:border-brand-navy/30 flex flex-col md:flex-row gap-6 items-center"
                                    >
                                        <div className="flex-1 w-full space-y-3">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={cn(
                                                    "text-[10px] font-bold px-2 py-0.5 rounded-sm flex items-center gap-1",
                                                    vote.status === "ongoing" ? "bg-emerald-50 text-emerald-600" : "bg-zinc-100 text-zinc-500"
                                                )}>
                                                    {vote.status === "ongoing" ? "진행 중" : "종료됨"}
                                                </span>
                                                {vote.isImportant && (
                                                    <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-sm">
                                                        중요
                                                    </span>
                                                )}
                                                {vote.branch.split(',').map(b => (
                                                    <span key={b} className="text-[10px] font-bold px-2 py-0.5 rounded-sm flex items-center gap-1 bg-zinc-100 text-zinc-500">
                                                        {b}
                                                    </span>
                                                ))}
                                                {vote.type.split(',').map(t => {
                                                    const styles = VOTE_TYPE_COLORS[t as VoteType] || VOTE_TYPE_COLORS['all'];
                                                    return (
                                                        <span key={t} className={cn(
                                                            "text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase flex items-center gap-1",
                                                            styles.bg,
                                                            styles.text
                                                        )}>
                                                            {VOTE_TYPE_LABELS[t as VoteType]}
                                                        </span>
                                                    );
                                                })}
                                            </div>

                                            <h3 className="text-lg font-bold text-zinc-900 dark:text-white leading-tight group-hover:text-brand-navy transition-colors">
                                                {vote.title} <span className="text-zinc-500 font-medium text-base">({vote.totalParticipants}명)</span>
                                            </h3>

                                            {/* Top 3 Results Preview (Compact) */}
                                            <div className="space-y-2 mt-4">
                                                {top3Options.map((opt, i) => {
                                                    const percentage = Math.round((opt.votes / Math.max(vote.totalParticipants, 1)) * 100);
                                                    const rank = optionsSortedByVotes.findIndex(o => o.id === opt.id);
                                                    return (
                                                        <div key={opt.id} className={cn(
                                                            "flex justify-between items-center text-sm py-2 px-3 rounded-xl border transition-colors",
                                                            rank === 0 ? "bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-800/30" : 
                                                            rank === 1 ? "bg-zinc-50/80 dark:bg-zinc-800/30 border-zinc-100 dark:border-zinc-800/50" : 
                                                            "bg-transparent border-transparent"
                                                        )}>
                                                            <span className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-2.5 truncate pr-2">
                                                                <span className={cn(
                                                                    "w-5 h-5 shrink-0 flex items-center justify-center rounded-full text-[10px] font-black",
                                                                    rank === 0 ? "bg-indigo-500 text-white shadow-sm" : 
                                                                    rank === 1 ? "bg-slate-400 text-white" : 
                                                                    "bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400"
                                                                )}>{i + 1}</span>
                                                                <span className={cn("truncate", rank === 0 && "text-indigo-900 dark:text-indigo-300 font-extrabold")}>{opt.text}</span>
                                                            </span>
                                                            <div className={cn(
                                                                "flex items-center justify-end gap-1 shrink-0 tabular-nums",
                                                                rank === 0 ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-600 dark:text-zinc-400"
                                                            )}>
                                                                <span className="font-black text-[13px] w-9 text-right">
                                                                    {opt.votes}표
                                                                </span>
                                                                <span className="opacity-70 font-semibold text-[11px] w-10 text-right whitespace-pre">
                                                                    ({percentage < 10 ? ' ' : ''}{percentage}%)
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            <div className="flex items-center justify-end gap-5 text-[11px] text-zinc-500 pt-3 border-t border-zinc-100 dark:border-zinc-800/50 mt-2 w-full">
                                                <div className="flex items-center gap-1.5">
                                                    <CalendarIcon size={12} />
                                                    <span>{vote.startDate?.replace(/-/g, ".")} ~ {vote.endDate?.replace(/-/g, ".")}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <User size={12} />
                                                    <span>{vote.author}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        
                        {ongoingVotes.length > 1 && (
                            <div className="flex justify-center gap-1.5 mt-3">
                                {ongoingVotes.map((_, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => {
                                            setActiveOngoingIndex(idx);
                                            if (ongoingScrollRef.current) {
                                                ongoingScrollRef.current.scrollTo({ left: ongoingScrollRef.current.clientWidth * idx, behavior: 'smooth' });
                                            }
                                        }}
                                        className={cn(
                                            "w-1.5 h-1.5 rounded-full transition-colors",
                                            activeOngoingIndex === idx ? "bg-zinc-400 dark:bg-zinc-500" : "bg-zinc-200 dark:bg-zinc-700"
                                        )}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* ── Search UI Box ── */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 mt-6 mb-6 shadow-sm space-y-3">
                {/* Date Line */}
                <div className="flex items-center gap-3">
                    <label className="w-16 shrink-0 text-center text-[13px] font-bold text-zinc-700 dark:text-zinc-300">
                        투표 일자
                    </label>
                    <div className="flex items-center gap-1 flex-1">
                        <div className="relative flex-1">
                            <DatePickerInput
                                value={startDate}
                                onChange={(e) => { setStartDate(e.target.value); setActivePreset("custom"); }}
                                className="w-full px-4 py-2 bg-transparent dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-brand-navy/20 cursor-pointer text-center"
                            />
                        </div>
                        <span className="text-zinc-400 text-xs">~</span>
                        <div className="relative flex-1">
                            <DatePickerInput
                                value={endDate}
                                onChange={(e) => { setEndDate(e.target.value); setActivePreset("custom"); }}
                                className="w-full px-4 py-2 bg-transparent dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-brand-navy/20 cursor-pointer text-center"
                            />
                        </div>
                    </div>
                </div>

                {/* Search Line */}
                <div className="flex items-center gap-3">
                    <label className="w-16 shrink-0 text-center text-[13px] font-bold text-zinc-700 dark:text-zinc-300">
                        투표 검색
                    </label>
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                        <input
                            type="text"
                            placeholder="작성자 또는 투표 제목 검색..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-transparent dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
                        />
                    </div>
                </div>
            </div>

            {/* ── Vote List section ── */}
            <section>
                <div className="flex items-center justify-between mb-4 px-1">
                    <div className="flex items-center gap-2">
                        <SlidersHorizontal size={18} className="text-brand-navy dark:text-brand-navy-light" />
                        <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-200">
                            조회 결과
                        </h2>
                        <span className="text-xs text-zinc-400 font-medium">
                            ({totalPollCount}건)
                        </span>
                    </div>

                    <DatePresets
                        activePreset={activePreset}
                        onPresetChange={(start, end, preset) => {
                            setStartDate(start);
                            setEndDate(end);
                            setActivePreset(preset);
                        }}
                    />
                </div>

                {/* ── Type Filters (Moved to Search Results) ── */}
                <div className="flex flex-nowrap gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide px-1">
                    <button
                        onClick={() => setActiveFilter("all")}
                        className={cn(
                            "whitespace-nowrap shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-all border",
                            activeFilter === "all"
                                ? "bg-brand-navy text-white border-brand-navy shadow-md"
                                : "bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:border-brand-navy/50"
                        )}
                    >
                        전체
                    </button>
                    {(Object.entries(VOTE_TYPE_LABELS) as [VoteType, string][])
                        .filter(([key]) => key !== "all")
                        .map(([key, label]) => (
                            <button
                                key={key}
                                onClick={() => setActiveFilter(key)}
                                className={cn(
                                    "whitespace-nowrap shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-all border",
                                    activeFilter === key
                                        ? "bg-brand-navy text-white border-brand-navy shadow-md"
                                        : "bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:border-brand-navy/50"
                                )}
                            >
                                {label}
                            </button>
                        ))}
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
                    {polls.length > 0 ? (
                        <>
                            {/* ── Mobile Card Grid ── */}
                            <div className="flex flex-col gap-2 md:hidden">
                                {polls.map((v) => {
                                    const primaryType = v.type.split(',')[0] as VoteType;
                                    const cardStyles = VOTE_TYPE_COLORS[primaryType] || VOTE_TYPE_COLORS['all'];
                                    return (
                                        <button
                                            key={v.id}
                                            onClick={() => router.push(`/admin/polls/${v.id}`)}
                                            className={cn(
                                                "w-full text-left bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-l-4 rounded-xl px-4 py-3.5 hover:shadow-sm active:scale-[0.99] transition-all",
                                                v.status === "ongoing" ? cardStyles.border : "border-l-zinc-300 dark:border-l-zinc-700"
                                            )}
                                        >
                                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                <span className={cn(
                                                    "text-[10px] font-bold px-2 py-0.5 rounded-sm",
                                                    v.status === "ongoing" ? "bg-emerald-50 text-emerald-600" : "bg-zinc-100 text-zinc-500"
                                                )}>
                                                    {v.status === "ongoing" ? "진행 중" : "종료됨"}
                                                </span>
                                                {v.isImportant && (
                                                    <span className={cn(
                                                        "text-[10px] font-bold px-1.5 py-0.5 rounded border",
                                                        v.status === "ongoing" ? "text-red-500 border-red-200 bg-red-50" : "text-zinc-500 border-zinc-200 bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                                                    )}>중요</span>
                                                )}
                                                {v.branch.split(',').map(b => (
                                                    <span key={b} className="shrink-0 inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide bg-zinc-100 text-zinc-500">
                                                        {b}
                                                    </span>
                                                ))}
                                                {v.type.split(',').map(t => {
                                                    const styles = VOTE_TYPE_COLORS[t as VoteType] || VOTE_TYPE_COLORS['all'];
                                                    return (
                                                        <span key={t} className={cn(
                                                            "shrink-0 inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide",
                                                            v.status === "ongoing" ? cn(styles.bg, styles.text) : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                                                        )}>
                                                            {VOTE_TYPE_LABELS[t as VoteType]}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3 truncate text-left">
                                                {v.title}
                                            </h3>
                                            <div className="flex items-center justify-end gap-2 text-zinc-400 dark:text-zinc-500">
                                                <span className="text-[11px] font-medium">{v.author}</span>
                                                <span className="text-[10px] opacity-30">|</span>
                                                <span className="text-[11px] font-medium">
                                                    마감: {v.endDate === todayStr && v.endTime ? v.endTime : v.endDate?.replace(/-/g, ".")}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* ── Desktop Table ── */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-zinc-50/50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700 text-left text-zinc-500 dark:text-zinc-400">
                                            <th className="py-2.5 px-4 font-semibold text-center w-16 whitespace-nowrap">번호</th>
                                            <th className="py-2.5 px-4 font-semibold text-center w-24">유형</th>
                                            <th className="py-2.5 px-4 font-semibold text-center w-24">지점</th>
                                            <th className="py-2.5 px-4 font-semibold text-center">제목</th>
                                            <th className="py-2.5 px-4 font-semibold text-center w-24">참여자</th>
                                            <th className="py-2.5 px-4 font-semibold text-center w-40 whitespace-nowrap">종료일</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {polls.map((v, idx) => {
                                            return (
                                                <tr
                                                    key={v.id}
                                                    onClick={() => router.push(`/admin/polls/${v.id}`)}
                                                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                                                >
                                                    <td className="py-3.5 px-4 text-center text-zinc-500 dark:text-zinc-500 whitespace-nowrap">
                                                        {totalPollCount - idx}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-center">
                                                        <div className="flex items-center justify-center gap-1 flex-wrap">
                                                            {v.type.split(',').map(t => {
                                                                const styles = VOTE_TYPE_COLORS[t as VoteType] || VOTE_TYPE_COLORS['all'];
                                                                return (
                                                                    <span key={t} className={cn(
                                                                        "inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide",
                                                                        v.status === "ongoing" ? cn(styles.bg, styles.text) : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                                                                    )}>
                                                                        {VOTE_TYPE_LABELS[t as VoteType]}
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    </td>
                                                    <td className="py-3.5 px-4 text-center">
                                                        <div className="flex items-center justify-center gap-1 flex-wrap">
                                                            {v.branch.split(',').map(b => (
                                                                <span key={b} className="inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                                                                    {b}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="py-3.5 px-4 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            {v.isImportant && (
                                                                <span className={cn(
                                                                    "shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border",
                                                                    v.status === "ongoing" ? "text-red-500 border-red-200 bg-red-50" : "text-zinc-500 border-zinc-200 bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                                                                )}>중요</span>
                                                            )}
                                                            <span className="text-zinc-700 dark:text-zinc-300 font-medium truncate max-w-sm">
                                                                {v.title}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3.5 px-4 text-center font-semibold text-zinc-600 dark:text-zinc-300">
                                                        {v.totalParticipants}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                                        <span className={cn(
                                                            "inline-flex items-center justify-center px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide",
                                                            v.status === "ongoing" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400"
                                                        )}>
                                                            {v.endDate === todayStr && v.endTime ? v.endTime : v.endDate?.replace(/-/g, ".")}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            
                            {totalPollCount > polls.length && (
                                <div className="mt-8 flex justify-center">
                                    <button
                                        onClick={() => setDisplayLimit(prev => prev + 20)}
                                        className="px-8 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all active:scale-95 shadow-sm"
                                    >
                                        더 보기 ({totalPollCount - polls.length}건 남음)
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
                            <VoteIcon size={40} className="mb-4 text-zinc-200" />
                            <p className="text-sm font-medium">조회된 투표가 없습니다.</p>
                        </div>
                    )}
                </div>
            </section >
        </div >
    );
}
