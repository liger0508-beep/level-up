"use client";

import React from "react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";

export type DatePresetType = "monthly" | "weekly" | "today" | "custom";

interface DatePresetsProps {
    onPresetChange: (start: string, end: string, preset: DatePresetType) => void;
    activePreset: DatePresetType;
    className?: string;
}

export function DatePresets({ onPresetChange, activePreset, className }: DatePresetsProps) {
    const applyPreset = (preset: "monthly" | "weekly" | "today") => {
        const now = new Date();
        let start = "";
        let end = "";

        if (preset === "monthly") {
            start = format(startOfMonth(now), "yyyy-MM-dd");
            end = format(endOfMonth(now), "yyyy-MM-dd");
        } else if (preset === "weekly") {
            start = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
            end = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
        } else {
            const todayStr = format(now, "yyyy-MM-dd");
            start = todayStr;
            end = todayStr;
        }
        onPresetChange(start, end, preset);
    };

    const btnClass = (preset: DatePresetType) =>
        cn(
            "px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200",
            activePreset === preset
                ? "bg-brand-navy text-white shadow-sm"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100"
        );

    return (
        <div className={cn("flex items-center", className)}>
            <div className="flex items-center bg-white dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <button onClick={() => applyPreset("monthly")} className={btnClass("monthly")}>월간</button>
                <button onClick={() => applyPreset("weekly")} className={btnClass("weekly")}>주간</button>
                <button onClick={() => applyPreset("today")} className={btnClass("today")}>오늘</button>
            </div>
        </div>
    );
}
