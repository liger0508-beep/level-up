"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { Search, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchCoaches } from "@/lib/coach-sync";

interface CoachSearchProps {
    onSelect: (name: string) => void;
    onRemove?: (name: string) => void;
    selectedNames: string[];
    placeholder?: string;
    className?: string;
    showChips?: boolean;
    multi?: boolean;
}

export function CoachSearch({
    onSelect,
    onRemove,
    selectedNames = [],
    placeholder = "코치 이름을 입력하세요...",
    className = "",
    showChips = true,
    multi = true,
}: CoachSearchProps) {
    const [query, setQuery] = useState("");
    const [allCoaches, setAllCoaches] = useState<string[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchCoaches().then(setAllCoaches);
    }, []);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const suggestions = useMemo(() => {
        if (!query.trim()) return [];
        return allCoaches.filter(c =>
            c.normalize("NFD").toLowerCase().includes(query.normalize("NFD").toLowerCase())
        );
    }, [allCoaches, query]);

    const handleSelect = (name: string) => {
        if (multi) {
            if (!selectedNames.includes(name)) {
                onSelect(name);
            }
        } else {
            onSelect(name);
        }
        setQuery("");
        setIsOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && suggestions.length > 0) {
            e.preventDefault();
            handleSelect(suggestions[0]);
        }
    };

    return (
        <div className={cn("relative w-full", className)} ref={dropdownRef}>
            {/* Selected Chips (Optional) */}
            {showChips && selectedNames.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                    {selectedNames.map((name) => (
                        <span key={name} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-300 text-xs font-bold border border-zinc-200 dark:border-zinc-700">
                            {name}
                            <button type="button" onClick={() => onRemove?.(name)}
                                className="hover:text-red-500 transition-colors">
                                <X size={12} />
                            </button>
                        </span>
                    ))}
                </div>
            )}

            {/* Input Area */}
            <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-brand-navy transition-colors" size={16} />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => {
                        if (query.trim()) setIsOpen(true);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className="w-full pl-9 pr-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/30 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 transition-all font-medium"
                />
            </div>

            {/* Dropdown suggestions */}
            {isOpen && query.trim() !== "" && (
                <div className="absolute z-[60] mt-1 w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl max-h-56 overflow-y-auto overflow-x-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-1 px-1.5 py-1">
                        {suggestions.length > 0 ? (
                            suggestions.map((name) => {
                                const isSelected = selectedNames.includes(name);
                                return (
                                    <button
                                        key={name}
                                        type="button"
                                        onClick={() => handleSelect(name)}
                                        className={cn(
                                            "w-full text-left px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all flex items-center justify-between",
                                            isSelected
                                                ? "bg-zinc-50 dark:bg-zinc-800 text-brand-navy dark:text-brand-navy-light"
                                                : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                        )}
                                    >
                                        {name}
                                        {isSelected && <Check size={14} className="text-brand-navy shrink-0" />}
                                    </button>
                                );
                            })
                        ) : (
                            <div className="px-3 py-4 text-xs text-center text-zinc-500 italic">
                                "{query}" 코치를 찾을 수 없습니다.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
