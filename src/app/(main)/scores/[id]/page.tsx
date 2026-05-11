"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { calculateScorecardAnalysis, HoleAnalysis } from "@/lib/score-calculations";
import {
    ChevronLeft,
    MoreHorizontal,
    TrendingDown,
    Activity,
    Target,
    Zap,
    Flag,
    Info,
    BarChart3,
    Calendar,
    Trophy,
    User,
    Trophy as TrophyIcon,
    BookOpen,
    Edit3,
    Trash2,
    Search,
    Loader2,
    X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";

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
// ── Components ───────────────────────────────────────────────

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

const IndicatorCard = ({ label, value, unit, icon: Icon, colorClass = "text-brand-navy" }: { label: string; value: string | number; unit?: string; icon: any; colorClass?: string }) => (
    <div className="bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800/50 p-4 rounded-2xl flex flex-col justify-between h-full">
        <div className="flex items-center gap-1.5 mb-3 text-[12px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-tight">
            <Icon size={14} className="text-zinc-400 shrink-0" />
            {label}
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

const SectorChangeBadge = ({ type, value }: { type: string; value: string | number }) => {
    const valNum = Number(value);
    const isPositive = valNum > 0;
    const isZero = valNum === 0;
    // Blue for bad (pos), Red for good (neg)
    const colorClass = isPositive ? "text-blue-500" : isZero ? "text-zinc-900 dark:text-zinc-100" : "text-red-500";
    const bgClass = isPositive ? "bg-blue-50 dark:bg-blue-900/10" : isZero ? "bg-zinc-50 dark:bg-zinc-900/10" : "bg-red-50 dark:bg-red-900/10";

    return (
        <div className={cn("p-4 rounded-3xl flex flex-col justify-between gap-3 border border-zinc-100/50 dark:border-zinc-800/50", bgClass)}>
            <div className="w-full text-left">
                <span className="text-[12px] font-bold text-zinc-500 dark:text-zinc-400">{type}</span>
            </div>
            <div className="w-full text-center">
                <span className={cn("text-2xl font-black tracking-tighter", colorClass)}>
                    {isPositive ? `+${value}` : value}
                </span>
            </div>
        </div>
    );
};

// ── Page Component ───────────────────────────────────────────

export default function ScoreDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [mode, setMode] = useState<"score" | "contribution">("score");
    const [loading, setLoading] = useState(true);
    const [scorecard, setScorecard] = useState<any>(null);
    const [analysis, setAnalysis] = useState<HoleAnalysis[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [isMoreOpen, setIsMoreOpen] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [selectedPlanLabel, setSelectedPlanLabel] = useState<string | null>(null);
    const [selectedHoleDetails, setSelectedHoleDetails] = useState<{ holeNumber: number, label: string } | null>(null);

    const roundToTwo = (num: number | undefined) => {
        if (num === undefined || num === null) return "0";
        const val = Number(Math.round(Number(num + "e2")) + "e-2");
        // If it's a whole number, return without decimal points
        return val % 1 === 0 ? val.toString() : val.toFixed(2);
    };

    const getRelevantShots = (holeNumber: number, category: string) => {
        const hole = analysis.find(h => h.holeNumber === holeNumber);
        if (!hole) return [];

        const filtered = hole.shots.filter(s => {
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

        return filtered.filter((s, idx, arr) => {
            if (idx === 0) return true;
            const prev = arr[idx - 1];
            const prevLanding = (prev.landingLabel || "").toUpperCase().trim();
            const isPenalty = ["PA", "OB", "PS"].includes(prevLanding);
            if (isPenalty && s.attemptDistance === prev.attemptDistance) return false;
            return true;
        });
    };

    const handleDelete = async () => {
        if (!confirm("정말 이 스코어 기록을 삭제하시겠습니까?")) return;
        
        const supabase = createClient();
        const { error } = await supabase
            .from("scorecards")
            .delete()
            .eq("id", params.id);
            
        if (error) {
            alert("삭제 중 오류가 발생했습니다.");
            console.error(error);
        } else {
            router.push("/scores");
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            const id = Array.isArray(params.id) ? params.id[0] : params.id;
            const supabase = createClient();
            
            const { data: sc } = await supabase
                .from("scorecards")
                .select(`
                    id, round_date, course_name, total_score, distance_unit,
                    athlete:users!scorecards_athlete_id_fkey(name),
                    coach:users!scorecards_coach_id_fkey(name),
                    holes:scorecard_holes(
                        hole_number, par, score,
                        shots:scorecard_shots(*)
                    )
                `)
                .eq("id", id)
                .single();

            if (sc) {
                setScorecard(sc);
                try {
                    const result = await calculateScorecardAnalysis(id as string);
                    setAnalysis(result);
                    
                    const totalPoint = result.reduce((sum, h) => sum + h.totalSG, 0);
                    const teePoint = result.reduce((sum, h) => sum + (h.summary.distSG_DriverDist + h.summary.distSG_DriverAcc), 0);
                    const secondPoint = result.reduce((sum, h) => sum + (h.summary.distSG_180Plus + h.summary.distSG_150_179 + h.summary.distSG_120_149 + h.summary.distSG_90_119), 0);
                    const greenPoint = result.reduce((sum, h) => sum + (h.summary.distSG_Pitch31_89 + h.summary.distSG_Bunker + h.summary.distSG_Approach), 0);
                    const puttingPoint = result.reduce((sum, h) => sum + (h.summary.distSG_Putt9Plus + h.summary.distSG_Putt4_8 + h.summary.distSG_Putt2_3 + h.summary.distSG_Putt1), 0);

                    // SG Categories grouping
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

                    const totalAbsSG = cats.reduce((s, c) => s + Math.abs(c.sg), 0);
                    const categoriesWithPercent = cats.map(c => ({
                        ...c,
                        percent: totalAbsSG > 0 ? (Math.abs(c.sg) / totalAbsSG) * 100 : 0
                    })).sort((a, b) => a.sg - b.sg);

                    const teeSG = cats.filter(c => c.name === "티샷 비거리" || c.name === "티샷 정확도").reduce((s, c) => s + c.sg, 0);
                    const secondSG = cats.filter(c => ["180M이상", "150-179M", "120-149M", "90-119M"].includes(c.name)).reduce((s, c) => s + c.sg, 0);
                    const greenSG = cats.filter(c => ["피치샷", "벙커", "어프로치"].includes(c.name)).reduce((s, c) => s + c.sg, 0);
                    const puttingSG = cats.filter(c => ["9M이상", "4-8M", "2-3M", "1M"].includes(c.name)).reduce((s, c) => s + c.sg, 0);

                    const longSG = teeSG + secondSG; // 90M ~ 비거리,정확도 점수
                    const shortSG = greenSG + puttingSG; // 피치샷 ~ 1M 점수

                    // 1. 롱게임대비 숏게임 = (피치샷~1M 점수) - (90~비거리, 정확도 점수)
                    const longVsShort = shortSG - longSG;

                    // 2. 플레이 내용 = 스코어 + ((롱게임대비 숏게임 * -1) / 2)
                    const playContent = sc.total_score + ((longVsShort * -1) / 2);

                    // 3. 내용대비 스코어 = 스코어 - 플레이 내용
                    const scoreVsContent = sc.total_score - playContent;

                    const totalPutts = result.reduce((s, h) => s + h.summary.putts, 0);
                    const sumFirstPuttDist = result.reduce((s, h) => s + parseFloat(h.summary.firstPuttAttemptDist || "0"), 0);
                    const threePuttCount = result.filter(h => h.summary.putts >= 3).length;
                    const totalPA = result.reduce((s, h) => s + h.summary.paCount, 0);
                    const totalOB = result.reduce((s, h) => s + h.summary.obCount, 0);

                    const fwHoles = result.filter(h => h.summary.fairwayHit !== '-');
                    const fwHits = fwHoles.filter(h => h.summary.fairwayHit === 'O').length;
                    const fairwayHitRate = fwHoles.length > 0 ? (fwHits / fwHoles.length) * 100 : 0;

                    const girHits = result.filter(h => h.summary.gir === 'O').length;
                    const girRate = result.length > 0 ? (girHits / result.length) * 100 : 0;

                    // Segment & Par Type Scores
                    const getRelScore = (list: HoleAnalysis[]) => {
                        const s = list.reduce((acc, h) => acc + (h.score - h.par), 0);
                        if (s === 0) return "0";
                        return (s > 0 ? "+" : "") + s;
                    };

                    const score1_3 = getRelScore(result.slice(0, 3));
                    const score4_15 = getRelScore(result.slice(3, 15));
                    const score16_18 = getRelScore(result.slice(15, 18));
                    const scorePar3 = getRelScore(result.filter(h => h.par === 3));
                    const scorePar4 = getRelScore(result.filter(h => h.par === 4));
                    const scorePar5 = getRelScore(result.filter(h => h.par === 5));

                    // Average Remaining Distance stats
                    const distStats: Record<string, { sum: number; count: number }> = {
                        "티샷": { sum: 0, count: 0 },
                        "180M이상": { sum: 0, count: 0 },
                        "150-179M": { sum: 0, count: 0 },
                        "120-149M": { sum: 0, count: 0 },
                        "90-119M": { sum: 0, count: 0 },
                        "피치샷": { sum: 0, count: 0 },
                        "벙커": { sum: 0, count: 0 },
                        "어프로치": { sum: 0, count: 0 },
                        "9M이상": { sum: 0, count: 0 },
                        "4-8M": { sum: 0, count: 0 },
                        "2-3M": { sum: 0, count: 0 },
                        "1M": { sum: 0, count: 0 },
                    };

                    result.forEach(h => {
                        h.shots.forEach(r => {
                            const label = r.shotLabel.split('/')[0].trim().toUpperCase();
                            const dist = r.attemptDistance;
                            const rem = r.remainingDistance;
                            const landing = (r.landingLabel || "").toUpperCase().trim();

                            // EXCLUDE penalties from distance stats (PA, OB, PS)
                            if (["PA", "OB", "PS"].includes(landing)) return;

                            // Tee Shot (Par 4 only)
                            if (label === 'TE' && h.par === 4) {
                                distStats["티샷"].sum += rem;
                                distStats["티샷"].count++;
                            }

                            // Distance categories (Non-green, non-bunker, dist > 0)
                            if (label !== 'GR' && label !== 'GB' && dist > 0) {
                                if (dist >= 180) { distStats["180M이상"].sum += rem; distStats["180M이상"].count++; }
                                else if (dist >= 150) { distStats["150-179M"].sum += rem; distStats["150-179M"].count++; }
                                else if (dist >= 120) { distStats["120-149M"].sum += rem; distStats["120-149M"].count++; }
                                else if (dist >= 90) { distStats["90-119M"].sum += rem; distStats["90-119M"].count++; }
                                else if (dist >= 31) { distStats["피치샷"].sum += rem; distStats["피치샷"].count++; }
                            }
                            
                            if (label === 'GB') { distStats["벙커"].sum += rem; distStats["벙커"].count++; }

                            if (label !== 'GR' && label !== 'GB' && label !== 'TE' && dist > 0 && dist <= 30) {
                                distStats["어프로치"].sum += rem; distStats["어프로치"].count++;
                            }

                            if (label === 'GR') {
                                if (dist >= 9) { distStats["9M이상"].sum += rem; distStats["9M이상"].count++; }
                                else if (dist >= 4) { distStats["4-8M"].sum += rem; distStats["4-8M"].count++; }
                                else if (dist >= 2) { distStats["2-3M"].sum += rem; distStats["2-3M"].count++; }
                                else if (dist === 1) { distStats["1M"].sum += rem; distStats["1M"].count++; }
                            }
                        });
                    });

                    const avgRemainingDists = Object.entries(distStats).map(([label, stat]) => ({
                        label: `${label} (${stat.count})`,
                        value: stat.count > 0 ? (stat.sum / stat.count).toFixed(1) : "-"
                    }));

                    // Points
                    const strongPoint = [...cats].sort((a, b) => a.sg - b.sg)[0]?.name || "-";
                    const positiveCats = categoriesWithPercent.filter(c => c.sg > 0).sort((a, b) => b.percent - a.percent);
                    const challengePoint1 = positiveCats[0]?.name || "-";
                    const challengePoint2 = positiveCats[1]?.name || "-";

                    setSummary({
                        totalPoint,
                        teePoint,
                        secondPoint,
                        greenPoint,
                        puttingPoint,
                        playContent,
                        scoreVsContent,
                        longVsShort,
                        totalPutts,
                        avgFirstPuttDist: result.length > 0 ? sumFirstPuttDist / result.length : 0,
                        threePuttCount,
                        penaltyCount: totalPA + totalOB,
                        fairwayHitRate,
                        girRate,
                        score1_3,
                        score4_15,
                        score16_18,
                        scorePar3,
                        scorePar4,
                        scorePar5,
                        avgRemainingDists,
                        sectorChanges: [
                            { type: "티샷", value: roundToTwo(teeSG) },
                            { type: "세컨샷", value: roundToTwo(secondSG) },
                            { type: "그린주변샷", value: roundToTwo(greenSG) },
                            { type: "퍼팅", value: roundToTwo(puttingSG) }
                        ],
                        contributions: categoriesWithPercent,
                        strongPoint,
                        challengePoint1,
                        challengePoint2,
                        trainingPlan: positiveCats.slice(0, 5).map((c, i) => {
                            const fieldName = CATEGORY_TO_FIELD[c.name];
                            const holeNumbers = result
                                .filter(h => (h.summary as any)[fieldName] > 0)
                                .map(h => h.holeNumber);

                            return {
                                rank: `${i + 1}순위`,
                                label: c.name,
                                pct: Math.round(c.percent),
                                time: [35, 25, 25, 20, 10, 5][i] || 5,
                                color: ["bg-red-500", "bg-orange-500", "bg-emerald-500", "bg-blue-500", "bg-indigo-500", "bg-purple-500"][i] || "bg-zinc-500",
                                holeNumbers
                            };
                        })
                    });

                } catch (err) {
                    console.error("Calculation error:", err);
                }
            }

            // Fetch user role
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase
                    .from("users")
                    .select("role")
                    .eq("id", user.id)
                    .single();
                if (profile) setUserRole(profile.role);
            }

            setLoading(false);
        };
        fetchData();
    }, [params.id]);

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
            <Loader2 className="w-8 h-8 text-brand-navy animate-spin" />
        </div>
    );

    if (!scorecard || !summary) return <div className="p-20 text-center">데이터를 찾을 수 없습니다.</div>;

    const data = {
        player: scorecard.athlete?.name || "선수",
        coach: scorecard.coach?.name || "코치",
        date: scorecard.round_date.replace(/-/g, "."),
        title: scorecard.course_name,
        totalScore: scorecard.total_score || analysis.reduce((s, h) => s + h.score, 0),
        summary: {
            totalPoint: summary.totalPoint,
            teePoint: summary.teePoint,
            secondPoint: summary.secondPoint,
            greenPoint: summary.greenPoint,
            puttingPoint: summary.puttingPoint,
            playContent: roundToTwo(summary.playContent),
            scoreVsContent: (summary.scoreVsContent > 0 ? "+" : "") + roundToTwo(summary.scoreVsContent),
            longVsShort: (summary.longVsShort > 0 ? "+" : "") + roundToTwo(summary.longVsShort)
        },
        avgMetrics: [
            { label: "페어웨이 안착률", value: roundToTwo(summary.fairwayHitRate), unit: "%" },
            { label: "그린 적중률", value: roundToTwo(summary.girRate), unit: "%" },
            { label: "퍼트수", value: summary.totalPutts, unit: "개" },
            { label: "평균 첫 퍼트 거리", value: roundToTwo(summary.avgFirstPuttDist), unit: "m" },
            { label: "3퍼트 이상", value: summary.threePuttCount, unit: "회" },
            { label: "패널티/OB", value: summary.penaltyCount, unit: "개" }
        ],
        sectorChanges: summary.sectorChanges,
        contributions: summary.contributions,
        trainingPlan: summary.trainingPlan,
        avgRemainingDists: summary.avgRemainingDists,
        holes: analysis.map(h => ({
            hole: h.holeNumber,
            par: h.par,
            score: h.score,
            fairway: h.summary.fairwayHit,
            gir: h.summary.gir,
            girDist: h.summary.onGreenAttemptDist,
            appDist: h.summary.approachAttemptDist,
            bunkerDist: h.summary.bunkerAttemptDist,
            putt1st: h.summary.firstPuttAttemptDist,
            putts: h.summary.putts,
            appReview: h.summary.putts >= 3 || h.summary.approachAttemptDist !== "",
            summary: h.summary
        }))
    };

    return (
        <div className="min-h-screen bg-[#F8F9FC] dark:bg-zinc-950 pb-24">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200/60 dark:border-zinc-800/60">
                <div className="max-w-3xl lg:max-w-6xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-50 transition-colors">
                            <ChevronLeft size={24} />
                        </button>
                        <div className="flex items-center gap-2">
                            <BarChart3 size={20} className="text-brand-navy dark:text-brand-navy-light shrink-0" />
                            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">스코어 상세</h1>
                            {userRole === "admin" && (
                                <button
                                    onClick={() => router.push(`/scores/review/${params.id}`)}
                                    className="ml-2 px-3 py-1.5 rounded-full bg-brand-navy text-white text-[11px] font-bold hover:bg-brand-navy/90 transition-all shadow-sm flex items-center gap-1.5"
                                >
                                    <Search size={14} />
                                    상세 분석
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="relative">
                        <button 
                            onClick={() => setIsMoreOpen(!isMoreOpen)}
                            className="p-2 -mr-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                        >
                            <MoreHorizontal size={20} />
                        </button>

                        {isMoreOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsMoreOpen(false)} />
                                <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in duration-200">
                                    <button
                                        onClick={() => router.push(`/scores/create?id=${params.id}`)}
                                        className="w-full px-4 py-3 text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2 transition-colors border-b border-zinc-100 dark:border-zinc-800"
                                    >
                                        <Edit3 size={16} />
                                        수정하기
                                    </button>
                                    <button
                                        onClick={handleDelete}
                                        className="w-full px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors"
                                    >
                                        <Trash2 size={16} />
                                        삭제하기
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-3xl lg:max-w-6xl mx-auto px-4 sm:px-8 py-6 space-y-6">

                {/* ── 1. Header Card ── */}
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm space-y-4">
                    <div className="flex items-center gap-2">
                        <span className="text-zinc-500 text-sm font-medium flex items-center gap-1.5">
                            <Calendar size={16} className="text-zinc-400" />
                            {data.date.replace(/\./g, "-")}
                        </span>
                    </div>

                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 leading-tight">
                        {data.title}
                    </h2>

                    <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center">
                        <div className="flex-1 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500">
                                <User size={20} />
                            </div>
                            <div>
                                <p className="text-[11px] text-zinc-400 font-medium">담당 코치</p>
                                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{data.coach}</p>
                            </div>
                        </div>
                        <div className="w-px h-10 bg-zinc-100 dark:bg-zinc-800 mx-4"></div>
                        <div className="flex-1 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500">
                                <User size={20} />
                            </div>
                            <div>
                                <p className="text-[11px] text-zinc-400 font-medium">선수</p>
                                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{data.player}</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Total Score Card */}
                <div className="relative overflow-hidden bg-brand-navy text-white p-6 rounded-[2.5rem] shadow-lg shadow-brand-navy/10 border border-white/10 h-32 flex items-center">
                    <div className="absolute right-[-10px] top-[-10px] opacity-10">
                        <Activity size={100} />
                    </div>
                    <div className="relative z-10 flex items-center justify-center w-full">
                        <div className="absolute left-0">
                            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-brand-navy-light/60">Score</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black tracking-tighter">{data.totalScore}</span>
                            <TrendingDown size={22} className="text-brand-navy-light/80" />
                        </div>
                    </div>
                </div>

                {/* Summary Boxes */}
                <div className="grid grid-cols-3 gap-3 sm:gap-5">
                    <SummaryBox label={<>플레이<br />내용</>} value={data.summary.playContent} icon={Flag} />
                    <SummaryBox label={<>내용<br />대비<br />스코어</>} value={data.summary.scoreVsContent} icon={Target} />
                    <SummaryBox label={<>롱게임<br />대비<br />숏게임</>} value={data.summary.longVsShort} icon={Zap} />
                </div>

                {/* 주요 평균 지표 */}
                <section className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 shadow-sm border border-zinc-200/60 dark:border-zinc-800/60">
                    <SectionHeader title="주요 평균 지표" icon={TrendingDown} />
                    <div className="grid grid-cols-2 gap-4">
                        {data.avgMetrics.map((m, idx) => (
                            <IndicatorCard key={idx} label={m.label} value={m.value} unit={m.unit} icon={Activity} />
                        ))}
                    </div>
                </section>

                {/* 부문별 스코어 */}
                <section className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 shadow-sm border border-zinc-200/60 dark:border-zinc-800/60">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400">
                                <Target size={18} />
                            </div>
                            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">부문별 스코어</h2>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {data.sectorChanges.map((sc: any, idx: number) => (
                            <SectorChangeBadge key={idx} type={sc.type} value={sc.value} />
                        ))}
                    </div>
                </section>


                {/* 부문별 분석 지수 (Diverging Bar Chart) */}
                <section className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-7 shadow-sm border border-zinc-200/60 dark:border-zinc-800/60">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400">
                                <BarChart3 size={18} />
                            </div>
                            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">부문별 세부 항목</h2>
                        </div>
                        <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl shrink-0">
                            <button
                                onClick={() => setMode("score")}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all",
                                    mode === "score" ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-50" : "text-zinc-400 hover:text-zinc-600"
                                )}
                            >
                                점수
                            </button>
                            <button
                                onClick={() => setMode("contribution")}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all",
                                    mode === "contribution" ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-50" : "text-zinc-400 hover:text-zinc-600"
                                )}
                            >
                                기여도
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4 pt-2 relative">
                        {/* Center vertical line for Score mode or Left line for Contribution mode */}
                        {mode === "score" ? (
                            <div className="absolute top-0 bottom-0 left-[64%] w-[2px] bg-zinc-200 dark:bg-zinc-700 z-0" />
                        ) : (
                            <div className="absolute top-0 bottom-0 left-[28%] w-[2px] bg-zinc-200 dark:bg-zinc-700 z-0" />
                        )}

                        {[...data.contributions].sort((a: any, b: any) => {
                            if (mode === "score") return a.sg - b.sg;
                            return a.percent - b.percent;
                        }).map((item: any, idx: number) => {
                            const val = mode === "score" ? item.sg : item.percent;
                            const absVal = Math.abs(val);
                            const maxVal = mode === "score" ? 2.0 : 40; // Scale
                            const widthPct = Math.min((absVal / maxVal) * 45, 45);

                            return (
                                <div key={idx} className="relative z-10 flex items-center h-8">
                                    <div className="w-[28%] flex justify-end pr-2 sm:pr-4">
                                        <span className="text-[11px] sm:text-[13px] font-bold text-zinc-600 dark:text-zinc-400 truncate bg-white dark:bg-zinc-900">{item.name}</span>
                                    </div>

                                    <div className="flex-1 relative h-full flex items-center">
                                        <div className="w-full h-full flex items-center relative">
                                            {mode === "score" ? (
                                                item.sg < 0 ? (
                                                    <>
                                                        <div className="absolute top-0 bottom-0 flex items-center right-[50%]" style={{ width: `${widthPct}%` }}>
                                                            <div className="h-6 bg-red-500 rounded-sm w-full" />
                                                        </div>
                                                        <span className="absolute left-[52%] text-[11px] font-black text-red-500 whitespace-nowrap z-30">
                                                            {roundToTwo(item.sg)}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="absolute top-0 bottom-0 flex items-center left-[50%]" style={{ width: `${widthPct}%` }}>
                                                            <div className="h-6 bg-blue-500 rounded-sm w-full" />
                                                        </div>
                                                        <span className="absolute right-[52%] text-[11px] font-black text-blue-500 whitespace-nowrap z-30 text-right">
                                                            +{roundToTwo(item.sg)}
                                                        </span>
                                                    </>
                                                )
                                            ) : (
                                                /* Contribution Mode: Left Aligned */
                                                <div className="absolute top-0 bottom-0 flex items-center left-0" style={{ width: "100%" }}>
                                                    <div className={cn("h-6 rounded-sm shadow-sm", item.sg < 0 ? "bg-red-500" : "bg-blue-500")} style={{ width: `${item.percent * 2.2}%` }} />
                                                    <span className={cn("ml-3 text-[11px] font-black whitespace-nowrap", item.sg < 0 ? "text-red-500" : "text-blue-500")}>
                                                        {Math.round(item.percent * 10) / 10}%
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* ── 4. Segment & Par Type Scores (New) ── */}
                <section className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 shadow-sm border border-zinc-200/60 dark:border-zinc-800/60">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400">
                            <Activity size={18} />
                        </div>
                        <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">구간/타입별 스코어</h2>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Left Column: Segments */}
                        <div className="space-y-4">
                            {[
                                { label: "1~3홀", value: summary.score1_3 },
                                { label: "4~15홀", value: summary.score4_15 },
                                { label: "16~18홀", value: summary.score16_18 },
                            ].map((item, idx) => {
                                const valNum = parseInt(item.value);
                                const colorClass = valNum > 0 ? "text-blue-500" : valNum < 0 ? "text-red-500" : "text-zinc-900 dark:text-zinc-100";
                                return (
                                    <div key={idx} className="bg-zinc-50/50 dark:bg-zinc-900/50 p-5 rounded-[2rem] border border-zinc-100 dark:border-zinc-800/50 flex flex-col justify-between min-h-[110px]">
                                        <p className="text-[12px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-tight">{item.label}</p>
                                        <div className="text-right pr-4 pb-2">
                                            <p className={cn("text-2xl font-black tracking-tighter", colorClass)}>{item.value}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {/* Right Column: Par Types */}
                        <div className="space-y-4">
                            {[
                                { label: "PAR 3", value: summary.scorePar3 },
                                { label: "PAR 4", value: summary.scorePar4 },
                                { label: "PAR 5", value: summary.scorePar5 },
                            ].map((item, idx) => {
                                const valNum = parseInt(item.value);
                                const colorClass = valNum > 0 ? "text-blue-500" : valNum < 0 ? "text-red-500" : "text-zinc-900 dark:text-zinc-100";
                                return (
                                    <div key={idx} className="bg-zinc-50/50 dark:bg-zinc-900/50 p-5 rounded-[2rem] border border-zinc-100 dark:border-zinc-800/50 flex flex-col justify-between min-h-[110px]">
                                        <p className="text-[12px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-tight">{item.label}</p>
                                        <div className="text-right pr-4 pb-2">
                                            <p className={cn("text-2xl font-black tracking-tighter", colorClass)}>{item.value}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* ── 5. 평균 남은 거리 (New) ── */}
                <section className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 shadow-sm border border-zinc-200/60 dark:border-zinc-800/60">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400">
                            <Target size={18} />
                        </div>
                        <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">평균 남은 거리 (m)</h2>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {data.avgRemainingDists.map((item: any, idx: number) => (
                            <div key={idx} className="bg-zinc-50/50 dark:bg-zinc-900/50 p-5 rounded-[2rem] border border-zinc-100 dark:border-zinc-800/50 flex flex-col justify-between min-h-[110px]">
                                <p className="text-[12px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-tight">{item.label}</p>
                                <div className="text-right pb-2">
                                    <p className="text-2xl font-black text-brand-navy dark:text-brand-navy-light tracking-tighter">{item.value}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 text-right">
                        <span className="text-[10px] font-bold text-zinc-400">* 티샷은 PAR4만 적용</span>
                    </div>
                </section>

                {/* Strong / Challenge Points */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-7 shadow-sm border border-zinc-200/60 dark:border-zinc-800/60 flex flex-col items-start justify-center gap-1">
                        <div className="flex items-center gap-2 mb-2">
                            <TrophyIcon size={18} className="text-red-500" />
                            <span className="text-[12px] font-black uppercase tracking-tight text-zinc-500 dark:text-zinc-400">Strong Point</span>
                        </div>
                        <h3 className="w-full text-left text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tighter leading-tight mt-2">{summary.strongPoint}</h3>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-7 shadow-sm border border-zinc-200/60 dark:border-zinc-800/60 flex flex-col items-start justify-center gap-1">
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingDown size={18} className="text-brand-navy dark:text-brand-navy-light" />
                            <span className="text-[12px] font-black uppercase tracking-tight text-zinc-500 dark:text-zinc-400">Challenge Point</span>
                        </div>
                        <div className="space-y-4 flex flex-col items-start w-full">
                            <div className="flex items-center gap-4">
                                <span className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[12px] font-black text-zinc-500 shrink-0">1</span>
                                <span className="text-[20px] font-black text-zinc-800 dark:text-zinc-200 tracking-tight">{summary.challengePoint1}</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[12px] font-black text-zinc-500 shrink-0">2</span>
                                <span className="text-[20px] font-black text-zinc-800 dark:text-zinc-200 tracking-tight">{summary.challengePoint2}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 트레이닝 플랜 */}
                <section className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 shadow-sm border border-zinc-200/60 dark:border-zinc-800/60">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400">
                                <Calendar size={18} />
                            </div>
                            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">트레이닝 플랜</h2>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                            <Info size={12} className="text-zinc-400" />
                            <span className="text-[10px] font-bold text-zinc-500">총 2시간</span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {data.trainingPlan.map((item: any, idx: number) => {
                            const borderColor = item.color.replace('bg-', 'border-l-');
                            const isExpanded = selectedPlanLabel === item.label;
                            const isBig = idx < 2;

                            return (
                                <div key={idx} className="space-y-2">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedPlanLabel(isExpanded ? null : item.label)}
                                        className={cn(
                                            "w-full bg-zinc-50/50 dark:bg-zinc-800/50 border border-zinc-100/60 dark:border-zinc-800 border-l-4 rounded-2xl flex items-center justify-between transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800/80",
                                            borderColor,
                                            isBig ? "p-6" : "p-4",
                                            isExpanded && "ring-2 ring-orange-400 ring-offset-2 dark:ring-offset-zinc-950"
                                        )}
                                    >
                                        <div className="flex items-center gap-3 w-20">
                                            <span className={cn("text-[11px] font-black px-2 py-0.5 rounded text-white tracking-tight shrink-0", item.color, isBig && "text-[12px] px-3 py-1")}>{item.rank}</span>
                                        </div>
                                        <div className="flex-1 text-center flex flex-col items-center">
                                            <span className={cn("font-black text-zinc-800 dark:text-zinc-200", isBig ? "text-[17px]" : "text-[14px]")}>{item.label}</span>
                                        </div>
                                        <div className="flex items-center justify-end gap-2 w-20">
                                            <div className="flex items-baseline gap-0.5">
                                                <span className={cn("font-black text-zinc-900 dark:text-zinc-50 tracking-tighter", isBig ? "text-2xl" : "text-lg")}>{item.time}</span>
                                                <span className="text-[10px] font-bold text-zinc-400">분</span>
                                            </div>
                                            {isExpanded ? <ChevronUp size={16} className="text-zinc-400" /> : <ChevronDown size={16} className="text-zinc-400" />}
                                        </div>
                                    </button>

                                    {isExpanded && (
                                        <div className="px-4 py-3 bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 rounded-2xl animate-in slide-in-from-top-2 duration-200">
                                            <div className="mb-2">
                                                <span className="text-[11px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-tighter">집중 관리 홀</span>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {item.holeNumbers.map((hn: number) => {
                                                    const isSelected = selectedHoleDetails?.holeNumber === hn && selectedHoleDetails?.label === item.label;
                                                    return (
                                                        <button
                                                            key={hn}
                                                            onClick={() => setSelectedHoleDetails(isSelected ? null : { holeNumber: hn, label: item.label })}
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
                                                {item.holeNumbers.length === 0 && (
                                                    <span className="text-[11px] text-zinc-400 italic">기록된 홀이 없습니다.</span>
                                                )}
                                            </div>

                                            {/* Shot Details for selected hole */}
                                            {selectedHoleDetails && selectedHoleDetails.label === item.label && (
                                                <div className="mt-4 p-4 bg-white dark:bg-zinc-900 rounded-xl border border-orange-200 dark:border-orange-800/50 shadow-inner animate-in fade-in slide-in-from-left-2 duration-300">
                                                    <div className="flex items-center justify-between mb-3 border-b border-zinc-100 dark:border-zinc-800 pb-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{selectedHoleDetails.holeNumber}번 홀 분석</span>
                                                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 uppercase">
                                                                Par {analysis.find(h => h.holeNumber === selectedHoleDetails.holeNumber)?.par}
                                                            </span>
                                                        </div>
                                                        <button onClick={() => setSelectedHoleDetails(null)} className="text-zinc-400 hover:text-zinc-600">
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                    <div className="space-y-4">                                                        {getRelevantShots(selectedHoleDetails.holeNumber, item.label).map((shot: any, sIdx: number) => {
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
                                                                            {POS_MAP[attemptPos] || attemptPos} {shot.attemptDistance > 0 ? `/ ${shot.attemptDistance}${unit}` : ""}
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
                                                                            {isPenalty ? "패널티" : (POS_MAP[landingPos] || landingPos)} {shot.remainingDistance > 0 ? `/ ${shot.remainingDistance}${unit}` : ""}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>




                {/* Score Card */}
                <section className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 shadow-sm border border-zinc-200/60 dark:border-zinc-800/60 overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400">
                                <BookOpen size={18} />
                            </div>
                            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">Score Card</h2>
                        </div>

                        {/* Legend */}
                        <div className="flex flex-wrap items-center justify-end gap-3 text-[10px] font-bold">
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded-full border-2 border-yellow-400" />
                                <span className="text-zinc-400">이글 이하</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded-full border-2 border-orange-400" />
                                <span className="text-zinc-400">버디</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 border-2 border-blue-500" />
                                <span className="text-zinc-400">보기</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 border-2 border-blue-300" />
                                <span className="text-zinc-400">더블보기 이상</span>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto -mx-6 pb-2 scrollbar-hide">
                        <table className="w-full min-w-[1000px] lg:min-w-0 border-separate border-spacing-0 text-center">
                            <thead>
                                <tr className="text-[10px] font-black text-zinc-600 dark:text-zinc-400 uppercase tracking-tighter">
                                    <th className="sticky left-0 z-30 py-2 px-1 bg-white dark:bg-zinc-900 border-y border-zinc-100 dark:border-zinc-800 w-24 sm:w-28 text-left pl-6 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)]">Hole</th>
                                    {data.holes.map(h => {
                                        const fieldName = selectedPlanLabel ? CATEGORY_TO_FIELD[selectedPlanLabel] : null;
                                        const isHighlighted = fieldName && (h.summary as any)[fieldName] > 0;
                                        return (
                                            <th key={h.hole} className={cn(
                                                "py-2 px-0.5 sm:px-1 text-[11px] font-black border-y border-zinc-100 dark:border-zinc-800 transition-colors",
                                                isHighlighted ? "bg-orange-500 text-white" : "text-zinc-900 dark:text-zinc-50 bg-white dark:bg-zinc-950"
                                            )}>
                                                {h.hole}
                                            </th>
                                        );
                                    })}
                                    <th className="py-2 px-2 text-[11px] font-black text-brand-navy dark:text-brand-navy-light border-y border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/80 pr-6">총계</th>
                                </tr>
                            </thead>
                            <tbody className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                                <tr className="border-b border-zinc-50 dark:border-zinc-800/50">
                                    <td className="sticky left-0 z-30 py-2 px-1 text-[10px] font-black text-zinc-800 dark:text-zinc-200 tracking-tighter bg-white dark:bg-zinc-900 text-left pl-6 uppercase border-b border-zinc-50 dark:border-zinc-800/50 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)]">PAR</td>
                                    {data.holes.map(h => {
                                        const fieldName = selectedPlanLabel ? CATEGORY_TO_FIELD[selectedPlanLabel] : null;
                                        const isHighlighted = fieldName && (h.summary as any)[fieldName] > 0;
                                        return (
                                            <td key={h.hole} className={cn(
                                                "py-2 px-1 font-black border-b border-zinc-50 dark:border-zinc-800/50 transition-colors",
                                                isHighlighted ? "bg-orange-100 dark:bg-orange-900/40" : "bg-white dark:bg-zinc-950"
                                            )}>
                                                {h.par}
                                            </td>
                                        );
                                    })}
                                    <td className="py-2 px-2 font-black border-b border-zinc-50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-800/50 text-brand-navy pr-6">{data.holes.reduce((s, h) => s + h.par, 0)}</td>
                                </tr>
                                <tr className="border-b border-zinc-50 dark:border-zinc-800/50">
                                    <td className="sticky left-0 z-30 py-3 px-1 text-[10px] font-black text-zinc-900 dark:text-zinc-100 tracking-tighter bg-white dark:bg-zinc-900 text-left pl-6 uppercase border-b border-zinc-50 dark:border-zinc-800/50 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)]">스코어</td>
                                    {data.holes.map(h => {
                                        const fieldName = selectedPlanLabel ? CATEGORY_TO_FIELD[selectedPlanLabel] : null;
                                        const isHighlighted = fieldName && (h.summary as any)[fieldName] > 0;
                                        const diff = h.score - h.par;
                                        const shape = diff <= -1 ? "rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" :
                                                      diff === 1 ? "border-2 border-zinc-200 dark:border-zinc-700 rounded-sm" :
                                                      diff >= 2 ? "border-2 border-zinc-200 dark:border-zinc-700 rounded-sm bg-zinc-50 dark:bg-zinc-800" : "";

                                        return (
                                            <td key={h.hole} className={cn(
                                                "py-2 px-0 border-b border-zinc-50 dark:border-zinc-800/50 transition-colors",
                                                isHighlighted ? "bg-orange-100 dark:bg-orange-900/40" : "bg-white dark:bg-zinc-950"
                                            )}>
                                                <div className={cn("inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 font-black", shape)}>
                                                    {h.score}
                                                </div>
                                            </td>
                                        );
                                    })}
                                    <td className="py-2 px-2 font-black border-b border-zinc-50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-800/50 text-brand-navy pr-6">{data.holes.reduce((s, h) => s + h.score, 0)}</td>
                                </tr>
                                <tr className="border-b border-zinc-50 dark:border-zinc-800/50">
                                    <td className="sticky left-0 z-30 py-2 px-1 text-[10px] font-black text-zinc-900 dark:text-zinc-100 tracking-tighter bg-white dark:bg-zinc-900 text-left pl-6 uppercase border-b border-zinc-50 dark:border-zinc-800/50 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)]">페어웨이</td>
                                    {data.holes.map(h => {
                                        const fieldName = selectedPlanLabel ? CATEGORY_TO_FIELD[selectedPlanLabel] : null;
                                        const isHighlighted = fieldName && (h.summary as any)[fieldName] > 0;
                                        return (
                                            <td key={h.hole} className={cn(
                                                "py-2 px-1 font-black border-b border-zinc-50 dark:border-zinc-800/50 transition-colors",
                                                isHighlighted ? "bg-orange-100 dark:bg-orange-900/40" : "bg-white dark:bg-zinc-950"
                                            )}>
                                                {h.fairway}
                                            </td>
                                        );
                                    })}
                                    <td className="py-2 px-2 font-black border-b border-zinc-50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-800/50 text-brand-navy pr-6">
                                        {Math.round((data.holes.filter(h => h.fairway === "O").length / data.holes.filter(h => h.fairway !== "-").length) * 100)}%
                                    </td>
                                </tr>
                                <tr className="border-b border-zinc-50 dark:border-zinc-800/50">
                                    <td className="sticky left-0 z-30 py-2 px-1 text-[10px] font-black text-zinc-900 dark:text-zinc-100 tracking-tighter bg-white dark:bg-zinc-900 text-left pl-6 uppercase leading-tight border-b border-zinc-50 dark:border-zinc-800/50 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)]">온그린시도</td>
                                    {data.holes.map(h => {
                                        const fieldName = selectedPlanLabel ? CATEGORY_TO_FIELD[selectedPlanLabel] : null;
                                        const isHighlighted = fieldName && (h.summary as any)[fieldName] > 0;
                                        return (
                                            <td key={h.hole} className={cn(
                                                "py-2 px-1 border-b border-zinc-50 dark:border-zinc-800/50 transition-colors",
                                                isHighlighted ? "bg-orange-100 dark:bg-orange-900/40" : "bg-white dark:bg-zinc-950"
                                            )}>
                                                {h.girDist}
                                            </td>
                                        );
                                    })}
                                    <td className="py-2 px-2 font-black border-b border-zinc-50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-800/50 text-brand-navy pr-6">
                                        {(() => {
                                            const valid = data.holes.filter(h => h.girDist && h.girDist !== "-");
                                            return valid.length > 0 ? Math.round(valid.reduce((s, h) => s + parseFloat(h.girDist as string), 0) / valid.length) : "-";
                                        })()}
                                    </td>
                                </tr>
                                <tr className="border-b border-zinc-50 dark:border-zinc-800/50">
                                    <td className="sticky left-0 z-30 py-2 px-1 text-[10px] font-black text-zinc-900 dark:text-zinc-100 tracking-tighter bg-white dark:bg-zinc-900 text-left pl-6 uppercase border-b border-zinc-50 dark:border-zinc-800/50 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)]">파온 여부</td>
                                    {data.holes.map(h => {
                                        const fieldName = selectedPlanLabel ? CATEGORY_TO_FIELD[selectedPlanLabel] : null;
                                        const isHighlighted = fieldName && (h.summary as any)[fieldName] > 0;
                                        return (
                                            <td key={h.hole} className={cn(
                                                "py-2 px-0.5 sm:px-1 font-black border-b border-zinc-50 dark:border-zinc-800/50 transition-colors",
                                                isHighlighted ? "bg-orange-100 dark:bg-orange-900/40" : "bg-white dark:bg-zinc-950"
                                            )}>
                                                {h.gir}
                                            </td>
                                        );
                                    })}
                                    <td className="py-2 px-2 font-black border-b border-zinc-50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-800/50 text-brand-navy pr-6">
                                        {Math.round((data.holes.filter(h => h.gir === "O").length / data.holes.length) * 100)}%
                                    </td>
                                </tr>
                                <tr className="border-b border-zinc-50 dark:border-zinc-800/50">
                                    <td className="sticky left-0 z-30 py-2 px-1 text-[10px] font-black text-zinc-900 dark:text-zinc-100 tracking-tighter bg-white dark:bg-zinc-900 text-left pl-6 uppercase border-b border-zinc-50 dark:border-zinc-800/50 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)]">벙커시도</td>
                                    {data.holes.map(h => {
                                        const fieldName = selectedPlanLabel ? CATEGORY_TO_FIELD[selectedPlanLabel] : null;
                                        const isHighlighted = fieldName && (h.summary as any)[fieldName] > 0;
                                        return (
                                            <td key={h.hole} className={cn(
                                                "py-2 px-0.5 sm:px-1 border-b border-zinc-50 dark:border-zinc-800/50 transition-colors text-[10px] sm:text-[11px]",
                                                isHighlighted ? "bg-orange-100 dark:bg-orange-900/40" : "bg-white dark:bg-zinc-950"
                                            )}>
                                                {h.bunkerDist || "-"}
                                            </td>
                                        );
                                    })}
                                    <td className="py-2 px-2 font-black border-b border-zinc-50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-800/50 text-brand-navy pr-6">
                                        {(() => {
                                            const valid = data.holes.filter(h => h.bunkerDist && h.bunkerDist !== "-" && h.bunkerDist !== "");
                                            return valid.length > 0 ? Math.round(valid.reduce((s, h) => s + parseFloat(h.bunkerDist as string), 0) / valid.length) : "-";
                                        })()}
                                    </td>
                                </tr>
                                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                                    <td className="sticky left-0 z-30 py-2 px-1 text-[10px] font-black text-zinc-900 dark:text-zinc-100 tracking-tighter bg-white dark:bg-zinc-900 text-left pl-6 uppercase leading-tight border-b border-zinc-100 dark:border-zinc-800 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)]">어프로치시도</td>
                                    {data.holes.map(h => {
                                        const fieldName = selectedPlanLabel ? CATEGORY_TO_FIELD[selectedPlanLabel] : null;
                                        const isHighlighted = fieldName && (h.summary as any)[fieldName] > 0;
                                        return (
                                            <td key={h.hole} className={cn(
                                                "py-2 px-0.5 sm:px-1 border-b border-zinc-100 dark:border-zinc-800 transition-colors text-[10px] sm:text-[11px]",
                                                isHighlighted ? "bg-orange-100 dark:bg-orange-900/40" : "bg-white dark:bg-zinc-950"
                                            )}>
                                                {h.appDist}
                                            </td>
                                        );
                                    })}
                                    <td className="py-2 px-2 font-black border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-brand-navy pr-6">
                                        {(() => {
                                            const valid = data.holes.filter(h => h.appDist && h.appDist !== "-");
                                            return valid.length > 0 ? Math.round(valid.reduce((s, h) => s + parseFloat(h.appDist as string), 0) / valid.length) : "-";
                                        })()}
                                    </td>
                                </tr>
                                <tr className="border-b border-zinc-50 dark:border-zinc-800/50 leading-tight">
                                    <td className="sticky left-0 z-30 py-2 px-1 text-[10px] font-black text-zinc-900 dark:text-zinc-100 tracking-tighter bg-white dark:bg-zinc-900 text-left pl-6 uppercase leading-tight border-b border-zinc-50 dark:border-zinc-800/50 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)]">첫퍼트시도</td>
                                    {data.holes.map(h => {
                                        const fieldName = selectedPlanLabel ? CATEGORY_TO_FIELD[selectedPlanLabel] : null;
                                        const isHighlighted = fieldName && (h.summary as any)[fieldName] > 0;
                                        return (
                                            <td key={h.hole} className={cn(
                                                "py-2 px-0.5 sm:px-1 border-b border-zinc-50 dark:border-zinc-800/50 transition-colors text-[10px] sm:text-[11px]",
                                                isHighlighted ? "bg-orange-100 dark:bg-orange-900/40" : "bg-white dark:bg-zinc-950"
                                            )}>
                                                {h.putt1st}
                                            </td>
                                        );
                                    })}
                                    <td className="py-2 px-2 font-black border-b border-zinc-50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-800/50 text-brand-navy pr-6">
                                        {(() => {
                                            const valid = data.holes.filter(h => h.putt1st && h.putt1st !== "-");
                                            return valid.length > 0 ? (valid.reduce((s, h) => s + parseFloat(h.putt1st as string), 0) / valid.length).toFixed(1) : "-";
                                        })()}
                                    </td>
                                </tr>
                                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                                    <td className="sticky left-0 z-30 py-2 px-1 text-[10px] font-black text-zinc-900 dark:text-zinc-100 tracking-tighter bg-white dark:bg-zinc-900 text-left pl-6 uppercase border-b border-zinc-100 dark:border-zinc-800 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)]">퍼터수</td>
                                    {data.holes.map(h => {
                                        const fieldName = selectedPlanLabel ? CATEGORY_TO_FIELD[selectedPlanLabel] : null;
                                        const isHighlighted = fieldName && (h.summary as any)[fieldName] > 0;
                                        return (
                                            <td key={h.hole} className={cn(
                                                "py-2 px-1 font-black border-b border-zinc-100 dark:border-zinc-800 transition-colors",
                                                isHighlighted ? "bg-orange-100 dark:bg-orange-900/40" : "bg-white dark:bg-zinc-950"
                                            )}>
                                                {h.putts}
                                            </td>
                                        );
                                    })}
                                    <td className="py-2 px-2 font-black border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-brand-navy pr-6">{data.holes.reduce((s, h) => s + h.putts, 0)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>
            </main>

            {/* Custom Scrollbar Styling */}
            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    height: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #E4E4E7;
                    border-radius: 10px;
                }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #27272A;
                }
            `}</style>
        </div>
    );
}
