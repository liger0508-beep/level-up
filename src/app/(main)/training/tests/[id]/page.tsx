"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Calendar, User, Trash2, Zap, BookOpen, MoreVertical, Edit2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { TestType, TEST_TYPE_LABELS } from "@/lib/test-sync";

// --- Constants ---
const SCORING: Record<string, number> = { fairway: -0.15, rough: 0.3, penalty: 0.75 };
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
    0: -0.35, 1: -0.25, 2: 0, 3: 0.25, 4: 0.35, 5: 0.45, 6: 0.5, 7: 0.55, 8: 0.6, 9: 0.65,
    10: 0.7, 11: 0.75, 12: 0.79, 13: 0.83, 14: 0.86, 15: 0.89, 16: 0.91, 17: 0.93, 18: 0.95, 19: 0.96, 20: 0.97
};
const BUNKER_SCORES: Record<number, number> = {
    0: -0.6, 1: -0.5, 2: -0.25, 3: 0, 4: 0.1, 5: 0.2, 6: 0.25, 7: 0.3, 8: 0.35, 9: 0.4,
    10: 0.45, 11: 0.5, 12: 0.54, 13: 0.58, 14: 0.61, 15: 0.64, 16: 0.66, 17: 0.68, 18: 0.7, 19: 0.71, 20: 0.72
};
const PUTTING_RESULT_SCORES: Record<number, number> = {
    0: -1, 1: 0.1, 2: 0.35, 3: 0.6, 4: 0.7, 5: 0.8, 6: 0.85, 7: 0.9, 8: 0.95, 9: 1,
    10: 1.05, 11: 1.1, 12: 1.15, 13: 1.2, 14: 1.25, 15: 1.3, 16: 1.35, 17: 1.4, 18: 1.45, 19: 1.5, 20: 1.55
};
const PUTTING_ATTEMPT_SCORES: any = {
    long_putt: { 1: -0.05, 2: -0.05, 3: -0.24, 4: -0.24 },
    middle_putt: { 1: 0.3, 2: 0.3, 3: 0.2, 4: 0.2, 5: 0.15, 6: 0.15, 7: 0.1, 8: 0.1 },
    short_putt: { 1: 0.9, 2: 0.9, 3: 0.65, 4: 0.65, 5: 0.4, 6: 0.4 }
};

export default function TestDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [test, setTest] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        const fetchTest = async () => {
            try {
                const supabase = createClient();
                const { data, error } = await supabase
                    .from("records")
                    .select(`*, users:user_id(name), coach:coach_id(name)`)
                    .eq("id", params.id)
                    .single();

                if (data) {
                    setTest({
                        ...data,
                        player: data.users ? { name: data.users.name } : { name: "선수 없음" },
                        coach: data.coach ? { name: data.coach.name } : { name: "코치 없음" }
                    });
                }
            } catch (err) { console.error(err); }
            finally { setLoading(false); }
        };
        fetchTest();
    }, [params.id]);

    const testContent = useMemo(() => {
        if (!test?.content) return null;
        try {
            if (typeof test.content === "string") return JSON.parse(test.content);
            return test.content;
        } catch (err) { return null; }
    }, [test?.content]);

    const content = testContent;
    const category = test?.category as string;

    const calculatedScores = useMemo(() => {
        if (!content) return { driver: 0, iron: 0, approach: 0, bunker: 0, long_putt: 0, middle_putt: 0, short_putt: 0 };
        
        let driver = 0;
        let iron = 0;
        let approach = 0;
        let bunker = 0;

        if (category === "shot" && content.type === "combined_shot") {
            driver = content.driver?.score || 0;
            iron = content.iron?.score || 0;
        } else if (category === "around_green" && content.type === "combined_around_green") {
            approach = content.approach?.score || 0;
            bunker = content.bunker?.score || 0;
        } else if (category === "driver") {
            driver = content.totalScore || 0;
        } else if (category === "iron") {
            iron = content.totalScore || 0;
        } else if (category === "approach") {
            approach = content.totalScore || 0;
        } else if (category === "bunker") {
            bunker = content.totalScore || 0;
        }

        return { 
            driver, iron, approach, bunker,
            long_putt: content.long?.score || (category === "long_putt" ? content.totalScore : 0),
            middle_putt: content.middle?.score || (category === "middle_putt" ? content.totalScore : 0),
            short_putt: content.short?.score || (category === "short_putt" ? content.totalScore : 0)
        };
    }, [content, category]);

    const handleDelete = async () => {
        setIsMenuOpen(false);
        if (!confirm("정말 이 기록을 삭제하시겠습니까?")) return;
        const supabase = createClient();
        await supabase.from("records").delete().eq("id", params.id);
        router.push("/training/tests");
    };

    const handleEdit = () => {
        setIsMenuOpen(false);
        router.push(`/training/tests/create?id=${params.id}`);
    };

    if (loading) return (
        <div className="min-h-screen bg-white flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-zinc-100 border-t-brand-navy rounded-full animate-spin" />
        </div>
    );
    if (!test || !testContent) return <div className="min-h-screen bg-white flex items-center justify-center font-bold">기록을 찾을 수 없습니다.</div>;

    const isShot = category === "shot" || (content && content.type === "combined_shot") || category === "around_green" || (content && content.type === "combined_around_green");

    // Helper for rendering a single shot list table
    const renderShotTable = (shots: any[], type: string) => {
        if (!shots || shots.length === 0) return null;
        const isScroll = type === "IRON" || type === "DRIVER" || type === "APPROACH" || type === "BUNKER" || type.includes("PUTT");
        
        return (
            <div className="mb-8">
                <div className="flex items-center justify-between mb-4 px-2">
                    <h4 className="text-[13px] font-black text-brand-navy dark:text-brand-navy-light uppercase tracking-widest">{type} RESULTS</h4>
                    <span className="text-[10px] font-bold text-zinc-400">{shots.length} SHOTS</span>
                </div>
                
                <div className={cn(
                    "grid gap-3 custom-scrollbar",
                    isScroll ? "flex overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide" : "grid-cols-2 sm:grid-cols-3"
                )}>
                    {shots.map((shot: any, idx: number) => {
                        let displayTitle = "";
                        let resultValue = "";
                        let scoreValue = 0;
                        let colorStyle = "";

                        if (type === "DRIVER") {
                            displayTitle = "Driver";
                            resultValue = shot.result === "fairway" ? "페어웨이" : shot.result === "rough" ? "러프" : "패널티";
                            scoreValue = SCORING[shot.result] || 0;
                            colorStyle = shot.result === "fairway" ? "text-emerald-600 bg-emerald-50" : shot.result === "rough" ? "text-amber-600 bg-amber-50" : "text-brand-red bg-red-50";
                        } else if (type === "IRON") {
                            displayTitle = `${shot.distance}m Iron`;
                            resultValue = `${shot.proximity}m`;
                            const proxIdx = Math.min(20, Math.round(Number(shot.proximity)));
                            scoreValue = (IRON_START_SCORES[shot.distance] || 0) + (IRON_RESULT_SCORES[proxIdx] || 0.32);
                        } else if (type === "APPROACH" || category === "approach") {
                            displayTitle = "Approach";
                            resultValue = `${shot.proximity}m`;
                            scoreValue = APPROACH_SCORES[Math.min(20, Math.round(Number(shot.proximity)))] || 0.97;
                        } else if (type === "BUNKER" || category === "bunker") {
                            displayTitle = "Bunker";
                            resultValue = `${shot.proximity}m`;
                            scoreValue = BUNKER_SCORES[Math.min(20, Math.round(Number(shot.proximity)))] || 0.72;
                        } else if (type.toLowerCase().includes("putt") || category.includes("putt") || category === "putting") {
                            displayTitle = "Putt";
                            resultValue = `${shot.proximity}m`;
                            const puttType = type === "LONG PUTT" ? "long_putt" : type === "MIDDLE PUTT" ? "middle_putt" : type === "SHORT PUTT" ? "short_putt" : category;
                            const attS = PUTTING_ATTEMPT_SCORES[puttType]?.[shot.shotId] || 0;
                            scoreValue = attS + (PUTTING_RESULT_SCORES[Math.min(20, Math.round(Number(shot.proximity)))] || 1.55);
                        }

                        return (
                            <div key={idx} className={cn(
                                "bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between min-h-[110px] transition-all hover:border-zinc-200 dark:hover:border-zinc-700",
                                isScroll ? "min-w-[140px] flex-shrink-0" : "w-full"
                            )}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-black text-zinc-300">#{idx + 1}</span>
                                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-tight">
                                        {displayTitle}
                                    </span>
                                </div>
                                <div>
                                    <div className={cn("inline-block px-2 py-0.5 rounded text-[15px] font-black mb-1.5", colorStyle || "text-zinc-800 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-800")}>
                                        {resultValue}
                                    </div>
                                    <p className={cn("text-lg font-black italic tracking-tighter leading-none", scoreValue < 0 ? "text-brand-red" : scoreValue > 0 ? "text-blue-600" : "text-zinc-300")}>
                                        {scoreValue > 0 ? `+${scoreValue.toFixed(2)}` : scoreValue.toFixed(2)}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-[#F9FAFB] dark:bg-zinc-950 pb-24">
            <header className="bg-white dark:bg-zinc-900 h-14 flex items-center border-b border-zinc-100 dark:border-zinc-800">
                <div className="max-w-3xl mx-auto w-full px-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button onClick={() => router.back()} className="p-1.5 -ml-2.5 hover:bg-zinc-50 rounded-lg transition-colors">
                            <ChevronLeft size={24} className="text-zinc-700 dark:text-zinc-300" />
                        </button>
                        <div className="flex items-center gap-2 ml-1">
                            <BookOpen size={20} className="text-zinc-800 dark:text-zinc-200" />
                            <h1 className="text-[17px] font-bold text-zinc-900 dark:text-zinc-50">테스트 상세</h1>
                        </div>
                    </div>
                    <div className="relative" ref={menuRef}>
                        <button 
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="p-1.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-400 transition-colors"
                        >
                            <MoreVertical size={20} />
                        </button>

                        {isMenuOpen && (
                            <div className="absolute right-0 mt-2 w-36 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg overflow-hidden z-50 animate-in fade-in zoom-in-95 origin-top-right duration-100">
                                <button
                                    onClick={handleEdit}
                                    className="w-full text-left px-4 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2 transition-colors"
                                >
                                    <Edit2 size={16} className="text-zinc-400" />
                                    수정하기
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="w-full text-left px-4 py-3 text-sm font-medium text-brand-red hover:bg-brand-red/5 flex items-center gap-2 transition-colors border-t border-zinc-100 dark:border-zinc-800"
                                >
                                    <Trash2 size={16} className="text-brand-red/70" />
                                    삭제하기
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] p-8 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <span className="bg-[#1E3A5F] text-white text-[11px] font-black px-3 py-1 rounded-full tracking-wider uppercase">
                            {isShot ? "SHOT" : TEST_TYPE_LABELS[category as TestType]?.toUpperCase() || category.toUpperCase()}
                        </span>
                        <div className="flex items-center gap-1.5 text-zinc-400 text-sm">
                            <Calendar size={14} />
                            <span className="font-medium">{test.created_at.slice(0, 16).replace('T', ' ')}</span>
                        </div>
                    </div>
                    <h2 className="text-[32px] font-black text-zinc-900 dark:text-zinc-50 mb-8 tracking-tight">{test.player?.name}</h2>
                    <div className="h-[1px] bg-zinc-100 dark:bg-zinc-800 w-full mb-6" />
                    <div className="grid grid-cols-2">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-400"><User size={20} /></div>
                            <div>
                                <p className="text-[11px] text-zinc-400 font-bold mb-0.5">담당 코치</p>
                                <p className="text-[15px] font-bold text-zinc-900 dark:text-zinc-100">{test.coach?.name}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 pl-6 border-l border-zinc-100 dark:border-zinc-800">
                            <div className="w-10 h-10 rounded-full bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-400"><User size={20} /></div>
                            <div><p className="text-[11px] text-zinc-400 font-bold mb-0.5">선수</p><p className="text-[15px] font-bold text-zinc-900 dark:text-zinc-100">{test.player?.name}</p></div>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] py-5 px-8 flex items-center justify-between shadow-sm">
                    <div className="flex flex-col items-start text-left">
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-1">Total Performance Index</p>
                        <p className="text-[12px] font-medium text-zinc-500">세션 종합 분석 점수</p>
                    </div>
                    <span className={cn("text-[42px] font-black italic tracking-tighter leading-none", (content?.totalScore ?? 0) < 0 ? "text-brand-red" : (content?.totalScore ?? 0) > 0 ? "text-blue-600" : "text-zinc-900 dark:text-white")}>
                        {content?.totalScore !== undefined ? (content.totalScore > 0 ? `+${content.totalScore.toFixed(2)}` : content.totalScore.toFixed(2)) : "0.00"}
                    </span>
                </div>

                {/* Individual Scores Row (Scrollable on mobile, Full-width on PC) */}
                <div className="flex sm:grid sm:grid-flow-col sm:auto-cols-fr overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 gap-4 scrollbar-hide">
                    {calculatedScores.driver !== 0 && (
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[1.5rem] py-4 px-6 flex flex-col items-center shadow-sm min-w-[140px] sm:min-w-0 flex-shrink-0 sm:flex-shrink-1">
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Driver Index</p>
                            <span className={cn("text-xl font-black italic tracking-tight", calculatedScores.driver < 0 ? "text-brand-red" : calculatedScores.driver > 0 ? "text-blue-600" : "text-zinc-900 dark:text-white")}>
                                {calculatedScores.driver > 0 ? `+${calculatedScores.driver.toFixed(2)}` : calculatedScores.driver.toFixed(2)}
                            </span>
                        </div>
                    )}
                    {calculatedScores.iron !== 0 && (
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[1.5rem] py-4 px-6 flex flex-col items-center shadow-sm min-w-[140px] sm:min-w-0 flex-shrink-0 sm:flex-shrink-1">
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Iron Index</p>
                            <span className={cn("text-xl font-black italic tracking-tight", calculatedScores.iron < 0 ? "text-brand-red" : calculatedScores.iron > 0 ? "text-blue-600" : "text-zinc-900 dark:text-white")}>
                                {calculatedScores.iron > 0 ? `+${calculatedScores.iron.toFixed(2)}` : calculatedScores.iron.toFixed(2)}
                            </span>
                        </div>
                    )}
                    {calculatedScores.approach !== 0 && (
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[1.5rem] py-4 px-6 flex flex-col items-center shadow-sm min-w-[140px] sm:min-w-0 flex-shrink-0 sm:flex-shrink-1">
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">App. Index</p>
                            <span className={cn("text-xl font-black italic tracking-tight", calculatedScores.approach < 0 ? "text-brand-red" : calculatedScores.approach > 0 ? "text-blue-600" : "text-zinc-900 dark:text-white")}>
                                {calculatedScores.approach > 0 ? `+${calculatedScores.approach.toFixed(2)}` : calculatedScores.approach.toFixed(2)}
                            </span>
                        </div>
                    )}
                    {calculatedScores.bunker !== 0 && (
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[1.5rem] py-4 px-6 flex flex-col items-center shadow-sm min-w-[140px] sm:min-w-0 flex-shrink-0 sm:flex-shrink-1">
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Bunker Index</p>
                            <span className={cn("text-xl font-black italic tracking-tight", calculatedScores.bunker < 0 ? "text-brand-red" : calculatedScores.bunker > 0 ? "text-blue-600" : "text-zinc-900 dark:text-white")}>
                                {calculatedScores.bunker > 0 ? `+${calculatedScores.bunker.toFixed(2)}` : calculatedScores.bunker.toFixed(2)}
                            </span>
                        </div>
                    )}
                    {calculatedScores.long_putt !== 0 && (
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[1.5rem] py-4 px-6 flex flex-col items-center shadow-sm min-w-[140px] sm:min-w-0 flex-shrink-0 sm:flex-shrink-1">
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Long Putt</p>
                            <span className={cn("text-xl font-black italic tracking-tight", calculatedScores.long_putt < 0 ? "text-brand-red" : calculatedScores.long_putt > 0 ? "text-blue-600" : "text-zinc-900 dark:text-white")}>
                                {calculatedScores.long_putt > 0 ? `+${calculatedScores.long_putt.toFixed(2)}` : calculatedScores.long_putt.toFixed(2)}
                            </span>
                        </div>
                    )}
                    {calculatedScores.middle_putt !== 0 && (
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[1.5rem] py-4 px-6 flex flex-col items-center shadow-sm min-w-[140px] sm:min-w-0 flex-shrink-0 sm:flex-shrink-1">
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Mid. Putt</p>
                            <span className={cn("text-xl font-black italic tracking-tight", calculatedScores.middle_putt < 0 ? "text-brand-red" : calculatedScores.middle_putt > 0 ? "text-blue-600" : "text-zinc-900 dark:text-white")}>
                                {calculatedScores.middle_putt > 0 ? `+${calculatedScores.middle_putt.toFixed(2)}` : calculatedScores.middle_putt.toFixed(2)}
                            </span>
                        </div>
                    )}
                    {calculatedScores.short_putt !== 0 && (
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[1.5rem] py-4 px-6 flex flex-col items-center shadow-sm min-w-[140px] sm:min-w-0 flex-shrink-0 sm:flex-shrink-1">
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Short Putt</p>
                            <span className={cn("text-xl font-black italic tracking-tight", calculatedScores.short_putt < 0 ? "text-brand-red" : calculatedScores.short_putt > 0 ? "text-blue-600" : "text-zinc-900 dark:text-white")}>
                                {calculatedScores.short_putt > 0 ? `+${calculatedScores.short_putt.toFixed(2)}` : calculatedScores.short_putt.toFixed(2)}
                            </span>
                        </div>
                    )}
                </div>

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

                <div className="pt-8 flex justify-center">
                    {/* Actions moved to header menu */}
                </div>
            </main>
            
            <style jsx global>{`
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div>
    );
}
