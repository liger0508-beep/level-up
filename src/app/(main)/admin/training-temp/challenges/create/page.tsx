"use client";

import { useState, useMemo, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Calendar, Save, Info, ChevronRight, Target, Flag, Crown, Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { DatePickerInput } from "@/components/ui/DatePickerInput";
import { AthleteSearch } from "@/components/ui/AthleteSearch";
import { formatLocalDate } from "@/lib/utils";
import { saveTestRecord, TestType } from "@/lib/test-sync";
import { createClient } from "@/lib/supabase/client";

interface ShotResult {
    id: number;
    result: "fairway" | "rough" | "penalty" | null;
}

interface IronShotResult {
    distance: number; // The target distance (e.g. 150)
    shotId: number; // 1-4
    proximity: number | ""; // m
}
const DEFAULT_TEST_GROUPS = [
    { 
        categoryId: "shot",
        label: "샷 챌린지", 
        parts: [
            { key: "iron", label: "아이언" },
            { key: "driver", label: "드라이버" }
        ] 
    },
    { 
        categoryId: "short_game",
        label: "숏게임 챌린지", 
        parts: [
            { key: "approach", label: "어프로치" },
            { key: "bunker", label: "벙커" }
        ] 
    },
    { 
        categoryId: "putting",
        label: "퍼팅 챌린지", 
        parts: [
            { key: "short_putt", label: "숏퍼팅" },
            { key: "middle_putt", label: "미들퍼팅" },
            { key: "long_putt", label: "롱퍼팅" }
        ] 
    }
];

const SCORING = {
    fairway: -0.17,
    rough: 0.23,
    penalty: 0.75
};

const IRON_START_SCORES: Record<number, number> = {
    40: 0.375, 50: 0.325, 60: 0.275, 70: 0.225, 80: 0.175,
    90: 0.125, 100: 0.075, 110: 0.025, 120: -0.025, 130: -0.075,
    140: -0.125, 150: -0.175, 160: -0.225, 170: -0.275, 180: -0.325
};

const IRON_RESULT_SCORES: Record<number, number> = {
    0: -1, 1: -0.9, 2: -0.65, 3: -0.4, 4: -0.3, 5: -0.2,
    6: -0.15, 7: -0.1, 8: -0.05, 9: 0, 10: 0.05, 11: 0.1,
    12: 0.14, 13: 0.18, 14: 0.21, 15: 0.24, 16: 0.26,
    17: 0.28, 18: 0.3, 19: 0.31, 20: 0.32
};

const APPROACH_SCORES: Record<number, number> = {
    0: -0.35, 1: -0.25, 2: 0, 3: 0.25, 4: 0.35, 5: 0.45,
    6: 0.5, 7: 0.55, 8: 0.6, 9: 0.65, 10: 0.7, 11: 0.75,
    12: 0.79, 13: 0.83, 14: 0.86, 15: 0.89, 16: 0.91,
    17: 0.93, 18: 0.95, 19: 0.96, 20: 0.97
};

const getShortApproachScore = (prox: number): number => {
    if (prox <= 0) return -1.1;
    if (prox === 1) return -0.01;
    if (prox === 2) return 0.25;
    if (prox === 3) return 0.5;
    if (prox === 4) return 0.6;
    if (prox === 5) return 0.7;
    if (prox === 6) return 0.75;
    if (prox === 7) return 0.8;
    if (prox === 8) return 0.85;
    if (prox === 9) return 0.9;
    if (prox === 10) return 0.95;
    if (prox === 11) return 1.0;
    if (prox === 12) return 1.04;
    if (prox === 13) return 1.08;
    if (prox === 14) return 1.11;
    if (prox === 15) return 1.14;
    if (prox === 16) return 1.16;
    if (prox === 17) return 1.18;
    if (prox === 18) return 1.2;
    if (prox === 19) return 1.21;
    if (prox <= 29) return 1.22;
    return 1.23;
};

const getMiddleApproachScore = (prox: number): number => {
    if (prox <= 0) return -0.34;
    if (prox === 1) return -0.24;
    if (prox === 2) return -0.01;
    if (prox === 3) return 0.25;
    if (prox === 4) return 0.35;
    if (prox === 5) return 0.45;
    if (prox === 6) return 0.5;
    if (prox === 7) return 0.55;
    if (prox === 8) return 0.6;
    if (prox === 9) return 0.65;
    if (prox === 10) return 0.7;
    if (prox === 11) return 0.75;
    if (prox === 12) return 0.79;
    if (prox === 13) return 0.83;
    if (prox === 14) return 0.86;
    if (prox === 15) return 0.89;
    if (prox === 16) return 0.91;
    if (prox === 17) return 0.93;
    if (prox === 18) return 0.95;
    if (prox === 19) return 0.96;
    if (prox <= 29) return 0.97;
    return 0.98;
};

const getLongApproachScore = (prox: number): number => {
    if (prox <= 0) return -0.59;
    if (prox === 1) return -0.49;
    if (prox === 2) return -0.24;
    if (prox === 3) return -0.01;
    if (prox === 4) return 0.1;
    if (prox === 5) return 0.2;
    if (prox === 6) return 0.25;
    if (prox === 7) return 0.3;
    if (prox === 8) return 0.35;
    if (prox === 9) return 0.4;
    if (prox === 10) return 0.45;
    if (prox === 11) return 0.5;
    if (prox === 12) return 0.54;
    if (prox === 13) return 0.58;
    if (prox === 14) return 0.61;
    if (prox === 15) return 0.64;
    if (prox === 16) return 0.66;
    if (prox === 17) return 0.68;
    if (prox === 18) return 0.7;
    if (prox === 19) return 0.71;
    if (prox <= 29) return 0.72;
    return 0.73;
};

const getShortBunkerScore = (prox: number): number => {
    if (prox <= 0) return -0.59;
    if (prox === 1) return -0.49;
    if (prox === 2) return -0.24;
    if (prox === 3) return -0.01;
    if (prox === 4) return 0.1;
    if (prox === 5) return 0.2;
    if (prox === 6) return 0.25;
    if (prox === 7) return 0.3;
    if (prox === 8) return 0.35;
    if (prox === 9) return 0.4;
    if (prox === 10) return 0.45;
    if (prox === 11) return 0.5;
    if (prox === 12) return 0.54;
    if (prox === 13) return 0.58;
    if (prox === 14) return 0.61;
    if (prox === 15) return 0.64;
    if (prox === 16) return 0.66;
    if (prox === 17) return 0.68;
    if (prox === 18) return 0.7;
    if (prox === 19) return 0.71;
    if (prox <= 29) return 0.72;
    return 0.73;
};

const getLongBunkerScore = (prox: number): number => {
    if (prox <= 0) return -0.64;
    if (prox === 1) return -0.55;
    if (prox === 2) return -0.29;
    if (prox === 3) return -0.06;
    if (prox === 4) return 0.05;
    if (prox === 5) return 0.15;
    if (prox === 6) return 0.2;
    if (prox === 7) return 0.25;
    if (prox === 8) return 0.3;
    if (prox === 9) return 0.35;
    if (prox === 10) return 0.4;
    if (prox === 11) return 0.45;
    if (prox === 12) return 0.49;
    if (prox === 13) return 0.53;
    if (prox === 14) return 0.56;
    if (prox === 15) return 0.59;
    if (prox === 16) return 0.61;
    if (prox === 17) return 0.63;
    if (prox === 18) return 0.65;
    if (prox === 19) return 0.66;
    if (prox <= 29) return 0.67;
    return 0.68;
};

const PUTTING_BASE_SCORES: Record<string, number> = {
    "0": 0.90, "0.5": 0.9, "1": 0.9, "1.5": 0.78, "2": 0.65, "2.5": 0.525,
    "3": 0.40, "3.5": 0.35, "4": 0.30, "4.5": 0.25, "5": 0.20, "5.5": 0.175,
    "6": 0.15, "6.5": 0.125, "7": 0.10, "7.5": 0.075, "8": 0.05, "8.5": 0.025,
    "9": 0.00, "9.5": -0.03, "10": -0.05, "10.5": -0.075, "11": -0.10,
    "11.5": -0.12, "12": -0.14, "12.5": -0.16, "13": -0.18, "13.5": -0.195,
    "14": -0.21, "14.5": -0.225, "15": -0.24, "15.5": -0.25, "16": -0.26,
    "16.5": -0.27, "17": -0.28, "17.5": -0.29, "18": -0.30, "18.5": -0.305,
    "19": -0.31, "19.5": -0.315, "20": -0.32
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

function CreateTestContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const editId = searchParams.get("id");
    
    const formatScore = (val: number) => {
        if (typeof val !== "number" || isNaN(val)) return "0.00";
        return val > 0 ? `+${val.toFixed(2)}` : val.toFixed(2);
    };

    const scrollToNext = (currentType: string, currentIndex: number) => {
        const nextIndex = currentIndex + 1;
        let nextEl = document.getElementById(`${currentType}-row-${nextIndex}`);
        if (!nextEl) {
            nextEl = document.getElementById(`${currentType}-next-block`) || document.getElementById(`submit-btn`);
        }
        if (nextEl) {
            nextEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

    const focusAndScrollToNext = (currentType: string, currentIndex: number) => {
        const nextIndex = currentIndex + 1;
        const nextInput = document.getElementById(`${currentType}-input-${nextIndex}`) as HTMLInputElement;
        if (nextInput) {
            nextInput.focus();
            nextInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            const nextBlock = document.getElementById(`${currentType}-next-block`) || document.getElementById(`submit-btn`);
            if (nextBlock) {
                nextBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    };

    const [selectedPlayer, setSelectedPlayer] = useState("");
    const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
    const [testDate, setTestDate] = useState(() => formatLocalDate());
    const [testTime, setTestTime] = useState(() => {
        const now = new Date();
        return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    });
    const [selectedPart, setSelectedPart] = useState<TestType | null>(null);
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
                    if (dbUser.role === 'athlete' && !selectedPlayer) {
                        setSelectedPlayer(dbUser.name);
                    }
                }

                if (dbUser && dbUser.role !== 'coach' && dbUser.role !== 'admin' && dbUser.role !== 'athlete') {
                    alert("챌린지 작성 권한이 없습니다.");
                    router.push("/admin/training-temp/challenges");
                }
            } else {
                router.push("/login");
            }
        });

        // Handle URL parameters for new test
        if (!editId) {
            const playerParam = searchParams.get("player");
            const typeParam = searchParams.get("type");
            const startParam = searchParams.get("start");

            if (playerParam) setSelectedPlayer(playerParam);
            if (typeParam) {
                // Map short types to categories
                if (typeParam === 'shot') {
                    setSelectedPart('driver');
                    setSelectedGroup('샷 챌린지');
                } else if (typeParam === 'around_green') {
                    setSelectedPart('approach');
                    setSelectedGroup('숏게임 챌린지');
                } else if (typeParam === 'putting') {
                    setSelectedPart('short_putt');
                    setSelectedGroup('퍼팅 챌린지');
                } else {
                    const partKey = typeParam as TestType;
                    setSelectedPart(partKey);
                    // Find matching group
                    const group = testGroups.find(g => g.parts.some(p => p.key === partKey));
                    if (group) setSelectedGroup(group.label);
                }
            }
            if (startParam) setTestTime(startParam);
        }

        // Fetch baselines
        supabase.from("sg_baseline").select("*").order("distance_m").then(({ data }) => {
            if (data) setBaselines(data);
        });
    }, [router]);

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
                setSelectedPlayer(data.athlete?.name || "");
                const createdAt = new Date(data.created_at);
                setTestDate(data.created_at.split("T")[0]);
                setTestTime(`${String(createdAt.getHours()).padStart(2, '0')}:${String(createdAt.getMinutes()).padStart(2, '0')}`);
                
                const content = typeof data.raw_shot_data === 'string' ? JSON.parse(data.raw_shot_data) : data.raw_shot_data;
                const category = data.category;

                if (category === "shot" || category === "driver" || category === "iron") {
                    setSelectedPart("driver");
                    setSelectedGroup("샷 챌린지");
                    if (content.driver?.shots) setDriverShots(content.driver.shots);
                    else if (category === "driver" && content.shots) setDriverShots(content.shots);
                    
                    if (content.iron?.shots) setIronShots(content.iron.shots);
                    else if (category === "iron" && content.shots) setIronShots(content.shots);
                    
                    if (content.iron?.distances) setSelectedIronDistances(content.iron.distances);
                    else if (category === "iron" && content.distances) setSelectedIronDistances(content.distances);
                } else if (category === "around_green" || category === "approach" || category === "bunker") {
                    setSelectedPart("approach");
                    setSelectedGroup("숏게임 챌린지");
                    if (content.approach?.shots) setApproachShots(content.approach.shots);
                    else if (category === "approach" && content.shots) setApproachShots(content.shots);
                    
                    if (content.bunker?.shots) setBunkerShots(content.bunker.shots);
                    else if (category === "bunker" && content.shots) setBunkerShots(content.shots);
                } else if (category === "long_putt" || category === "middle_putt" || category === "short_putt" || category === "putting") {
                    setSelectedPart(category === "putting" ? "short_putt" : category);
                    setSelectedGroup("퍼팅 챌린지");
                    if (category === "putting") {
                        if (content.long?.shots) setLongPuttShots(content.long.shots);
                        if (content.middle?.shots) setMiddlePuttShots(content.middle.shots);
                        if (content.short?.shots) setShortPuttShots(content.short.shots);
                    } else {
                        if (content.shots) {
                            if (category === "long_putt") setLongPuttShots(content.shots);
                            if (category === "middle_putt") setMiddlePuttShots(content.shots);
                            if (category === "short_putt") setShortPuttShots(content.shots);
                        }
                    }
                }
            } catch (err) {
                console.error("Error loading record:", err);
            } finally {
                setIsLoadingRecord(false);
            }
        };

        fetchRecord();
    }, [editId]);

    // --- Data State for all parts ---
    const [driverShots, setDriverShots] = useState<ShotResult[]>(
        Array.from({ length: 6 }, (_, i) => ({ id: i + 1, result: null }))
    );
    
    // Iron & Approach share logic
    const [selectedIronDistances, setSelectedIronDistances] = useState<number[]>([]);
    const [ironShots, setIronShots] = useState<IronShotResult[]>([]);
    
    const [approachShots, setApproachShots] = useState<IronShotResult[]>(
        Array.from({ length: 12 }, (_, i) => ({ distance: 0, shotId: i + 1, proximity: "" }))
    );

    const [bunkerShots, setBunkerShots] = useState<any[]>(
        Array.from({ length: 6 }, (_, i) => ({ distance: i < 3 ? "25m 이내" : "25m 이상", shotId: i + 1, proximity: "" }))
    );

    // Putting States
    const [longPuttShots, setLongPuttShots] = useState<IronShotResult[]>(
        Array.from({ length: 4 }, (_, i) => ({ distance: 0, shotId: i + 1, proximity: "" }))
    );
    const [middlePuttShots, setMiddlePuttShots] = useState<IronShotResult[]>(
        Array.from({ length: 8 }, (_, i) => ({ distance: 0, shotId: i + 1, proximity: "" }))
    );
    const [shortPuttShots, setShortPuttShots] = useState<IronShotResult[]>(
        Array.from({ length: 6 }, (_, i) => ({ distance: 0, shotId: i + 1, proximity: "" }))
    );

    // Iron initialization
    useEffect(() => {
        if (selectedIronDistances.length > 0) {
            setIronShots(prev => {
                // If we already have shots for these distances (likely from edit mode), don't reset them
                const newShots: IronShotResult[] = [];
                selectedIronDistances.forEach(dist => {
                    for (let i = 1; i <= 4; i++) {
                        const existing = prev.find(s => s.distance === dist && s.shotId === i);
                        newShots.push(existing || { distance: dist, shotId: i, proximity: "" });
                    }
                });
                return newShots;
            });
        }
    }, [selectedIronDistances]);

    // --- Calculations ---
    const scores = useMemo(() => {
        const driver = driverShots.reduce((acc, shot) => shot.result ? acc + SCORING[shot.result] : acc, 0);
        
        const iron = ironShots.reduce((acc, shot) => {
            if (shot.proximity === "") return acc;
            const startScore = IRON_START_SCORES[shot.distance] ?? 0;
            const prox = Math.min(20, Math.round(Number(shot.proximity)));
            const resultScore = IRON_RESULT_SCORES[prox] ?? 0.32;
            return acc + startScore + resultScore;
        }, 0);

        const approach = approachShots.reduce((acc, shot) => {
            if (shot.proximity === "") return acc;
            const prox = Math.round(Number(shot.proximity));
            if (shot.shotId <= 4) return acc + getShortApproachScore(prox);
            if (shot.shotId <= 8) return acc + getMiddleApproachScore(prox);
            return acc + getLongApproachScore(prox);
        }, 0);

        const bunker = bunkerShots.reduce((acc, shot) => {
            if (shot.proximity === "") return acc;
            const prox = Math.round(Number(shot.proximity));
            if (shot.shotId <= 3) return acc + getShortBunkerScore(prox);
            return acc + getLongBunkerScore(prox);
        }, 0);

        const calcPutting = (shots: IronShotResult[], type: "long_putt" | "middle_putt" | "short_putt") => {
            return shots.reduce((acc, shot) => {
                if (shot.proximity === "") return acc;
                const putts = Math.round(Number(shot.proximity));
                if (putts === 0) return acc + 0;

                let distanceStr = "";
                if (type === "long_putt") distanceStr = LONG_PUTT_LABELS[shot.shotId];
                else if (type === "middle_putt") distanceStr = MIDDLE_PUTT_LABELS[shot.shotId];
                else distanceStr = SHORT_PUTT_LABELS[shot.shotId];
                
                const distanceVal = distanceStr.replace('m', '').trim();
                const baseScore = PUTTING_BASE_SCORES[distanceVal] ?? 0;

                let finalScore = 0;
                if (putts === 2) {
                    finalScore = baseScore;
                } else if (putts > 2) {
                    finalScore = putts + baseScore - 2;
                } else {
                    finalScore = baseScore - 1;
                }
                
                return acc + finalScore;
            }, 0);
        };

        const longPutt = calcPutting(longPuttShots, "long_putt");
        const middlePutt = calcPutting(middlePuttShots, "middle_putt");
        const shortPutt = calcPutting(shortPuttShots, "short_putt");

        // Detailed 숏게임 breakdowns
        const shortApproach = approachShots.slice(0, 4).reduce((acc, shot) => {
            if (shot.proximity === "") return acc;
            const prox = Math.round(Number(shot.proximity));
            return acc + getShortApproachScore(prox);
        }, 0);

        const middleApproach = approachShots.slice(4, 8).reduce((acc, shot) => {
            if (shot.proximity === "") return acc;
            const prox = Math.round(Number(shot.proximity));
            return acc + getMiddleApproachScore(prox);
        }, 0);

        const longApproach = approachShots.slice(8, 12).reduce((acc, shot) => {
            if (shot.proximity === "") return acc;
            const prox = Math.round(Number(shot.proximity));
            return acc + getLongApproachScore(prox);
        }, 0);

        const shortBunker = bunkerShots.slice(0, 3).reduce((acc, shot) => {
            if (shot.proximity === "") return acc;
            const prox = Math.round(Number(shot.proximity));
            return acc + getShortBunkerScore(prox);
        }, 0);

        const longBunker = bunkerShots.slice(3, 6).reduce((acc, shot) => {
            if (shot.proximity === "") return acc;
            const prox = Math.round(Number(shot.proximity));
            return acc + getLongBunkerScore(prox);
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
        setDriverShots(prev => prev.map(s => s.id === shotId ? { ...s, result } : s));
    };

    const toggleIronDistance = (dist: number) => {
        setSelectedIronDistances(prev => {
            if (prev.includes(dist)) return prev.filter(d => d !== dist);
            if (prev.length >= 3) return prev;
            return [...prev, dist].sort((a, b) => a - b);
        });
    };

    const updateIronShot = (dist: number, shotId: number, field: keyof IronShotResult, value: any) => {
        let finalValue = value;
        if (field === 'proximity' && value !== "") {
            finalValue = Math.max(0, Math.floor(Number(value)));
        }
        setIronShots(prev => prev.map(s => (s.distance === dist && s.shotId === shotId) ? { ...s, [field]: finalValue } : s));
    };

    const updateApproachShot = (shotId: number, value: any) => {
        const finalValue = value === "" ? "" : Math.max(0, Math.floor(Number(value)));
        setApproachShots(prev => prev.map(s => s.shotId === shotId ? { ...s, proximity: finalValue } : s));
    };

    const updateBunkerShot = (shotId: number, value: any) => {
        const finalValue = value === "" ? "" : Math.max(0, Math.floor(Number(value)));
        setBunkerShots(prev => prev.map(s => s.shotId === shotId ? { ...s, proximity: finalValue } : s));
    };

    const updateLongPuttShot = (shotId: number, value: any) => {
        const finalValue = value === "" ? "" : Math.max(0, Math.floor(Number(value)));
        setLongPuttShots(prev => prev.map(s => s.shotId === shotId ? { ...s, proximity: finalValue } : s));
    };

    const updateMiddlePuttShot = (shotId: number, value: any) => {
        const finalValue = value === "" ? "" : Math.max(0, Math.floor(Number(value)));
        setMiddlePuttShots(prev => prev.map(s => s.shotId === shotId ? { ...s, proximity: finalValue } : s));
    };

    const updateShortPuttShot = (shotId: number, value: any) => {
        const finalValue = value === "" ? "" : Math.max(0, Math.floor(Number(value)));
        setShortPuttShots(prev => prev.map(s => s.shotId === shotId ? { ...s, proximity: finalValue } : s));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPlayer) {
            alert("선수를 선택해주세요.");
            return;
        }
        if (!selectedPart) {
            alert("테스트 파트를 선택해주세요.");
            return;
        }

        // --- Validation Check ---
        let isComplete = true;
        let content: any = {};
        let categoryToSave = selectedPart;
        const partLabel = testGroups.flatMap(g => g.parts).find(p => p.key === selectedPart)?.label || selectedPart;
        let finalTitle = `${partLabel} 테스트`;

        if (selectedPart === "driver" || selectedPart === "iron") {
            const driverComplete = driverShots.every(s => s.result !== null);
            const ironComplete = ironShots.length === 12 && ironShots.every(s => s.proximity !== "");
            
            if (!driverComplete || !ironComplete) {
                alert("드라이버(6회)와 아이언(12회) 기록을 모두 완료해주세요.");
                return;
            }
            
            isComplete = true;
            categoryToSave = "shot";
            finalTitle = `샷 챌린지`;
            content = {
                type: "combined_shot",
                driver: { shots: driverShots, score: scores.driver },
                iron: { shots: ironShots, score: scores.iron, distances: selectedIronDistances },
                totalScore: scores.driver + scores.iron
            };
        } else if (selectedPart === "approach" || selectedPart === "bunker") {
            const approachComplete = approachShots.every(s => s.proximity !== "");
            const bunkerComplete = bunkerShots.every(s => s.proximity !== "");
            
            if (!approachComplete || !bunkerComplete) {
                alert("어프로치(12회)와 벙커(6회) 기록을 모두 완료해주세요.");
                return;
            }
            
            isComplete = true;
            categoryToSave = "around_green";
            finalTitle = `숏게임 챌린지`;
            content = {
                type: "combined_around_green",
                approach: { shots: approachShots, score: scores.approach },
                bunker: { shots: bunkerShots, score: scores.bunker },
                totalScore: scores.approach + scores.bunker
            };
        } else if (selectedPart === "long_putt" || selectedPart === "middle_putt" || selectedPart === "short_putt") {
            const longComplete = longPuttShots.every(s => s.proximity !== "");
            const middleComplete = middlePuttShots.every(s => s.proximity !== "");
            const shortComplete = shortPuttShots.every(s => s.proximity !== "");
            
            if (!longComplete || !middleComplete || !shortComplete) {
                alert("롱퍼팅(4회), 미들퍼팅(8회), 숏퍼팅(6회) 기록을 모두 완료해주세요.");
                return;
            }
            
            isComplete = true;
            categoryToSave = "putting";
            finalTitle = `퍼팅 챌린지`;
            content = {
                type: "combined_putting",
                long: { shots: longPuttShots, score: scores.long_putt },
                middle: { shots: middlePuttShots, score: scores.middle_putt },
                short: { shots: shortPuttShots, score: scores.short_putt },
                totalScore: scores.puttingSubtotal
            };
        }

        if (!isComplete) {
            alert("기록을 다 채워주세요. (모든 샷의 결과가 입력되어야 합니다)");
            return;
        }

        try {
            setIsUploading(true);

            await saveTestRecord({
                id: editId || undefined,
                playerName: selectedPlayer,
                coachName: currentCoachName,
                category: categoryToSave,
                title: finalTitle,
                content,
                date: testDate,
                time: testTime
            });

            alert(editId ? "챌린지 기록이 수정되었습니다." : "챌린지 기록이 저장되었습니다.");
            router.push("/admin/training-temp/challenges");
        } catch (err: any) {
            console.error("Test save error details:", {
                message: err.message,
                stack: err.stack,
                fullError: err
            });
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

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* ── 1. Basic Info ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm space-y-6">
                        <div className="space-y-4">
                            <label className="block text-sm font-bold text-zinc-800 dark:text-zinc-200">
                                선수 선택 <span className="text-brand-red">*</span>
                            </label>
                            <AthleteSearch
                                multi={false}
                                selectedNames={selectedPlayer ? [selectedPlayer] : []}
                                onSelect={(name) => setSelectedPlayer(name)}
                                onRemove={() => setSelectedPlayer("")}
                                placeholder="선수 이름을 검색하세요..."
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

                        {/* Title & Search Button */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
                            <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">챌린지 선택</h2>
                            
                            <div className="relative w-full sm:w-64" ref={challengeSearchRef}>
                                <div className="relative group">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-brand-navy transition-colors" size={16} />
                                    <input
                                        type="text"
                                        value={challengeQuery}
                                        onChange={(e) => {
                                            setChallengeQuery(e.target.value);
                                            setIsChallengeSearchOpen(true);
                                        }}
                                        onFocus={() => {
                                            if (challengeQuery.trim()) setIsChallengeSearchOpen(true);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && challengeSuggestions.length > 0) {
                                                e.preventDefault();
                                                handleChallengeSelect(challengeSuggestions[0]);
                                            }
                                        }}
                                        placeholder="챌린지 검색..."
                                        disabled={editId !== null || !selectedPlayer}
                                        className="w-full pl-9 pr-4 py-2 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/30 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                </div>

                                {/* Dropdown suggestions */}
                                {isChallengeSearchOpen && challengeQuery.trim() !== "" && (
                                    <div className="absolute z-[60] mt-1.5 w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl max-h-56 overflow-y-auto overflow-x-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="p-1 px-1.5 py-1.5">
                                            {challengeSuggestions.length > 0 ? (
                                                challengeSuggestions.map((suggestion) => {
                                                    const isSelected = selectedGroup === suggestion.groupLabel && (!suggestion.partKey || selectedPart === suggestion.partKey);
                                                    return (
                                                        <button
                                                            key={suggestion.title}
                                                            type="button"
                                                            onClick={() => handleChallengeSelect(suggestion)}
                                                            className={cn(
                                                                "w-full text-left px-3 py-2.5 rounded-xl text-[12px] font-bold transition-all flex items-center justify-between",
                                                                isSelected
                                                                    ? "bg-brand-navy/10 text-brand-navy"
                                                                    : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                                            )}
                                                        >
                                                            {suggestion.title}
                                                            {isSelected && <Check size={14} className="text-brand-navy shrink-0" />}
                                                        </button>
                                                    );
                                                })
                                            ) : (
                                                <div className="px-3 py-4 text-xs text-center text-zinc-500 font-medium">
                                                    "{challengeQuery}" 검색 결과가 없습니다.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Main Group Selection */}
                        <div className="flex w-full gap-3 mb-6">
                            {testGroups.map((group) => {
                                const isSelected = selectedGroup === group.label;
                                return (
                                    <button
                                        key={group.label}
                                        type="button"
                                        disabled={editId !== null || !selectedPlayer}
                                        onClick={() => {
                                            setSelectedGroup(isSelected ? null : group.label);
                                            if (!isSelected) {
                                                setTimeout(() => {
                                                    const el = document.getElementById('sub-part-container');
                                                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                }, 150);
                                            }
                                        }}
                                        className={cn(
                                            "flex-1 flex flex-col items-center justify-center py-5 rounded-[2rem] border-2 transition-all gap-2",
                                            isSelected 
                                                ? "bg-brand-navy text-white border-brand-navy shadow-xl shadow-brand-navy/20 scale-[1.02]" 
                                                : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-100 dark:border-zinc-800 text-zinc-400 hover:border-zinc-200",
                                            (editId !== null && !isSelected || !selectedPlayer) && "opacity-30 grayscale cursor-not-allowed"
                                        )}
                                    >
                                        <div className={cn("p-2.5 rounded-2xl", isSelected ? "bg-white/20" : "bg-white dark:bg-zinc-900 shadow-sm")}>
                                            {group.label.includes("샷") ? <Target size={22} /> : group.label.includes("숏게임") ? <Flag size={22} /> : <Crown size={22} />}
                                        </div>
                                        <span className="text-[11px] font-black uppercase tracking-tighter whitespace-nowrap">{group.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Sub-Part Selection (Conditional Reveal) */}
                        {selectedGroup && (
                            <div id="sub-part-container" className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                                <div className="h-[1px] bg-zinc-100 dark:bg-zinc-800 w-full mb-2" />
                                <div className="flex w-full gap-2">
                                    {testGroups.find(g => g.label === selectedGroup)?.parts.map((opt) => (
                                        <button
                                            key={opt.key}
                                            type="button"
                                            disabled={editId !== null && selectedPart !== null && !(
                                                (selectedPart === 'driver' || selectedPart === 'iron') ? (opt.key === 'driver' || opt.key === 'iron') : 
                                                (selectedPart === 'approach' || selectedPart === 'bunker') ? (opt.key === 'approach' || opt.key === 'bunker') :
                                                opt.key === selectedPart
                                            )}
                                            onClick={() => {
                                                setSelectedPart(opt.key as TestType);
                                                setTimeout(() => {
                                                    const el = document.getElementById('detail-section-container');
                                                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                }, 150);
                                            }}
                                            className={cn(
                                                "flex-1 py-3.5 rounded-2xl text-[11px] font-bold transition-all border flex items-center justify-center text-center",
                                                selectedPart === opt.key
                                                    ? "bg-brand-red text-white border-brand-red shadow-lg shadow-brand-red/20 scale-[1.02]"
                                                    : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-brand-navy/30",
                                                editId !== null && selectedPart !== null && !(
                                                    (selectedPart === 'driver' || selectedPart === 'iron') ? (opt.key === 'driver' || opt.key === 'iron') : 
                                                    (selectedPart === 'approach' || selectedPart === 'bunker') ? (opt.key === 'approach' || opt.key === 'bunker') :
                                                    opt.key === selectedPart
                                                ) && "opacity-30 cursor-not-allowed grayscale"
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
                        <section id="detail-section-container" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                            <div className="sticky top-0 z-30 flex items-center justify-between mb-6 -mx-6 px-6 -mt-6 pt-6 pb-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-t-[2rem] border-b border-zinc-100 dark:border-zinc-800">
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
                                    <div key={shot.id} id={`driver-row-${shot.id}`} className="flex flex-col xs:flex-row xs:items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 transition-all gap-3 xs:gap-0">
                                        <div className="flex items-center gap-3 shrink-0">
                                            <span className="w-8 h-8 flex items-center justify-center bg-white dark:bg-zinc-900 rounded-full text-xs font-black text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                                                {shot.id}
                                            </span>
                                            <span className="text-sm font-bold text-zinc-600 dark:text-zinc-400">Driver Shot</span>
                                        </div>
                                        <div className="flex gap-1.5 sm:gap-2 w-full xs:w-auto">
                                            {(["fairway", "rough", "penalty"] as const).map((res) => (
                                                <button
                                                    key={res}
                                                    type="button"
                                                    onClick={() => {
                                                        handleDriverResultSelect(shot.id, res);
                                                        setTimeout(() => scrollToNext('driver', shot.id), 100);
                                                    }}
                                                    className={cn(
                                                        "flex-1 xs:flex-none px-2 sm:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all border whitespace-nowrap text-center",
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

                            <div className="space-y-4 mt-6">
                                {/* Total Score for Driver */}
                                <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 p-6 rounded-[2rem] shadow-sm flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-bold text-brand-navy opacity-80">드라이버 합계 점수</p>
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
                                <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-black text-brand-navy opacity-80">샷 합계 점수 (드라이버 + 아이언)</p>
                                    </div>
                                    <div className="text-right">
                                        <span className={cn(
                                            "text-3xl font-black italic",
                                            scores.shotSubtotal < 0 ? "text-brand-red" : scores.shotSubtotal > 0 ? "text-blue-600" : "text-zinc-400"
                                        )}>
                                            {scores.shotSubtotal > 0 ? `+${scores.shotSubtotal.toFixed(2)}` : scores.shotSubtotal.toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div id="driver-next-block" className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedPart("iron");
                                        setTimeout(() => {
                                            const el = document.getElementById('detail-section-container');
                                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                        }, 150);
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
                        <div id="detail-section-container" className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
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
                                    {Array.from({ length: 15 }, (_, i) => 40 + (i * 10)).map((dist) => (
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
                                    const startScore = IRON_START_SCORES[shot.distance] ?? 0;
                                    const prox = Math.min(20, Math.round(Number(shot.proximity)));
                                    const resultScore = IRON_RESULT_SCORES[prox] ?? 0.32;
                                    return acc + startScore + resultScore;
                                }, 0);

                                return (
                                <section key={dist} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm">
                                    <div className="sticky top-0 z-30 flex items-center justify-between mb-4 -mx-6 px-6 -mt-6 pt-6 pb-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-t-[2rem] border-b border-zinc-100 dark:border-zinc-800">
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
                                            const overallIndex = ironShots.findIndex(s => s.distance === dist && s.shotId === shot.shotId);
                                            return (
                                                <div key={`${dist}-${shot.shotId}`} id={`iron-row-${overallIndex}`} className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                                                    <div className="flex items-center gap-3">
                                                        <span className="w-8 h-8 flex items-center justify-center bg-white dark:bg-zinc-900 rounded-full text-xs font-black text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                                                            {shot.shotId}
                                                        </span>
                                                        <span className="text-sm font-bold text-zinc-600 dark:text-zinc-400">{dist}m Shot</span>
                                                    </div>
                                                    <div className="relative w-24">
                                                        <input
                                                            type="number"
                                                            id={`iron-input-${overallIndex}`}
                                                            placeholder="0"
                                                            min={0}
                                                            step={1}
                                                            value={shot.proximity}
                                                            onChange={(e) => updateIronShot(dist, shot.shotId, 'proximity', e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    focusAndScrollToNext('iron', overallIndex);
                                                                }
                                                            }}
                                                            onBlur={() => {
                                                                if (shot.proximity !== "") {
                                                                    setTimeout(() => focusAndScrollToNext('iron', overallIndex), 100);
                                                                }
                                                            }}
                                                            className="w-full pl-3 pr-8 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-brand-navy/40"
                                                        />
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 font-bold">m</span>
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
                                <div className="space-y-4">
                                    <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 p-6 rounded-[2rem] shadow-sm flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-bold text-brand-navy opacity-80">아이언 테스트 합계 점수</p>
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
                                    <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-black text-brand-navy opacity-80">샷 합계 점수 (드라이버 + 아이언)</p>
                                        </div>
                                        <div className="text-right">
                                            <span className={cn(
                                                "text-3xl font-black italic",
                                                scores.shotSubtotal < 0 ? "text-brand-red" : scores.shotSubtotal > 0 ? "text-blue-600" : "text-zinc-400"
                                            )}>
                                                {scores.shotSubtotal > 0 ? `+${scores.shotSubtotal.toFixed(2)}` : scores.shotSubtotal.toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                    <div id="iron-next-block" className="mt-4 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedPart("driver");
                                                setTimeout(() => {
                                                    const el = document.getElementById('detail-section-container');
                                                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                }, 150);
                                            }}
                                            className={cn(
                                                "w-full py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md",
                                                scores.isIronComplete 
                                                    ? "bg-brand-navy text-white shadow-brand-navy/20" 
                                                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
                                            )}
                                        >
                                            다음: 드라이버 테스트 작성 <ChevronRight size={18} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {selectedPart === "approach" && (
                        <div id="detail-section-container" className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                            <h3 className="text-lg font-black text-brand-navy dark:text-brand-navy-light italic pl-2">어프로치 테스트 (12회)</h3>
                            {[
                                { title: "숏 어프로치 테스트", shots: approachShots.slice(0, 4), labelMap: { 1: "5~10m", 2: "5~10m", 3: "5~10m", 4: "5~10m" }, scoreKey: 'shortApproach' },
                                { title: "미들 어프로치 테스트", shots: approachShots.slice(4, 8), labelMap: { 5: "15m", 6: "15m", 7: "20m", 8: "20m" }, scoreKey: 'middleApproach' },
                                { title: "롱 어프로치 테스트", shots: approachShots.slice(8, 12), labelMap: { 9: "25m", 10: "25m", 11: "30m", 12: "30m" }, scoreKey: 'longApproach' }
                            ].map((group, gIdx) => {
                                const distScore = (scores as any)[group.scoreKey];
                                return (
                                <section key={gIdx} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm">
                                    <div className="sticky top-0 z-30 flex items-center justify-between mb-4 -mx-6 px-6 -mt-6 pt-6 pb-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-t-[2rem] border-b border-zinc-100 dark:border-zinc-800">
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
                                            <div key={shot.shotId} id={`approach-row-${shot.shotId}`} className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                                                <div className="flex items-center gap-3">
                                                    <span className="w-8 h-8 flex items-center justify-center bg-white dark:bg-zinc-900 rounded-full text-xs font-black text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                                                        {shot.shotId}
                                                    </span>
                                                    <span className="text-sm font-bold text-zinc-600 dark:text-zinc-400">{(group.labelMap as any)[shot.shotId]}</span>
                                                </div>
                                                <div className="relative w-24">
                                                    <input
                                                        type="number"
                                                        id={`approach-input-${shot.shotId}`}
                                                        placeholder="0"
                                                        min={0}
                                                        step={1}
                                                        value={shot.proximity}
                                                        onChange={(e) => updateApproachShot(shot.shotId, e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                focusAndScrollToNext('approach', shot.shotId);
                                                            }
                                                        }}
                                                        onBlur={() => {
                                                            if (shot.proximity !== "") {
                                                                setTimeout(() => focusAndScrollToNext('approach', shot.shotId), 100);
                                                            }
                                                        }}
                                                        className="w-full pl-3 pr-8 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-brand-navy/40"
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 font-bold">m</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                                );
                            })}

                            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 p-6 rounded-[2rem] shadow-sm flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-bold text-brand-navy opacity-80">어프로치 합계 점수</p>
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

                            <div id="approach-next-block" className="mt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedPart("bunker");
                                        setTimeout(() => {
                                            const el = document.getElementById('detail-section-container');
                                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                        }, 150);
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
                        <div id="detail-section-container" className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                            <h3 className="text-lg font-black text-brand-navy dark:text-brand-navy-light italic pl-2">벙커 테스트 (6회)</h3>
                            {[
                                { title: "숏 벙커 테스트", shots: bunkerShots.slice(0, 3), label: "25m 이내", scoreKey: 'shortBunker' },
                                { title: "롱 벙커 테스트", shots: bunkerShots.slice(3, 6), label: "25m 이상", scoreKey: 'longBunker' }
                            ].map((group, gIdx) => {
                                const distScore = (scores as any)[group.scoreKey];
                                return (
                                <section key={gIdx} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm">
                                    <div className="sticky top-0 z-30 flex items-center justify-between mb-4 -mx-6 px-6 -mt-6 pt-6 pb-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-t-[2rem] border-b border-zinc-100 dark:border-zinc-800">
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
                                            <div key={shot.shotId} id={`bunker-row-${shot.shotId}`} className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                                                <div className="flex items-center gap-3">
                                                    <span className="w-8 h-8 flex items-center justify-center bg-white dark:bg-zinc-900 rounded-full text-xs font-black text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                                                        {shot.shotId}
                                                    </span>
                                                    <span className="text-sm font-bold text-zinc-600 dark:text-zinc-400">{group.label}</span>
                                                </div>
                                                <div className="relative w-24">
                                                    <input
                                                        type="number"
                                                        id={`bunker-input-${shot.shotId}`}
                                                        placeholder="0"
                                                        min={0}
                                                        step={1}
                                                        value={shot.proximity}
                                                        onChange={(e) => updateBunkerShot(shot.shotId, e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                focusAndScrollToNext('bunker', shot.shotId);
                                                            }
                                                        }}
                                                        onBlur={() => {
                                                            if (shot.proximity !== "") {
                                                                setTimeout(() => focusAndScrollToNext('bunker', shot.shotId), 100);
                                                            }
                                                        }}
                                                        className="w-full pl-3 pr-8 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-brand-navy/40"
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 font-bold">m</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                                );
                            })}

                            <div className="space-y-4">
                                <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 p-6 rounded-[2rem] shadow-sm flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-bold text-brand-navy opacity-80">벙커 합계 점수</p>
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
                                <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-black text-brand-navy opacity-80">숏게임 합계 점수 (어프로치 + 벙커)</p>
                                    </div>
                                    <div className="text-right">
                                        <span className={cn(
                                            "text-3xl font-black italic",
                                            scores.aroundSubtotal < 0 ? "text-brand-red" : scores.aroundSubtotal > 0 ? "text-blue-600" : "text-zinc-400"
                                        )}>
                                            {scores.aroundSubtotal > 0 ? `+${scores.aroundSubtotal.toFixed(2)}` : scores.aroundSubtotal.toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {selectedPart === "long_putt" && (
                        <div id="detail-section-container" className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm">
                                <div className="sticky top-0 z-30 flex items-center justify-between mb-4 -mx-6 px-6 -mt-6 pt-6 pb-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-t-[2rem] border-b border-zinc-100 dark:border-zinc-800">
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
                                        <div key={shot.shotId} id={`long_putt-row-${shot.shotId}`} className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                                            <div className="flex items-center gap-3">
                                                <span className="w-8 h-8 flex items-center justify-center bg-white dark:bg-zinc-900 rounded-full text-xs font-black text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                                                    {shot.shotId}
                                                </span>
                                                <span className="text-sm font-bold text-zinc-600 dark:text-zinc-400">{LONG_PUTT_LABELS[shot.shotId]}</span>
                                            </div>
                                            <div className="relative w-24">
                                                <input
                                                    type="number"
                                                    id={`long_putt-input-${shot.shotId}`}
                                                    placeholder="0"
                                                    min={0}
                                                    step={1}
                                                    value={shot.proximity}
                                                    onChange={(e) => updateLongPuttShot(shot.shotId, e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            focusAndScrollToNext('long_putt', shot.shotId);
                                                        }
                                                    }}
                                                    onBlur={() => {
                                                        if (shot.proximity !== "") {
                                                            setTimeout(() => focusAndScrollToNext('long_putt', shot.shotId), 100);
                                                        }
                                                    }}
                                                    className="w-full pl-3 pr-8 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-brand-navy/40"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 font-bold">개</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 p-6 rounded-[2rem] shadow-sm flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-bold text-brand-navy opacity-80">롱퍼팅 합계 점수</p>
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
                        <div id="detail-section-container" className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm">
                                <div className="sticky top-0 z-30 flex items-center justify-between mb-4 -mx-6 px-6 -mt-6 pt-6 pb-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-t-[2rem] border-b border-zinc-100 dark:border-zinc-800">
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
                                        <div key={shot.shotId} id={`middle_putt-row-${shot.shotId}`} className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                                            <div className="flex items-center gap-3">
                                                <span className="w-8 h-8 flex items-center justify-center bg-white dark:bg-zinc-900 rounded-full text-xs font-black text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                                                    {shot.shotId}
                                                </span>
                                                <span className="text-sm font-bold text-zinc-600 dark:text-zinc-400">{MIDDLE_PUTT_LABELS[shot.shotId]}</span>
                                            </div>
                                            <div className="relative w-24">
                                                <input
                                                    type="number"
                                                    id={`middle_putt-input-${shot.shotId}`}
                                                    placeholder="0"
                                                    min={0}
                                                    step={1}
                                                    value={shot.proximity}
                                                    onChange={(e) => updateMiddlePuttShot(shot.shotId, e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            focusAndScrollToNext('middle_putt', shot.shotId);
                                                        }
                                                    }}
                                                    onBlur={() => {
                                                        if (shot.proximity !== "") {
                                                            setTimeout(() => focusAndScrollToNext('middle_putt', shot.shotId), 100);
                                                        }
                                                    }}
                                                    className="w-full pl-3 pr-8 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-955 text-sm text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-brand-navy/40"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 font-bold">개</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 p-6 rounded-[2rem] shadow-sm flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-bold text-brand-navy opacity-80">미들퍼팅 합계 점수</p>
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

                            <div id="middle_putt-next-block" className="mt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedPart("long_putt");
                                        setTimeout(() => {
                                            const el = document.getElementById('detail-section-container');
                                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                        }, 150);
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
                        <div id="detail-section-container" className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm">
                                <div className="sticky top-0 z-30 flex items-center justify-between mb-4 -mx-6 px-6 -mt-6 pt-6 pb-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-t-[2rem] border-b border-zinc-100 dark:border-zinc-800">
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
                                        <div key={shot.shotId} id={`short_putt-row-${shot.shotId}`} className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                                            <div className="flex items-center gap-3">
                                                <span className="w-8 h-8 flex items-center justify-center bg-white dark:bg-zinc-900 rounded-full text-xs font-black text-zinc-450 border border-zinc-200 dark:border-zinc-700">
                                                    {shot.shotId}
                                                </span>
                                                <span className="text-sm font-bold text-zinc-600 dark:text-zinc-400">{SHORT_PUTT_LABELS[shot.shotId]}</span>
                                            </div>
                                            <div className="relative w-24">
                                                <input
                                                    type="number"
                                                    id={`short_putt-input-${shot.shotId}`}
                                                    placeholder="0"
                                                    min={0}
                                                    step={1}
                                                    value={shot.proximity}
                                                    onChange={(e) => updateShortPuttShot(shot.shotId, e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            focusAndScrollToNext('short_putt', shot.shotId);
                                                        }
                                                    }}
                                                    onBlur={() => {
                                                        if (shot.proximity !== "") {
                                                            setTimeout(() => focusAndScrollToNext('short_putt', shot.shotId), 100);
                                                        }
                                                    }}
                                                    className="w-full pl-3 pr-8 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-brand-navy/40"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 font-bold">개</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <div className="space-y-4">
                                <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 p-6 rounded-[2rem] shadow-sm flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-bold text-brand-navy opacity-80">숏퍼팅 합계 점수</p>
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
                                <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-black text-brand-navy opacity-80">퍼팅 합계 점수 (롱 + 미들 + 숏)</p>
                                    </div>
                                    <div className="text-right">
                                        <span className={cn(
                                            "text-3xl font-black italic",
                                            scores.puttingSubtotal < 0 ? "text-brand-red" : scores.puttingSubtotal > 0 ? "text-blue-600" : "text-zinc-400"
                                        )}>
                                            {scores.puttingSubtotal > 0 ? `+${scores.puttingSubtotal.toFixed(2)}` : scores.puttingSubtotal.toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div id="short_putt-next-block" className="mt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedPart("middle_putt");
                                        setTimeout(() => {
                                            const el = document.getElementById('detail-section-container');
                                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                        }, 150);
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
                            {isUploading ? "등록 중..." : (editId ? "수정" : "등록")}
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
