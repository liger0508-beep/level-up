"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Calendar, Save, Info, ChevronRight, Target, Flag, Crown } from "lucide-react";
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
const TEST_GROUPS = [
    { 
        label: "샷 (Shot)", 
        parts: [
            { key: "driver", label: "드라이버" },
            { key: "iron", label: "아이언" }
        ] 
    },
    { 
        label: "그린 주변 (Around Green)", 
        parts: [
            { key: "approach", label: "어프로치" },
            { key: "bunker", label: "벙커" }
        ] 
    },
    { 
        label: "퍼팅 (Putting)", 
        parts: [
            { key: "long_putt", label: "롱퍼팅" },
            { key: "middle_putt", label: "미들퍼팅" },
            { key: "short_putt", label: "숏퍼팅" }
        ] 
    }
];

const SCORING = {
    fairway: -0.15,
    rough: 0.3,
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

const BUNKER_SCORES: Record<number, number> = {
    0: -0.6, 1: -0.5, 2: -0.25, 3: 0, 4: 0.1, 5: 0.2,
    6: 0.25, 7: 0.3, 8: 0.35, 9: 0.4, 10: 0.45, 11: 0.5,
    12: 0.54, 13: 0.58, 14: 0.61, 15: 0.64, 16: 0.66,
    17: 0.68, 18: 0.7, 19: 0.71, 20: 0.72
};

const PUTTING_RESULT_SCORES: Record<number, number> = {
    0: -1, 1: 0.1, 2: 0.35, 3: 0.6, 4: 0.7, 5: 0.8,
    6: 0.85, 7: 0.9, 8: 0.95, 9: 1, 10: 1.05, 11: 1.1,
    12: 1.15, 13: 1.2, 14: 1.25, 15: 1.3, 16: 1.35,
    17: 1.4, 18: 1.45, 19: 1.5, 20: 1.55
};

const PUTTING_ATTEMPT_SCORES = {
    long_putt: { 1: -0.05, 2: -0.05, 3: -0.24, 4: -0.24 },
    middle_putt: { 1: 0.3, 2: 0.3, 3: 0.2, 4: 0.2, 5: 0.15, 6: 0.15, 7: 0.1, 8: 0.1 },
    short_putt: { 1: 0.9, 2: 0.9, 3: 0.65, 4: 0.65, 5: 0.4, 6: 0.4 }
};

function CreateTestContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const editId = searchParams.get("id");
    
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
                }

                if (dbUser && dbUser.role !== 'coach' && dbUser.role !== 'admin') {
                    alert("테스트 작성 권한이 없습니다.");
                    router.push("/training/tests");
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
                    setSelectedGroup('샷 (Shot)');
                } else if (typeParam === 'around_green') {
                    setSelectedPart('approach');
                    setSelectedGroup('그린 주변 (Around Green)');
                } else if (typeParam === 'putting') {
                    setSelectedPart('long_putt');
                    setSelectedGroup('퍼팅 (Putting)');
                } else {
                    const partKey = typeParam as TestType;
                    setSelectedPart(partKey);
                    // Find matching group
                    const group = TEST_GROUPS.find(g => g.parts.some(p => p.key === partKey));
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
                    .from("records")
                    .select("*, users!records_user_id_fkey(name)")
                    .eq("id", editId)
                    .single();
                
                if (error || !data) {
                    console.error("Failed to fetch record for editing:", error);
                    return;
                }

                // Populate basic info
                setSelectedPlayer(data.users?.name || "");
                const createdAt = new Date(data.created_at);
                setTestDate(data.created_at.split("T")[0]);
                setTestTime(`${String(createdAt.getHours()).padStart(2, '0')}:${String(createdAt.getMinutes()).padStart(2, '0')}`);
                
                const content = data.content;
                const category = data.category;

                if (category === "shot" || category === "driver" || category === "iron") {
                    setSelectedPart("driver");
                    setSelectedGroup("샷 (Shot)");
                    if (content.driver?.shots) setDriverShots(content.driver.shots);
                    else if (category === "driver" && content.shots) setDriverShots(content.shots);
                    
                    if (content.iron?.shots) setIronShots(content.iron.shots);
                    else if (category === "iron" && content.shots) setIronShots(content.shots);
                    
                    if (content.iron?.distances) setSelectedIronDistances(content.iron.distances);
                    else if (category === "iron" && content.distances) setSelectedIronDistances(content.distances);
                } else if (category === "around_green" || category === "approach" || category === "bunker") {
                    setSelectedPart("approach");
                    setSelectedGroup("그린 주변 (Around Green)");
                    if (content.approach?.shots) setApproachShots(content.approach.shots);
                    else if (category === "approach" && content.shots) setApproachShots(content.shots);
                    
                    if (content.bunker?.shots) setBunkerShots(content.bunker.shots);
                    else if (category === "bunker" && content.shots) setBunkerShots(content.shots);
                } else if (category === "long_putt" || category === "middle_putt" || category === "short_putt" || category === "putting") {
                    setSelectedPart(category === "putting" ? "long_putt" : category);
                    setSelectedGroup("퍼팅 (Putting)");
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

    const [bunkerShots, setBunkerShots] = useState<IronShotResult[]>(
        Array.from({ length: 6 }, (_, i) => ({ distance: 0, shotId: i + 1, proximity: "" }))
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
            const startScore = IRON_START_SCORES[shot.distance] || 0;
            const prox = Math.min(20, Math.round(Number(shot.proximity)));
            const resultScore = IRON_RESULT_SCORES[prox] || 0.32;
            return acc + startScore + resultScore;
        }, 0);

        const approach = approachShots.reduce((acc, shot) => {
            if (shot.proximity === "") return acc;
            const prox = Math.min(20, Math.round(Number(shot.proximity)));
            return acc + (APPROACH_SCORES[prox] || 0.97);
        }, 0);

        const bunker = bunkerShots.reduce((acc, shot) => {
            if (shot.proximity === "") return acc;
            const prox = Math.min(20, Math.round(Number(shot.proximity)));
            return acc + (BUNKER_SCORES[prox] || 0.72);
        }, 0);

        const calcPutting = (shots: IronShotResult[], type: keyof typeof PUTTING_ATTEMPT_SCORES) => {
            return shots.reduce((acc, shot) => {
                if (shot.proximity === "") return acc;
                const attemptScore = (PUTTING_ATTEMPT_SCORES[type] as any)[shot.shotId] || 0;
                const prox = Math.min(20, Math.round(Number(shot.proximity)));
                const resultScore = PUTTING_RESULT_SCORES[prox] || 1.55;
                return acc + attemptScore + resultScore;
            }, 0);
        };

        const longPutt = calcPutting(longPuttShots, "long_putt");
        const middlePutt = calcPutting(middlePuttShots, "middle_putt");
        const shortPutt = calcPutting(shortPuttShots, "short_putt");

        // Subtotals
        const shotSubtotal = driver + iron;
        const aroundSubtotal = approach + bunker;
        const puttingSubtotal = longPutt + middlePutt + shortPutt;
        
        return {
            driver, iron, approach, bunker,
            long_putt: longPutt, middle_putt: middlePutt, short_putt: shortPutt,
            shotSubtotal, aroundSubtotal, puttingSubtotal,
            total: shotSubtotal + aroundSubtotal + puttingSubtotal,
            // Completion flags
            isDriverComplete: driverShots.every(s => s.result !== null),
            isIronComplete: ironShots.length === 12 && ironShots.every(s => s.proximity !== ""),
            isApproachComplete: approachShots.every(s => s.proximity !== ""),
            isBunkerComplete: bunkerShots.every(s => s.proximity !== ""),
            isLongPuttComplete: longPuttShots.every(s => s.proximity !== ""),
            isMiddlePuttComplete: middlePuttShots.every(s => s.proximity !== "")
        };
    }, [driverShots, ironShots, approachShots, bunkerShots, longPuttShots, middlePuttShots, shortPuttShots]);

    const handleDriverResultSelect = (shotId: number, result: "fairway" | "rough" | "penalty") => {
        setDriverShots(prev => prev.map(s => s.id === shotId ? { ...s, result } : s));
    };

    const toggleIronDistance = (dist: number) => {
        setSelectedIronDistances(prev => {
            if (prev.includes(dist)) return prev.filter(d => d !== dist);
            if (prev.length >= 3) return prev;
            return [...prev, dist].sort((a, b) => b - a);
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
        const partLabel = TEST_GROUPS.flatMap(g => g.parts).find(p => p.key === selectedPart)?.label || selectedPart;
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
            finalTitle = `샷(SHOT) 테스트`;
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
            finalTitle = `그린 주변(AROUND GREEN) 테스트`;
            content = {
                type: "combined_around_green",
                approach: { shots: approachShots, score: scores.approach },
                bunker: { shots: bunkerShots, score: scores.bunker },
                totalScore: scores.approach + scores.bunker
            };
        } else if (selectedPart === "long_putt" || selectedPart === "middle_putt" || selectedPart === "short_putt") {
            // Check if ALL putting parts are complete
            isComplete = longPuttShots.every(s => s.proximity !== "") && 
                         middlePuttShots.every(s => s.proximity !== "") && 
                         shortPuttShots.every(s => s.proximity !== "");
            
            categoryToSave = "putting";
            finalTitle = `퍼팅(PUTTING) 테스트`;
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

            alert(editId ? "테스트 기록이 수정되었습니다." : "테스트 기록이 저장되었습니다.");
            router.push("/training/tests");
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
                        {editId ? "테스트 수정" : "테스트 작성"}
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
                                     TEST_GROUPS.flatMap(g => g.parts).find(p => p.key === selectedPart)?.label}
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
                                테스트 일자 <span className="text-brand-red">*</span>
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


                        {/* Main Group Selection */}
                        <div className="grid grid-cols-3 gap-3 mb-6">
                            {TEST_GROUPS.map((group) => {
                                const isSelected = selectedGroup === group.label;
                                return (
                                    <button
                                        key={group.label}
                                        type="button"
                                        disabled={editId !== null}
                                        onClick={() => setSelectedGroup(group.label)}
                                        className={cn(
                                            "flex flex-col items-center justify-center py-5 rounded-[2rem] border-2 transition-all gap-2",
                                            isSelected 
                                                ? "bg-brand-navy text-white border-brand-navy shadow-xl shadow-brand-navy/20 scale-[1.02]" 
                                                : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-100 dark:border-zinc-800 text-zinc-400 hover:border-zinc-200",
                                            editId !== null && !isSelected && "opacity-30 grayscale cursor-not-allowed"
                                        )}
                                    >
                                        <div className={cn("p-2.5 rounded-2xl", isSelected ? "bg-white/20" : "bg-white dark:bg-zinc-900 shadow-sm")}>
                                            {group.label.includes("샷") ? <Target size={22} /> : group.label.includes("그린") ? <Flag size={22} /> : <Crown size={22} />}
                                        </div>
                                        <span className="text-[11px] font-black uppercase tracking-tighter whitespace-nowrap">{group.label.split(' (')[0]}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Sub-Part Selection (Conditional Reveal) */}
                        {selectedGroup && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                                <div className="h-[1px] bg-zinc-100 dark:bg-zinc-800 w-full mb-2" />
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                    {TEST_GROUPS.find(g => g.label === selectedGroup)?.parts.map((opt) => (
                                        <button
                                            key={opt.key}
                                            type="button"
                                            disabled={editId !== null && selectedPart !== null && !(
                                                (selectedPart === 'driver' || selectedPart === 'iron') ? (opt.key === 'driver' || opt.key === 'iron') : 
                                                (selectedPart === 'approach' || selectedPart === 'bunker') ? (opt.key === 'approach' || opt.key === 'bunker') :
                                                opt.key === selectedPart
                                            )}
                                            onClick={() => setSelectedPart(opt.key as TestType)}
                                            className={cn(
                                                "w-full py-3.5 rounded-2xl text-[11px] font-bold transition-all border flex items-center justify-center text-center",
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
                                    <div key={shot.id} className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 transition-all">
                                        <div className="flex items-center gap-3">
                                            <span className="w-8 h-8 flex items-center justify-center bg-white dark:bg-zinc-900 rounded-full text-xs font-black text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                                                {shot.id}
                                            </span>
                                            <span className="text-sm font-bold text-zinc-600 dark:text-zinc-400">Driver Shot</span>
                                        </div>
                                        <div className="flex gap-2">
                                            {(["fairway", "rough", "penalty"] as const).map((res) => (
                                                <button
                                                    key={res}
                                                    type="button"
                                                    onClick={() => handleDriverResultSelect(shot.id, res)}
                                                    className={cn(
                                                        "px-4 py-2 rounded-xl text-xs font-bold transition-all border",
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
                                    {Array.from({ length: 15 }, (_, i) => 180 - (i * 10)).map((dist) => (
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
                            {selectedIronDistances.map((dist) => (
                                <section key={dist} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm">
                                    <h3 className="text-lg font-black text-brand-navy dark:text-brand-navy-light italic mb-4">
                                        {dist}m <span className="text-xs not-italic font-bold text-zinc-400 ml-1">Iron Test</span>
                                    </h3>
                                    <div className="space-y-2">
                                        {ironShots.filter(s => s.distance === dist).map((shot) => (
                                            <div key={`${dist}-${shot.shotId}`} className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                                                <div className="flex items-center gap-3">
                                                    <span className="w-8 h-8 flex items-center justify-center bg-white dark:bg-zinc-900 rounded-full text-xs font-black text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                                                        {shot.shotId}
                                                    </span>
                                                    <span className="text-sm font-bold text-zinc-600 dark:text-zinc-400">{dist}m Shot</span>
                                                </div>
                                                <div className="relative w-24">
                                                    <input
                                                        type="number"
                                                        placeholder="0"
                                                        min={0}
                                                        step={1}
                                                        value={shot.proximity}
                                                        onChange={(e) => updateIronShot(dist, shot.shotId, 'proximity', e.target.value)}
                                                        className="w-full pl-3 pr-8 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-brand-navy/40"
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 font-bold">m</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            ))}

                            {/* Total Score for Iron */}
                            {selectedIronDistances.length > 0 && (
                                <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 p-6 rounded-[2rem] shadow-sm flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">아이언 테스트 합계 점수</p>
                                        <p className="text-sm font-bold text-brand-navy opacity-80">데이터 점수 분석</p>
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
                            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm">
                                <h3 className="text-lg font-black text-brand-navy italic mb-4">어프로치 테스트 (12회)</h3>
                                <div className="space-y-2">
                                    {approachShots.map((shot) => (
                                        <div key={shot.shotId} className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100">
                                            <div className="flex items-center gap-3">
                                                <span className="w-8 h-8 flex items-center justify-center bg-white dark:bg-zinc-900 rounded-full text-xs font-black text-zinc-400 border border-zinc-200">
                                                    {shot.shotId}
                                                </span>
                                                <span className="text-sm font-bold text-zinc-600">Approach Shot</span>
                                            </div>
                                            <div className="relative w-24">
                                                <input
                                                    type="number"
                                                    placeholder="0"
                                                    min={0}
                                                    step={1}
                                                    value={shot.proximity}
                                                    onChange={(e) => updateApproachShot(shot.shotId, e.target.value)}
                                                    className="w-full pl-3 pr-8 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-brand-navy/40"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 font-bold">m</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 p-6 rounded-[2rem] shadow-sm flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-black uppercase text-zinc-400 mb-1">어프로치 합계 점수</p>
                                    <p className="text-sm font-bold text-brand-navy opacity-80">데이터 점수 분석</p>
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
                            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm">
                                <h3 className="text-lg font-black text-brand-navy italic mb-4">벙커 테스트 (6회)</h3>
                                <div className="space-y-2">
                                    {bunkerShots.map((shot) => (
                                        <div key={shot.shotId} className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100">
                                            <div className="flex items-center gap-3">
                                                <span className="w-8 h-8 flex items-center justify-center bg-white dark:bg-zinc-900 rounded-full text-xs font-black text-zinc-400 border border-zinc-200">
                                                    {shot.shotId}
                                                </span>
                                                <span className="text-sm font-bold text-zinc-600">Bunker Shot</span>
                                            </div>
                                            <div className="relative w-24">
                                                <input
                                                    type="number"
                                                    placeholder="0"
                                                    min={0}
                                                    step={1}
                                                    value={shot.proximity}
                                                    onChange={(e) => updateBunkerShot(shot.shotId, e.target.value)}
                                                    className="w-full pl-3 pr-8 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-brand-navy/40"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 font-bold">m</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 p-6 rounded-[2rem] shadow-sm flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-black uppercase text-zinc-400 mb-1">벙커 합계 점수</p>
                                    <p className="text-sm font-bold text-brand-navy opacity-80">데이터 점수 분석</p>
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
                                <h3 className="text-lg font-black text-brand-navy italic mb-4">롱퍼팅 테스트 (4회)</h3>
                                <div className="space-y-2">
                                    {longPuttShots.map((shot) => (
                                        <div key={shot.shotId} className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100">
                                            <div className="flex items-center gap-3">
                                                <span className="w-8 h-8 flex items-center justify-center bg-white dark:bg-zinc-900 rounded-full text-xs font-black text-zinc-400 border border-zinc-200">
                                                    {shot.shotId}
                                                </span>
                                                <span className="text-sm font-bold text-zinc-600">Long Putt</span>
                                            </div>
                                            <div className="relative w-24">
                                                <input
                                                    type="number"
                                                    placeholder="0"
                                                    min={0}
                                                    step={1}
                                                    value={shot.proximity}
                                                    onChange={(e) => updateLongPuttShot(shot.shotId, e.target.value)}
                                                    className="w-full pl-3 pr-8 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-brand-navy/40"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 font-bold">m</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 p-6 rounded-[2rem] shadow-sm flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-black uppercase text-zinc-400 mb-1">롱퍼팅 합계 점수</p>
                                    <p className="text-sm font-bold text-brand-navy opacity-80">데이터 점수 분석</p>
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

                            <div className="mt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedPart("middle_putt");
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    className={cn(
                                        "w-full py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md",
                                        scores.isLongPuttComplete
                                            ? "bg-brand-navy text-white shadow-brand-navy/20"
                                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
                                    )}
                                >
                                    다음: 미들퍼팅 테스트 작성 <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    )}

                    {selectedPart === "middle_putt" && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm">
                                <h3 className="text-lg font-black text-brand-navy italic mb-4">미들퍼팅 테스트 (8회)</h3>
                                <div className="space-y-2">
                                    {middlePuttShots.map((shot) => (
                                        <div key={shot.shotId} className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100">
                                            <div className="flex items-center gap-3">
                                                <span className="w-8 h-8 flex items-center justify-center bg-white dark:bg-zinc-900 rounded-full text-xs font-black text-zinc-400 border border-zinc-200">
                                                    {shot.shotId}
                                                </span>
                                                <span className="text-sm font-bold text-zinc-600">Middle Putt</span>
                                            </div>
                                            <div className="relative w-24">
                                                <input
                                                    type="number"
                                                    placeholder="0"
                                                    min={0}
                                                    step={1}
                                                    value={shot.proximity}
                                                    onChange={(e) => updateMiddlePuttShot(shot.shotId, e.target.value)}
                                                    className="w-full pl-3 pr-8 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-brand-navy/40"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 font-bold">m</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 p-6 rounded-[2rem] shadow-sm flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-black uppercase text-zinc-400 mb-1">미들퍼팅 합계 점수</p>
                                    <p className="text-sm font-bold text-brand-navy opacity-80">데이터 점수 분석</p>
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
                                        setSelectedPart("short_putt");
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    className={cn(
                                        "w-full py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md",
                                        scores.isMiddlePuttComplete
                                            ? "bg-brand-navy text-white shadow-brand-navy/20"
                                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
                                    )}
                                >
                                    다음: 숏퍼팅 테스트 작성 <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    )}

                    {selectedPart === "short_putt" && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm">
                                <h3 className="text-lg font-black text-brand-navy italic mb-4">숏퍼팅 테스트 (6회)</h3>
                                <div className="space-y-2">
                                    {shortPuttShots.map((shot) => (
                                        <div key={shot.shotId} className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100">
                                            <div className="flex items-center gap-3">
                                                <span className="w-8 h-8 flex items-center justify-center bg-white dark:bg-zinc-900 rounded-full text-xs font-black text-zinc-400 border border-zinc-200">
                                                    {shot.shotId}
                                                </span>
                                                <span className="text-sm font-bold text-zinc-600">Short Putt</span>
                                            </div>
                                            <div className="relative w-24">
                                                <input
                                                    type="number"
                                                    placeholder="0"
                                                    min={0}
                                                    step={1}
                                                    value={shot.proximity}
                                                    onChange={(e) => updateShortPuttShot(shot.shotId, e.target.value)}
                                                    className="w-full pl-3 pr-8 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-brand-navy/40"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 font-bold">m</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 p-6 rounded-[2rem] shadow-sm flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-black uppercase text-zinc-400 mb-1">숏퍼팅 합계 점수</p>
                                    <p className="text-sm font-bold text-brand-navy opacity-80">데이터 점수 분석</p>
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
                        </div>
                    )}

                    {selectedPart && !["driver", "iron", "approach", "bunker", "long_putt", "middle_putt", "short_putt"].includes(selectedPart) && (
                        <div className="py-20 text-center bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-[2rem]">
                            <p className="text-zinc-400 text-sm font-medium">
                                {TEST_GROUPS.flatMap(g => g.parts).find(p => p.key === selectedPart)?.label} 상세 입력 기능은 준비 중입니다.
                            </p>
                        </div>
                    )}

                    {/* ── 4. Summary Dashboard (Light Theme) ── */}
                    <section className="bg-white dark:bg-zinc-900 border-2 border-brand-navy/10 dark:border-white/10 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-navy/5 rounded-full -mr-16 -mt-16" />
                        
                        <div className="relative z-10 space-y-6">
                            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-white/5 pb-4">
                                <h3 className="text-lg font-black italic tracking-tight text-brand-navy">SESSION SUMMARY</h3>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-1">TOTAL SCORE</p>
                                    <p className={cn(
                                        "text-3xl font-black italic",
                                        scores.total < 0 ? "text-brand-red" : scores.total > 0 ? "text-blue-600" : "text-zinc-900"
                                    )}>
                                        {scores.total > 0 ? `+${scores.total.toFixed(2)}` : scores.total.toFixed(2)}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-1">
                                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">샷 (Shot)</p>
                                    <p className={cn(
                                        "text-sm font-black italic",
                                        scores.shotSubtotal < 0 ? "text-brand-red" : scores.shotSubtotal > 0 ? "text-blue-600" : "text-zinc-900"
                                    )}>
                                        {scores.shotSubtotal > 0 ? `+${scores.shotSubtotal.toFixed(2)}` : scores.shotSubtotal.toFixed(2)}
                                    </p>
                                </div>
                                <div className="space-y-1 border-l border-zinc-100 dark:border-white/5 pl-4">
                                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">그린 주변</p>
                                    <p className={cn(
                                        "text-sm font-black italic",
                                        scores.aroundSubtotal < 0 ? "text-brand-red" : scores.aroundSubtotal > 0 ? "text-blue-600" : "text-zinc-900"
                                    )}>
                                        {scores.aroundSubtotal > 0 ? `+${scores.aroundSubtotal.toFixed(2)}` : scores.aroundSubtotal.toFixed(2)}
                                    </p>
                                </div>
                                <div className="space-y-1 border-l border-zinc-100 dark:border-white/5 pl-4">
                                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">퍼팅</p>
                                    <p className={cn(
                                        "text-sm font-black italic",
                                        scores.puttingSubtotal < 0 ? "text-brand-red" : scores.puttingSubtotal > 0 ? "text-blue-600" : "text-zinc-900"
                                    )}>
                                        {scores.puttingSubtotal > 0 ? `+${scores.puttingSubtotal.toFixed(2)}` : scores.puttingSubtotal.toFixed(2)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

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
