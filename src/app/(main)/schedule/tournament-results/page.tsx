"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Trophy, Settings, MapPin, Calendar, Medal, List, Search, SlidersHorizontal } from "lucide-react";
import { Tournament, getStoredTournaments, TournamentCategory } from "@/lib/tournament-sync";
import { TournamentResult, getTournamentResults } from "@/lib/tournament-results-sync";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { DatePickerInput } from "@/components/ui/DatePickerInput";

interface AthleteSummary {
    name: string;
    finalStrokes: number | null;
    finalRelative: number | null;
    finalRank: number | null;
    isCutoff: boolean;
    rounds: {
        roundNum: number;
        score: string | null;
        relative: number | null;
        rank: number | null;
        isCutoff: boolean;
    }[];
}

interface TournamentWithResults extends Tournament {
    athleteSummaries: AthleteSummary[];
}

const CATEGORY_COLORS: Record<TournamentCategory, { dot: string; bg: string; text: string; border: string }> = {
    KGA: { dot: "bg-red-500", bg: "bg-red-50", text: "text-red-600", border: "border-l-red-500" },
    KPGA: { dot: "bg-blue-500", bg: "bg-blue-50", text: "text-blue-600", border: "border-l-blue-500" },
    KLPGA: { dot: "bg-purple-500", bg: "bg-purple-50", text: "text-purple-600", border: "border-l-purple-500" },
    대학연맹: { dot: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-600", border: "border-l-emerald-500" },
    중고연맹: { dot: "bg-orange-500", bg: "bg-orange-50", text: "text-orange-600", border: "border-l-orange-500" },
    기타: { dot: "bg-teal-500", bg: "bg-teal-50", text: "text-teal-600", border: "border-l-teal-500" },
};

function getTournamentDateRange(t: Tournament): { start: string; end: string } {
    const year = t.year ?? new Date().getFullYear();
    const parts = t.date.split("~").map(s => s.trim());
    const startMD = parts[0];
    const endMD = parts[1] ?? startMD;

    const toFullDate = (md: string) => {
        if (/^\d{4}-/.test(md)) return md.slice(0, 10);
        return `${year}-${md}`;
    };

    return { start: toFullDate(startMD), end: toFullDate(endMD) };
}

type ActivePreset = "monthly" | "weekly" | "today" | "custom";

export default function TournamentResultsViewPage() {
    const [tournamentsData, setTournamentsData] = useState<TournamentWithResults[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [hasMounted, setHasMounted] = useState(false);

    const today = new Date();
    const defaultStart = new Date(today);
    defaultStart.setDate(today.getDate() - 7);
    const [startDate, setStartDate] = useState(format(defaultStart, "yyyy-MM-dd"));
    const [endDate, setEndDate] = useState(format(today, "yyyy-MM-dd"));
    const [activePreset, setActivePreset] = useState<ActivePreset>("weekly");

    const [categoryFilter, setCategoryFilter] = useState<TournamentCategory | "all">("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectAll, setSelectAll] = useState(true);

    useEffect(() => {
        setHasMounted(true);
        
        try {
            const stored = sessionStorage.getItem("gla_tournament_results_filter");
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.startDate !== undefined) setStartDate(parsed.startDate);
                if (parsed.endDate !== undefined) setEndDate(parsed.endDate);
                if (parsed.activePreset) setActivePreset(parsed.activePreset);
                if (parsed.categoryFilter) setCategoryFilter(parsed.categoryFilter);
                if (parsed.searchQuery !== undefined) setSearchQuery(parsed.searchQuery);
                if (parsed.selectAll !== undefined) setSelectAll(parsed.selectAll);
                if (parsed.selectedPlayers && !parsed.selectAll) {
                    setSelectedPlayers(new Set(parsed.selectedPlayers));
                }
            }
        } catch (e) {
            console.warn("Failed to restore tournament results filter", e);
        }

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const storedTournaments = await getStoredTournaments();
                const processedTournaments: TournamentWithResults[] = [];

                for (const t of storedTournaments) {
                    const results = await getTournamentResults(t.id);
                    if (results.length === 0) continue; // Skip tournaments with no results

                    // Group by athlete
                    const athleteMap = new Map<string, TournamentResult[]>();
                    for (const r of results) {
                        if (!athleteMap.has(r.athlete_name)) {
                            athleteMap.set(r.athlete_name, []);
                        }
                        athleteMap.get(r.athlete_name)!.push(r);
                    }

                    const athleteSummaries: AthleteSummary[] = [];

                    for (const [name, rounds] of athleteMap.entries()) {
                        rounds.sort((a, b) => a.round_number - b.round_number);
                        
                        let cumulativeRel = 0;
                        let lastRank: number | null = null;
                        let isCutoff = false;
                        
                        const processedRounds = rounds.map((r, i) => {
                            const isRoundCutoff = r.daily_score?.toUpperCase() === 'C';
                            let rel: number | null = null;
                            
                            if (isRoundCutoff) {
                                isCutoff = true;
                            } else if (r.daily_score !== null && !isCutoff) {
                                const numericScore = parseInt(r.daily_score);
                                if (!isNaN(numericScore)) {
                                    rel = numericScore;
                                    cumulativeRel += numericScore;
                                    lastRank = r.daily_rank;
                                }
                            }
                            
                            return {
                                roundNum: r.round_number,
                                score: r.daily_score,
                                relative: rel,
                                rank: r.daily_rank,
                                isCutoff: isRoundCutoff
                            };
                        });
                        
                        // Find last valid round for final summary
                        const lastValidRound = [...processedRounds].reverse().find(r => r.score !== null && !r.isCutoff);
                        const finalStrokes = lastValidRound ? (cumulativeRel + (lastValidRound.roundNum * 72)) : null;

                        athleteSummaries.push({
                            name,
                            finalStrokes: isCutoff ? null : finalStrokes,
                            finalRelative: isCutoff ? null : cumulativeRel,
                            finalRank: lastRank,
                            isCutoff,
                            rounds: processedRounds
                        });
                    }

                    if (athleteSummaries.length > 0) {
                        processedTournaments.push({
                            ...t,
                            athleteSummaries
                        });
                    }
                }
                
                // Sort by date descending
                processedTournaments.sort((a, b) => b.date.localeCompare(a.date));
                setTournamentsData(processedTournaments);
            } catch (err) {
                console.error("Failed to load results:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    const allPlayers = useMemo(() => {
        const pSet = new Set<string>();
        tournamentsData.forEach(t => t.athleteSummaries.forEach(a => pSet.add(a.name)));
        return Array.from(pSet).sort();
    }, [tournamentsData]);

    const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (selectAll && allPlayers.length > 0) setSelectedPlayers(new Set(allPlayers));
    }, [allPlayers, selectAll]);

    useEffect(() => {
        if (allPlayers.length === 0) return;
        try {
            sessionStorage.setItem("gla_tournament_results_filter", JSON.stringify({
                startDate,
                endDate,
                activePreset,
                categoryFilter,
                searchQuery,
                selectAll,
                selectedPlayers: Array.from(selectedPlayers)
            }));
        } catch (e) {
            console.warn("Failed to save tournament results filter", e);
        }
    }, [startDate, endDate, activePreset, categoryFilter, searchQuery, selectAll, selectedPlayers, allPlayers]);

    const applyPreset = (preset: "monthly" | "weekly" | "today") => {
        const now = new Date();
        const endStr = format(now, "yyyy-MM-dd");
        if (preset === "monthly") {
            const past = new Date(now);
            past.setDate(now.getDate() - 30);
            setStartDate(format(past, "yyyy-MM-dd"));
            setEndDate(endStr);
        } else if (preset === "weekly") {
            const past = new Date(now);
            past.setDate(now.getDate() - 7);
            setStartDate(format(past, "yyyy-MM-dd"));
            setEndDate(endStr);
        } else {
            setStartDate(endStr);
            setEndDate(endStr);
        }
        setActivePreset(preset);
    };

    const togglePlayer = (name: string) => {
        setSelectedPlayers((prev) => {
            let next: Set<string>;
            if (selectAll) {
                next = new Set([name]);
                setSelectAll(false);
            } else {
                next = new Set(prev);
                if (next.has(name)) next.delete(name);
                else next.add(name);
            }
            if (next.size === 0 || next.size === allPlayers.length) {
                setSelectAll(true);
                return new Set(allPlayers);
            }
            return next;
        });
        setSearchQuery("");
    };

    const filteredTournaments = useMemo(() => {
        return tournamentsData.filter(t => {
            const categoryMatch = categoryFilter === "all" || t.category === categoryFilter;
            if (!categoryMatch) return false;

            const { start, end } = getTournamentDateRange(t);
            const dateMatch = (!startDate || end >= startDate) && (!endDate || start <= endDate);
            if (!dateMatch) return false;

            // Notice we match against t.athleteSummaries, not t.players, because these are results
            const hasMatchingPlayer = t.athleteSummaries.length === 0 || t.athleteSummaries.some(a => selectedPlayers.has(a.name));
            if (!hasMatchingPlayer) return false;

            return true;
        }).map(t => {
            // Filter athleteSummaries to only include selected players
            if (selectAll) return t;
            const filteredAthletes = t.athleteSummaries.filter(a => selectedPlayers.has(a.name));
            return { ...t, athleteSummaries: filteredAthletes };
        }).filter(t => t.athleteSummaries.length > 0);
    }, [tournamentsData, categoryFilter, startDate, endDate, selectedPlayers, selectAll]);

    const visiblePlayersArr = useMemo(() => {
        const queryMatches = searchQuery
            ? allPlayers.filter((p) => p.toLowerCase().includes(searchQuery.toLowerCase()))
            : [];
        const activePlayersInResults = new Set<string>();
        if (!selectAll) filteredTournaments.forEach(t => t.athleteSummaries.forEach(a => activePlayersInResults.add(a.name)));
        const selectedArr = selectAll ? [] : Array.from(selectedPlayers);
        return Array.from(new Set([...selectedArr, ...queryMatches, ...Array.from(activePlayersInResults)])).sort();
    }, [searchQuery, selectedPlayers, selectAll, allPlayers, filteredTournaments]);

    const CATEGORIES: TournamentCategory[] = ["KGA", "KPGA", "KLPGA", "대학연맹", "중고연맹", "기타"];

    if (!hasMounted) return null;

    const presetBtnClass = (preset: ActivePreset) =>
        cn("px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200",
            activePreset === preset
                ? "bg-brand-navy text-white shadow-sm"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100"
        );

    return (
        <div className="p-4 sm:p-8 max-w-5xl mx-auto min-h-screen animate-in fade-in duration-500">
            {/* Header section with refined aesthetics matching Tournament Schedule */}
            <div className="flex items-start justify-between gap-4 mb-8">
                <div className="space-y-1">
                    <div className="flex items-center gap-2.5 mb-1">
                        <div className="w-10 h-10 rounded-xl bg-brand-navy flex items-center justify-center text-white shadow-lg shadow-brand-navy/20 transition-transform hover:scale-105 shrink-0">
                            <Trophy size={24} />
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                            대회 결과
                        </h1>
                    </div>
                    <p className="text-zinc-500 dark:text-zinc-400 text-xs sm:text-sm font-medium pl-12">
                        선수들의 대회 성적을 한눈에 확인하세요.
                    </p>
                </div>

                <Link
                    href="/admin/tournament-results"
                    className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs sm:text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all shadow-sm active:scale-95 shrink-0"
                >
                    <Settings size={18} />
                    <span className="hidden xs:inline">대회 성적 등록</span>
                    <span className="xs:hidden">등록</span>
                </Link>
            </div>

            {/* Filters Section */}
            <div className="flex flex-col gap-5 mb-8">
                {/* Top Row: Category */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1">
                        <button
                            onClick={() => setCategoryFilter("all")}
                            className={cn("px-4 py-2 text-sm rounded-full font-semibold border transition-all duration-200 whitespace-nowrap shrink-0",
                                categoryFilter === "all"
                                    ? "bg-brand-navy text-white border-brand-navy shadow-md"
                                    : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                            )}>전체</button>
                        {CATEGORIES.map((cat) => (
                            <button key={cat}
                                onClick={() => setCategoryFilter(cat)}
                                className={cn("px-4 py-2 text-sm rounded-full font-semibold border transition-all duration-200 whitespace-nowrap shrink-0",
                                    categoryFilter === cat
                                        ? "bg-brand-navy text-white border-brand-navy shadow-md"
                                        : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                                )}>{cat}</button>
                        ))}
                    </div>
                </div>

                {/* Search Filters Container */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
                    {/* Date Range */}
                    <div className="flex items-center gap-2">
                        <label className="w-16 shrink-0 text-center text-sm font-semibold text-zinc-700 dark:text-zinc-300">일정</label>
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <DatePickerInput
                                value={startDate}
                                onChange={(e) => { setStartDate(e.target.value); setActivePreset("custom"); }}
                                className="flex-1 min-w-0 px-2 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-[13px] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all text-center cursor-pointer"
                            />
                            <span className="text-zinc-400 shrink-0 text-xs">~</span>
                            <DatePickerInput
                                value={endDate}
                                onChange={(e) => { setEndDate(e.target.value); setActivePreset("custom"); }}
                                className="flex-1 min-w-0 px-2 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-[13px] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all text-center cursor-pointer"
                            />
                        </div>
                    </div>

                    {/* Player Search */}
                    <div className="flex items-center gap-2 mt-3">
                        <label className="w-16 shrink-0 text-center text-sm font-semibold text-zinc-700 dark:text-zinc-300">선수</label>
                        <div className="relative flex-1">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                            <input
                                type="text"
                                placeholder="선수명 검색..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && searchQuery.trim()) {
                                        const match = allPlayers.find(p => p.toLowerCase().includes(searchQuery.toLowerCase()));
                                        if (match) togglePlayer(match);
                                    }
                                }}
                                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all"
                            />
                        </div>
                    </div>

                    {/* Player Chips */}
                    {visiblePlayersArr.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3 pl-[72px] max-h-28 overflow-y-auto pr-1">
                            {visiblePlayersArr.map((name) => {
                                const isSelected = selectedPlayers.has(name);
                                return (
                                    <button key={name} onClick={() => togglePlayer(name)}
                                        className={cn("px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 shrink-0",
                                            isSelected
                                                ? "bg-brand-navy/10 text-brand-navy border-brand-navy dark:bg-brand-navy/30 dark:text-white"
                                                : "bg-white dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-brand-navy"
                                        )}>
                                        {name}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Preset Buttons — right-aligned */}
                <div className="flex justify-end">
                    <div className="flex items-center bg-transparent dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700">
                        <button onClick={() => applyPreset("monthly")} className={presetBtnClass("monthly")}>월간</button>
                        <button onClick={() => applyPreset("weekly")} className={presetBtnClass("weekly")}>주간</button>
                        <button onClick={() => applyPreset("today")} className={presetBtnClass("today")}>오늘</button>
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center py-20">
                    <div className="w-8 h-8 border-4 border-brand-navy/20 border-t-brand-navy rounded-full animate-spin"></div>
                </div>
            ) : filteredTournaments.length === 0 ? (
                <div className="py-16 bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 text-center shadow-sm">
                    <Calendar size={36} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-700" />
                    <p className="text-zinc-400 text-sm font-medium">조회된 대회가 없습니다.</p>
                    <p className="text-zinc-300 dark:text-zinc-600 text-xs mt-1">기간 또는 필터를 변경해보세요.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="flex items-center gap-2 text-sm font-bold text-zinc-700 dark:text-zinc-300">
                        <SlidersHorizontal size={16} className="text-brand-navy" />
                        조회 결과 ({filteredTournaments.length}건)
                    </div>

                    <div className="space-y-6">
                        {filteredTournaments.map(t => (
                            <TournamentResultCard key={t.id} tournament={t} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function TournamentResultCard({ tournament }: { tournament: TournamentWithResults }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    const formatRelScore = (score: number | null) => {
        if (score === null) return "";
        if (score === 0) return "E";
        return score > 0 ? `+${score}` : `${score}`;
    };

    const handleScroll = () => {
        if (!scrollRef.current) return;
        const scrollLeft = scrollRef.current.scrollLeft;
        const width = scrollRef.current.clientWidth;
        const newIndex = Math.round(scrollLeft / width);
        if (newIndex !== currentIndex) {
            setCurrentIndex(newIndex);
        }
    };

    const scrollTo = (index: number) => {
        if (!scrollRef.current) return;
        const width = scrollRef.current.clientWidth;
        scrollRef.current.scrollTo({ left: width * index, behavior: 'smooth' });
    };

    const colors = CATEGORY_COLORS[tournament.category];

    return (
        <div className={cn("bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-l-4 rounded-2xl shadow-sm overflow-hidden flex flex-col", colors.border)}>
            {/* Card Header (Tournament Info) */}
            <div className="p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800/50 flex items-center justify-between">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full uppercase shrink-0", colors.bg, colors.text)}>
                        {tournament.category}
                    </span>
                    <h3 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
                        {tournament.name}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500 ml-1 sm:ml-2">
                        <Calendar size={12} />
                        <span>{tournament.date}</span>
                    </div>
                    {tournament.venue && (
                        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                            <MapPin size={12} />
                            <span>{tournament.venue}</span>
                        </div>
                    )}
                </div>
                
                {/* Mobile pagination indicator */}
                <div className="md:hidden text-xs font-medium text-zinc-500 shrink-0 ml-2">
                    ({currentIndex + 1}/{tournament.athleteSummaries.length})
                </div>
            </div>

            {/* Content Area */}
            <div className="relative">
                {/* Mobile View: Horizontal Scroll Carousel */}
                <div className="md:hidden">
                    <div 
                        ref={scrollRef}
                        onScroll={handleScroll}
                        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2"
                        style={{ scrollBehavior: 'smooth' }}
                    >
                        {tournament.athleteSummaries.map((athlete, idx) => (
                            <div key={idx} className="w-full flex-none snap-center p-4">
                                <AthleteResult athlete={athlete} />
                            </div>
                        ))}
                    </div>
                    
                    {/* Carousel Controls */}
                    {tournament.athleteSummaries.length > 1 && (
                        <div className="flex justify-center gap-2 pb-3">
                            {tournament.athleteSummaries.map((_, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => scrollTo(idx)}
                                    className={cn(
                                        "w-1.5 h-1.5 rounded-full transition-all",
                                        idx === currentIndex ? "bg-brand-navy w-3" : "bg-zinc-300 dark:bg-zinc-700"
                                    )}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* PC View: Vertical Stack */}
                <div className="hidden md:flex flex-col p-5 gap-6">
                    {tournament.athleteSummaries.map((athlete, idx) => (
                        <AthleteResult key={idx} athlete={athlete} />
                    ))}
                </div>
            </div>
        </div>
    );
}

function AthleteResult({ athlete }: { athlete: AthleteSummary }) {
    const formatRelScore = (score: number | null) => {
        if (score === null) return "";
        if (score === 0) return "E";
        return score > 0 ? `+${score}` : `${score}`;
    };

    const getScoreColor = (score: number | null) => {
        if (score === null || score === 0) return "text-zinc-500";
        return score < 0 ? "text-brand-red" : "text-blue-600 dark:text-blue-500";
    };

    return (
        <div className="flex flex-col w-full">
            {/* Athlete Header */}
            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl px-4 py-3 flex items-center justify-between mb-3 border border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                    <span className="font-bold text-[15px] text-zinc-900 dark:text-zinc-100">{athlete.name}</span>
                </div>
                
                <div className="flex items-center gap-2 text-sm font-semibold">
                    <span className="text-zinc-600 dark:text-zinc-400">최종</span>
                    {athlete.isCutoff ? (
                        <span className="text-zinc-500">CUT OFF</span>
                    ) : (
                        <>
                            {athlete.finalStrokes !== null ? (
                                <span className={getScoreColor(athlete.finalRelative)}>
                                    {athlete.finalStrokes}타 <span className="text-xs">({formatRelScore(athlete.finalRelative)})</span>
                                </span>
                            ) : (
                                <span className="text-zinc-400">-</span>
                            )}
                            {athlete.finalRank && (
                                <span className="text-zinc-700 dark:text-zinc-300 ml-1">{athlete.finalRank}위</span>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Rounds Detail */}
            <div className="px-4 space-y-2.5">
                {athlete.rounds.map((round, rIdx) => (
                    <div key={rIdx} className="flex items-center text-[13px] pl-2 border-l-2 border-zinc-200 dark:border-zinc-700">
                        <span className="w-10 font-semibold text-zinc-600 dark:text-zinc-400">{round.roundNum}R :</span>
                        <div className="flex items-center gap-1.5 flex-1">
                            {round.isCutoff ? (
                                <span className="text-zinc-400 font-medium tracking-wider">CUT OFF</span>
                            ) : round.score !== null && !isNaN(parseInt(round.score)) ? (
                                <>
                                    <span className={cn("font-medium", getScoreColor(parseInt(round.score)))}>
                                        {72 + parseInt(round.score)}타
                                    </span>
                                    <span className={cn("text-xs", getScoreColor(parseInt(round.score)))}>
                                        ({formatRelScore(parseInt(round.score))})
                                    </span>
                                    {round.rank && (
                                        <span className="text-zinc-700 dark:text-zinc-300 ml-1">, {round.rank}위</span>
                                    )}
                                </>
                            ) : (
                                <span className="text-zinc-400">-</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
