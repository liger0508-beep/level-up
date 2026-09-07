"use client";

import { useState, useMemo, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Calendar, Save, Info, ChevronRight, Target, Flag, Crown, Search, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DatePickerInput } from "@/components/ui/DatePickerInput";
import { AthleteSearch } from "@/components/ui/AthleteSearch";
import { formatLocalDate } from "@/lib/utils";
import { saveTestRecord, TestType } from "@/lib/test-sync";
import { createClient } from "@/lib/supabase/client";
import { fetchScoringBaselines, calculateChallengeSG, getChallengePuttScore } from "@/lib/challenge-score-calculations";

interface ShotResult {
    id: number;
    result: "fairway" | "rough" | "penalty" | null;
}

interface IronShotResult {
    distance: number; // The target distance (e.g. 150)
    shotId: number; // 1-4
    proximity: number | ""; // m
}
interface PlayerState {
    driverShots: ShotResult[];
    selectedIronDistances: number[];
    ironShots: IronShotResult[];
    approachShots: IronShotResult[];
    bunkerShots: any[];
    longPuttShots: IronShotResult[];
    middlePuttShots: IronShotResult[];
    shortPuttShots: IronShotResult[];
    selectedGroup: string | null;
    selectedPart: TestType | null;
}

const getInitialPlayerState = (): PlayerState => ({
    driverShots: Array.from({ length: 6 }, (_, i) => ({ id: i + 1, result: null })),
    selectedIronDistances: [],
    ironShots: [],
    approachShots: Array.from({ length: 12 }, (_, i) => ({ distance: 0, shotId: i + 1, proximity: "" })),
    bunkerShots: Array.from({ length: 6 }, (_, i) => ({ distance: i < 3 ? "25m 이내" : "25m 이상", shotId: i + 1, proximity: "" })),
    longPuttShots: Array.from({ length: 4 }, (_, i) => ({ distance: 0, shotId: i + 1, proximity: "" })),
    middlePuttShots: Array.from({ length: 8 }, (_, i) => ({ distance: 0, shotId: i + 1, proximity: "" })),
    shortPuttShots: Array.from({ length: 6 }, (_, i) => ({ distance: 0, shotId: i + 1, proximity: "" })),
    selectedGroup: null,
    selectedPart: null
});

const DEFAULT_TEST_GROUPS = [
    {
        categoryId: "shot",
        label: "샷 종합 챌린지",
        parts: [
            { key: "iron", label: "아이언" },
            { key: "driver", label: "드라이버" }
        ]
    },
    {
        categoryId: "short_game",
        label: "숏게임 종합 챌린지",
        parts: [
            { key: "approach", label: "어프로치" },
            { key: "bunker", label: "벙커" }
        ]
    },
    {
        categoryId: "putting",
        label: "퍼팅 종합 챌린지",
        parts: [
            { key: "short_putt", label: "숏퍼팅" },
            { key: "middle_putt", label: "미들퍼팅" },
            { key: "long_putt", label: "롱퍼팅" }
        ]
    }
];

const SCORING = {
    fairway: -0.12,
    rough: 0.13,
    penalty: 0.54
};

const IRON_START_SCORES: Record<number, number> = {
    40: 0.375, 50: 0.325, 60: 0.275, 70: 0.225, 80: 0.175,
    90: 0.125, 100: 0.075, 110: 0.025, 120: -0.025, 130: -0.075,
    140: -0.125, 150: -0.175, 160: -0.225, 170: -0.275, 180: -0.325,
    190: -0.375, 200: -0.425, 210: -0.475, 220: -0.525, 230: -0.575
};

const IRON_RESULT_SCORES: Record<number, number> = {
    0: -1, 1: -0.9, 2: -0.65, 3: -0.4, 4: -0.3, 5: -0.2,
    6: -0.15, 7: -0.1, 8: -0.05, 9: 0, 10: 0.05, 11: 0.1,
    12: 0.14, 13: 0.18, 14: 0.21, 15: 0.24, 16: 0.26,
    17: 0.28, 18: 0.3, 19: 0.31, 20: 0.32
};

const getIronScore = (distance: number, prox: number): number => {
    if (distance >= 40 && distance <= 80) {
        if (prox >= 0 && prox <= 2) return -0.11;
    } else if (distance >= 90 && distance <= 130) {
        if (prox >= 0 && prox <= 3) return -0.11;
        if (prox >= 4 && prox <= 6) {
            if (distance === 90) return -0.02;
            if (distance === 100) return -0.04;
            if (distance === 110) return -0.06;
            if (distance === 120) return -0.08;
            if (distance === 130) return -0.09;
        }
    } else if (distance >= 140 && distance <= 180) {
        if (prox >= 0 && prox <= 4) return -0.12;
        if (prox >= 5 && prox <= 8) return -0.03;
        if (prox >= 9 && prox <= 12) return 0.13;
        return 0.23;
    } else if (distance >= 190 && distance <= 230) {
        if (prox >= 0 && prox <= 5) return -0.18;
        if (prox >= 6 && prox <= 10) return -0.10;
        if (prox >= 11 && prox <= 15) return 0.02;
        return 0.13;
    }
    const safeProx = Math.min(20, prox);
    return (IRON_START_SCORES[distance] ?? 0) + (IRON_RESULT_SCORES[safeProx] ?? 0.32);
};

const LONG_PUTT_LABELS: Record<number, string> = {
    1: "10m",
    2: "13m",
    3: "16m",
    4: "19m"
};

const MIDDLE_PUTT_LABELS: Record<number, string> = {
    1: "4m",
    2: "4.5m",
    3: "5m",
    4: "5.5m",
    5: "6m",
    6: "6.5m",
    7: "7m",
    8: "7.5m"
};

const SHORT_PUTT_LABELS: Record<number, string> = {
    1: "1m",
    2: "1.5m",
    3: "2m",
    4: "2.5m",
    5: "3m",
    6: "3.5m"
};

const SHORT_APPROACH_OPTIONS = [{ label: "0m", val: 0 }, { label: "1m", val: 1 }, { label: "2~3m", val: 3 }, { label: "4m 이상", val: 6 }];
const MIDDLE_APPROACH_OPTIONS = [{ label: "0m", val: 0 }, { label: "1m", val: 1 }, { label: "2~3m", val: 3 }, { label: "4m 이상", val: 6 }];
const LONG_APPROACH_OPTIONS = [{ label: "0m", val: 0 }, { label: "1~2m", val: 2 }, { label: "3~4m", val: 4 }, { label: "5m 이상", val: 6 }];

const SHORT_BUNKER_OPTIONS = [{ label: "0m", val: 0 }, { label: "1m", val: 1 }, { label: "2~3m", val: 3 }, { label: "4m 이상", val: 6 }];
const LONG_BUNKER_OPTIONS = [{ label: "0m", val: 0 }, { label: "1~2m", val: 2 }, { label: "3~5m", val: 5 }, { label: "6m 이상", val: 7 }];

const getApproachScore = (type: 'short' | 'middle' | 'long', prox: number): number => {
    if (type === 'short') {
        if (prox <= 0) return -0.60;
        if (prox <= 1) return -0.15;
        if (prox <= 3) return 0.20;
        return 0.40;
    } else if (type === 'middle') {
        if (prox <= 0) return -0.70;
        if (prox <= 1) return -0.25;
        if (prox <= 3) return 0.20;
        return 0.40;
    } else if (type === 'long') {
        if (prox <= 0) return -0.90;
        if (prox <= 2) return -0.25;
        if (prox <= 4) return 0.10;
        return 0.25;
    }
    return 0;
};

const getBunkerScore = (type: 'short' | 'long', prox: number): number => {
    if (type === 'short') {
        if (prox <= 0) return -1.00;
        if (prox <= 1) return -0.35;
        if (prox <= 3) return 0.05;
        return 0.25;
    } else if (type === 'long') {
        if (prox <= 0) return -1.05;
        if (prox <= 2) return -0.30;
        if (prox <= 5) return 0.05;
        return 0.25;
    }
    return 0;
};

const getPuttingScore = (type: 'short' | 'middle' | 'long', distIndex: number, putts: number): number => {
    if (type === 'short') {
        const scores = {
            1: { 1: -0.10, 2: 0.80, 3: 1.70, 4: 2.60 },
            2: { 1: -0.23, 2: 0.69, 3: 1.58, 4: 2.47 },
            3: { 1: -0.36, 2: 0.58, 3: 1.46, 4: 2.34 },
            4: { 1: -0.49, 2: 0.47, 3: 1.34, 4: 2.21 },
            5: { 1: -0.62, 2: 0.36, 3: 1.22, 4: 2.08 },
            6: { 1: -0.75, 2: 0.25, 3: 1.10, 4: 1.95 }
        };
        return scores[distIndex as keyof typeof scores]?.[putts as 1 | 2 | 3 | 4] ?? 0;
    } else if (type === 'middle') {
        const scores = {
            1: { 1: -0.60, 2: 0.20, 3: 1.00, 4: 1.80 },
            2: { 1: -0.63, 2: 0.18, 3: 0.97, 4: 1.76 },
            3: { 1: -0.66, 2: 0.16, 3: 0.94, 4: 1.72 },
            4: { 1: -0.69, 2: 0.14, 3: 0.91, 4: 1.68 },
            5: { 1: -0.72, 2: 0.12, 3: 0.88, 4: 1.64 },
            6: { 1: -0.75, 2: 0.10, 3: 0.85, 4: 1.60 },
            7: { 1: -0.78, 2: 0.08, 3: 0.82, 4: 1.56 },
            8: { 1: -0.81, 2: 0.06, 3: 0.79, 4: 1.52 }
        };
        return scores[distIndex as keyof typeof scores]?.[putts as 1 | 2 | 3 | 4] ?? 0;
    } else if (type === 'long') {
        const scores = {
            1: { 1: -0.90, 2: 0.00, 3: 0.90, 4: 1.80 },
            2: { 1: -0.95, 2: -0.04, 3: 0.70, 4: 1.50 },
            3: { 1: -1.00, 2: -0.08, 3: 0.50, 4: 1.20 },
            4: { 1: -1.05, 2: -0.12, 3: 0.30, 4: 0.90 }
        };
        return scores[distIndex as keyof typeof scores]?.[putts as 1 | 2 | 3 | 4] ?? 0;
    }
    return 0;
};

const getIronButtonOptions = (dist: number) => {
    if (dist <= 80) return [
        { label: '0~2m', val: 2 }, { label: '3~5m', val: 5 }, { label: '6~9m', val: 9 }, { label: '10m 이상', val: 15 }
    ];
    if (dist <= 130) return [
        { label: '0~3m', val: 3 }, { label: '4~6m', val: 6 }, { label: '7~10m', val: 10 }, { label: '11m 이상', val: 16 }
    ];
    if (dist <= 180) return [
        { label: '0~4m', val: 4 }, { label: '5~8m', val: 8 }, { label: '9~12m', val: 12 }, { label: '13m 이상', val: 18 }
    ];
    return [
        { label: '0~5m', val: 5 }, { label: '6~10m', val: 10 }, { label: '11~15m', val: 15 }, { label: '16m 이상', val: 21 }
    ];
};

function CreateTestContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const editId = searchParams.get("id");

    const formatScore = (val: number) => {
        if (typeof val !== "number" || isNaN(val)) return "0.00";
        return val > 0 ? `+${val.toFixed(2)}` : val.toFixed(2);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const inputs = Array.from(document.querySelectorAll('input[type="number"]')) as HTMLInputElement[];
            const currentIndex = inputs.indexOf(e.currentTarget);
            if (currentIndex > -1 && currentIndex < inputs.length - 1) {
                inputs[currentIndex + 1].focus();
                inputs[currentIndex + 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    };

    const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
    const [activePlayer, setActivePlayer] = useState<string>("");
    const [playerStates, setPlayerStates] = useState<Record<string, PlayerState>>({});
    
    const updateActiveState = <K extends keyof PlayerState>(key: K, updater: (prev: PlayerState[K]) => PlayerState[K]) => {
        if (!activePlayer) return;
        setPlayerStates(prev => {
            const state = prev[activePlayer] || getInitialPlayerState();
            return {
                ...prev,
                [activePlayer]: {
                    ...state,
                    [key]: updater(state[key])
                }
            };
        });
    };

    const activeState = playerStates[activePlayer] || getInitialPlayerState();
    const selectedGroup = activeState.selectedGroup;
    const selectedPart = activeState.selectedPart;

    const setSelectedGroup = (group: string | null) => updateActiveState('selectedGroup', () => group);
    const setSelectedPart = (part: TestType | null) => updateActiveState('selectedPart', () => part);

    // Fallback for when no player is selected but we need a string for old components (optional, but keeping it to avoid undefined errors)
    const selectedPlayer = activePlayer;
    const [testDate, setTestDate] = useState(() => formatLocalDate());
    const [testTime, setTestTime] = useState(() => {
        const now = new Date();
        return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    });
    const [currentCoachName, setCurrentCoachName] = useState("코치");
    const [isUploading, setIsUploading] = useState(false);
    const [isLoadingRecord, setIsLoadingRecord] = useState(false);
    const [baselines, setBaselines] = useState<any[]>([]);

    const [testGroups, setTestGroups] = useState(DEFAULT_TEST_GROUPS);

    // Fetch dynamic challenge templates
    useEffect(() => {
        const fetchTemplates = async () => {
            const supabase = createClient();
            const { data } = await supabase.from('challenge_templates').select('categoryId, title').order('sort_order');
            if (data && data.length > 0) {
                const newGroups = data.map((t: any) => {
                    const defaultGroup = DEFAULT_TEST_GROUPS.find(g => g.categoryId === t.categoryId);
                    return {
                        categoryId: t.categoryId,
                        label: t.title,
                        parts: defaultGroup ? defaultGroup.parts : []
                    };
                });
                setTestGroups(newGroups);
            }
        };
        fetchTemplates();
    }, []);

    // Challenge Search States
    const [challengeQuery, setChallengeQuery] = useState("");
    const [isChallengeSearchOpen, setIsChallengeSearchOpen] = useState(false);
    const challengeSearchRef = useRef<HTMLDivElement>(null);

    const scrollRef = useRef<HTMLDivElement>(null);

    const scrollLeft = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollBy({ left: -200, behavior: 'smooth' });
        }
    };

    const scrollRight = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollBy({ left: 200, behavior: 'smooth' });
        }
    };

    // Close challenge search when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (challengeSearchRef.current && !challengeSearchRef.current.contains(e.target as Node)) {
                setIsChallengeSearchOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const challengeSuggestions = useMemo(() => {
        if (!challengeQuery.trim()) return [];
        const normalizedQuery = challengeQuery.toLowerCase().replace(/\s+/g, '');

        const suggestions: { title: string, groupLabel: string, partKey?: string }[] = [];

        testGroups.forEach(group => {
            const groupMatch = group.label.toLowerCase().replace(/\s+/g, '').includes(normalizedQuery);
            const partMatch = group.parts.some(part => part.label.toLowerCase().replace(/\s+/g, '').includes(normalizedQuery));

            if (groupMatch || partMatch) {
                suggestions.push({ title: group.label, groupLabel: group.label });
            }
        });

        // Remove duplicates by title
        return suggestions.filter((v, i, a) => a.findIndex(t => t.title === v.title) === i);
    }, [challengeQuery]);

    const handleChallengeSelect = (suggestion: any) => {
        setSelectedGroup(suggestion.groupLabel);
        if (suggestion.partKey) {
            setSelectedPart(suggestion.partKey);
        }
        setChallengeQuery("");
        setIsChallengeSearchOpen(false);
    };

    // RBAC Check and fetch coach name
    useEffect(() => {
        const playerParam = searchParams.get("player");
        const typeParam = searchParams.get("type");
        const startParam = searchParams.get("start");

        let initialGroup: string | null = null;
        let initialPart: TestType | null = null;

        if (typeParam) {
            if (typeParam === 'shot') {
                initialPart = 'driver';
                initialGroup = '샷 종합 챌린지';
            } else if (typeParam === 'around_green') {
                initialPart = 'approach';
                initialGroup = '숏게임 종합 챌린지';
            } else if (typeParam === 'putting') {
                initialPart = 'long_putt';
                initialGroup = '퍼팅 종합 챌린지';
            } else {
                const partKey = typeParam as TestType;
                initialPart = partKey;
                const group = testGroups.find(g => g.parts.some(p => p.key === partKey));
                if (group) initialGroup = group.label;
            }
        }

        const supabase = createClient();
        supabase.auth.getUser().then(async ({ data: { user } }) => {
            if (user) {
                const { data: dbUser } = await supabase
                    .from("users")
                    .select("name, role")
                    .eq("id", user.id)
                    .maybeSingle();

                if (dbUser?.name) {
                    setCurrentCoachName(dbUser.name);
                    if (!editId) {
                        const targetPlayer = playerParam || dbUser.name;
                        setSelectedPlayers([targetPlayer]);
                        setActivePlayer(targetPlayer);
                        setPlayerStates({ 
                            [targetPlayer]: { 
                                ...getInitialPlayerState(), 
                                selectedGroup: initialGroup, 
                                selectedPart: initialPart 
                            } 
                        });
                    }
                }

                if (dbUser && dbUser.role !== 'coach' && dbUser.role !== 'admin') {
                    alert("챌린지 작성 권한이 없습니다.");
                    router.push("/training/challenges");
                }
            } else {
                router.push("/login");
            }
        });

        if (!editId && startParam) {
            setTestTime(startParam);
        }

        // Fetch baselines
        supabase.from("sg_baseline").select("*").order("distance_m").then(({ data }) => {
            if (data) setBaselines(data);
        });
    }, [router, searchParams, editId, testGroups]);

    // --- Edit Mode: Load existing record ---
    useEffect(() => {
        if (!editId) return;

        const fetchRecord = async () => {
            try {
                setIsLoadingRecord(true);
                const supabase = createClient();
                const { data, error } = await supabase
                    .from("test_sessions")
                    .select("*, athlete:users!test_sessions_user_id_fkey(name)")
                    .eq("id", editId)
                    .single();

                if (error || !data) {
                    console.error("Failed to fetch record for editing:", error);
                    return;
                }

                // Populate basic info
                const athleteName = data.athlete?.name || "";
                setSelectedPlayers([athleteName]);
                setActivePlayer(athleteName);
                const loadedState = getInitialPlayerState();
                const createdAt = new Date(data.created_at);
                setTestDate(data.created_at.split("T")[0]);
                setTestTime(`${String(createdAt.getHours()).padStart(2, '0')}:${String(createdAt.getMinutes()).padStart(2, '0')}`);

                const content = typeof data.raw_shot_data === 'string' ? JSON.parse(data.raw_shot_data) : data.raw_shot_data;
                const category = data.category;

                if (category === "shot" || category === "driver" || category === "iron") {
                    loadedState.selectedPart = "driver";
                    loadedState.selectedGroup = "샷 종합 챌린지";
                    if (content.driver?.shots) loadedState.driverShots = content.driver.shots;
                    else if (category === "driver" && content.shots) loadedState.driverShots = content.shots;

                    if (content.iron?.shots) loadedState.ironShots = content.iron.shots;
                    else if (category === "iron" && content.shots) loadedState.ironShots = content.shots;

                    if (content.iron?.distances) loadedState.selectedIronDistances = content.iron.distances;
                    else if (category === "iron" && content.distances) loadedState.selectedIronDistances = content.distances;
                } else if (category === "around_green" || category === "approach" || category === "bunker") {
                    loadedState.selectedPart = "approach";
                    loadedState.selectedGroup = "숏게임 종합 챌린지";
                    if (content.approach?.shots) loadedState.approachShots = content.approach.shots;
                    else if (category === "approach" && content.shots) loadedState.approachShots = content.shots;

                    if (content.bunker?.shots) loadedState.bunkerShots = content.bunker.shots;
                    else if (category === "bunker" && content.shots) loadedState.bunkerShots = content.shots;
                } else if (category === "long_putt" || category === "middle_putt" || category === "short_putt" || category === "putting") {
                    loadedState.selectedPart = (category === "putting" ? "long_putt" : category) as TestType;
                    loadedState.selectedGroup = "퍼팅 종합 챌린지";
                    if (category === "putting") {
                        if (content.long?.shots) loadedState.longPuttShots = content.long.shots;
                        if (content.middle?.shots) loadedState.middlePuttShots = content.middle.shots;
                        if (content.short?.shots) loadedState.shortPuttShots = content.short.shots;
                    } else {
                        if (content.shots) {
                            if (category === "long_putt") loadedState.longPuttShots = content.shots;
                            if (category === "middle_putt") loadedState.middlePuttShots = content.shots;
                            if (category === "short_putt") loadedState.shortPuttShots = content.shots;
                        }
                    }
                }
                setPlayerStates({ [athleteName]: loadedState });
            } catch (err) {
                console.error("Error loading record:", err);
            } finally {
                setIsLoadingRecord(false);
            }
        };

        fetchRecord();
    }, [editId]);

    // --- Data State for all parts ---
    const {
        driverShots,
        selectedIronDistances,
        ironShots,
        approachShots,
        bunkerShots,
        longPuttShots,
        middlePuttShots,
        shortPuttShots
    } = activeState;


    // --- Calculations ---
    const scores = useMemo(() => {
        const driver = driverShots.reduce((acc, shot) => shot.result ? acc + SCORING[shot.result] : acc, 0);

        const iron = ironShots.reduce((acc, shot) => {
            if (shot.proximity === "") return acc;
            const prox = Math.round(Number(shot.proximity));
            return acc + getIronScore(shot.distance, prox);
        }, 0);

        const approach = approachShots.reduce((acc, shot) => {
            if (shot.proximity === "") return acc;
            const prox = Math.round(Number(shot.proximity));
            const type = shot.shotId <= 4 ? 'short' : shot.shotId <= 8 ? 'middle' : 'long';
            return acc + getApproachScore(type, prox);
        }, 0);

        const bunker = bunkerShots.reduce((acc, shot) => {
            if (shot.proximity === "") return acc;
            const prox = Math.round(Number(shot.proximity));
            const type = shot.shotId <= 3 ? 'short' : 'long';
            return acc + getBunkerScore(type, prox);
        }, 0);

        const calcPutting = (shots: IronShotResult[], type: 'long' | 'middle' | 'short') => {
            return shots.reduce((acc, shot) => {
                if (shot.proximity === "") return acc;
                const putts = Number(shot.proximity);
                return acc + getPuttingScore(type, shot.shotId, putts);
            }, 0);
        };

        const longPutt = calcPutting(longPuttShots, "long");
        const middlePutt = calcPutting(middlePuttShots, "middle");
        const shortPutt = calcPutting(shortPuttShots, "short");

        // Detailed 숏게임 breakdowns
        const shortApproach = approachShots.slice(0, 4).reduce((acc, shot) => {
            if (shot.proximity === "") return acc;
            return acc + getApproachScore('short', Math.round(Number(shot.proximity)));
        }, 0);

        const middleApproach = approachShots.slice(4, 8).reduce((acc, shot) => {
            if (shot.proximity === "") return acc;
            return acc + getApproachScore('middle', Math.round(Number(shot.proximity)));
        }, 0);

        const longApproach = approachShots.slice(8, 12).reduce((acc, shot) => {
            if (shot.proximity === "") return acc;
            return acc + getApproachScore('long', Math.round(Number(shot.proximity)));
        }, 0);

        const shortBunker = bunkerShots.slice(0, 3).reduce((acc, shot) => {
            if (shot.proximity === "") return acc;
            return acc + getBunkerScore('short', Math.round(Number(shot.proximity)));
        }, 0);

        const longBunker = bunkerShots.slice(3, 6).reduce((acc, shot) => {
            if (shot.proximity === "") return acc;
            return acc + getBunkerScore('long', Math.round(Number(shot.proximity)));
        }, 0);

        // Subtotals
        const shotSubtotal = driver + iron;
        const aroundSubtotal = approach + bunker;
        const puttingSubtotal = longPutt + middlePutt + shortPutt;

        return {
            driver, iron, approach, bunker,
            shortApproach, middleApproach, longApproach,
            shortBunker, longBunker,
            long_putt: longPutt, middle_putt: middlePutt, short_putt: shortPutt,
            shotSubtotal, aroundSubtotal, puttingSubtotal,
            total: shotSubtotal + aroundSubtotal + puttingSubtotal,
            // Completion flags
            isDriverComplete: driverShots.every(s => s.result !== null),
            isIronComplete: ironShots.length === 12 && ironShots.every(s => s.proximity !== ""),
            isApproachComplete: approachShots.every(s => s.proximity !== ""),
            isBunkerComplete: bunkerShots.every(s => s.proximity !== ""),
            isLongPuttComplete: longPuttShots.every(s => s.proximity !== ""),
            isMiddlePuttComplete: middlePuttShots.every(s => s.proximity !== ""),
            isShortPuttComplete: shortPuttShots.every(s => s.proximity !== "")
        };
    }, [driverShots, ironShots, approachShots, bunkerShots, longPuttShots, middlePuttShots, shortPuttShots]);

    const handleDriverResultSelect = (shotId: number, result: "fairway" | "rough" | "penalty") => {
        updateActiveState('driverShots', prev => prev.map(s => s.id === shotId ? { ...s, result: s.result === result ? null : result } : s));
    };

    const toggleIronDistance = (dist: number) => {
        let nextDists: number[] = [];
        updateActiveState('selectedIronDistances', prev => {
            if (prev.includes(dist)) nextDists = prev.filter(d => d !== dist);
            else if (prev.length >= 3) nextDists = prev;
            else nextDists = [...prev, dist].sort((a, b) => a - b);
            return nextDists;
        });

        updateActiveState('ironShots', prev => {
            const newShots: IronShotResult[] = [];
            nextDists.forEach(d => {
                for (let i = 1; i <= 4; i++) {
                    const existing = prev.find(s => s.distance === d && s.shotId === i);
                    newShots.push(existing || { distance: d, shotId: i, proximity: "" });
                }
            });
            return newShots;
        });
    };

    const updateIronShot = (dist: number, shotId: number, field: keyof IronShotResult, value: any) => {
        let finalValue = value;
        if (field === 'proximity' && value !== "") {
            finalValue = Math.max(0, Math.floor(Number(value)));
        }
        updateActiveState('ironShots', prev => prev.map(s => (s.distance === dist && s.shotId === shotId) ? { ...s, [field]: finalValue } : s));
    };

    const updateApproachShot = (shotId: number, value: any) => {
        const finalValue = value === "" ? "" : Math.max(0, Math.floor(Number(value)));
        updateActiveState('approachShots', prev => prev.map(s => s.shotId === shotId ? { ...s, proximity: finalValue } : s));
    };

    const updateBunkerShot = (shotId: number, value: any) => {
        const finalValue = value === "" ? "" : Math.max(0, Math.floor(Number(value)));
        updateActiveState('bunkerShots', prev => prev.map(s => s.shotId === shotId ? { ...s, proximity: finalValue } : s));
    };

    const updateLongPuttShot = (shotId: number, value: any) => {
        updateActiveState('longPuttShots', prev => prev.map(s => s.shotId === shotId ? { ...s, proximity: s.proximity === value ? "" : value } : s));
    };

    const updateMiddlePuttShot = (shotId: number, value: any) => {
        updateActiveState('middlePuttShots', prev => prev.map(s => s.shotId === shotId ? { ...s, proximity: s.proximity === value ? "" : value } : s));
    };

    const updateShortPuttShot = (shotId: number, value: any) => {
        updateActiveState('shortPuttShots', prev => prev.map(s => s.shotId === shotId ? { ...s, proximity: s.proximity === value ? "" : value } : s));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedPlayers.length === 0) {
            alert("선수를 한 명 이상 선택해주세요.");
            return;
        }
        const validPlayers: string[] = [];
        const payloads: any[] = [];
        let hasIncomplete = false;

        for (const player of selectedPlayers) {
            const state = playerStates[player];
            if (!state) continue;

            if (!state.selectedPart) {
                alert(`${player} 선수의 테스트 파트를 선택해주세요.`);
                setActivePlayer(player);
                return;
            }

            const pPart = state.selectedPart;
            const partLabel = testGroups.flatMap(g => g.parts).find(p => p.key === pPart)?.label || pPart;
            let categoryToSave = pPart as string;
            let finalTitle = `${partLabel} 테스트`;
            if (pPart === "driver" || pPart === "iron") {
                categoryToSave = "shot";
                finalTitle = `샷 종합 챌린지`;
            } else if (pPart === "approach" || pPart === "bunker") {
                categoryToSave = "around_green";
                finalTitle = `숏게임 종합 챌린지`;
            } else if (pPart === "long_putt" || pPart === "middle_putt" || pPart === "short_putt") {
                categoryToSave = "putting";
                finalTitle = `퍼팅 종합 챌린지`;
            }

            let isComplete = true;
            let content: any = {};

            if (categoryToSave === "shot") {
                if (state.selectedIronDistances.length < 3) {
                    alert("아이언 테스트에서 거리 3개를 선택해 주세요");
                    setActivePlayer(player);
                    return;
                }
                const driverComplete = state.driverShots.every(s => s.result !== null);
                const ironComplete = state.ironShots.length === 12 && state.ironShots.every(s => s.proximity !== "");
                if (!driverComplete || !ironComplete) isComplete = false;
                else {
                    const drvScore = state.driverShots.reduce((acc, s) => s.result ? acc + SCORING[s.result] : acc, 0);
                    const irnScore = state.ironShots.reduce((acc, s) => s.proximity !== "" ? acc + getIronScore(s.distance, Math.round(Number(s.proximity))) : acc, 0);
                    content = { type: "combined_shot", driver: { shots: state.driverShots, score: drvScore }, iron: { shots: state.ironShots, score: irnScore, distances: state.selectedIronDistances }, totalScore: drvScore + irnScore };
                }
            } else if (categoryToSave === "around_green") {
                const approachComplete = state.approachShots.every(s => s.proximity !== "");
                const bunkerComplete = state.bunkerShots.every(s => s.proximity !== "");
                if (!approachComplete || !bunkerComplete) isComplete = false;
                else {
                    const appScore = state.approachShots.reduce((acc, s) => {
                        if (s.proximity === "") return acc;
                        const type = s.shotId <= 4 ? 'short' : s.shotId <= 8 ? 'middle' : 'long';
                        return acc + getApproachScore(type, Math.round(Number(s.proximity)));
                    }, 0);
                    const bnkScore = state.bunkerShots.reduce((acc, s) => {
                        if (s.proximity === "") return acc;
                        const type = s.shotId <= 3 ? 'short' : 'long';
                        return acc + getBunkerScore(type, Math.round(Number(s.proximity)));
                    }, 0);
                    content = { type: "combined_around_green", approach: { shots: state.approachShots, score: appScore }, bunker: { shots: state.bunkerShots, score: bnkScore }, totalScore: appScore + bnkScore };
                }
            } else if (categoryToSave === "putting") {
                const longComplete = state.longPuttShots.every(s => s.proximity !== "");
                const middleComplete = state.middlePuttShots.every(s => s.proximity !== "");
                const shortComplete = state.shortPuttShots.every(s => s.proximity !== "");
                if (!longComplete || !middleComplete || !shortComplete) isComplete = false;
                else {
                    const calcPutting = (shots: IronShotResult[], type: 'long' | 'middle' | 'short') => {
                        return shots.reduce((acc, s) => {
                            if (s.proximity === "") return acc;
                            return acc + getPuttingScore(type, s.shotId, Number(s.proximity));
                        }, 0);
                    };
                    const lp = calcPutting(state.longPuttShots, 'long');
                    const mp = calcPutting(state.middlePuttShots, 'middle');
                    const sp = calcPutting(state.shortPuttShots, 'short');
                    content = { type: "combined_putting", long: { shots: state.longPuttShots, score: lp }, middle: { shots: state.middlePuttShots, score: mp }, short: { shots: state.shortPuttShots, score: sp }, totalScore: lp + mp + sp };
                }
            }

            if (isComplete) {
                validPlayers.push(player);
                payloads.push({
                    id: editId || undefined,
                    playerName: player,
                    coachName: currentCoachName,
                    category: categoryToSave,
                    title: finalTitle,
                    content,
                    date: testDate,
                    time: testTime
                });
            } else {
                hasIncomplete = true;
                // Focus on the first incomplete player
                if (!hasIncomplete || activePlayer !== player) {
                    setActivePlayer(player);
                }
            }
        }

        if (validPlayers.length === 0) {
            alert("모든 기록이 완료된 선수가 없습니다. 기록을 완성해주세요.");
            return;
        }

        if (hasIncomplete) {
            const proceed = confirm("미완료된 선수의 데이터는 저장되지 않습니다. 저장하시겠습니까?");
            if (!proceed) return;
        }

        try {
            setIsUploading(true);
            await Promise.all(payloads.map(payload => saveTestRecord(payload)));

            alert(editId ? "챌린지 기록이 수정되었습니다." : `${validPlayers.length}명의 챌린지 기록이 저장되었습니다.`);
            router.push("/training/challenges");
        } catch (err: any) {
            console.error("Test save error details:", { message: err.message, stack: err.stack, fullError: err });
            alert("저장 중 오류가 발생했습니다: " + (err.message || "알 수 없는 에러"));
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4 sm:px-8 py-6 pb-24">
            <div className="max-w-3xl mx-auto">
                {/* ── Header ── */}
                <div className="flex items-center gap-3 mb-8">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-50 transition-colors"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                        {editId ? "챌린지 수정" : "챌린지 작성"}
                    </h1>
                </div>

                {(editId || isLoadingRecord) && (
                    <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl flex items-center gap-3">
                        {isLoadingRecord ? (
                            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Info className="text-blue-500" size={20} />
                        )}
                        <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                            {isLoadingRecord ? "기존 데이터를 불러오는 중입니다..." : (
                                <>기존에 작성된 <span className="font-bold underline">
                                    {(selectedPart === 'driver' || selectedPart === 'iron') ? '샷(드라이버/아이언)' :
                                        (selectedPart === 'approach' || selectedPart === 'bunker') ? '그린 주변(어프로치/벙커)' :
                                            testGroups.flatMap(g => g.parts).find(p => p.key === selectedPart)?.label}
                                </span> 테스트를 수정 중입니다.</>
                            )}
                        </p>
                    </div>
                )}

                {selectedPlayers.length > 1 && (
                    <div className="sticky top-[64px] md:top-0 z-[40] -mx-4 sm:-mx-8 mb-8 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 transition-all">
                        <div className="max-w-3xl mx-auto px-4 sm:px-8 py-3">
                            <div className="flex flex-nowrap overflow-x-auto gap-3 pt-2 pb-1 pr-2 scrollbar-hide items-center">
                                {selectedPlayers.map(player => (
                                    <div
                                        key={player}
                                        onClick={() => setActivePlayer(player)}
                                        className={cn(
                                            "relative flex-shrink-0 inline-flex items-center justify-center min-w-[70px] px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer select-none",
                                            activePlayer === player
                                                ? "bg-brand-navy text-white border-brand-navy shadow-sm scale-105"
                                                : "bg-white text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:scale-105"
                                        )}
                                    >
                                        <span>{player}</span>
                                        {!editId && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const newPlayers = selectedPlayers.filter(p => p !== player);
                                                    setSelectedPlayers(newPlayers);
                                                    if (activePlayer === player) setActivePlayer(newPlayers[0] || "");
                                                    setPlayerStates(prev => {
                                                        const next = { ...prev };
                                                        delete next[player];
                                                        return next;
                                                    });
                                                }}
                                                className={cn(
                                                    "absolute -top-1.5 -right-1.5 rounded-full p-[3px] border shadow-sm transition-all",
                                                    activePlayer === player
                                                        ? "bg-brand-navy-dark text-white border-brand-navy-dark hover:bg-red-500 hover:border-red-500"
                                                        : "bg-white text-zinc-400 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 hover:text-red-500 hover:border-red-200"
                                                )}
                                            >
                                                <X size={10} strokeWidth={2.5} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* ── 1. Basic Info ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm space-y-6">
                        <div className="space-y-4">
                            <label className="block text-sm font-bold text-zinc-800 dark:text-zinc-200">
                                선수 선택 <span className="text-brand-red">*</span>
                            </label>
                            <AthleteSearch
                                multi={editId === null}
                                showChips={selectedPlayers.length === 1}
                                selectedNames={selectedPlayers}
                                onSelect={(name) => {
                                    if (editId) return; // Prevent multi-select in edit mode
                                    if (!selectedPlayers.includes(name)) {
                                        setSelectedPlayers(prev => [...prev, name]);
                                        setPlayerStates(prev => ({ ...prev, [name]: getInitialPlayerState() }));
                                        setActivePlayer(name);
                                    }
                                }}
                                onRemove={(name) => {
                                    if (editId) return;
                                    const newPlayers = selectedPlayers.filter(p => p !== name);
                                    setSelectedPlayers(newPlayers);
                                    if (activePlayer === name) setActivePlayer(newPlayers[0] || "");
                                    setPlayerStates(prev => {
                                        const next = { ...prev };
                                        delete next[name];
                                        return next;
                                    });
                                }}
                                placeholder="선수 이름 검색 후 Enter..."
                            />
                        </div>

                        <div className="space-y-4">
                            <label className="block text-sm font-bold text-zinc-800 dark:text-zinc-200">
                                챌린지 일자 <span className="text-brand-red">*</span>
                            </label>
                            <div className="relative">
                                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                <DatePickerInput
                                    value={testDate}
                                    onChange={(e) => setTestDate(e.target.value)}
                                    required
                                    className="w-full pl-12 pr-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all text-center"
                                />
                            </div>
                        </div>
                    </section>

                    {/* ── 2. Two-Step Category Selection ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2.5rem] shadow-sm">

                        {/* Title */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
                            <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">챌린지 선택</h2>
                        </div>

                        {/* Main Group Selection */}
                        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
                            {testGroups.map((group) => {
                                const isSelected = selectedGroup === group.label;
                                return (
                                    <button
                                        key={group.label}
                                        type="button"
                                        disabled={editId !== null || !selectedPlayer}
                                        onClick={() => setSelectedGroup(isSelected ? null : group.label)}
                                        title={!selectedPlayer ? "선수를 먼저 선택해주세요" : ""}
                                        className={cn(
                                            "w-full flex flex-col items-center justify-center py-4 sm:py-5 rounded-[1.5rem] sm:rounded-[2rem] border-2 transition-all gap-2",
                                            isSelected
                                                ? "bg-brand-navy text-white border-brand-navy shadow-xl shadow-brand-navy/20 scale-[1.02]"
                                                : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-100 dark:border-zinc-800 text-zinc-400 hover:border-zinc-200",
                                            (editId !== null || !selectedPlayer) && !isSelected && "opacity-30 grayscale cursor-not-allowed"
                                        )}
                                    >
                                        <div className={cn("p-2.5 rounded-2xl", isSelected ? "bg-white/20" : "bg-white dark:bg-zinc-900 shadow-sm")}>
                                            {group.label.includes("샷") ? <Target size={22} /> : group.label.includes("숏게임") ? <Flag size={22} /> : <Crown size={22} />}
                                        </div>
                                        <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-tighter whitespace-nowrap">{group.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Sub-Part Selection (Conditional Reveal) */}
                        {selectedGroup && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                                <div className="h-[1px] bg-zinc-100 dark:bg-zinc-800 w-full mb-2" />
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                    {testGroups.find(g => g.label === selectedGroup)?.parts.map((opt) => (
                                        <button
                                            key={opt.key}
                                            type="button"
                                            disabled={editId !== null || !selectedPlayer}
                                            onClick={() => setSelectedPart(opt.key as TestType)}
                                            title={!selectedPlayer ? "선수를 먼저 선택해주세요" : ""}
                                            className={cn(
                                                "w-full py-3.5 rounded-2xl text-[11px] font-bold transition-all border flex items-center justify-center text-center",
                                                selectedPart === opt.key
                                                    ? "bg-brand-red text-white border-brand-red shadow-lg shadow-brand-red/20 scale-[1.02]"
                                                    : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-brand-navy/30",
                                                (editId !== null || !selectedPlayer) && "opacity-30 cursor-not-allowed grayscale"
                                            )}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>

                    {/* ── 3. Detail Input (Driver) ── */}
                    {selectedPart === "driver" && (
                        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-black text-brand-navy italic">DRIVER TEST (6회)</h3>
                                <div className="text-right">
                                    <span className="text-xs text-zinc-400 block mb-1">합계 점수</span>
                                    <span className={cn(
                                        "text-xl font-black italic",
                                        scores.driver < 0 ? "text-brand-red" : scores.driver > 0 ? "text-blue-600" : "text-zinc-400"
                                    )}>
                                        {scores.driver > 0 ? `+${scores.driver.toFixed(2)}` : scores.driver.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                            <div className="space-y-4">
                                {driverShots.map((shot) => (
                                    <div key={shot.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 transition-all gap-3">
                                        <div className="flex items-center gap-3">
                                            <span className="w-8 h-8 flex items-center justify-center bg-white dark:bg-zinc-900 rounded-full text-xs font-black text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                                                {shot.id}
                                            </span>
                                            <span className="text-sm font-bold text-zinc-600 dark:text-zinc-400">Driver Shot</span>
                                        </div>
                                        <div className="flex gap-2 w-full sm:w-auto">
                                            {(["fairway", "rough", "penalty"] as const).map((res) => (
                                                <button
                                                    key={res}
                                                    type="button"
                                                    onClick={() => handleDriverResultSelect(shot.id, res)}
                                                    className={cn(
                                                        "flex-1 sm:flex-none px-2 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all border whitespace-nowrap",
                                                        shot.result === res
                                                            ? res === "fairway" ? "bg-emerald-500 text-white border-emerald-500" :
                                                                res === "rough" ? "bg-amber-500 text-white border-amber-500" :
                                                                    "bg-brand-red text-white border-brand-red"
                                                            : "bg-white dark:bg-zinc-900 text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-brand-navy/30"
                                                    )}
                                                >
                                                    {res === "fairway" ? "페어웨이" : res === "rough" ? "러프" : "패널티"}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Total Score for Driver */}
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 p-6 rounded-[2rem] shadow-sm flex items-center justify-between mt-6">
                                <div>
                                    <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">드라이버 테스트 합계 점수</p>
                                </div>
                                <div className="text-right">
                                    <span className={cn(
                                        "text-3xl font-black italic",
                                        scores.driver < 0 ? "text-brand-red" : scores.driver > 0 ? "text-blue-600" : "text-zinc-400"
                                    )}>
                                        {scores.driver > 0 ? `+${scores.driver.toFixed(2)}` : scores.driver.toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedPart("iron");
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    className={cn(
                                        "w-full py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md",
                                        scores.isDriverComplete
                                            ? "bg-brand-navy text-white shadow-brand-navy/20"
                                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
                                    )}
                                >
                                    다음: 아이언 테스트 작성 <ChevronRight size={18} />
                                </button>
                            </div>
                        </section>
                    )}

                    {/* ── 3. Detail Input (Iron) ── */}
                    {selectedPart === "iron" && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                            {/* Distance Selection */}
                            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                                        거리 선택 (3개 선택)
                                    </h3>
                                    <span className="text-[10px] text-brand-navy font-bold px-2 py-0.5 bg-brand-navy/10 rounded-full">
                                        {selectedIronDistances.length} / 3
                                    </span>
                                </div>
                                <div className="grid grid-cols-5 gap-2">
                                    {Array.from({ length: 20 }, (_, i) => 40 + (i * 10)).map((dist) => (
                                        <button
                                            key={dist}
                                            type="button"
                                            onClick={() => toggleIronDistance(dist)}
                                            className={cn(
                                                "py-2 rounded-xl text-[11px] font-black transition-all border",
                                                selectedIronDistances.includes(dist)
                                                    ? "bg-brand-navy text-white border-brand-navy shadow-sm"
                                                    : "bg-white dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-700"
                                            )}
                                        >
                                            {dist}m
                                        </button>
                                    ))}
                                </div>
                            </section>

                            {/* Shot Inputs per Distance */}
                            {selectedIronDistances.map((dist) => {
                                const distScore = ironShots.filter(s => s.distance === dist).reduce((acc, shot) => {
                                    if (shot.proximity === "") return acc;
                                    const prox = Math.round(Number(shot.proximity));
                                    return acc + getIronScore(shot.distance, prox);
                                }, 0);

                                return (
                                    <section key={dist} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-lg font-black text-brand-navy dark:text-brand-navy-light italic">
                                                {dist}m <span className="text-xs not-italic font-bold text-zinc-400 ml-1">Iron Test</span>
                                            </h3>
                                            <div className="text-right">
                                                <span className="text-xs text-zinc-400 block mb-1">합계 점수</span>
                                                <span className={cn(
                                                    "text-xl font-black italic",
                                                    distScore < 0 ? "text-brand-red" : distScore > 0 ? "text-blue-600" : "text-zinc-400"
                                                )}>
                                                    {distScore > 0 ? `+${distScore.toFixed(2)}` : distScore.toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            {ironShots.filter(s => s.distance === dist).map((shot) => {
                                                const options = getIronButtonOptions(dist);
                                                return (
                                                    <div key={`${dist}-${shot.shotId}`} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 gap-3">
                                                        <div className="flex items-center gap-3">
                                                            <span className="w-8 h-8 flex items-center justify-center bg-white dark:bg-zinc-900 rounded-full text-xs font-black text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                                                                {shot.shotId}
                                                            </span>
                                                            <span className="text-sm font-bold text-zinc-600 dark:text-zinc-400">{dist}m</span>
                                                        </div>
                                                        <div className="flex gap-1 w-full sm:w-auto">
                                                            {options.map((opt) => (
                                                                <button
                                                                    key={opt.label}
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        const isDeselecting = shot.proximity === opt.val;
                                                                        updateIronShot(dist, shot.shotId, 'proximity', isDeselecting ? "" : opt.val);
                                                                        const parentRow = e.currentTarget.closest('.flex-col');
                                                                        if (!isDeselecting && parentRow && parentRow.nextElementSibling) {
                                                                            parentRow.nextElementSibling.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                        }
                                                                    }}
                                                                    className={cn(
                                                                        "flex-1 sm:flex-none px-1.5 py-2 rounded-xl text-[10px] font-bold transition-all whitespace-nowrap",
                                                                        shot.proximity === opt.val
                                                                            ? "bg-brand-navy text-white shadow-sm"
                                                                            : "bg-white dark:bg-zinc-900 text-zinc-500 border border-zinc-200 dark:border-zinc-700"
                                                                    )}
                                                                >
                                                                    {opt.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </section>
                                );
                            })}

                            {/* Total Score for Iron */}
                            {selectedIronDistances.length > 0 && (
                                <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 p-6 rounded-[2rem] shadow-sm flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">아이언 테스트 합계 점수</p>
                                    </div>
                                    <div className="text-right">
                                        <span className={cn(
                                            "text-3xl font-black italic",
                                            scores.iron < 0 ? "text-brand-red" : scores.iron > 0 ? "text-blue-600" : "text-zinc-400"
                                        )}>
                                            {scores.iron > 0 ? `+${scores.iron.toFixed(2)}` : scores.iron.toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            )}


                        </div>
                    )}

                    {selectedPart === "approach" && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                            <h3 className="text-lg font-black text-brand-navy dark:text-brand-navy-light italic pl-2">어프로치 테스트 (12회)</h3>
                            {[
                                { title: "숏 어프로치 테스트", shots: approachShots.slice(0, 4), labelMap: { 1: "5~10m", 2: "5~10m", 3: "5~10m", 4: "5~10m" }, scoreKey: 'shortApproach' },
                                { title: "미들 어프로치 테스트", shots: approachShots.slice(4, 8), labelMap: { 5: "15m", 6: "15m", 7: "20m", 8: "20m" }, scoreKey: 'middleApproach' },
                                { title: "롱 어프로치 테스트", shots: approachShots.slice(8, 12), labelMap: { 9: "26m 이상", 10: "26m 이상", 11: "30m", 12: "30m" }, scoreKey: 'longApproach' }
                            ].map((group, gIdx) => {
                                const distScore = (scores as any)[group.scoreKey];
                                return (
                                    <section key={gIdx} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-sm font-bold text-zinc-400 dark:text-zinc-500">{group.title}</h4>
                                            <div className="text-right">
                                                <span className="text-[10px] text-zinc-400 block mb-0.5">합계 점수</span>
                                                <span className={cn(
                                                    "text-lg font-black italic",
                                                    distScore < 0 ? "text-brand-red" : distScore > 0 ? "text-blue-600" : "text-zinc-400"
                                                )}>
                                                    {distScore > 0 ? `+${distScore.toFixed(2)}` : distScore.toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            {group.shots.map((shot) => (
                                                <div key={shot.shotId} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 gap-3">
                                                    <div className="flex items-center gap-3">
                                                        <span className="w-8 h-8 flex items-center justify-center bg-white dark:bg-zinc-900 rounded-full text-xs font-black text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                                                            {shot.shotId}
                                                        </span>
                                                        <span className="text-sm font-bold text-zinc-600 dark:text-zinc-400">{(group.labelMap as any)[shot.shotId]}</span>
                                                    </div>
                                                    <div className="flex gap-1 w-full sm:w-auto">
                                                        {(group.scoreKey === 'shortApproach' ? SHORT_APPROACH_OPTIONS : group.scoreKey === 'middleApproach' ? MIDDLE_APPROACH_OPTIONS : LONG_APPROACH_OPTIONS).map((opt) => (
                                                            <button
                                                                key={opt.label}
                                                                type="button"
                                                                onClick={(e) => {
                                                                    const isDeselecting = shot.proximity === opt.val;
                                                                    updateApproachShot(shot.shotId, isDeselecting ? "" : opt.val);
                                                                    const parentRow = e.currentTarget.closest('.flex-col');
                                                                    if (!isDeselecting && parentRow && parentRow.nextElementSibling) {
                                                                        parentRow.nextElementSibling.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                    }
                                                                }}
                                                                className={cn(
                                                                    "flex-1 sm:flex-none px-1.5 py-2 rounded-xl text-[10px] font-bold transition-all whitespace-nowrap",
                                                                    shot.proximity === opt.val
                                                                        ? "bg-brand-navy text-white shadow-sm"
                                                                        : "bg-white dark:bg-zinc-900 text-zinc-500 border border-zinc-200 dark:border-zinc-700"
                                                                )}
                                                            >
                                                                {opt.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                );
                            })}

                            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 p-6 rounded-[2rem] shadow-sm flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">어프로치 합계 점수</p>
                                </div>
                                <div className="text-right">
                                    <span className={cn(
                                        "text-3xl font-black italic",
                                        scores.approach < 0 ? "text-brand-red" : scores.approach > 0 ? "text-blue-600" : "text-zinc-400"
                                    )}>
                                        {scores.approach > 0 ? `+${scores.approach.toFixed(2)}` : scores.approach.toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            <div className="mt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedPart("bunker");
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    className={cn(
                                        "w-full py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md",
                                        scores.isApproachComplete
                                            ? "bg-brand-navy text-white shadow-brand-navy/20"
                                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
                                    )}
                                >
                                    다음: 벙커 테스트 작성 <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    )}

                    {selectedPart === "bunker" && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                            <h3 className="text-lg font-black text-brand-navy dark:text-brand-navy-light italic pl-2">벙커 테스트 (6회)</h3>
                            {[
                                { title: "숏 벙커 테스트", shots: bunkerShots.slice(0, 3), label: "25m 이내", scoreKey: 'shortBunker' },
                                { title: "롱 벙커 테스트", shots: bunkerShots.slice(3, 6), label: "25m 이상", scoreKey: 'longBunker' }
                            ].map((group, gIdx) => {
                                const distScore = (scores as any)[group.scoreKey];
                                return (
                                    <section key={gIdx} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-sm font-bold text-zinc-400 dark:text-zinc-500">{group.title}</h4>
                                            <div className="text-right">
                                                <span className="text-[10px] text-zinc-400 block mb-0.5">합계 점수</span>
                                                <span className={cn(
                                                    "text-lg font-black italic",
                                                    distScore < 0 ? "text-brand-red" : distScore > 0 ? "text-blue-600" : "text-zinc-400"
                                                )}>
                                                    {distScore > 0 ? `+${distScore.toFixed(2)}` : distScore.toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            {group.shots.map((shot) => (
                                                <div key={shot.shotId} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 gap-3">
                                                    <div className="flex items-center gap-3">
                                                        <span className="w-8 h-8 flex items-center justify-center bg-white dark:bg-zinc-900 rounded-full text-xs font-black text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                                                            {shot.shotId}
                                                        </span>
                                                        <span className="text-sm font-bold text-zinc-600 dark:text-zinc-400">{group.label}</span>
                                                    </div>
                                                    <div className="flex gap-1 w-full sm:w-auto">
                                                        {(group.scoreKey === 'shortBunker' ? SHORT_BUNKER_OPTIONS : LONG_BUNKER_OPTIONS).map((opt) => (
                                                            <button
                                                                key={opt.label}
                                                                type="button"
                                                                onClick={(e) => {
                                                                    const isDeselecting = shot.proximity === opt.val;
                                                                    updateBunkerShot(shot.shotId, isDeselecting ? "" : opt.val);
                                                                    const parentRow = e.currentTarget.closest('.flex-col');
                                                                    if (!isDeselecting && parentRow && parentRow.nextElementSibling) {
                                                                        parentRow.nextElementSibling.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                    }
                                                                }}
                                                                className={cn(
                                                                    "flex-1 sm:flex-none px-1.5 py-2 rounded-xl text-[10px] font-bold transition-all whitespace-nowrap",
                                                                    shot.proximity === opt.val
                                                                        ? "bg-brand-navy text-white shadow-sm"
                                                                        : "bg-white dark:bg-zinc-900 text-zinc-500 border border-zinc-200 dark:border-zinc-700"
                                                                )}
                                                            >
                                                                {opt.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                );
                            })}

                            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 p-6 rounded-[2rem] shadow-sm flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">벙커 합계 점수</p>
                                </div>
                                <div className="text-right">
                                    <span className={cn(
                                        "text-3xl font-black italic",
                                        scores.bunker < 0 ? "text-brand-red" : scores.bunker > 0 ? "text-blue-600" : "text-zinc-400"
                                    )}>
                                        {scores.bunker > 0 ? `+${scores.bunker.toFixed(2)}` : scores.bunker.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {selectedPart === "long_putt" && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-black text-brand-navy italic">롱퍼팅 테스트 (4회)</h3>
                                    <div className="text-right">
                                        <span className="text-xs text-zinc-400 block mb-1">합계 점수</span>
                                        <span className={cn(
                                            "text-xl font-black italic",
                                            scores.long_putt < 0 ? "text-brand-red" : scores.long_putt > 0 ? "text-blue-600" : "text-zinc-400"
                                        )}>
                                            {scores.long_putt > 0 ? `+${scores.long_putt.toFixed(2)}` : scores.long_putt.toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    {longPuttShots.map((shot) => (
                                        <div key={shot.shotId} className="flex flex-col items-start p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className="w-8 h-8 flex items-center justify-center bg-white dark:bg-zinc-900 rounded-full text-xs font-black text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                                                    {shot.shotId}
                                                </span>
                                                <span className="text-sm font-bold text-zinc-600 dark:text-zinc-400">{LONG_PUTT_LABELS[shot.shotId]}</span>
                                            </div>
                                            <div className="flex gap-2 w-full">
                                                {[1, 2, 3, 4].map((putts) => (
                                                    <button
                                                        key={putts}
                                                        type="button"
                                                        onClick={() => updateLongPuttShot(shot.shotId, putts)}
                                                        className={cn(
                                                            "flex-1 h-8 rounded-lg text-[11px] font-bold transition-all border flex items-center justify-center min-w-0",
                                                            shot.proximity === putts ? "bg-brand-navy border-brand-navy text-white shadow-sm" : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600"
                                                        )}
                                                    >
                                                        {putts} putt
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 p-6 rounded-[2rem] shadow-sm flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">롱퍼팅 합계 점수</p>
                                </div>
                                <div className="text-right">
                                    <span className={cn(
                                        "text-3xl font-black italic",
                                        scores.long_putt < 0 ? "text-brand-red" : scores.long_putt > 0 ? "text-blue-600" : "text-zinc-400"
                                    )}>
                                        {scores.long_putt > 0 ? `+${scores.long_putt.toFixed(2)}` : scores.long_putt.toFixed(2)}
                                    </span>
                                </div>
                            </div>

                        </div>
                    )}

                    {selectedPart === "middle_putt" && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-black text-brand-navy italic">미들퍼팅 테스트 (8회)</h3>
                                    <div className="text-right">
                                        <span className="text-xs text-zinc-400 block mb-1">합계 점수</span>
                                        <span className={cn(
                                            "text-xl font-black italic",
                                            scores.middle_putt < 0 ? "text-brand-red" : scores.middle_putt > 0 ? "text-blue-600" : "text-zinc-400"
                                        )}>
                                            {scores.middle_putt > 0 ? `+${scores.middle_putt.toFixed(2)}` : scores.middle_putt.toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    {middlePuttShots.map((shot) => (
                                        <div key={shot.shotId} className="flex flex-col items-start p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className="w-8 h-8 flex items-center justify-center bg-white dark:bg-zinc-900 rounded-full text-xs font-black text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                                                    {shot.shotId}
                                                </span>
                                                <span className="text-sm font-bold text-zinc-600 dark:text-zinc-400">{MIDDLE_PUTT_LABELS[shot.shotId]}</span>
                                            </div>
                                            <div className="flex gap-2 w-full">
                                                {[1, 2, 3, 4].map((putts) => (
                                                    <button
                                                        key={putts}
                                                        type="button"
                                                        onClick={() => updateMiddlePuttShot(shot.shotId, putts)}
                                                        className={cn(
                                                            "flex-1 h-8 rounded-lg text-[11px] font-bold transition-all border flex items-center justify-center min-w-0",
                                                            shot.proximity === putts ? "bg-brand-navy border-brand-navy text-white shadow-sm" : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600"
                                                        )}
                                                    >
                                                        {putts} putt
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 p-6 rounded-[2rem] shadow-sm flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">미들퍼팅 합계 점수</p>
                                </div>
                                <div className="text-right">
                                    <span className={cn(
                                        "text-3xl font-black italic",
                                        scores.middle_putt < 0 ? "text-brand-red" : scores.middle_putt > 0 ? "text-blue-600" : "text-zinc-400"
                                    )}>
                                        {scores.middle_putt > 0 ? `+${scores.middle_putt.toFixed(2)}` : scores.middle_putt.toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            <div className="mt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedPart("long_putt");
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    className={cn(
                                        "w-full py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md",
                                        scores.isMiddlePuttComplete
                                            ? "bg-brand-navy text-white shadow-brand-navy/20"
                                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
                                    )}
                                >
                                    다음: 롱퍼팅 테스트 작성 <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    )}

                    {selectedPart === "short_putt" && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-black text-brand-navy italic">숏퍼팅 테스트 (6회)</h3>
                                    <div className="text-right">
                                        <span className="text-xs text-zinc-400 block mb-1">합계 점수</span>
                                        <span className={cn(
                                            "text-xl font-black italic",
                                            scores.short_putt < 0 ? "text-brand-red" : scores.short_putt > 0 ? "text-blue-600" : "text-zinc-400"
                                        )}>
                                            {scores.short_putt > 0 ? `+${scores.short_putt.toFixed(2)}` : scores.short_putt.toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    {shortPuttShots.map((shot) => (
                                        <div key={shot.shotId} className="flex flex-col items-start p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className="w-8 h-8 flex items-center justify-center bg-white dark:bg-zinc-900 rounded-full text-xs font-black text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                                                    {shot.shotId}
                                                </span>
                                                <span className="text-sm font-bold text-zinc-600 dark:text-zinc-400">{SHORT_PUTT_LABELS[shot.shotId]}</span>
                                            </div>
                                            <div className="flex gap-2 w-full">
                                                {[1, 2, 3, 4].map((putts) => (
                                                    <button
                                                        key={putts}
                                                        type="button"
                                                        onClick={() => updateShortPuttShot(shot.shotId, putts)}
                                                        className={cn(
                                                            "flex-1 h-8 rounded-lg text-[11px] font-bold transition-all border flex items-center justify-center min-w-0",
                                                            shot.proximity === putts ? "bg-brand-navy border-brand-navy text-white shadow-sm" : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600"
                                                        )}
                                                    >
                                                        {putts} putt
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 p-6 rounded-[2rem] shadow-sm flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">숏퍼팅 합계 점수</p>
                                </div>
                                <div className="text-right">
                                    <span className={cn(
                                        "text-3xl font-black italic",
                                        scores.short_putt < 0 ? "text-brand-red" : scores.short_putt > 0 ? "text-blue-600" : "text-zinc-400"
                                    )}>
                                        {scores.short_putt > 0 ? `+${scores.short_putt.toFixed(2)}` : scores.short_putt.toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            <div className="mt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedPart("middle_putt");
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    className={cn(
                                        "w-full py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md",
                                        scores.isShortPuttComplete
                                            ? "bg-brand-navy text-white shadow-brand-navy/20"
                                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
                                    )}
                                >
                                    다음: 미들퍼팅 테스트 작성 <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Actions ── */}
                    <div className="flex items-center justify-end gap-3 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            disabled={isUploading}
                            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 transition-colors disabled:opacity-50"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={isUploading || !selectedPlayer || !selectedPart}
                            className="flex-1 sm:flex-none bg-brand-navy hover:bg-brand-navy/90 disabled:bg-zinc-300 text-white px-12 py-4 rounded-2xl text-sm font-black transition-all shadow-xl shadow-brand-navy/20 active:scale-95 flex items-center justify-center gap-2"
                        >
                            <Save size={18} />
                            {isUploading ? "등록 중..." : (editId ? "테스트 수정" : "테스트 등록")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function CreateTestPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-brand-navy/20 border-t-brand-navy rounded-full animate-spin"></div>
            </div>
        }>
            <CreateTestContent />
        </Suspense>
    );
}