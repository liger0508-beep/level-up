"use client";

import React, { useEffect, useState } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface CrossCheckSignatureModalProps {
    isOpen: boolean;
    onClose: () => void;
    tournamentId: string;
    athleteId: string;
    athleteName: string;
    scorecardId: string;
    onSignAsPlayer?: () => void;
    onCancelMarkerSig?: () => void;
    hasPlayerSig: boolean;
    hasMarkerSig: boolean;
}

export function CrossCheckSignatureModal({ 
    isOpen, onClose, tournamentId, athleteId, athleteName, scorecardId,
    onSignAsPlayer, onRequestCorrection, hasPlayerSig, hasMarkerSig 
}: CrossCheckSignatureModalProps & { onRequestCorrection?: () => void }) {
    const [loading, setLoading] = useState(true);
    const [scorecard, setScorecard] = useState<any>(null);
    const [markerScores, setMarkerScores] = useState<Record<number, number>>({});
    const [markerPars, setMarkerPars] = useState<Record<number, number>>({});
    const [hasDiscrepancy, setHasDiscrepancy] = useState(false);

    useEffect(() => {
        if (!isOpen || !scorecardId) return;
        
        const fetchData = async () => {
            setLoading(true);
            const supabase = createClient();
            
            // 1. Fetch Official Scorecard (Marker's Input)
            const { data: officialSc } = await supabase
                .from("scorecards")
                .select(`
                    id, 
                    marker_scores:tournament_marker_scores(hole_number, score),
                    holes:scorecard_holes(hole_number, par)
                `)
                .eq("id", scorecardId)
                .single();

            // 2. Fetch Athlete's Self-Drafted Scorecard (My Score)
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
            let discrepancyFound = false;

            if (officialSc?.marker_scores) {
                officialSc.marker_scores.forEach((m: any) => {
                    mkMap[m.hole_number] = m.score;
                });
            }
            if (officialSc?.holes) {
                officialSc.holes.forEach((p: any) => {
                    mkParMap[p.hole_number] = p.par;
                });
            }
            
            setMarkerScores(mkMap);
            setMarkerPars(mkParMap);

            if (selfScData?.holes) {
                selfScData.holes.forEach((h: any) => {
                    const mScore = mkMap[h.hole_number];
                    const mPar = mkParMap[h.hole_number];
                    if (
                        (mScore !== undefined && h.score !== mScore) ||
                        (mScore !== undefined && mPar !== undefined && h.par !== mPar)
                    ) {
                        discrepancyFound = true;
                    }
                });
            }
            setHasDiscrepancy(discrepancyFound);
            
            setLoading(false);
        };

        fetchData();
    }, [isOpen, scorecardId]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-3xl bg-white dark:bg-zinc-900 rounded-[2rem] shadow-xl overflow-hidden relative flex flex-col max-h-[85vh]">
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 z-10 shrink-0">
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        교차 검증 (Cross-Check) <span className="text-zinc-400 text-sm font-semibold ml-2">({athleteName})</span>
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-48 gap-3">
                            <Loader2 className="w-8 h-8 text-brand-navy animate-spin" />
                            <p className="text-sm font-semibold text-zinc-500">스코어를 비교하는 중입니다...</p>
                        </div>
                    ) : !scorecard ? (
                        <div className="flex flex-col items-center justify-center h-48 text-zinc-500">
                            <p>스코어 정보가 없습니다.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {hasDiscrepancy && (
                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-2xl p-4 flex gap-3 text-red-600 dark:text-red-400">
                                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                                    <div className="text-sm font-semibold flex items-center">
                                        <p>스코어 또는 PAR 정보가 일치하지 않는 홀이 있습니다</p>
                                    </div>
                                </div>
                            )}
                            
                            {(() => {
                                const renderDualScore = (start: number, end: number) => {
                                    const parCells = [];
                                    const pScoreCells = [];
                                    const mScoreCells = [];
                                    let pSum = 0;
                                    let mSum = 0;
                                    let parSum = 0;

                                    for (let i = start; i <= end; i++) {
                                        const hole = scorecard.holes?.find((h: any) => h.hole_number === i);
                                        const pScore = hole?.score || 0;
                                        const mScore = markerScores[i] || 0;
                                        const mPar = markerPars[i] || 0;
                                        const par = hole?.par || mPar; // fallback to mPar if self score has no par
                                        
                                        parSum += par;
                                        pSum += pScore;
                                        mSum += mScore;

                                        const isScoreMismatch = pScore !== mScore && mScore > 0 && pScore > 0;
                                        const isParMismatch = par !== mPar && mPar > 0 && par > 0 && mScore > 0;

                                        const scoreMismatchBg = isScoreMismatch ? "bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300" : "";
                                        const parMismatchBg = isParMismatch ? "bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 font-bold" : "";

                                        parCells.push(
                                            <td key={i} className={`px-1 sm:px-2 py-1.5 sm:py-2 text-[10px] sm:text-[12px] min-w-[20px] sm:min-w-[36px] ${parMismatchBg}`}>
                                                {isParMismatch ? mPar : (par || "-")}
                                            </td>
                                        );
                                        const renderGolfScore = (score: number, parVal: number, bgClass: string, isMyScore: boolean) => {
                                            if (score === 0 || parVal === 0) return <td key={i} className={`px-1 sm:px-2 py-2 sm:py-2.5 font-bold ${bgClass}`}>-</td>;
                                            
                                            const diff = score - parVal;
                                            
                                            // 텍스트 색상
                                            let textClass = isMyScore ? "text-blue-600 dark:text-blue-400" : "text-zinc-700 dark:text-zinc-300";
                                            if (diff <= -2) textClass = "text-orange-600 dark:text-orange-400";
                                            else if (diff === -1) textClass = "text-yellow-600 dark:text-yellow-500";
                                            else if (diff === 1) textClass = "text-sky-600 dark:text-sky-400";
                                            else if (diff >= 2) textClass = "text-sky-700 dark:text-sky-300";

                                            return (
                                                <td key={i} className={`px-0 sm:px-2 py-1 sm:py-1.5 align-middle ${bgClass}`}>
                                                    <div className="relative inline-flex items-center justify-center w-5 h-5 sm:w-7 sm:h-7 mx-auto">
                                                        <span className={`relative z-10 font-bold sm:font-black tracking-tighter text-[11px] sm:text-[13px] ${textClass}`}>
                                                            {score}
                                                        </span>
                                                        {diff <= -2 && (
                                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                                <div className="w-[110%] h-[110%] rounded-full border-[1.5px] border-orange-400/80 absolute" />
                                                                <div className="w-[85%] h-[85%] rounded-full border-[1.5px] border-orange-400/80 absolute" />
                                                            </div>
                                                        )}
                                                        {diff === -1 && (
                                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                                <div className="w-full h-full rounded-full border-[1.5px] border-yellow-400/80 absolute" />
                                                            </div>
                                                        )}
                                                        {diff === 1 && (
                                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                                <div className="w-[90%] h-[90%] border-[1.5px] border-sky-400/80 absolute" />
                                                            </div>
                                                        )}
                                                        {diff >= 2 && (
                                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                                <div className="w-[100%] h-[100%] border-[1.5px] border-sky-400/80 absolute" />
                                                                <div className="w-[80%] h-[80%] border-[1.5px] border-sky-400/80 absolute" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            );
                                        };

                                        pScoreCells.push(renderGolfScore(pScore, par, scoreMismatchBg, true));
                                        mScoreCells.push(renderGolfScore(mScore, mPar, scoreMismatchBg, false));
                                    }
                                    return { parCells, pScoreCells, mScoreCells, pSum, mSum, parSum };
                                };

                                const outRes = renderDualScore(1, 9);
                                const inRes = renderDualScore(10, 18);

                                const renderTable = (label: string, res: any) => (
                                    <div className="border border-zinc-200 dark:border-zinc-700 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 shadow-sm">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-center text-[10px] sm:text-sm min-w-full">
                                                <thead>
                                                    <tr className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 font-bold text-zinc-600 dark:text-zinc-300">
                                                        <th className="px-1 sm:px-3 py-2 w-14 sm:w-20 bg-zinc-100 dark:bg-zinc-900/50 border-r border-zinc-200 dark:border-zinc-700 whitespace-nowrap">HOLE</th>
                                                        {Array.from({length: 9}).map((_, idx) => (
                                                            <th key={idx} className="px-1 py-2 min-w-[22px] sm:min-w-[36px]">
                                                                {label === 'OUT' ? idx + 1 : idx + 10}
                                                            </th>
                                                        ))}
                                                        <th className="px-1 sm:px-3 py-2 bg-zinc-100 dark:bg-zinc-900/50 border-l border-zinc-200 dark:border-zinc-700 text-brand-navy w-12 sm:w-16 whitespace-nowrap">{label}</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-500 font-semibold bg-white dark:bg-zinc-900">
                                                        <td className="px-1 sm:px-3 py-1.5 bg-zinc-50/50 dark:bg-zinc-800/30 border-r border-zinc-200 dark:border-zinc-700 text-[10px] sm:text-[12px]">PAR</td>
                                                        {res.parCells}
                                                        <td className="px-1 sm:px-3 py-1.5 bg-zinc-50/50 dark:bg-zinc-800/30 border-l border-zinc-200 dark:border-zinc-700">{res.parSum || "-"}</td>
                                                    </tr>
                                                    <tr className="border-b border-zinc-100 dark:border-zinc-800 font-bold text-blue-600 dark:text-blue-400 bg-white dark:bg-zinc-900">
                                                        <td className="px-1 sm:px-3 py-2 bg-zinc-50/50 dark:bg-zinc-800/30 border-r border-zinc-200 dark:border-zinc-700 whitespace-nowrap text-[10px] sm:text-xs">내 스코어</td>
                                                        {res.pScoreCells}
                                                        <td className="px-1 sm:px-3 py-2 bg-zinc-50/50 dark:bg-zinc-800/30 border-l border-zinc-200 dark:border-zinc-700 text-blue-700 dark:text-blue-300">{res.pSum || "-"}</td>
                                                    </tr>
                                                    <tr className="font-bold text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-900">
                                                        <td className="px-1 sm:px-3 py-2 bg-zinc-50/50 dark:bg-zinc-800/30 border-r border-zinc-200 dark:border-zinc-700 whitespace-nowrap text-[10px] sm:text-xs">마커 입력</td>
                                                        {res.mScoreCells}
                                                        <td className="px-1 sm:px-3 py-2 bg-zinc-50/50 dark:bg-zinc-800/30 border-l border-zinc-200 dark:border-zinc-700">{res.mSum || "-"}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );

                                return (
                                    <>
                                        {renderTable('OUT', outRes)}
                                        {renderTable('IN', inRes)}
                                        
                                        {/* Action Buttons */}
                                        <div className="flex items-center justify-end gap-2 sm:gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-6 overflow-x-auto no-scrollbar">
                                            {hasDiscrepancy ? (
                                                <>
                                                    <button 
                                                        onClick={onRequestCorrection}
                                                        className="px-3 sm:px-4 py-3 rounded-xl font-bold bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 hover:bg-red-100 dark:hover:bg-red-900/40 shadow-sm transition-colors whitespace-nowrap text-[13px] sm:text-sm flex-1"
                                                    >
                                                        수정 요청
                                                    </button>

                                                    {!hasPlayerSig && onSignAsPlayer && (
                                                        <button 
                                                            onClick={onSignAsPlayer}
                                                            className="px-3 sm:px-4 py-3 rounded-xl font-bold bg-brand-red hover:bg-brand-red-dark text-white shadow-sm transition-colors whitespace-nowrap text-[13px] sm:text-sm flex-1"
                                                        >
                                                            서명하기
                                                        </button>
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    {!hasPlayerSig && onSignAsPlayer && (
                                                        <button 
                                                            onClick={onSignAsPlayer}
                                                            className="px-3 sm:px-6 py-3 rounded-xl font-bold bg-brand-navy hover:bg-brand-navy/90 text-white shadow-sm transition-colors whitespace-nowrap text-[13px] sm:text-base flex-1 sm:flex-none"
                                                        >
                                                            선수 확인 및 서명하기
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
