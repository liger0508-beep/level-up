"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export type TrainingType = "basic" | "preview" | "review" | "lesson_review" | "swing_pose" | "motion_test";

export interface TrainingData {
    id: string;
    type: TrainingType; // Part: basic, preview, review
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
    basic: {
        label: "기본기",
        bg: "bg-emerald-50 text-emerald-600 border-l-emerald-500",
        text: "text-emerald-600",
        border: "border-l-emerald-500",
    },
    preview: {
        label: "예습",
        bg: "bg-blue-50 text-blue-600 border-l-blue-500",
        text: "text-blue-600",
        border: "border-l-blue-500",
    },
    review: {
        label: "복습",
        bg: "bg-orange-50 text-orange-600 border-l-orange-500",
        text: "text-orange-600",
        border: "border-l-orange-500",
    },
    lesson_review: {
        label: "스윙키",
        bg: "bg-purple-50 text-purple-600 border-l-purple-500",
        text: "text-purple-600",
        border: "border-l-purple-500",
    },
    swing_pose: {
        label: "스윙모션",
        bg: "bg-rose-50 text-rose-600 border-l-rose-500",
        text: "text-rose-600",
        border: "border-l-rose-500",
    },
    motion_test: {
        label: "모션",
        bg: "bg-teal-50 text-teal-600 border-l-teal-500",
        text: "text-teal-600",
        border: "border-l-teal-500",
    },
};

interface TrainingCardProps {
    training: TrainingData;
}

export function TrainingCard({ training }: TrainingCardProps) {
    const badge = typeBadgeConfig[training.type] || typeBadgeConfig.basic;

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
