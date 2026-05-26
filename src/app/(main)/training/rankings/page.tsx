"use client";

export const dynamic = "force-dynamic";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Trophy, Medal, Crown, Star, Calendar, Target, Flag, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DatePickerInput } from "@/components/ui/DatePickerInput";
import { TestData, TestType, TestRecord } from "@/lib/test-sync";
import { cn, formatScore } from "@/lib/utils";

type RankingPeriod = "daily" | "weekly" | "monthly";
type RankingCategory = "overall" | "shot" | "around_green" | "putting";

function RankingsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialCategory = (searchParams.get("category") as RankingCategory) || "overall";
    const initialPeriod = (searchParams.get("period") as RankingPeriod) || "monthly";

    const [allTests, setAllTests] = useState<TestData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activePeriod, setActivePeriod] = useState<RankingPeriod>(initialPeriod);
    const [activeCategory, setActiveCategory] = useState<RankingCategory>(initialCategory);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [lastUpdated, setLastUpdated] = useState<string>("");

    // Sync state with URL params if they change
    useEffect(() => {
        const cat = searchParams.get("category") as RankingCategory;
        const per = searchParams.get("period") as RankingPeriod;
        if (cat && ["overall", "shot", "around_green", "putting"].includes(cat)) {
            setActiveCategory(cat);
        }
        if (per && ["daily", "weekly", "monthly"].includes(per)) {
            setActivePeriod(per);
        }
    }, [searchParams]);

    useEffect(() => {
        setLastUpdated(new Date().toLocaleTimeString());
        
        const loadInitialData = async () => {
            try {
                setIsLoading(true);
                const supabase = createClient();
                
                const { data } = await supabase
                    .from("records")
                    .select("*, users:users!records_user_id_fkey(name)")
                    .eq("type", "test")
                    .order("created_at", { ascending: false });
                
                if (data) {
                    const mapped: TestData[] = data.map((r: any) => {
                        let totalScore = 0;
                        const c = typeof r.content === 'string' ? JSON.parse(r.content) : (r.content || {});

                        // Use the new score column primarily, fallback to content.totalScore
                        if (r.score !== undefined && r.score !== null) {
                            totalScore = Number(r.score);
                        } else {
                            const possibleFields = [
                                c.totalScore, c.total_score, c.score, c.totalPoints, c.points
                            ];
                            const found = possibleFields.find(v => v !== undefined && v !== null && !isNaN(Number(v)));
                            
                            if (found !== undefined) {
                                totalScore = Number(found);
                            } else if (c.driver || c.iron) {
                                totalScore = (Number(c.driver?.score) || 0) + (Number(c.iron?.score) || 0);
                            } else if (c.approach || c.bunker) {
                                totalScore = (Number(c.approach?.score) || 0) + (Number(c.bunker?.score) || 0);
                            }
                        }

                        return {
                            id: r.id,
                            type: r.category as TestType,
                            playerName: r.users?.name || "Unknown",
                            title: r.title || "",
                            coachName: "",
                            comment: "",
                            date: r.created_at.split('T')[0],
                            totalScore: totalScore,
                            content: c
                        };
                    });
                    setAllTests(mapped);
                }
            } catch (err) {
                console.error("Error loading rankings:", err);
            } finally {
                setIsLoading(false);
            }
        };

        loadInitialData();
    }, []);

    const filteredRankings = useMemo(() => {
        const now = new Date();
        let effectiveStartDate = new Date(0);
        let effectiveEndDate = new Date(8640000000000000); // Max date

        if (startDate || endDate) {
            if (startDate) effectiveStartDate = new Date(startDate);
            if (endDate) {
                effectiveEndDate = new Date(endDate);
                effectiveEndDate.setHours(23, 59, 59, 999);
            }
        } else {
            if (activePeriod === "daily") {
                effectiveStartDate = new Date();
                effectiveStartDate.setHours(0, 0, 0, 0);
            } else if (activePeriod === "weekly") {
                effectiveStartDate = new Date(now);
                effectiveStartDate.setDate(now.getDate() - now.getDay());
                effectiveStartDate.setHours(0, 0, 0, 0);
            } else if (activePeriod === "monthly") {
                effectiveStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
                effectiveStartDate.setHours(0, 0, 0, 0);
            }
        }

        const periodTests = allTests.filter(t => {
            const testDate = new Date(t.date);
            const dateMatch = testDate >= effectiveStartDate && testDate <= effectiveEndDate;
            const nameMatch = !searchQuery || t.playerName.toLowerCase().includes(searchQuery.toLowerCase());
            return dateMatch && nameMatch;
        });

        if (activeCategory === "overall") {
            // Group 1: shot (combined or separate driver/iron)
            // Group 2: around_green (combined or separate approach/bunker)
            // Group 3: putting (sum of best long, middle, and short)
            const playerStats: Record<string, { name: string, lastDate: string, scores: Record<string, number> }> = {};
            
            periodTests.forEach(t => {
                const pName = t.playerName;
                if (!playerStats[pName]) playerStats[pName] = { name: pName, lastDate: t.date, scores: {} };
                
                if (new Date(t.date) > new Date(playerStats[pName].lastDate)) {
                    playerStats[pName].lastDate = t.date;
                }

                // Group 1: Shot
                if (t.type === "shot" || t.type === "driver" || t.type === "iron") {
                    playerStats[pName].scores["shot"] = Math.min(playerStats[pName].scores["shot"] ?? 999, t.totalScore ?? 0);
                } 
                // Group 2: Around Green
                else if (t.type === "around_green" || t.type === "approach" || t.type === "bunker") {
                    playerStats[pName].scores["around_green"] = Math.min(playerStats[pName].scores["around_green"] ?? 999, t.totalScore ?? 0);
                } 
                // Group 3: Putting (Legacy separate or new combined)
                else if (t.type === "long_putt") {
                    playerStats[pName].scores["long_putt"] = Math.min(playerStats[pName].scores["long_putt"] ?? 999, t.totalScore ?? 0);
                } else if (t.type === "middle_putt") {
                    playerStats[pName].scores["middle_putt"] = Math.min(playerStats[pName].scores["middle_putt"] ?? 999, t.totalScore ?? 0);
                } else if (t.type === "short_putt") {
                    playerStats[pName].scores["short_putt"] = Math.min(playerStats[pName].scores["short_putt"] ?? 999, t.totalScore ?? 0);
                } else if (t.type === "putting") {
                    const c = t.content || {};
                    if (c.long?.score !== undefined) {
                        playerStats[pName].scores["long_putt"] = Math.min(playerStats[pName].scores["long_putt"] ?? 999, Number(c.long.score));
                    }
                    if (c.middle?.score !== undefined) {
                        playerStats[pName].scores["middle_putt"] = Math.min(playerStats[pName].scores["middle_putt"] ?? 999, Number(c.middle.score));
                    }
                    if (c.short?.score !== undefined) {
                        playerStats[pName].scores["short_putt"] = Math.min(playerStats[pName].scores["short_putt"] ?? 999, Number(c.short.score));
                    }
                }
            });

            return Object.values(playerStats)
                .filter(stat => {
                    // Check if all required categories exist
                    const required = ["shot", "around_green", "long_putt", "middle_putt", "short_putt"];
                    return required.every(cat => stat.scores[cat] !== undefined && stat.scores[cat] !== 999);
                })
                .map(stat => ({
                    id: stat.name,
                    playerName: stat.name,
                    date: stat.lastDate,
                    // Overall = Shot + AroundGreen + LongPutt + MiddlePutt + ShortPutt
                    totalScore: Object.values(stat.scores).reduce((sum, s) => sum + (s === 999 ? 0 : s), 0),
                    type: "shot" as TestType
                })).sort((a, b) => a.totalScore - b.totalScore);
        }

        const catTests = periodTests.filter(t => {
            if (activeCategory === "shot") return t.type === "shot" || t.type === "driver" || t.type === "iron";
            if (activeCategory === "around_green") return t.type === "around_green" || t.type === "approach" || t.type === "bunker";
            if (activeCategory === "putting") return t.type === "putting" || t.type === "long_putt" || t.type === "middle_putt" || t.type === "short_putt";
            return false;
        });

        const ranked = catTests
            .filter(t => t.totalScore !== undefined && t.totalScore !== null)
            .sort((a, b) => (a.totalScore || 0) - (b.totalScore || 0));

        const uniquePlayers: Record<string, TestData> = {};
        ranked.forEach(t => {
            if (!uniquePlayers[t.playerName] || (t.totalScore || 0) < (uniquePlayers[t.playerName].totalScore || 0)) {
                uniquePlayers[t.playerName] = t;
            }
        });

        return Object.values(uniquePlayers).sort((a, b) => (a.totalScore || 0) - (b.totalScore || 0));
    }, [allTests, activePeriod, activeCategory]);

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-50">
            <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-50">
                <div className="max-w-xl mx-auto px-4 h-16 flex items-center gap-4">
                    <button 
                        onClick={() => router.back()}
                        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all active:scale-95"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <h1 className="text-xl font-black italic tracking-tight uppercase">Rankings</h1>
                </div>
            </div>

            <div className="max-w-xl mx-auto p-4 space-y-6">
                <div className="flex bg-white dark:bg-zinc-900 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    {(["daily", "weekly", "monthly"] as const).map((p) => (
                        <button
                            key={p}
                            onClick={() => setActivePeriod(p)}
                            className={cn(
                                "flex-1 py-2.5 rounded-xl text-[13px] font-black uppercase tracking-widest transition-all",
                                activePeriod === p
                                    ? "bg-brand-navy text-white shadow-md"
                                    : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                            )}
                        >
                            {p === "daily" ? "일간" : p === "weekly" ? "주간" : "월간"}
                        </button>
                    ))}
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {[
                        { key: "overall", label: "종합", icon: <Star size={14} /> },
                        { key: "shot", label: "샷", icon: <Target size={14} /> },
                        { key: "around_green", label: "그린 주변", icon: <Flag size={14} /> },
                        { key: "putting", label: "퍼팅", icon: <Crown size={14} /> }
                    ].map((cat) => (
                        <button
                            key={cat.key}
                            onClick={() => setActiveCategory(cat.key as any)}
                            className={cn(
                                "flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold border transition-all whitespace-nowrap shadow-sm",
                                activeCategory === cat.key
                                    ? "bg-white dark:bg-zinc-800 border-brand-navy text-brand-navy ring-1 ring-brand-navy/20"
                                    : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-300"
                            )}
                        >
                            {cat.icon}
                            {cat.label}
                        </button>
                    ))}
                </div>

                {/* ── Filter & Search Section ── */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
                    <div className="space-y-4">
                        {/* Date range */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <label className="w-20 shrink-0 text-sm font-bold text-zinc-500 dark:text-zinc-400">
                                챌린지 일자
                            </label>
                            <div className="flex items-center gap-2 flex-1">
                                <DatePickerInput
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="flex-1 px-4 py-2.5 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm text-center focus:ring-2 focus:ring-brand-navy/20 outline-none transition-all"
                                />
                                <span className="text-zinc-300">~</span>
                                <DatePickerInput
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="flex-1 px-4 py-2.5 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm text-center focus:ring-2 focus:ring-brand-navy/20 outline-none transition-all"
                                />
                            </div>
                        </div>

                        {/* Player search */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <label className="w-20 shrink-0 text-sm font-bold text-zinc-500 dark:text-zinc-400">
                                선수 검색
                            </label>
                            <div className="relative flex-1">
                                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" />
                                <input
                                    type="text"
                                    placeholder="선수 이름을 입력하세요..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm placeholder:text-zinc-300 focus:ring-2 focus:ring-brand-navy/20 outline-none transition-all"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between px-2 text-zinc-400">
                    <span className="text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                        <div className="w-1 h-1 bg-brand-navy rounded-full" />
                        조회 결과 ({filteredRankings.length}건)
                    </span>
                    <span className="text-[10px] font-medium italic">
                        Last updated: {lastUpdated}
                    </span>
                </div>

                <div className="space-y-4">
                    {isLoading ? (
                        <div className="py-20 flex flex-col items-center justify-center gap-3">
                            <div className="w-10 h-10 border-4 border-zinc-200 border-t-brand-navy rounded-full animate-spin"></div>
                            <p className="text-sm text-zinc-400 font-bold tracking-tight">데이터 동기화 중...</p>
                        </div>
                    ) : filteredRankings.length > 0 ? (
                        filteredRankings.map((t, idx) => {
                            const isTop3 = idx < 3;
                            return (
                                <div 
                                    key={t.id}
                                    className={cn(
                                        "group relative flex items-center justify-between p-6 rounded-[2.5rem] border transition-all duration-300",
                                        idx === 0 ? "bg-white dark:bg-zinc-900 border-amber-200 dark:border-amber-900/40 shadow-xl shadow-amber-500/10 scale-[1.02] z-10" :
                                        idx === 1 ? "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-lg" :
                                        idx === 2 ? "bg-white dark:bg-zinc-900 border-orange-200 dark:border-orange-900/40 shadow-md" :
                                        "bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 opacity-90 hover:opacity-100"
                                    )}
                                >
                                    <div className="flex items-center gap-6">
                                        <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
                                            {idx === 0 ? <Trophy className="text-amber-400" size={40} strokeWidth={1} /> :
                                             idx === 1 ? <Medal className="text-zinc-300" size={40} strokeWidth={1} /> :
                                             idx === 2 ? <Medal className="text-orange-300" size={40} strokeWidth={1} /> :
                                             <div className="w-10 h-10 rounded-full bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-lg font-black text-zinc-300 italic border border-zinc-100 dark:border-zinc-700">
                                                {idx + 1}
                                             </div>}
                                            {isTop3 && (
                                                <span className={cn(
                                                    "absolute inset-0 flex items-center justify-center text-xs font-black mt-1",
                                                    idx === 0 ? "text-amber-700 dark:text-amber-200" :
                                                    idx === 1 ? "text-zinc-600 dark:text-zinc-400" :
                                                    "text-orange-700 dark:text-orange-200"
                                                )}>
                                                    {idx + 1}
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="text-lg font-black text-zinc-900 dark:text-zinc-50">{t.playerName}</p>
                                                {idx === 0 && <Crown size={14} className="text-amber-400 fill-amber-400" />}
                                            </div>
                                            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{t.date}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={cn(
                                            "text-3xl font-black italic tracking-tighter",
                                            (t.totalScore || 0) > 0 ? "text-blue-600" : (t.totalScore || 0) < 0 ? "text-brand-red" : "text-zinc-400"
                                        )}>
                                            {formatScore(t.totalScore)}
                                        </p>
                                        <p className="text-[10px] font-black text-zinc-300 uppercase tracking-widest mt-[-2px]">pts</p>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
                            <Star size={40} strokeWidth={1} className="mb-3 opacity-20" />
                            <p className="text-sm font-medium">이 기간의 랭킹 데이터가 아직 없습니다.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function RankingsPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-zinc-200 border-t-brand-navy rounded-full animate-spin" />
            </div>
        }>
            <RankingsContent />
        </Suspense>
    );
}
