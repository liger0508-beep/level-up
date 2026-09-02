"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { AthleteSearch } from "@/components/ui/AthleteSearch";
import { fetchScorecards } from "@/lib/scorecard-sync";
import { calculateScorecardAnalysis, HoleAnalysis } from "@/lib/score-calculations";
import { 
    FileText, 
    TrendingUp, 
    Award, 
    Activity, 
    Calendar, 
    Users, 
    BarChart3, 
    Target, 
    ChevronRight, 
    Download,
    ChevronDown,
    Zap,
    TrendingDown,
    BrainCircuit,
    Sparkles,
    Printer,
    Trophy,
    Paperclip,
    CheckCircle2,
    ExternalLink,
    AlertCircle,
    User,
    Play,
    Flag,
    Plus,
    X,
    MessageSquare,
    Dumbbell
} from "lucide-react";
import { cn, formatScore } from "@/lib/utils";
import Link from "next/link";
import { useParams } from "next/navigation";
import ReportLessonDetail from "@/components/ReportLessonDetail";
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
import { Info, Trophy as TrophyIcon } from "lucide-react";
import { ScorecardDetailTable } from "@/components/score/ScorecardDetailTable";


interface Athlete {
    id: string;
    name: string;
    branch: string;
}

const roundToOne = (num: number | undefined) => {
    if (num === undefined || num === null) return "0";
    const val = Number(Math.round(Number(num + "e1")) + "e-1");
    return val % 1 === 0 ? val.toString() : val.toFixed(1);
};

// UI Components from statistics page
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
        <div className="flex items-center gap-1.5 mb-3 text-[12px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-tight">
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

export default function AthleteReportPage() {
    const supabase = createClient();
    const [isLoading, setIsLoading] = useState(true);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    
    
    
    const [selectedMonth, setSelectedMonth] = useState<string>(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });

    // Dynamic Database States
    const [scorecards, setScorecards] = useState<any[]>([]);
    const [tournamentResults, setTournamentResults] = useState<any[]>([]);
    const [analyses, setAnalyses] = useState<any[]>([]);
    const [lessons, setLessons] = useState<any[]>([]);
    const [includedLessonId, setIncludedLessonId] = useState<string | null>(null);
    const [trainings, setTrainings] = useState<any[]>([]);
    const [tests, setTests] = useState<any[]>([]);

    // Scorecard stats detail map
    const [statsSummary, setStatsSummary] = useState<any>(null);
    const [isDemoData, setIsDemoData] = useState(false);

    // Interactive Dashboard States
    const [mode, setMode] = useState<"score" | "contribution">("score");
    const [sectorViewMode, setSectorViewMode] = useState<'average' | 'trend'>('average');
    const [activeSector, setActiveSector] = useState<'티샷' | '세컨샷' | '그린주변' | '퍼팅'>('티샷');
    const [selectedPlanLabel, setSelectedPlanLabel] = useState<string | null>(null);
    const [viewingScorecardId, setViewingScorecardId] = useState<string | null>(null);
    const [allScorecards, setAllScorecards] = useState<any[]>([]);
    const [analysisMap, setAnalysisMap] = useState<Record<string, HoleAnalysis[]>>({});
    const [holeType, setHoleType] = useState<9 | 18>(18);
    const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
    const [isTagsExpanded, setIsTagsExpanded] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);


    const params = useParams();
    const id = params.id as string;
    
    const [athleteName, setAthleteName] = useState("선수");
    const [athleteBranch, setAthleteBranch] = useState("지점");

    useEffect(() => {
        if (!id) return;
        async function loadPublicReport() {
            setIsLoading(true);
            try {
                const res = await fetch(`/api/public-report?id=${id}`);
                if (!res.ok) throw new Error('Report not found');
                const data = await res.json();
                
                setAthleteName(data.athlete.name);
                setAthleteBranch(data.athlete.branch);
                setSelectedMonth(data.report.month);
                
                setStatsSummary(data.report.content.statsSummary || null);
                setScorecards(data.scorecards || []);
                setLessons(data.lessons || []);
                setAnalyses(data.analyses || []);
                setTests(data.tests || []);
                setTrainings(data.trainings || []);
                setTournamentResults(data.tournamentResults || []);
                
            } catch (err) {
                console.error(err);
                alert("레포트를 불러올 수 없거나 권한이 없습니다.");
            } finally {
                setIsLoading(false);
            }
        }
        loadPublicReport();
    }, [id]);
    
    // High fidelity fallback & aggregation calculations
    const stats = useMemo(() => {
        // Average Score Calculation
        let avgScore = 74.2;
        let diffText = "지난달 대비 2.3타 단축";
        if (scorecards.length > 0) {
            const sum = scorecards.reduce((acc, curr) => acc + (curr.total_score || 0), 0);
            avgScore = Number((sum / scorecards.length).toFixed(1));
            diffText = `연습 라운드 ${scorecards.length}회 평균`;
        }

        // Training Completion Calculation
        let completionRate = 88;
        if (trainings.length > 0) {
            const completedCount = trainings.filter(t => t.status === "completed").length;
            completionRate = Math.round((completedCount / trainings.length) * 100);
        }

        return {
            averageScore: avgScore,
            scoreDiffText: diffText,
            trainingCompletionRate: completionRate,
            challengeRank: "A그룹 4위" // Future dev mock
        };
    }, [scorecards, trainings]);

    const handlePrint = () => {
        window.print();
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
                <div className="text-zinc-500 font-bold flex items-center gap-2">
                    <Activity className="animate-spin text-brand-navy" />
                    성장 리포트 불러오는 중...
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-20 print:bg-white print:pb-0">
            
            {/* Header */}
            <header className="sticky top-0 z-30 bg-zinc-50/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 print:hidden">
                <div className="max-w-4xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-brand-navy rounded-lg text-white">
                            <FileText size={20} />
                        </div>
                        <h1 className="text-xl font-black tracking-tight text-zinc-900 dark:text-white">
                            GLA 선수 성장 레포트
                        </h1>
                    </div>
                </div>
            </header>
            <main className="max-w-5xl mx-auto px-4 sm:px-8 py-8 space-y-8 print:py-0 print:px-0 [word-break:keep-all]">
                
                {/* Print Only Header */}
                <div className="hidden print:block text-center border-b pb-6 mb-8">
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">GLA ATHLETE PERFORMANCE REPORT</p>
                    <h1 className="text-3xl font-black text-brand-navy mt-1">{selectedMonth} {athleteName} 선수 성장 레포트</h1>
                    <p className="text-xs text-zinc-500 mt-2">지점: {athleteBranch} | 발행일자: {new Date().toLocaleDateString('ko-KR')}</p>
                </div>

                
                {/* Filter and Selection Section (Hidden in print) */}
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm print:hidden mb-8">
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl">
                        <Calendar size={18} className="text-brand-navy shrink-0" />
                        <span className="text-sm font-black text-zinc-900 dark:text-zinc-100">{selectedMonth}</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-300">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        선수명: <span className="font-black text-zinc-900 dark:text-white">{athleteName}</span> ({athleteBranch})
                    </div>
                </div>
                
                {/* Ordered Contents List */}
                <div className="space-y-10">

                    {!statsSummary && !isAnalyzing && (
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-10 text-center text-zinc-500 font-bold">
                            해당 월의 선수 레포트가 아직 작성되지 않았습니다.
                        </div>
                    )}

                    {statsSummary && (
                    <>
                    {/* SECTION 2. 참가 대회 성적 표시 */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-5 sm:p-7 shadow-sm">
                        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-6">
                            <div className="flex items-center gap-2">
                                <Trophy size={20} className="text-brand-navy" />
                                <h2 className="text-base font-black text-zinc-900 dark:text-white">참가 대회 성적</h2>
                            </div>
                            <span className="text-xs text-zinc-400 font-bold whitespace-nowrap shrink-0">대회 성적 관리 연동됨</span>
                        </div>

                        {tournamentResults.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {tournamentResults.map((t, idx) => (
                                    <div key={idx} className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 py-4 px-6 shadow-sm hover:border-brand-navy/30 hover:shadow-md transition-all group">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-sm font-black text-zinc-900 dark:text-zinc-50 truncate">
                                                {t.tournaments?.name || t.notes || "대회명 없음"}
                                            </span>
                                        </div>
                                        <div className="flex items-baseline justify-between">
                                            <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                                                {t.formattedDateSpan ? t.formattedDateSpan.replace(/-/g, ' ~ ') : "-"}
                                            </span>
                                            <div className="flex items-baseline gap-1.5">
                                                <span className="text-[20px] sm:text-[24px] font-black text-zinc-900 dark:text-zinc-50 tracking-tighter">
                                                    {t.rank ? `${t.rank}위` : `${t.daily_rank || "-"}위`}
                                                </span>
                                                <span className="text-sm font-black text-zinc-900 dark:text-zinc-50">
                                                    ({t.cumulative_score || t.daily_score}타)
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-10 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
                                <AlertCircle size={24} className="mx-auto text-zinc-300 mb-2" />
                                <p className="text-xs text-zinc-400">해당 월에 참가한 공식 대회 기록이 없습니다.</p>
                            </div>
                        )}
                    </section>

                    {/* SECTION 연습라운드 통계 */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-5 sm:p-7 shadow-sm space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                            <div className="flex items-center gap-2">
                                <Activity size={20} className="text-brand-navy" />
                                <h2 className="text-base font-black text-zinc-900 dark:text-white">연습라운드 통계</h2>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className={cn(
                                    "text-xs font-black px-2.5 py-0.5 rounded-full border hidden sm:inline-block",
                                    "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/20"
                                )}>
                                    저장된 데이터 ({scorecards.length}R)
                                </span>
                            </div>
                        </div>



                        {isAnalyzing ? (
                            <div className="py-12 flex flex-col items-center justify-center">
                                <Activity className="w-8 h-8 text-brand-navy animate-spin mb-2" />
                                <p className="text-xs font-bold text-zinc-500">연습라운드 샷 분석 데이터 집계 중...</p>
                            </div>
                        ) : statsSummary ? (
                            <div className="space-y-6">
                                {/* Score Trend Chart */}
                                {statsSummary.trendData && statsSummary.trendData.length > 0 && (
                                    <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 shadow-sm border border-zinc-100 dark:border-zinc-800">
                                        <div className="flex items-center gap-2 mb-4">
                                            <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400">
                                                <Activity size={18} />
                                            </div>
                                            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">스코어 추이</h2>
                                        </div>
                                        <div className="h-[200px] w-full mt-4">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={statsSummary.trendData} margin={{ left: 15, right: 15, top: 10, bottom: 10 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                                    <XAxis 
                                                        axisLine={false} 
                                                        tickLine={false} 
                                                        tick={{ fontSize: 10, fontWeight: 700, fill: '#A1A1AA' }}
                                                        dy={10}
                                                        padding={{ left: 20, right: 20 }}
                                                        interval="preserveStartEnd"
                                                        tickFormatter={(val, index) => statsSummary.trendData[index]?.date || ""}
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
                                                        y={72} 
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
                                                            const isUnderPar = payload.score < 72;
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
                                    </div>
                                )}

                                {/* Score Card */}
                                {(() => {
                                    const par = statsSummary.averagePar || 72;
                                    const rel = Math.round(stats.averageScore - par);
                                    const isUnder = rel < 0;
                                    const isOver = rel > 0;
                                    const colorCls = isUnder ? "text-red-500" : isOver ? "text-blue-500" : "text-zinc-900 dark:text-zinc-50";
                                    return (
                                        <div className={cn(
                                            "p-6 rounded-[2.5rem] shadow-sm border flex items-center justify-center h-32 relative overflow-hidden transition-all",
                                            isUnder ? "bg-red-50/30 border-red-100 dark:bg-red-900/10 dark:border-red-800/30" :
                                            isOver ? "bg-blue-50/30 border-blue-100 dark:bg-blue-900/10 dark:border-blue-800/30" :
                                            "bg-zinc-50/50 border-zinc-200 dark:bg-zinc-800/20 dark:border-zinc-800"
                                        )}>
                                            <div className="absolute left-6 text-[11px] font-black uppercase tracking-widest opacity-60 text-zinc-400">Score</div>
                                            <div className="flex items-baseline gap-2">
                                                <span className={cn("text-4xl font-black", colorCls)}>{stats.averageScore}</span>
                                                <span className={cn("text-xl font-bold opacity-80", colorCls)}>
                                                    ({rel > 0 ? `+${rel}` : rel === 0 ? "E" : rel})
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Three Core Metrics Cards */}
                                <div className="grid grid-cols-3 gap-4">
                                    <SummaryBox label={<>플레이<br/>내용</>} value={statsSummary.playContent} icon={Flag} />
                                    <SummaryBox label={<>내용 대비<br/>스코어</>} value={statsSummary.scoreVsContent} icon={Target} />
                                    <SummaryBox label={<>롱/숏게임<br/>대비</>} value={statsSummary.longVsShort} icon={Zap} />
                                </div>

                                {/* 부문별 스코어 */}
                                <section className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 shadow-sm border border-zinc-200/60 dark:border-zinc-800/60">
                                    <SectionHeader title="부문별 스코어" icon={Target} />
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {statsSummary.sectorChanges.map((sc: any, idx: number) => {
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
                                                                    {item.sg > 0 ? "+" : ""}{item.sg.toFixed(1)}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>

                                {/* Detailed category bar chart */}
                                <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-7 shadow-sm border border-zinc-100 dark:border-zinc-850">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400">
                                                <BarChart3 size={18} />
                                            </div>
                                            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">부문별 세부 항목</h2>
                                        </div>
                                        <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl w-fit">
                                            <button onClick={() => setMode("score")} className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-all", mode === "score" ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-50" : "text-zinc-400")}>점수</button>
                                            <button onClick={() => setMode("contribution")} className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-all", mode === "contribution" ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-50" : "text-zinc-400")}>기여도</button>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5 pt-2 relative">
                                        <div className={cn("absolute top-0 bottom-0 w-[2px] bg-zinc-200 dark:bg-zinc-800 z-0 transition-all", mode === "score" ? "left-[64%]" : "left-[28%]")} />
                                        {statsSummary.contributions.map((item: any, idx: number) => {
                                            const val = mode === "score" ? item.sg : item.percent;
                                            const widthPct = Math.min((Math.abs(val) / (mode === "score" ? 2.0 : 40)) * 45, 45);
                                            return (
                                                <div key={idx} className="relative z-10 flex items-center h-6">
                                                    <div className="w-[28%] flex justify-end pr-2 sm:pr-4 text-[11px] sm:text-[13px] font-bold text-zinc-500 whitespace-nowrap">{item.name}</div>
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
                                </div>

                                {/* 주요 평균 지표 */}
                                <section className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 shadow-sm border border-zinc-200/60 dark:border-zinc-800/60">
                                    <SectionHeader title="주요 평균 지표" icon={TrendingDown} />
                                    <div className="grid grid-cols-2 gap-4">
                                        {statsSummary.avgMetrics.map((m: any, idx: number) => (
                                            <IndicatorCard 
                                                key={idx} 
                                                label={m.label} 
                                                value={m.value} 
                                                unit={m.unit} 
                                                icon={Activity}
                                            />
                                        ))}
                                    </div>
                                </section>

                                {/* Strong / Challenge Point Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-7 shadow-sm border border-zinc-200/60 dark:border-zinc-800/60 flex flex-col items-start justify-start gap-1">
                                        <div className="flex items-center gap-2 mb-4">
                                            <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/10 flex items-center justify-center text-red-500">
                                                <TrophyIcon size={18} />
                                            </div>
                                            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50 uppercase tracking-wide">Strong Point</h2>
                                        </div>
                                        <h3 className="w-full text-center text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tighter leading-tight mt-2 flex-1 flex items-center justify-center">{statsSummary.strongPoint}</h3>
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
                                                <span className="text-[20px] font-black text-zinc-800 dark:text-zinc-200 tracking-tight">{statsSummary.challengePoint1}</span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[12px] font-black text-zinc-500 shrink-0">2</span>
                                                <span className="text-[20px] font-black text-zinc-800 dark:text-zinc-200 tracking-tight">{statsSummary.challengePoint2}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Training Plan accordion */}
                                <section className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 shadow-sm border border-zinc-100 dark:border-zinc-800">
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
                                        {statsSummary.trainingPlan.map((item: any, idx: number) => {
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


                                
                            </div>
                        ) : (
                            <div className="text-center py-10 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
                                <AlertCircle size={24} className="mx-auto text-zinc-300 mb-2" />
                                <p className="text-xs text-zinc-400">해당 월에 완료한 연습 라운드 스코어카드가 없습니다.</p>
                            </div>
                        )}
                    </section>

                    {/* SECTION 레슨 히스토리 */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-5 sm:p-7 shadow-sm space-y-6">
                        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
                            <div className="flex items-center gap-2">
                                <Award size={20} className="text-brand-navy" />
                                <h2 className="text-sm sm:text-base font-black text-zinc-900 dark:text-white whitespace-nowrap">레슨</h2>
                            </div>
                            <span className="text-xs text-zinc-400 font-bold">총 {lessons.length}건 지도됨</span>
                        </div>

                        {lessons.length > 0 ? (
                            <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl">
                                <ReportLessonDetail lessonId={lessons[0].id} />
                            </div>
                        ) : (
                            <div className="text-center py-10 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
                                <AlertCircle size={24} className="mx-auto text-zinc-300 mb-2" />
                                <p className="text-xs text-zinc-400">해당 월에 완료된 지도 레슨 히스토리가 없습니다.</p>
                            </div>
                        )}
                    </section>

                    {/* SECTION 4. 훈련 */}
                    {(() => {
                        const isTrainingCompleted = (r: any) => {
                            if (r.title?.includes("[복습]")) {
                                const reviewSetting = (r.template_settings || []).find((s: any) => s.type === "review_scorecard");
                                if (reviewSetting) {
                                    const completed = reviewSetting.completedHoles?.length || 0;
                                    const total = (r.total_count === 7 && completed > 7) ? completed : Math.max(r.total_count || 1, 1);
                                    return completed > 0 && completed >= total;
                                }
                            }
                            return r.completion_logs && r.completion_logs.length > 0;
                        };

                        const basicTrainings = trainings.filter(t => t.category === 'basic' || (!t.category && !t.title?.includes('[예습]') && !t.title?.includes('[복습]')));
                        const previewTrainings = trainings.filter(t => t.category === 'preview' || t.title?.includes('[예습]'));
                        const reviewTrainings = trainings.filter(t => t.category === 'review' || t.title?.includes('[복습]'));

                        const basicCompleted = basicTrainings.filter(isTrainingCompleted).length;
                        const previewCompleted = previewTrainings.filter(isTrainingCompleted).length;
                        const reviewCompleted = reviewTrainings.filter(isTrainingCompleted).length;

                        const totalTrainings = trainings.length;
                        const totalCompleted = basicCompleted + previewCompleted + reviewCompleted;
                        const totalRate = totalTrainings > 0 ? Math.round((totalCompleted / totalTrainings) * 100) : 0;

                        return (
                            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-5 sm:p-7 shadow-sm space-y-6">
                                <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
                                    <div className="flex items-center gap-2">
                                        <Dumbbell size={20} className="text-brand-navy" />
                                        <h2 className="text-sm sm:text-base font-black text-zinc-900 dark:text-white whitespace-nowrap">훈련</h2>
                                    </div>
                                    <div className="flex items-baseline gap-1 text-right">
                                        <span className="text-[11px] font-bold text-zinc-500 mr-2">(완료/배정)</span>
                                        <span className="text-sm font-black text-zinc-900 dark:text-zinc-50">{totalCompleted}</span>
                                        <span className="text-xs font-bold text-zinc-400">/ {totalTrainings}건</span>
                                    </div>
                                </div>

                                {totalTrainings > 0 ? (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50 p-5 rounded-3xl border border-zinc-100 dark:border-zinc-800">
                                            <p className="text-[11px] font-bold text-zinc-500">전체 훈련 완료율</p>
                                            <div className="text-right">
                                                <span className="text-2xl font-black text-brand-navy">{totalRate}%</span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-4 rounded-2xl text-left shadow-sm hover:border-brand-navy transition-all">
                                                <div className="flex items-baseline gap-1 mb-2">
                                                    <h5 className="text-[13px] font-bold text-zinc-600 dark:text-zinc-400">기본기</h5>
                                                    <span className="text-[11px] font-bold text-zinc-400">
                                                        (<span className="text-zinc-700 dark:text-zinc-300">{basicCompleted}</span>/{basicTrainings.length})
                                                    </span>
                                                </div>
                                                <div className="text-xl font-black text-brand-navy text-right mt-1">
                                                    {basicTrainings.length > 0 ? Math.round((basicCompleted / basicTrainings.length) * 100) : 0}%
                                                </div>
                                            </div>
                                            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-4 rounded-2xl text-left shadow-sm hover:border-brand-navy transition-all">
                                                <div className="flex items-baseline gap-1 mb-2">
                                                    <h5 className="text-[13px] font-bold text-zinc-600 dark:text-zinc-400">예습</h5>
                                                    <span className="text-[11px] font-bold text-zinc-400">
                                                        (<span className="text-zinc-700 dark:text-zinc-300">{previewCompleted}</span>/{previewTrainings.length})
                                                    </span>
                                                </div>
                                                <div className="text-xl font-black text-brand-navy text-right mt-1">
                                                    {previewTrainings.length > 0 ? Math.round((previewCompleted / previewTrainings.length) * 100) : 0}%
                                                </div>
                                            </div>
                                            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-4 rounded-2xl text-left shadow-sm hover:border-brand-navy transition-all">
                                                <div className="flex items-baseline gap-1 mb-2">
                                                    <h5 className="text-[13px] font-bold text-zinc-600 dark:text-zinc-400">복습</h5>
                                                    <span className="text-[11px] font-bold text-zinc-400">
                                                        (<span className="text-zinc-700 dark:text-zinc-300">{reviewCompleted}</span>/{reviewTrainings.length})
                                                    </span>
                                                </div>
                                                <div className="text-xl font-black text-brand-navy text-right mt-1">
                                                    {reviewTrainings.length > 0 ? Math.round((reviewCompleted / reviewTrainings.length) * 100) : 0}%
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-10 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
                                        <AlertCircle size={24} className="mx-auto text-zinc-300 mb-2" />
                                        <p className="text-xs text-zinc-400">해당 월에 배정된 훈련이 없습니다.</p>
                                    </div>
                                )}
                            </section>
                        );
                    })()}





                    

                    {statsSummary && (
                        <section className="bg-white dark:bg-zinc-900 border border-brand-navy/20 dark:border-brand-navy-light/20 rounded-[2.5rem] p-5 sm:p-7 shadow-sm mb-10">
                            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-6">
                                <div className="flex items-center gap-2">
                                    <MessageSquare size={20} className="text-brand-navy" />
                                    <h2 className="text-base font-black text-zinc-900 dark:text-white">담임 코치 종합 피드백</h2>
                                </div>
                            </div>
                            <div className="min-h-[100px] text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed text-sm">
                                {statsSummary?.coachFeedback || "작성된 피드백이 없습니다."}
                            </div>
                        </section>
                    )}
                                </>
                    )}
                </div>
                </main>
        </div>
    );
}
