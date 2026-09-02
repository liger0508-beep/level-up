"use client";

import { useState, useEffect } from "react";
import { X, Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface Scorecard {
    id: string;
    round_date: string;
    course_name: string;
    total_score: number;
    weather: string;
    athlete: { name: string } | null;
}

interface ScorecardSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    players: string[];
    onSelect: (scorecardId: string, playerName: string) => void;
    title?: string;
}

export function ScorecardSelectionModal({ isOpen, onClose, players, onSelect, title = "스코어 선택" }: ScorecardSelectionModalProps) {
    const [scorecards, setScorecards] = useState<Scorecard[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        const fetchScorecards = async () => {
            setIsLoading(true);
            try {
                const supabase = createClient();

                let query = supabase
                    .from("scorecards")
                    .select(`
                        id, round_date, course_name, total_score, weather,
                        athlete:users!scorecards_athlete_id_fkey(name)
                    `)
                    .order('round_date', { ascending: false })
                    .limit(20);

                const { data, error } = await query;

                if (error) throw error;
                setScorecards(data as any);
            } catch (err) {
                console.error("Failed to fetch scorecards:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchScorecards();
    }, [isOpen, players]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in" onClick={onClose}>
            <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-[2rem] shadow-xl overflow-hidden animate-in zoom-in-95 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{title}</h3>
                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 overflow-y-auto flex-1">
                    {isLoading ? (
                        <div className="py-12 flex flex-col items-center justify-center text-zinc-400">
                            <div className="w-6 h-6 border-2 border-brand-navy/20 border-t-brand-navy rounded-full animate-spin mb-3"></div>
                            <p className="text-sm">스코어 목록을 불러오는 중...</p>
                        </div>
                    ) : scorecards.length === 0 ? (
                        <div className="py-12 text-center text-zinc-500 dark:text-zinc-400 text-sm border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                            등록된 스코어 기록이 없습니다.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {scorecards.map(sc => {
                                const athleteName = Array.isArray(sc.athlete) ? sc.athlete[0]?.name : sc.athlete?.name;
                                return (
                                    <button
                                        key={sc.id}
                                        onClick={() => onSelect(sc.id, athleteName || "알 수 없음")}
                                        className="w-full text-left bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-4 rounded-2xl transition-colors flex items-center justify-between group"
                                    >
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-brand-navy dark:text-brand-navy-light px-2 py-0.5 rounded-full bg-brand-navy/10 dark:bg-brand-navy/20">
                                                    {athleteName || "알 수 없음"}
                                                </span>
                                                <div className="flex items-center text-xs text-zinc-500 dark:text-zinc-400">
                                                    <Calendar size={12} className="mr-1" />
                                                    {sc.round_date}
                                                </div>
                                            </div>
                                            <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                                                {sc.course_name || "미지정 골프장"}
                                            </h4>
                                        </div>
                                        <div className="text-right">
                                            <span className={cn(
                                                "text-lg font-black",
                                                sc.total_score > 0 ? "text-blue-500" : sc.total_score < 0 ? "text-red-500" : "text-zinc-600 dark:text-zinc-400"
                                            )}>
                                                {sc.total_score > 0 ? `+${sc.total_score}` : sc.total_score}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}