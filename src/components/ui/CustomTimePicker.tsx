import React, { useState, useRef, useEffect } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface CustomTimePickerProps {
    value: string; // HH:MM (24-hour format)
    onChange: (val: string) => void;
}

export function CustomTimePicker({ value, onChange }: CustomTimePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const [hStr, mStr] = (value || "23:59").split(':');
    const hInt = parseInt(hStr || "23", 10);
    const currentAmpm = hInt >= 12 ? '오후' : '오전';
    const currentHour = hInt % 12 === 0 ? 12 : hInt % 12;
    const currentMinute = (parseInt(mStr || "59", 10) >= 50) && (mStr !== "59") ? mStr : (mStr === "59" ? "59" : (Math.floor(parseInt(mStr || "0", 10) / 10) * 10).toString().padStart(2, '0'));

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    const updateTime = (ampm: string, hr: number, min: string) => {
        let h24 = hr;
        if (ampm === '오후' && h24 < 12) h24 += 12;
        if (ampm === '오전' && h24 === 12) h24 = 0;
        onChange(`${h24.toString().padStart(2, '0')}:${min}`);
    };

    return (
        <div className="relative w-full sm:w-auto sm:flex-none" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "w-full sm:w-[240px] flex items-center bg-transparent dark:bg-zinc-800 border rounded-xl pl-3 pr-4 py-2.5 text-sm transition-all",
                    isOpen ? "border-brand-navy ring-2 ring-brand-navy/20" : "border-zinc-200 dark:border-zinc-800"
                )}
            >
                <div className="flex items-center gap-1.5 text-zinc-400 mr-4">
                    <Clock size={16} />
                    <span className="font-medium whitespace-nowrap">종료 시간</span>
                </div>
                <div className="flex-1 text-center font-medium text-zinc-900 dark:text-zinc-100">
                    {currentAmpm} {currentHour}시 {currentMinute}분
                </div>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-full sm:w-[240px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden flex animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* AM/PM Column */}
                    <div className="flex-1 border-r border-zinc-100 dark:border-zinc-800 h-48 overflow-y-auto scrollbar-hide py-2">
                        {['오전', '오후'].map(ampm => (
                            <button
                                key={ampm}
                                type="button"
                                onClick={() => updateTime(ampm, currentHour, currentMinute)}
                                className={cn(
                                    "w-full px-2 py-2 text-sm transition-colors text-center font-medium",
                                    currentAmpm === ampm ? "bg-brand-navy/10 text-brand-navy dark:text-brand-navy-light" : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                )}
                            >
                                {ampm}
                            </button>
                        ))}
                    </div>
                    
                    {/* Hour Column */}
                    <div className="flex-1 border-r border-zinc-100 dark:border-zinc-800 h-48 overflow-y-auto scrollbar-hide py-2">
                        {Array.from({ length: 12 }).map((_, i) => {
                            const hr = i + 1;
                            return (
                                <button
                                    key={hr}
                                    type="button"
                                    onClick={() => updateTime(currentAmpm, hr, currentMinute)}
                                    className={cn(
                                        "w-full px-2 py-2 text-sm transition-colors text-center font-medium",
                                        currentHour === hr ? "bg-brand-navy/10 text-brand-navy dark:text-brand-navy-light" : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                    )}
                                >
                                    {hr}시
                                </button>
                            );
                        })}
                    </div>

                    {/* Minute Column */}
                    <div className="flex-1 h-48 overflow-y-auto scrollbar-hide py-2">
                        {['00', '10', '20', '30', '40', '50', '59'].map(min => (
                            <button
                                key={min}
                                type="button"
                                onClick={() => {
                                    updateTime(currentAmpm, currentHour, min);
                                    // Optional: setIsOpen(false) if we want to close after minute selection, 
                                    // but usually people want to adjust all three before clicking outside.
                                }}
                                className={cn(
                                    "w-full px-2 py-2 text-sm transition-colors text-center font-medium",
                                    currentMinute === min ? "bg-brand-navy/10 text-brand-navy dark:text-brand-navy-light" : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                )}
                            >
                                {min}분
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
