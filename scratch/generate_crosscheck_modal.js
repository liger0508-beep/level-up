const fs = require('fs');
const path = require('path');

const fileContent = `"use client";

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
    onSignAsPlayer, onCancelMarkerSig, hasPlayerSig, hasMarkerSig 
}: CrossCheckSignatureModalProps) {
    const [loading, setLoading] = useState(true);
    const [scorecard, setScorecard] = useState<any>(null);
    const [markerScores, setMarkerScores] = useState<Record<number, number>>({});
    const [hasDiscrepancy, setHasDiscrepancy] = useState(false);

    useEffect(() => {
        if (!isOpen || !scorecardId) return;
        
        const fetchData = async () => {
            setLoading(true);
            const supabase = createClient();
            
            // 1. Fetch Scorecard with Holes (Player Score)
            const { data: scData } = await supabase
                .from("scorecards")
                .select(\`
                    id, total_score, hole_count, is_final,
                    holes:scorecard_holes(id, hole_number, par, score)
                \`)
                .eq("id", scorecardId)
                .single();

            // 2. Fetch Marker Scores
            const { data: mkData } = await supabase
                .from("tournament_marker_scores")
                .select("hole_number, score")
                .eq("scorecard_id", scorecardId);

            if (scData) {
                if (scData.holes) {
                    scData.holes.sort((a: any, b: any) => a.hole_number - b.hole_number);
                }
                setScorecard(scData);
            }

            const mkMap: Record<number, number> = {};
            let discrepancyFound = false;

            if (mkData) {
                mkData.forEach(m => {
                    mkMap[m.hole_number] = m.score;
                });
            }
            setMarkerScores(mkMap);

            if (scData?.holes) {
                scData.holes.forEach((h: any) => {
                    if (h.score !== mkMap[h.hole_number] && mkMap[h.hole_number] !== undefined) {
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
                                    <div className="text-sm font-semibold">
                                        <p>스코어가 일치하지 않는 홀이 있습니다 (핑크색 표시).</p>
                                        <p className="text-red-500/80 mt-1">스코어 입력자(마커)와 상의하여 수정한 후 다시 서명해 주세요.</p>
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
                                        const par = hole?.par || 0;
                                        const pScore = hole?.score || 0;
                                        const mScore = markerScores[i] || 0;
                                        
                                        parSum += par;
                                        pSum += pScore;
                                        mSum += mScore;

                                        const isMismatch = pScore !== mScore && mScore > 0 && pScore > 0;
                                        const mismatchBg = isMismatch ? "bg-pink-100 dark:bg-pink-900/30" : "";

                                        parCells.push(<td key={i} className="px-1 sm:px-2 py-1.5 sm:py-2 text-[10px] sm:text-[12px] min-w-[20px] sm:min-w-[36px]">{par || "-"}</td>);
                                        pScoreCells.push(<td key={i} className={\`px-1 sm:px-2 py-2 sm:py-2.5 font-bold \${mismatchBg}\`}>{pScore > 0 ? pScore : "-"}</td>);
                                        mScoreCells.push(<td key={i} className={\`px-1 sm:px-2 py-2 sm:py-2.5 font-bold \${mismatchBg}\`}>{mScore > 0 ? mScore : "-"}</td>);
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
                                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-6">
                                            {hasDiscrepancy ? (
                                                <>
                                                    <button 
                                                        onClick={onCancelMarkerSig}
                                                        className="px-6 py-3 rounded-xl font-bold bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 shadow-sm transition-colors"
                                                    >
                                                        마커 서명 취소 후 수정
                                                    </button>
                                                    <button disabled className="px-6 py-3 rounded-xl font-bold bg-zinc-200 text-zinc-400 cursor-not-allowed">
                                                        선수 서명하기
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    {!hasPlayerSig && onSignAsPlayer && (
                                                        <button 
                                                            onClick={onSignAsPlayer}
                                                            className="px-6 py-3 rounded-xl font-bold bg-brand-navy hover:bg-brand-navy/90 text-white shadow-sm transition-colors"
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
`;

fs.writeFileSync(path.join(__dirname, '../src/components/ui/CrossCheckSignatureModal.tsx'), fileContent);
console.log('Done writing CrossCheckSignatureModal.tsx');
