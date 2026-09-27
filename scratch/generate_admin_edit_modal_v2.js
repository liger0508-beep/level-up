const fs = require('fs');
const path = require('path');

const fileContent = `"use client";

import React, { useEffect, useState } from 'react';
import { X, Loader2, AlertCircle, Save } from 'lucide-react';
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
    const [editTarget, setEditTarget] = useState<{ type: 'par' | 'score', holeNumber: number, currentValue: number } | null>(null);

    useEffect(() => {
        if (!isOpen || !scorecardId) return;
        fetchData();
    }, [isOpen, scorecardId]);

    const fetchData = async () => {
        setLoading(true);
        const supabase = createClient();
        
        const { data: officialSc } = await supabase
            .from("scorecards")
            .select(\`
                id, 
                marker_scores:tournament_marker_scores(hole_number, score),
                holes:scorecard_holes(hole_number, par)
            \`)
            .eq("id", scorecardId)
            .single();

        const { data: selfScData } = await supabase
            .from("scorecards")
            .select(\`
                id, total_score, hole_count, is_final,
                holes:scorecard_holes(id, hole_number, par, score)
            \`)
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
            officialSc.marker_scores.forEach((m: any) => {
                mkMap[m.hole_number] = m.score;
            });
        }
        if (officialSc?.holes) {
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

    const handleCellClick = (type: 'par' | 'score', holeNumber: number, currentValue: number) => {
        setEditTarget({ type, holeNumber, currentValue });
    };

    const handleNumpadSelect = (value: number) => {
        if (!editTarget) return;
        
        if (editTarget.type === 'par') {
            setMarkerPars(prev => {
                const newMap = { ...prev, [editTarget.holeNumber]: value };
                checkDiscrepancy(markerScores, newMap, scorecard);
                return newMap;
            });
        } else {
            setMarkerScores(prev => {
                const newMap = { ...prev, [editTarget.holeNumber]: value };
                checkDiscrepancy(newMap, markerPars, scorecard);
                return newMap;
            });
        }
        setEditTarget(null);
    };

    const saveChanges = async () => {
        setSaving(true);
        try {
            const supabase = createClient();
            
            // Upsert marker scores
            const scoresToUpsert = Object.keys(markerScores).map(hNumStr => {
                const hNum = parseInt(hNumStr);
                return {
                    scorecard_id: scorecardId,
                    hole_number: hNum,
                    score: markerScores[hNum]
                };
            });

            const { error: scoresError } = await supabase
                .from("tournament_marker_scores")
                .upsert(scoresToUpsert, { onConflict: 'scorecard_id,hole_number' });
            if (scoresError) throw scoresError;

            // Upsert marker pars
            const parsToUpsert = Object.keys(markerPars).map(hNumStr => {
                const hNum = parseInt(hNumStr);
                return {
                    scorecard_id: scorecardId,
                    hole_number: hNum,
                    par: markerPars[hNum]
                };
            });

            const { error: parsError } = await supabase
                .from("scorecard_holes")
                .upsert(parsToUpsert, { onConflict: 'scorecard_id,hole_number' });
            if (parsError) throw parsError;

            // Update total score in scorecards
            let total = 0;
            Object.values(markerScores).forEach(s => {
                if (s > 0) total += s;
            });
            
            const { error: updateError } = await supabase
                .from("scorecards")
                .update({ 
                    total_score: total,
                    is_final: Object.values(markerScores).filter(s => s > 0).length === 18
                })
                .eq("id", scorecardId);

            if (updateError) throw updateError;
            
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
                        스코어 수정 (관리자/마커) <span className="text-zinc-400 text-sm font-semibold ml-2">({athleteName})</span>
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 relative">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-48 gap-3">
                            <Loader2 className="w-8 h-8 text-brand-navy animate-spin" />
                            <p className="text-sm font-semibold text-zinc-500">정보를 불러오는 중입니다...</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-2xl p-4 flex gap-3 text-blue-600 dark:text-blue-400">
                                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                                <div className="text-sm font-semibold flex items-center">
                                    <p>수정하려는 PAR 또는 스코어 숫자를 클릭하면 선택창이 나타납니다.</p>
                                </div>
                            </div>
                            
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
                                                className={\`px-1 sm:px-2 py-1.5 sm:py-2 text-[11px] sm:text-[13px] min-w-[20px] sm:min-w-[36px] cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 \${parMismatchBg}\`}
                                                onClick={() => handleCellClick('par', i, mPar)}
                                            >
                                                {mPar || "-"}
                                            </td>
                                        );
                                        
                                        // Player Score (Read-only)
                                        pScoreCells.push(
                                            <td key={i} className={\`px-1 sm:px-2 py-2 sm:py-2.5 font-bold \${scoreMismatchBg}\`}>
                                                {pScore || "-"}
                                            </td>
                                        );

                                        // Marker Score (Editable via Popup)
                                        mScoreCells.push(
                                            <td 
                                                key={i} 
                                                className={\`px-1 sm:px-2 py-1 sm:py-1.5 align-middle cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 \${scoreMismatchBg}\`}
                                                onClick={() => handleCellClick('score', i, mScore)}
                                            >
                                                <div className="font-bold sm:font-black tracking-tighter text-[13px] sm:text-[15px] text-zinc-800 dark:text-zinc-200">
                                                    {mScore || "-"}
                                                </div>
                                            </td>
                                        );
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
                                                    <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-500 font-bold bg-white dark:bg-zinc-900">
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
                                    {editTarget.holeNumber}번 홀 {editTarget.type === 'par' ? 'PAR' : '스코어'} 수정
                                </h3>
                                <button onClick={() => setEditTarget(null)} className="p-1 text-zinc-400 hover:text-zinc-600">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {Array.from({length: 12}).map((_, i) => (
                                    <button
                                        key={i+1}
                                        onClick={() => handleNumpadSelect(i+1)}
                                        className={\`py-3 rounded-xl font-black text-xl transition-all shadow-sm active:scale-95 \${
                                            editTarget.currentValue === i+1 
                                                ? 'bg-brand-navy text-white' 
                                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                                        }\`}
                                    >
                                        {i+1}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => handleNumpadSelect(0)}
                                className="mt-2 w-full py-3 rounded-xl font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 shadow-sm"
                            >
                                삭제 (입력 안 함)
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
`;

fs.writeFileSync(path.join(__dirname, '../src/components/ui/AdminScoreEditModal.tsx'), fileContent);
console.log('Done writing AdminScoreEditModal.tsx with numpad');
