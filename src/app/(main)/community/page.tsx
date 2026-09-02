"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from 'next/link';
import {
    MessageSquare,
    Plus,
    Search,
    Calendar,
    ChevronLeft,
    ChevronRight,
    SlidersHorizontal,
    Megaphone,
    Vote as VoteIcon
} from "lucide-react";
import { Notice, NoticeType, getNotices, NOTICE_TYPE_LABELS, getPlainText, NOTICE_TYPE_COLORS } from "@/lib/notice-sync";
import { NoticeTable } from "@/components/notice/NoticeTable";
import { cn } from "@/lib/utils";
import { DatePickerInput } from "@/components/ui/DatePickerInput";
import { DatePresets, DatePresetType } from "@/components/ui/DatePresets";

import { createClient } from "@/lib/supabase/client";

import { PageTitle, SectionTitle, LabelText } from "@/components/ui/Typography";

export default function CommunityPage() {
    const [allNotices, setAllNotices] = useState<Notice[]>([]);
    const [recentNotices, setRecentNotices] = useState<Notice[]>([]);
    const [totalNoticeCount, setTotalNoticeCount] = useState(0);
    const [activeType, setActiveType] = useState<NoticeType>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [displayLimit, setDisplayLimit] = useState(20);
    const [activePreset, setActivePreset] = useState<DatePresetType>("custom");
    const [hasMounted, setHasMounted] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setHasMounted(true);
        const loadInitial = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
                if (data) setUserRole(data.role);
            }

            // Recent 3 notices (always top 3 globally)
            const { data: recentData } = await supabase
                .from("notices")
                .select(`*, users!notices_author_id_fkey (name)`)
                .neq("type", "course_info")
                .order("created_at", { ascending: false })
                .limit(3);
                
            if (recentData) {
                setRecentNotices(recentData.map(d => ({
                    id: d.id,
                    type: d.type as NoticeType,
                    branch: d.branch,
                    title: d.title,
                    content: d.content,
                    date: d.date,
                    author: d.users?.name || "알 수 없음",
                    authorId: d.author_id,
                    isImportant: d.is_important,
                    startDate: d.start_date,
                    endDate: d.end_date,
                })));
            }
        };

        loadInitial();

        try {
            const isFromDetail = sessionStorage.getItem("gla_community_keep_alive") === "true";
            if (isFromDetail) {
                const stored = sessionStorage.getItem("gla_community_filter");
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (parsed.activeType !== undefined) setActiveType(parsed.activeType);
                    if (parsed.searchQuery !== undefined) setSearchQuery(parsed.searchQuery);
                    if (parsed.startDate !== undefined) setStartDate(parsed.startDate);
                    if (parsed.endDate !== undefined) setEndDate(parsed.endDate);
                    if (parsed.activePreset !== undefined) setActivePreset(parsed.activePreset);
                }
                setTimeout(() => {
                    sessionStorage.removeItem("gla_community_keep_alive");
                }, 100);
            } else {
                sessionStorage.removeItem("gla_community_filter");
                sessionStorage.removeItem("gla_community_scroll");
            }
        } catch (e) {
            console.warn("Failed to restore community filter", e);
        }
    }, []);

    // Save filter state to sessionStorage whenever it changes
    useEffect(() => {
        try {
            sessionStorage.setItem("gla_community_filter", JSON.stringify({
                activeType,
                searchQuery,
                startDate,
                endDate,
                activePreset
            }));
        } catch (e) {
            console.warn("Failed to save community filter", e);
        }
    }, [activeType, searchQuery, startDate, endDate, activePreset]);

    useEffect(() => {
        if (typeof window !== "undefined" && allNotices.length > 0) {
            const savedScroll = sessionStorage.getItem("gla_community_scroll");
            if (savedScroll) {
                window.scrollTo(0, parseInt(savedScroll, 10));
                sessionStorage.removeItem("gla_community_scroll");
            }

            const handleScroll = () => {
                sessionStorage.setItem("gla_community_scroll", window.scrollY.toString());
            };
            window.addEventListener("scroll", handleScroll);
            return () => window.removeEventListener("scroll", handleScroll);
        }
    }, [allNotices.length]);

    // Server-side Pagination
    useEffect(() => {
        if (!hasMounted) return;

        const fetchFilteredNotices = async () => {
            const supabase = createClient();
            let query = supabase
                .from("notices")
                .select(`*, users!notices_author_id_fkey (name)`, { count: 'exact' })
                .neq("type", "course_info");

            if (activeType !== "all") {
                query = query.eq("type", activeType);
            }

            if (searchQuery) {
                query = query.or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`);
            }

            if (startDate) query = query.gte("date", startDate);
            if (endDate) query = query.lte("date", endDate);

            // Order by importance first, then date
            query = query
                .order("is_important", { ascending: false, nullsFirst: false })
                .order("created_at", { ascending: false })
                .limit(displayLimit);

            const { data, count, error } = await query;
            if (error || !data) return;

            setTotalNoticeCount(count || 0);
            
            setAllNotices(data.map(d => ({
                id: d.id,
                type: d.type as NoticeType,
                branch: d.branch,
                title: d.title,
                content: d.content,
                date: d.date,
                author: d.users?.name || "알 수 없음",
                authorId: d.author_id,
                isImportant: d.is_important,
                startDate: d.start_date,
                endDate: d.end_date,
            })));
        };

        const debounceTimer = setTimeout(() => {
            fetchFilteredNotices();
        }, 300); // 300ms debounce for search query

        return () => clearTimeout(debounceTimer);
    }, [hasMounted, activeType, searchQuery, startDate, endDate, displayLimit]);

    const scroll = (direction: "left" | "right") => {
        if (scrollRef.current) {
            const { current } = scrollRef;
            const scrollAmount = 300;
            current.scrollBy({
                left: direction === "left" ? -scrollAmount : scrollAmount,
                behavior: "smooth",
            });
        }
    };

    // Client side filtering is now replaced by server-side filtering

    return (
        <div className="p-4 sm:p-8 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <MessageSquare size={24} className="text-brand-navy dark:text-brand-navy-light shrink-0" />
                    <PageTitle>
                        공지사항
                    </PageTitle>
                </div>
                {(userRole === 'admin' || userRole === 'coach') && (
                    <Link
                        href="/community/create"
                        className="bg-brand-red hover:bg-brand-red-dark text-white px-5 py-2 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1.5 shrink-0"
                    >
                        <Plus size={18} />
                        작성
                    </Link>
                )}
            </div>

            {/* ── Notice Type Filters ── */}
            <div className="flex flex-nowrap gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                {(Object.entries(NOTICE_TYPE_LABELS) as [NoticeType, string][]).map(([key, label]) => {
                    const isActive = activeType === key;
                    return (
                        <button
                            key={key}
                            onClick={() => setActiveType(key)}
                            className={cn(
                                "whitespace-nowrap shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all border",
                                isActive
                                    ? "bg-brand-navy text-white border-brand-navy shadow-md"
                                    : "bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-brand-navy/50 hover:text-brand-navy dark:hover:text-white"
                            )}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>

            {/* ── Recent Notices (Top Carousel) ── */}
            <div className="mb-4">
                <div className="flex items-center justify-between mb-3 px-1">
                    <SectionTitle>
                        <Megaphone size={16} className="text-brand-navy dark:text-brand-navy-light" />
                        최근 게시물
                    </SectionTitle>
                </div>

                <div className="relative group/scroll">
                    <button
                        onClick={() => scroll("left")}
                        className="absolute left-[-20px] top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full shadow-lg flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-brand-navy dark:hover:text-brand-navy-light transition-all opacity-0 group-hover/scroll:opacity-100 hidden md:flex"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <button
                        onClick={() => scroll("right")}
                        className="absolute right-[-20px] top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full shadow-lg flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-brand-navy dark:hover:text-brand-navy-light transition-all opacity-0 group-hover/scroll:opacity-100 hidden md:flex"
                    >
                        <ChevronRight size={20} />
                    </button>

                    <div
                        ref={scrollRef}
                        className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide -mx-1 px-1"
                    >
                        {recentNotices.map((notice) => (
                            <Link
                                key={notice.id}
                                href={`/community/${notice.id}`}
                                onClick={() => sessionStorage.setItem("gla_community_keep_alive", "true")}
                                className={cn(
                                    "flex-shrink-0 w-64 md:w-72 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-l-4 p-4 rounded-2xl shadow-sm hover:border-brand-navy/50 hover:shadow-md transition-all active:scale-95 cursor-pointer group flex flex-col",
                                    NOTICE_TYPE_COLORS[notice.type]?.border || "border-l-brand-navy"
                                )}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className={cn(
                                        "text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider",
                                        NOTICE_TYPE_COLORS[notice.type].bg,
                                        NOTICE_TYPE_COLORS[notice.type].text
                                    )}>
                                        {NOTICE_TYPE_LABELS[notice.type]}
                                    </span>
                                    {notice.isImportant && (
                                        <span className="text-[10px] font-black text-brand-red ml-auto uppercase italic">Important</span>
                                    )}
                                </div>
                                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-brand-navy dark:group-hover:text-brand-navy-light transition-colors line-clamp-1 mb-3 text-[15px]">
                                    {notice.title}
                                </h3>
                                <div className="text-[11px] text-zinc-400 font-medium flex items-center justify-end gap-2 mt-auto pt-2 border-t border-zinc-50 dark:border-zinc-800/50">
                                    <span>{notice.author || "알 수 없음"}</span>
                                    <span className="opacity-30">|</span>
                                    <span>{notice.date.slice(5).replace(/-/g, ".")}</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Filter Bar ── */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 mb-6 shadow-sm">
                <div className="flex items-center gap-2">
                    <LabelText className="w-12 shrink-0 text-center">
                        일자
                    </LabelText>
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <DatePickerInput

                            value={startDate}
                            onClick={(e) => (e.target as any).showPicker?.()}
                            onChange={(e) => { setStartDate(e.target.value); setActivePreset("custom"); }}
                            className="flex-1 min-w-0 px-2 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-[13px] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all text-center cursor-pointer"
                        />
                        <span className="text-zinc-400 shrink-0 text-xs">~</span>
                        <DatePickerInput

                            value={endDate}
                            onClick={(e) => (e.target as any).showPicker?.()}
                            onChange={(e) => { setEndDate(e.target.value); setActivePreset("custom"); }}
                            className="flex-1 min-w-0 px-2 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-[13px] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all text-center cursor-pointer"
                        />
                    </div>
                    {(startDate || endDate) && (
                        <button
                            onClick={() => { setStartDate(""); setEndDate(""); }}
                            className="shrink-0 px-2 text-xs font-bold text-zinc-400 hover:text-zinc-600 transition-colors"
                        >
                            초기화
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2 mt-3">
                    <LabelText className="w-12 shrink-0 text-center">
                        검색
                    </LabelText>
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input
                            type="text"
                            placeholder="제목 또는 내용 검색..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all"
                        />
                    </div>
                </div>
            </div>

            {/* ── Notice List section ── */}
            <section>
                <div className="flex items-center justify-between mb-4 px-1">
                    <div className="flex items-center gap-2">
                        <SlidersHorizontal size={18} className="text-brand-navy dark:text-brand-navy-light" />
                        <SectionTitle>
                            조회 결과
                        </SectionTitle>
                        <span className="text-xs text-zinc-400 font-medium">
                            ({totalNoticeCount}건)
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
                    {allNotices.length > 0 ? (
                        <>
                            <NoticeTable notices={allNotices} />
                            {totalNoticeCount > allNotices.length && (
                                <div className="mt-8 flex justify-center">
                                    <button
                                        onClick={() => setDisplayLimit(prev => prev + 20)}
                                        className="px-8 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all active:scale-95 shadow-sm"
                                    >
                                        더 보기 ({totalNoticeCount - allNotices.length}건 남음)
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
                            <Megaphone size={40} className="mb-4 text-zinc-200" />
                            <p className="text-sm font-medium">검색 결과가 없습니다.</p>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
