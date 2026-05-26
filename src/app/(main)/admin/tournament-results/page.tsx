"use client";

import { useState, useEffect, useMemo } from "react";
import { Trophy, ChevronLeft, ChevronRight, Save, Check, Calendar, User, List, Info, ChevronUp, ChevronDown, MapPin } from "lucide-react";
import { Tournament, getStoredTournaments } from "@/lib/tournament-sync";
import { TournamentResult, getTournamentResults, saveTournamentResults, getDatesBetween } from "@/lib/tournament-results-sync";
import { cn } from "@/lib/utils";

export default function TournamentResultsPage() {
    const [allTournaments, setAllTournaments] = useState<Tournament[]>([]);
    const [results, setResults] = useState<Record<string, TournamentResult[]>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [savedTournamentId, setSavedTournamentId] = useState<string | null>(null);
    const [hasMounted, setHasMounted] = useState(false);

    // Selected round index per tournament: { tournamentId: roundIndex }
    const [selectedRoundIndices, setSelectedRoundIndices] = useState<Record<string, number>>({});

    // Month navigation
    const today = new Date();
    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);

    useEffect(() => {
        setHasMounted(true);
        const fetchData = async () => {
            setIsLoading(true);
            const tournaments = await getStoredTournaments();
            setAllTournaments(tournaments);

            const allResults: Record<string, TournamentResult[]> = {};
            const initialRounds: Record<string, number> = {};
            for (const t of tournaments) {
                const res = await getTournamentResults(t.id);
                allResults[t.id] = res;
                initialRounds[t.id] = 0; // Default to Day 1
            }
            setResults(allResults);
            setSelectedRoundIndices(initialRounds);
            setIsLoading(false);
        };
        fetchData();
    }, []);

    if (!hasMounted) return null;

    const navigateMonth = (dir: "prev" | "next") => {
        if (dir === "prev") {
            if (viewMonth === 1) { setViewMonth(12); setViewYear(y => y - 1); }
            else setViewMonth(m => m - 1);
        } else {
            if (viewMonth === 12) { setViewMonth(1); setViewYear(y => y + 1); }
            else setViewMonth(m => m + 1);
        }
    };

    const navigateRound = (tournamentId: string, dir: "prev" | "next", max: number) => {
        setSelectedRoundIndices(prev => {
            const current = prev[tournamentId] || 0;
            let next = current;
            if (dir === "prev" && current > 0) next = current - 1;
            if (dir === "next" && current < max - 1) next = current + 1;
            return { ...prev, [tournamentId]: next };
        });
    };

    const monthTournaments = allTournaments.filter(t => {
        const y = t.year ?? viewYear;
        const startStr = t.date.split("~")[0].trim();
        const month = parseInt(startStr.split("-")[0]);
        return y === viewYear && month === viewMonth;
    });

    const formatRelativeScore = (score: number | null) => {
        if (score === null) return "";
        if (score === 0) return "0";
        return score > 0 ? `+${score}` : `${score}`;
    };

    const calculateAthleteResults = (tournamentId: string, athleteName: string, roundCount: number) => {
        const tournamentRes = results[tournamentId] || [];
        const athleteRes = tournamentRes.filter(r => r.athlete_name === athleteName);
        
        let cumulativeRelative = 0;
        let lastRank: number | null = null;
        let isCutoff = false;
        let lastRoundPlayed = 0;
        let commonNote = athleteRes.find(r => r.notes !== null)?.notes || null;

        const processedRounds = Array.from({ length: roundCount }).map((_, i) => {
            const roundNum = i + 1;
            const res = athleteRes.find(r => r.round_number === roundNum);
            
            const scoreVal = res?.daily_score;
            const isRoundCutoff = scoreVal?.toUpperCase() === 'C';
            
            if (res && scoreVal !== null && !isCutoff) {
                if (isRoundCutoff) {
                    isCutoff = true;
                } else {
                    const numericScore = parseInt(scoreVal as string);
                    if (!isNaN(numericScore)) {
                        cumulativeRelative += numericScore;
                        lastRank = res.daily_rank;
                        lastRoundPlayed = roundNum;
                    }
                }
            }

            const cumulativeStrokes = (lastRoundPlayed >= roundNum && !isCutoff) 
                ? (cumulativeRelative + (roundNum * 72)) 
                : null;

            return {
                ...res,
                cumulative_relative: (lastRoundPlayed >= roundNum && !isCutoff) ? cumulativeRelative : null,
                cumulative_strokes: cumulativeStrokes,
                rank: lastRank,
                isCutoff: isCutoff || isRoundCutoff,
                notes: commonNote
            };
        });

        return processedRounds;
    };

    const handleUpdateResult = (tournamentId: string, athleteName: string, roundNumber: number, field: 'daily_score' | 'daily_rank' | 'notes', value: string | number | null) => {
        setResults(prev => {
            const currentRes = [...(prev[tournamentId] || [])];
            
            if (field === 'notes') {
                const athleteRows = currentRes.filter(r => r.athlete_name === athleteName);
                if (athleteRows.length > 0) {
                    athleteRows.forEach(r => r.notes = value as string);
                } else {
                    const t = allTournaments.find(tt => tt.id === tournamentId);
                    const parts = t!.date.split("~").map(s => s.trim());
                    const dates = getDatesBetween(parts[0], parts.length > 1 ? parts[1] : parts[0], t!.year);
                    currentRes.push({
                        tournament_id: tournamentId,
                        athlete_name: athleteName,
                        round_number: 1,
                        round_date: dates[0] || "",
                        daily_score: null,
                        daily_rank: null,
                        cumulative_score: null,
                        rank: null,
                        notes: value as string
                    });
                }
            } else {
                const idx = currentRes.findIndex(r => r.athlete_name === athleteName && r.round_number === roundNumber);
                if (idx >= 0) {
                    currentRes[idx] = { ...currentRes[idx], [field]: value === null ? null : String(value) };
                    if (field === 'daily_rank' && value !== null) {
                        currentRes[idx].daily_rank = Math.max(1, parseInt(String(value)));
                    }
                } else {
                    const t = allTournaments.find(tt => tt.id === tournamentId);
                    const parts = t!.date.split("~").map(s => s.trim());
                    const dates = getDatesBetween(parts[0], parts.length > 1 ? parts[1] : parts[0], t!.year);
                    
                    currentRes.push({
                        tournament_id: tournamentId,
                        athlete_name: athleteName,
                        round_number: roundNumber,
                        round_date: dates[roundNumber - 1] || "",
                        daily_score: field === 'daily_score' ? (value === null ? null : String(value)) : null,
                        daily_rank: field === 'daily_rank' ? (value === null ? null : Math.max(1, parseInt(String(value)))) : null,
                        cumulative_score: null,
                        rank: null,
                        notes: null
                    });
                }
            }

            const athleteRounds = currentRes.filter(r => r.athlete_name === athleteName).sort((a, b) => a.round_number - b.round_number);
            let cumulativeRel = 0;
            let lastRank: number | null = null;
            let cutoff = false;

            athleteRounds.forEach((r, i) => {
                if (cutoff) {
                    r.cumulative_score = null;
                    r.rank = lastRank;
                    return;
                }
                const scoreVal = r.daily_score;
                if (scoreVal?.toUpperCase() === 'C') {
                    cutoff = true;
                    r.cumulative_score = null;
                } else if (scoreVal !== null) {
                    const numericScore = parseInt(scoreVal as string);
                    if (!isNaN(numericScore)) {
                        cumulativeRel += numericScore;
                        lastRank = r.daily_rank;
                        r.cumulative_score = cumulativeRel + ((i + 1) * 72);
                    }
                }
                r.rank = lastRank;
            });

            return { ...prev, [tournamentId]: currentRes };
        });
    };

    const adjustValue = (tournamentId: string, athleteName: string, roundNumber: number, field: 'daily_score' | 'daily_rank', delta: number) => {
        setResults(prev => {
            const currentRes = [...(prev[tournamentId] || [])];
            const idx = currentRes.findIndex(r => r.athlete_name === athleteName && r.round_number === roundNumber);
            let currentVal = 0;
            
            if (idx >= 0) {
                const valStr = field === 'daily_score' ? currentRes[idx].daily_score : String(currentRes[idx].daily_rank);
                if (field === 'daily_score' && valStr?.toUpperCase() === 'C') return prev;
                currentVal = (valStr === null || valStr === 'null') ? (field === 'daily_rank' ? 1 : 0) : parseInt(valStr);
                if (isNaN(currentVal)) currentVal = field === 'daily_rank' ? 1 : 0;
            } else {
                currentVal = field === 'daily_rank' ? 1 : 0;
            }
            
            const newVal = field === 'daily_rank' ? Math.max(1, currentVal + delta) : currentVal + delta;
            handleUpdateResult(tournamentId, athleteName, roundNumber, field, String(newVal));
            return prev;
        });
    };

    const handleSaveTournament = async (tournamentId: string) => {
        try {
            const tournamentResults = results[tournamentId] || [];
            if (tournamentResults.length === 0) return;

            const toSave = tournamentResults.map(r => ({
                tournament_id: r.tournament_id,
                athlete_name: r.athlete_name,
                round_number: r.round_number,
                round_date: r.round_date,
                daily_score: r.daily_score,
                daily_rank: r.daily_rank ? parseInt(String(r.daily_rank)) : null,
                cumulative_score: r.cumulative_score,
                rank: r.rank,
                notes: r.notes
            }));

            await saveTournamentResults(toSave);
            setSavedTournamentId(tournamentId);
            setTimeout(() => setSavedTournamentId(null), 2500);
        } catch (err) {
            console.error("Save failed:", err);
            alert("저장에 실패했습니다.");
        }
    };

    const MONTH_LABEL = `${viewYear}년 ${viewMonth}월`;

    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto min-h-screen font-sans">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-brand-navy rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-navy/10">
                        <Trophy size={22} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">대회 성적 관리</h1>
                        <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">상대 타수(±)를 입력하세요. (C=컷오프)</p>
                    </div>
                </div>
            </div>

            {/* Month Navigator */}
            <div className="flex items-center justify-center gap-4 mb-8 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 px-6 py-3 shadow-sm max-w-sm mx-auto">
                <button onClick={() => navigateMonth("prev")} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-400">
                    <ChevronLeft size={20} />
                </button>
                <span className="text-base font-bold text-zinc-900 dark:text-zinc-50 min-w-[120px] text-center">{MONTH_LABEL}</span>
                <button onClick={() => navigateMonth("next")} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-400">
                    <ChevronRight size={20} />
                </button>
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-24 text-zinc-400 gap-4">
                    <div className="w-10 h-10 border-4 border-brand-navy/20 border-t-brand-navy rounded-full animate-spin"></div>
                    <p className="text-base font-bold">데이터를 불러오는 중...</p>
                </div>
            ) : monthTournaments.length === 0 ? (
                <div className="text-center py-24 bg-white dark:bg-zinc-900 rounded-[3rem] border border-dashed border-zinc-300 dark:border-zinc-800 flex flex-col items-center gap-6 shadow-sm">
                    <Calendar size={60} className="text-zinc-200 dark:text-zinc-800" />
                    <p className="text-zinc-400 text-lg font-bold">이 달에 예정된 대회가 없습니다.</p>
                </div>
            ) : (
                <div className="space-y-12">
                    {monthTournaments.map(t => {
                        const parts = t.date.split("~").map(s => s.trim());
                        const dates = getDatesBetween(parts[0], parts.length > 1 ? parts[1] : parts[0], t.year);
                        const isSaved = savedTournamentId === t.id;
                        const currentRoundIdx = selectedRoundIndices[t.id] || 0;
                        const currentRoundDate = dates[currentRoundIdx];

                        return (
                            <section key={t.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                                {/* Tournament Header + Date Slider */}
                                <div className="px-5 py-4 sm:px-6 bg-zinc-50/50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-4">
                                    <div className="flex flex-col min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] font-bold px-2 py-0.5 bg-brand-navy text-white rounded-md uppercase tracking-wider">{t.category}</span>
                                            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{t.date}</span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 overflow-hidden">
                                            <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-50 truncate">{t.name}</h2>
                                            <div className="hidden sm:block w-px h-4 bg-zinc-200 dark:bg-zinc-700" />
                                            <div className="flex items-center gap-1 text-zinc-400 text-sm sm:text-base font-bold">
                                                <MapPin size={14} className="shrink-0" />
                                                <span className="truncate">{t.venue}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Date Slider */}
                                    <div className="flex items-center gap-1 sm:gap-4 bg-white dark:bg-zinc-900 h-10 px-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm shrink-0">
                                        <button 
                                            onClick={() => navigateRound(t.id, "prev", dates.length)}
                                            disabled={currentRoundIdx === 0}
                                            className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                                        >
                                            <ChevronLeft size={18} />
                                        </button>
                                        <div className="flex flex-col items-center min-w-[50px] sm:min-w-[80px]">
                                            <span className="text-sm sm:text-base font-bold text-brand-navy dark:text-brand-navy-light tracking-tight">
                                                {currentRoundDate.slice(5).replace('-', '/')}
                                            </span>
                                        </div>
                                        <button 
                                            onClick={() => navigateRound(t.id, "next", dates.length)}
                                            disabled={currentRoundIdx === dates.length - 1}
                                            className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                                        >
                                            <ChevronRight size={18} />
                                        </button>
                                    </div>
                                </div>

                                {/* Main Content */}
                                <div className="p-0">
                                    {/* Desktop Table View */}
                                    <div className="hidden md:block overflow-x-auto">
                                        <table className="w-full text-left border-collapse table-fixed">
                                            <thead>
                                                <tr className="bg-zinc-50/30 dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                                                    <th className="px-6 py-3 w-[400px] text-center">선수 / 성적</th>
                                                    <th className="px-0 py-0 text-center bg-zinc-50/50 dark:bg-zinc-800/50 font-bold text-brand-navy w-[240px]">
                                                        <div className="flex divide-x divide-zinc-200/50 dark:divide-zinc-700/50 h-full">
                                                            <div className="flex-1 py-3 text-center">타수</div>
                                                            <div className="flex-1 py-3 text-center">순위</div>
                                                        </div>
                                                    </th>
                                                    <th className="px-6 py-3 text-center">대회 비고</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
                                                {t.players.map(playerName => {
                                                    const athleteRounds = calculateAthleteResults(t.id, playerName, dates.length);
                                                    const currentRes = athleteRounds[currentRoundIdx];
                                                    const playedRounds = athleteRounds.filter(r => r.daily_score && r.daily_score.toUpperCase() !== 'C');
                                                    const finalRound = playedRounds[playedRounds.length - 1];
                                                    
                                                    const finalRank = finalRound?.rank ?? null;
                                                    const finalStrokes = finalRound?.cumulative_strokes ?? null;
                                                    const athleteNotes = athleteRounds[0]?.notes ?? "";
                                                    const isCutoff = currentRes.isCutoff;

                                                    return (
                                                        <tr key={playerName} className="group hover:bg-zinc-50/30 dark:hover:bg-zinc-800/20 transition-colors">
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center justify-between gap-4">
                                                                    <div className="flex items-center gap-2.5 shrink-0">
                                                                        <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
                                                                            <User size={14} />
                                                                        </div>
                                                                        <span className="text-base font-bold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">{playerName}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-3 bg-zinc-100/50 dark:bg-zinc-800/50 rounded-xl py-1.5 px-4 shadow-inner border border-zinc-200/50 dark:border-zinc-700/50 w-[120px] shrink-0 justify-between">
                                                                        <div className="flex items-baseline gap-1">
                                                                            <span className="text-base font-bold text-zinc-900 dark:text-zinc-100">{finalStrokes || "-"}</span>
                                                                            <span className="text-[10px] font-bold text-zinc-400">타</span>
                                                                        </div>
                                                                        <div className="flex items-baseline gap-1">
                                                                            <span className="text-base font-bold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">{finalRank || "-"}</span>
                                                                            <span className="text-[10px] font-bold text-zinc-500">위</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-5 py-4 bg-zinc-50/30 dark:bg-zinc-800/20">
                                                                <div className="flex flex-col gap-2 w-full">
                                                                    <div className="flex items-center gap-2">
                                                                        {/* Strokes Input */}
                                                                        <div className="flex-1">
                                                                            <div className="relative">
                                                                                <input
                                                                                    type="text"
                                                                                    className={cn(
                                                                                        "w-full h-10 px-3 pr-7 border rounded-lg text-center font-bold text-sm outline-none transition-all focus:ring-2 focus:ring-brand-navy/10",
                                                                                        currentRes.daily_score?.toUpperCase() === 'C' ? "bg-red-50 border-red-200 text-red-500 shadow-[0_0_0_1px_rgba(239,68,68,0.1)]" : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 focus:border-brand-navy"
                                                                                    )}
                                                                                    value={currentRes.daily_score ?? ""}
                                                                                    onChange={(e) => handleUpdateResult(t.id, playerName, currentRoundIdx + 1, 'daily_score', e.target.value || null)}
                                                                                />
                                                                                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col items-center">
                                                                                    <button 
                                                                                        onClick={() => adjustValue(t.id, playerName, currentRoundIdx + 1, 'daily_score', 1)}
                                                                                        className="p-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                                                                                    >
                                                                                        <ChevronUp size={10} className="text-zinc-400" />
                                                                                    </button>
                                                                                    <button 
                                                                                        onClick={() => adjustValue(t.id, playerName, currentRoundIdx + 1, 'daily_score', -1)}
                                                                                        className="p-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                                                                                    >
                                                                                        <ChevronDown size={10} className="text-zinc-400" />
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        {/* Rank Input */}
                                                                        <div className="flex-1">
                                                                            <div className="relative">
                                                                                <input
                                                                                    type="text"
                                                                                    className="w-full h-10 px-3 pr-7 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-center font-bold text-sm outline-none focus:ring-2 focus:ring-brand-navy/10 focus:border-brand-navy"
                                                                                    value={currentRes.daily_rank ?? ""}
                                                                                    onChange={(e) => handleUpdateResult(t.id, playerName, currentRoundIdx + 1, 'daily_rank', e.target.value ? parseInt(e.target.value) : null)}
                                                                                />
                                                                                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col items-center">
                                                                                    <button 
                                                                                        onClick={() => adjustValue(t.id, playerName, currentRoundIdx + 1, 'daily_rank', 1)}
                                                                                        className="p-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                                                                                    >
                                                                                        <ChevronUp size={10} className="text-zinc-400" />
                                                                                    </button>
                                                                                    <button 
                                                                                        onClick={() => adjustValue(t.id, playerName, currentRoundIdx + 1, 'daily_rank', -1)}
                                                                                        className="p-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                                                                                    >
                                                                                        <ChevronDown size={10} className="text-zinc-400" />
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    {isCutoff && (
                                                                        <div className="py-0.5 px-2 bg-red-500 text-white text-[9px] font-black rounded-md w-fit mx-auto tracking-widest animate-pulse">
                                                                            CUT OFF
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <input
                                                                    type="text"
                                                                    className="w-full h-10 px-4 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-center font-bold text-sm focus:ring-2 focus:ring-brand-navy/10 focus:border-brand-navy outline-none transition-all shadow-sm"
                                                                    value={athleteNotes}
                                                                    onChange={(e) => handleUpdateResult(t.id, playerName, 1, 'notes', e.target.value)}
                                                                />
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Mobile View */}
                                    <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {t.players.map(playerName => {
                                            const athleteRounds = calculateAthleteResults(t.id, playerName, dates.length);
                                            const currentRes = athleteRounds[currentRoundIdx];
                                            const playedRounds = athleteRounds.filter(r => r.daily_score && r.daily_score.toUpperCase() !== 'C');
                                            const finalRound = playedRounds[playedRounds.length - 1];
                                            
                                            const finalRank = finalRound?.rank ?? null;
                                            const finalStrokes = finalRound?.cumulative_strokes ?? null;
                                            const athleteNotes = athleteRounds[0]?.notes ?? "";
                                            const isCutoff = currentRes.isCutoff;

                                            return (
                                                <div key={playerName} className="p-6 flex flex-col gap-5">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 shadow-inner">
                                                                <User size={22} />
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-xl font-black text-zinc-900 dark:text-zinc-100">{playerName}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-4 bg-zinc-100 dark:bg-zinc-800 h-10 px-4 rounded-2xl shadow-inner border border-zinc-200 dark:border-zinc-700 min-w-[120px] justify-between">
                                                            <div className="flex items-baseline gap-0.5">
                                                                <span className="text-lg font-black text-brand-navy dark:text-brand-navy-light">{finalStrokes || "-"}</span>
                                                                <span className="text-[10px] font-bold text-zinc-400">타</span>
                                                            </div>
                                                            <div className="flex items-baseline gap-0.5">
                                                                <span className="text-lg font-black text-brand-navy dark:text-brand-navy-light">{finalRank || "-"}</span>
                                                                <span className="text-[10px] font-bold text-zinc-400">위</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        {/* Strokes Input (Mobile) */}
                                                        <div className="flex flex-col gap-1.5">
                                                            <span className="text-xs font-black text-zinc-500 px-1 uppercase tracking-widest text-center">타수(±)</span>
                                                            <div className="relative">
                                                                <input
                                                                    type="text"
                                                                    className={cn(
                                                                        "w-full h-10 px-4 pr-10 border rounded-2xl text-center font-black text-lg outline-none focus:ring-4 focus:ring-brand-navy/10",
                                                                        currentRes.daily_score?.toUpperCase() === 'C' ? "bg-red-50 border-red-200 text-red-500" : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
                                                                    )}
                                                                    value={currentRes.daily_score ?? ""}
                                                                    onChange={(e) => handleUpdateResult(t.id, playerName, currentRoundIdx + 1, 'daily_score', e.target.value || null)}
                                                                />
                                                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5">
                                                                    <button 
                                                                        onClick={() => adjustValue(t.id, playerName, currentRoundIdx + 1, 'daily_score', 1)}
                                                                        className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                                                                    >
                                                                        <ChevronUp size={14} className="text-zinc-400" />
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => adjustValue(t.id, playerName, currentRoundIdx + 1, 'daily_score', -1)}
                                                                        className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                                                                    >
                                                                        <ChevronDown size={14} className="text-zinc-400" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {/* Rank Input (Mobile) */}
                                                        <div className="flex flex-col gap-1.5">
                                                            <span className="text-xs font-black text-zinc-500 px-1 uppercase tracking-widest text-center">순위</span>
                                                            <div className="relative">
                                                                <input
                                                                    type="text"
                                                                    className="w-full h-10 px-4 pr-10 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-center font-bold text-lg outline-none focus:ring-4 focus:ring-brand-navy/10"
                                                                    value={currentRes.daily_rank ?? ""}
                                                                    onChange={(e) => handleUpdateResult(t.id, playerName, currentRoundIdx + 1, 'daily_rank', e.target.value ? parseInt(e.target.value) : null)}
                                                                />
                                                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5">
                                                                    <button 
                                                                        onClick={() => adjustValue(t.id, playerName, currentRoundIdx + 1, 'daily_rank', 1)}
                                                                        className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                                                                    >
                                                                        <ChevronUp size={14} className="text-zinc-400" />
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => adjustValue(t.id, playerName, currentRoundIdx + 1, 'daily_rank', -1)}
                                                                        className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                                                                    >
                                                                        <ChevronDown size={14} className="text-zinc-400" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    {isCutoff && (
                                                        <div className="bg-red-500 text-white py-2 rounded-xl text-center shadow-lg shadow-red-500/20">
                                                            <span className="text-xs font-black tracking-[0.2em] uppercase">CUT OFF</span>
                                                        </div>
                                                    )}

                                                    <input
                                                        type="text"
                                                        className="w-full h-10 px-5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-3xl text-center font-black focus:ring-4 focus:ring-brand-navy/10 focus:border-brand-navy outline-none transition-all shadow-sm"
                                                        value={athleteNotes}
                                                        onChange={(e) => handleUpdateResult(t.id, playerName, 1, 'notes', e.target.value)}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Tournament Footer */}
                                <div className="px-5 py-4 sm:px-6 bg-zinc-50/50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
                                    <button
                                        onClick={() => handleSaveTournament(t.id)}
                                        className={cn(
                                            "w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 rounded-xl text-sm font-bold transition-all active:scale-95 shadow-lg",
                                            isSaved ? "bg-emerald-500 text-white shadow-emerald-500/10" : "bg-brand-navy hover:bg-brand-navy-dark text-white shadow-brand-navy/20"
                                        )}
                                    >
                                        {isSaved ? <Check size={18} /> : <Save size={18} />}
                                        {isSaved ? "저장 완료" : "이 대회 저장"}
                                    </button>
                                </div>
                            </section>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
