"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import dynamic from "next/dynamic";
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
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
    Consultation,
    fetchConsultationById,
    updateConsultation,
    fetchRecentActivityByPlayer,
    fetchRecentScorecardByPlayer,
    fetchConsultations
} from "@/lib/consultation-sync";
import {
    ConsultationCategory,
    CONSULTATION_CATEGORY_LABELS,
    encodeConsultationContent,
} from "@/lib/consultation-templates";
import { ConsultationTemplateForm } from "@/components/consultation/ConsultationTemplateForm";
import { AthleteSearch } from "@/components/ui/AthleteSearch";
import { format } from "date-fns";

// Load ReactQuill dynamically to avoid SSR issues
const ReactQuill = dynamic(() => import("react-quill-new"), {
    ssr: false,
    loading: () => <div className="h-64 bg-zinc-50 dark:bg-zinc-900 rounded-xl animate-pulse flex items-center justify-center text-zinc-400">에디터 로딩 중...</div>
});

import "react-quill-new/dist/quill.snow.css";

const quillModules = {
    toolbar: [
        [{ 'header': [1, 2, 3, false] }],
        [{ 'size': ['small', false, 'large', 'huge'] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        [{ 'align': [] }],
        [{ 'color': [] }, { 'background': [] }],
        ['link', 'image', 'video'],
        ['clean']
    ],
};

const quillFormats = [
    'header', 'size',
    'bold', 'italic', 'underline', 'strike',
    'list', 'indent',
    'align', 'color', 'background',
    'link', 'image', 'video'
];

export default function EditConsultationPage() {
    const router = useRouter();
    const params = useParams();
    const { id } = params as { id: string };

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentCoach, setCurrentCoach] = useState<{ id: string; name: string } | null>(null);

    // Consultation State
    const [athleteName, setAthleteName] = useState("");
    const [content, setContent] = useState("");
    const [date, setDate] = useState("");
    const [isImportant, setIsImportant] = useState(false);
    const [category, setCategory] = useState<ConsultationCategory>("general");
    const [targetMonth, setTargetMonth] = useState(() => format(new Date(), "yyyy-MM"));
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [generalNote, setGeneralNote] = useState("");
    const [isLegacyHtml, setIsLegacyHtml] = useState(false);

    // Fetch existing data
    useEffect(() => {
        if (id) {
            fetchConsultationById(id).then(data => {
                if (data) {
                    setAthleteName(data.athleteName);
                    setContent(data.displayContent || data.content);
                    setDate(data.date);
                    setIsImportant(data.isImportant);
                    if (data.structuredData) {
                        setCategory(data.structuredData.category);
                        if (data.structuredData.targetMonth) {
                            setTargetMonth(data.structuredData.targetMonth);
                        }
                        setAnswers(data.structuredData.answers || {});
                        setGeneralNote(data.structuredData.generalNote || (data.structuredData.category === "general" ? (data.displayContent || "") : ""));
                        setIsLegacyHtml(false);
                    } else {
                        setCategory("general");
                        const raw = data.displayContent || data.content || "";
                        setGeneralNote(raw);
                        setIsLegacyHtml(/<[a-z][\s\S]*>/i.test(raw));
                    }
                    setIsLoading(false);
                } else {
                    alert("상담 정보를 찾을 수 없습니다.");
                    router.push("/consultations");
                }
            });
        }
    }, [id, router]);

    // RBAC and User Info
    useEffect(() => {
        const checkAuth = async () => {
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
                        alert("상담 수정 권한이 없습니다.");
                        router.replace("/");
                    }
                }
            } else {
                router.replace("/login");
            }
        };
        checkAuth();
    }, [router]);

    const [previousConsultations, setPreviousConsultations] = useState<Consultation[]>([]);

    useEffect(() => {
        if (athleteName) {
            // Fetch previous consultations
            fetchConsultations().then(data => {
                setPreviousConsultations(data.filter(c => c.athleteName === athleteName && c.id !== id).slice(0, 5));
            });
        } else {
            setPreviousConsultations([]);
        }
    }, [athleteName, id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!athleteName) {
            alert("선수를 선택해 주세요.");
            return;
        }

        const hasAnyAnswer = Object.values(answers).some((v) => v.trim().length > 0);
        const noteText = isLegacyHtml && category === "general" ? content : generalNote;
        const hasNote = noteText.trim().length > 0 && noteText !== "<p><br></p>";

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
            const structuredPayload = {
                version: 1 as const,
                category,
                targetMonth:
                    category === "parent_1st" || category === "parent_2nd" || category === "regular"
                        ? targetMonth
                        : undefined,
                answers: category === "general" ? {} : answers,
                generalNote: noteText.trim() || undefined,
            };
            const encodedContent = encodeConsultationContent(structuredPayload, noteText);

            await updateConsultation(id, {
                athleteName,
                content: encodedContent,
                category,
                targetMonth: structuredPayload.targetMonth,
                structuredData: structuredPayload,
                isImportant,
                title: `${athleteName} ${CONSULTATION_CATEGORY_LABELS[category]}`,
            });

            alert("상담 일지가 수정되었습니다.");
            router.push(`/consultations/${id}`);
        } catch (err) {
            console.error(err);
            alert("상담 일지 수정에 실패했습니다.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) return <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center text-zinc-400">로딩 중...</div>;

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
                                상담 일지 수정
                            </h1>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6 pb-20">
                    <div className="w-full mb-6">
                        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm flex flex-col">
                                <div className="space-y-6 flex-1">
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

                                    {isLegacyHtml && category === "general" ? (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 font-mono tracking-tighter uppercase">
                                                    상세 내용 수정 (기존 일반 상담)
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsLegacyHtml(false);
                                                        setCategory("initial");
                                                    }}
                                                    className="text-xs font-semibold text-brand-navy hover:underline"
                                                >
                                                    상담 양식 선택으로 전환
                                                </button>
                                            </div>
                                            <div className="quill-container border-zinc-200 dark:border-zinc-800 pb-16">
                                                <ReactQuill
                                                    theme="snow"
                                                    value={content}
                                                    onChange={setContent}
                                                    modules={quillModules}
                                                    formats={quillFormats}
                                                    className={cn("h-[380px] dark:bg-zinc-800/50", content && content !== "<p><br></p>" ? "hide-placeholder" : "")}
                                                    placeholder="상담 내용을 상세히 입력하세요..."
                                                />
                                            </div>
                                        </div>
                                    ) : (
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
                                    )}
                                </div>
                            </section>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-6 border-t border-zinc-200 dark:border-zinc-800 mt-6 font-medium">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            disabled={isSubmitting}
                            className="px-6 py-2.5 rounded-xl text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors border border-zinc-200 dark:border-zinc-800 disabled:opacity-50"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-brand-navy hover:bg-brand-navy-dark text-white px-8 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
                        >
                            {isSubmitting ? "수정 중..." : "수정 완료"}
                        </button>
                    </div>
                </form>
            </div>

            <style jsx global>{`
                .dark .ql-toolbar { background-color: #18181b; border-color: #27272a !important; }
                .dark .ql-container { border-color: #27272a !important; }
                .dark .ql-stroke { stroke: #a1a1aa !important; }
                .dark .ql-fill { fill: #a1a1aa !important; }
                .dark .ql-picker { color: #a1a1aa !important; }
                .dark .ql-picker-options { background-color: #18181b !important; border-color: #27272a !important; }
                .dark .ql-editor.ql-blank::before { color: #52525b !important; }
                .ql-editor { font-size: 15px; line-height: 1.6; }
                .ql-toolbar.ql-snow { border-top-left-radius: 12px; border-top-right-radius: 12px; }
                .ql-container.ql-snow { border-bottom-left-radius: 12px; border-bottom-right-radius: 12px; }
                .hide-placeholder .ql-editor::before { display: none !important; content: none !important; }
            `}</style>
        </div>
    );
}
