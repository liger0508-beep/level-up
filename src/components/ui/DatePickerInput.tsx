import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface DatePickerInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
    value?: string | number | readonly string[];
}

export const DatePickerInput = forwardRef<HTMLInputElement, DatePickerInputProps>(
    ({ className, value, ...props }, ref) => {
        // Only display MM-DD
        const displayValue = value ? value.toString().split("-").slice(1).join("-") : "";

        return (
            <div className={cn("relative cursor-pointer overflow-hidden flex items-center justify-center min-h-[38px]", className)}>
                <span className="pointer-events-none truncate z-0 font-medium">
                    {displayValue || <span className="opacity-50">날짜 선택</span>}
                </span>
                <style>{`
                    .date-picker-input-native::-webkit-calendar-picker-indicator {
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        width: 100%;
                        height: 100%;
                        padding: 0;
                        color: transparent;
                        background: transparent;
                        cursor: pointer;
                        opacity: 0;
                    }
                `}</style>
                <input
                    ref={ref}
                    type="date"
                    value={value}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 date-picker-input-native"
                    {...props}
                />
            </div>
        );
    }
);

DatePickerInput.displayName = "DatePickerInput";