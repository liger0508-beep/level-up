"use client";

import React, { useState, useEffect, Fragment, isValidElement } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ChevronLeft, Loader2, FileSpreadsheet } from "lucide-react";
import { calculateScorecardAnalysis, HoleAnalysis } from "@/lib/score-calculations";
import { cn } from "@/lib/utils";

interface Scorecard {
    id: string;
    round_date: string;
    course_name: string;
    total_score: number | null;
    distance_unit: string | null;
    athlete: { name: string } | null;
    holes: { hole_number: number; par: number; score: number; shots: any[] }[];
}

const roundToOne = (num: number | undefined) => {
    if (num === undefined || num === null) return "";
    return (Math.sign(num) * Math.round(Math.abs(num) * 10) / 10).toFixed(1);
};

const roundToTwo = (num: number | undefined) => {
    if (num === undefined || num === null) return "";
    return (Math.sign(num) * Math.round(Math.abs(num) * 100) / 100).toFixed(2);
};

export default function ScoreDetailReviewPage() {
    const router = useRouter();
    const { id } = useParams();
    const [scorecard, setScorecard] = useState<Scorecard | null>(null);
    const [analysis, setAnalysis] = useState<HoleAnalysis[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            const supabase = createClient();
            const { data: sc } = await supabase
                .from("scorecards")
                .select(`
                    id, round_date, course_name, total_score, distance_unit,
                    athlete:users!scorecards_athlete_id_fkey(name),
                    holes:scorecard_holes(
                        hole_number, par, score,
                        shots:scorecard_shots(*)
                    )
                `)
                .eq("id", id)
                .single();

            if (sc) {
                setScorecard(sc as any);
                try {
                    const result = await calculateScorecardAnalysis(id as string);
                    setAnalysis(result);
                } catch (err) {
                    console.error("Calculation error:", err);
                }
            }
            setLoading(false);
        };
        fetchData();
    }, [id]);

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
            <Loader2 className="w-8 h-8 text-brand-navy animate-spin" />
        </div>
    );

    if (!scorecard) return <div className="p-20 text-center">데이터를 찾을 수 없습니다.</div>;

    const holeNums = Array.from({ length: 18 }, (_, i) => i + 1);

    const TableSection = ({ title, range, startRow, children, defaultExpanded = false }: { title: string, range: string, startRow: number, children: React.ReactNode, defaultExpanded?: boolean }) => {
        const [isExpanded, setIsExpanded] = useState(defaultExpanded);
        const rows = (Array.isArray(children) ? children.flat(Infinity) : [children]).filter(isValidElement);

        return (
            <div className="mb-8 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm transition-all duration-200">
                <div 
                    className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-brand-navy dark:bg-brand-gold flex items-center justify-center text-brand-gold dark:text-brand-navy font-black text-xs shadow-sm">
                            {startRow}
                        </div>
                        <div>
                            <h3 className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                {title} 
                                <span className="text-[10px] font-medium text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded uppercase tracking-wider">{range}</span>
                            </h3>
                        </div>
                    </div>
                    <div className={cn("transition-transform duration-300 ease-in-out", isExpanded ? "rotate-180" : "")}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                            <path d="m6 9 6 6 6-6"/>
                        </svg>
                    </div>
                </div>

                <div className={cn(
                    "transition-all duration-300 ease-in-out overflow-hidden",
                    isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
                )}>
                    <div className="overflow-x-auto p-4 custom-scrollbar">
                        <table className="spreadsheet-table w-full text-[12px] border-collapse min-w-[1200px]">
                            <thead>
                                <tr className="bg-zinc-50 dark:bg-zinc-800/30">
                                    <th className="border border-zinc-200 dark:border-zinc-800 p-2 text-left font-bold sticky left-0 bg-zinc-50 dark:bg-zinc-900 z-10 w-24">Hole</th>
                                    {holeNums.map(n => (
                                        <th key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center font-bold w-12">{n}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    const getAnalysis = (n: number) => analysis.find(h => h.holeNumber === n);
    const getShotResult = (h: HoleAnalysis | undefined, s: number) => h?.shots[s];

    // 단위 환산 도우미
    const isYard = scorecard?.distance_unit === "yard";
    const displayVal = (val: any) => {
        if (val === undefined || val === null || val === "") return "";
        let finalVal = val;
        if (typeof val === "string") {
            if (val.includes(" / ")) {
                const [loc, dist] = val.split(" / ");
                const d = parseFloat(dist);
                if (isNaN(d)) return val;
                const converted = isYard ? (d / 0.9144) : d;
                // 로우 데이터의 거리는 항상 정수로 표시 (Math.round)
                return `${loc} / ${Math.round(converted)}`;
            }
            const d = parseFloat(val);
            if (isNaN(d)) return val;
            finalVal = isYard ? (d / 0.9144) : d;
        } else if (typeof val === "number") {
            finalVal = isYard ? (val / 0.9144) : val;
        }
        
        if (typeof finalVal === "number") {
            // 야드일때는 보통 정수로 보므로 Math.round, 미터일때는 roundToOne
            return isYard ? Math.round(finalVal).toString() : roundToOne(finalVal);
        }
        return finalVal;
    };

    const calculateSummary = (analysis: HoleAnalysis[]) => {
        if (!analysis.length) return null;

        const totalPar = analysis.reduce((acc, h) => acc + h.par, 0);
        const totalScore = analysis.reduce((acc, h) => acc + h.score, 0);
        const totalPoint = analysis.reduce((acc, h) => acc + h.totalSG, 0);
        const totalPutts = analysis.reduce((acc, h) => acc + h.summary.putts, 0);
        const totalPA = analysis.reduce((acc, h) => acc + h.summary.paCount, 0);
        const totalOB = analysis.reduce((acc, h) => acc + h.summary.obCount, 0);
        const threePuttCount = analysis.filter(h => h.summary.putts >= 3).length;
        const sumFirstPuttDist = analysis.reduce((acc, h) => acc + (parseFloat(h.summary.firstPuttAttemptDist) || 0), 0);

        const playContent = totalPar + totalPoint;
        const scoreVsContent = playContent - totalScore;

        const categories = [
            { name: "비거리", sg: analysis.reduce((acc, h) => acc + h.summary.distSG_DriverDist, 0) },
            { name: "정확도", sg: analysis.reduce((acc, h) => acc + h.summary.distSG_DriverAcc, 0) },
            { name: "180M이상", sg: analysis.reduce((acc, h) => acc + h.summary.distSG_180Plus, 0) },
            { name: "150-179M", sg: analysis.reduce((acc, h) => acc + h.summary.distSG_150_179, 0) },
            { name: "120-149M", sg: analysis.reduce((acc, h) => acc + h.summary.distSG_120_149, 0) },
            { name: "90-119M", sg: analysis.reduce((acc, h) => acc + h.summary.distSG_90_119, 0) },
            { name: "피치샷", sg: analysis.reduce((acc, h) => acc + h.summary.distSG_Pitch31_89, 0) },
            { name: "벙커", sg: analysis.reduce((acc, h) => acc + h.summary.distSG_Bunker, 0) },
            { name: "어프로치", sg: analysis.reduce((acc, h) => acc + h.summary.distSG_Approach, 0) },
            { name: "9M이상", sg: analysis.reduce((acc, h) => acc + h.summary.distSG_Putt9Plus, 0) },
            { name: "4-8M", sg: analysis.reduce((acc, h) => acc + h.summary.distSG_Putt4_8, 0) },
            { name: "2-3M", sg: analysis.reduce((acc, h) => acc + h.summary.distSG_Putt2_3, 0) },
            { name: "1M", sg: analysis.reduce((acc, h) => acc + h.summary.distSG_Putt1, 0) },
        ];

        const longGameSG = categories.slice(0, 6).reduce((acc, c) => acc + c.sg, 0);
        const shortGameSG = categories.slice(6).reduce((acc, c) => acc + c.sg, 0);
        const longVsShort = longGameSG - shortGameSG;

        const totalAbsSG = categories.reduce((acc, c) => acc + Math.abs(c.sg), 0);
        const categoriesWithPercent = categories.map(c => ({
            ...c,
            percent: totalAbsSG > 0 ? (Math.abs(c.sg) / totalAbsSG) * 100 : 0
        }));

        const strongPointCat = [...categories].sort((a, b) => a.sg - b.sg)[0];
        
        // Challenge Point: Positive score (bad) with highest impact
        const positiveCategories = categoriesWithPercent.filter(c => c.sg > 0);
        const sortedByImpact = [...positiveCategories].sort((a, b) => b.percent - a.percent);
        
        const challengePoint1 = sortedByImpact[0] || { name: "-" };
        const challengePoint2 = sortedByImpact[1] || { name: "-" };

        return {
            playContent,
            scoreVsContent,
            longVsShort,
            totalPutts,
            sumFirstPuttDist,
            threePuttCount,
            totalPA,
            totalOB,
            categories: categoriesWithPercent,
            strongPoint: strongPointCat.name,
            challengePoint1: challengePoint1.name,
            challengePoint2: challengePoint2.name
        };
    };

    const summary = calculateSummary(analysis);

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4 py-8 pb-32">
            <div className="max-w-[1600px] mx-auto">
                
                {/* Header */}
                <div className="flex items-center gap-4 mb-10">
                    <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800">
                        <ChevronLeft size={24} />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 uppercase tracking-tight">
                                Score Analysis: {scorecard.athlete?.name}
                            </h1>
                            <span className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest",
                                isYard ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            )}>
                                {isYard ? "Yards" : "Meters"}
                            </span>
                        </div>
                        <p className="text-sm text-zinc-500">{scorecard.course_name} | {scorecard.round_date}</p>
                    </div>
                </div>

                {/* 1. 스코어 로우 데이터 (C30:U45) */}
                <TableSection title="스코어 로우 데이터" range="C30:U45" startRow={30} defaultExpanded={true}>
                    <tr key="par">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-bold sticky left-0 bg-white dark:bg-zinc-900">par</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center">{getAnalysis(n)?.par}</td>)}
                    </tr>
                    <tr key="score">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-bold sticky left-0 bg-white dark:bg-zinc-900">score</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center font-bold text-brand-navy dark:text-blue-400">{getAnalysis(n)?.score}</td>)}
                    </tr>
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => (
                        <tr key={`shot-raw-${s}`}>
                            <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-medium sticky left-0 bg-white dark:bg-zinc-900 text-zinc-400">{s}</td>
                            {holeNums.map(n => {
                                const val = getAnalysis(n)?.rawShotLabels[s];
                                return <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center text-sm">{displayVal(val)}</td>
                            })}
                        </tr>
                    ))}
                </TableSection>

                {/* 1.5 샷별 분석 지수 (C51:V63) */}
                <TableSection title="샷별 분석 지수" range="C51:V63" startRow={51}>
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => (
                        <tr key={`shot-sg-row-${s}`}>
                            <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-medium sticky left-0 bg-white dark:bg-zinc-900 text-zinc-400">{s}</td>
                            {holeNums.map(n => {
                                const sg = getShotResult(getAnalysis(n), s)?.shotSG;
                                return <td key={n} className={cn("border border-zinc-200 dark:border-zinc-800 p-2 text-center text-sm font-medium", (sg||0) > 0 ? "text-blue-500" : (sg||0) < 0 ? "text-red-500" : "")}>
                                    {sg !== undefined ? roundToOne(sg) : ""}
                                </td>
                            })}
                        </tr>
                    ))}
                    <tr key="shot-sg-total" className="bg-zinc-50 dark:bg-zinc-900/50 font-bold">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 sticky left-0 bg-zinc-50 dark:bg-zinc-900/50 text-brand-navy">총합</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center">{roundToOne(getAnalysis(n)?.totalSG)}</td>)}
                    </tr>
                </TableSection>

                {/* 1.7 거리별 분석 지수 (C69:U86) */}
                <TableSection title="거리별 분석 지수" range="C69:U86" startRow={69}>
                    <tr key="dist-sg-total">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-bold sticky left-0 bg-white dark:bg-zinc-900 text-brand-navy">총합</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center font-bold">{roundToOne(getAnalysis(n)?.totalSG)}</td>)}
                    </tr>
                    <tr key="dist-sg-driver-dist">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-medium sticky left-0 bg-white dark:bg-zinc-900">드라이버비거리</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center text-sm">{roundToOne(getAnalysis(n)?.summary?.distSG_DriverDist)}</td>)}
                    </tr>
                    <tr key="dist-sg-driver-acc">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-medium sticky left-0 bg-white dark:bg-zinc-900">정확도</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center text-sm">{roundToOne(getAnalysis(n)?.summary?.distSG_DriverAcc)}</td>)}
                    </tr>
                    <tr key="dist-sg-180">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-medium sticky left-0 bg-white dark:bg-zinc-900">180M이상</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center text-sm">{roundToOne(getAnalysis(n)?.summary?.distSG_180Plus)}</td>)}
                    </tr>
                    <tr key="dist-sg-150-179">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-medium sticky left-0 bg-white dark:bg-zinc-900">150-179M</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center text-sm">{roundToOne(getAnalysis(n)?.summary?.distSG_150_179)}</td>)}
                    </tr>
                    <tr key="dist-sg-120-149">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-medium sticky left-0 bg-white dark:bg-zinc-900">120-149M</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center text-sm">{roundToOne(getAnalysis(n)?.summary?.distSG_120_149)}</td>)}
                    </tr>
                    <tr key="dist-sg-90-119">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-medium sticky left-0 bg-white dark:bg-zinc-900">90-119M</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center text-sm">{roundToOne(getAnalysis(n)?.summary?.distSG_90_119)}</td>)}
                    </tr>
                    <tr key="dist-sg-pitch">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-medium sticky left-0 bg-white dark:bg-zinc-900">피치샷</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center text-sm">{roundToOne(getAnalysis(n)?.summary?.distSG_Pitch31_89)}</td>)}
                    </tr>
                    <tr key="dist-sg-bunker">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-medium sticky left-0 bg-white dark:bg-zinc-900">벙커</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center text-sm">{roundToOne(getAnalysis(n)?.summary?.distSG_Bunker)}</td>)}
                    </tr>
                    <tr key="dist-sg-approach">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-medium sticky left-0 bg-white dark:bg-zinc-900">어프로치</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center text-sm">{roundToOne(getAnalysis(n)?.summary?.distSG_Approach)}</td>)}
                    </tr>
                    <tr key="dist-sg-putt-9">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-medium sticky left-0 bg-white dark:bg-zinc-900">9M이상</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center text-sm">{roundToOne(getAnalysis(n)?.summary?.distSG_Putt9Plus)}</td>)}
                    </tr>
                    <tr key="dist-sg-putt-4-8">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-medium sticky left-0 bg-white dark:bg-zinc-900">4-8M</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center text-sm">{roundToOne(getAnalysis(n)?.summary?.distSG_Putt4_8)}</td>)}
                    </tr>
                    <tr key="dist-sg-putt-2-3">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-medium sticky left-0 bg-white dark:bg-zinc-900">2-3M</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center text-sm">{roundToOne(getAnalysis(n)?.summary?.distSG_Putt2_3)}</td>)}
                    </tr>
                    <tr key="dist-sg-putt-1">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-medium sticky left-0 bg-white dark:bg-zinc-900">1M</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center text-sm">{roundToOne(getAnalysis(n)?.summary?.distSG_Putt1)}</td>)}
                    </tr>
                    <tr className="bg-zinc-50 dark:bg-zinc-900/50"><td colSpan={holeNums.length + 1} className="h-4 border border-zinc-200 dark:border-zinc-800"></td></tr>
                    <tr key="ref-85">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-medium sticky left-0 bg-white dark:bg-zinc-900 text-zinc-400">85행(참조)</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center text-zinc-400 text-xs">{getAnalysis(n)?.summary?.refRow85}</td>)}
                    </tr>
                    <tr key="ref-86">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-medium sticky left-0 bg-white dark:bg-zinc-900 text-zinc-400">86행(참조)</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center text-zinc-400 text-xs">{getAnalysis(n)?.summary?.refRow86}</td>)}
                    </tr>
                </TableSection>

                {/* 2. 상세 분석 데이터 (C92:U150) */}
                <TableSection title="상세 분석 데이터" range="C92:U150" startRow={92}>
                    <tr key="par-detailed">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-bold sticky left-0 bg-white dark:bg-zinc-900">PAR</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center">{getAnalysis(n)?.par}</td>)}
                    </tr>
                    <tr key="score-detailed">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-bold sticky left-0 bg-white dark:bg-zinc-900 text-brand-navy">스코어</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center font-bold text-brand-navy">{getAnalysis(n)?.score}</td>)}
                    </tr>
                    <tr key="total-sg">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-black sticky left-0 bg-zinc-100 dark:bg-zinc-800 text-brand-navy">총점</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center font-black bg-zinc-50 dark:bg-zinc-800/50">{roundToTwo(getAnalysis(n)?.totalSG)}</td>)}
                    </tr>
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(s => {
                        const rows = [
                            <tr key={`analysis-shot-label-${s}`}>
                                <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-bold sticky left-0 bg-zinc-50 dark:bg-zinc-900">구분</td>
                                {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center font-medium">{getShotResult(getAnalysis(n), s)?.shotLabel || ""}</td>)}
                            </tr>
                        ];

                        // Shot 1 (s=0) does NOT have 구분-1 row. Shots 2-8 (s>0) DO have it.
                        if (s > 0) {
                            rows.push(
                                <tr key={`analysis-shot-prev-${s}`}>
                                    <td className="border border-zinc-200 dark:border-zinc-800 p-2 sticky left-0 bg-white dark:bg-zinc-900 text-zinc-500">구분-1</td>
                                    {holeNums.map(n => {
                                        const val = getShotResult(getAnalysis(n), s)?.shotIndex;
                                        return <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center text-zinc-400">
                                            {val !== undefined ? Math.floor(val) : ""}
                                        </td>
                                    })}
                                </tr>
                            );
                        }

                        rows.push(
                            <tr key={`analysis-shot-try-pos-${s}`}>
                                <td className="border border-zinc-200 dark:border-zinc-800 p-2 sticky left-0 bg-white dark:bg-zinc-900">시도 위치</td>
                                {holeNums.map(n => {
                                    const val = getShotResult(getAnalysis(n), s)?.tryPosition;
                                    return <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center">{roundToTwo(val)}</td>
                                })}
                            </tr>,
                            <tr key={`analysis-shot-try-dist-${s}`}>
                                <td className="border border-zinc-200 dark:border-zinc-800 p-2 sticky left-0 bg-white dark:bg-zinc-900">시도 거리</td>
                                {holeNums.map(n => {
                                    const val = getShotResult(getAnalysis(n), s)?.tryDistance;
                                    return <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center">{roundToTwo(val)}</td>
                                })}
                            </tr>,
                            <tr key={`analysis-shot-pos-res-${s}`}>
                                <td className="border border-zinc-200 dark:border-zinc-800 p-2 sticky left-0 bg-white dark:bg-zinc-900">위치 결과</td>
                                {holeNums.map(n => {
                                    const val = getShotResult(getAnalysis(n), s)?.positionResult;
                                    return <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center">{roundToTwo(val)}</td>
                                })}
                            </tr>,
                            <tr key={`analysis-shot-dist-res-${s}`}>
                                <td className="border border-zinc-200 dark:border-zinc-800 p-2 sticky left-0 bg-white dark:bg-zinc-900">거리 결과</td>
                                {holeNums.map(n => {
                                    const val = getShotResult(getAnalysis(n), s)?.distanceResult;
                                    return <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center">{roundToTwo(val)}</td>
                                })}
                            </tr>,
                            <tr key={`analysis-shot-sg-${s}`} className="font-bold border-b-2 border-zinc-100 dark:border-zinc-800">
                                <td className="border border-zinc-200 dark:border-zinc-800 p-2 sticky left-0 bg-zinc-100 dark:bg-zinc-800 text-emerald-600">지수</td>
                                {holeNums.map(n => {
                                    const sg = getShotResult(getAnalysis(n), s)?.shotSG;
                                    return <td key={n} className={cn("border border-zinc-200 dark:border-zinc-800 p-2 text-center bg-zinc-50 dark:bg-zinc-800/50", (sg||0) > 0 ? "text-blue-500" : (sg||0) < 0 ? "text-red-500" : "")}>
                                        {roundToTwo(sg)}
                                    </td>
                                })}
                            </tr>
                        );
                        return rows;
                    })}
                </TableSection>

                {/* 3. 스코어 카드 기본 (C215:U227) */}
                <TableSection title="스코어 카드 기본" range="C215:U227" startRow={215}>
                    <tr key="basic-par">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-bold sticky left-0 bg-white dark:bg-zinc-900">PAR</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center">{getAnalysis(n)?.par}</td>)}
                    </tr>
                    <tr key="basic-score">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-bold sticky left-0 bg-white dark:bg-zinc-900">스코어</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center font-bold text-brand-navy">{getAnalysis(n)?.score}</td>)}
                    </tr>
                    <tr key="basic-conversion">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-medium sticky left-0 bg-white dark:bg-zinc-900 text-zinc-500">스코어 변환</td>
                        {holeNums.map(n => {
                            const val = getAnalysis(n)?.summary?.scoreConversion;
                            return <td key={n} className={cn("border border-zinc-200 dark:border-zinc-800 p-2 text-center font-bold", (val||0) > 0 ? "text-blue-500" : (val||0) < 0 ? "text-red-500" : "")}>
                                {val !== undefined ? (val > 0 ? `+${val}` : val === 0 ? "E" : val) : ""}
                            </td>
                        })}
                    </tr>
                    <tr key="basic-fairway">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-medium sticky left-0 bg-white dark:bg-zinc-900">페어웨이</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center">{getAnalysis(n)?.summary?.fairwayHit}</td>)}
                    </tr>
                    <tr key="basic-on-green-dist">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-medium sticky left-0 bg-white dark:bg-zinc-900">온그린 시도거리(m)</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center text-zinc-500">{getAnalysis(n)?.summary?.onGreenAttemptDist}</td>)}
                    </tr>
                    <tr key="basic-gir">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-medium sticky left-0 bg-white dark:bg-zinc-900">파온 여부</td>
                        {holeNums.map(n => {
                            const gir = getAnalysis(n)?.summary?.gir;
                            return <td key={n} className={cn("border border-zinc-200 dark:border-zinc-800 p-2 text-center font-bold", gir === 'O' ? "text-emerald-500" : "text-red-400")}>{gir}</td>
                        })}
                    </tr>
                    <tr key="basic-bunker-dist">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-medium sticky left-0 bg-white dark:bg-zinc-900">벙커 시도거리(m)</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center text-zinc-400">{getAnalysis(n)?.summary?.bunkerAttemptDist}</td>)}
                    </tr>
                    <tr key="basic-approach-dist">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-medium sticky left-0 bg-white dark:bg-zinc-900">어프로치 시도거리(m)</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center text-zinc-400">{getAnalysis(n)?.summary?.approachAttemptDist}</td>)}
                    </tr>
                    <tr key="basic-putt-dist">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-medium sticky left-0 bg-white dark:bg-zinc-900">첫 퍼트 시도거리(m)</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center text-zinc-400">{getAnalysis(n)?.summary?.firstPuttAttemptDist}</td>)}
                    </tr>
                    <tr key="basic-putts">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-bold sticky left-0 bg-white dark:bg-zinc-900">퍼터수</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center font-bold">{getAnalysis(n)?.summary?.putts}</td>)}
                    </tr>
                    <tr key="basic-ob">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-medium sticky left-0 bg-white dark:bg-zinc-900 text-red-500">오비</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center text-red-500">{getAnalysis(n)?.summary?.obCount || ""}</td>)}
                    </tr>
                    <tr key="basic-pa">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-medium sticky left-0 bg-white dark:bg-zinc-900 text-orange-500">패널티에어리어</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center text-orange-500">{getAnalysis(n)?.summary?.paCount || ""}</td>)}
                    </tr>
                </TableSection>

                {/* 4. 거리별 횟수 및 기타 (C229:U249) */}
                <TableSection title="거리별 횟수 및 기타" range="C229:U249" startRow={229}>
                    <tr key="freq-tee">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-medium sticky left-0 bg-white dark:bg-zinc-900">티샷</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center text-zinc-500">{getAnalysis(n)?.summary?.teeShotCount || ""}</td>)}
                    </tr>
                    <tr key="freq-180">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-medium sticky left-0 bg-white dark:bg-zinc-900">180M이상</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center text-zinc-500">{getAnalysis(n)?.summary?.dist180Plus || ""}</td>)}
                    </tr>
                    <tr key="freq-150-179">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-medium sticky left-0 bg-white dark:bg-zinc-900">150-179M</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center text-zinc-500">{getAnalysis(n)?.summary?.dist150_179 || ""}</td>)}
                    </tr>
                    <tr key="freq-120-149">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-medium sticky left-0 bg-white dark:bg-zinc-900">120-149M</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center text-zinc-500">{getAnalysis(n)?.summary?.dist120_149 || ""}</td>)}
                    </tr>
                    <tr key="freq-90-119">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-medium sticky left-0 bg-white dark:bg-zinc-900">90-119M</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center text-zinc-500">{getAnalysis(n)?.summary?.dist90_119 || ""}</td>)}
                    </tr>
                    <tr key="freq-pitch">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-medium sticky left-0 bg-white dark:bg-zinc-900">피치샷</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center text-zinc-500">{getAnalysis(n)?.summary?.pitchShot31_89 || ""}</td>)}
                    </tr>
                    <tr key="freq-bunker-26-30">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-medium sticky left-0 bg-white dark:bg-zinc-900">벙커 26-30M</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center text-zinc-500">{getAnalysis(n)?.summary?.bunker26_30 || ""}</td>)}
                    </tr>
                    <tr key="freq-bunker-25">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-medium sticky left-0 bg-white dark:bg-zinc-900">벙커 25M이하</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center text-zinc-500">{getAnalysis(n)?.summary?.bunker25Minus || ""}</td>)}
                    </tr>
                    <tr key="freq-approach-26-30">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-medium sticky left-0 bg-white dark:bg-zinc-900">어프로치 26-30M</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center text-zinc-500">{getAnalysis(n)?.summary?.approach26_30 || ""}</td>)}
                    </tr>
                    <tr key="freq-approach-11-25">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-medium sticky left-0 bg-white dark:bg-zinc-900">어프로치 11~25M</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center text-zinc-500">{getAnalysis(n)?.summary?.approach11_25 || ""}</td>)}
                    </tr>
                    <tr key="freq-approach-10">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-medium sticky left-0 bg-white dark:bg-zinc-900">어프로치 10M이하</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center text-zinc-500">{getAnalysis(n)?.summary?.approach10Minus || ""}</td>)}
                    </tr>
                    <tr key="freq-putt-9">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-medium sticky left-0 bg-white dark:bg-zinc-900">9M이상</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center text-zinc-500">{getAnalysis(n)?.summary?.putt9Plus || ""}</td>)}
                    </tr>
                    <tr key="freq-putt-4-8">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-medium sticky left-0 bg-white dark:bg-zinc-900">4-8M</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center text-zinc-500">{getAnalysis(n)?.summary?.putt4_8 || ""}</td>)}
                    </tr>
                    <tr key="freq-putt-2-3">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-medium sticky left-0 bg-white dark:bg-zinc-900">2-3M</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center text-zinc-500">{getAnalysis(n)?.summary?.putt2_3 || ""}</td>)}
                    </tr>
                    <tr key="freq-putt-1">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-medium sticky left-0 bg-white dark:bg-zinc-900">1M</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center text-zinc-500">{getAnalysis(n)?.summary?.putt1 || ""}</td>)}
                    </tr>
                    <tr className="bg-zinc-50 dark:bg-zinc-900/50"><td colSpan={holeNums.length + 1} className="h-4 border border-zinc-200 dark:border-zinc-800"></td></tr>
                    <tr key="stat-par3">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-bold sticky left-0 bg-white dark:bg-zinc-900">PAR3 스코어</td>
                        {holeNums.map(n => {
                            const val = getAnalysis(n)?.summary?.par3Score;
                            return <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center font-bold text-zinc-600">{val !== null ? val : ""}</td>
                        })}
                    </tr>
                    <tr key="stat-par4">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-bold sticky left-0 bg-white dark:bg-zinc-900">PAR4 스코어</td>
                        {holeNums.map(n => {
                            const val = getAnalysis(n)?.summary?.par4Score;
                            return <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center font-bold text-zinc-600">{val !== null ? val : ""}</td>
                        })}
                    </tr>
                    <tr key="stat-par5">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-bold sticky left-0 bg-white dark:bg-zinc-900">PAR5 스코어</td>
                        {holeNums.map(n => {
                            const val = getAnalysis(n)?.summary?.par5Score;
                            return <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center font-bold text-zinc-600">{val !== null ? val : ""}</td>
                        })}
                    </tr>
                    <tr key="stat-birdie">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-bold sticky left-0 bg-white dark:bg-zinc-900 text-blue-500">버디 이상</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center text-blue-500 font-bold">{getAnalysis(n)?.summary?.isBirdiePlus ? "1" : ""}</td>)}
                    </tr>
                    <tr key="stat-bogey">
                        <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-bold sticky left-0 bg-white dark:bg-zinc-900 text-red-500">보기 이상</td>
                        {holeNums.map(n => <td key={n} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center text-red-500 font-bold">{getAnalysis(n)?.summary?.isBogeyPlus ? "1" : ""}</td>)}
                    </tr>
                </TableSection>

                {/* 5. 기본 데이터 요약 (C170:E193) */}
                {summary && (
                    <div className="mb-8 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm transition-all duration-200">
                        <div 
                            className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            onClick={() => {
                                const el = document.getElementById('summary-content');
                                const icon = document.getElementById('summary-icon');
                                if (el && icon) {
                                    const isExpanded = el.classList.contains('max-h-0');
                                    if (isExpanded) {
                                        el.classList.remove('max-h-0', 'opacity-0');
                                        el.classList.add('max-h-[2000px]', 'opacity-100');
                                        icon.classList.add('rotate-180');
                                    } else {
                                        el.classList.add('max-h-0', 'opacity-0');
                                        el.classList.remove('max-h-[2000px]', 'opacity-100');
                                        icon.classList.remove('rotate-180');
                                    }
                                }
                            }}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center text-white dark:text-zinc-900 font-black text-xs shadow-sm">
                                    170
                                </div>
                                <div>
                                    <h3 className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                        기본 데이터 요약
                                        <span className="text-[10px] font-medium text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded uppercase tracking-wider">C170:E193</span>
                                    </h3>
                                </div>
                            </div>
                            <div id="summary-icon" className="transition-transform duration-300 ease-in-out">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                                    <path d="m6 9 6 6 6-6"/>
                                </svg>
                            </div>
                        </div>

                        <div id="summary-content" className="transition-all duration-300 ease-in-out overflow-hidden max-h-0 opacity-0">
                            <div className="p-4">
                                <table className="w-full text-[12px] border-collapse border border-zinc-200 dark:border-zinc-800">
                                    <thead>
                                        <tr className="bg-zinc-50 dark:bg-zinc-800/30">
                                            <th className="border border-zinc-200 dark:border-zinc-800 p-2 text-left font-bold w-48">항목</th>
                                            <th className="border border-zinc-200 dark:border-zinc-800 p-2 text-center font-bold">결과 / 점수</th>
                                            <th className="border border-zinc-200 dark:border-zinc-800 p-2 text-center font-bold">비고 / 영향력</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                        {/* General Stats */}
                                        {[
                                            { label: "플레이 내용", value: roundToOne(summary.playContent) },
                                            { label: "내용대비 스코어", value: (summary.scoreVsContent > 0 ? "+" : "") + roundToOne(summary.scoreVsContent), color: summary.scoreVsContent > 0 ? "text-blue-500" : "text-red-500" },
                                            { label: "롱게임대비 숏게임", value: (summary.longVsShort > 0 ? "+" : "") + roundToOne(summary.longVsShort), color: summary.longVsShort > 0 ? "text-blue-500" : "text-red-500" },
                                            { label: "퍼트수", value: summary.totalPutts },
                                            { label: "첫 퍼트 거리(합계)", value: Math.round(summary.sumFirstPuttDist) },
                                            { label: "3퍼트 이상 횟수", value: summary.threePuttCount },
                                            { label: "패널티에어리어 횟수", value: summary.totalPA },
                                            { label: "OB 횟수", value: summary.totalOB },
                                        ].map((item, idx) => (
                                            <tr key={`stat-${idx}`} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                                                <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-bold bg-zinc-50 dark:bg-zinc-800/50">{item.label}</td>
                                                <td className={cn("border border-zinc-200 dark:border-zinc-800 p-2 text-center font-bold", (item as any).color)}>{item.value}</td>
                                                <td className="border border-zinc-200 dark:border-zinc-800 p-2 text-center text-zinc-400">-</td>
                                            </tr>
                                        ))}

                                        {/* 거리별 점수 */}
                                        <tr className="bg-zinc-100 dark:bg-zinc-800/80"><td colSpan={3} className="p-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">거리별 점수 (C178:E190)</td></tr>
                                        {summary.categories.map((cat, idx) => (
                                            <tr key={`cat-${idx}`} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                                                <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-bold bg-zinc-50 dark:bg-zinc-800/50">{cat.name}</td>
                                                <td className={cn("border border-zinc-200 dark:border-zinc-800 p-2 text-center font-bold", cat.sg > 0 ? "text-blue-500" : cat.sg < 0 ? "text-red-500" : "text-zinc-400")}>
                                                    {cat.sg !== 0 ? (cat.sg > 0 ? "+" : "") + roundToOne(cat.sg) : "0.0"}
                                                </td>
                                                <td className="border border-zinc-200 dark:border-zinc-800 p-2 text-center text-zinc-500 font-medium">{Math.round(cat.percent)}%</td>
                                            </tr>
                                        ))}

                                        {/* Insights */}
                                        <tr className="bg-zinc-100 dark:bg-zinc-800/80"><td colSpan={3} className="p-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">핵심 포인트 (C191:E193)</td></tr>
                                        {[
                                            { label: "스트롱 포인트", value: summary.strongPoint },
                                            { label: "챌린지 포인트-1", value: summary.challengePoint1 },
                                            { label: "챌린지 포인트-2", value: summary.challengePoint2 },
                                        ].map((item, idx) => (
                                            <tr key={`point-${idx}`} className="bg-brand-navy/5 dark:bg-brand-gold/5">
                                                <td className="border border-zinc-200 dark:border-zinc-800 p-2 font-bold">{item.label}</td>
                                                <td colSpan={2} className="border border-zinc-200 dark:border-zinc-800 p-2 text-center font-black text-brand-navy dark:text-brand-gold">{item.value}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}


                <div className="bg-zinc-50 dark:bg-zinc-900/20 p-6 rounded-2xl border border-zinc-100 dark:border-zinc-800/30 text-xs text-zinc-500 mt-12">
                    <p>스프레드시트 C93:U149 로직이 적용된 상세 분석 데이터 및 C169:E193 요약 데이터입니다. 시도위치, 시도거리, 위치결과, 거리결과의 합산이 점수가 됩니다.</p>
                </div>
            </div>

            <style jsx>{`
                .spreadsheet-table td, .spreadsheet-table th {
                    white-space: nowrap;
                    min-width: 60px;
                }
            `}</style>
        </div>
    );
}
