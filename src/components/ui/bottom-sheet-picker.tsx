"use client";

import React, { useEffect } from 'react';
import { cn } from '@/lib/utils';

export interface BottomSheetPickerProps {
    isOpen: boolean;
    onClose: () => void;
    options: string[];
    value: string;
    onSelect: (val: string) => void;
    title?: string;
}

export function BottomSheetPicker({ isOpen, onClose, options, value, onSelect, title }: BottomSheetPickerProps) {
    useEffect(() => {
        if (isOpen) document.body.style.overflow = "hidden";
        else document.body.style.overflow = "";
        return () => { document.body.style.overflow = ""; };
    }, [isOpen]);

    if (!isOpen) return null;

    // All items: empty + BALL_LOCATIONS (13) = 14 rows
    // Keep each row compact so all fit in ~50vh without scrolling
    const rowCls = (active: boolean) => cn(
        "w-full px-2 py-3 rounded-xl border text-[14px] font-medium text-center transition-all",
        active
            ? "bg-brand-navy/10 border-brand-navy/30 text-brand-navy dark:text-brand-navy-light font-bold shadow-sm"
            : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-100 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 active:bg-zinc-100"
    );

    return (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />

            {/* Sheet */}
            <div
                className="relative bg-white dark:bg-zinc-900 rounded-t-3xl shadow-2xl flex flex-col"
                style={{ animation: "slideUp 0.22s ease-out", maxHeight: "90vh" }}
            >
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-1 shrink-0">
                    <div className="w-10 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                </div>

                {/* Title */}
                {title && (
                    <div className="px-4 py-3 shrink-0">
                        <p className="text-[13px] font-bold text-zinc-800 dark:text-zinc-200 text-center">{title}</p>
                    </div>
                )}

                {/* Options */}
                <div className="flex-1 grid grid-cols-2 gap-2 px-4 pb-4 pt-1 overflow-y-auto">
                    <div className="flex flex-col gap-2">
                        {options.slice(0, Math.ceil(options.length / 2)).map(opt => (
                            <button key={opt} type="button" onClick={() => { onSelect(opt); onClose(); }} className={rowCls(value === opt)}>
                                {opt}
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-col gap-2">
                        {options.slice(Math.ceil(options.length / 2)).map(opt => (
                            <button key={opt} type="button" onClick={() => { onSelect(opt); onClose(); }} className={rowCls(value === opt)}>
                                {opt}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Close */}
                <div className="px-4 pb-4 pt-1 shrink-0 border-t border-zinc-100 dark:border-zinc-800">
                    <button type="button" onClick={onClose}
                        className="w-full py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-[13px] font-semibold text-zinc-600 dark:text-zinc-300 active:bg-zinc-200 transition-colors">
                        닫기
                    </button>
                </div>
            </div>

            <style jsx>{`
                @keyframes slideUp {
                    from { transform: translateY(100%); }
                    to   { transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
