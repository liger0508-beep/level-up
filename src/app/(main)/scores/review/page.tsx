"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
    ChevronLeft, Trophy, Calendar, MapPin, User, Search
} from "lucide-react";

interface ScorecardRow {
    id: string;
    round_date: string;
    course_name: string;
    total_score: number | null;
    weather: string | null;
    athlete: { name: string } | null;
}

export default function ScoreReviewPage() {
    const router = useRouter();
    const [scorecards, setScorecards] = useState<ScorecardRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    useEffect(() => {
        const fetchScorecards = async () => {
            const supabase = createClient();
            const { data, error } = await supabase
                .from("scorecards")
                .select(`
                    id,
                    round_date,
                    course_name,
                    total_score,
                    weather,
                    athlete:users!scorecards_athlete_id_fkey(name)
                `)
                .order("round_date", { ascending: false });

            if (!error && data) {
                setScorecards(data as any);
            }
            setLoading(false);
        };
        fetchScorecards();
    }, []);

    const filtered = scorecards.filter(sc => {
        const name = (sc.athlete as any)?.name ?? "";
        const course = sc.course_name ?? "";
        const q = search.toLowerCase();
        return name.toLowerCase().includes(q) || course.toLowerCase().includes(q);
    });

    const scoreDisplay = (score: number | null) => {
        if (score === null) return { text: "-", color: "text-zinc-400" };
        const diff = score - 72;
        if (diff === 0) return { text: `E (${score})`, color: "text-zinc-600 dark:text-zinc-300" };
        if (diff > 0) return { text: `+${diff} (${score})`, color: "text-blue-500" };
        return { text: `${diff} (${score})`, color: "text-red-500" };
    };

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4 sm:px-8 py-6">
            <div className="max-w-3xl mx-auto">

                {/* Header */}
                <div className="flex items-center gap-3 mb-8">
                    <button
                        onClick={() => router.push("/scores")}
                        className="p-2 -ml-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <ChevronLeft size={24} className="text-zinc-900 dark:text-zinc-50" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                            스코어 확인
                        </h1>
                        <p className="text-sm text-zinc-500 mt-0.5">저장된 라운드 스코어카드</p>
                    </div>
                </div>

                {/* Search */}
                <div className="relative mb-5">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                        type="text"
                        placeholder="선수명 또는 골프장 검색..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all"
                    />
                </div>

                {/* List */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-3 border-zinc-200 border-t-brand-navy rounded-full animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-12 text-center">
                        <Trophy size={36} className="text-zinc-300 mx-auto mb-3" />
                        <p className="text-zinc-500 font-medium">저장된 스코어카드가 없습니다.</p>
                        <Link
                            href="/scores/create"
                            className="inline-block mt-4 px-5 py-2 rounded-xl bg-brand-navy text-white text-sm font-semibold hover:bg-brand-navy/90 transition-colors"
                        >
                            스코어 작성하기
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map(sc => {
                            const athleteName = (sc.athlete as any)?.name ?? "알 수 없음";
                            const { text: scoreText, color: scoreColor } = scoreDisplay(sc.total_score);
                            return (
                                <Link
                                    key={sc.id}
                                    href={`/scores/review/${sc.id}`}
                                    className="block bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 hover:border-brand-navy/40 hover:shadow-md transition-all active:scale-[0.99]"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        {/* Left: Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <User size={13} className="text-zinc-400 shrink-0" />
                                                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                                    {athleteName}
                                                </span>
                                                {sc.weather && (
                                                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                                                        {sc.weather}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                                                <MapPin size={11} className="shrink-0" />
                                                <span className="truncate">{sc.course_name}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-xs text-zinc-400 mt-1">
                                                <Calendar size={11} className="shrink-0" />
                                                <span>{sc.round_date}</span>
                                            </div>
                                        </div>

                                        {/* Right: Score */}
                                        <div className="shrink-0 text-right">
                                            <div className={`text-lg font-black ${scoreColor}`}>
                                                {scoreText}
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
