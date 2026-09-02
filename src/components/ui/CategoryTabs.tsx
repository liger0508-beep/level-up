import React from "react";
import { cn } from "@/lib/utils";

export interface CategoryTabsProps {
    options: any[];
    value: any;
    onChange: (val: any) => void;
    className?: string;
}

export function CategoryTabs({ options, value, onChange, className }: CategoryTabsProps) {
    return (
        <div className={cn("flex flex-nowrap overflow-x-auto gap-2 pb-2 mb-4 scrollbar-hide", className)}>
            {options.map((opt, idx) => {
                const optKey = typeof opt === 'string' ? opt : (opt.key || opt.value || idx);
                const optLabel = typeof opt === 'string' ? opt : (opt.label || opt.key || opt.value || String(optKey));

                return (
                    <button
                        key={optKey}
                        type="button"
                        onClick={() => onChange(optKey)}
                        className={cn(
                            "whitespace-nowrap shrink-0 px-4 py-2.5 rounded-full text-sm font-medium transition-colors border",
                            value === optKey
                                ? "bg-brand-navy text-white border-brand-navy"
                                : "bg-transparent dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-brand-navy/50"
                        )}
                    >
                        {optLabel}
                    </button>
                );
            })}
        </div>
    );
}