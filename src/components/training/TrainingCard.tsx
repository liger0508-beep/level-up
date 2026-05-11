"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export type TrainingType = "shot" | "pitch" | "bunker" | "approach" | "putt" | "physical" | "field" | "etc";

export interface TrainingData {
    id: string;
    type: TrainingType; // Part: shot, pitch, bunker, approach, putt, physical, etc
    trainingType?: "intensive" | "group" | "special"; // 집중, 단체, 특별
    title: string;
    playerName: string;
    coachName: string;
    content?: string;
    comment: string;
    date: string;
    startTime?: string;
    endTime?: string;
    completion_logs?: string[];
    total_count?: number;
}

const typeBadgeConfig: Record<TrainingType, { label: string; bg: string; text: string; border: string }> = {
    shot: {
        label: "Shot",
        bg: "bg-emerald-50 text-emerald-600 border-l-emerald-500",
        text: "text-emerald-600",
        border: "border-l-emerald-500",
    },
    pitch: {
        label: "Pitch",
        bg: "bg-teal-50 text-teal-600 border-l-teal-500",
        text: "text-teal-600",
        border: "border-l-teal-500",
    },
    bunker: {
        label: "Bunker",
        bg: "bg-orange-50 text-orange-600 border-l-orange-500",
        text: "text-orange-600",
        border: "border-l-orange-500",
    },
    approach: {
        label: "Approach",
        bg: "bg-sky-50 text-sky-600 border-l-sky-500",
        text: "text-sky-600",
        border: "border-l-sky-500",
    },
    putt: {
        label: "Putt",
        bg: "bg-blue-50 text-blue-600 border-l-blue-500",
        text: "text-blue-600",
        border: "border-l-blue-500",
    },
    physical: {
        label: "Physical",
        bg: "bg-rose-50 text-rose-600 border-l-rose-500",
        text: "text-rose-600",
        border: "border-l-rose-500",
    },
    field: {
        label: "Field",
        bg: "bg-indigo-50 text-indigo-600 border-l-indigo-500",
        text: "text-indigo-600",
        border: "border-l-indigo-500",
    },
    etc: {
        label: "Etc",
        bg: "bg-zinc-50 text-zinc-600 border-l-zinc-500",
        text: "text-zinc-600",
        border: "border-l-zinc-500",
    },
};

interface TrainingCardProps {
    training: TrainingData;
}

export function TrainingCard({ training }: TrainingCardProps) {
    const badge = typeBadgeConfig[training.type] || typeBadgeConfig.etc;

    return (
        <Link
            href={`/training/${training.id}`}
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
                {training.playerName}
            </h3>

            {/* Coach Comment — max 3 lines */}
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed line-clamp-3">
                {training.comment}
            </p>
        </Link>
    );
}
