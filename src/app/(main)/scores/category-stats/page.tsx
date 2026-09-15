"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { calculateScorecardAnalysis, HoleAnalysis } from "@/lib/score-calculations";
import { DatePickerInput } from "@/components/ui/DatePickerInput";
import { CATEGORY_OPTIONS, BRANCH_OPTIONS } from "./constants";
import {
    BarChart3,
    Search,
    Loader2,
    Calendar,
    ChevronDown,
    MapPin,
    ListFilter,
    ArrowUpDown
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AthleteStats {
    athleteId: string;
    athleteName: string;
    branch: string;
    rounds: number;
    score: number;
    playContent: number;
    scoreVsContent: number;
    longVsShort: number;
    teeTotal: number;
    teeDistance: number;
    teeAccuracy: number;
    secondTotal: number;
    dist180Plus: number;
    dist150_179: number;
    dist120_149: number;
    dist90_119: number;
    greenTotal: number;
    pitchShot: number;
    bunker: number;
    approach: number;
    puttingTotal: number;
    putt9Plus: number;
    putt4_8: number;
    putt2_3: number;
    putt1: number;
    fairwayHitRate: number;
    girRate: number;
    parSaveRate: number;
    putts: number;
    threePutt: number;
    penaltyOB: number;
    bounceBack: number;
    birdieOrBetter: number;
}

export default function CategoryStatsPage() {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const firstDayOfMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    const [startDate, setStartDate] = useState(firstDayOfMonthStr);
    const [endDate, setEndDate] = useState(todayStr);
    const [selectedBranch, setSelectedBranch] = useState("all");
    const [selectedCategories, setSelectedCategories] = useState<string[]>(["score"]);
    const [sortCategory, setSortCategory] = useState("score");
    const [isCategoryOpen, setIsCategoryOpen] = useState(false);
    const categoryRef = useRef<HTMLDivElement>(null);
    const [holeType, setHoleType] = useState<18 | 9>(18);
    const [isSortInverted, setIsSortInverted] = useState(false);

    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [athleteStatsList, setAthleteStatsList] = useState<AthleteStats[]>([]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (categoryRef.current && !categoryRef.current.contains(event.target as Node)) {
                setIsCategoryOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSearch = async () => {
        setLoading(true);
        setHasSearched(true);
        const supabase = createClient();

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const searchParams = new URLSearchParams({
                startDate,
                endDate,
                holeType: holeType.toString(),
            });

            const res = await fetch(`/api/stats/category?${searchParams.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${session?.access_token || ''}`
                }
            });

            if (!res.ok) {
                throw new Error("Failed to fetch stats");
            }

            const rawStats: AthleteStats[] = await res.json();
            
            // Filter by branch locally since API returns all branches
            let filteredStats = rawStats;
            if (selectedBranch !== "all") {
                filteredStats = rawStats.filter(s => s.branch === selectedBranch);
            }

            setAthleteStatsList(filteredStats);
        } catch (error) {
            console.error("Error fetching stats:", error);
            setAthleteStatsList([]);
        } finally {
            setLoading(false);
        }
    };

    // Derived sorted list
    const sortedStats = useMemo(() => {
        if (athleteStatsList.length === 0) return [];
        
        // Define ascending vs descending based on category. 
        const isDescending = ["fairwayHitRate", "girRate", "parSaveRate", "bounceBack", "birdieOrBetter"].includes(sortCategory);
        const isAscending = !isDescending;

        let sorted = [...athleteStatsList].sort((a, b) => {
            const valA = (a as any)[sortCategory] || 0;
            const valB = (b as any)[sortCategory] || 0;
            
            if (isAscending) {
                return valA - valB;
            } else {
                return valB - valA;
            }
        });
        
        if (isSortInverted) {
            sorted.reverse();
        }
        
        return sorted;
    }, [athleteStatsList, sortCategory, isSortInverted]);

    const formatValue = (val: number, category: string) => {
        if (["fairwayHitRate", "girRate", "parSaveRate", "bounceBack"].includes(category)) {
            return `${val.toFixed(1)}%`;
        }
        if (["putts", "threePutt", "penaltyOB", "birdieOrBetter"].includes(category)) {
            return `${val.toFixed(1)}`;
        }
        if (["score", "playContent"].includes(category)) {
            return `${val.toFixed(1)}`;
        }
        // SG values (including scoreVsContent, longVsShort)
        const sign = val > 0 ? "+" : "";
        return `${sign}${val.toFixed(2)}`;
    };

    return (
        <div className="p-4 sm:p-8 max-w-4xl mx-auto pb-24 min-h-screen">
            <div className="flex items-center gap-2 mb-6">
                <BarChart3 size={24} className="text-brand-navy shrink-0" />
                <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                    항목별 통계
                </h1>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] p-5 mb-6 shadow-sm">
                
                {/* Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-4">
                    {/* Date Range */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
                        <label className="w-auto sm:w-20 shrink-0 text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1 pl-1 sm:pl-0">
                            <Calendar size={14} className="text-zinc-400"/> 일자
                        </label>
                        <div className="flex items-center gap-1 w-full sm:flex-1">
                            <DatePickerInput 
                                value={startDate} 
                                onClick={(e:any)=>e.target.showPicker?.()} 
                                onChange={(e)=>setStartDate(e.target.value)} 
                                className="w-full px-2 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent text-[13px] text-center" 
                            />
                            <span className="text-zinc-400 shrink-0 text-xs">~</span>
                            <DatePickerInput 
                                value={endDate} 
                                onClick={(e:any)=>e.target.showPicker?.()} 
                                onChange={(e)=>setEndDate(e.target.value)} 
                                className="w-full px-2 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent text-[13px] text-center" 
                            />
                        </div>
                    </div>

                    {/* Hole Type */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
                        <label className="w-auto sm:w-20 shrink-0 text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1 pl-1 sm:pl-0">
                            라운드
                        </label>
                        <div className="flex items-center gap-2 w-full sm:flex-1">
                            <button onClick={() => setHoleType(18)} className={cn("px-4 py-2 rounded-xl text-sm font-bold transition-all flex-1", holeType === 18 ? "bg-brand-navy text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700")}>18홀</button>
                            <button onClick={() => setHoleType(9)} className={cn("px-4 py-2 rounded-xl text-sm font-bold transition-all flex-1", holeType === 9 ? "bg-brand-navy text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700")}>9홀</button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-4">
                    {/* Branch */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
                        <label className="w-auto sm:w-20 shrink-0 text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1 pl-1 sm:pl-0">
                            <MapPin size={14} className="text-zinc-400"/> 지점
                        </label>
                        <div className="flex items-center gap-2 w-full sm:flex-1">
                            {BRANCH_OPTIONS.map(opt => (
                                <button 
                                    key={opt.value} 
                                    onClick={() => setSelectedBranch(opt.value)} 
                                    className={cn("px-2 py-2 rounded-xl text-[13px] font-bold transition-all flex-1 whitespace-nowrap", selectedBranch === opt.value ? "bg-brand-navy text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700")}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 mb-4">
                    <label className="w-auto sm:w-20 shrink-0 text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1 pl-1 sm:pl-0">
                        <ListFilter size={14} className="text-zinc-400"/> 통계 항목
                    </label>
                    <div className="relative w-full sm:flex-1" ref={categoryRef}>
                        <button
                            type="button"
                            onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent text-sm font-bold text-brand-navy focus:ring-2 focus:ring-brand-navy/30 focus:outline-none"
                        >
                            <span className="flex-1 text-center">
                                {selectedCategories.length === 0 
                                    ? "항목을 선택하세요"
                                    : selectedCategories.length === 1
                                    ? CATEGORY_OPTIONS.find(opt => opt.value === selectedCategories[0])?.label
                                    : `${CATEGORY_OPTIONS.find(opt => opt.value === selectedCategories[0])?.label} 외 ${selectedCategories.length - 1}`
                                }
                            </span>
                            <ChevronDown size={14} className={cn("text-zinc-400 transition-transform shrink-0 ml-2", isCategoryOpen && "rotate-180")} />
                        </button>
                        
                        {isCategoryOpen && (
                            <div className="absolute z-50 w-full mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-lg max-h-[300px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] py-1">
                                {CATEGORY_OPTIONS.map(opt => {
                                    const isSelected = selectedCategories.includes(opt.value);
                                    return (
                                        <button
                                            key={opt.value}
                                            onClick={() => {
                                                if (isSelected) {
                                                    setSelectedCategories(prev => prev.filter(c => c !== opt.value));
                                                } else {
                                                    setSelectedCategories(prev => [...prev, opt.value]);
                                                }
                                            }}
                                            className={cn(
                                                "w-full px-3 py-2.5 text-sm font-bold text-center transition-colors",
                                                isSelected 
                                                    ? "text-brand-navy bg-brand-navy/10 dark:bg-brand-navy/20 dark:text-brand-navy-light" 
                                                    : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700/50"
                                            )}
                                        >
                                            {opt.label}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="flex justify-end pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <button 
                        onClick={handleSearch}
                        disabled={loading}
                        className="px-6 py-2.5 rounded-xl bg-brand-navy text-white text-sm font-bold flex items-center justify-center gap-2 transition-all hover:bg-brand-navy-dark disabled:opacity-50"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                        조회하기
                    </button>
                </div>
            </div>

            {/* Results */}
            <section>
                <div className="flex items-center justify-between mb-3 px-2">
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-200">
                            순위별 결과
                        </h2>
                    </div>
                    {sortedStats.length > 0 && (
                        <span className="text-xs font-medium text-zinc-500">
                            총 {sortedStats.length}명 조회됨
                        </span>
                    )}
                </div>

                <div className="relative">
                    {loading && (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/60 dark:bg-zinc-950/60 backdrop-blur-[1px] rounded-[2.5rem]">
                            <Loader2 className="w-8 h-8 text-brand-navy animate-spin mb-2" />
                            <p className="text-zinc-600 dark:text-zinc-400 font-bold text-sm">데이터 조회 중...</p>
                        </div>
                    )}
                    
                    {!hasSearched ? (
                        <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem]">
                            <Search size={32} className="text-zinc-400 mb-4" />
                            <p className="text-zinc-500 font-bold text-sm">조건을 설정하고 조회 버튼을 눌러주세요.</p>
                        </div>
                    ) : sortedStats.length === 0 && !loading ? (
                        <div className="py-20 text-center text-zinc-500 font-bold text-sm bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800">
                            해당 기간에 기록이 없습니다.
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm relative overflow-hidden">
                            <div className="overflow-x-auto max-w-full">
                                <table className="w-full text-left min-w-max relative border-collapse">
                                    <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800">
                                        <tr>
                                            <th className="sticky left-0 z-20 bg-zinc-50 dark:bg-zinc-800/90 px-1 sm:px-4 py-3 text-xs font-black text-zinc-400 uppercase text-center w-12 sm:w-16 whitespace-nowrap">순위</th>
                                            <th className="sticky left-[48px] sm:left-[64px] z-20 bg-zinc-50 dark:bg-zinc-800/90 px-1 sm:px-4 py-3 text-xs font-black text-zinc-400 uppercase text-center w-20 sm:w-28 whitespace-nowrap shadow-[inset_-1px_0_0_0_rgba(0,0,0,0.05)] dark:shadow-[inset_-1px_0_0_0_rgba(255,255,255,0.05)]">선수명</th>
                                            <th className="px-1 sm:px-4 py-3 text-xs font-black text-zinc-400 uppercase text-center w-16 sm:w-20 whitespace-nowrap">지점</th>
                                            <th className="px-1 sm:px-4 py-3 text-xs font-black text-zinc-400 uppercase text-center w-12 sm:w-16 whitespace-nowrap">라운드</th>
                                            
                                            {selectedCategories.map(cat => (
                                                <th key={cat} className={cn(
                                                    "px-3 sm:px-6 py-3 text-xs font-black text-brand-navy uppercase text-center min-w-[100px] whitespace-nowrap",
                                                    sortCategory === cat && "bg-red-50/90 dark:bg-red-900/90"
                                                )}>
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button 
                                                            onClick={() => {
                                                                if (sortCategory === cat) setIsSortInverted(!isSortInverted);
                                                                else {
                                                                    setSortCategory(cat);
                                                                    setIsSortInverted(false);
                                                                }
                                                            }}
                                                            className="flex items-center justify-center gap-1.5 hover:opacity-70 transition-opacity"
                                                        >
                                                            {CATEGORY_OPTIONS.find(c => c.value === cat)?.label || "값"}
                                                            {sortCategory === cat && (
                                                                <ArrowUpDown size={14} className={isSortInverted ? "text-brand-navy" : "text-brand-navy/60"} />
                                                            )}
                                                        </button>
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {sortedStats.map((stat, idx) => {
                                            const originalRank = isSortInverted ? sortedStats.length - idx : idx + 1;
                                            
                                            return (
                                                <tr key={stat.athleteId} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition-colors">
                                                    <td className="sticky left-0 z-10 bg-white dark:bg-zinc-900 group-hover:bg-zinc-50 dark:group-hover:bg-zinc-800/50 px-1 sm:px-4 py-3 sm:py-4 text-center">
                                                        <span className={cn(
                                                            "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold",
                                                            originalRank === 1 ? "bg-amber-100 text-amber-700" :
                                                            originalRank === 2 ? "bg-zinc-200 text-zinc-700" :
                                                            originalRank === 3 ? "bg-orange-100 text-orange-800" :
                                                            "text-zinc-500"
                                                        )}>
                                                            {originalRank}
                                                        </span>
                                                    </td>
                                                    <td className="sticky left-[48px] sm:left-[64px] z-10 bg-white dark:bg-zinc-900 group-hover:bg-zinc-50 dark:group-hover:bg-zinc-800/50 px-1 sm:px-4 py-3 sm:py-4 text-center font-bold text-zinc-900 dark:text-zinc-100 text-sm sm:text-base whitespace-nowrap shadow-[inset_-1px_0_0_0_rgba(0,0,0,0.05)] dark:shadow-[inset_-1px_0_0_0_rgba(255,255,255,0.05)]">
                                                        {stat.athleteName}
                                                    </td>
                                                    <td className="px-1 sm:px-4 py-3 sm:py-4 text-center text-xs sm:text-sm font-medium text-zinc-500 whitespace-nowrap">
                                                        {stat.branch.replace("점", "")}
                                                    </td>
                                                    <td className="px-1 sm:px-4 py-3 sm:py-4 text-center text-xs sm:text-sm font-medium text-zinc-500 whitespace-nowrap">
                                                        {stat.rounds}
                                                    </td>
                                                    
                                                    {selectedCategories.map(cat => {
                                                        const rawValue = (stat as any)[cat] || 0;
                                                        let valueColorClass = "text-zinc-900 dark:text-zinc-100";
                                                        if (cat === "score" || cat === "playContent") {
                                                            if (rawValue < 72) valueColorClass = "text-red-500";
                                                            else if (rawValue > 72) valueColorClass = "text-blue-500";
                                                        } else if (cat === "birdieOrBetter") {
                                                            if (rawValue > 0) valueColorClass = "text-red-500";
                                                        } else if (cat === "fairwayHitRate" || cat === "girRate" || cat === "parSaveRate" || cat === "putts" || cat === "bounceBack") {
                                                            valueColorClass = "text-zinc-900 dark:text-zinc-100";
                                                        } else {
                                                            if (rawValue < 0) valueColorClass = "text-red-500";
                                                            else if (rawValue > 0) valueColorClass = "text-blue-500";
                                                        }
                                                        
                                                        return (
                                                            <td key={cat} className={cn(
                                                                "px-3 sm:px-6 py-3 sm:py-4 text-center transition-colors",
                                                                sortCategory === cat && "bg-red-50/90 dark:bg-red-900/90"
                                                            )}>
                                                                <span className={cn("text-base sm:text-lg font-black whitespace-nowrap", valueColorClass)}>
                                                                    {formatValue(rawValue, cat)}
                                                                </span>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
