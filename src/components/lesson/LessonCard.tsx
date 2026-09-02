"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { LabelText, BodyText } from "@/components/ui/Typography";

export type LessonType = "shot" | "pitch" | "bunker" | "approach" | "putt" | "physical" | "etc" | "field";

export interface LessonData {
    id: string;
    type: LessonType;
    title: string;
    playerName: string;
    coachName: string;
    comment: string;
    date: string;
    is_corrected?: boolean;
    hasDirectorComment?: boolean;
    updated_at?: string;
    created_at?: string;
    connected_lesson_id?: string | null;
    is_core_lesson?: boolean;
    subLessons?: LessonData[];
}

const typeBadgeConfig: Record<LessonType, { label: string; bg: string; text: string; border: string }> = {
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
        bg: "bg-amber-50 text-amber-600 border-l-amber-500",
        text: "text-amber-600",
        border: "border-l-amber-500",
    },
    etc: {
        label: "Etc",
        bg: "bg-zinc-50 text-zinc-600 border-l-zinc-500",
        text: "text-zinc-600",
        border: "border-l-zinc-500",
    },
    field: {
        label: "Field",
        bg: "bg-violet-50 text-violet-600 border-l-violet-500",
        text: "text-violet-600",
        border: "border-l-violet-500",
    },
};

interface LessonCardProps {
    lesson: LessonData;
}

export function LessonCard({ lesson }: LessonCardProps) {
    const badge = typeBadgeConfig[lesson.type];

    return (
        <Link
            href={`/lessons/${lesson.id}`}
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
            <LabelText className="text-base cursor-pointer">
                {lesson.playerName}
            </LabelText>

            {/* Coach Comment — max 3 lines */}
            <BodyText className="line-clamp-3">
                {lesson.comment}
            </BodyText>
        </Link>
    );
}
