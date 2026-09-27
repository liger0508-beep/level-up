"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { CATEGORY_OPTIONS } from "@/app/(main)/scores/category-stats/constants";
import { Loader2, ChevronDown, ListFilter, ArrowUpDown, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface TournamentStatsViewProps {
    tournamentId: string;
    totalRounds: number;
    tournamentStartDate?: string;
}

interface AthleteStats {
    athleteId: string;
    athleteName: string;
    rounds: number;
    score: number;
    playContent: number;
    scoreVsContent: number;
    longVsShort: number;
    teeTotal: number;
    teeDistance: number;
    teeAccuracy: number;
    secondTotal: number;
    dist180Plus: number;
    dist150_179: number;
    dist120_149: number;
    dist90_119: number;
    greenTotal: number;
    pitchShot: number;
    bunker: number;
    approach: number;
    puttingTotal: number;
    putt9Plus: number;
    putt4_8: number;
    putt2_3: number;
    putt1: number;
    fairwayHitRate: number;
    girRate: number;
    parSaveRate: number;
    putts: number;
    threePutt: number;
    penaltyOB: number;
    bounceBack: number;
    birdieOrBetter: number;
}

export function TournamentStatsView({ tournamentId, totalRounds, tournamentStartDate }: TournamentStatsViewProps) {
    const [selectedRoundFilter, setSelectedRoundFilter] = useState<string>("ALL"); // "ALL", "1", "2", ...
    const [selectedCategories, setSelectedCategories] = useState<string[]>(["score"]);
    const [sortCategory, setSortCategory] = useState("score");
    const [isSortInverted, setIsSortInverted] = useState(false);
    const [isCategoryOpen, setIsCategoryOpen] = useState(false);
    const categoryRef = useRef<HTMLDivElement>(null);
    
    const [loading, setLoading] = useState(false);
    const [athleteStatsList, setAthleteStatsList] = useState<AthleteStats[]>([]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (categoryRef.current && !categoryRef.current.contains(event.target as Node)) {
                setIsCategoryOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        fetchStats();
    }, [tournamentId, selectedRoundFilter]);

    const fetchStats = async () => {
        setLoading(true);
        const supabase = createClient();

        try {
            // 1. Get scorecard IDs for this tournament from scorecards
            let scQuery = supabase
                .from('scorecards')
                .select('id, round_date')
                .eq('tournament_id', tournamentId)
                .eq('is_final', true);
                
            if (selectedRoundFilter !== "ALL" && tournamentStartDate) {
                // Calculate target date based on start_date and round number
                const roundNum = parseInt(selectedRoundFilter);
                const start = new Date(tournamentStartDate);
                start.setDate(start.getDate() + (roundNum - 1));
                const targetDate = start.toISOString().split('T')[0];
                scQuery = scQuery.eq('round_date', targetDate);
            }
            
            const { data: scorecardsData, error: scError } = await scQuery;
            
            if (scError) {
                console.error("Error fetching scorecards:", scError);
                setAthleteStatsList([]);
                return;
            }
            
            const scorecardIds = scorecardsData?.map(sc => sc.id) || [];
            
            if (scorecardIds.length === 0) {
                setAthleteStatsList([]);
                return;
            }

            // 2. Fetch summaries
            const { data: summaries, error } = await supabase
                .from('scorecard_summary')
                .select(`
                    *,
                    athlete:users!scorecard_summary_athlete_id_fkey(id, name)
                `)
                .in('scorecard_id', scorecardIds);

            if (error) {
                console.error("Error fetching tournament stats:", error);
                setAthleteStatsList([]);
                return;
            }

            // Aggregate by athlete
            const athleteMap = new Map<string, any>();
            for (const row of (summaries || [])) {
                const athlete = row.athlete as any;
                if (!athlete) continue;
                
                if (!athleteMap.has(row.athlete_id)) {
                    athleteMap.set(row.athlete_id, {
                        athleteId: row.athlete_id,
                        athleteName: athlete.name,
                        rounds: 0,
                        total_score: 0,
                        tee_dist_sg: 0, tee_acc_sg: 0,
                        dist_180_plus_sg: 0, dist_150_179_sg: 0, dist_120_149_sg: 0, dist_90_119_sg: 0,
                        pitch_sg: 0, bunker_sg: 0, approach_sg: 0,
                        putt_9_plus_sg: 0, putt_4_8_sg: 0, putt_2_3_sg: 0, putt_1_sg: 0,
                        fw_hits: 0, fw_total: 0,
                        gir_hits: 0, gir_total: 0,
                        par_saves: 0, missed_gir_total: 0,
                        total_putts: 0, three_putts: 0, penalty_ob: 0,
                        bounce_backs: 0, bogey_or_worse: 0, birdie_or_better: 0
                    });
                }

                const stat = athleteMap.get(row.athlete_id);
                stat.rounds += 1;
                stat.total_score += row.total_score;
                stat.tee_dist_sg += row.tee_dist_sg;
                stat.tee_acc_sg += row.tee_acc_sg;
                stat.dist_180_plus_sg += row.dist_180_plus_sg;
                stat.dist_150_179_sg += row.dist_150_179_sg;
                stat.dist_120_149_sg += row.dist_120_149_sg;
                stat.dist_90_119_sg += row.dist_90_119_sg;
                stat.pitch_sg += row.pitch_sg;
                stat.bunker_sg += row.bunker_sg;
                stat.approach_sg += row.approach_sg;
                stat.putt_9_plus_sg += row.putt_9_plus_sg;
                stat.putt_4_8_sg += row.putt_4_8_sg;
                stat.putt_2_3_sg += row.putt_2_3_sg;
                stat.putt_1_sg += row.putt_1_sg;
                stat.fw_hits += row.fw_hits;
                stat.fw_total += row.fw_total;
                stat.gir_hits += row.gir_hits;
                stat.gir_total += row.gir_total;
                stat.par_saves += row.par_saves;
                stat.missed_gir_total += row.missed_gir_total;
                stat.total_putts += row.total_putts;
                stat.three_putts += row.three_putts;
                stat.penalty_ob += row.penalty_ob;
                stat.bounce_backs += row.bounce_backs;
                stat.bogey_or_worse += row.bogey_or_worse;
                stat.birdie_or_better += row.birdie_or_better;
            }

            const results = Array.from(athleteMap.values()).map(stat => {
                const rounds = stat.rounds;
                const teeTotal = (stat.tee_dist_sg + stat.tee_acc_sg) / rounds / 2;
                const secondTotal = (stat.dist_180_plus_sg + stat.dist_150_179_sg + stat.dist_120_149_sg + stat.dist_90_119_sg) / rounds / 4;
                const greenTotal = (stat.pitch_sg + stat.bunker_sg + stat.approach_sg) / rounds / 3;
                const puttingTotal = (stat.putt_9_plus_sg + stat.putt_4_8_sg + stat.putt_2_3_sg + stat.putt_1_sg) / rounds / 4;
                
                const longSG = (teeTotal * 2) + (secondTotal * 4);
                const shortSG = (greenTotal * 3) + (puttingTotal * 4);
                const longVsShort = shortSG - longSG;

                const avgTotalScore = stat.total_score / rounds;
                const playContent = avgTotalScore + ((longVsShort * -1) / 2);
                const scoreVsContent = avgTotalScore - playContent;

                return {
                    athleteId: stat.athleteId,
                    athleteName: stat.athleteName,
                    rounds: stat.rounds,
                    score: avgTotalScore,
                    playContent,
                    scoreVsContent,
                    longVsShort,
                    teeTotal,
                    teeDistance: stat.tee_dist_sg / rounds,
                    teeAccuracy: stat.tee_acc_sg / rounds,
                    secondTotal,
                    dist180Plus: stat.dist_180_plus_sg / rounds,
                    dist150_179: stat.dist_150_179_sg / rounds,
                    dist120_149: stat.dist_120_149_sg / rounds,
                    dist90_119: stat.dist_90_119_sg / rounds,
                    greenTotal,
                    pitchShot: stat.pitch_sg / rounds,
                    bunker: stat.bunker_sg / rounds,
                    approach: stat.approach_sg / rounds,
                    puttingTotal,
                    putt9Plus: stat.putt_9_plus_sg / rounds,
                    putt4_8: stat.putt_4_8_sg / rounds,
                    putt2_3: stat.putt_2_3_sg / rounds,
                    putt1: stat.putt_1_sg / rounds,
                    fairwayHitRate: stat.fw_total > 0 ? (stat.fw_hits / stat.fw_total) * 100 : 0,
                    girRate: stat.gir_total > 0 ? (stat.gir_hits / stat.gir_total) * 100 : 0,
                    parSaveRate: stat.missed_gir_total > 0 ? (stat.par_saves / stat.missed_gir_total) * 100 : 0,
                    putts: stat.total_putts / rounds,
                    threePutt: stat.three_putts / rounds,
                    penaltyOB: stat.penalty_ob / rounds,
                    bounceBack: stat.bogey_or_worse > 0 ? (stat.bounce_backs / stat.bogey_or_worse) * 100 : 0,
                    birdieOrBetter: stat.birdie_or_better / rounds
                };
            });

            setAthleteStatsList(results);
        } catch (error) {
            console.error("Error computing stats:", error);
        } finally {
            setLoading(false);
        }
    };

    const sortedStats = useMemo(() => {
        if (athleteStatsList.length === 0) return [];
        const isDescending = ["fairwayHitRate", "girRate", "parSaveRate", "bounceBack", "birdieOrBetter"].includes(sortCategory);
        const isAscending = !isDescending;

        let sorted = [...athleteStatsList].sort((a, b) => {
            const valA = (a as any)[sortCategory] || 0;
            const valB = (b as any)[sortCategory] || 0;
            return isAscending ? valA - valB : valB - valA;
        });
        
        if (isSortInverted) sorted.reverse();
        return sorted;
    }, [athleteStatsList, sortCategory, isSortInverted]);

    const formatValue = (val: number, category: string) => {
        if (["fairwayHitRate", "girRate", "parSaveRate", "bounceBack"].includes(category)) return `${val.toFixed(1)}%`;
        if (["putts", "threePutt", "penaltyOB", "birdieOrBetter"].includes(category)) return `${val.toFixed(1)}`;
        if (["score", "playContent"].includes(category)) return `${val.toFixed(1)}`;
        const sign = val > 0 ? "+" : "";
        return `${sign}${val.toFixed(2)}`;
    };

    return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 mb-8 shadow-sm">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6 pb-6 border-b border-zinc-100 dark:border-zinc-800">
                {/* Round Filter */}
                <div className="flex items-center gap-2">
                    <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1 shrink-0">
                        <Calendar size={14} className="text-zinc-400"/> 일정
                    </label>
                    <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
                        <button 
                            onClick={() => setSelectedRoundFilter("ALL")}
                            className={cn("px-4 py-1.5 rounded-lg text-sm font-bold transition-colors", selectedRoundFilter === "ALL" ? "bg-white dark:bg-zinc-700 text-brand-navy shadow-sm" : "text-zinc-500 hover:text-zinc-700")}
                        >
                            전체
                        </button>
                        {Array.from({length: totalRounds}).map((_, i) => (
                            <button 
                                key={i+1}
                                onClick={() => setSelectedRoundFilter(`${i+1}`)}
                                className={cn("px-4 py-1.5 rounded-lg text-sm font-bold transition-colors", selectedRoundFilter === `${i+1}` ? "bg-white dark:bg-zinc-700 text-brand-navy shadow-sm" : "text-zinc-500 hover:text-zinc-700")}
                            >
                                {i+1}R
                            </button>
                        ))}
                    </div>
                </div>

                {/* Category Filter */}
                <div className="flex items-center gap-2 flex-1 relative" ref={categoryRef}>
                    <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1 shrink-0">
                        <ListFilter size={14} className="text-zinc-400"/> 항목
                    </label>
                    <button
                        type="button"
                        onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                        className="flex-1 flex items-center justify-between px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent text-sm font-bold text-brand-navy focus:outline-none"
                    >
                        <span className="flex-1 text-center">
                            {selectedCategories.length === 0 
                                ? "항목을 선택하세요"
                                : selectedCategories.length === 1
                                ? CATEGORY_OPTIONS.find(opt => opt.value === selectedCategories[0])?.label
                                : `${CATEGORY_OPTIONS.find(opt => opt.value === selectedCategories[0])?.label} 외 ${selectedCategories.length - 1}`
                            }
                        </span>
                        <ChevronDown size={14} className={cn("text-zinc-400 transition-transform", isCategoryOpen && "rotate-180")} />
                    </button>
                    {isCategoryOpen && (
                        <div className="absolute top-full left-16 right-0 z-50 mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-lg flex flex-col">
                            <div className="max-h-[300px] overflow-y-auto [&::-webkit-scrollbar]:hidden py-1">
                                {CATEGORY_OPTIONS.map(opt => {
                                    const isSelected = selectedCategories.includes(opt.value);
                                    return (
                                        <button
                                            key={opt.value}
                                            onClick={() => {
                                                if (isSelected) {
                                                    if (selectedCategories.length > 1) setSelectedCategories(prev => prev.filter(c => c !== opt.value));
                                                } else {
                                                    setSelectedCategories(prev => [...prev, opt.value]);
                                                }
                                            }}
                                            className={cn(
                                                "w-full px-3 py-2.5 text-sm font-bold text-center transition-colors",
                                                isSelected ? "text-brand-navy bg-brand-navy/10" : "text-zinc-600 hover:bg-zinc-100"
                                            )}
                                        >
                                            {opt.label}
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="p-2 border-t border-zinc-100 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-800/80 rounded-b-2xl flex justify-end">
                                <button
                                    onClick={() => setIsCategoryOpen(false)}
                                    className="px-4 py-1.5 bg-brand-navy hover:bg-brand-navy/90 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
                                >
                                    완료
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="relative">
                {loading && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/60 dark:bg-zinc-900/60 backdrop-blur-[1px] rounded-2xl">
                        <Loader2 className="w-8 h-8 text-brand-navy animate-spin mb-2" />
                        <p className="text-zinc-600 font-bold text-sm">통계 계산 중...</p>
                    </div>
                )}

                {sortedStats.length === 0 && !loading ? (
                    <div className="py-20 text-center text-zinc-500 font-bold text-sm bg-zinc-50 dark:bg-zinc-800/30 rounded-3xl border border-zinc-100 dark:border-zinc-800">
                        선택한 라운드의 통계 데이터가 없습니다. (스코어 제출 시 생성됩니다)
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
                        <table className="w-full text-left min-w-max relative border-collapse">
                            <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                                <tr>
                                    <th className="sticky left-0 z-20 bg-zinc-50 dark:bg-zinc-800/90 px-4 py-3 text-xs font-black text-zinc-400 uppercase text-center w-16">순위</th>
                                    <th className="sticky left-[64px] z-20 bg-zinc-50 dark:bg-zinc-800/90 px-4 py-3 text-xs font-black text-zinc-400 uppercase text-center w-28 shadow-[inset_-1px_0_0_0_rgba(0,0,0,0.05)]">선수명</th>
                                    {selectedCategories.map(cat => (
                                        <th key={cat} className={cn("px-6 py-3 text-xs font-black text-brand-navy uppercase text-center min-w-[100px]", sortCategory === cat && "bg-red-50/50 dark:bg-red-900/50")}>
                                            <button 
                                                onClick={() => {
                                                    if (sortCategory === cat) setIsSortInverted(!isSortInverted);
                                                    else { setSortCategory(cat); setIsSortInverted(false); }
                                                }}
                                                className="flex items-center justify-center gap-1.5 w-full hover:opacity-70 transition-opacity"
                                            >
                                                {CATEGORY_OPTIONS.find(c => c.value === cat)?.label || "값"}
                                                {sortCategory === cat && <ArrowUpDown size={14} className={isSortInverted ? "text-brand-navy" : "text-brand-navy/60"} />}
                                            </button>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {sortedStats.map((stat, idx) => {
                                    const originalRank = isSortInverted ? sortedStats.length - idx : idx + 1;
                                    return (
                                        <tr key={stat.athleteId} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                            <td className="sticky left-0 z-10 bg-white dark:bg-zinc-900 group-hover:bg-zinc-50 px-4 py-3 text-center">
                                                <span className={cn(
                                                    "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold",
                                                    originalRank === 1 ? "bg-amber-100 text-amber-700" :
                                                    originalRank === 2 ? "bg-zinc-200 text-zinc-700" :
                                                    originalRank === 3 ? "bg-orange-100 text-orange-800" :
                                                    "text-zinc-500"
                                                )}>{originalRank}</span>
                                            </td>
                                            <td className="sticky left-[64px] z-10 bg-white dark:bg-zinc-900 group-hover:bg-zinc-50 px-4 py-3 text-center font-bold text-zinc-900 dark:text-zinc-100 text-sm shadow-[inset_-1px_0_0_0_rgba(0,0,0,0.05)]">
                                                {stat.athleteName}
                                            </td>
                                            {selectedCategories.map(cat => {
                                                const rawValue = (stat as any)[cat] || 0;
                                                let valueColorClass = "text-zinc-900 dark:text-zinc-100";
                                                if (cat === "score" || cat === "playContent") {
                                                    if (rawValue < 72) valueColorClass = "text-red-500";
                                                    else if (rawValue > 72) valueColorClass = "text-blue-500";
                                                } else if (cat === "birdieOrBetter") {
                                                    if (rawValue > 0) valueColorClass = "text-red-500";
                                                } else if (["fairwayHitRate", "girRate", "parSaveRate", "putts", "bounceBack"].includes(cat)) {
                                                    valueColorClass = "text-zinc-900 dark:text-zinc-100";
                                                } else {
                                                    if (rawValue < 0) valueColorClass = "text-red-500";
                                                    else if (rawValue > 0) valueColorClass = "text-blue-500";
                                                }
                                                return (
                                                    <td key={cat} className={cn("px-6 py-3 text-center transition-colors", sortCategory === cat && "bg-red-50/30 dark:bg-red-900/30")}>
                                                        <span className={cn("text-base font-black", valueColorClass)}>
                                                            {formatValue(rawValue, cat)}
                                                        </span>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
