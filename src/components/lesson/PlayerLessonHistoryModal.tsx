"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { AthleteSearch } from "@/components/ui/AthleteSearch";

// Imports for the 4 cards and modals
import { LinkedPlanCard } from "@/components/training-plan/LinkedPlanCard";
import { LinkedJournalCard } from "@/components/training-plan/LinkedJournalCard";
import { LinkedScoreCard } from "@/components/lesson/LinkedScoreCard";
import { LinkedLessonCard } from "@/components/training-plan/LinkedLessonCard";

import { PlanHistoryModal } from "@/components/training-plan/PlanHistoryModal";
import { JournalHistoryModal } from "@/components/training-plan/JournalHistoryModal";
import { LessonHistoryModal } from "@/components/lesson/LessonHistoryModal";
import ReferenceDataModal from "@/components/lesson/ReferenceDataModal";

// Data fetching functions
import { fetchPlansByAthlete, Plan } from "@/lib/plan-sync";
import { fetchJournalsByAthlete, Journal } from "@/lib/journal-sync";
import { fetchLatestScoreByPlayer, ScoreData } from "@/lib/score-sync";
import { fetchRecentLessonsByPlayer, fetchAllLessonsByPlayer, LessonRecord } from "@/lib/lesson-sync";

const partOptions = [
    { key: "all", label: "ALL" },
    { key: "shot", label: "Shot" },
    { key: "pitch", label: "Pitch" },
    { key: "bunker", label: "Bunker" },
    { key: "approach", label: "Approach" },
    { key: "putt", label: "Putt" },
    { key: "physical", label: "Physical" },
    { key: "field", label: "Field" },
    { key: "etc", label: "Etc" },
];

interface PlayerLessonHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    allAthletes: string[];
}

export function PlayerLessonHistoryModal({ isOpen, onClose, allAthletes }: PlayerLessonHistoryModalProps) {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [registeredPlayers, setRegisteredPlayers] = useState<string[]>(() => {
        if (typeof window !== 'undefined') {
            const saved = sessionStorage.getItem('playerLessonHistoryModal_registeredPlayers');
            if (saved) return JSON.parse(saved);
        }
        return [];
    });
    const [activePlayer, setActivePlayer] = useState<string | null>(() => {
        if (typeof window !== 'undefined') {
            return sessionStorage.getItem('playerLessonHistoryModal_activePlayer') || null;
        }
        return null;
    });

    // Data States
    const [recentPlan, setRecentPlan] = useState<Plan | null>(null);
    const [allPlans, setAllPlans] = useState<Plan[]>([]);
    const [recentJournal, setRecentJournal] = useState<Journal | null>(null);
    const [allJournals, setAllJournals] = useState<Journal[]>([]);
    const [recentScore, setRecentScore] = useState<ScoreData | null>(null);
    const [recentLessons, setRecentLessons] = useState<LessonRecord[]>([]);
    const [allLessons, setAllLessons] = useState<LessonRecord[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Modal States
    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
    const [isJournalHistoryModalOpen, setIsJournalHistoryModalOpen] = useState(false);
    const [isReferenceModalOpen, setIsReferenceModalOpen] = useState(false);
    const [isLessonHistoryModalOpen, setIsLessonHistoryModalOpen] = useState(false);

    // Filter/Search States for Modals
    const [historySelectedPart, setHistorySelectedPart] = useState("all");
    const [historySearchQuery, setHistorySearchQuery] = useState("");
    const [historyDisplayLimit, setHistoryDisplayLimit] = useState(10);
    const [selectedJournalId, setSelectedJournalId] = useState<string | null>(null);
    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
    const [connectedLessonId, setConnectedLessonId] = useState<string | null>(null);

    useEffect(() => {
        sessionStorage.setItem('playerLessonHistoryModal_registeredPlayers', JSON.stringify(registeredPlayers));
    }, [registeredPlayers]);

    useEffect(() => {
        if (activePlayer) {
            sessionStorage.setItem('playerLessonHistoryModal_activePlayer', activePlayer);
        } else {
            sessionStorage.removeItem('playerLessonHistoryModal_activePlayer');
        }
    }, [activePlayer]);

    // Fetch all 4 sets of data when activePlayer changes
    useEffect(() => {
        if (isOpen && activePlayer) {
            setIsLoading(true);
            const loadData = async () => {
                try {
                    const [plans, journals, score, lessons, allL] = await Promise.all([
                        fetchPlansByAthlete(activePlayer),
                        fetchJournalsByAthlete(activePlayer),
                        fetchLatestScoreByPlayer(activePlayer),
                        fetchRecentLessonsByPlayer(activePlayer),
                        fetchAllLessonsByPlayer(activePlayer)
                    ]);
                    
                    setAllPlans(plans);
                    setRecentPlan(plans.length > 0 ? plans[0] : null);
                    
                    setAllJournals(journals);
                    setRecentJournal(journals.length > 0 ? journals[0] : null);
                    
                    setRecentScore(score);
                    
                    setRecentLessons(lessons);
                    setAllLessons(allL);
                } catch (error) {
                    console.error("Error fetching player data:", error);
                } finally {
                    setIsLoading(false);
                }
            };
            loadData();
        } else {
            // Reset state
            setRecentPlan(null);
            setAllPlans([]);
            setRecentJournal(null);
            setAllJournals([]);
            setRecentScore(null);
            setRecentLessons([]);
            setAllLessons([]);
        }
    }, [activePlayer, isOpen]);

    const handleAddPlayer = (playerName: string) => {
        if (!playerName.trim()) return;
        const name = playerName.trim();
        const exactMatch = allAthletes.find(a => a.toLowerCase() === name.toLowerCase());
        const finalName = exactMatch || name;

        if (!registeredPlayers.includes(finalName)) {
            const newPlayers = [finalName, ...registeredPlayers];
            setRegisteredPlayers(newPlayers);
            setActivePlayer(finalName);
        } else {
            setActivePlayer(finalName);
        }
        setSearchQuery("");
    };

    const removePlayer = (playerName: string) => {
        const newPlayers = registeredPlayers.filter(p => p !== playerName);
        setRegisteredPlayers(newPlayers);
        if (activePlayer === playerName) {
            setActivePlayer(newPlayers.length > 0 ? newPlayers[0] : null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col" style={{ height: '85vh' }}>
                <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 shrink-0">
                    <h2 className="font-bold text-base sm:text-lg text-zinc-900 dark:text-zinc-100 whitespace-nowrap tracking-tight">
                        선수 통합 정보 대시보드
                    </h2>
                    <button onClick={() => {
                        setRegisteredPlayers([]);
                        setActivePlayer(null);
                        if (typeof window !== 'undefined') {
                            sessionStorage.removeItem('playerLessonHistoryModal_registeredPlayers');
                            sessionStorage.removeItem('playerLessonHistoryModal_activePlayer');
                            sessionStorage.removeItem('openPlayerLessonHistoryModal');
                        }
                        onClose();
                    }} className="p-1.5 text-zinc-400 hover:text-zinc-900 bg-white rounded-lg border border-zinc-200">
                        <X size={20} />
                    </button>
                </div>

                <div className="pt-4 px-4 pb-2 shrink-0 border-b border-zinc-200 dark:border-zinc-800 space-y-3">
                    {/* Registered Players Tabs */}
                    <div className="flex overflow-x-auto whitespace-nowrap gap-3 pb-2 pt-2 px-1 scrollbar-hide">
                        {registeredPlayers.map(player => (
                            <div
                                key={player}
                                className={cn(
                                    "relative flex items-center justify-center px-4 py-2 rounded-xl text-[13px] font-bold cursor-pointer transition-colors border shrink-0",
                                    activePlayer === player
                                        ? "bg-brand-navy text-white border-brand-navy dark:border-brand-navy-light shadow-sm"
                                        : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300"
                                )}
                                onClick={() => setActivePlayer(player)}
                            >
                                <span>{player}</span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removePlayer(player);
                                    }}
                                    className={cn(
                                        "absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center shadow-sm border transition-all z-10",
                                        activePlayer === player
                                            ? "bg-white text-brand-navy border-zinc-200 hover:bg-zinc-50"
                                            : "bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-100 dark:bg-zinc-700 dark:border-zinc-600 dark:text-zinc-300"
                                    )}
                                >
                                    <X size={10} strokeWidth={3} />
                                </button>
                            </div>
                        ))}
                        {registeredPlayers.length === 0 && (
                            <span className="text-sm text-zinc-400 py-1 italic">
                                선수 이름을 검색해 추가해주세요.
                            </span>
                        )}
                    </div>

                    {/* Search Input */}
                    <div className="relative w-full z-10 mb-2">
                        <AthleteSearch
                            onSelect={(name) => handleAddPlayer(name)}
                            selectedNames={[]}
                            showChips={false}
                            placeholder="선수 이름 검색 후 Enter..."
                            inputClassName="bg-zinc-50 dark:bg-zinc-950 rounded-xl"
                            multi={true}
                        />
                    </div>
                </div>

                <div className="p-4 space-y-5 overflow-y-auto flex-1 bg-zinc-50/50 dark:bg-zinc-900 min-h-[300px]">
                    {!activePlayer ? (
                        <div className="py-12 text-center text-zinc-500 text-sm">
                            선수를 선택하면 최근 정보가 나타납니다.
                        </div>
                    ) : isLoading ? (
                        <div className="py-12 text-center text-zinc-500 text-sm">
                            {activePlayer} 선수의 데이터를 불러오는 중...
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* 1. 훈련 계획 */}
                            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 rounded-2xl shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                                        🗓️ 훈련 계획
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={() => setIsPlanModalOpen(true)}
                                        className="text-xs font-bold text-zinc-500 hover:text-brand-navy flex items-center gap-1 transition-colors"
                                    >
                                        더보기 {'>'}
                                    </button>
                                </div>
                                <div 
                                    className={cn("transition-all rounded-2xl relative", recentPlan && "cursor-pointer group hover:ring-2 hover:ring-brand-navy/30")}
                                    onClick={() => {
                                        if (recentPlan) {
                                            sessionStorage.setItem('openPlayerLessonHistoryModal', 'true');
                                            router.push(recentPlan.type === 'field' ? `/scores/field-notes/${recentPlan.id}` : `/admin/training-plan/${recentPlan.id}`);
                                        }
                                    }}
                                >
                                    <LinkedPlanCard 
                                        plan={recentPlan} 
                                        readOnly={true} 
                                    />
                                </div>
                            </section>

                            {/* 2. 훈련 일지 */}
                            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 rounded-2xl shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                                        📝 훈련 일지
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={() => setIsJournalHistoryModalOpen(true)}
                                        className="text-xs font-bold text-zinc-500 hover:text-brand-navy flex items-center gap-1 transition-colors"
                                    >
                                        더보기 {'>'}
                                    </button>
                                </div>
                                <div 
                                    className={cn("transition-all rounded-2xl relative", recentJournal && "cursor-pointer group hover:ring-2 hover:ring-brand-navy/30")}
                                    onClick={() => {
                                        if (recentJournal) {
                                            sessionStorage.setItem('openPlayerLessonHistoryModal', 'true');
                                            router.push(recentJournal.type === 'field' ? `/scores/field-notes/${recentJournal.id}` : `/admin/training-journal/${recentJournal.id}`);
                                        }
                                    }}
                                >
                                    <LinkedJournalCard 
                                        journal={recentJournal} 
                                        readOnly={true} 
                                    />
                                </div>
                            </section>

                            {/* 3. 최근 라운드 정보 */}
                            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 rounded-2xl shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                                        ⛳ 최근 라운드 정보
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={() => setIsReferenceModalOpen(true)}
                                        className="text-xs font-bold text-zinc-500 hover:text-brand-navy flex items-center gap-1 transition-colors"
                                    >
                                        더보기 {'>'}
                                    </button>
                                </div>
                                <LinkedScoreCard 
                                    recentScore={recentScore} 
                                />
                            </section>

                            {/* 4. 레슨 히스토리 */}
                            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 rounded-2xl shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                                        🏌️‍♂️ 레슨 히스토리
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={() => setIsLessonHistoryModalOpen(true)}
                                        className="text-xs font-bold text-zinc-500 hover:text-brand-navy flex items-center gap-1 transition-colors"
                                    >
                                        더보기 {'>'}
                                    </button>
                                </div>
                                <div 
                                    className={cn("transition-all rounded-2xl relative", recentLessons[0] && "cursor-pointer group hover:ring-2 hover:ring-brand-navy/30")}
                                    onClick={() => {
                                        if (recentLessons[0]) {
                                            sessionStorage.setItem('openPlayerLessonHistoryModal', 'true');
                                            router.push(`/lessons/${recentLessons[0].id}`);
                                        }
                                    }}
                                >
                                    <LinkedLessonCard
                                        part={"all"}
                                        lesson={recentLessons[0] || null}
                                        readOnly={true}
                                    />
                                </div>
                            </section>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            <PlanHistoryModal
                isOpen={isPlanModalOpen}
                onClose={() => setIsPlanModalOpen(false)}
                allPlans={allPlans}
                readOnly={true}
                onSelectPlan={(planId) => {
                    const plan = allPlans.find(p => p.id === planId);
                    if (plan) setRecentPlan(plan);
                    setIsPlanModalOpen(false);
                }}
                connectedPlanId={recentPlan?.id}
            />

            <JournalHistoryModal
                key={activePlayer || "none"}
                isOpen={isJournalHistoryModalOpen}
                onClose={() => setIsJournalHistoryModalOpen(false)}
                allJournals={allJournals}
                readOnly={true}
                onSelectJournal={(journalId) => {
                    const journal = allJournals.find(j => j.id === journalId);
                    if (journal) setRecentJournal(journal);
                    setIsJournalHistoryModalOpen(false);
                }}
                connectedJournalId={recentJournal?.id}
            />

            <ReferenceDataModal
                isOpen={isReferenceModalOpen}
                onClose={() => setIsReferenceModalOpen(false)}
                playerName={activePlayer || ""}
            />

            <LessonHistoryModal
                isOpen={isLessonHistoryModalOpen}
                onClose={() => setIsLessonHistoryModalOpen(false)}
                allLessons={allLessons}
                historySelectedPart={historySelectedPart}
                setHistorySelectedPart={setHistorySelectedPart}
                historySearchQuery={historySearchQuery}
                setHistorySearchQuery={setHistorySearchQuery}
                historyDisplayLimit={historyDisplayLimit}
                setHistoryDisplayLimit={setHistoryDisplayLimit}
                connectedLessonId={connectedLessonId}
                setConnectedLessonId={setConnectedLessonId}
                partOptions={partOptions}
                readOnly={true}
            />
        </div>
    );
}