"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Calendar, Save, Trash2, Plus, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { DatePickerInput } from "@/components/ui/DatePickerInput";
import { AthleteSearch } from "@/components/ui/AthleteSearch";
import { formatLocalDate } from "@/lib/utils";

type TestPart = 
    | "driver" 
    | "wood_iron" 
    | "pitch" 
    | "approach" 
    | "bunker" 
    | "long_putt" 
    | "middle_putt" 
    | "short_putt";

interface ShotResult {
    id: number;
    result: "fairway" | "rough" | "penalty" | null;
}

const partOptions: { key: TestPart; label: string }[] = [
    { key: "driver", label: "드라이버" },
    { key: "wood_iron", label: "우드/아이언" },
    { key: "pitch", label: "피치샷" },
    { key: "approach", label: "어프로치" },
    { key: "bunker", label: "벙커" },
    { key: "long_putt", label: "롱퍼팅" },
    { key: "middle_putt", label: "미들퍼팅" },
    { key: "short_putt", label: "숏퍼팅" },
];

const SCORING = {
    fairway: -0.17,
    rough: 0.23,
    penalty: 0.75
};

export default function CreateTestPage() {
    const router = useRouter();
    const [selectedPlayer, setSelectedPlayer] = useState("");
    const [testDate, setTestDate] = useState(() => formatLocalDate());
    const [selectedPart, setSelectedPart] = useState<TestPart | null>(null);
    
    // Driver specific state
    const [driverShots, setDriverShots] = useState<ShotResult[]>(
        Array.from({ length: 6 }, (_, i) => ({ id: i + 1, result: null }))
    );

    const totalDriverScore = useMemo(() => {
        return driverShots.reduce((acc, shot) => {
            if (!shot.result) return acc;
            return acc + SCORING[shot.result];
        }, 0);
    }, [driverShots]);

    const handleDriverResultSelect = (shotId: number, result: "fairway" | "rough" | "penalty") => {
        setDriverShots(prev => prev.map(s => s.id === shotId ? { ...s, result } : s));
    };

    const isSubmitting = false; // Placeholder

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPlayer) {
            alert("선수를 선택해주세요.");
            return;
        }
        if (!selectedPart) {
            alert("테스트 파트를 선택해주세요.");
            return;
        }
        alert("테스트가 저장되었습니다. (추후 기능 구현 예정)");
        router.push("/test");
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
                        테스트 작성
                    </h1>
                </div>

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

                    {/* ── 2. Part Selection ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm">
                        <label className="block text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-4">
                            파트 선택 <span className="text-brand-red">*</span>
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {partOptions.map((opt) => (
                                <button
                                    key={opt.key}
                                    type="button"
                                    onClick={() => setSelectedPart(opt.key)}
                                    className={cn(
                                        "px-4 py-2.5 rounded-full text-xs font-bold transition-all border",
                                        selectedPart === opt.key
                                            ? "bg-brand-navy text-white border-brand-navy shadow-md shadow-brand-navy/20"
                                            : "bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-brand-navy/50"
                                    )}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* ── 3. Detail Input (Driver) ── */}
                    {selectedPart === "driver" && (
                        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                                    드라이버 테스트 (6회)
                                    <div className="group relative">
                                        <Info size={14} className="text-zinc-400 cursor-help" />
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-zinc-900 text-[10px] text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
                                            가중치: 페어웨이({SCORING.fairway}), 러프({SCORING.rough}), 패널티({SCORING.penalty})
                                        </div>
                                    </div>
                                </h3>
                                <div className="text-right">
                                    <span className="text-xs text-zinc-400 block mb-1">합계 점수</span>
                                    <span className={cn(
                                        "text-xl font-black italic",
                                        totalDriverScore <= 0 ? "text-emerald-500" : "text-brand-red"
                                    )}>
                                        {totalDriverScore > 0 ? `+${totalDriverScore.toFixed(1)}` : totalDriverScore.toFixed(1)}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {driverShots.map((shot) => (
                                    <div key={shot.id} className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                                        <span className="w-8 h-8 flex items-center justify-center bg-white dark:bg-zinc-900 rounded-full text-xs font-black text-zinc-400 border border-zinc-200 dark:border-zinc-700 shrink-0">
                                            {shot.id}
                                        </span>
                                        <div className="grid grid-cols-3 gap-2 flex-1">
                                            {(["fairway", "rough", "penalty"] as const).map((res) => (
                                                <button
                                                    key={res}
                                                    type="button"
                                                    onClick={() => handleDriverResultSelect(shot.id, res)}
                                                    className={cn(
                                                        "py-2.5 rounded-xl text-[11px] font-black transition-all border",
                                                        shot.result === res
                                                            ? res === "fairway" 
                                                                ? "bg-emerald-500 text-white border-emerald-500 shadow-sm" 
                                                                : res === "rough"
                                                                    ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                                                                    : "bg-red-500 text-white border-red-500 shadow-sm"
                                                            : "bg-white dark:bg-zinc-900 text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400"
                                                    )}
                                                >
                                                    {res === "fairway" ? "페어웨이" : res === "rough" ? "러프" : "패널티"}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Placeholder for other parts */}
                    {selectedPart && selectedPart !== "driver" && (
                        <div className="py-20 text-center bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-[2rem]">
                            <p className="text-zinc-400 text-sm font-medium">
                                {partOptions.find(o => o.key === selectedPart)?.label} 상세 입력 기능은 준비 중입니다.
                            </p>
                        </div>
                    )}

                    {/* ── Actions ── */}
                    <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-lg border-t border-zinc-200 dark:border-zinc-800 flex justify-center z-50">
                        <div className="w-full max-w-3xl flex gap-3">
                            <button
                                type="button"
                                onClick={() => router.back()}
                                className="flex-1 py-4 rounded-2xl text-sm font-bold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 transition-all"
                            >
                                취소
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || !selectedPlayer || !selectedPart}
                                className="flex-[2] py-4 rounded-2xl text-sm font-bold text-white bg-brand-red hover:bg-brand-red-dark disabled:bg-zinc-300 dark:disabled:bg-zinc-800 transition-all shadow-lg shadow-brand-red/20 flex items-center justify-center gap-2"
                            >
                                <Save size={18} />
                                테스트 결과 저장
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
