"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export type AnalysisType = "shot" | "short_game" | "physical" | "etc";

export interface AnalysisData {
    id: string;
    type: AnalysisType;
    title: string;
    playerName: string;
    coachName: string;
    comment: string;
    date: string;
    time?: string;
    originalCategory?: string;
}

const typeBadgeConfig: Record<AnalysisType, { label: string; bg: string; text: string; border: string }> = {
    shot: {
        label: "Shot",
        bg: "bg-emerald-50",
        text: "text-emerald-600",
        border: "border-l-emerald-500",
    },
    short_game: {
        label: "Short Game",
        bg: "bg-cyan-50",
        text: "text-cyan-600",
        border: "border-l-cyan-500",
    },
    physical: {
        label: "Physical",
        bg: "bg-amber-50",
        text: "text-amber-600",
        border: "border-l-amber-500",
    },
    etc: {
        label: "Etc",
        bg: "bg-zinc-100",
        text: "text-zinc-600",
        border: "border-l-zinc-400",
    },
};

interface AnalysisCardProps {
    analysis: AnalysisData;
}

export function AnalysisCard({ analysis }: AnalysisCardProps) {
    const badge = (typeBadgeConfig as any)[analysis.type] || typeBadgeConfig.etc;

    return (
        <Link
            href={`/analysis/${analysis.id}`}
            className={cn(
                "block bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-l-4 rounded-2xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-all active:scale-[0.98] cursor-pointer",
                badge.border
            )}
        >
            {/* Category Badge */}
            <span
                className={`inline-flex items-center self-start px-3 py-1 rounded-full text-xs font-bold tracking-wide ${badge.bg} ${badge.text}`}
            >
                {badge.label}
            </span>

            {/* Player Name */}
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                {analysis.playerName}
            </h3>

            {/* Coach Comment — max 3 lines */}
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed line-clamp-3">
                {analysis.comment}
            </p>
        </Link>
    );
}
