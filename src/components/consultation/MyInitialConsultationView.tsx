"use client";

import React, { useEffect, useState } from "react";
import {
    ConsultationCategory,
    ConsultationStructuredData,
    CONSULTATION_TEMPLATES,
} from "@/lib/consultation-templates";
import { AthleteSearch } from "@/components/ui/AthleteSearch";
import { cn } from "@/lib/utils";
import {
    MessageSquare,
    Edit2,
    CheckCircle2,
    ChevronDown,
    Save,
    User,
    Calendar,
} from "lucide-react";

interface InitialConsultationRecord {
    id: string;
    date: string;
    title: string;
    athleteName: string;
    author: string;
    category: ConsultationCategory;
    structuredData: ConsultationStructuredData | null;
}

interface MyInitialConsultationViewProps {
    userRole: "athlete" | "parent";
}

export function MyInitialConsultationView({ userRole }: MyInitialConsultationViewProps) {
    const category: Extract<ConsultationCategory, "initial" | "parent_first"> =
        userRole === "athlete" ? "initial" : "parent_first";
    const template = CONSULTATION_TEMPLATES[category];

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [existing, setExisting] = useState<InitialConsultationRecord | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    const [userName, setUserName] = useState("");
    const [athleteName, setAthleteName] = useState("");
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [generalNote, setGeneralNote] = useState("");
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
    const [expandAll, setExpandAll] = useState(false);

    const loadInitial = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/consultations/my-initial", { cache: "no-store" });
            if (!res.ok) throw new Error("불러오기 실패");
            const data = await res.json();
            setUserName(data.userName || "");

            if (data.consultation) {
                const c = data.consultation as InitialConsultationRecord;
                setExisting(c);
                setAthleteName(c.athleteName || "");
                setAnswers(c.structuredData?.answers || {});
                setGeneralNote(c.structuredData?.generalNote || "");
                setIsEditing(false);
            } else {
                setExisting(null);
                setAthleteName(userRole === "athlete" ? data.userName || "" : "");
                setAnswers({});
                setGeneralNote("");
                setIsEditing(true);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadInitial();
    }, [userRole]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const next: Record<string, boolean> = {};
        template.sections.forEach((sec, idx) => {
            const hasAnswer = sec.questions.some((q) => (answers[q.id] || "").trim().length > 0);
            next[sec.id] = idx === 0 || hasAnswer;
        });
        setOpenSections(next);
    }, [isEditing, category]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleToggleExpandAll = () => {
        const target = !expandAll;
        setExpandAll(target);
        const next: Record<string, boolean> = {};
        template.sections.forEach((sec) => {
            next[sec.id] = target;
        });
        setOpenSections(next);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (userRole === "parent" && !athleteName.trim()) {
            alert("자녀 선수를 선택해 주세요.");
            return;
        }

        const hasAnyAnswer = Object.values(answers).some((v) => v.trim().length > 0);
        if (!hasAnyAnswer && !generalNote.trim()) {
            alert("최소 1개 이상의 항목을 작성해 주세요.");
            return;
        }

        setIsSaving(true);
        try {
            const res = await fetch("/api/consultations/my-initial", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    athleteName: userRole === "athlete" ? userName : athleteName,
                    answers,
                    generalNote,
                }),
            });

            const result = await res.json();
            if (!res.ok) {
                throw new Error(result.error || "저장에 실패했습니다.");
            }

            alert(existing ? "초기 상담 내용이 수정되었습니다." : "초기 상담이 등록되었습니다.");
            await loadInitial();
        } catch (err: any) {
            alert(err?.message || "저장 중 오류가 발생했습니다.");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center text-sm text-zinc-400">
                불러오는 중...
            </div>
        );
    }

    const totalQuestions = template.sections.reduce((acc, s) => acc + s.questions.length, 0);
    const answeredCount = template.sections.reduce(
        (acc, s) =>
            acc + s.questions.filter((q) => (answers[q.id] || "").trim().length > 0).length,
        0
    );

    return (
        <div className="p-4 sm:p-8 max-w-3xl mx-auto pb-24 space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <MessageSquare size={24} className="text-brand-navy dark:text-brand-navy-light shrink-0" />
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                            {template.title}
                        </h1>
                        <p className="text-xs text-zinc-500 mt-0.5">
                            {userRole === "athlete"
                                ? "담당 코치가 선수 파악 및 맞춤 지도에 참고하는 초기 상담표입니다."
                                : "코치가 선수를 깊이 이해하고 지도 방향을 세우는 데 참고하는 학부모 첫 상담표입니다."}
                        </p>
                    </div>
                </div>

                {existing && !isEditing && (
                    <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-navy hover:bg-brand-navy/90 text-white text-xs sm:text-sm font-bold shadow-sm transition-all shrink-0"
                    >
                        <Edit2 size={14} />
                        수정하기
                    </button>
                )}
            </div>

            {/* Read View (Submitted) */}
            {existing && !isEditing ? (
                <div className="space-y-4">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 shadow-sm">
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                                <CheckCircle2 size={13} />
                                작성 완료
                            </span>
                            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                                {existing.athleteName} 선수
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                            <Calendar size={13} />
                            <span>{existing.date.replace(/-/g, ".")}</span>
                        </div>
                    </div>

                    {template.sections.map((sec) => {
                        const answered = sec.questions.filter((q) => (answers[q.id] || "").trim().length > 0);
                        if (answered.length === 0) return null;
                        return (
                            <section
                                key={sec.id}
                                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4 shadow-sm"
                            >
                                <h2 className="text-sm font-bold text-brand-navy dark:text-brand-navy-light border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
                                    {sec.title}
                                </h2>
                                <div className="space-y-3.5">
                                    {answered.map((q) => (
                                        <div key={q.id} className="space-y-1.5">
                                            <p className="text-xs sm:text-sm font-bold text-zinc-700 dark:text-zinc-200">
                                                {q.number ? (
                                                    <span className="inline-flex items-center justify-center px-1.5 py-0.5 mr-1.5 rounded bg-brand-navy/10 text-brand-navy dark:bg-brand-navy-light/20 dark:text-brand-navy-light text-[10px] font-extrabold">
                                                        {String(q.number).padStart(2, "0")}
                                                    </span>
                                                ) : null}
                                                {q.question}
                                            </p>
                                            <p className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed bg-zinc-50 dark:bg-zinc-800/50 p-3.5 rounded-xl">
                                                {answers[q.id]}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        );
                    })}

                    {generalNote.trim() && (
                        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-2 shadow-sm">
                            <h2 className="text-sm font-bold text-zinc-700 dark:text-zinc-300">추가 전달 사항</h2>
                            <p className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed">
                                {generalNote}
                            </p>
                        </section>
                    )}
                </div>
            ) : (
                /* Write / Edit View */
                <form onSubmit={handleSubmit} className="space-y-5">
                    {userRole === "parent" && (
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-2.5 shadow-sm">
                            <label className="block text-sm font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                                <User size={15} className="text-brand-navy" />
                                자녀 선수 선택 <span className="text-brand-red">*</span>
                            </label>
                            <AthleteSearch
                                multi={false}
                                selectedNames={athleteName ? [athleteName] : []}
                                onSelect={(name) => setAthleteName(name)}
                                onRemove={() => setAthleteName("")}
                                placeholder="자녀 선수 이름을 검색해 선택하세요..."
                            />
                        </div>
                    )}

                    {/* Progress & Expand All */}
                    <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-semibold text-zinc-500">
                            작성 현황: <strong className="text-brand-navy dark:text-white">{answeredCount}/{totalQuestions}</strong>
                        </span>
                        <button
                            type="button"
                            onClick={handleToggleExpandAll}
                            className="text-xs font-semibold text-zinc-500 hover:text-brand-navy dark:hover:text-zinc-200"
                        >
                            {expandAll ? "모두 접기" : "모두 펼치기"}
                        </button>
                    </div>

                    {/* Accordion Cards */}
                    <div className="space-y-3">
                        {template.sections.map((sec) => {
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
                                            : "bg-zinc-50/70 dark:bg-zinc-900/50 border-zinc-200/70 dark:border-zinc-800"
                                    )}
                                >
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setOpenSections((prev) => ({
                                                ...prev,
                                                [sec.id]: !prev[sec.id],
                                            }))
                                        }
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
                                                            onChange={(e) =>
                                                                setAnswers((prev) => ({
                                                                    ...prev,
                                                                    [q.id]: e.target.value,
                                                                }))
                                                            }
                                                            placeholder={q.placeholder || "답변을 편하게 작성해 주세요..."}
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

                    {/* Extra Note */}
                    <div className="rounded-2xl bg-zinc-50/70 dark:bg-zinc-800/30 border border-zinc-200/80 dark:border-zinc-800 p-4 space-y-2">
                        <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300">
                            코치에게 추가로 전달할 내용 (선택)
                        </label>
                        <textarea
                            rows={3}
                            value={generalNote}
                            onChange={(e) => setGeneralNote(e.target.value)}
                            placeholder="코치가 미리 알아두면 좋은 사항이 있다면 적어주세요..."
                            className="w-full min-h-[84px] px-3.5 py-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/20 transition-all resize-y"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2.5 pt-2">
                        {existing && (
                            <button
                                type="button"
                                onClick={() => setIsEditing(false)}
                                className="px-5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-bold text-zinc-600 dark:text-zinc-300"
                            >
                                취소
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-brand-navy hover:bg-brand-navy/90 text-white text-sm font-bold shadow-md transition-all disabled:opacity-50"
                        >
                            <Save size={15} />
                            {isSaving ? "저장 중..." : existing ? "수정 저장" : "초기 상담 제출"}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}

