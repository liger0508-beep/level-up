"use client";

import React, { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { cn } from '@/lib/utils';

interface RefereeConfirmSignatureModalProps {
    isOpen: boolean;
    onClose: () => void;
    tournamentId: string;
    athleteId: string;
    athleteName: string;
    scorecardId: string;
    onSignatureSuccess: () => void;
}

export function RefereeConfirmSignatureModal({
    isOpen,
    onClose,
    tournamentId,
    athleteId,
    athleteName,
    scorecardId,
    onSignatureSuccess
}: RefereeConfirmSignatureModalProps) {
    const [loading, setLoading] = useState(true);
    const [scorecard, setScorecard] = useState<any>(null);
    const [showSignaturePad, setShowSignaturePad] = useState(false);

    useEffect(() => {
        if (!isOpen || !scorecardId) return;

        const fetchScorecard = async () => {
            setLoading(true);
            const supabase = createClient();

            const { data: scData } = await supabase
                .from("scorecards")
                .select(`
                    id, total_score, marker_id, athlete_id,
                    marker_signature, player_signature, referee_signature,
                    marker_signed_at, player_signed_at, referee_signed_at,
                    marker_user:users!scorecards_athlete_id_fkey(id, name),
                    player_user:users!scorecards_marker_id_fkey(id, name),
                    holes:scorecard_holes(hole_number, par, score),
                    marker_scores:tournament_marker_scores(hole_number, score)
                `)
                .eq("id", scorecardId)
                .single();

            if (scData) {
                if (scData.holes) scData.holes.sort((a: any, b: any) => a.hole_number - b.hole_number);

                // Fallback for user names if relation join didn't return name
                let markerUserName = scData.marker_user?.name;
                let playerUserName = scData.player_user?.name;

                const userIdsToFetch: string[] = [];
                if (!markerUserName && scData.athlete_id) userIdsToFetch.push(scData.athlete_id);
                if (!playerUserName && scData.marker_id) userIdsToFetch.push(scData.marker_id);

                if (userIdsToFetch.length > 0) {
                    const { data: extraUsers } = await supabase
                        .from("users")
                        .select("id, name")
                        .in("id", userIdsToFetch);

                    if (extraUsers) {
                        extraUsers.forEach((u: any) => {
                            if (u.id === scData.athlete_id) markerUserName = u.name;
                            if (u.id === scData.marker_id) playerUserName = u.name;
                        });
                    }
                }

                setScorecard({
                    ...scData,
                    resolvedMarkerName: markerUserName || "마커",
                    resolvedPlayerName: playerUserName || athleteName || "선수"
                });
            }
            setLoading(false);
        };

        fetchScorecard();
    }, [isOpen, scorecardId]);

    const handleSaveRefereeSignature = async (sigDataUrl: string) => {
        const supabase = createClient();
        const { error } = await supabase
            .from("scorecards")
            .update({
                referee_signature: sigDataUrl,
                referee_signed_at: new Date().toISOString()
            })
            .eq("id", scorecardId);

        if (error) {
            alert("경기위원 서명 저장에 실패했습니다: " + error.message);
            return;
        }

        alert("경기위원 서명이 완료되었습니다.");
        setShowSignaturePad(false);
        onSignatureSuccess();
    };

    if (!isOpen) return null;

    if (showSignaturePad) {
        return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-[2rem] shadow-xl overflow-hidden p-6 relative">
                    <SignaturePad
                        title="경기위원 서명"
                        description="대회 스코어를 공식적으로 인증합니다."
                        buttonText="인증 완료"
                        onSave={handleSaveRefereeSignature}
                        onCancel={() => setShowSignaturePad(false)}
                    />
                </div>
            </div>
        );
    }

    return (
        <div 
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"
            onClick={onClose}
        >
            <div 
                className="w-full max-w-3xl bg-white dark:bg-zinc-900 rounded-[2rem] shadow-xl overflow-hidden relative flex flex-col max-h-[85vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 z-10 shrink-0">
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        경기위원 스코어 및 서명 확인
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
                            <p className="text-sm font-semibold text-zinc-500">데이터를 불러오는 중입니다...</p>
                        </div>
                    ) : !scorecard ? (
                        <div className="flex flex-col items-center justify-center h-48 text-zinc-500">
                            <p>스코어카드 정보를 찾을 수 없습니다.</p>
                        </div>
                    ) : (
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
                                        const pScore = mScore?.score > 0 ? mScore.score : (hole?.score > 0 ? hole.score : (par || 0));

                                        parSum += par;
                                        pSum += pScore;

                                        const diff = pScore - par;
                                        let scoreDisplay = <span className="font-bold">{pScore > 0 ? pScore : "-"}</span>;

                                        if (pScore > 0 && par > 0) {
                                            scoreDisplay = (
                                                <div className="relative inline-flex items-center justify-center w-5 h-5 sm:w-7 sm:h-7 mx-auto">
                                                    <span className={cn(
                                                        "relative z-10 font-black tracking-tighter text-[10px] sm:text-[13px]",
                                                        diff <= -2 ? "text-orange-600 dark:text-orange-400" :
                                                        diff === -1 ? "text-yellow-600 dark:text-yellow-500" :
                                                        diff === 1 ? "text-sky-600 dark:text-sky-400" :
                                                        diff >= 2 ? "text-sky-700 dark:text-sky-300" :
                                                        "text-zinc-900 dark:text-zinc-100"
                                                    )}>{pScore}</span>
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
                                            );
                                        }

                                        parCells.push(<td key={i} className="px-0 sm:px-2 py-1.5 sm:py-2 text-[10px] sm:text-[12px]">{par || "-"}</td>);
                                        pScoreCells.push(<td key={i} className="px-0 sm:px-2 py-1 sm:py-1.5 align-middle">{scoreDisplay}</td>);
                                    }
                                    return { parCells, pScoreCells, pSum, parSum };
                                };

                                const outRes = renderDualScore(1, 9);
                                const inRes = renderDualScore(10, 18);
                                const totalScore = outRes.pSum + inRes.pSum;
                                const totalPar = outRes.parSum + inRes.parSum;
                                const totalDiff = totalPar > 0 ? totalScore - totalPar : 0;
                                const diffDisplay = totalDiff === 0 ? "E" : totalDiff > 0 ? `+${totalDiff}` : `${totalDiff}`;
                                const targetPlayerName = scorecard?.resolvedPlayerName || athleteName || '선수';
                                const markerName = scorecard?.resolvedMarkerName || '마커';

                                const renderTable = (label: string, res: any) => (
                                    <div className="border border-zinc-200 dark:border-zinc-700 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 shadow-sm w-full">
                                        <div className="overflow-hidden">
                                            <table className="w-full table-fixed text-center text-[9px] sm:text-sm">
                                                <thead>
                                                    <tr className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 font-bold text-zinc-600 dark:text-zinc-300">
                                                        <th className="px-0 sm:px-3 py-2 sm:py-3 w-10 sm:w-16 bg-zinc-100 dark:bg-zinc-900/50 border-r border-zinc-200 dark:border-zinc-700 whitespace-nowrap overflow-hidden">HOLE</th>
                                                        {Array.from({length: 9}).map((_, idx) => (
                                                            <th key={idx} className="px-0 sm:px-2 py-2 sm:py-3 truncate font-semibold">
                                                                {label === 'OUT' ? idx + 1 : idx + 10}
                                                            </th>
                                                        ))}
                                                        <th className="px-0 sm:px-3 py-2 sm:py-3 bg-zinc-100 dark:bg-zinc-900/50 border-l border-zinc-200 dark:border-zinc-700 text-brand-navy w-10 sm:w-16 whitespace-nowrap overflow-hidden font-bold">{label}</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-500 font-semibold bg-white dark:bg-zinc-900">
                                                        <td className="px-0 sm:px-3 py-1.5 sm:py-2 bg-zinc-50/50 dark:bg-zinc-800/30 border-r border-zinc-200 dark:border-zinc-700 overflow-hidden">PAR</td>
                                                        {res.parCells}
                                                        <td className="px-0 sm:px-3 py-1.5 sm:py-2 bg-zinc-50/50 dark:bg-zinc-800/30 border-l border-zinc-200 dark:border-zinc-700 overflow-hidden font-semibold">{res.parSum || "-"}</td>
                                                    </tr>
                                                    <tr className="font-bold text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900">
                                                        <td className="px-0 sm:px-3 py-2 sm:py-2.5 bg-zinc-50/50 dark:bg-zinc-800/30 border-r border-zinc-200 dark:border-zinc-700 overflow-hidden">SCORE</td>
                                                        {res.pScoreCells}
                                                        <td className="px-0 sm:px-3 py-2 sm:py-2.5 bg-zinc-50/50 dark:bg-zinc-800/30 border-l border-zinc-200 dark:border-zinc-700 text-brand-navy overflow-hidden font-extrabold">{res.pSum || "-"}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );

                                return (
                                    <>
                                        {/* 선수명 정보 */}
                                        <div className="flex items-center text-sm sm:text-base font-semibold text-zinc-600 dark:text-zinc-400">
                                            <span>선수명: </span>
                                            <span className="text-zinc-900 dark:text-zinc-100 font-bold ml-1.5">{targetPlayerName}</span>
                                        </div>

                                        {/* Summary Card (OUT, IN, TOTAL) */}
                                        <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800">
                                            <div className="flex flex-col items-center flex-1 border-r border-zinc-200 dark:border-zinc-700">
                                                <span className="text-[10px] font-bold text-zinc-400 mb-0.5">OUT</span>
                                                <span className="text-sm sm:text-base font-black text-zinc-900 dark:text-white">{outRes.pSum || "-"}</span>
                                            </div>
                                            <div className="flex flex-col items-center flex-1 border-r border-zinc-200 dark:border-zinc-700">
                                                <span className="text-[10px] font-bold text-zinc-400 mb-0.5">IN</span>
                                                <span className="text-sm sm:text-base font-black text-zinc-900 dark:text-white">{inRes.pSum || "-"}</span>
                                            </div>
                                            <div className="flex flex-col items-center flex-1">
                                                <span className="text-[10px] font-bold text-brand-navy mb-0.5">TOTAL</span>
                                                <span className="text-sm sm:text-base font-black text-brand-navy flex items-center justify-center gap-1">
                                                    <span>{totalScore || "-"}</span>
                                                    {totalScore > 0 && totalPar > 0 && (
                                                        <span className="text-xs sm:text-sm font-bold">
                                                            ({diffDisplay})
                                                        </span>
                                                    )}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Score Tables */}
                                        <div className="space-y-4">
                                            {renderTable('OUT', outRes)}
                                            {renderTable('IN', inRes)}
                                        </div>

                                        {/* Signatures Review Card */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                            {/* 마커 서명 */}
                                            <div className="border border-zinc-200 dark:border-zinc-700/80 rounded-2xl p-4 bg-zinc-50/60 dark:bg-zinc-800/40 flex flex-col items-center">
                                                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-2">
                                                    마커 서명 <span className="text-zinc-400 font-normal">({markerName})</span>
                                                </span>
                                                <div className="w-full h-24 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/80 dark:border-zinc-700 flex items-center justify-center overflow-hidden p-2">
                                                    {scorecard.marker_signature ? (
                                                        <img 
                                                            src={scorecard.marker_signature} 
                                                            alt="마커 서명" 
                                                            className="max-h-full max-w-full object-contain pointer-events-none" 
                                                        />
                                                    ) : (
                                                        <span className="text-xs text-zinc-400 italic">서명 없음</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* 선수 본인 서명 */}
                                            <div className="border border-zinc-200 dark:border-zinc-700/80 rounded-2xl p-4 bg-zinc-50/60 dark:bg-zinc-800/40 flex flex-col items-center">
                                                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-2">
                                                    선수 본인 서명 <span className="text-zinc-400 font-normal">({targetPlayerName})</span>
                                                </span>
                                                <div className="w-full h-24 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/80 dark:border-zinc-700 flex items-center justify-center overflow-hidden p-2">
                                                    {scorecard.player_signature ? (
                                                        <img 
                                                            src={scorecard.player_signature} 
                                                            alt="선수 서명" 
                                                            className="max-h-full max-w-full object-contain pointer-events-none" 
                                                        />
                                                    ) : (
                                                        <span className="text-xs text-zinc-400 italic">서명 없음</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-6">
                                            <button 
                                                onClick={onClose}
                                                className="px-5 py-3 rounded-xl font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-sm sm:text-base"
                                            >
                                                닫기
                                            </button>
                                            <button 
                                                onClick={() => setShowSignaturePad(true)}
                                                className="px-6 py-3 rounded-xl font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition-colors text-sm sm:text-base"
                                            >
                                                경기위원 서명하기
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
