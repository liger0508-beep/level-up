"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Calendar, User, Trash2, Zap, BookOpen, MoreVertical, Edit2 } from "lucide-react";
import { cn, formatScore } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { TestType, TEST_TYPE_LABELS } from "@/lib/test-sync";

// --- Constants ---
const SCORING: Record<string, number> = { fairway: -0.17, rough: 0.23, penalty: 0.75 };
const IRON_START_SCORES: Record<number, number> = {
    40: 0.375, 50: 0.325, 60: 0.275, 70: 0.225, 80: 0.175,
    90: 0.125, 100: 0.075, 110: 0.025, 120: -0.025, 130: -0.075,
    140: -0.125, 150: -0.175, 160: -0.225, 170: -0.275, 180: -0.325
};
const IRON_RESULT_SCORES: Record<number, number> = {
    0: -1, 1: -0.9, 2: -0.65, 3: -0.4, 4: -0.3, 5: -0.2, 6: -0.15, 7: -0.1, 8: -0.05, 9: 0,
    10: 0.05, 11: 0.1, 12: 0.14, 13: 0.18, 14: 0.21, 15: 0.24, 16: 0.26, 17: 0.28, 18: 0.3, 19: 0.31, 20: 0.32
};
const APPROACH_SCORES: Record<number, number> = {
    0: -0.35, 1: -0.25, 2: 0, 3: 0.25, 4: 0.35, 5: 0.45,
    6: 0.5, 7: 0.55, 8: 0.6, 9: 0.65, 10: 0.7, 11: 0.75,
    12: 0.79, 13: 0.83, 14: 0.86, 15: 0.89, 16: 0.91,
    17: 0.93, 18: 0.95, 19: 0.96, 20: 0.97, 21: 0.98, 22: 0.99, 23: 1.0
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
const PUTTING_RESULT_SCORES: Record<number, number> = {
    0: -1, 1: 0.1, 2: 0.35, 3: 0.6, 4: 0.7, 5: 0.8, 6: 0.85, 7: 0.9, 8: 0.95, 9: 1,
    10: 1.05, 11: 1.1, 12: 1.15, 13: 1.2, 14: 1.25, 15: 1.3, 16: 1.35, 17: 1.4, 18: 1.45, 19: 1.5, 20: 1.55
};
const PUTTING_ATTEMPT_SCORES: any = {
    long_putt: { 1: -0.06, 2: -0.14, 3: -0.20, 4: -0.26 },
    middle_putt: { 1: 0.29, 2: 0.3, 3: 0.19, 4: 0.2, 5: 0.12, 6: 0.15, 7: 0.06, 8: 0.1 },
    short_putt: { 1: 0.89, 2: 0.9, 3: 0.64, 4: 0.65, 5: 0.39, 6: 0.4 }
};

const LONG_PUTT_LABELS: Record<number, string> = {
    1: "10m 슬라이스",
    2: "12m 훅",
    3: "14m 내리막",
    4: "16m 오르막"
};

const MIDDLE_PUTT_LABELS: Record<number, string> = {
    1: "4m 내리막",
    2: "4m 오르막",
    3: "5m 슬라이스",
    4: "5m 훅",
    5: "6m 내리막",
    6: "6m 오르막",
    7: "7m 슬라이스",
    8: "7m 훅"
};

const SHORT_PUTT_LABELS: Record<number, string> = {
    1: "1m 슬라이스",
    2: "1m 훅",
    3: "2m 내리막",
    4: "2m 오르막",
    5: "3m 슬라이스",
    6: "3m 훅"
};

const APPROACH_LABELS: Record<number, string> = {
    1: "5~10m", 2: "5~10m", 3: "5~10m", 4: "5~10m",
    5: "15m", 6: "15m", 7: "20m", 8: "20m",
    9: "25m", 10: "25m", 11: "30m", 12: "30m"
};

const BUNKER_LABELS: Record<number, string> = {
    1: "25m 이내", 2: "25m 이내", 3: "25m 이내",
    4: "25m 이상", 5: "25m 이상", 6: "25m 이상"
};
const GroupScrollRow = ({
    group,
    title,
    gIdx,
    formatScore,
    cn
}: {
    group: { title: string; shots: any[]; labelMap: any };
    title: string;
    gIdx: number;
    formatScore: (val: any) => string;
    cn: (...args: any[]) => string;
}) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    const scroll = (direction: "left" | "right") => {
        if (scrollRef.current) {
            const scrollAmount = 300;
            scrollRef.current.scrollBy({
                left: direction === "left" ? -scrollAmount : scrollAmount,
                behavior: "smooth"
            });
        }
    };

    return (
        <div className="relative group/scroll">
            {/* Left Button */}
            <button
                onClick={() => scroll("left")}
                className="absolute left-[-16px] top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full shadow-lg flex items-center justify-center text-zinc-650 dark:text-zinc-400 hover:text-brand-navy dark:hover:text-brand-navy-light transition-all opacity-0 group-hover/scroll:opacity-100 hidden md:flex active:scale-95 hover:scale-105"
            >
                <ChevronLeft size={16} />
            </button>
            {/* Right Button */}
            <button
                onClick={() => scroll("right")}
                className="absolute right-[-16px] top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full shadow-lg flex items-center justify-center text-zinc-650 dark:text-zinc-400 hover:text-brand-navy dark:hover:text-brand-navy-light transition-all opacity-0 group-hover/scroll:opacity-100 hidden md:flex active:scale-95 hover:scale-105"
            >
                <ChevronRight size={16} />
            </button>

            <div
                ref={scrollRef}
                className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide -mx-4 px-4 sm:-mx-0 sm:px-0 scroll-smooth"
            >
                {group.shots.map((shot, idx) => {
                    let shotId = shot.shotId || (idx + 1);
                    if (title === "APPROACH") {
                        if (gIdx === 0) shotId = idx + 1;
                        else if (gIdx === 1) shotId = idx + 5;
                        else shotId = idx + 9;
                    } else if (title === "BUNKER") {
                        if (gIdx === 0) shotId = idx + 1;
                        else shotId = idx + 4;
                    }

                    let label = "";
                    let resultValue = "";
                    let scoreValue = 0;

                    if (title === "DRIVER") {
                        label = `${shotId}번 홀`;
                        resultValue = shot.result ? shot.result.toUpperCase() : "N/A";
                        scoreValue = shot.result ? (SCORING[shot.result as keyof typeof SCORING] || 0) : 0;
                    } else if (title === "IRON") {
                        label = `${shot.distance}m`;
                        resultValue = shot.proximity === 0 ? "Cup in" : `${shot.proximity}m`;
                        const prox = shot.proximity !== "" ? Math.min(20, Math.round(Number(shot.proximity))) : 0;
                        scoreValue = shot.proximity !== "" ? (IRON_START_SCORES[shot.distance] || 0) + (IRON_RESULT_SCORES[prox] || 0.32) : 0;
                    } else if (title === "APPROACH") {
                        label = group.labelMap[shotId] || `${shotId}번 시도`;
                        resultValue = shot.proximity === 0 ? "Cup in" : `${shot.proximity}m`;
                        const prox = shot.proximity !== "" ? Math.round(Number(shot.proximity)) : 0;
                        if (shot.proximity !== "") {
                            if (shotId <= 4) scoreValue = getShortApproachScore(prox);
                            else if (shotId <= 8) scoreValue = getMiddleApproachScore(prox);
                            else scoreValue = getLongApproachScore(prox);
                        }
                    } else if (title === "BUNKER") {
                        label = group.labelMap[shotId] || shot.distance || `${shotId}번 시도`;
                        resultValue = shot.proximity === 0 ? "Cup in" : `${shot.proximity}m`;
                        const prox = shot.proximity !== "" ? Math.round(Number(shot.proximity)) : 0;
                        if (shot.proximity !== "") {
                            if (shotId <= 3) scoreValue = getShortBunkerScore(prox);
                            else scoreValue = getLongBunkerScore(prox);
                        }
                    } else if (title.includes("PUTT")) {
                        label = group.labelMap[shotId] || `${shotId}번 시도`;
                        resultValue = shot.proximity === 0 ? "Cup in" : `${shot.proximity}m`;
                        const typeKey = title.toLowerCase().replace(" ", "_");
                        const attemptScore = PUTTING_ATTEMPT_SCORES[typeKey]?.[shotId] || 0;
                        const prox = shot.proximity !== "" ? Math.min(20, Math.round(Number(shot.proximity))) : 0;
                        const resultScore = shot.proximity !== "" ? (PUTTING_RESULT_SCORES[prox] || 1.55) : 0;
                        scoreValue = shot.proximity !== "" ? (attemptScore + resultScore) : 0;
                    }

                    return (
                        <div key={idx} className="flex flex-col justify-between p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all w-[130px] sm:w-[136px] flex-shrink-0 min-h-[125px] text-left">
                            <div className="flex items-center gap-1.5 mb-2">
                                <span className="w-5 h-5 flex items-center justify-center bg-white dark:bg-zinc-900 rounded-full text-[9px] font-black text-zinc-450 border border-zinc-200 dark:border-zinc-700 shrink-0">
                                    {shotId}
                                </span>
                                <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                                    {title.includes("PUTT") ? "번 퍼팅 결과" : "번샷 결과"}
                                </span>
                            </div>
                            <div className="my-1.5 text-center">
                                <span className="text-[14px] font-extrabold text-zinc-800 dark:text-zinc-200 tracking-wide block">{resultValue}</span>
                            </div>
                            <div className="text-right border-t border-zinc-100/50 dark:border-zinc-800 pt-2 mt-auto">
                                <span className={cn(
                                    "text-[15px] font-black italic tracking-tight leading-none",
                                    scoreValue < 0 ? "text-brand-red" : scoreValue > 0 ? "text-blue-600" : "text-zinc-400"
                                )}>
                                    {formatScore(scoreValue)}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default function TestDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [test, setTest] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        async function fetchTest() {
            const { id } = params;
            const supabase = createClient();
            const { data, error } = await supabase
                .from("test_sessions")
                .select(`
                    id,
                    category,
                    title,
                    raw_shot_data,
                    created_at,
                    player:users!test_sessions_user_id_fkey(name),
                    coach:users!test_sessions_coach_id_fkey(name)
                `)
                .eq("id", id)
                .single();

            if (data) {
                const mappedData = {
                    ...data,
                    content: typeof data.raw_shot_data === 'string' ? JSON.parse(data.raw_shot_data) : data.raw_shot_data,
                    title: data.title || "제목 없음",
                    date: data.created_at ? ((data.created_at) ? new Date(data.created_at).toLocaleDateString('en-CA', {timeZone: 'Asia/Seoul'}) : "") : "",
                    coach: { name: (data.coach as any)?.name || "알 수 없음" },
                    player: { name: (data.player as any)?.name || "알 수 없음" }
                };
                setTest(mappedData);
            }
            setLoading(false);
        }
        fetchTest();
    }, [params]);

    const handleDelete = async () => {
        if (!confirm("이 챌린지를 삭제하시겠습니까?")) return;
        const supabase = createClient();
        const { error } = await supabase.from("test_sessions").delete().eq("id", test.id);
        if (!error) {
            alert("삭제되었습니다.");
            router.push("/training/challenges");
        }
    };

    const content = useMemo(() => {
        if (!test?.content) return null;
        return typeof test.content === 'string' ? JSON.parse(test.content) : test.content;
    }, [test?.content]);
    const category = test?.category as TestType;

    const calculatedScores = useMemo(() => {
        if (!content) return { driver: 0, iron: 0, approach: 0, bunker: 0, long_putt: 0, middle_putt: 0, short_putt: 0 };
        const s = { driver: 0, iron: 0, approach: 0, bunker: 0, long_putt: 0, middle_putt: 0, short_putt: 0 };

        if (content.driver) {
            s.driver = content.driver.shots.reduce((acc: number, shot: any) => {
                if (!shot.result) return acc;
                return acc + (SCORING[shot.result as keyof typeof SCORING] || 0);
            }, 0);
        }
        
        if (content.iron) {
            s.iron = content.iron.shots.reduce((acc: number, shot: any) => {
                if (shot.proximity === "") return acc;
                const startScore = IRON_START_SCORES[shot.distance] || 0;
                const prox = Math.min(20, Math.round(Number(shot.proximity)));
                const resultScore = IRON_RESULT_SCORES[prox] || 0.32;
                return acc + startScore + resultScore;
            }, 0);
        }
        
        if (category === "around_green") {
            if (content.approach) {
                s.approach = content.approach.shots.reduce((acc: number, shot: any, idx: number) => {
                    if (shot.proximity === "") return acc;
                    const prox = Math.round(Number(shot.proximity));
                    const shotId = idx + 1;
                    if (shotId <= 4) return acc + getShortApproachScore(prox);
                    if (shotId <= 8) return acc + getMiddleApproachScore(prox);
                    return acc + getLongApproachScore(prox);
                }, 0);
            }
            if (content.bunker) {
                s.bunker = content.bunker.shots.reduce((acc: number, shot: any, idx: number) => {
                    if (shot.proximity === "") return acc;
                    const prox = Math.round(Number(shot.proximity));
                    const shotId = idx + 1;
                    if (shotId <= 3) return acc + getShortBunkerScore(prox);
                    return acc + getLongBunkerScore(prox);
                }, 0);
            }
        } else if (category === "approach") {
            s.approach = content.shots.reduce((acc: number, shot: any, idx: number) => {
                if (shot.proximity === "") return acc;
                const prox = Math.round(Number(shot.proximity));
                const shotId = idx + 1;
                if (shotId <= 4) return acc + getShortApproachScore(prox);
                if (shotId <= 8) return acc + getMiddleApproachScore(prox);
                return acc + getLongApproachScore(prox);
            }, 0);
        } else if (category === "bunker") {
            s.bunker = content.shots.reduce((acc: number, shot: any, idx: number) => {
                if (shot.proximity === "") return acc;
                const prox = Math.round(Number(shot.proximity));
                const shotId = idx + 1;
                if (shotId <= 3) return acc + getShortBunkerScore(prox);
                return acc + getLongBunkerScore(prox);
            }, 0);
        }

        if (category === "putting") {
            if (content.long) {
                s.long_putt = content.long.shots.reduce((acc: number, shot: any) => {
                    if (shot.proximity === "") return acc;
                    const attemptScore = PUTTING_ATTEMPT_SCORES.long_putt[shot.shotId] || 0;
                    const prox = Math.min(20, Math.round(Number(shot.proximity)));
                    const resultScore = PUTTING_RESULT_SCORES[prox] || 1.55;
                    return acc + attemptScore + resultScore;
                }, 0);
            }
            if (content.middle) {
                s.middle_putt = content.middle.shots.reduce((acc: number, shot: any) => {
                    if (shot.proximity === "") return acc;
                    const attemptScore = PUTTING_ATTEMPT_SCORES.middle_putt[shot.shotId] || 0;
                    const prox = Math.min(20, Math.round(Number(shot.proximity)));
                    const resultScore = PUTTING_RESULT_SCORES[prox] || 1.55;
                    return acc + attemptScore + resultScore;
                }, 0);
            }
            if (content.short) {
                s.short_putt = content.short.shots.reduce((acc: number, shot: any) => {
                    if (shot.proximity === "") return acc;
                    const attemptScore = PUTTING_ATTEMPT_SCORES.short_putt[shot.shotId] || 0;
                    const prox = Math.min(20, Math.round(Number(shot.proximity)));
                    const resultScore = PUTTING_RESULT_SCORES[prox] || 1.55;
                    return acc + attemptScore + resultScore;
                }, 0);
            }
        } else if (category === "long_putt") {
            s.long_putt = content.shots.reduce((acc: number, shot: any) => {
                if (shot.proximity === "") return acc;
                const attemptScore = PUTTING_ATTEMPT_SCORES.long_putt[shot.shotId] || 0;
                const prox = Math.min(20, Math.round(Number(shot.proximity)));
                const resultScore = PUTTING_RESULT_SCORES[prox] || 1.55;
                return acc + attemptScore + resultScore;
            }, 0);
        } else if (category === "middle_putt") {
            s.middle_putt = content.shots.reduce((acc: number, shot: any) => {
                if (shot.proximity === "") return acc;
                const attemptScore = PUTTING_ATTEMPT_SCORES.middle_putt[shot.shotId] || 0;
                const prox = Math.min(20, Math.round(Number(shot.proximity)));
                const resultScore = PUTTING_RESULT_SCORES[prox] || 1.55;
                return acc + attemptScore + resultScore;
            }, 0);
        } else if (category === "short_putt") {
            s.short_putt = content.shots.reduce((acc: number, shot: any) => {
                if (shot.proximity === "") return acc;
                const attemptScore = PUTTING_ATTEMPT_SCORES.short_putt[shot.shotId] || 0;
                const prox = Math.min(20, Math.round(Number(shot.proximity)));
                const resultScore = PUTTING_RESULT_SCORES[prox] || 1.55;
                return acc + attemptScore + resultScore;
            }, 0);
        }

        return s;
    }, [content, category]);

    if (loading) return <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center text-zinc-400">로딩 중...</div>;
    if (!test) return <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center text-zinc-400">데이터를 찾을 수 없습니다.</div>;

    const renderShotTable = (shots: any[], title: string) => {
        if (!shots || shots.length === 0) return null;

        let groups: { title: string; shots: any[]; labelMap: any }[] = [];

        if (title === "APPROACH") {
            groups = [
                { title: "숏 어프로치 테스트", shots: shots.slice(0, 4), labelMap: APPROACH_LABELS },
                { title: "미들 어프로치 테스트", shots: shots.slice(4, 8), labelMap: APPROACH_LABELS },
                { title: "롱 어프로치 테스트", shots: shots.slice(8, 12), labelMap: APPROACH_LABELS }
            ];
        } else if (title === "BUNKER") {
            groups = [
                { title: "숏 벙커 테스트", shots: shots.slice(0, 3), labelMap: BUNKER_LABELS },
                { title: "롱 벙커 테스트", shots: shots.slice(3, 6), labelMap: BUNKER_LABELS }
            ];
        } else if (title === "LONG PUTT") {
            groups = [
                { title: "롱퍼팅 테스트", shots: shots, labelMap: LONG_PUTT_LABELS }
            ];
        } else if (title === "MIDDLE PUTT") {
            groups = [
                { title: "미들퍼팅 테스트", shots: shots, labelMap: MIDDLE_PUTT_LABELS }
            ];
        } else if (title === "SHORT PUTT") {
            groups = [
                { title: "숏퍼팅 테스트", shots: shots, labelMap: SHORT_PUTT_LABELS }
            ];
        } else if (title === "DRIVER") {
            groups = [
                { title: "드라이버 테스트", shots: shots, labelMap: null }
            ];
        } else if (title === "IRON") {
            const distances = content.iron?.distances || content.distances || [];
            if (distances && distances.length > 0) {
                groups = distances.map((dist: number) => ({
                    title: `아이언 테스트 (${dist}m)`,
                    shots: shots.filter((s: any) => s.distance === dist),
                    labelMap: null
                }));
            } else {
                groups = [
                    { title: "아이언 테스트", shots: shots, labelMap: null }
                ];
            }
        } else {
            groups = [
                { title: title, shots: shots, labelMap: null }
            ];
        }

        return (
            <div className="space-y-6">
                {groups.map((group, gIdx) => {
                    if (!group.shots || group.shots.length === 0) return null;
                    return (
                        <div key={gIdx} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm space-y-4">
                            <h4 className="text-sm font-bold text-brand-navy dark:text-brand-navy-light flex items-center gap-1.5">
                                <span className="w-1.5 h-3 bg-brand-navy dark:bg-brand-navy-light rounded-full"></span>
                                {group.title}
                            </h4>
                            <GroupScrollRow
                                group={group}
                                title={title}
                                gIdx={gIdx}
                                formatScore={formatScore}
                                cn={cn}
                            />
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-20">
            <header className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
                <div className="max-w-3xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-50 transition-colors">
                            <ChevronLeft size={24} />
                        </button>
                        <div className="flex items-center gap-2">
                            <BookOpen size={18} className="text-brand-navy dark:text-brand-navy-light" />
                            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">챌린지 결과</h1>
                        </div>
                    </div>
                    <div className="relative">
                        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 -mr-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                            <MoreVertical size={20} />
                        </button>
                        {isMenuOpen && (
                            <div className="absolute right-0 mt-2 w-36 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg overflow-hidden z-50">
                                <button onClick={handleDelete} className="w-full text-left px-4 py-3 text-sm font-medium text-brand-red hover:bg-brand-red/5 flex items-center gap-2 transition-colors">
                                    <Trash2 size={16} className="text-brand-red/70" />
                                    삭제
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 sm:px-8 py-6 space-y-6">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm space-y-4">
                    <div className="flex items-center gap-3">
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-brand-navy text-white text-[10px] font-black uppercase tracking-widest leading-none">
                            {category.toUpperCase()}
                        </span>
                        <div className="flex items-center gap-1.5 text-zinc-400">
                            <Calendar size={14} />
                            <span className="text-xs text-zinc-500 font-medium leading-none">
                                {test.date.includes(":") ? test.date : `${test.date} 00:00`}
                            </span>
                        </div>
                    </div>
                    <h2 className="text-2xl font-black text-zinc-900 dark:text-white leading-tight mt-2">
                        {test.player?.name || "선수"}
                    </h2>
                    <div className="border-t border-zinc-100 dark:border-zinc-800 my-4"></div>
                    <div className="flex items-center justify-end gap-3">
                        <div className="text-right">
                            <p className="text-[11px] text-zinc-400 font-bold mb-0.5">선수</p>
                            <p className="text-[15px] font-bold text-zinc-900 dark:text-zinc-100">{test.player?.name}</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
                            <User size={20} />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] py-5 px-8 flex items-center justify-between shadow-sm">
                    <div className="flex flex-col items-start text-left">
                        <p className="text-base font-extrabold text-zinc-800 dark:text-zinc-200">
                            {(() => {
                                if (category === "shot" || category === "driver" || category === "iron") return "샷 종합점수";
                                if (category === "around_green" || category === "approach" || category === "bunker") return "그린주변 종합점수";
                                if (category === "putting" || category.includes("putt")) return "퍼팅 종합점수";
                                return `${TEST_TYPE_LABELS[category] || "챌린지"} 종합점수`;
                            })()}
                        </p>
                    </div>
                    <span className={cn("text-[32px] font-black italic tracking-tighter leading-none", (content?.totalScore ?? 0) < 0 ? "text-brand-red" : (content?.totalScore ?? 0) > 0 ? "text-blue-600" : "text-zinc-900 dark:text-white")}>
                        {formatScore(content?.totalScore)}
                    </span>
                </div>

                {/* Individual Scores Row (Scrollable on mobile, Full-width on PC) */}
                {["shot", "around_green", "putting"].includes(category) && (
                    <div className={cn("grid gap-4 w-full", category === "putting" ? "grid-cols-3 gap-2 sm:gap-4" : "grid-cols-2")}>
                        {calculatedScores.driver !== 0 && (
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[1.5rem] py-4 px-3 sm:px-6 flex flex-col items-center shadow-sm w-full">
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Driver Index</p>
                                <span className={cn("text-xl font-black italic tracking-tight", calculatedScores.driver < 0 ? "text-brand-red" : calculatedScores.driver > 0 ? "text-blue-600" : "text-zinc-900 dark:text-white")}>
                                    {formatScore(calculatedScores.driver)}
                                </span>
                            </div>
                        )}
                        {calculatedScores.iron !== 0 && (
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[1.5rem] py-4 px-3 sm:px-6 flex flex-col items-center shadow-sm w-full">
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Iron Index</p>
                                <span className={cn("text-xl font-black italic tracking-tight", calculatedScores.iron < 0 ? "text-brand-red" : calculatedScores.iron > 0 ? "text-blue-600" : "text-zinc-900 dark:text-white")}>
                                    {formatScore(calculatedScores.iron)}
                                </span>
                                {/* Distances Subtotals */}
                                {(() => {
                                    const distances = content?.iron?.distances || content?.distances || [];
                                    if (distances && distances.length > 0) {
                                        return (
                                            <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 w-full flex flex-col gap-1.5 text-center">
                                                {distances.map((dist: number) => {
                                                    const ironShotsList = content?.iron?.shots || content?.shots || [];
                                                    const distShots = ironShotsList.filter((s: any) => s.distance === dist);
                                                    const subtotal = distShots.reduce((acc: number, shot: any) => {
                                                        if (shot.proximity === "") return acc;
                                                        const startScore = IRON_START_SCORES[shot.distance as keyof typeof IRON_START_SCORES] || 0;
                                                        const prox = Math.min(20, Math.round(Number(shot.proximity)));
                                                        const resultScore = IRON_RESULT_SCORES[prox as keyof typeof IRON_RESULT_SCORES] || 0.32;
                                                        return acc + startScore + resultScore;
                                                    }, 0);
                                                    return (
                                                        <div key={dist} className="flex items-center justify-between gap-4 w-full">
                                                            <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">{dist}m</span>
                                                            <span className={cn("text-[11px] font-black italic tracking-widest", subtotal < 0 ? "text-brand-red" : subtotal > 0 ? "text-blue-600" : "text-zinc-400")}>
                                                                {formatScore(subtotal)}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}
                            </div>
                        )}
                        {calculatedScores.approach !== 0 && (
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[1.5rem] py-4 px-3 sm:px-6 flex flex-col items-center shadow-sm w-full">
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">App. Index</p>
                                <span className={cn("text-xl font-black italic tracking-tight", calculatedScores.approach < 0 ? "text-brand-red" : calculatedScores.approach > 0 ? "text-blue-600" : "text-zinc-900 dark:text-white")}>
                                    {formatScore(calculatedScores.approach)}
                                </span>
                                {/* Approach Subtotals */}
                                {(() => {
                                    const approachShotsList = content?.approach?.shots || (category === "approach" ? content?.shots : []) || [];
                                    if (approachShotsList.length > 0) {
                                        const shortApp = approachShotsList.slice(0, 4).reduce((acc: number, shot: any) => {
                                            if (shot.proximity === "") return acc;
                                            return acc + getShortApproachScore(Math.round(Number(shot.proximity)));
                                        }, 0);
                                        const middleApp = approachShotsList.slice(4, 8).reduce((acc: number, shot: any) => {
                                            if (shot.proximity === "") return acc;
                                            return acc + getMiddleApproachScore(Math.round(Number(shot.proximity)));
                                        }, 0);
                                        const longApp = approachShotsList.slice(8, 12).reduce((acc: number, shot: any) => {
                                            if (shot.proximity === "") return acc;
                                            return acc + getLongApproachScore(Math.round(Number(shot.proximity)));
                                        }, 0);

                                        const subtotals = [
                                            { label: "숏", score: shortApp },
                                            { label: "미들", score: middleApp },
                                            { label: "롱", score: longApp }
                                        ];

                                        return (
                                            <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 w-full flex flex-col gap-1.5 text-center">
                                                {subtotals.map((sub) => (
                                                    <div key={sub.label} className="flex items-center justify-between gap-4 w-full">
                                                        <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">{sub.label}</span>
                                                        <span className={cn("text-[11px] font-black italic tracking-widest", sub.score < 0 ? "text-brand-red" : sub.score > 0 ? "text-blue-600" : "text-zinc-400")}>
                                                            {formatScore(sub.score)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}
                            </div>
                        )}
                        {calculatedScores.bunker !== 0 && (
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[1.5rem] py-4 px-3 sm:px-6 flex flex-col items-center shadow-sm w-full">
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Bunker Index</p>
                                <span className={cn("text-xl font-black italic tracking-tight", calculatedScores.bunker < 0 ? "text-brand-red" : calculatedScores.bunker > 0 ? "text-blue-600" : "text-zinc-900 dark:text-white")}>
                                    {formatScore(calculatedScores.bunker)}
                                </span>
                                {/* Bunker Subtotals */}
                                {(() => {
                                    const bunkerShotsList = content?.bunker?.shots || (category === "bunker" ? content?.shots : []) || [];
                                    if (bunkerShotsList.length > 0) {
                                        const shortBunk = bunkerShotsList.slice(0, 3).reduce((acc: number, shot: any) => {
                                            if (shot.proximity === "") return acc;
                                            return acc + getShortBunkerScore(Math.round(Number(shot.proximity)));
                                        }, 0);
                                        const longBunk = bunkerShotsList.slice(3, 6).reduce((acc: number, shot: any) => {
                                            if (shot.proximity === "") return acc;
                                            return acc + getLongBunkerScore(Math.round(Number(shot.proximity)));
                                        }, 0);

                                        const subtotals = [
                                            { label: "숏", score: shortBunk },
                                            { label: "롱", score: longBunk }
                                        ];

                                        return (
                                            <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 w-full flex flex-col gap-1.5 text-center">
                                                {subtotals.map((sub) => (
                                                    <div key={sub.label} className="flex items-center justify-between gap-4 w-full">
                                                        <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">{sub.label}</span>
                                                        <span className={cn("text-[11px] font-black italic tracking-widest", sub.score < 0 ? "text-brand-red" : sub.score > 0 ? "text-blue-600" : "text-zinc-400")}>
                                                            {formatScore(sub.score)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}
                            </div>
                        )}
                        {calculatedScores.long_putt !== 0 && (
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[1.5rem] py-4 px-3 sm:px-6 flex flex-col items-center shadow-sm w-full">
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Long Putt</p>
                                <span className={cn("text-xl font-black italic tracking-tight", calculatedScores.long_putt < 0 ? "text-brand-red" : calculatedScores.long_putt > 0 ? "text-blue-600" : "text-zinc-900 dark:text-white")}>
                                    {formatScore(calculatedScores.long_putt)}
                                </span>
                            </div>
                        )}
                        {calculatedScores.middle_putt !== 0 && (
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[1.5rem] py-4 px-3 sm:px-6 flex flex-col items-center shadow-sm w-full">
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Mid. Putt</p>
                                <span className={cn("text-xl font-black italic tracking-tight", calculatedScores.middle_putt < 0 ? "text-brand-red" : calculatedScores.middle_putt > 0 ? "text-blue-600" : "text-zinc-900 dark:text-white")}>
                                    {formatScore(calculatedScores.middle_putt)}
                                </span>
                            </div>
                        )}
                        {calculatedScores.short_putt !== 0 && (
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[1.5rem] py-4 px-3 sm:px-6 flex flex-col items-center shadow-sm w-full">
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Short Putt</p>
                                <span className={cn("text-xl font-black italic tracking-tight", calculatedScores.short_putt < 0 ? "text-brand-red" : calculatedScores.short_putt > 0 ? "text-blue-600" : "text-zinc-900 dark:text-white")}>
                                    {formatScore(calculatedScores.short_putt)}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                <div className="space-y-4">
                    <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest px-2">Detailed Results</h3>
                    {category === "shot" && content.type === "combined_shot" ? (
                        <>
                            {renderShotTable(content.driver?.shots, "DRIVER")}
                            {renderShotTable(content.iron?.shots, "IRON")}
                        </>
                    ) : (category === "around_green" || category === "approach" || category === "bunker") && (content.type === "combined_around_green" || !content.type) ? (
                        <>
                            {renderShotTable(content.approach?.shots || (category === "approach" ? content.shots : []), "APPROACH")}
                            {renderShotTable(content.bunker?.shots || (category === "bunker" ? content.shots : []), "BUNKER")}
                        </>
                    ) : (category === "putting" || category.includes("putt")) && (content.type === "combined_putting" || !content.type) ? (
                        <>
                            {renderShotTable(content.long?.shots || (category === "long_putt" ? content.shots : []), "LONG PUTT")}
                            {renderShotTable(content.middle?.shots || (category === "middle_putt" ? content.shots : []), "MIDDLE PUTT")}
                            {renderShotTable(content.short?.shots || (category === "short_putt" ? content.shots : []), "SHORT PUTT")}
                        </>
                    ) : (
                        renderShotTable(content.shots, category.toUpperCase())
                    )}
                </div>

                {/* ── Back Button ── */}
                <div className="flex justify-center pt-2">
                    <button
                        onClick={() => router.push("/training/challenges")}
                        className="px-8 py-3 rounded-[1.5rem] border border-zinc-200 dark:border-zinc-800 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all active:scale-95"
                    >
                        목록으로 돌아가기
                    </button>
                </div>
            </main>
        </div>
    );
}
