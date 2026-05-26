"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { Search, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchAthletes } from "@/lib/athlete-sync";

interface AthleteSearchProps {
    onSelect: (name: string) => void;
    onRemove?: (name: string) => void;
    selectedNames: string[];
    placeholder?: string;
    className?: string;
    showChips?: boolean;
    multi?: boolean;
}

function getChosung(str: string) {
    const cho = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
    let result = "";
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i) - 44032;
        if (code > -1 && code < 11172) result += cho[Math.floor(code / 588)];
        else result += str.charAt(i);
    }
    return result;
}

export function AthleteSearch({
    onSelect,
    onRemove,
    selectedNames = [],
    placeholder = "선수 이름을 입력하세요...",
    className = "",
    showChips = true,
    multi = true,
}: AthleteSearchProps) {
    const [query, setQuery] = useState("");
    const [allAthletes, setAllAthletes] = useState<string[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchAthletes().then(setAllAthletes);
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
        const normalizedQuery = query.toLowerCase();
        const chosungQuery = getChosung(normalizedQuery);
        
        return allAthletes.filter(a => {
            const normalizedA = a.toLowerCase();
            const chosungA = getChosung(normalizedA);
            return normalizedA.includes(normalizedQuery) || chosungA.includes(chosungQuery);
        });
    }, [allAthletes, query]);

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
                        <span key={name} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 text-xs font-medium border border-blue-200 dark:border-blue-800">
                            {name}
                            <button type="button" onClick={() => onRemove?.(name)}
                                className="hover:text-blue-600 dark:hover:text-blue-100 transition-colors">
                                <X size={12} />
                            </button>
                        </span>
                    ))}
                </div>
            )}

            {/* Input Area */}
            <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-500 transition-colors" size={16} />
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
                    className="w-full pl-9 pr-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 transition-all font-medium"
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
                                                ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                                                : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                        )}
                                    >
                                        {name}
                                        {isSelected && <Check size={14} className="text-blue-500 shrink-0" />}
                                    </button>
                                );
                            })
                        ) : (
                            <div className="px-3 py-4 text-xs text-center text-zinc-500 italic">
                                "{query}" 선수를 찾을 수 없습니다.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
