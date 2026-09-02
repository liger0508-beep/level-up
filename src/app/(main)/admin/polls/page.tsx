"use client";

import { useState, useMemo, useEffect } from "react";
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
    const [recentVote, setRecentVote] = useState<Vote | null>(null);
    const [displayLimit, setDisplayLimit] = useState(20);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeFilter, setActiveFilter] = useState<VoteType | "all">("all");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [activePreset, setActivePreset] = useState<DatePresetType>("custom");
    const [userRole, setUserRole] = useState<string | null>(null);

    // Helper to map DB row to Vote object
    const mapPollRow = (dbPoll: any): Vote => ({
        id: dbPoll.id,
        type: dbPoll.type as VoteType,
        branch: dbPoll.branch,
        status: dbPoll.status as VoteStatus,
        title: dbPoll.title,
        description: dbPoll.description,
        options: dbPoll.options,
        startDate: dbPoll.start_date,
        endDate: dbPoll.end_date,
        author: dbPoll.users?.name || "알 수 없음",
        authorId: dbPoll.author_id,
        isImportant: dbPoll.is_important,
        isRecurring: dbPoll.is_recurring,
        totalParticipants: dbPoll.total_participants,
        createdAt: dbPoll.created_at
    });

    useEffect(() => {
        const loadInitial = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
                if (data) setUserRole(data.role);
            }

            // Fetch recent featured vote
            let { data: recentVoteData } = await supabase
                .from("polls")
                .select(`*, users!polls_author_id_fkey(name)`)
                .eq("is_important", true)
                .eq("status", "ongoing")
                .order("created_at", { ascending: false })
                .limit(1);

            if (!recentVoteData || recentVoteData.length === 0) {
                const { data: fallbackData } = await supabase
                    .from("polls")
                    .select(`*, users!polls_author_id_fkey(name)`)
                    .order("created_at", { ascending: false })
                    .limit(1);
                recentVoteData = fallbackData;
            }

            if (recentVoteData && recentVoteData.length > 0) {
                setRecentVote(mapPollRow(recentVoteData[0]));
            }
        };
        
        loadInitial();
    }, []);

    // Server-side Pagination & Filtering
    useEffect(() => {
        const fetchFilteredPolls = async () => {
            setLoading(true);
            const supabase = createClient();
            let query = supabase
                .from("polls")
                .select(`*, users!polls_author_id_fkey(name)`, { count: 'exact' });

            if (activeFilter !== "all") {
                query = query.ilike("type", `%${activeFilter}%`);
            }

            if (searchTerm) {
                // author search requires a different approach if using joined table, but simple title search:
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

            setTotalPollCount(count || 0);
            setPolls(data.map(mapPollRow));
            setLoading(false);
        };

        const debounceTimer = setTimeout(() => {
            fetchFilteredPolls();
        }, 300);

        return () => clearTimeout(debounceTimer);
    }, [activeFilter, searchTerm, startDate, endDate, displayLimit]);

    // Client side filtering is now replaced by server-side filtering

    // Calculate top 3 options for the featured card
    const top3Options = recentVote ? [...recentVote.options]
        .sort((a, b) => b.votes - a.votes)
        .slice(0, 3) : [];

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

            {/* ── Type Filters ── */}
            <div className="flex flex-nowrap gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                <button
                    onClick={() => setActiveFilter("all")}
                    className={cn(
                        "whitespace-nowrap shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all border",
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
                                "whitespace-nowrap shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all border",
                                activeFilter === key
                                    ? "bg-brand-navy text-white border-brand-navy shadow-md"
                                    : "bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:border-brand-navy/50"
                            )}
                        >
                            {label}
                        </button>
                    ))}
            </div>

            {/* ── Recently Vote (Featured) ── */}
            {recentVote && (
                <section className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                        <Clock size={16} className="text-zinc-500" />
                        <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-100">최근 투표 현황</h2>
                    </div>

                    <div
                        onClick={() => router.push(`/admin/polls/${recentVote.id}`)}
                        className="group relative bg-white dark:bg-zinc-900 rounded-2xl p-5 cursor-pointer active:scale-[0.99] transition-all border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md hover:border-brand-navy/30 flex flex-col md:flex-row gap-6 items-center"
                    >
                        <div className="flex-1 w-full space-y-3">
                            <div className="flex items-center gap-2">
                                {recentVote.type.split(',').map(t => {
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
                                {recentVote.branch.split(',').map(b => (
                                    <span key={b} className="text-[10px] font-bold px-2 py-0.5 rounded-sm flex items-center gap-1 bg-zinc-100 text-zinc-500">
                                        {b}
                                    </span>
                                ))}
                                {recentVote.isImportant && (
                                    <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-sm">
                                        중요
                                    </span>
                                )}
                                <span className={cn(
                                    "text-[10px] font-bold px-2 py-0.5 rounded-sm flex items-center gap-1",
                                    recentVote.status === "ongoing" ? "bg-emerald-50 text-emerald-600" : "bg-zinc-100 text-zinc-500"
                                )}>
                                    {recentVote.status === "ongoing" ? "진행 중" : "종료됨"}
                                </span>
                            </div>

                            <h3 className="text-lg font-bold text-zinc-900 dark:text-white leading-tight group-hover:text-brand-navy transition-colors">
                                {recentVote.title} <span className="text-zinc-500 font-medium">({recentVote.totalParticipants}명)</span>
                            </h3>

                            {/* Top 3 Results Preview (Compact) */}
                            <div className="space-y-2 mt-4">
                                {top3Options.map((opt, i) => {
                                    const percentage = Math.round((opt.votes / Math.max(recentVote.totalParticipants, 1)) * 100);
                                    return (
                                        <div key={opt.id} className="space-y-1">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="font-semibold text-zinc-600 dark:text-zinc-300 flex items-center gap-2">
                                                    <span className={cn(
                                                        "w-4 h-4 rounded-full flex items-center justify-center text-[9px] text-white font-bold",
                                                        i === 0 ? "bg-indigo-300" : i === 1 ? "bg-slate-300" : "bg-orange-200"
                                                    )}>{i + 1}</span>
                                                    <span className="truncate max-w-[150px] sm:max-w-xs">{opt.text}</span>
                                                </span>
                                            </div>
                                            <div className="relative h-5 w-full bg-zinc-100 dark:bg-zinc-800/80 rounded-full overflow-hidden flex items-center">
                                                <div
                                                    className={cn(
                                                        "absolute left-0 top-0 h-full rounded-full transition-all duration-1000",
                                                        i === 0 ? "bg-indigo-300" : i === 1 ? "bg-slate-300" : "bg-orange-200"
                                                    )}
                                                    style={{ width: `${percentage}%` }}
                                                />
                                                <span className="absolute right-3 z-10 font-bold text-zinc-700 dark:text-zinc-200 text-[10px]">
                                                    {opt.votes}표 ({percentage}%)
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="flex items-center justify-end gap-5 text-[11px] text-zinc-500 pt-3 border-t border-zinc-100 dark:border-zinc-800/50 mt-2 w-full">
                                <div className="flex items-center gap-1.5">
                                    <CalendarIcon size={12} />
                                    <span>{recentVote.startDate?.replace(/-/g, ".")} ~ {recentVote.endDate?.replace(/-/g, ".")}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <User size={12} />
                                    <span>{recentVote.author}</span>
                                </div>
                            </div>
                        </div>
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
                                                cardStyles.border
                                            )}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    {v.type.split(',').map(t => {
                                                        const styles = VOTE_TYPE_COLORS[t as VoteType] || VOTE_TYPE_COLORS['all'];
                                                        return (
                                                            <span key={t} className={cn("shrink-0 inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide", styles.bg, styles.text)}>
                                                                {VOTE_TYPE_LABELS[t as VoteType]}
                                                            </span>
                                                        );
                                                    })}
                                                    {v.branch.split(',').map(b => (
                                                        <span key={b} className="shrink-0 inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide bg-zinc-100 text-zinc-500">
                                                            {b}
                                                        </span>
                                                    ))}
                                                    {v.isImportant && (
                                                        <span className="text-[10px] font-bold text-red-500 border border-red-200 px-1.5 py-0.5 rounded bg-red-50">중요</span>
                                                    )}
                                                </div>
                                                <span className={cn(
                                                    "text-[10px] font-bold px-2 py-0.5 rounded-sm",
                                                    v.status === "ongoing" ? "bg-emerald-50 text-emerald-600" : "bg-zinc-100 text-zinc-500"
                                                )}>
                                                    {v.status === "ongoing" ? "진행 중" : "종료됨"}
                                                </span>
                                            </div>
                                            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3 truncate text-left">
                                                {v.title}
                                            </h3>
                                            <div className="flex items-center justify-end gap-2 text-zinc-400 dark:text-zinc-500">
                                                <span className="text-[11px] font-medium">{v.author}</span>
                                                <span className="text-[10px] opacity-30">|</span>
                                                <span className="text-[11px] font-medium">
                                                    마감: {v.endDate?.replace(/-/g, ".")}
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
                                            <th className="py-2.5 px-4 font-semibold text-center w-24">작성자</th>
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
                                                                    <span key={t} className={cn("inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide", styles.bg, styles.text)}>
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
                                                                <span className="shrink-0 text-[10px] font-bold text-red-500 border border-red-200 px-1.5 py-0.5 rounded bg-red-50">중요</span>
                                                            )}
                                                            <span className="text-zinc-700 dark:text-zinc-300 font-medium truncate max-w-sm">
                                                                {v.title}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3.5 px-4 text-center font-semibold text-zinc-600 dark:text-zinc-300">
                                                        {v.totalParticipants}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-center text-zinc-600 dark:text-zinc-400 truncate">
                                                        {v.author}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                                        <span className={cn(
                                                            "inline-flex items-center justify-center px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide",
                                                            v.status === "ongoing" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400"
                                                        )}>
                                                            {v.endDate?.replace(/-/g, ".")}
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
