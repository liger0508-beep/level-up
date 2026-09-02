import React from "react";
import { cn } from "@/lib/utils";

export function PageTitle({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <h1 className={cn("text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50", className)}>
      {children}
    </h1>
  );
}

export function SectionTitle({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <h3 className={cn("text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2", className)}>
      {children}
    </h3>
  );
}

export function LabelText({ children, className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("block text-sm font-semibold text-zinc-700 dark:text-zinc-300", className)} {...props}>
      {children}
    </label>
  );
}

export function BodyText({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <p className={cn("text-sm font-normal text-zinc-700 dark:text-zinc-300 leading-relaxed", className)}>
      {children}
    </p>
  );
}

export function Caption({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <span className={cn("text-xs font-medium text-zinc-500 dark:text-zinc-400", className)}>
      {children}
    </span>
  );
}

export function Badge({
  children,
  className,
  variant = "navy"
}: {
  children: React.ReactNode,
  className?: string,
  variant?: "navy" | "red" | "emerald" | "amber" | "teal" | "orange" | "sky" | "blue" | "zinc" | "violet"
}) {
  const variants = {
    navy: "bg-brand-navy/5 text-brand-navy dark:bg-brand-navy/20 dark:text-brand-navy-light",
    red: "bg-brand-red/10 text-brand-red dark:bg-brand-red/20 dark:text-brand-red-light",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
    teal: "bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400",
    orange: "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400",
    sky: "bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-400",
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
    zinc: "bg-zinc-50 text-zinc-600 dark:bg-zinc-900/20 dark:text-zinc-400",
    violet: "bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400",
  };

  return (
    <span className={cn("text-[10px] font-bold uppercase px-2 py-1 rounded-md", variants[variant], className)}>
      {children}
    </span>
  );
}