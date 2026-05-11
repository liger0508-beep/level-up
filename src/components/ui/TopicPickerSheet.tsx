"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X, List, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface TopicItem {
    id: string;
    title: string;
    imageUrl?: string;
}

interface TopicPickerSheetProps {
    items: TopicItem[];
    selectedValues: string[];
    onToggle: (value: string) => void;
    placeholder?: string;
    multiSelect?: boolean;
    trigger?: React.ReactNode;
}

export function TopicPickerSheet({
    items,
    selectedValues,
    onToggle,
    placeholder = "항목 검색...",
    multiSelect = false,
    trigger,
}: TopicPickerSheetProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const sheetRef = useRef<HTMLDivElement>(null);

    const filtered = items.filter((item) =>
        item.title.toLowerCase().includes(query.toLowerCase())
    );

    // Close on outside click (desktop)
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [isOpen]);

    // Prevent body scroll on mobile when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => { document.body.style.overflow = ""; };
    }, [isOpen]);

    const handleSelect = (title: string) => {
        onToggle(title);
        if (!multiSelect) {
            setIsOpen(false);
        }
    };

    return (
        <>
            {/* Trigger Button */}
            {trigger ? (
                <div onClick={() => { setIsOpen(true); setQuery(""); }}>
                    {trigger}
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => { setIsOpen(true); setQuery(""); }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-brand-navy bg-brand-navy/5 hover:bg-brand-navy/10 border border-brand-navy/20 transition-colors"
                >
                    <List size={13} />
                    <span>리스트에서 선택</span>
                </button>
            )}

            {/* Backdrop + Sheet */}
            {isOpen && (
                <>
                    {/* Mobile backdrop */}
                    <div
                        className="fixed inset-0 bg-black/40 z-50 md:hidden"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Mobile: Bottom Sheet / Desktop: Modal */}
                    <div
                        ref={sheetRef}
                        className={cn(
                            "fixed z-50",
                            // Mobile: bottom sheet
                            "inset-x-0 bottom-0 md:inset-auto",
                            // Desktop: centered modal
                            "md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[480px]",
                        )}
                    >
                        <div className={cn(
                            "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col",
                            // Mobile: bottom sheet style
                            "rounded-t-3xl max-h-[80vh]",
                            // Desktop: dialog style
                            "md:rounded-2xl md:max-h-[70vh]",
                        )}>
                            {/* Handle bar (mobile) */}
                            <div className="flex justify-center pt-3 md:hidden">
                                <div className="w-10 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                            </div>

                            {/* Header */}
                            <div className="flex items-center justify-between px-5 pt-4 pb-3">
                                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                                    세부 주제 선택
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Search */}
                            <div className="px-5 pb-3">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                    <input
                                        autoFocus
                                        type="text"
                                        placeholder={placeholder}
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-brand-navy/40 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            {/* Selected count */}
                            {selectedValues.length > 0 && (
                                <div className="px-5 pb-2">
                                    <span className="text-[11px] font-bold text-brand-navy bg-brand-navy/10 px-2.5 py-1 rounded-full">
                                        {selectedValues.length}개 선택됨
                                    </span>
                                </div>
                            )}

                            {/* List */}
                            <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-1.5 min-h-[200px]">
                                {filtered.length > 0 ? (
                                    filtered.map((item) => {
                                        const isSelected = selectedValues.includes(item.id);
                                        const idx = selectedValues.indexOf(item.id);
                                        return (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => handleSelect(item.id)}
                                                className={cn(
                                                    "w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium transition-all text-left",
                                                    isSelected
                                                        ? "bg-brand-navy text-white border-brand-navy shadow-sm"
                                                        : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-brand-navy/50 active:scale-[0.98]"
                                                )}
                                            >
                                                <span className="truncate">{item.title}</span>
                                                {isSelected && (
                                                    <div className="shrink-0 w-5 h-5 bg-white text-brand-navy rounded-full flex items-center justify-center">
                                                        {multiSelect ? (
                                                            <span className="text-[10px] font-black">{idx + 1}</span>
                                                        ) : (
                                                            <Check size={10} />
                                                        )}
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
                                        <Search size={32} className="mb-3 opacity-30" />
                                        <p className="text-sm font-medium">검색 결과가 없습니다.</p>
                                    </div>
                                )}
                            </div>

                            {/* Footer (mobile) */}
                            <div className="px-5 pb-5 pt-2 border-t border-zinc-100 dark:border-zinc-800 md:hidden">
                                <button
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    className="w-full py-3 bg-brand-navy text-white text-sm font-bold rounded-xl active:scale-[0.98] transition-all"
                                >
                                    선택 완료
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
