"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
    ConsultationCategory,
    ConsultationMainPart,
    CONSULTATION_TEMPLATES,
    getMainPartFromCategory,
} from "@/lib/consultation-templates";
import { Consultation } from "@/lib/consultation-sync";
import { cn } from "@/lib/utils";
import {
    ClipboardList,
    Users,
    CalendarCheck2,
    FileText,
    Info,
    Calendar,
    ChevronDown,
    CheckCircle2,
    Sparkles,
} from "lucide-react";

interface ConsultationTemplateFormProps {
    category: ConsultationCategory;
    onCategoryChange: (cat: ConsultationCategory) => void;
    targetMonth: string;
    onTargetMonthChange: (month: string) => void;
    answers: Record<string, string>;
    onAnswerChange: (questionId: string, value: string) => void;
    generalNote: string;
    onGeneralNoteChange: (value: string) => void;
    previousConsultations?: Consultation[];
    isImportant: boolean;
    onIsImportantChange: (val: boolean) => void;
}

const MAIN_PARTS: {
    key: ConsultationMainPart;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
}[] = [
    { key: "initial", label: "초기 상담", icon: ClipboardList },
    { key: "parent", label: "학부모 상담", icon: Users },
    { key: "regular", label: "정기 상담", icon: CalendarCheck2 },
    { key: "general", label: "일반 상담", icon: FileText },
];

const PARENT_SUBTYPES: {
    key: Extract<ConsultationCategory, "parent_first" | "parent_1st" | "parent_2nd">;
    label: string;
    badge: string;
}[] = [
    { key: "parent_first", label: "신규 첫 상담", badge: "입회 시" },
    { key: "parent_1st", label: "월 1차 상담", badge: "월 초" },
    { key: "parent_2nd", label: "월 2차 상담", badge: "월 중·말" },
];

export function ConsultationTemplateForm({
    category,
    onCategoryChange,
    targetMonth,
    onTargetMonthChange,
    answers,
    onAnswerChange,
    generalNote,
    onGeneralNoteChange,
    previousConsultations = [],
    isImportant,
    onIsImportantChange,
}: ConsultationTemplateFormProps) {
    const mainPart = getMainPartFromCategory(category);
    const activeTemplate = category !== "general" ? CONSULTATION_TEMPLATES[category] : null;

    const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
    const [expandAll, setExpandAll] = useState(false);

    // Initialize open sections when template changes: open first section + any section with answers
    useEffect(() => {
        if (!activeTemplate) return;
        const next: Record<string, boolean> = {};
        activeTemplate.sections.forEach((sec, idx) => {
            const hasAnswer = sec.questions.some((q) => (answers[q.id] || "").trim().length > 0);
            next[sec.id] = idx === 0 || hasAnswer;
        });
        setOpenSections(next);
        setExpandAll(activeTemplate.sections.length <= 2);
    }, [category]); // eslint-disable-line react-hooks/exhaustive-deps

    // For parent_2nd, find matching parent_1st (same targetMonth first, else most recent)
    const latestParent1st = useMemo(() => {
        if (category !== "parent_2nd") return null;
        const p1List = previousConsultations.filter((c) => c.category === "parent_1st");
        if (p1List.length === 0) return null;
        return p1List.find((c) => c.targetMonth === targetMonth) || p1List[0];
    }, [category, previousConsultations, targetMonth]);

    const parent1stConcerns = latestParent1st?.structuredData?.answers?.p1_q3?.trim();

    const handleMainPartClick = (part: ConsultationMainPart) => {
        if (part === "initial") onCategoryChange("initial");
        else if (part === "regular") onCategoryChange("regular");
        else if (part === "general") onCategoryChange("general");
        else if (mainPart !== "parent") {
            onCategoryChange("parent_1st");
        }
    };

    const toggleSection = (secId: string) => {
        setOpenSections((prev) => ({ ...prev, [secId]: !prev[secId] }));
    };

    const handleToggleExpandAll = () => {
        if (!activeTemplate) return;
        const target = !expandAll;
        setExpandAll(target);
        const next: Record<string, boolean> = {};
        activeTemplate.sections.forEach((sec) => {
            next[sec.id] = target;
        });
        setOpenSections(next);
    };

    const showMonthPicker =
        category === "parent_1st" || category === "parent_2nd" || category === "regular";

    const totalQuestions = activeTemplate
        ? activeTemplate.sections.reduce((acc, s) => acc + s.questions.length, 0)
        : 0;
    const answeredCount = activeTemplate
        ? activeTemplate.sections.reduce(
              (acc, s) =>
                  acc + s.questions.filter((q) => (answers[q.id] || "").trim().length > 0).length,
              0
          )
        : 0;

    return (
        <div className="space-y-5">
            {/* 1. Main Part Tabs */}
            <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                    <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300">
                        상담 유형 선택 <span className="text-brand-red">*</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={isImportant}
                            onChange={(e) => onIsImportantChange(e.target.checked)}
                            className="rounded border-zinc-300 text-brand-red focus:ring-brand-red"
                        />
                        중요 표시
                    </label>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {MAIN_PARTS.map((part) => {
                        const Icon = part.icon;
                        const isActive = mainPart === part.key;
                        return (
                            <button
                                key={part.key}
                                type="button"
                                onClick={() => handleMainPartClick(part.key)}
                                className={cn(
                                    "flex items-center justify-center gap-1.5 px-3 py-3 rounded-2xl border text-center transition-all",
                                    isActive
                                        ? "bg-brand-navy border-brand-navy text-white shadow-md"
                                        : "bg-zinc-50/70 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-brand-navy/50"
                                )}
                            >
                                <Icon
                                    size={16}
                                    className={isActive ? "text-white" : "text-brand-navy dark:text-brand-navy-light"}
                                />
                                <span className="text-sm font-bold whitespace-nowrap">{part.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 2. Parent Consultation Subtype Selector */}
            {mainPart === "parent" && (
                <div className="flex flex-wrap items-center gap-2 p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/50">
                    <span className="text-xs font-bold text-amber-800 dark:text-amber-300 px-1.5">
                        세부 구분
                    </span>
                    <div className="flex flex-wrap gap-1.5 flex-1">
                        {PARENT_SUBTYPES.map((sub) => {
                            const isActive = category === sub.key;
                            return (
                                <button
                                    key={sub.key}
                                    type="button"
                                    onClick={() => onCategoryChange(sub.key)}
                                    className={cn(
                                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all",
                                        isActive
                                            ? "bg-amber-500 border-amber-500 text-white shadow-sm"
                                            : "bg-white dark:bg-zinc-900 border-amber-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-amber-400"
                                    )}
                                >
                                    <span>{sub.label}</span>
                                    <span
                                        className={cn(
                                            "text-[10px] px-1.5 py-0.5 rounded-md font-semibold",
                                            isActive
                                                ? "bg-white/20 text-white"
                                                : "bg-amber-100/80 dark:bg-zinc-800 text-amber-700 dark:text-amber-300"
                                        )}
                                    >
                                        {sub.badge}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 3. Target Month Selector */}
            {showMonthPicker && (
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800">
                    <div className="flex items-center gap-2 text-xs font-bold text-zinc-600 dark:text-zinc-300">
                        <Calendar size={14} className="text-brand-navy dark:text-brand-navy-light" />
                        상담 기준 월
                    </div>
                    <input
                        type="month"
                        value={targetMonth}
                        onChange={(e) => onTargetMonthChange(e.target.value)}
                        className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-800 dark:text-zinc-200"
                    />
                </div>
            )}

            {/* 4. Reference Box for parent_2nd showing parent_1st concerns */}
            {category === "parent_2nd" && latestParent1st && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50/60 dark:from-blue-950/30 dark:to-indigo-950/20 border border-blue-200/80 dark:border-blue-800/60 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-300">
                        <Info size={14} />
                        직전 월 1차 상담 요청사항 ({latestParent1st.date})
                    </div>
                    {parent1stConcerns ? (
                        <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                            {parent1stConcerns}
                        </p>
                    ) : (
                        <p className="text-xs text-zinc-500">
                            1차 상담 기록은 있으나 요청사항 항목이 비어 있습니다.
                        </p>
                    )}
                </div>
            )}

            {/* 5. Coaching Dossier Accordion Sections OR General Free Text */}
            {activeTemplate ? (
                <div className="space-y-4">
                    {/* Coaching Chart Header + Progress + Expand All */}
                    <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-brand-navy/10 text-brand-navy dark:bg-brand-navy-light/20 dark:text-brand-navy-light">
                                <Sparkles size={12} />
                                {activeTemplate.title}
                            </span>
                            <span className="text-xs font-semibold text-zinc-400">
                                {answeredCount}/{totalQuestions} 기록
                            </span>
                        </div>
                        {activeTemplate.sections.length > 1 && (
                            <button
                                type="button"
                                onClick={handleToggleExpandAll}
                                className="text-xs font-semibold text-zinc-500 hover:text-brand-navy dark:hover:text-zinc-200 transition-colors"
                            >
                                {expandAll ? "모두 접기" : "모두 펼치기"}
                            </button>
                        )}
                    </div>

                    {/* Quick Section Jump Pills (when 3+ sections) */}
                    {activeTemplate.sections.length >= 3 && (
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                            {activeTemplate.sections.map((sec) => {
                                const filled = sec.questions.filter(
                                    (q) => (answers[q.id] || "").trim().length > 0
                                ).length;
                                const isOpen = !!openSections[sec.id];
                                const shortTitle = sec.title.replace(/^\d+\.\s*/, "");
                                return (
                                    <button
                                        key={sec.id}
                                        type="button"
                                        onClick={() =>
                                            setOpenSections((prev) => ({
                                                ...prev,
                                                [sec.id]: true,
                                            }))
                                        }
                                        className={cn(
                                            "shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                                            isOpen
                                                ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent"
                                                : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400"
                                        )}
                                    >
                                        <span>{shortTitle}</span>
                                        {filled > 0 && (
                                            <span
                                                className={cn(
                                                    "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
                                                    isOpen
                                                        ? "bg-emerald-400 text-zinc-950"
                                                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                                )}
                                            >
                                                {filled}/{sec.questions.length}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Accordion Dossier Cards */}
                    <div className="space-y-3">
                        {activeTemplate.sections.map((sec) => {
                            const isOpen = !!openSections[sec.id];
                            const filledInSec = sec.questions.filter(
                                (q) => (answers[q.id] || "").trim().length > 0
                            ).length;
                            const allFilled = filledInSec === sec.questions.length;

                            return (
                                <div
                                    key={sec.id}
                                    className={cn(
                                        "rounded-2xl border transition-all overflow-hidden",
                                        isOpen
                                            ? "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 shadow-sm"
                                            : "bg-zinc-50/70 dark:bg-zinc-900/50 border-zinc-200/70 dark:border-zinc-800 hover:border-zinc-300"
                                    )}
                                >
                                    {/* Section Toggle Header */}
                                    <button
                                        type="button"
                                        onClick={() => toggleSection(sec.id)}
                                        className="w-full flex items-center justify-between px-4 sm:px-5 py-3.5 text-left gap-3"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            {allFilled ? (
                                                <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                                            ) : (
                                                <span className="w-2 h-2 rounded-full bg-brand-navy dark:bg-brand-navy-light shrink-0" />
                                            )}
                                            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                                {sec.title}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span
                                                className={cn(
                                                    "text-[11px] font-bold px-2 py-0.5 rounded-full",
                                                    filledInSec > 0
                                                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                                                        : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800"
                                                )}
                                            >
                                                {filledInSec}/{sec.questions.length}
                                            </span>
                                            <ChevronDown
                                                size={16}
                                                className={cn(
                                                    "text-zinc-400 transition-transform duration-200",
                                                    isOpen && "rotate-180"
                                                )}
                                            />
                                        </div>
                                    </button>

                                    {/* Section Body */}
                                    {isOpen && (
                                        <div className="px-4 sm:px-5 pb-5 pt-3 space-y-3.5 border-t border-zinc-100 dark:border-zinc-800/80">
                                            {sec.questions.map((q) => {
                                                const val = answers[q.id] || "";
                                                const isFilled = val.trim().length > 0;
                                                return (
                                                    <div
                                                        key={q.id}
                                                        className={cn(
                                                            "p-3.5 sm:p-4 rounded-2xl border transition-all space-y-2.5",
                                                            isFilled
                                                                ? "bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-200/80 dark:border-emerald-800/60"
                                                                : "bg-zinc-50/80 dark:bg-zinc-800/40 border-zinc-200/70 dark:border-zinc-800"
                                                        )}
                                                    >
                                                        <label className="block text-sm sm:text-[15px] font-bold text-zinc-900 dark:text-zinc-50 leading-relaxed">
                                                            {q.number && (
                                                                <>
                                                                    <span
                                                                        className={cn(
                                                                            "inline-flex items-center justify-center px-2 py-0.5 mb-1 sm:mb-0 sm:mr-2 rounded-md text-[11px] font-extrabold sm:align-text-bottom",
                                                                            isFilled
                                                                                ? "bg-emerald-500 text-white"
                                                                                : "bg-brand-navy text-white dark:bg-brand-navy-light dark:text-zinc-900"
                                                                        )}
                                                                    >
                                                                        {String(q.number).padStart(2, "0")}
                                                                    </span>
                                                                    <br className="sm:hidden" />
                                                                </>
                                                            )}
                                                            {q.question}
                                                        </label>
                                                        <textarea
                                                            rows={Math.max(q.rows || 3, 3)}
                                                            value={val}
                                                            onChange={(e) => onAnswerChange(q.id, e.target.value)}
                                                            placeholder={q.placeholder || "핵심 내용을 간단히 메모하세요..."}
                                                            className="w-full min-h-[84px] px-3.5 py-2.5 rounded-xl border border-zinc-200/90 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/15 transition-all resize-y"
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Compact Extra Memo */}
                    <div className="rounded-2xl bg-zinc-50/70 dark:bg-zinc-800/30 border border-zinc-200/80 dark:border-zinc-800 p-4 space-y-2">
                        <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300">
                            코치 종합 메모 (선택)
                        </label>
                        <textarea
                            rows={3}
                            value={generalNote}
                            onChange={(e) => onGeneralNoteChange(e.target.value)}
                            placeholder="상담 전반의 분위기나 특이사항을 자유롭게 메모하세요..."
                            className="w-full min-h-[84px] px-3.5 py-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/20 transition-all resize-y"
                        />
                    </div>
                </div>
            ) : (
                <div className="space-y-2.5">
                    <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300">
                        일반 상담 내용
                    </label>
                    <textarea
                        rows={8}
                        value={generalNote}
                        onChange={(e) => onGeneralNoteChange(e.target.value)}
                        placeholder="비정기적인 면담, 이슈, 특이사항 등을 자유롭게 입력하세요..."
                        className="w-full p-4 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/60 text-sm text-zinc-900 dark:text-zinc-100 focus:bg-white dark:focus:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-navy/20 transition-all resize-y"
                    />
                </div>
            )}
        </div>
    );
}
