"use client";
import React, { useState, useEffect, useRef } from "react";
import { Trophy, AlertTriangle, TrendingDown, TrendingUp, ChevronRight as ChevronRight2, BookOpen, Layers, X, Calendar, Activity, Flag, Zap, Target, Book, ChevronUp, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { calculateScorecardAnalysis, HoleAnalysis } from "@/lib/score-calculations";
import { cn } from "@/lib/utils";

// ── Components ───────────────────────────────────────────────

const AutoAbbrText = ({ fullText, shortText, className }: { fullText: string, shortText: string, className?: string }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const fullTextRef = useRef<HTMLSpanElement>(null);
    const [useShort, setUseShort] = useState(false);

    useEffect(() => {
        if (!containerRef.current || !fullTextRef.current) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const containerWidth = entry.contentRect.width;
                const textWidth = fullTextRef.current!.offsetWidth;
                setUseShort(textWidth > containerWidth);
            }
        });

        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [fullText]);

    return (
        <div ref={containerRef} className={cn("flex-1 min-w-0 relative flex items-center overflow-hidden", className)}>
            <span
                ref={fullTextRef}
                className="absolute opacity-0 pointer-events-none whitespace-nowrap"
            >
                {fullText}
            </span>
            <span className="truncate block w-full">
                {useShort ? <span className="uppercase tracking-tighter">{shortText}</span> : fullText}
            </span>
        </div>
    );
};

const SectionHeader = ({ title, icon: Icon, badge }: { title: string; icon: any; badge?: string }) => (
    <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400">
                <Icon size={18} />
            </div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">{title}</h2>
        </div>
        {badge && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-brand-navy/5 text-brand-navy dark:bg-brand-navy/20 dark:text-brand-navy-light border border-brand-navy/10">
                {badge}
            </span>
        )}
    </div>
);

const IndicatorCard = ({ label, value, unit, icon: Icon, colorClass = "text-brand-navy" }: { label: React.ReactNode; value: string | number; unit?: string; icon: any; colorClass?: string }) => (
    <div className="bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800/50 p-4 rounded-2xl flex flex-col justify-between h-full min-h-[100px]">
        <div className="flex items-start gap-1.5 mb-3 text-[12px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-tight">
            <Icon size={14} className="text-zinc-400 shrink-0 mt-0.5" />
            <span className="leading-tight">{label}</span>
        </div>
        <div className="flex items-baseline justify-end gap-1">
            <span className={cn("text-2xl font-black tracking-tighter", colorClass)}>{value}</span>
            {unit && <span className="text-[12px] font-bold text-zinc-400 ml-0.5">{unit}</span>}
        </div>
    </div>
);

const SummaryBox = ({ label, value, icon: Icon, colorClass = "text-brand-navy" }: { label: React.ReactNode; value: string | number; icon: any; colorClass?: string }) => {
    const isPositive = typeof value === 'string' && value.startsWith('+');
    const isNegative = typeof value === 'string' && value.startsWith('-');
    // Negative is Red (Good), Positive is Blue (Bad) in this app's convention
    const displayColor = isPositive ? "text-blue-500" : isNegative ? "text-red-500" : colorClass;

    return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-5 py-7 rounded-[2.5rem] shadow-sm flex flex-col items-start justify-between min-h-[190px]">
            <div className="flex flex-col items-start gap-2 mb-2 text-[11px] font-black text-zinc-400 text-left">
                <Icon size={20} className="text-zinc-400/80 shrink-0" />
                <div className="leading-tight">
                    {label}
                </div>
            </div>
            <div className="w-full flex items-baseline justify-end">
                <span className={cn("text-2xl font-black tracking-tighter", displayColor)}>{value}</span>
            </div>
        </div>
    );
};

const PREP_CATEGORIES = [
    "퍼팅", "그린주변샷", "아이언&피치샷", "티샷"
];

const LOCATION_ABBR_REV: Record<string, string> = {
    "TE": "티박스",
    "FW": "페어웨이",
    "RO": "러프",
    "FB": "페어웨이 벙커",
    "GR": "그린",
    "GA": "어프로치",
    "GB": "벙커",
    "HI": "홀인",
    "PA": "패널티구역",
    "OB": "오비",
    "PS": "벌타",
    "FO": "숲속",
    "-": "패널티구역"
};

const POS_MAP: Record<string, string> = {
    "TE": "티샷",
    "FW": "페어웨이",
    "RO": "러프",
    "FB": "페어웨이 벙커",
    "GR": "그린",
    "GA": "그린 주변 어프로치",
    "GB": "그린 주변 벙커",
    "HI": "홀인",
    "PA": "패널티구역",
    "OB": "오비",
    "PS": "벌타",
    "FO": "숲속",
};

function getCategoryShots(catName: string, h: any) {
    const shots = h.shots || [];
    let isMatchFn;
    if (catName === "티샷 비거리" || catName === "티샷 정확도" || catName === "티샷") {
        isMatchFn = (s: any) => s.shotLabel?.split('/')[0].trim().toUpperCase() === "TE" && h.par >= 4;
    } else if (catName === "아이언&피치샷") {
        isMatchFn = (s: any) => { const l = s.shotLabel?.split('/')[0].trim().toUpperCase(); return l !== "GR" && l !== "GB" && (l !== "TE" || h.par === 3) && s.attemptDistance >= 31; };
    } else if (catName === "그린주변샷") {
        isMatchFn = (s: any) => { const l = s.shotLabel?.split('/')[0].trim().toUpperCase(); return l === "GB" || (l !== "GR" && l !== "TE" && s.attemptDistance > 0 && s.attemptDistance <= 30); };
    } else if (catName === "퍼팅") {
        isMatchFn = (s: any) => s.shotLabel?.split('/')[0].trim().toUpperCase() === "GR" && s.attemptDistance >= 1;
    } else {
        isMatchFn = () => false;
    }

    return shots.filter((s: any) => isMatchFn(s));
}

function createWorstShotInfo(s: any, h: any) {
    const startAbbr = s.shotLabel?.split('/')[0].trim();
    const attemptLoc = LOCATION_ABBR_REV[startAbbr] || startAbbr;
    const isTeeShot = startAbbr === "TE";
    const attemptText = (isTeeShot && h.par !== 3)
        ? attemptLoc
        : `${attemptLoc} / ${s.attemptDistance > 0 ? s.attemptDistance + 'm' : "-"}`;

    const attemptTextShort = (isTeeShot && h.par !== 3)
        ? startAbbr
        : `${startAbbr} / ${s.attemptDistance > 0 ? s.attemptDistance + 'm' : "-"}`;

    const resultLoc = LOCATION_ABBR_REV[s.landingLabel] || s.landingLabel || "알수없음";
    let resultText = resultLoc;
    let resultTextShort = s.landingLabel || "??";

    if (s.landingLabel !== "HI" && !['OB', 'PA', 'PS', '-'].includes(s.landingLabel)) {
        resultText += ` / ${s.remainingDistance > 0 ? s.remainingDistance + 'm' : "-"}`;
        resultTextShort += ` / ${s.remainingDistance > 0 ? s.remainingDistance + 'm' : "-"}`;
    }

    return {
        attempt: attemptText,
        attemptShort: attemptTextShort,
        result: resultText,
        resultShort: resultTextShort,
        isPenalty: ['OB', 'PA', 'PS', '-'].includes(s.landingLabel),
        score: s.shotSG,
        rawAttemptDistance: s.attemptDistance,
    };
}

export default function ReferenceDataModal({ isOpen, onClose, playerName }: { isOpen: boolean; onClose: () => void; playerName: string }) {
    const [loading, setLoading] = useState(true);
    const [scoreData, setScoreData] = useState<any>(null);
    const [trainingData, setTrainingData] = useState<any>(null);
    const [selectedPlanLabel, setSelectedPlanLabel] = useState<string | null>(null);
    const [selectedHoleDetails, setSelectedHoleDetails] = useState<{ holeNumber: number, label: string } | null>(null);

    const touchStartX = useRef<number>(0);
    const touchEndX = useRef<number>(0);

    const getRelevantShots = (holeNumber: number, category: string) => {
        if (!scoreData || !scoreData.result) return [];
        const hole = scoreData.result.find((h: any) => h.holeNumber === holeNumber);
        if (!hole) return [];

        const filtered = hole.shots.filter((s: any) => {
            const label = (s.shotLabel || "").split('/')[0].trim().toUpperCase();
            const dist = s.attemptDistance;

            if (category === "티샷 비거리" || category === "티샷 정확도") return label === "TE";
            if (category === "180M이상") return label !== "GR" && label !== "GB" && dist >= 180;
            if (category === "150-179M") return label !== "GR" && label !== "GB" && dist >= 150 && dist < 180;
            if (category === "120-149M") return label !== "GR" && label !== "GB" && dist >= 120 && dist < 150;
            if (category === "90-119M") return label !== "GR" && label !== "GB" && dist >= 90 && dist < 120;
            if (category === "피치샷") return label !== "GR" && label !== "GB" && dist >= 31 && dist < 90;
            if (category === "벙커") return label === "GB";
            if (category === "어프로치") return label !== "GR" && label !== "GB" && label !== "TE" && dist <= 30;
            if (category === "9M이상") return label === "GR" && dist >= 9;
            if (category === "4-8M") return label === "GR" && dist >= 4 && dist < 9;
            if (category === "2-3M") return label === "GR" && dist >= 2 && dist < 4;
            if (category === "1M") return label === "GR" && dist === 1;
            return false;
        });

        return filtered.filter((s: any, idx: number, arr: any[]) => {
            if (idx === 0) return true;
            const prev = arr[idx - 1];
            const prevLanding = (prev.landingLabel || "").toUpperCase().trim();
            const isPenalty = ["PA", "OB", "PS"].includes(prevLanding);
            if (isPenalty && s.attemptDistance === prev.attemptDistance) return false;
            return true;
        });
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        touchEndX.current = 0; // Reset
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        touchEndX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = (currentIndex: number, holesList: any[], catName: string) => {
        if (!touchStartX.current || !touchEndX.current) return;
        const distance = touchStartX.current - touchEndX.current;
        const minSwipeDistance = 50;

        if (distance > minSwipeDistance) {
            // Swiped left -> Next hole
            if (currentIndex < holesList.length - 1) {
                setSelectedHoleDetails({ holeNumber: holesList[currentIndex + 1].holeNumber, label: catName });
            }
        } else if (distance < -minSwipeDistance) {
            // Swiped right -> Previous hole
            if (currentIndex > 0) {
                setSelectedHoleDetails({ holeNumber: holesList[currentIndex - 1].holeNumber, label: catName });
            }
        }
        touchStartX.current = 0;
        touchEndX.current = 0;
    };

    useEffect(() => {
        if (!isOpen || !playerName) return;
        let isMounted = true;

        const fetchData = async () => {
            setLoading(true);
            try {
                const supabase = createClient();
                const { data: userRes } = await supabase.from("users").select("id").eq("name", playerName).maybeSingle();
                if (!userRes) return;
                const userId = userRes.id;

                // 1. Fetch Recent Scorecard (must match fetchLatestScoreByPlayer criteria)
                const { data: scorecards } = await supabase
                    .from("scorecards")
                    .select("id, round_date, course_name, total_score, athlete_id, memo, is_final, holes:scorecard_holes(hole_number, par, score, shots:scorecard_shots(*))")
                    .eq("athlete_id", userId)
                    .order("round_date", { ascending: false })
                    .order("created_at", { ascending: false })
                    .limit(10);

                const sc = scorecards?.find(s => s.is_final !== false);

                if (sc) {
                    const result = await calculateScorecardAnalysis(sc.id);
                    const cats = [
                        { name: "티샷 비거리", sg: result.reduce((s, h) => s + h.summary.distSG_DriverDist, 0) },
                        { name: "티샷 정확도", sg: result.reduce((s, h) => s + h.summary.distSG_DriverAcc, 0) },
                        { name: "180M이상", sg: result.reduce((s, h) => s + h.summary.distSG_180Plus, 0) },
                        { name: "150-179M", sg: result.reduce((s, h) => s + h.summary.distSG_150_179, 0) },
                        { name: "120-149M", sg: result.reduce((s, h) => s + h.summary.distSG_120_149, 0) },
                        { name: "90-119M", sg: result.reduce((s, h) => s + h.summary.distSG_90_119, 0) },
                        { name: "피치샷", sg: result.reduce((s, h) => s + h.summary.distSG_Pitch31_89, 0) },
                        { name: "벙커", sg: result.reduce((s, h) => s + h.summary.distSG_Bunker, 0) },
                        { name: "어프로치", sg: result.reduce((s, h) => s + h.summary.distSG_Approach, 0) },
                        { name: "9M이상", sg: result.reduce((s, h) => s + h.summary.distSG_Putt9Plus, 0) },
                        { name: "4-8M", sg: result.reduce((s, h) => s + h.summary.distSG_Putt4_8, 0) },
                        { name: "2-3M", sg: result.reduce((s, h) => s + h.summary.distSG_Putt2_3, 0) },
                        { name: "1M", sg: result.reduce((s, h) => s + h.summary.distSG_Putt1, 0) },
                    ];
                    const teeSG = cats.filter(c => c.name === "티샷 비거리" || c.name === "티샷 정확도").reduce((s, c) => s + c.sg, 0);
                    const secondSG = cats.filter(c => ["180M이상", "150-179M", "120-149M", "90-119M"].includes(c.name)).reduce((s, c) => s + c.sg, 0);
                    const greenSG = cats.filter(c => ["피치샷", "벙커", "어프로치"].includes(c.name)).reduce((s, c) => s + c.sg, 0);
                    const puttingSG = cats.filter(c => ["9M이상", "4-8M", "2-3M", "1M"].includes(c.name)).reduce((s, c) => s + c.sg, 0);

                    const longSG = teeSG + secondSG;
                    const shortSG = greenSG + puttingSG;
                    const longVsShort = shortSG - longSG;
                    const playContent = sc.total_score + ((longVsShort * -1) / 2);
                    const scoreVsContent = sc.total_score - playContent;

                    const CATEGORY_TO_FIELD: Record<string, string> = {
                        "티샷 비거리": "distSG_DriverDist",
                        "티샷 정확도": "distSG_DriverAcc",
                        "180M이상": "distSG_180Plus",
                        "150-179M": "distSG_150_179",
                        "120-149M": "distSG_120_149",
                        "90-119M": "distSG_90_119",
                        "피치샷": "distSG_Pitch31_89",
                        "벙커": "distSG_Bunker",
                        "어프로치": "distSG_Approach",
                        "9M이상": "distSG_Putt9Plus",
                        "4-8M": "distSG_Putt4_8",
                        "2-3M": "distSG_Putt2_3",
                        "1M": "distSG_Putt1",
                    };

                    const totalAbsSG = cats.reduce((s, c) => s + Math.abs(c.sg), 0);
                    const categoriesWithPercent = cats.map(c => ({
                        ...c,
                        percent: totalAbsSG > 0 ? (Math.abs(c.sg) / totalAbsSG) * 100 : 0
                    })).sort((a, b) => a.sg - b.sg);

                    const negativeCats = [...cats].filter(c => c.sg < 0).sort((a, b) => a.sg - b.sg);
                    const positiveCats = categoriesWithPercent.filter(c => c.sg > 0).sort((a, b) => b.percent - a.percent);

                    const strongPlan = negativeCats.slice(0, 1).map((c, i) => {
                        const fieldName = CATEGORY_TO_FIELD[c.name];
                        const holeNumbers = result
                            .filter(h => (h.summary as any)[fieldName] < 0)
                            .sort((a, b) => (a.summary as any)[fieldName] - (b.summary as any)[fieldName])
                            .slice(0, 5)
                            .sort((a, b) => a.holeNumber - b.holeNumber)
                            .map(h => h.holeNumber);
                        return { label: c.name, holeNumbers };
                    });

                    const challengePlan = positiveCats.slice(0, 2).map((c, i) => {
                        const fieldName = CATEGORY_TO_FIELD[c.name];
                        const holeNumbers = result
                            .filter(h => (h.summary as any)[fieldName] > 0)
                            .sort((a, b) => (b.summary as any)[fieldName] - (a.summary as any)[fieldName])
                            .slice(0, 5)
                            .sort((a, b) => a.holeNumber - b.holeNumber)
                            .map(h => h.holeNumber);
                        return { label: c.name, holeNumbers };
                    });

                    const fwHoles = result.filter(h => h.summary.fairwayHit !== '-' && h.score > 0 && h.par >= 4);
                    const fwHits = fwHoles.filter(h => h.summary.fairwayHit === 'O').length;
                    const fairwayHitRate = fwHoles.length > 0 ? (fwHits / fwHoles.length) * 100 : 0;

                    const validGirHoles = result.filter(h => h.score > 0 && h.par > 0);
                    const girHits = validGirHoles.filter(h => h.summary.gir === 'O').length;
                    const girRate = validGirHoles.length > 0 ? (girHits / validGirHoles.length) * 100 : 0;

                    const missedGirHoles = result.filter(h => h.summary && h.summary.gir === 'X' && h.par > 0 && h.score > 0);
                    const parSaves = missedGirHoles.filter(h => h.score <= h.par);
                    const parSaveRate = missedGirHoles.length > 0 ? (parSaves.length / missedGirHoles.length) * 100 : 0;

                    const totalPutts = result.reduce((s, h) => s + h.summary.putts, 0);
                    const threePuttCount = result.filter(h => h.summary.putts >= 3).length;
                    const penaltyCount = result.reduce((s, h) => s + h.summary.paCount, 0) + result.reduce((s, h) => s + h.summary.obCount, 0);

                    const formatScore = (val: number) => (val === 0 ? "0" : (val > 0 ? "+" : "") + val.toFixed(2));
                    const roundToOne = (num: number) => Number(Math.round(Number(num + "e1")) + "e-1").toFixed(1);

                    setScoreData({
                        date: sc.round_date,
                        course: sc.course_name,
                        totalScore: sc.total_score,
                        memo: sc.memo,
                        totalPar: result.reduce((s, h) => s + h.par, 0),
                        playContent: roundToOne(playContent),
                        scoreVsContent: (scoreVsContent > 0 ? "+" : "") + roundToOne(scoreVsContent),
                        longVsShort: (longVsShort > 0 ? "+" : "") + roundToOne(longVsShort),
                        avgMetrics: [
                            { label: <>페어웨이<br />안착률</>, value: (fairwayHitRate > 0 ? fairwayHitRate.toFixed(1) : "-"), unit: fairwayHitRate > 0 ? "%" : "" },
                            { label: "그린 적중률", value: (girRate > 0 ? girRate.toFixed(1) : "-"), unit: girRate > 0 ? "%" : "" },
                            { label: "파세이브율", value: (parSaveRate > 0 ? parSaveRate.toFixed(1) : "-"), unit: parSaveRate > 0 ? "%" : "" },
                            { label: "퍼트수", value: totalPutts, unit: "개" },
                            { label: "3퍼트 이상", value: threePuttCount, unit: "회" },
                            { label: "패널티/OB", value: penaltyCount, unit: "개" },
                        ],
                        sectorChanges: [
                            { type: "티샷", value: formatScore(teeSG), items: cats.slice(0, 2) },
                            { type: "세컨샷", value: formatScore(secondSG), items: cats.slice(2, 6) },
                            { type: "그린주변샷", value: formatScore(greenSG), items: cats.slice(6, 9) },
                            { type: "퍼팅", value: formatScore(puttingSG), items: cats.slice(9, 13) }
                        ],
                        strongPlan,
                        challengePlan,
                        result
                    });
                }

                // 2. Fetch Recent Training
                const { data: trainingRec } = await supabase
                    .from("records")
                    .select("*")
                    .eq("user_id", userId)
                    .like("title", "%[복습]%")
                    .order("inserted_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (trainingRec) {
                    let analysisToUse = null;
                    const reviewSetting = trainingRec.template_settings?.find((s: any) => s.type === "review_scorecard" || s.type === "prep_scorecard");

                    if (reviewSetting && reviewSetting.scorecardId) {
                        const { calculateScorecardAnalysis } = await import("@/lib/score-calculations");
                        analysisToUse = await calculateScorecardAnalysis(reviewSetting.scorecardId);
                    }

                    if (analysisToUse) {
                        const { generateReviewFocusCategories } = await import("@/lib/score-calculations");
                        const focusCategories = generateReviewFocusCategories(analysisToUse);
                        const reviewCategories: any[] = [];
                        const MAJORS = ["퍼팅", "그린주변샷", "아이언&피치샷", "티샷"];

                        MAJORS.forEach((major) => {
                            if (focusCategories[major] && focusCategories[major].length > 0) {
                                const holes = focusCategories[major].reduce((acc: any[], s: any) => {
                                    if (!acc.find(item => item.holeNumber === s.holeNumber)) {
                                        const h = analysisToUse.find((hole: any) => hole.holeNumber === s.holeNumber);
                                        const originalShot = h?.shots.find((os: any) => os.shotLabel === s.shotLabel && os.attemptDistance === s.attemptDistance);

                                        acc.push({
                                            holeNumber: s.holeNumber,
                                            par: h?.par || 0,
                                            hData: h,
                                            worstShotInfo: originalShot ? createWorstShotInfo(originalShot, h) : {
                                                attempt: s.subCategory,
                                                result: "알수없음",
                                                isPenalty: false,
                                                score: s.shotSG,
                                                note: null,
                                                rawAttemptDistance: s.attemptDistance,
                                                shotNumber: 0
                                            },
                                            uniqueId: `${major}_${s.holeNumber}_${s.attemptDistance}_${originalShot?.shotNumber || 0}`,
                                        });
                                    }
                                    return acc;
                                }, []);
                                reviewCategories.push({
                                    name: major,
                                    holes,
                                    rank: `${reviewCategories.length + 1}`,
                                    color: ["bg-red-500", "bg-orange-500", "bg-emerald-500", "bg-blue-500", "bg-indigo-500", "bg-purple-500"][reviewCategories.length] || "bg-zinc-500",
                                });
                            }
                        });

                        setTrainingData({ ...trainingRec, reviewCategories });
                    } else {
                        setTrainingData(trainingRec);
                    }
                }

            } catch (err) {
                console.error("Failed to load reference data", err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        fetchData();
        return () => { isMounted = false; };
    }, [isOpen, playerName]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6 lg:p-8 animate-in fade-in duration-200">
            <div className="bg-[#F8F9FC] dark:bg-zinc-950 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] md:max-h-[85vh] h-full flex flex-col overflow-hidden border border-zinc-200/50 dark:border-zinc-800/50 relative">
                <div className="flex items-center justify-between p-4 px-6 border-b border-zinc-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-900 shrink-0">
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <BookOpen size={20} className="text-brand-navy dark:text-brand-navy-light" />
                        최근 라운드 정보 ({playerName})
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                        <X size={20} className="text-zinc-500" />
                    </button>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                    {loading ? (
                        <div className="h-full flex items-center justify-center">
                            <div className="w-8 h-8 border-4 border-brand-navy/20 border-t-brand-navy rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <div className="max-w-4xl mx-auto space-y-8 pb-8">
                            {/* 1. 최근 라운드 요약 */}
                            {scoreData && (
                                <div className="space-y-6">
                                    {/* 날짜, 골프장명 */}
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="text-zinc-500 flex items-center gap-1.5 text-base font-medium">
                                            <Calendar size={18} /> {scoreData.date}
                                        </div>
                                        <h2 className="text-base sm:text-lg font-black text-zinc-900 dark:text-zinc-50 tracking-tight text-right">
                                            {scoreData.course}
                                        </h2>
                                    </div>
                                    {/* SCORE Banner */}
                                    {(() => {
                                        const scoreDiff = scoreData.totalScore - scoreData.totalPar;
                                        const scoreDiffStr = scoreDiff > 0 ? `+${scoreDiff}` : scoreDiff === 0 ? "E" : `${scoreDiff}`;
                                        const isUnderPar = scoreDiff < 0;
                                        const isOverPar = scoreDiff > 0;
                                        const scoreBgClass = isUnderPar ? "bg-red-50 border-red-100" : isOverPar ? "bg-blue-50 border-blue-100" : "bg-zinc-100 border-zinc-200";
                                        const scoreTextClass = isUnderPar ? "text-red-500" : isOverPar ? "text-blue-500" : "text-zinc-900";

                                        return (
                                            <section className={cn("border rounded-[3rem] p-6 sm:p-10 mb-6 flex flex-col items-center justify-center relative overflow-hidden shadow-sm", scoreBgClass)}>
                                                <div className={cn("absolute right-0 top-0 opacity-[0.03] pointer-events-none transform translate-x-1/4 -translate-y-1/4", scoreTextClass)}>
                                                    <Activity size={240} strokeWidth={1} />
                                                </div>

                                                <div className={cn("flex items-center gap-2 mb-2 font-bold text-sm tracking-widest relative z-10 uppercase self-start sm:self-center", scoreTextClass)}>
                                                    <Activity size={18} /> SCORE
                                                </div>

                                                <div className="flex flex-row items-baseline gap-1.5 sm:gap-2 relative z-10 text-brand-navy mt-1 sm:mt-2 whitespace-nowrap">
                                                    <div className="flex items-baseline gap-1.5 sm:gap-2">
                                                        <span className={cn("text-2xl font-black tracking-tighter", scoreTextClass)}>{scoreData.totalScore}</span>
                                                        <span className={cn("text-lg font-bold", scoreTextClass)}>
                                                            ({scoreDiffStr})
                                                        </span>
                                                    </div>
                                                    <span className="text-sm font-bold text-zinc-500 ml-1 sm:ml-2">/ par {scoreData.totalPar}</span>
                                                </div>
                                            </section>
                                        );
                                    })()}

                                    {/* 3 Summary Boxes */}
                                    <div className="grid grid-cols-3 gap-3 sm:gap-5">
                                        <SummaryBox label={<>플레이<br />내용</>} value={scoreData.playContent} icon={Flag} />
                                        <SummaryBox label={<>롱게임<br />대비<br />숏게임</>} value={scoreData.longVsShort} icon={Zap} />
                                        <SummaryBox label={<>내용<br />대비<br />스코어</>} value={scoreData.scoreVsContent} icon={Target} />
                                    </div>

                                    {/* 부문별 스코어 (상세) */}
                                    <section className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 shadow-sm border border-zinc-200/60 dark:border-zinc-800/60">
                                        <SectionHeader title="부문별 스코어" icon={Target} />
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            {scoreData.sectorChanges.map((sc: any) => {
                                                const isPositive = parseFloat(sc.value) > 0;
                                                return (
                                                    <div key={sc.type} className={cn(
                                                        "p-3 sm:p-4 rounded-[1.5rem] sm:rounded-[2rem] border flex flex-col gap-2 sm:gap-3 transition-all",
                                                        isPositive ? "bg-blue-50/30 border-blue-100" : "bg-red-50/30 border-red-100"
                                                    )}>
                                                        <div className="flex flex-col">
                                                            <p className="text-[13px] font-black text-zinc-400 uppercase tracking-tight">{sc.type}</p>
                                                            <p className={cn("text-2xl font-black tracking-tighter text-right mt-1", isPositive ? "text-blue-500" : "text-red-500")}>
                                                                {sc.value}
                                                            </p>
                                                        </div>
                                                        <div className="space-y-1.5 pt-3 mt-1 border-t border-zinc-100/50">
                                                            {sc.items.map((item: any, iIdx: number) => {
                                                                const isItemPos = parseFloat(item.sg) > 0;
                                                                return (
                                                                    <div key={iIdx} className="flex justify-between items-center text-[12px] sm:text-[13px] font-bold tracking-tight">
                                                                        <span className="text-zinc-500 whitespace-nowrap">{item.name}</span>
                                                                        <span className={isItemPos ? "text-blue-500" : "text-red-500"}>
                                                                            {isItemPos ? "+" : ""}{item.sg.toFixed(1)}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </section>

                                    {/* 주요 평균 지표 6개 */}
                                    <section className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 shadow-sm border border-zinc-200/60 dark:border-zinc-800/60">
                                        <SectionHeader title="주요 평균 지표" icon={TrendingDown} />
                                        <div className="grid grid-cols-2 gap-4">
                                            {scoreData.avgMetrics?.map((m: any, idx: number) => (
                                                <IndicatorCard key={idx} label={m.label} value={m.value} unit={m.unit} icon={Activity} />
                                            ))}
                                        </div>
                                    </section>

                                    {/* 샷 노트 (Shot Note) */}
                                    {scoreData.memo && (
                                        <section className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 shadow-sm border border-zinc-200/60 dark:border-zinc-800/60">
                                            <SectionHeader title="라운드 샷 노트" icon={BookOpen} />
                                            <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-700/50 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                                                {scoreData.memo}
                                            </div>
                                        </section>
                                    )}
                                    {/* 2. Strong Point */}
                                    {scoreData && scoreData.strongPlan && scoreData.strongPlan.length > 0 && (
                                        <section className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 shadow-sm border border-zinc-200/60 dark:border-zinc-800/60">
                                            <div className="flex items-center gap-2 mb-6">
                                                <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/10 flex items-center justify-center text-red-500 shrink-0">
                                                    <Trophy size={18} />
                                                </div>
                                                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">STRONG POINT</h2>
                                            </div>
                                            <div className="space-y-3">
                                                {scoreData.strongPlan.map((item: any) => {
                                                    const validHoles = item.holeNumbers.filter((hn: number) => getRelevantShots(hn, item.label).some((shot: any) => shot.shotSG < 0));
                                                    const isExpanded = selectedPlanLabel === item.label;
                                                    return (
                                                        <div key={item.label} className="space-y-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    if (isExpanded) {
                                                                        setSelectedPlanLabel(null);
                                                                        setSelectedHoleDetails(null);
                                                                    } else {
                                                                        setSelectedPlanLabel(item.label);
                                                                        if (validHoles && validHoles.length > 0) {
                                                                            setSelectedHoleDetails({ holeNumber: validHoles[0], label: item.label });
                                                                        } else {
                                                                            setSelectedHoleDetails(null);
                                                                        }
                                                                    }
                                                                }}
                                                                className={cn(
                                                                    "w-full bg-white dark:bg-zinc-900 border rounded-2xl flex items-center justify-center p-4 transition-all relative",
                                                                    isExpanded ? "border-orange-500 ring-1 ring-orange-500" : "border-zinc-200 dark:border-zinc-800 hover:border-orange-400"
                                                                )}
                                                            >
                                                                <span className="font-black text-[15px] sm:text-[17px] text-zinc-800 dark:text-zinc-200 block break-keep leading-tight text-center">{item.label}</span>
                                                                {isExpanded ? <ChevronUp size={16} className="text-zinc-400 absolute right-4" /> : <ChevronDown size={16} className="text-zinc-400 absolute right-4" />}
                                                            </button>
                                                            {isExpanded && (
                                                                <div className="px-4 py-3 bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 rounded-2xl animate-in slide-in-from-top-2 duration-200">
                                                                    <div className="grid grid-cols-5 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
                                                                        {validHoles.map((hn: number) => {
                                                                            const isSelected = selectedHoleDetails?.holeNumber === hn && selectedHoleDetails?.label === item.label;
                                                                            return (
                                                                                <button
                                                                                    key={hn}
                                                                                    onClick={() => {
                                                                                        if (isSelected) {
                                                                                            setSelectedHoleDetails(null);
                                                                                        } else {
                                                                                            setSelectedHoleDetails({ holeNumber: hn, label: item.label });
                                                                                            setTimeout(() => {
                                                                                                const el = document.getElementById(`hole-detail-${item.label}-${hn}`);
                                                                                                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
                                                                                            }, 10);
                                                                                        }
                                                                                    }}
                                                                                    className={cn(
                                                                                        "px-3 py-1.5 rounded-lg border shadow-sm flex flex-col items-center transition-all",
                                                                                        isSelected
                                                                                            ? "bg-orange-500 border-orange-600 scale-105"
                                                                                            : "bg-white dark:bg-zinc-900 border-orange-200 dark:border-orange-800/50 hover:border-orange-400"
                                                                                    )}
                                                                                >
                                                                                    <span className={cn("text-[10px] font-bold", isSelected ? "text-orange-100" : "text-zinc-400")}>Hole</span>
                                                                                    <span className={cn("text-sm font-black", isSelected ? "text-white" : "text-orange-600 dark:text-orange-400")}>{hn}</span>
                                                                                </button>
                                                                            );
                                                                        })}
                                                                        {validHoles.length === 0 && (
                                                                            <span className="text-[11px] text-zinc-400 italic">기록된 홀이 없습니다.</span>
                                                                        )}
                                                                    </div>

                                                                    {selectedHoleDetails && selectedHoleDetails.label === item.label && (
                                                                        <div
                                                                            className="mt-4 flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-4 pb-2"
                                                                            onScroll={(e) => {
                                                                                const container = e.currentTarget;
                                                                                const scrollLeft = container.scrollLeft;
                                                                                const width = container.offsetWidth;
                                                                                const index = Math.round(scrollLeft / (width + 16));
                                                                                if (validHoles[index] && selectedHoleDetails.holeNumber !== validHoles[index]) {
                                                                                    setSelectedHoleDetails({ holeNumber: validHoles[index], label: item.label });
                                                                                }
                                                                            }}
                                                                        >
                                                                            {validHoles.map((hn: number) => (
                                                                                <div key={hn} id={`hole-detail-${item.label}-${hn}`} className="w-full shrink-0 snap-center p-4 bg-white dark:bg-zinc-900 rounded-xl border border-orange-200 dark:border-orange-800/50 shadow-inner animate-in fade-in slide-in-from-left-2 duration-300">
                                                                                    <div className="flex items-center justify-between mb-3 border-b border-zinc-100 dark:border-zinc-800 pb-2">
                                                                                        <div className="flex items-center gap-2">
                                                                                            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{hn}번 홀 분석</span>
                                                                                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 uppercase">
                                                                                                Par {scoreData.result.find((h: any) => h.holeNumber === hn)?.par}
                                                                                            </span>
                                                                                        </div>
                                                                                        <button onClick={() => setSelectedHoleDetails(null)} className="text-zinc-400 hover:text-zinc-600">
                                                                                            <X size={14} />
                                                                                        </button>
                                                                                    </div>
                                                                                    <div className="space-y-4">
                                                                                        {getRelevantShots(hn, item.label).filter((shot: any) => shot.shotSG < 0).map((shot: any, sIdx: number) => {
                                                                                            const attemptPos = (shot.shotLabel || "").split('/')[0].trim().toUpperCase();
                                                                                            const landingPos = (shot.landingLabel || "").toUpperCase().trim();
                                                                                            const isPenalty = ["PA", "OB", "PS"].includes(landingPos);
                                                                                            const unit = (shot.shotLabel || "").toUpperCase().includes("GR") ? "m" : "m";
                                                                                            return (
                                                                                                <div key={sIdx} className="space-y-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-100 dark:border-zinc-800/50">
                                                                                                    <div className="flex items-center gap-4">
                                                                                                        <div className="flex items-center gap-1.5 w-12 shrink-0">
                                                                                                            <div className="w-1 h-3 bg-zinc-300 rounded-full" />
                                                                                                            <span className="text-[10px] font-bold text-zinc-400 uppercase">시도</span>
                                                                                                        </div>
                                                                                                        <p className="text-xs font-black text-zinc-800 dark:text-zinc-200">
                                                                                                            {(POS_MAP[attemptPos] || attemptPos).replace('그린 주변 어프로치', '어프로치').replace('그린 주변 벙커', '벙커')} {shot.attemptDistance > 0 ? `/ ${shot.attemptDistance}${unit}` : ""}
                                                                                                        </p>
                                                                                                    </div>
                                                                                                    <div className="flex items-center gap-4">
                                                                                                        <div className="flex items-center gap-1.5 w-12 shrink-0">
                                                                                                            <div className={cn("w-1 h-3 rounded-full", isPenalty ? "bg-red-500" : "bg-orange-500")} />
                                                                                                            <span className={cn("text-[10px] font-bold uppercase", isPenalty ? "text-red-500" : "text-zinc-400")}>
                                                                                                                {isPenalty ? "패널티" : "결과"}
                                                                                                            </span>
                                                                                                        </div>
                                                                                                        <p className={cn("text-xs font-black", isPenalty ? "text-red-600 dark:text-red-400" : "text-zinc-800 dark:text-zinc-200")}>
                                                                                                            {isPenalty ? "패널티" : (POS_MAP[landingPos] || landingPos).replace('그린 주변 어프로치', '어프로치').replace('그린 주변 벙커', '벙커')} {shot.remainingDistance > 0 ? `/ ${shot.remainingDistance}${unit}` : ""}
                                                                                                        </p>
                                                                                                    </div>
                                                                                                    <div className="flex items-center gap-4">
                                                                                                        <div className="flex items-center gap-1.5 w-12 shrink-0">
                                                                                                            <div className="w-1 h-3 bg-zinc-300 dark:bg-zinc-600 rounded-full" />
                                                                                                            <span className="text-[10px] font-bold text-zinc-400 uppercase">점수</span>
                                                                                                        </div>
                                                                                                        <p className={cn("text-xs font-black", shot.shotSG < 0 ? "text-red-500" : shot.shotSG > 0 ? "text-blue-500" : "text-zinc-800 dark:text-zinc-200")}>
                                                                                                            {shot.shotSG > 0 ? "+" : ""}{Number(shot.shotSG || 0).toFixed(1)}
                                                                                                        </p>
                                                                                                    </div>
                                                                                                </div>
                                                                                            );
                                                                                        })}
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </section>
                                    )}

                                    {/* 3. Challenge Point */}
                                    {scoreData && scoreData.challengePlan && scoreData.challengePlan.length > 0 && (
                                        <section className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 shadow-sm border border-zinc-200/60 dark:border-zinc-800/60">
                                            <div className="flex items-center gap-2 mb-6">
                                                <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-brand-navy dark:text-brand-navy-light shrink-0">
                                                    <TrendingDown size={18} />
                                                </div>
                                                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">CHALLENGE POINT</h2>
                                            </div>
                                            <div className="space-y-3">
                                                {scoreData.challengePlan.map((item: any) => {
                                                    const validHoles = item.holeNumbers.filter((hn: number) => getRelevantShots(hn, item.label).some((shot: any) => shot.shotSG > 0));
                                                    const isExpanded = selectedPlanLabel === item.label;
                                                    return (
                                                        <div key={item.label} className="space-y-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    if (isExpanded) {
                                                                        setSelectedPlanLabel(null);
                                                                        setSelectedHoleDetails(null);
                                                                    } else {
                                                                        setSelectedPlanLabel(item.label);
                                                                        if (validHoles && validHoles.length > 0) {
                                                                            setSelectedHoleDetails({ holeNumber: validHoles[0], label: item.label });
                                                                        } else {
                                                                            setSelectedHoleDetails(null);
                                                                        }
                                                                    }
                                                                }}
                                                                className={cn(
                                                                    "w-full bg-white dark:bg-zinc-900 border rounded-2xl flex items-center justify-center p-4 transition-all relative",
                                                                    isExpanded ? "border-sky-500 ring-1 ring-sky-500" : "border-zinc-200 dark:border-zinc-800 hover:border-sky-400"
                                                                )}
                                                            >
                                                                <span className="font-black text-[15px] sm:text-[17px] text-zinc-800 dark:text-zinc-200 block break-keep leading-tight text-center">{item.label}</span>
                                                                {isExpanded ? <ChevronUp size={16} className="text-zinc-400 absolute right-4" /> : <ChevronDown size={16} className="text-zinc-400 absolute right-4" />}
                                                            </button>
                                                            {isExpanded && (
                                                                <div className="px-4 py-3 bg-sky-50 dark:bg-sky-900/10 border border-sky-100 dark:border-sky-900/30 rounded-2xl animate-in slide-in-from-top-2 duration-200">
                                                                    <div className="grid grid-cols-5 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
                                                                        {validHoles.map((hn: number) => {
                                                                            const isSelected = selectedHoleDetails?.holeNumber === hn && selectedHoleDetails?.label === item.label;
                                                                            return (
                                                                                <button
                                                                                    key={hn}
                                                                                    onClick={() => {
                                                                                        if (isSelected) {
                                                                                            setSelectedHoleDetails(null);
                                                                                        } else {
                                                                                            setSelectedHoleDetails({ holeNumber: hn, label: item.label });
                                                                                            setTimeout(() => {
                                                                                                const el = document.getElementById(`hole-detail-${item.label}-${hn}`);
                                                                                                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
                                                                                            }, 10);
                                                                                        }
                                                                                    }}
                                                                                    className={cn(
                                                                                        "px-3 py-1.5 rounded-lg border shadow-sm flex flex-col items-center transition-all",
                                                                                        isSelected
                                                                                            ? "bg-sky-500 border-sky-600 scale-105"
                                                                                            : "bg-white dark:bg-zinc-900 border-sky-200 dark:border-sky-800/50 hover:border-sky-400"
                                                                                    )}
                                                                                >
                                                                                    <span className={cn("text-[10px] font-bold", isSelected ? "text-sky-100" : "text-zinc-400")}>Hole</span>
                                                                                    <span className={cn("text-sm font-black", isSelected ? "text-white" : "text-sky-600 dark:text-sky-400")}>{hn}</span>
                                                                                </button>
                                                                            );
                                                                        })}
                                                                        {validHoles.length === 0 && (
                                                                            <span className="text-[11px] text-zinc-400 italic">기록된 홀이 없습니다.</span>
                                                                        )}
                                                                    </div>

                                                                    {selectedHoleDetails && selectedHoleDetails.label === item.label && (
                                                                        <div
                                                                            className="mt-4 flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-4 pb-2"
                                                                            onScroll={(e) => {
                                                                                const container = e.currentTarget;
                                                                                const scrollLeft = container.scrollLeft;
                                                                                const width = container.offsetWidth;
                                                                                const index = Math.round(scrollLeft / (width + 16));
                                                                                if (validHoles[index] && selectedHoleDetails.holeNumber !== validHoles[index]) {
                                                                                    setSelectedHoleDetails({ holeNumber: validHoles[index], label: item.label });
                                                                                }
                                                                            }}
                                                                        >
                                                                            {validHoles.map((hn: number) => (
                                                                                <div key={hn} id={`hole-detail-${item.label}-${hn}`} className="w-full shrink-0 snap-center p-4 bg-white dark:bg-zinc-900 rounded-xl border border-sky-200 dark:border-sky-800/50 shadow-inner animate-in fade-in slide-in-from-left-2 duration-300">
                                                                                    <div className="flex items-center justify-between mb-3 border-b border-zinc-100 dark:border-zinc-800 pb-2">
                                                                                        <div className="flex items-center gap-2">
                                                                                            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{hn}번 홀 분석</span>
                                                                                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 uppercase">
                                                                                                Par {scoreData.result.find((h: any) => h.holeNumber === hn)?.par}
                                                                                            </span>
                                                                                        </div>
                                                                                        <button onClick={() => setSelectedHoleDetails(null)} className="text-zinc-400 hover:text-zinc-600">
                                                                                            <X size={14} />
                                                                                        </button>
                                                                                    </div>
                                                                                    <div className="space-y-4">
                                                                                        {getRelevantShots(hn, item.label).filter((shot: any) => shot.shotSG > 0).map((shot: any, sIdx: number) => {
                                                                                            const attemptPos = (shot.shotLabel || "").split('/')[0].trim().toUpperCase();
                                                                                            const landingPos = (shot.landingLabel || "").toUpperCase().trim();
                                                                                            const isPenalty = ["PA", "OB", "PS"].includes(landingPos);
                                                                                            const unit = (shot.shotLabel || "").toUpperCase().includes("GR") ? "m" : "m";
                                                                                            return (
                                                                                                <div key={sIdx} className="space-y-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-100 dark:border-zinc-800/50">
                                                                                                    <div className="flex items-center gap-4">
                                                                                                        <div className="flex items-center gap-1.5 w-12 shrink-0">
                                                                                                            <div className="w-1 h-3 bg-zinc-300 rounded-full" />
                                                                                                            <span className="text-[10px] font-bold text-zinc-400 uppercase">시도</span>
                                                                                                        </div>
                                                                                                        <p className="text-xs font-black text-zinc-800 dark:text-zinc-200">
                                                                                                            {(POS_MAP[attemptPos] || attemptPos).replace('그린 주변 어프로치', '어프로치').replace('그린 주변 벙커', '벙커')} {shot.attemptDistance > 0 ? `/ ${shot.attemptDistance}${unit}` : ""}
                                                                                                        </p>
                                                                                                    </div>
                                                                                                    <div className="flex items-center gap-4">
                                                                                                        <div className="flex items-center gap-1.5 w-12 shrink-0">
                                                                                                            <div className={cn("w-1 h-3 rounded-full", isPenalty ? "bg-red-500" : "bg-sky-500")} />
                                                                                                            <span className={cn("text-[10px] font-bold uppercase", isPenalty ? "text-red-500" : "text-zinc-400")}>
                                                                                                                {isPenalty ? "패널티" : "결과"}
                                                                                                            </span>
                                                                                                        </div>
                                                                                                        <p className={cn("text-xs font-black", isPenalty ? "text-red-600 dark:text-red-400" : "text-zinc-800 dark:text-zinc-200")}>
                                                                                                            {isPenalty ? "패널티" : (POS_MAP[landingPos] || landingPos).replace('그린 주변 어프로치', '어프로치').replace('그린 주변 벙커', '벙커')} {shot.remainingDistance > 0 ? `/ ${shot.remainingDistance}${unit}` : ""}
                                                                                                        </p>
                                                                                                    </div>
                                                                                                    <div className="flex items-center gap-4">
                                                                                                        <div className="flex items-center gap-1.5 w-12 shrink-0">
                                                                                                            <div className="w-1 h-3 bg-zinc-300 dark:bg-zinc-600 rounded-full" />
                                                                                                            <span className="text-[10px] font-bold text-zinc-400 uppercase">점수</span>
                                                                                                        </div>
                                                                                                        <p className={cn("text-xs font-black", shot.shotSG < 0 ? "text-red-500" : shot.shotSG > 0 ? "text-blue-500" : "text-zinc-800 dark:text-zinc-200")}>
                                                                                                            {shot.shotSG > 0 ? "+" : ""}{Number(shot.shotSG || 0).toFixed(1)}
                                                                                                        </p>
                                                                                                    </div>
                                                                                                </div>
                                                                                            );
                                                                                        })}
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </section>
                                    )}
                                </div>
                            )}

                            {!scoreData && !trainingData && (
                                <div className="text-center py-20">
                                    <BookOpen size={48} className="mx-auto text-zinc-300 mb-4" />
                                    <p className="text-zinc-500 font-medium">최근 참고할 데이터(스코어, 훈련 일지 등)가 없습니다.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}