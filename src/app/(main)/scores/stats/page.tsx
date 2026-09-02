"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { calculateScorecardAnalysis, HoleAnalysis } from "@/lib/score-calculations";
import { ScorecardDetailTable } from "@/components/score/ScorecardDetailTable";
import { DatePickerInput } from "@/components/ui/DatePickerInput";
import { DatePresets, DatePresetType } from "@/components/ui/DatePresets";
import { AthleteSearch } from "@/components/ui/AthleteSearch";
import {
    ChevronLeft,
    ChevronRight,
    TrendingDown,
    Activity,
    Target,
    Zap,
    Flag,
    BarChart3,
    Calendar,
    User,
    X,
    Search,
    Plus,
    ChevronUp,
    ChevronDown,
    Info,
    Trophy as TrophyIcon
} from "lucide-react";
import { cn, formatScore } from "@/lib/utils";
import { 
    ResponsiveContainer, 
    LineChart, 
    Line, 
    XAxis, 
    YAxis, 
    Tooltip, 
    CartesianGrid,
    ReferenceLine
} from "recharts";

// Components
const SectionHeader = ({ title, icon: Icon, badge, className }: { title: string; icon: any; badge?: string; className?: string }) => (
    <div className={cn("flex items-center justify-between", className || "mb-4")}>
        <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400">
                <Icon size={18} />
            </div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50 whitespace-nowrap">{title}</h2>
        </div>
        {badge && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-brand-navy/5 text-brand-navy dark:bg-brand-navy/20 dark:text-brand-navy-light border border-brand-navy/10">
                {badge}
            </span>
        )}
    </div>
);

const IndicatorCard = ({ label, value, unit, icon: Icon, colorClass = "text-brand-navy" }: { label: string; value: string | number; unit?: string; icon: any; colorClass?: string }) => (
    <div className="bg-white dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800/50 p-4 rounded-2xl flex flex-col justify-between h-full">
        <div className="flex items-center gap-1.5 mb-3 text-[14px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-tight">
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
    const displayColor = isPositive ? "text-blue-500" : isNegative ? "text-red-500" : colorClass;
    return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-5 py-7 rounded-[2.5rem] shadow-sm flex flex-col items-start justify-between min-h-[190px]">
            <div className="flex flex-col items-start gap-2 mb-2 text-[14px] font-black text-zinc-400 text-left">
                <Icon size={20} className="text-zinc-400/80 shrink-0" />
                <div className="leading-tight">{label}</div>
            </div>
            <div className="w-full flex items-baseline justify-end">
                <span className={cn("text-2xl font-black tracking-tighter", displayColor)}>{value}</span>
            </div>
        </div>
    );
};

export default function ScoreStatsPage() {
    const router = useRouter();
    const [mode, setMode] = useState<"score" | "contribution">("score");
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [userName, setUserName] = useState<string>("");
    
    const [activePreset, setActivePreset] = useState<DatePresetType>("custom");
    const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());

    const todayStr = new Date().toISOString().split('T')[0];
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const monthAgoStr = monthAgo.toISOString().split('T')[0];

    const [startDate, setStartDate] = useState(monthAgoStr);
    const [endDate, setEndDate] = useState(todayStr);
    const [holeType, setHoleType] = useState<18 | 9>(18);
    
    const [hasSearched, setHasSearched] = useState(false);

    const [allScorecards, setAllScorecards] = useState<any[]>([]);
    const [analysisMap, setAnalysisMap] = useState<Record<string, HoleAnalysis[]>>({});
    
    const [sectorViewMode, setSectorViewMode] = useState<'average' | 'trend'>('average');
    const [activeSector, setActiveSector] = useState<'티샷' | '세컨샷' | '그린주변' | '퍼팅'>('티샷');
    const [summary, setSummary] = useState<any>(null);
    const [scorecardInfo, setScorecardInfo] = useState<any>(null);

    const [selectedDetailAthlete, setSelectedDetailAthlete] = useState<string | null>(null);
    const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
    const [isTagsExpanded, setIsTagsExpanded] = useState(false);
    const [viewingScorecardId, setViewingScorecardId] = useState<string | null>(null);
    const [selectedPlanLabel, setSelectedPlanLabel] = useState<string | null>(null);

    const roundToOne = (num: number | undefined) => {
        if (num === undefined || num === null) return "0";
        const val = Number(Math.round(Number(num + "e1")) + "e-1");
        return val % 1 === 0 ? val.toString() : val.toFixed(1);
    };

    const statsByAthlete = useMemo(() => {
        const groups: Record<string, { name: string; total: number; count: number; scorecards: any[] }> = {};
        allScorecards.forEach(sc => {
            const name = sc.athlete?.name || "미지정";
            if (!groups[name]) groups[name] = { name, total: 0, count: 0, scorecards: [] };
            groups[name].total += sc.total_score;
            groups[name].count += 1;
            groups[name].scorecards.push(sc);
        });
        return Object.values(groups).map(g => ({
            name: g.name,
            avg: Math.round(g.total / g.count),
            count: g.count,
            scorecards: g.scorecards
        })).sort((a, b) => a.avg - b.avg);
    }, [allScorecards]);

    const togglePlayer = (name: string) => {
        const next = new Set(selectedPlayers);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        setSelectedPlayers(next);
        setSelectedDetailAthlete(null);
        setHasSearched(false);
    };

    const handlePlayerRemove = (name: string) => {
        const next = new Set(selectedPlayers);
        next.delete(name);
        setSelectedPlayers(next);
        setSelectedDetailAthlete(null);
        setHasSearched(false);
    };

    useEffect(() => {
        const fetchInitial = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data: profile } = await supabase.from("users").select("role, name").eq("id", user.id).single();
            if (profile) {
                setUserRole(profile.role);
                setUserName(profile.name);
                if (profile.role === 'athlete' || profile.role === 'parent') {
                    setSelectedPlayers(new Set([profile.name]));
                    handleFetch(new Set([profile.name]));
                }
            }
            setLoading(false);
        };
        fetchInitial();
    }, []);

    const handleFetch = async (playersToFetch: Set<string> = selectedPlayers) => {
        setLoading(true);
        setHasSearched(true);
        const supabase = createClient();
        
        let query = supabase
            .from("scorecards")
            .select(`id, round_date, course_name, total_score, hole_count, athlete:users!scorecards_athlete_id_fkey(name), coach:users!scorecards_coach_id_fkey(name)`)
            .eq("hole_count", holeType)
            .eq("is_final", true)
            .gte("round_date", startDate)
            .lte("round_date", endDate)
            .order("round_date", { ascending: false });

        if (playersToFetch.size > 0) {
            const { data: users } = await supabase
                .from("users")
                .select("id")
                .in("name", Array.from(playersToFetch));
            const userIds = users?.map(u => u.id) || [];
            if (userIds.length > 0) {
                query = query.in("athlete_id", userIds);
            } else {
                setAllScorecards([]);
                setAnalysisMap({});
                setLoading(false);
                return;
            }
        }

        const { data: scs } = await query;
        if (scs && scs.length > 0) {
            const analyses: Record<string, HoleAnalysis[]> = {};
            for (const sc of scs) {
                try {
                    const result = await calculateScorecardAnalysis(sc.id);
                    analyses[sc.id] = result.filter((v, i, a) => a.findIndex(t => t.holeNumber === v.holeNumber) === i);
                } catch(e) { console.error(e); }
            }
            setAnalysisMap(analyses);
            
            // Filter scs to only include completed rounds (analyzed holes === holeType)
            const completedScs = scs.filter(sc => (analyses[sc.id]?.length || 0) === holeType);
            setAllScorecards(completedScs);
        } else {
            setAllScorecards([]);
            setAnalysisMap({});
        }
        setLoading(false);
    };

    const handleFetchAll = () => {
        setSelectedPlayers(new Set());
        handleFetch(new Set());
    };

    useEffect(() => {
        if (allScorecards.length === 0 || !selectedDetailAthlete) {
            setSummary(null);
            setScorecardInfo(null);
            return;
        }

        const athleteScs = allScorecards.filter(sc => (sc.athlete?.name || "미지정") === selectedDetailAthlete);
        
        // Filter out incomplete rounds (where analyzed holes < holeType) and excluded ones
        const activeScs = athleteScs.filter(sc => {
            const isExcluded = excludedIds.has(sc.id);
            const analyzedHoles = analysisMap[sc.id] || [];
            const isComplete = analyzedHoles.length === holeType;
            return !isExcluded && isComplete;
        });
        
        if (activeScs.length === 0) {
            setSummary(null);
            setScorecardInfo(null);
            return;
        }

        const numRounds = activeScs.length;
        // Calculate average par from actual hole data
        const allHolesForPar: HoleAnalysis[] = [];
        activeScs.forEach(sc => {
            if(analysisMap[sc.id]) allHolesForPar.push(...analysisMap[sc.id]);
        });
        const avgPar = numRounds > 0 && allHolesForPar.length > 0
            ? Math.round(allHolesForPar.reduce((s, h) => s + h.par, 0) / numRounds)
            : (holeType === 18 ? 72 : 36);

        setScorecardInfo({
            player: activeScs[0].athlete?.name || "선수",
            coach: activeScs[0].coach?.name || "코치",
            date: `${startDate.replace(/-/g, ".")} ~ ${endDate.replace(/-/g, ".")}`,
            title: `통계 (${numRounds}라운드)`,
            totalScore: Math.round(activeScs.reduce((s, sc) => s + sc.total_score, 0) / numRounds),
            totalPar: avgPar
        });

        let combinedResult: HoleAnalysis[] = [];
        activeScs.forEach(sc => {
            if(analysisMap[sc.id]) combinedResult = combinedResult.concat(analysisMap[sc.id]);
        });

        const teeSG = combinedResult.reduce((s, h) => s + (h.summary.distSG_DriverDist + h.summary.distSG_DriverAcc), 0) / numRounds;
        const secondSG = combinedResult.reduce((s, h) => s + (h.summary.distSG_180Plus + h.summary.distSG_150_179 + h.summary.distSG_120_149 + h.summary.distSG_90_119), 0) / numRounds;
        const greenSG = combinedResult.reduce((s, h) => s + (h.summary.distSG_Pitch31_89 + h.summary.distSG_Bunker + h.summary.distSG_Approach), 0) / numRounds;
        const puttingSG = combinedResult.reduce((s, h) => s + (h.summary.distSG_Putt9Plus + h.summary.distSG_Putt4_8 + h.summary.distSG_Putt2_3 + h.summary.distSG_Putt1), 0) / numRounds;

        const CATEGORY_TO_FIELD: Record<string, string> = {
            "티샷 비거리": "distSG_DriverDist", "티샷 정확도": "distSG_DriverAcc",
            "180M이상": "distSG_180Plus", "150-179M": "distSG_150_179",
            "120-149M": "distSG_120_149", "90-119M": "distSG_90_119",
            "피치샷": "distSG_Pitch31_89", "벙커": "distSG_Bunker",
            "어프로치": "distSG_Approach",
            "9M이상": "distSG_Putt9Plus", "4-8M": "distSG_Putt4_8",
            "2-3M": "distSG_Putt2_3", "1M": "distSG_Putt1",
        };
        const cats = Object.entries(CATEGORY_TO_FIELD).map(([name, field]) => {
            const maxSg = Math.max(...combinedResult.map(h => (h.summary as any)[field] || 0));
            return {
                name,
                sg: combinedResult.reduce((s, h) => s + ((h.summary as any)[field] || 0), 0) / numRounds,
                maxSg
            };
        });

        const totalAbsSG = cats.reduce((s, c) => s + Math.abs(c.sg), 0);
        const contributions = cats.map(c => ({
            ...c,
            percent: totalAbsSG > 0 ? (Math.abs(c.sg) / totalAbsSG) * 100 : 0
        })).sort((a, b) => a.sg - b.sg);

        const longSG = teeSG + secondSG; 
        const shortSG = greenSG + puttingSG; 
        const longVsShort = shortSG - longSG;

        const avgTotalScore = activeScs.reduce((s, sc) => s + sc.total_score, 0) / numRounds;
        const playContent = avgTotalScore + ((longVsShort * -1) / 2);
        const scoreVsContent = avgTotalScore - playContent;

        const totalPutts = combinedResult.reduce((s, h) => s + h.summary.putts, 0) / numRounds;
        const sumFirstPuttDist = combinedResult.reduce((s, h) => s + parseFloat(h.summary.firstPuttAttemptDist || "0"), 0);
        const avgFirstPuttDist = combinedResult.length > 0 ? sumFirstPuttDist / combinedResult.length : 0;
        const threePuttCount = combinedResult.filter(h => h.summary.putts >= 3).length / numRounds;
        const totalPA = combinedResult.reduce((s, h) => s + h.summary.paCount, 0) / numRounds;
        const totalOB = combinedResult.reduce((s, h) => s + h.summary.obCount, 0) / numRounds;

        const fwHoles = combinedResult.filter(h => h.summary.fairwayHit !== '-');
        const fwHits = fwHoles.filter(h => h.summary.fairwayHit === 'O').length;
        const fairwayHitRate = fwHoles.length > 0 ? (fwHits / fwHoles.length) * 100 : 0;
        const girHits = combinedResult.filter(h => h.summary.gir === 'O').length;
        const girRate = combinedResult.length > 0 ? (girHits / combinedResult.length) * 100 : 0;

        const missedGirHoles = combinedResult.filter(h => h.summary.gir !== 'O');
        const parSaves = missedGirHoles.filter(h => h.score <= h.par).length;
        const parSaveRate = missedGirHoles.length > 0 ? (parSaves / missedGirHoles.length) * 100 : 0;

        let totalBogeyOrWorseForBounceBack = 0;
        let totalBounceBacks = 0;
        let totalBirdieOrBetter = 0;

        activeScs.forEach(sc => {
            const holes = analysisMap[sc.id] || [];
            const sortedHoles = [...holes].sort((a, b) => a.holeNumber - b.holeNumber);
            
            for (let i = 0; i < sortedHoles.length; i++) {
                const h = sortedHoles[i];
                if (h.score > 0 && h.score !== -1) {
                    if (h.score <= h.par - 1) {
                        totalBirdieOrBetter++;
                    }
                    if (h.score >= h.par + 1) {
                        if (i + 1 < sortedHoles.length) {
                            const nextH = sortedHoles[i + 1];
                            if (nextH.score > 0 && nextH.score !== -1) {
                                totalBogeyOrWorseForBounceBack++;
                                if (nextH.score <= nextH.par - 1) {
                                    totalBounceBacks++;
                                }
                            }
                        }
                    }
                }
            }
        });

        const bounceBackRate = totalBogeyOrWorseForBounceBack > 0 ? (totalBounceBacks / totalBogeyOrWorseForBounceBack) * 100 : 0;
        const avgBirdieOrBetter = numRounds > 0 ? (totalBirdieOrBetter / numRounds) : 0;

        const getRelScore = (holes: HoleAnalysis[]) => {
            const played = holes.filter(h => h.score > 0 && h.score !== -1);
            if (played.length === 0) return "0";
            const s = played.reduce((acc, h) => acc + (h.score - h.par), 0) / numRounds;
            const rounded = Math.round(s * 10) / 10;
            return formatScore(s, 1);
        };

        const score1_3 = getRelScore(combinedResult.filter(h => h.holeNumber >= 1 && h.holeNumber <= 3));
        const score4_15 = getRelScore(combinedResult.filter(h => h.holeNumber >= 4 && h.holeNumber <= 15));
        const score16_18 = getRelScore(combinedResult.filter(h => h.holeNumber >= 16 && h.holeNumber <= 18));
        const scorePar3 = getRelScore(combinedResult.filter(h => h.par === 3));
        const scorePar4 = getRelScore(combinedResult.filter(h => h.par === 4));
        const scorePar5 = getRelScore(combinedResult.filter(h => h.par === 5));

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

        combinedResult.forEach(h => {
            h.shots.forEach(r => {
                const label = r.shotLabel.split('/')[0].trim().toUpperCase();
                const dist = r.attemptDistance;
                const rem = r.remainingDistance;
                const landing = (r.landingLabel || "").toUpperCase().trim();

                if (["PA", "OB", "PS"].includes(landing)) return;

                if (label === 'TE' && h.par === 4) {
                    distStats["티샷"].sum += rem;
                    distStats["티샷"].count++;
                }

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

        const strongPoint = [...cats].sort((a, b) => a.sg - b.sg)[0]?.name || "-";
        const positiveCats = contributions.filter(c => c.maxSg > 0).sort((a, b) => b.sg - a.sg);
        const challengePoint1 = positiveCats[0]?.name || "-";
        const challengePoint2 = positiveCats[1]?.name || "-";

        setSummary({
            playContent: roundToOne(playContent),
            scoreVsContent: formatScore(scoreVsContent),
            longVsShort: formatScore(longVsShort),
            avgMetrics: [
                { label: "페어웨이 안착률", value: (fairwayHitRate || 0).toFixed(1), unit: "%" },
                { label: "그린 적중률", value: (girRate || 0).toFixed(1), unit: "%" },
                { label: "파세이브률", value: (parSaveRate || 0).toFixed(1), unit: "%" },
                { label: "퍼트수", value: roundToOne(totalPutts), unit: "개" },
                { label: "3퍼트 이상", value: roundToOne(threePuttCount), unit: "회" },
                { label: "패널티/OB", value: roundToOne(totalPA + totalOB), unit: "개" },
                { label: "Bounce Back", value: bounceBackRate.toFixed(1), unit: "%" },
                { label: "버디 이상수", value: roundToOne(avgBirdieOrBetter), unit: "개" }
            ],
            sectorChanges: [
                { 
                    type: "티샷", 
                    value: formatScore(teeSG),
                    items: cats.slice(0, 2)
                },
                { 
                    type: "세컨샷", 
                    value: formatScore(secondSG),
                    items: cats.slice(2, 6)
                },
                { 
                    type: "그린주변샷", 
                    value: formatScore(greenSG),
                    items: cats.slice(6, 9)
                },
                { 
                    type: "퍼팅", 
                    value: formatScore(puttingSG),
                    items: cats.slice(9, 13)
                }
            ],
            contributions,
            avgRemainingDists,
            strongPoint,
            challengePoint1,
            challengePoint2,
            trainingPlan: positiveCats.slice(0, 5).map((c, i) => ({
                rank: `${i + 1}순위`,
                label: c.name,
                pct: Math.round(c.percent),
                time: [35, 25, 25, 20, 10, 5][i] || 5,
                color: ["bg-red-500", "bg-orange-500", "bg-emerald-500", "bg-blue-500", "bg-indigo-500", "bg-purple-500"][i] || "bg-zinc-500",
            })),
            segmentScores: [
                { label: "1~3홀", value: score1_3 },
                { label: "4~15홀", value: score4_15 },
                { label: "16~18홀", value: score16_18 },
            ],
            parTypeScores: [
                { label: "Par 3", value: scorePar3 },
                { label: "Par 4", value: scorePar4 },
                { label: "Par 5", value: scorePar5 },
            ],
            trendData: activeScs
                .sort((a, b) => new Date(a.round_date).getTime() - new Date(b.round_date).getTime())
                .map(sc => {
                    const holes = analysisMap[sc.id] || [];
                    const tSG = holes.reduce((s, h) => s + (h.summary.distSG_DriverDist + h.summary.distSG_DriverAcc), 0);
                    const sSG = holes.reduce((s, h) => s + (h.summary.distSG_180Plus + h.summary.distSG_150_179 + h.summary.distSG_120_149 + h.summary.distSG_90_119), 0);
                    const gSG = holes.reduce((s, h) => s + (h.summary.distSG_Pitch31_89 + h.summary.distSG_Bunker + h.summary.distSG_Approach), 0);
                    const pSG = holes.reduce((s, h) => s + (h.summary.distSG_Putt9Plus + h.summary.distSG_Putt4_8 + h.summary.distSG_Putt2_3 + h.summary.distSG_Putt1), 0);
                    
                    return {
                        id: sc.id,
                        date: sc.round_date.substring(5).replace('-', '/'),
                        score: Number(sc.total_score),
                        course: sc.course_name,
                        teeSG: Math.round(tSG * 10) / 10,
                        secondSG: Math.round(sSG * 10) / 10,
                        greenSG: Math.round(gSG * 10) / 10,
                        puttingSG: Math.round(pSG * 10) / 10
                    };
                })
        });
    }, [allScorecards, analysisMap, selectedDetailAthlete, excludedIds, startDate, endDate]);

    return (
        <div className="p-4 sm:p-8 max-w-4xl mx-auto pb-24 min-h-screen">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    {selectedDetailAthlete && (
                        <button 
                            onClick={() => {
                                setSelectedDetailAthlete(null);
                                setExcludedIds(new Set());
                                setViewingScorecardId(null);
                            }} 
                            className="p-1 -ml-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-900 dark:text-zinc-50"
                        >
                            <ChevronLeft size={24} />
                        </button>
                    )}
                    <BarChart3 size={24} className="text-brand-navy dark:text-brand-navy-light shrink-0" />
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                        스코어 통계
                    </h1>
                </div>
            </div>
            
            <main className="space-y-6">
                {!selectedDetailAthlete ? (
                    <>
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 mb-6 shadow-sm">
                            <div className="flex items-center gap-2 mb-4">
                                <button onClick={() => setHoleType(18)} className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${holeType === 18 ? 'bg-brand-navy text-white' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}`}>18홀</button>
                                <button onClick={() => setHoleType(9)} className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${holeType === 9 ? 'bg-brand-navy text-white' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}`}>9홀</button>
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="w-24 shrink-0 text-center text-sm font-semibold text-zinc-700 dark:text-zinc-300">스코어 일자</label>
                                <div className="flex items-center gap-1 flex-1 min-w-0">
                                    <DatePickerInput value={startDate} onClick={(e:any)=>e.target.showPicker?.()} onChange={(e)=>setStartDate(e.target.value)} className="no-year-date flex-1 min-w-0 px-2 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-[13px] text-center" />
                                    <span className="text-zinc-400 shrink-0 text-xs">~</span>
                                    <DatePickerInput value={endDate} onClick={(e:any)=>e.target.showPicker?.()} onChange={(e)=>setEndDate(e.target.value)} className="no-year-date flex-1 min-w-0 px-2 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-[13px] text-center" />
                                </div>
                            </div>
                            {userRole !== 'athlete' && userRole !== 'parent' ? (
                                <div className="mt-3">
                                    <div className="flex items-center gap-2">
                                        <label className="w-24 shrink-0 text-center text-sm font-semibold text-zinc-700 dark:text-zinc-300">선수명</label>
                                        <div className="flex-1 min-w-0">
                                            <AthleteSearch multi={true} showChips={false} selectedNames={Array.from(selectedPlayers)} onSelect={togglePlayer} onRemove={handlePlayerRemove} placeholder="선수 검색..." />
                                        </div>
                                        <button onClick={() => handleFetch()} className="px-4 py-2 sm:px-5 rounded-xl bg-brand-navy text-white text-sm font-bold flex items-center justify-center gap-2 shrink-0"><Search size={16} /> 조회</button>
                                    </div>
                                    {selectedPlayers.size > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-2" style={{ paddingLeft: '104px' }}>
                                            {Array.from(selectedPlayers).map((name) => (
                                                <span key={name} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 text-xs font-medium border border-blue-200 dark:border-blue-800">
                                                    {name}
                                                    <button type="button" onClick={() => handlePlayerRemove(name)}
                                                        className="hover:text-blue-600 dark:hover:text-blue-100 transition-colors">
                                                        <X size={12} />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="mt-3">
                                    <div className="flex items-center gap-2">
                                        <label className="w-24 shrink-0 text-center text-sm font-semibold text-zinc-700 dark:text-zinc-300">선수명</label>
                                        <div className="flex-1 min-w-0 flex items-center justify-center py-2 px-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-[13px] font-bold text-zinc-600 dark:text-zinc-400">
                                            {userName}
                                        </div>
                                        <button onClick={() => handleFetch(new Set([userName]))} className="px-4 py-2 sm:px-5 rounded-xl bg-brand-navy text-white text-sm font-bold flex items-center justify-center gap-2 shrink-0"><Search size={16} /> 조회</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <section>
                            <div className="flex items-center justify-between mb-4 px-2">
                                <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-200">선수별 평균 스코어</h2>
                                <DatePresets activePreset={activePreset} onPresetChange={(s,e,p)=>{setStartDate(s);setEndDate(e);setActivePreset(p);}} />
                            </div>
                            <div className="relative">
                                {loading && (
                                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/60 dark:bg-zinc-950/60 backdrop-blur-[1px] rounded-[2.5rem]">
                                        <Activity className="w-8 h-8 text-brand-navy animate-spin mb-2" />
                                        <p className="text-zinc-600 dark:text-zinc-400 font-bold text-sm">데이터 조회 중...</p>
                                    </div>
                                )}
                                {!hasSearched ? (
                                    <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem]">
                                        <Search size={32} className="text-zinc-400 mb-4" />
                                        <p className="text-zinc-500 font-bold">선수 조회 버튼을 눌러주세요.</p>
                                    </div>
                                ) : statsByAthlete.length === 0 && !loading ? (
                                    <div className="py-20 text-center text-zinc-500 font-bold bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800">기록이 없습니다.</div>
                                ) : (
                                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
                                        <table className="w-full text-left">
                                            <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800">
                                                <tr>
                                                    <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] sm:text-[11px] font-black text-zinc-400 uppercase text-center">선수명</th>
                                                    <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] sm:text-[11px] font-black text-zinc-400 uppercase text-center">평균 스코어</th>
                                                    <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] sm:text-[11px] font-black text-zinc-400 uppercase text-right">라운드</th>
                                                    <th className="px-2 sm:px-4 py-3 sm:py-4"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                                {statsByAthlete.map((stat, idx) => (
                                                    <tr key={idx} onClick={() => setSelectedDetailAthlete(stat.name)} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors group">
                                                        <td className="px-3 sm:px-6 py-4 sm:py-5 font-bold text-zinc-900 dark:text-zinc-100 text-sm sm:text-base whitespace-nowrap text-center">{stat.name}</td>
                                                        <td className="px-3 sm:px-6 py-4 sm:py-5 text-center">
                                                            <span className="text-lg sm:text-xl font-black whitespace-nowrap">{stat.avg}타</span>
                                                        </td>
                                                        <td className="px-3 sm:px-6 py-4 sm:py-5 text-right text-[12px] sm:text-sm text-zinc-500 font-medium whitespace-nowrap">{stat.count}회</td>
                                                        <td className="px-2 sm:px-4 py-4 sm:py-5 text-right">
                                                            <ChevronRight size={16} className="text-zinc-300 group-hover:text-brand-navy transition-colors inline" />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </section>
                    </>
                ) : (
                    <div className="space-y-6">
                        {(!summary || !scorecardInfo) ? (
                            <div className="p-20 text-center text-zinc-500 font-bold bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200">데이터가 없습니다.</div>
                        ) : (
                            <>
                                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 p-6 rounded-[2rem] shadow-sm space-y-4">
                                    <div className="text-zinc-500 text-sm font-medium flex items-center gap-2"><Calendar size={16} /> {scorecardInfo.date}</div>
                                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{scorecardInfo.title}</h2>
                                    <div className="pt-4 border-t border-zinc-100 flex items-center">
                                        <div className="flex-1 flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500"><User size={20} /></div><div><p className="text-[11px] text-zinc-400 font-medium">선수</p><p className="text-sm font-bold">{scorecardInfo.player}</p></div></div>
                                    </div>
                                </section>

                                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 rounded-[2rem] shadow-sm overflow-hidden">
                                    <button onClick={() => setIsTagsExpanded(!isTagsExpanded)} className="w-full px-6 py-4 flex items-center justify-between text-sm font-bold text-zinc-700 hover:bg-zinc-50 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <Activity size={16} className="text-brand-navy" /> 
                                            스코어카드 적용 ({allScorecards.filter(sc => (sc.athlete?.name || "미지정") === selectedDetailAthlete).length - excludedIds.size}건)
                                        </div>
                                        <ChevronRight size={18} className={cn("transition-transform", isTagsExpanded ? "rotate-90" : "")} />
                                    </button>
                                    {isTagsExpanded && (
                                        <div className="px-6 pb-6 pt-2 border-t border-zinc-50 grid grid-cols-1 sm:grid-cols-3 gap-2">
                                            {allScorecards.filter(sc => (sc.athlete?.name || "미지정") === selectedDetailAthlete).map(sc => (
                                                <button key={sc.id} onClick={() => { const next = new Set(excludedIds); if(next.has(sc.id)) next.delete(sc.id); else next.add(sc.id); setExcludedIds(next); }} className={cn("px-4 py-3 rounded-xl text-[11px] font-bold border transition-all flex items-center justify-between", excludedIds.has(sc.id) ? "bg-zinc-50 border-zinc-200 text-zinc-400" : "bg-brand-navy/5 border-brand-navy/20 text-brand-navy")}>
                                                    <div className="flex items-center gap-3 truncate mr-2">
                                                        <span className="shrink-0">{sc.round_date.substring(5).replace('-','/')}</span>
                                                        <span className={cn("shrink-0", excludedIds.has(sc.id) ? "text-zinc-400" : "text-brand-navy font-black")}>{sc.total_score}타</span>
                                                        <span className="truncate opacity-80">{sc.course_name}</span>
                                                    </div>
                                                    {excludedIds.has(sc.id) ? <Plus size={12} className="shrink-0" /> : <X size={12} className="shrink-0" />}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </section>
                                <section className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 shadow-sm border border-zinc-200">
                                    <SectionHeader title="스코어 추이" icon={Activity} />
                                    <div className="h-[200px] w-full mt-4">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={summary.trendData} margin={{ left: 15, right: 15, top: 10, bottom: 10 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                                <XAxis 
                                                    axisLine={false} 
                                                    tickLine={false} 
                                                    tick={{ fontSize: 10, fontWeight: 700, fill: '#A1A1AA' }}
                                                    dy={10}
                                                    padding={{ left: 20, right: 20 }}
                                                    interval="preserveStartEnd"
                                                    tickFormatter={(val, index) => summary.trendData[index]?.date || ""}
                                                />
                                                <YAxis 
                                                    hide 
                                                    domain={['dataMin - 5', 'dataMax + 5']} 
                                                />
                                                <Tooltip 
                                                    content={({ active, payload }) => {
                                                        if (active && payload && payload.length) {
                                                            return (
                                                                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl shadow-xl">
                                                                    <p className="text-[10px] font-bold text-zinc-400 mb-1">{payload[0].payload.date}</p>
                                                                    <p className="text-sm font-black text-brand-navy">{payload[0].value}타</p>
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    }}
                                                />
                                                <ReferenceLine 
                                                    y={holeType === 18 ? 72 : 36} 
                                                    stroke="#1e293b" 
                                                    strokeDasharray="3 3" 
                                                    label={{ 
                                                        position: 'insideBottomLeft', 
                                                        value: 'Even Par', 
                                                        fill: '#1e293b', 
                                                        fontSize: 9, 
                                                        fontWeight: 900 
                                                    }} 
                                                />
                                                <Line 
                                                    type="linear" 
                                                    dataKey="score" 
                                                    stroke="#f97316" 
                                                    strokeWidth={3} 
                                                    dot={(props: any) => {
                                                        const { cx, cy, payload } = props;
                                                        const isUnderPar = payload.score < (holeType === 18 ? 72 : 36);
                                                        return (
                                                            <circle 
                                                                key={`dot-${cx}-${cy}`}
                                                                cx={cx} 
                                                                cy={cy} 
                                                                r={4} 
                                                                fill={isUnderPar ? "#ef4444" : "#f97316"} 
                                                                stroke="#fff" 
                                                                strokeWidth={2} 
                                                            />
                                                        );
                                                    }}
                                                    activeDot={{ r: 6, fill: '#f97316', stroke: '#fff', strokeWidth: 2 }}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </section>

                                {(() => {
                                    const par = scorecardInfo.totalPar || (holeType === 18 ? 72 : 36);
                                    const rel = scorecardInfo.totalScore - par;
                                    const isUnder = rel < 0;
                                    const isOver = rel > 0;
                                    const colorCls = isUnder ? "text-red-500" : isOver ? "text-blue-500" : "text-zinc-900 dark:text-zinc-50";
                                    return (
                                        <div className={cn(
                                            "p-6 rounded-[2.5rem] shadow-sm border flex items-center justify-center h-32 relative overflow-hidden transition-all",
                                            isUnder ? "bg-red-50/30 border-red-100 dark:bg-red-900/10 dark:border-red-800/30" :
                                            isOver ? "bg-blue-50/30 border-blue-100 dark:bg-blue-900/10 dark:border-blue-800/30" :
                                            "bg-white border-zinc-200 dark:bg-zinc-800/20 dark:border-zinc-800"
                                        )}>
                                            <div className="absolute left-6 text-[11px] font-black uppercase tracking-widest opacity-60 text-zinc-400">Average Score</div>
                                            <div className="flex items-baseline gap-2">
                                                <span className={cn("text-4xl font-black", colorCls)}>{scorecardInfo.totalScore}</span>
                                                <span className={cn("text-xl font-bold opacity-80", colorCls)}>
                                                    ({rel > 0 ? `+${rel}` : rel === 0 ? "E" : rel})
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })()}

                                <div className="grid grid-cols-3 gap-4">
                                    <SummaryBox label={<>플레이<br/>내용</>} value={summary.playContent} icon={Flag} />
                                    <SummaryBox label={<>내용 대비<br/>스코어</>} value={summary.scoreVsContent} icon={Target} />
                                    <SummaryBox label={<>롱게임<br/>대비<br/>숏게임</>} value={summary.longVsShort} icon={Zap} />
                                </div>
                                
                                <section className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 shadow-sm border border-zinc-200">
                                    <div className="flex items-center justify-between mb-6">
                                        <SectionHeader title="부문별 스코어" icon={Target} className="mb-0" />
                                        <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
                                            <button 
                                                onClick={() => setSectorViewMode('average')}
                                                className={cn(
                                                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                                    sectorViewMode === 'average' ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-50" : "text-zinc-400"
                                                )}
                                            >
                                                평균
                                            </button>
                                            <button 
                                                onClick={() => setSectorViewMode('trend')}
                                                className={cn(
                                                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                                    sectorViewMode === 'trend' ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-50" : "text-zinc-400"
                                                )}
                                            >
                                                추이
                                            </button>
                                        </div>
                                    </div>

                                    {sectorViewMode === 'average' ? (
                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
                                            {summary.sectorChanges.map((sc: any, idx: number) => {
                                                const isPositive = parseFloat(sc.value) > 0;
                                                return (
                                                    <div key={idx} className={cn(
                                                        "p-3 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] border flex flex-col gap-2 sm:gap-3 transition-all",
                                                        isPositive ? "bg-blue-50/30 border-blue-100 dark:bg-blue-900/10 dark:border-blue-800/30" : "bg-red-50/30 border-red-100 dark:bg-red-900/10 dark:border-red-800/30"
                                                    )}>
                                                        <div className="flex flex-col">
                                                            <p className="text-[13px] font-black text-zinc-400 uppercase tracking-tight">{sc.type}</p>
                                                            <p className={cn("text-2xl font-black tracking-tighter text-right mt-1", isPositive ? "text-blue-500" : "text-red-500")}>
                                                                {sc.value}
                                                            </p>
                                                        </div>
                                                        <div className="space-y-1.5 pt-3 mt-1 border-t border-zinc-100/50 dark:border-zinc-800/50">
                                                            {sc.items.map((item: any, iIdx: number) => (
                                                                <div key={iIdx} className="flex justify-between items-center text-[13px] font-bold">
                                                                    <span className="text-zinc-500 dark:text-zinc-400">{item.name}</span>
                                                                    <span className={item.sg >= 0 ? "text-blue-500" : "text-red-500"}>
                                                                        {formatScore(item.sg, 1)}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            <div className="flex overflow-x-auto scrollbar-hide items-center sm:justify-center gap-2 pb-2">
                                                {([
                                                    { label: '티샷', key: 'teeSG', color: 'bg-blue-500' },
                                                    { label: '세컨샷', key: 'secondSG', color: 'bg-emerald-500' },
                                                    { label: '그린주변', key: 'greenSG', color: 'bg-orange-500' },
                                                    { label: '퍼팅', key: 'puttingSG', color: 'bg-indigo-500' }
                                                ] as any[]).map((item) => {
                                                    const displayLabel = item.label === '그린주변' ? '그린주변' : item.label;
                                                    const isActive = activeSector === (item.label === '그린주변' ? '그린주변' : item.label);
                                                    return (
                                                        <button
                                                            key={item.label}
                                                            onClick={() => setActiveSector(item.label)}
                                                            className={cn(
                                                                "px-3 sm:px-4 py-1.5 rounded-full text-[12px] font-bold transition-all flex items-center gap-2 border whitespace-nowrap shrink-0",
                                                                isActive 
                                                                    ? "bg-zinc-900 text-white border-zinc-900 shadow-sm" 
                                                                    : "bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-50"
                                                            )}
                                                        >
                                                            <div className={cn("w-1.5 h-1.5 rounded-full", item.color)} />
                                                            {item.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            
                                            <div className="h-[250px] w-full">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart data={summary.trendData} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                                        <XAxis 
                                                            axisLine={false} 
                                                            tickLine={false} 
                                                            tick={{ fontSize: 10, fontWeight: 700, fill: '#A1A1AA' }}
                                                            dy={10}
                                                            tickFormatter={(val, index) => summary.trendData[index]?.date || ""}
                                                        />
                                                        <YAxis 
                                                            axisLine={false}
                                                            tickLine={false}
                                                            tick={{ fontSize: 10, fontWeight: 700, fill: '#A1A1AA' }}
                                                        />
                                                        <Tooltip 
                                                            content={({ active, payload }) => {
                                                                if (active && payload && payload.length) {
                                                                    const val = payload[0].value;
                                                                    return (
                                                                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl shadow-xl">
                                                                            <p className="text-[10px] font-bold text-zinc-400 mb-1">{payload[0].payload.date}</p>
                                                                            <p className={cn("text-sm font-black", (val as number) >= 0 ? "text-blue-500" : "text-red-500")}>
                                                                                {formatScore(val as number)}
                                                                            </p>
                                                                        </div>
                                                                    );
                                                                }
                                                                return null;
                                                            }}
                                                        />
                                                        <ReferenceLine y={0} stroke="#ef4444" strokeWidth={2} />
                                                        <Line 
                                                            type="linear" 
                                                            dataKey={
                                                                activeSector === '티샷' ? 'teeSG' : 
                                                                activeSector === '세컨샷' ? 'secondSG' : 
                                                                activeSector === '그린주변' ? 'greenSG' : 'puttingSG'
                                                            } 
                                                            stroke={
                                                                activeSector === '티샷' ? '#3b82f6' : 
                                                                activeSector === '세컨샷' ? '#10b981' : 
                                                                activeSector === '그린주변' ? '#f59e0b' : '#6366f1'
                                                            }
                                                            strokeWidth={3} 
                                                            dot={{ r: 4, fill: '#fff', strokeWidth: 2 }}
                                                            activeDot={{ r: 6, strokeWidth: 0 }}
                                                        />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    )}
                                </section>

                                <section className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-5 sm:p-7 shadow-sm border border-zinc-200">
                                    <SectionHeader title="부문별 세부 항목" icon={BarChart3} />
                                    <div className="flex justify-end mb-4 bg-zinc-100 p-1 rounded-xl w-fit ml-auto">
                                        <button onClick={() => setMode("score")} className={cn("px-3 py-1.5 rounded-lg text-xs font-bold", mode === "score" ? "bg-white shadow-sm text-zinc-900" : "text-zinc-400")}>점수</button>
                                        <button onClick={() => setMode("contribution")} className={cn("px-3 py-1.5 rounded-lg text-xs font-bold", mode === "contribution" ? "bg-white shadow-sm text-zinc-900" : "text-zinc-400")}>기여도</button>
                                    </div>
                                    <div className="space-y-2 pt-1 relative">
                                        <div className={cn("absolute top-0 bottom-0 w-[2px] bg-zinc-200 z-0", mode === "score" ? "left-[64%]" : "left-[28%]")} />
                                        {summary.contributions.map((item: any, idx: number) => {
                                            const val = mode === "score" ? item.sg : item.percent;
                                            const widthPct = Math.min((Math.abs(val) / (mode === "score" ? 2.0 : 40)) * 45, 45);
                                            return (
                                                <div key={idx} className="relative z-10 flex items-center h-6">
                                                    <div className="w-[28%] flex justify-end pr-3 sm:pr-4 text-[11px] sm:text-[12px] font-bold text-zinc-500 truncate">{item.name}</div>
                                                    <div className="flex-1 relative h-full flex items-center">
                                                        {mode === "score" ? (
                                                            item.sg < 0 ? (
                                                                <><div className="absolute right-[50%] h-4 bg-red-500 rounded-sm" style={{ width: `${widthPct}%` }} /><span className="absolute left-[52%] text-[10px] font-black text-red-500">{formatScore(item.sg, 1)}</span></>
                                                            ) : (
                                                                <><div className="absolute left-[50%] h-4 bg-blue-500 rounded-sm" style={{ width: `${widthPct}%` }} /><span className="absolute right-[52%] text-[10px] font-black text-blue-500">{formatScore(item.sg, 1)}</span></>
                                                            )
                                                        ) : (
                                                            <div className="flex items-center w-full"><div className={cn("h-4 rounded-sm", item.sg < 0 ? "bg-red-500" : "bg-blue-500")} style={{ width: `${item.percent * 2.2}%` }} /><span className={cn("ml-2 text-[10px] font-black", item.sg < 0 ? "text-red-500" : "text-blue-500")}>{Math.round(item.percent * 10) / 10}%</span></div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>

                                <section className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 shadow-sm border border-zinc-200">
                                    <SectionHeader title="주요 평균 지표" icon={TrendingDown} />
                                    <div className="grid grid-cols-2 gap-4">
                                        {summary.avgMetrics.map((m: any, idx: number) => (
                                            <IndicatorCard key={idx} label={m.label} value={m.value} unit={m.unit} icon={Activity} />
                                        ))}
                                    </div>
                                </section>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-7 shadow-sm border border-zinc-200/60 dark:border-zinc-800/60 flex flex-col items-start justify-start gap-1">
                                        <div className="flex items-center gap-2 mb-4">
                                            <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/10 flex items-center justify-center text-red-500">
                                                <TrophyIcon size={18} />
                                            </div>
                                            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50 uppercase tracking-wide">Strong Point</h2>
                                        </div>
                                        <h3 className="w-full text-center text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tighter leading-tight mt-2 flex-1 flex items-center justify-center">{summary.strongPoint}</h3>
                                    </div>
                                    <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-7 shadow-sm border border-zinc-200/60 dark:border-zinc-800/60 flex flex-col items-start justify-start gap-1">
                                        <div className="flex items-center gap-2 mb-4">
                                            <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-brand-navy dark:text-brand-navy-light">
                                                <TrendingDown size={18} />
                                            </div>
                                            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50 uppercase tracking-wide">Challenge Point</h2>
                                        </div>
                                        <div className="space-y-4 flex flex-col items-start w-full mt-2 flex-1 justify-center">
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
                                        {summary.trainingPlan.map((item: any, idx: number) => {
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
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <span className={cn("text-[10px] font-black px-2 py-0.5 rounded text-white tracking-tight shrink-0", item.color, isBig && "text-[11px] px-2.5 py-1")}>{item.rank}</span>
                                                        </div>
                                                        <div className="flex-1 px-2 text-center overflow-hidden">
                                                            <span className={cn(
                                                                "font-black text-zinc-800 dark:text-zinc-200 block truncate whitespace-nowrap tracking-tighter", 
                                                                isBig ? "text-[15px] sm:text-[17px]" : "text-[13px] sm:text-[14px]"
                                                            )}>
                                                                {item.label}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center justify-end shrink-0">
                                                            <div className="flex items-baseline gap-0.5">
                                                                <span className={cn("font-black text-zinc-900 dark:text-zinc-50 tracking-tighter", isBig ? "text-xl sm:text-2xl" : "text-lg")}>{item.time}</span>
                                                                <span className="text-[10px] font-bold text-zinc-400">분</span>
                                                            </div>
                                                        </div>
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>

                                <section className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 shadow-sm border border-zinc-200">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                                        <SectionHeader title="개별 스코어카드 확인" icon={Flag} className="mb-0" />
                                        <select value={viewingScorecardId || ""} onChange={(e) => setViewingScorecardId(e.target.value || null)} className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm font-bold focus:ring-2 focus:ring-brand-navy/20 outline-none">
                                            <option value="">스코어카드 선택</option>
                                            {allScorecards.filter(sc => (sc.athlete?.name || "미지정") === selectedDetailAthlete).map(sc => (
                                                <option key={sc.id} value={sc.id}>
                                                    {sc.round_date} - {sc.course_name} {excludedIds.has(sc.id) ? "(제외됨)" : ""}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    {viewingScorecardId && (
                                        <div className="mt-6 pt-6 border-t border-zinc-100">
                                            <ScorecardDetailTable scorecardId={viewingScorecardId} isStatsMode={true} selectedCategory={selectedPlanLabel} />
                                            <div className="mt-6 flex justify-center"><button onClick={() => setViewingScorecardId(null)} className="px-6 py-2 rounded-full bg-zinc-100 text-zinc-500 font-bold text-xs">닫기</button></div>
                                        </div>
                                    )}
                                </section>

                            </>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
