"use client";

import React, { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { SignaturePad } from '@/components/ui/SignaturePad';

interface MarkerSubmitSignatureModalProps {
    isOpen: boolean;
    onClose: () => void;
    scorecardId: string;
    onSignatureComplete: () => void;
}

export function MarkerSubmitSignatureModal({ isOpen, onClose, scorecardId, onSignatureComplete }: MarkerSubmitSignatureModalProps) {
    const [loading, setLoading] = useState(true);
    const [scorecard, setScorecard] = useState<any>(null);
    const [showSignaturePad, setShowSignaturePad] = useState(false);

    useEffect(() => {
        if (!isOpen || !scorecardId) return;
        
        const fetchScorecard = async () => {
            setLoading(true);
            const supabase = createClient();
            
            const { data: scData, error: scErr } = await supabase
                .from("scorecards")
                .select(`
                    id, total_score, marker_id,
                    athlete:users!scorecards_athlete_id_fkey(name),
                    marker:users!scorecards_marker_id_fkey(name),
                    holes:scorecard_holes(hole_number, par, score),
                    marker_scores:tournament_marker_scores(hole_number, score)
                `)
                .eq("id", scorecardId)
                .single();

            if (scData) {
                if (scData.holes) scData.holes.sort((a: any, b: any) => a.hole_number - b.hole_number);
                setScorecard(scData);
            }
            setLoading(false);
        };

        fetchScorecard();
    }, [isOpen, scorecardId]);

    const handleSaveSignature = async (sigDataUrl: string) => {
        const supabase = createClient();
        await supabase
            .from("scorecards")
            .update({ 
                marker_signature: sigDataUrl,
                marker_signed_at: new Date().toISOString()
            })
            .eq("id", scorecardId);
            
        setShowSignaturePad(false);
        onSignatureComplete();
    };

    if (!isOpen) return null;

    if (showSignaturePad) {
        return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-[2rem] shadow-xl overflow-hidden p-6 relative">
                    <SignaturePad
                        title="마커 서명"
                        description="스코어에 이상이 없음을 확인합니다."
                        onSave={handleSaveSignature}
                        onCancel={() => setShowSignaturePad(false)}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-3xl bg-white dark:bg-zinc-900 rounded-[2rem] shadow-xl overflow-hidden relative flex flex-col max-h-[85vh]">
                
                <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 z-10 shrink-0">
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                        스코어 제출 요약 <span className="text-zinc-400 text-sm font-semibold ml-2">({scorecard?.marker?.name || '알 수 없음'})</span>
                    </h2>
                    <button onClick={onClose} className="p-2 -mr-2 rounded-full text-zinc-400 hover:text-zinc-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-48 gap-3">
                            <Loader2 className="w-8 h-8 text-brand-navy animate-spin" />
                            <p className="text-sm text-zinc-500">불러오는 중...</p>
                        </div>
                    ) : !scorecard ? null : (
                        <div className="space-y-6">
                            {(() => {
                                const renderDualScore = (start: number, end: number) => {
                                    const parCells = [];
                                    const pScoreCells = [];
                                    let pSum = 0;
                                    let parSum = 0;

                                    for (let i = start; i <= end; i++) {
                                        const hole = scorecard.holes?.find((h: any) => h.hole_number === i);
                                        const mScore = scorecard.marker_scores?.find((m: any) => m.hole_number === i);
                                        const par = hole?.par || 0;
                                        const pScore = mScore?.score > 0 ? mScore.score : (par || 0);
                                        
                                        parSum += par;
                                        pSum += pScore;

                                        parCells.push(<td key={i} className="px-1 sm:px-2 py-1.5 sm:py-2 text-[10px] sm:text-[12px] min-w-[20px] sm:min-w-[36px]">{par || "-"}</td>);
                                        pScoreCells.push(<td key={i} className="px-1 sm:px-2 py-2 sm:py-2.5 font-bold">{pScore > 0 ? pScore : "-"}</td>);
                                    }
                                    return { parCells, pScoreCells, pSum, parSum };
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
                                                    <tr className="font-bold text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900">
                                                        <td className="px-1 sm:px-3 py-2 bg-zinc-50/50 dark:bg-zinc-800/30 border-r border-zinc-200 dark:border-zinc-700 whitespace-nowrap text-[10px] sm:text-xs">SCORE</td>
                                                        {res.pScoreCells}
                                                        <td className="px-1 sm:px-3 py-2 bg-zinc-50/50 dark:bg-zinc-800/30 border-l border-zinc-200 dark:border-zinc-700 text-brand-navy">{res.pSum || "-"}</td>
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
                                        
                                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-6">
                                            <button 
                                                onClick={() => setShowSignaturePad(true)}
                                                className="px-6 py-3 rounded-xl font-bold bg-brand-navy hover:bg-brand-navy/90 text-white shadow-sm transition-colors"
                                            >
                                                마커 서명하기
                                            </button>
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
