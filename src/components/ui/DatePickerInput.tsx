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
                <input
                    ref={ref}
                    type="date"
                    value={value}
                    onClick={(e) => {
                        try {
                            // Ensure the element is focused to help mobile browsers anchor the picker
                            (e.target as HTMLInputElement).focus();
                            (e.target as HTMLInputElement).showPicker?.();
                        } catch (err) { }
                    }}
                    // Using a very small opacity instead of 0 can sometimes help browsers 
                    // with positioning the native picker relative to the element.
                    className="absolute inset-0 w-full h-full opacity-[0.01] cursor-pointer z-10 appearance-none"
                    {...props}
                />
            </div>
        );
    }
);

DatePickerInput.displayName = "DatePickerInput";