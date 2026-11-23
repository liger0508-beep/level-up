"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import nextDynamic from "next/dynamic";
import Link from "next/link";
import {
    ChevronLeft,
    MessageSquare,
    Save,
    Paperclip,
    X,
    Activity,
    BookOpen,
    Dumbbell,
    Flag,
    History,
    Search as SearchIcon,
    User
} from "lucide-react";
import { format } from "date-fns";
import { formatLocalDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { fetchAthletes } from "@/lib/athlete-sync";
import { createClient } from "@/lib/supabase/client";
import {
    Consultation,
    saveConsultation,
    fetchConsultations,
    getPlainText
} from "@/lib/consultation-sync";
import {
    ConsultationCategory,
    CONSULTATION_CATEGORY_LABELS,
    encodeConsultationContent
} from "@/lib/consultation-templates";
import { ConsultationTemplateForm } from "@/components/consultation/ConsultationTemplateForm";
import { AthleteSearch } from "@/components/ui/AthleteSearch";

// Removed ReactQuill imports and configurations

function CreateConsultationContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentCoach, setCurrentCoach] = useState<{ id: string; name: string } | null>(null);

    // Consultation State
    const [athleteName, setAthleteName] = useState("");
    const [category, setCategory] = useState<ConsultationCategory>("initial");
    const [targetMonth, setTargetMonth] = useState(() => format(new Date(), "yyyy-MM"));
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [generalNote, setGeneralNote] = useState("");
    const [isImportant, setIsImportant] = useState(false);

    // Initialize from searchParams and sessionStorage
    useEffect(() => {
        const player = searchParams.get("player");
        if (player) {
            setAthleteName(player);
        } else {
            const saved = sessionStorage.getItem("draftConsultationAthlete");
            if (saved) {
                setAthleteName(saved);
            }
        }

        const savedNote = sessionStorage.getItem("draftConsultationContent");
        if (savedNote) {
            setGeneralNote(savedNote);
        }
    }, [searchParams]);

    const isInitialMount = useRef(true);

    // Save athlete name to session
    useEffect(() => {
        if (isInitialMount.current) return;
        if (athleteName) {
            sessionStorage.setItem("draftConsultationAthlete", athleteName);
        } else {
            sessionStorage.removeItem("draftConsultationAthlete");
        }
    }, [athleteName]);

    // Save generalNote to session
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        if (generalNote && generalNote !== "<p><br></p>" && generalNote !== "<p></p>") {
            sessionStorage.setItem("draftConsultationContent", generalNote);
        } else if (!generalNote) {
            sessionStorage.removeItem("draftConsultationContent");
        }
    }, [generalNote]);

    // RBAC and User Info
    useEffect(() => {
        const fetchUser = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: dbUser } = await supabase
                    .from("users")
                    .select("id, name, role")
                    .eq("id", user.id)
                    .maybeSingle();

                if (dbUser) {
                    setCurrentCoach({ id: dbUser.id, name: dbUser.name });
                    if (dbUser.role === 'athlete' || dbUser.role === 'parent') {
                        alert("상담 내역 접근 권한이 없습니다.");
                        router.replace("/");
                        return;
                    }
                    if (dbUser.role !== 'coach' && dbUser.role !== 'admin' && dbUser.role !== 'super_admin' && dbUser.role !== 'superadmin') {
                        alert("상담 작성 권한이 없습니다.");
                        router.replace("/");
                    }
                }
            } else {
                router.push("/login");
            }
        };
        fetchUser();
    }, [router]);

    const [previousConsultations, setPreviousConsultations] = useState<Consultation[]>([]);

    useEffect(() => {
        if (athleteName) {
            // Fetch previous consultations
            fetchConsultations().then(data => {
                setPreviousConsultations(data.filter(c => c.athleteName === athleteName).slice(0, 5));
            });
        } else {
            setPreviousConsultations([]);
        }
    }, [athleteName]);

    const handleSelectAthlete = (name: string) => {
        setAthleteName(name);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!athleteName) {
            alert("선수를 선택해 주세요.");
            return;
        }

        const hasAnyAnswer = Object.values(answers).some((v) => v.trim().length > 0);
        const hasNote = generalNote.trim().length > 0 && generalNote !== "<p><br></p>";

        if (category === "general" && !hasNote) {
            alert("상담 내용을 입력해 주세요.");
            return;
        }
        if (category !== "general" && !hasAnyAnswer && !hasNote) {
            alert("최소 1개 이상의 문항 또는 추가 메모를 입력해 주세요.");
            return;
        }

        try {
            setIsSubmitting(true);
            
            // 1. Save to DB
            const dateStr = formatLocalDate();
            const structuredPayload = {
                version: 1 as const,
                category,
                targetMonth:
                    category === "parent_1st" || category === "parent_2nd" || category === "regular"
                        ? targetMonth
                        : undefined,
                answers: category === "general" ? {} : answers,
                generalNote: generalNote.trim() || undefined,
            };
            const encodedContent = encodeConsultationContent(structuredPayload, generalNote);

            await saveConsultation({
                athleteName,
                coachName: currentCoach?.name || "관리자",
                author: currentCoach?.name || "관리자",
                content: encodedContent,
                category,
                targetMonth: structuredPayload.targetMonth,
                structuredData: structuredPayload,
                date: dateStr,
                type: "all",
                isImportant,
                title: `${athleteName} ${CONSULTATION_CATEGORY_LABELS[category]}`
            });

            fetch("/api/push/trigger", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    eventType: "consultation_created",
                    relatedAthleteNames: [athleteName],
                    variables: {
                        athleteName,
                        coachName: currentCoach?.name || "관리자",
                        title: `${athleteName} ${CONSULTATION_CATEGORY_LABELS[category]}`,
                    },
                    url: "/consultations",
                }),
            }).catch(() => {});

            alert("상담 일지가 등록되었습니다.");
            sessionStorage.removeItem("draftConsultationAthlete");
            sessionStorage.removeItem("draftConsultationContent");
            router.push("/consultations");
        } catch (err) {
            console.error(err);
            alert("상담 일지 등록에 실패했습니다.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // removed isEditorEmpty

    return (
        <div className="min-h-screen bg-white dark:bg-zinc-950 px-4 sm:px-8 py-6">
            <div className="max-w-4xl mx-auto">
                {/* ── Header ── */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.back()}
                            className="p-2 -ml-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-50 transition-colors"
                        >
                            <ChevronLeft size={24} />
                        </button>
                        <div className="flex items-center gap-2">
                            <MessageSquare size={24} className="text-brand-navy" />
                            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                                상담 일지 작성
                            </h1>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6 pb-20">
                    {/* ── Desktop Row 1: Consultation Info ── */}
                    <div className="w-full mb-6">
                        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm flex flex-col">
                            <div className="space-y-6 flex-1">
                                {/* Athlete Selection */}
                                <div className="space-y-3">
                                    <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 font-mono tracking-tighter uppercase flex items-center gap-2">
                                        <User size={16} className="text-brand-navy" />
                                        상담 대상 선수 <span className="text-brand-red">*</span>
                                    </label>
                                    <AthleteSearch
                                        multi={false}
                                        selectedNames={athleteName ? [athleteName] : []}
                                        onSelect={(name) => setAthleteName(name)}
                                        onRemove={() => setAthleteName("")}
                                        placeholder="선수 이름을 검색하세요..."
                                    />
                                </div>

                                {/* Structured / General Consultation Form */}
                                <ConsultationTemplateForm
                                    category={category}
                                    onCategoryChange={setCategory}
                                    targetMonth={targetMonth}
                                    onTargetMonthChange={setTargetMonth}
                                    answers={answers}
                                    onAnswerChange={(qId, val) =>
                                        setAnswers((prev) => ({ ...prev, [qId]: val }))
                                    }
                                    generalNote={generalNote}
                                    onGeneralNoteChange={setGeneralNote}
                                    previousConsultations={previousConsultations}
                                    isImportant={isImportant}
                                    onIsImportantChange={setIsImportant}
                                />
                            </div>
                        </section>
                    </div>

                    {/* ── Desktop Row 2: Previous Consultations ── */}
                    <div className="w-full mb-6">
                        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm flex flex-col">
                            <div className="flex items-center gap-2 mb-4 text-zinc-900 dark:text-zinc-50">
                                <History size={18} className="text-brand-navy" />
                                <h2 className="text-sm font-bold font-mono tracking-tighter uppercase">이전 상담내용</h2>
                            </div>
                            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide flex-1">
                                {previousConsultations.map((c) => (
                                    <div key={c.id} className="flex-shrink-0 w-64 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex flex-col justify-between">
                                        <div>
                                            <div className="text-[10px] text-zinc-400 font-bold mb-1">
                                                {c.date} · {CONSULTATION_CATEGORY_LABELS[c.category]}
                                            </div>
                                            <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-2 truncate">{c.title}</div>
                                            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-3 leading-relaxed">
                                                {getPlainText(c.content)}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {previousConsultations.length === 0 && (
                                    <div className="flex items-center justify-center w-full text-xs text-zinc-400 py-4 italic">선택된 선수의 이전 상담 내역이 없습니다.</div>
                                )}
                            </div>
                        </section>
                    </div>

                    {/* ── Global Footers / Actions ── */}
                    <div className="flex items-center justify-end gap-3 pt-6 border-t border-zinc-200 dark:border-zinc-800 mt-6 font-medium">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="px-6 py-2.5 rounded-xl text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors border border-zinc-200 dark:border-zinc-800"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            className="bg-brand-red hover:bg-brand-red-dark text-white px-8 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md active:scale-95"
                        >
                            상담 등록
                        </button>
                    </div>
                </form>
            </div>

                {/* Quill CSS removed */}
        </div>
    );
}

export default function CreateConsultationPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">로딩 중...</div>}>
            <CreateConsultationContent />
        </Suspense>
    );
}
