import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Upload } from "lucide-react";

export interface FileUploadButtonProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'> {
  label?: string;
  icon?: React.ReactNode;
  iconOnly?: boolean;
  className?: string;
}

export const FileUploadButton = forwardRef<HTMLInputElement, FileUploadButtonProps>(
  ({ label = "파일 추가", icon, iconOnly = false, className, onChange, multiple, accept, capture, disabled, id, ...props }, ref) => {

    const defaultIcon = icon || <Upload size={16} className={cn(!iconOnly && "text-zinc-500")} />;

    return (
      <label
        htmlFor={id}
        className={cn(
          "flex items-center justify-center transition-colors cursor-pointer shrink-0",
          iconOnly
            ? "p-2 text-zinc-400 hover:text-brand-navy hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full"
            : "gap-2 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 shadow-sm",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        {defaultIcon}
        {!iconOnly && <span>{label}</span>}
        <input
          ref={ref}
          id={id}
          type="file"
          className="hidden"
          onChange={onChange}
          multiple={multiple}
          accept={accept}
          capture={capture as any}
          disabled={disabled}
          {...props}
        />
      </label>
    );
  }
);

FileUploadButton.displayName = "FileUploadButton";