"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, CornerDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { LessonRecord } from "@/lib/lesson-sync";
import { createClient } from "@/lib/supabase/client";
import { AthleteSearch } from "@/components/ui/AthleteSearch";
import { CategoryTabs } from "@/components/ui/CategoryTabs";

const partOptions: { key: string; label: string }[] = [
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

interface GroupedLesson extends LessonRecord {
    subLessons?: GroupedLesson[];
    is_core_lesson?: boolean;
}

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
    const [playerLessons, setPlayerLessons] = useState<LessonRecord[]>([]);
    const [historyDisplayLimit, setHistoryDisplayLimit] = useState(10);
    const [isLoading, setIsLoading] = useState(false);
    const [activePart, setActivePart] = useState(() => {
        if (typeof window !== 'undefined') {
            return sessionStorage.getItem('playerLessonHistoryModal_activePart') || "all";
        }
        return "all";
    });
    const [totalLessonCount, setTotalLessonCount] = useState(0);

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

    useEffect(() => {
        sessionStorage.setItem('playerLessonHistoryModal_activePart', activePart);
        // 탭이 바뀔 때 리미트 초기화 (2번 렌더링 방지를 위해 아래 useEffect에서 함께 처리해도 되지만 안전하게)
        setHistoryDisplayLimit(10);
    }, [activePart, activePlayer]);

    // Fetch lessons when active player, part, or limit changes
    useEffect(() => {
        if (isOpen && activePlayer) {
            setIsLoading(true);
            
            const fetchPaginated = async () => {
                const supabase = createClient();
                
                // 1. Get user_id by name
                const { data: userRes } = await supabase
                    .from("users")
                    .select("id")
                    .eq("name", activePlayer)
                    .maybeSingle();

                if (!userRes) {
                    setPlayerLessons([]);
                    setTotalLessonCount(0);
                    setIsLoading(false);
                    return;
                }

                // 2. Query lessons
                let query = supabase
                    .from("records")
                    .select(`
                        id, type, category, title, content, is_corrected, created_at, connected_lesson_id, user_id,
                        users!records_user_id_fkey(name),
                        coach:users!records_coach_id_fkey(name)
                    `, { count: 'exact' })
                    .eq("type", "lesson")
                    .eq("user_id", userRes.id)
                    .order("created_at", { ascending: false });

                if (activePart !== "all") {
                    query = query.eq("category", activePart);
                }

                query = query.limit(historyDisplayLimit);

                const { data: lessonsData, count } = await query;
                
                if (!lessonsData) {
                    setPlayerLessons([]);
                    setTotalLessonCount(0);
                    setIsLoading(false);
                    return;
                }

                setTotalLessonCount(count || 0);

                // 3. Fetch missing parents for proper grouping
                const parentIdsToFetch = new Set<string>();
                lessonsData.forEach((item: any) => {
                    if (item.connected_lesson_id) {
                        const parentExists = lessonsData.some((l: any) => l.id === item.connected_lesson_id);
                        if (!parentExists) {
                            parentIdsToFetch.add(item.connected_lesson_id);
                        }
                    }
                });

                let finalLessonsData = [...lessonsData];

                if (parentIdsToFetch.size > 0) {
                    const { data: parentData } = await supabase.from("records").select(`
                        id, type, category, title, content, is_corrected, created_at, connected_lesson_id, user_id,
                        users!records_user_id_fkey(name),
                        coach:users!records_coach_id_fkey(name)
                    `).in("id", Array.from(parentIdsToFetch));
                    
                    if (parentData) {
                        finalLessonsData = [...finalLessonsData, ...parentData];
                    }
                }

                const formatted: LessonRecord[] = finalLessonsData.map((item: any) => ({
                    id: item.id,
                    type: item.type,
                    category: item.category as any,
                    title: item.title || "",
                    content: item.content || "",
                    created_at: item.created_at,
                    playerName: item.users?.name || "Unknown",
                    coachName: item.coach?.name || "Unknown",
                    connected_lesson_id: item.connected_lesson_id
                }));

                // Deduplicate
                const uniqueFormatted = Array.from(new Map(formatted.map(item => [item.id, item])).values());
                
                setPlayerLessons(uniqueFormatted);
                setIsLoading(false);
            };
            
            fetchPaginated();
        } else {
            setPlayerLessons([]);
            setTotalLessonCount(0);
        }
    }, [activePlayer, isOpen, historyDisplayLimit, activePart]);

    const handleAddPlayer = (playerName: string) => {
        if (!playerName.trim()) return;
        const name = playerName.trim();
        // Check if player exists in allAthletes
        const exactMatch = allAthletes.find(a => a.toLowerCase() === name.toLowerCase());
        const finalName = exactMatch || name; // Allow adding even if not exact match just in case

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

    const groupedLessons = useMemo(() => {
        const lessonMap = new Map<string, GroupedLesson>();
        playerLessons.forEach(l => lessonMap.set(l.id, { ...l, subLessons: [] }));

        const rootLessons: GroupedLesson[] = [];
        const treeMap = new Map<string, GroupedLesson[]>();

        const getRootId = (id: string): string => {
            let current = lessonMap.get(id);
            const visited = new Set<string>();
            while (current?.connected_lesson_id) {
                if (visited.has(current.id)) break;
                visited.add(current.id);
                const parent = lessonMap.get(current.connected_lesson_id);
                if (!parent) break;
                current = parent;
            }
            return current?.id || id;
        };

        playerLessons.forEach(l => {
            const rootId = getRootId(l.id);
            if (rootId === l.id) {
                if (!treeMap.has(rootId)) treeMap.set(rootId, []);
            } else {
                if (!treeMap.has(rootId)) treeMap.set(rootId, []);
                treeMap.get(rootId)!.push(lessonMap.get(l.id)!);
            }
        });

        Array.from(treeMap.keys()).forEach(rootId => {
            const root = lessonMap.get(rootId);
            if (root) {
                const descendants = treeMap.get(rootId)!;
                descendants.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                root.subLessons = descendants;
                if (descendants.length >= 2) {
                    root.is_core_lesson = true;
                }
                rootLessons.push(root);
            }
        });

        rootLessons.sort((a, b) => {
            let maxDateA = new Date(a.created_at).getTime();
            if (a.subLessons && a.subLessons.length > 0) {
                const latestSubA = new Date(a.subLessons[0].created_at).getTime();
                if (latestSubA > maxDateA) maxDateA = latestSubA;
            }
            let maxDateB = new Date(b.created_at).getTime();
            if (b.subLessons && b.subLessons.length > 0) {
                const latestSubB = new Date(b.subLessons[0].created_at).getTime();
                if (latestSubB > maxDateB) maxDateB = latestSubB;
            }
            return maxDateB - maxDateA;
        });

        if (activePart === "all") return rootLessons;
        return rootLessons.filter(root => {
            if (root.category === activePart) return true;
            if (root.subLessons?.some(sub => sub.category === activePart)) return true;
            return false;
        });
    }, [playerLessons, activePart]);

    const displayedHistory = groupedLessons.slice(0, historyDisplayLimit);

    const renderLessonCard = (lesson: GroupedLesson, isSub = false) => {
        const cardContent = (
            <div
                className={cn(
                    "bg-white dark:bg-zinc-900 border rounded-[1.25rem] overflow-hidden shadow-sm px-5 py-4 transition-all relative flex-1 group",
                    "border-zinc-200 dark:border-zinc-700 hover:border-brand-navy/50 cursor-pointer"
                )}
                onClick={() => {
                    sessionStorage.setItem('openPlayerLessonHistoryModal', 'true');
                    router.push(`/lessons/${lesson.id}`);
                }}
            >
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-brand-navy dark:text-brand-navy-light uppercase px-2 py-1 bg-brand-navy/5 dark:bg-brand-navy/20 rounded-md">
                            {partOptions.find(p => p.key === lesson.category)?.label || lesson.category}
                        </span>
                        {lesson.is_core_lesson && (
                            <span className="text-[11px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-md shrink-0">
                                핵심 레슨
                            </span>
                        )}
                        {lesson.coachName && (
                            <span className="text-[12px] font-medium text-zinc-500">
                                {lesson.coachName}
                            </span>
                        )}
                        <span className="text-[12px] text-zinc-400">
                            {new Date(lesson.created_at).toLocaleDateString()}
                        </span>
                    </div>
                </div>
                <div className="text-[14px] text-zinc-600 dark:text-zinc-400 mt-1 mb-2 whitespace-pre-wrap">
                    {lesson.content}
                </div>
            </div>
        );

        if (isSub) {
            return (
                <div key={lesson.id} className="flex items-start gap-2 mr-2">
                    <div className="mt-5 shrink-0 text-zinc-300 dark:text-zinc-600 pl-3">
                        <CornerDownRight size={16} />
                    </div>
                    {cardContent}
                </div>
            );
        }

        return <React.Fragment key={lesson.id}>{cardContent}</React.Fragment>;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col" style={{ height: '85vh' }}>
                <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 shrink-0">
                    <h2 className="font-bold text-base sm:text-lg text-zinc-900 dark:text-zinc-100 whitespace-nowrap tracking-tight">
                        레슨 히스토리 (다중 선택 가능)
                    </h2>
                    <button onClick={() => {
                        setRegisteredPlayers([]);
                        setActivePlayer(null);
                        setActivePart("all");
                        if (typeof window !== 'undefined') {
                            sessionStorage.removeItem('playerLessonHistoryModal_registeredPlayers');
                            sessionStorage.removeItem('playerLessonHistoryModal_activePlayer');
                            sessionStorage.removeItem('playerLessonHistoryModal_activePart');
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
                    <div className="relative w-full z-10">
                        <AthleteSearch
                            onSelect={(name) => handleAddPlayer(name)}
                            selectedNames={[]}
                            showChips={false}
                            placeholder="선수 이름 검색 후 Enter..."
                            inputClassName="bg-zinc-50 dark:bg-zinc-950 rounded-xl"
                            multi={true}
                        />
                    </div>

                    {/* Category Tabs */}
                    <CategoryTabs
                        options={partOptions}
                        value={activePart}
                        onChange={setActivePart}
                        className="mb-0 pb-0"
                    />
                </div>

                <div className="p-4 space-y-3 overflow-y-auto flex-1 bg-zinc-50/50 dark:bg-zinc-900 min-h-[300px]">
                    {!activePlayer ? (
                        <div className="py-12 text-center text-zinc-500 text-sm">
                            선수를 등록하고 탭을 선택하면 레슨 기록이 나타납니다.
                        </div>
                    ) : isLoading ? (
                        <div className="py-12 text-center text-zinc-500 text-sm">
                            {activePlayer} 선수의 데이터를 불러오는 중...
                        </div>
                    ) : (
                        <>
                            {displayedHistory.map(root => (
                                <div key={root.id} className="space-y-2 relative">
                                    {renderLessonCard(root, false)}
                                    {root.subLessons?.map(sub => renderLessonCard(sub, true))}
                                </div>
                            ))}
                            {displayedHistory.length === 0 && (
                                <div className="py-8 text-center text-zinc-500 text-sm">
                                    해당 선수의 레슨 기록이 없습니다.
                                </div>
                            )}
                            {totalLessonCount > historyDisplayLimit && (
                                <div className="pt-2 text-center pb-4">
                                    <button
                                        type="button"
                                        onClick={() => setHistoryDisplayLimit(prev => prev + 10)}
                                        className="px-4 py-2 text-sm font-medium text-brand-navy dark:text-brand-navy-light bg-brand-navy/5 dark:bg-brand-navy/20 hover:bg-brand-navy/10 dark:hover:bg-brand-navy/30 rounded-xl transition-colors"
                                    >
                                        더보기 ({totalLessonCount - historyDisplayLimit > 0 ? totalLessonCount - historyDisplayLimit : 0}건 남음)
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}