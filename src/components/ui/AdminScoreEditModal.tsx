"use client";

import React, { useEffect, useState } from 'react';
import { X, Loader2, AlertCircle, Save, Pencil, Edit3 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface AdminScoreEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    tournamentId: string;
    athleteId: string;
    athleteName: string;
    scorecardId: string;
    onSaveSuccess?: () => void;
}

export function AdminScoreEditModal({ 
    isOpen, onClose, tournamentId, athleteId, athleteName, scorecardId, onSaveSuccess
}: AdminScoreEditModalProps) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [scorecard, setScorecard] = useState<any>(null);
    const [markerScores, setMarkerScores] = useState<Record<number, number>>({});
    const [markerPars, setMarkerPars] = useState<Record<number, number>>({});
    const [hasDiscrepancy, setHasDiscrepancy] = useState(false);

    // Edit state using a popup pad
    const [editTarget, setEditTarget] = useState<{ holeNumber: number, par: number, score: number } | null>(null);

    const [originalMarkerScores, setOriginalMarkerScores] = useState<any[]>([]);
    const [originalPars, setOriginalPars] = useState<any[]>([]);

    useEffect(() => {
        if (!isOpen || !scorecardId) return;
        fetchData();
    }, [isOpen, scorecardId]);

    const [roundNumber, setRoundNumber] = useState<number>(1);

    const fetchData = async () => {
        setLoading(true);
        const supabase = createClient();
        
        const { data: officialSc } = await supabase
            .from("scorecards")
            .select(`
                id, 
                tournament_round,
                marker_scores:tournament_marker_scores(*),
                holes:scorecard_holes(*)
            `)
            .eq("id", scorecardId)
            .single();

        if (officialSc?.tournament_round) {
            setRoundNumber(officialSc.tournament_round);
        }

        const { data: selfScData } = await supabase
            .from("scorecards")
            .select(`
                id, total_score, hole_count, is_final,
                holes:scorecard_holes(id, hole_number, par, score)
            `)
            .eq("tournament_id", tournamentId)
            .eq("athlete_id", athleteId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (selfScData) {
            if (selfScData.holes) {
                selfScData.holes.sort((a: any, b: any) => a.hole_number - b.hole_number);
            }
            setScorecard(selfScData);
        } else {
            setScorecard({ holes: [] });
        }

        const mkMap: Record<number, number> = {};
        const mkParMap: Record<number, number> = {};

        if (officialSc?.marker_scores) {
            setOriginalMarkerScores(officialSc.marker_scores);
            officialSc.marker_scores.forEach((m: any) => {
                mkMap[m.hole_number] = m.score;
            });
        }
        if (officialSc?.holes) {
            setOriginalPars(officialSc.holes);
            officialSc.holes.forEach((p: any) => {
                mkParMap[p.hole_number] = p.par;
            });
        }
        
        // Ensure all 18 holes exist in map if not present
        for(let i=1; i<=18; i++) {
            if (mkMap[i] === undefined) mkMap[i] = 0;
            if (mkParMap[i] === undefined) mkParMap[i] = selfScData?.holes?.find((h:any)=>h.hole_number===i)?.par || 0;
        }

        setMarkerScores(mkMap);
        setMarkerPars(mkParMap);

        checkDiscrepancy(mkMap, mkParMap, selfScData);
        setLoading(false);
    };

    const checkDiscrepancy = (mkMap: Record<number, number>, mkParMap: Record<number, number>, selfSc: any) => {
        let discrepancyFound = false;
        if (selfSc?.holes) {
            selfSc.holes.forEach((h: any) => {
                const mScore = mkMap[h.hole_number];
                const mPar = mkParMap[h.hole_number];
                if (
                    (mScore !== undefined && h.score !== mScore && mScore > 0 && h.score > 0) ||
                    (mScore !== undefined && mPar !== undefined && h.par !== mPar && mPar > 0 && h.par > 0)
                ) {
                    discrepancyFound = true;
                }
            });
        }
        setHasDiscrepancy(discrepancyFound);
    };

    const handleCellClick = (holeNumber: number, par: number, score: number) => {
        setEditTarget({ holeNumber, par, score });
    };

    const saveChanges = async () => {
        setSaving(true);
        try {
            const supabase = createClient();
            
            // Upsert marker scores
            const scoresToUpsert = Object.keys(markerScores).map(hNumStr => {
                const hNum = parseInt(hNumStr);
                const original = originalMarkerScores.find(m => m.hole_number === hNum) || { putts: 0 };
                return {
                    ...original,
                    scorecard_id: scorecardId,
                    hole_number: hNum,
                    score: markerScores[hNum]
                };
            });

            const { error: scoresError } = await supabase
                .from("tournament_marker_scores")
                .upsert(scoresToUpsert);
            if (scoresError) throw scoresError;

            // Upsert marker pars
            const parsToUpsert = Object.keys(markerPars).map(hNumStr => {
                const hNum = parseInt(hNumStr);
                const original = originalPars.find(p => p.hole_number === hNum) || {};
                return {
                    ...original,
                    scorecard_id: scorecardId,
                    hole_number: hNum,
                    par: markerPars[hNum]
                };
            });

            const { error: parsError } = await supabase
                .from("scorecard_holes")
                .upsert(parsToUpsert);
            if (parsError) throw parsError;

            // Update total score in scorecards
            let total = 0;
            let thruCount = 0;
            Object.values(markerScores).forEach(s => {
                if (s > 0) {
                    total += s;
                    thruCount++;
                }
            });
            
            const { error: updateError } = await supabase
                .from("scorecards")
                .update({ 
                    total_score: total,
                    is_final: thruCount === 18
                })
                .eq("id", scorecardId);

            if (updateError) throw updateError;

            // Update tournament_leaderboards for Live Leaderboard display
            if (tournamentId && athleteId) {
                const { error: lbError } = await supabase
                    .from("tournament_leaderboards")
                    .upsert({
                        tournament_id: tournamentId,
                        athlete_id: athleteId,
                        round_number: roundNumber || 1,
                        thru_hole: thruCount,
                        total_score: total,
                        updated_at: new Date().toISOString()
                    }, { onConflict: "tournament_id,athlete_id,round_number" });

                if (lbError) {
                    console.error("리더보드 업데이트 오류:", lbError);
                }
            }
            
            alert("수정사항이 성공적으로 저장되었습니다.");
            if (onSaveSuccess) onSaveSuccess();
            onClose();
        } catch(e: any) {
            console.error(e);
            alert("저장 중 오류가 발생했습니다: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-3xl bg-white dark:bg-zinc-900 rounded-[2rem] shadow-xl overflow-hidden relative flex flex-col max-h-[85vh]">
                
                <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 z-10 shrink-0">
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        스코어 수정 <span className="text-zinc-400 text-sm font-semibold ml-2">({athleteName})</span>
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="px-3 py-5 sm:p-6 overflow-y-auto flex-1 relative">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-48 gap-3">
                            <Loader2 className="w-8 h-8 text-brand-navy animate-spin" />
                            <p className="text-sm font-semibold text-zinc-500">정보를 불러오는 중입니다...</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {(() => {
                                const renderDualScore = (start: number, end: number) => {
                                    const parCells = [];
                                    const pScoreCells = [];
                                    const mScoreCells = [];
                                    let pSum = 0;
                                    let mSum = 0;
                                    let parSum = 0;

                                    for (let i = start; i <= end; i++) {
                                        const hole = scorecard?.holes?.find((h: any) => h.hole_number === i);
                                        const pScore = hole?.score || 0;
                                        const mScore = markerScores[i] || 0;
                                        const mPar = markerPars[i] || 0;
                                        const par = hole?.par || mPar; 
                                        
                                        parSum += mPar; // Use editable marker par for sum
                                        pSum += pScore;
                                        mSum += mScore;

                                        const isScoreMismatch = pScore !== mScore && mScore > 0 && pScore > 0;
                                        const isParMismatch = par !== mPar && mPar > 0 && par > 0 && mScore > 0;

                                        const scoreMismatchBg = isScoreMismatch ? "bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300" : "";
                                        const parMismatchBg = isParMismatch ? "bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 font-bold" : "";

                                        // Editable PAR
                                        parCells.push(
                                            <td 
                                                key={i} 
                                                className={`px-0 sm:px-1.5 py-1.5 sm:py-2 text-[10px] sm:text-[13px] cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 ${parMismatchBg}`}
                                                onClick={() => handleCellClick(i, mPar, mScore)}
                                            >
                                                {mPar || "-"}
                                            </td>
                                        );
                                        
                                        // Player Score (Read-only)
                                        pScoreCells.push(
                                            <td key={i} className={`px-0 sm:px-1.5 py-1.5 sm:py-2.5 font-bold text-[10px] sm:text-[13px] ${scoreMismatchBg}`}>
                                                {pScore || "-"}
                                            </td>
                                        );

                                        // Marker Score (Editable via Popup) - 회색 네모칸만 유지, 아이콘 삭제
                                        mScoreCells.push(
                                            <td 
                                                key={i} 
                                                className={`px-0.5 sm:px-1 py-1 sm:py-1.5 align-middle cursor-pointer transition-colors ${scoreMismatchBg}`}
                                                onClick={() => handleCellClick(i, mPar, mScore)}
                                            >
                                                <div className="relative flex items-center justify-center w-full max-w-[26px] sm:max-w-[34px] h-6 sm:h-7.5 rounded bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200/90 dark:border-zinc-700/80 hover:border-brand-navy hover:bg-brand-navy/5 dark:hover:bg-brand-navy/20 hover:shadow-xs transition-all mx-auto">
                                                    <span className="font-bold sm:font-black tracking-tighter text-[11px] sm:text-[13px] text-zinc-800 dark:text-zinc-100">
                                                        {mScore || "-"}
                                                    </span>
                                                </div>
                                            </td>
                                        );
                                    }
                                    return { parCells, pScoreCells, mScoreCells, pSum, mSum, parSum };
                                };

                                const outRes = renderDualScore(1, 9);
                                const inRes = renderDualScore(10, 18);
                                const totalScore = (outRes.mSum || 0) + (inRes.mSum || 0);
                                const totalPar = (outRes.parSum || 0) + (inRes.parSum || 0);
                                const totalDiff = totalPar > 0 ? totalScore - totalPar : 0;
                                const diffDisplay = totalDiff === 0 ? "E" : totalDiff > 0 ? `+${totalDiff}` : `${totalDiff}`;

                                const renderTable = (label: string, res: any) => (
                                    <div className="border border-zinc-200 dark:border-zinc-700 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 shadow-sm w-full">
                                        <div className="overflow-hidden">
                                            <table className="w-full table-fixed text-center text-[9px] sm:text-sm">
                                                <thead>
                                                    <tr className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 font-bold text-zinc-600 dark:text-zinc-300">
                                                        <th className="px-0 sm:px-2 py-2 sm:py-3 w-11 sm:w-16 bg-zinc-100 dark:bg-zinc-900/50 border-r border-zinc-200 dark:border-zinc-700 whitespace-nowrap overflow-hidden">HOLE</th>
                                                        {Array.from({length: 9}).map((_, idx) => (
                                                            <th key={idx} className="px-0 py-2 sm:py-3 truncate font-semibold">
                                                                {label === 'OUT' ? idx + 1 : idx + 10}
                                                            </th>
                                                        ))}
                                                        <th className="px-0 sm:px-2 py-2 sm:py-3 bg-zinc-100 dark:bg-zinc-900/50 border-l border-zinc-200 dark:border-zinc-700 text-brand-navy w-9 sm:w-14 whitespace-nowrap overflow-hidden font-bold">{label}</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-500 font-semibold bg-white dark:bg-zinc-900">
                                                        <td className="px-0 sm:px-2 py-1.5 sm:py-2 bg-zinc-50/50 dark:bg-zinc-800/30 border-r border-zinc-200 dark:border-zinc-700 overflow-hidden text-[9px] sm:text-xs">PAR</td>
                                                        {res.parCells}
                                                        <td className="px-0 sm:px-2 py-1.5 sm:py-2 bg-zinc-50/50 dark:bg-zinc-800/30 border-l border-zinc-200 dark:border-zinc-700 overflow-hidden font-semibold">{res.parSum || "-"}</td>
                                                    </tr>
                                                    <tr className="border-b border-zinc-100 dark:border-zinc-800 font-bold text-blue-600 dark:text-blue-400 bg-white dark:bg-zinc-900">
                                                        <td className="px-0 sm:px-2 py-1.5 sm:py-2 bg-zinc-50/50 dark:bg-zinc-800/30 border-r border-zinc-200 dark:border-zinc-700 whitespace-nowrap overflow-hidden text-[9px] sm:text-xs">선수 입력</td>
                                                        {res.pScoreCells}
                                                        <td className="px-0 sm:px-2 py-1.5 sm:py-2 bg-zinc-50/50 dark:bg-zinc-800/30 border-l border-zinc-200 dark:border-zinc-700 text-blue-700 dark:text-blue-300 overflow-hidden font-bold">{res.pSum || "-"}</td>
                                                    </tr>
                                                    <tr className="font-bold text-zinc-800 dark:text-zinc-200 bg-amber-50/30 dark:bg-amber-950/10">
                                                        <td className="px-0 sm:px-2 py-1.5 sm:py-2 bg-amber-100/50 dark:bg-amber-900/20 border-r border-zinc-200 dark:border-zinc-700 whitespace-nowrap overflow-hidden text-[9px] sm:text-xs text-amber-800 dark:text-amber-400">
                                                            마커 입력
                                                        </td>
                                                        {res.mScoreCells}
                                                        <td className="px-0 sm:px-2 py-1.5 sm:py-2 bg-zinc-50/50 dark:bg-zinc-800/30 border-l border-zinc-200 dark:border-zinc-700 font-black overflow-hidden">{res.mSum || "-"}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );

                                return (
                                    <>
                                        {/* Summary Card (OUT, IN, TOTAL) */}
                                        <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800 shadow-xs">
                                            <div className="flex flex-col items-center flex-1 border-r border-zinc-200 dark:border-zinc-700">
                                                <span className="text-[10px] sm:text-xs font-bold text-zinc-400 mb-0.5">OUT</span>
                                                <span className="text-sm sm:text-base font-black text-zinc-900 dark:text-white">{outRes.mSum || "-"}</span>
                                            </div>
                                            <div className="flex flex-col items-center flex-1 border-r border-zinc-200 dark:border-zinc-700">
                                                <span className="text-[10px] sm:text-xs font-bold text-zinc-400 mb-0.5">IN</span>
                                                <span className="text-sm sm:text-base font-black text-zinc-900 dark:text-white">{inRes.mSum || "-"}</span>
                                            </div>
                                            <div className="flex flex-col items-center flex-1">
                                                <span className="text-[10px] sm:text-xs font-bold text-brand-navy dark:text-brand-navy-light mb-0.5">TOTAL</span>
                                                <span className="text-sm sm:text-base font-black text-brand-navy dark:text-brand-navy-light flex items-center justify-center gap-1">
                                                    <span>{totalScore || "-"}</span>
                                                    {totalScore > 0 && totalPar > 0 && (
                                                        <span className="text-xs sm:text-sm font-bold">
                                                            ({diffDisplay})
                                                        </span>
                                                    )}
                                                </span>
                                            </div>
                                        </div>

                                        {renderTable('OUT', outRes)}
                                        {renderTable('IN', inRes)}
                                        
                                        <div className="flex items-center justify-end gap-2 sm:gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-6 overflow-x-auto no-scrollbar">
                                            <button 
                                                onClick={saveChanges}
                                                disabled={saving}
                                                className="px-6 py-3 rounded-xl font-bold bg-brand-navy hover:bg-brand-navy/90 text-white shadow-sm transition-colors whitespace-nowrap text-[13px] sm:text-base flex items-center gap-2 disabled:opacity-50"
                                            >
                                                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                                변경사항 저장하기
                                            </button>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    )}
                </div>

                {/* Numpad Popup Modal */}
                {editTarget && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-[2px] p-4">
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-6 w-full max-w-xs animate-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-lg text-zinc-800 dark:text-zinc-100">
                                    {editTarget.holeNumber}번 홀 수정
                                </h3>
                                <button onClick={() => setEditTarget(null)} className="p-1 text-zinc-400 hover:text-zinc-600">
                                    <X size={20} />
                                </button>
                            </div>
                            
                            {/* PAR Edit */}
                            <div className="mb-4">
                                <div className="text-xs font-bold text-zinc-500 mb-1 ml-1">PAR</div>
                                <div className="flex items-center justify-between bg-zinc-100 dark:bg-zinc-800 rounded-2xl p-2">
                                    <button 
                                        onClick={() => setEditTarget(prev => prev ? { ...prev, par: Math.max(0, prev.par - 1) } : null)}
                                        className="w-12 h-12 flex items-center justify-center rounded-xl bg-white dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-xl font-black shadow-sm active:scale-95 transition-all"
                                    >
                                        -
                                    </button>
                                    <span className="text-3xl font-black text-brand-navy dark:text-brand-navy-light w-16 text-center tracking-tighter">
                                        {editTarget.par > 0 ? editTarget.par : "-"}
                                    </span>
                                    <button 
                                        onClick={() => setEditTarget(prev => prev ? { ...prev, par: prev.par + 1 } : null)}
                                        className="w-12 h-12 flex items-center justify-center rounded-xl bg-white dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-xl font-black shadow-sm active:scale-95 transition-all"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>

                            {/* SCORE Edit */}
                            <div className="mb-6">
                                <div className="text-xs font-bold text-zinc-500 mb-1 ml-1">스코어</div>
                                <div className="flex items-center justify-between bg-zinc-100 dark:bg-zinc-800 rounded-2xl p-2">
                                    <button 
                                        onClick={() => setEditTarget(prev => prev ? { ...prev, score: Math.max(0, prev.score - 1) } : null)}
                                        className="w-12 h-12 flex items-center justify-center rounded-xl bg-white dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-xl font-black shadow-sm active:scale-95 transition-all"
                                    >
                                        -
                                    </button>
                                    <span className="text-3xl font-black text-brand-navy dark:text-brand-navy-light w-16 text-center tracking-tighter">
                                        {editTarget.score > 0 ? editTarget.score : "-"}
                                    </span>
                                    <button 
                                        onClick={() => setEditTarget(prev => prev ? { ...prev, score: prev.score + 1 } : null)}
                                        className="w-12 h-12 flex items-center justify-center rounded-xl bg-white dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-xl font-black shadow-sm active:scale-95 transition-all"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => setEditTarget(prev => prev ? { ...prev, par: 0, score: 0 } : null)}
                                    className="flex-1 py-3.5 rounded-xl font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 shadow-sm"
                                >
                                    초기화
                                </button>
                                <button
                                    onClick={() => {
                                        setMarkerPars(prev => ({ ...prev, [editTarget.holeNumber]: editTarget.par }));
                                        setMarkerScores(prev => ({ ...prev, [editTarget.holeNumber]: editTarget.score }));
                                        checkDiscrepancy(
                                            { ...markerScores, [editTarget.holeNumber]: editTarget.score },
                                            { ...markerPars, [editTarget.holeNumber]: editTarget.par },
                                            scorecard
                                        );
                                        setEditTarget(null);
                                    }}
                                    className="flex-[2] py-3.5 rounded-xl font-bold text-white bg-brand-navy hover:bg-brand-navy/90 shadow-sm"
                                >
                                    적용하기
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
