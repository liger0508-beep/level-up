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
    fetchConsultations
} from "@/lib/consultation-sync";
import { AthleteSearch } from "@/components/ui/AthleteSearch";

// Removed ReactQuill imports and configurations

function CreateConsultationContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentCoach, setCurrentCoach] = useState<{ id: string; name: string } | null>(null);

    // Consultation State
    const [athleteName, setAthleteName] = useState("");
    const [content, setContent] = useState("");

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

        const savedContent = sessionStorage.getItem("draftConsultationContent");
        if (savedContent) {
            setContent(savedContent);
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

    // Save content to session
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        // Prevent saving basic empty states
        if (content && content !== "<p><br></p>" && content !== "<p></p>") {
            sessionStorage.setItem("draftConsultationContent", content);
        } else if (!content) {
            sessionStorage.removeItem("draftConsultationContent");
        }
    }, [content]);

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
                    if (dbUser.role !== 'coach' && dbUser.role !== 'admin') {
                        alert("상담 작성 권한이 없습니다.");
                        router.push("/consultations");
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

        if (!content || content === "<p><br></p>") {
            alert("상담 내용을 입력해 주세요.");
            return;
        }

        try {
            setIsSubmitting(true);
            
            // 1. Save to DB
            const dateStr = formatLocalDate();
            
            await saveConsultation({
                athleteName,
                coachName: currentCoach?.name || "관리자",
                author: currentCoach?.name || "관리자",
                content,
                date: dateStr,
                type: "all",
                isImportant: false,
                title: `${athleteName} 선수 상담`
            });

            // 2. Schedule Sync (Legacy/Compatibility)
            if (typeof window !== "undefined") {
                const { saveCompletedItem, saveEvent } = require("@/lib/schedule-sync");

                saveCompletedItem({
                    participantName: athleteName,
                    date: dateStr,
                    type: "consultation"
                });

                const start = new Date(new Date().getTime());
                start.setMinutes(0, 0, 0);
                const end = new Date(start.getTime() + 60 * 60000);

                saveEvent({
                    id: crypto.randomUUID(),
                    title: `${athleteName} 선수 상담`,
                    start,
                    end,
                    type: "consultation",
                    participantName: athleteName,
                    coachName: currentCoach?.name || "관리자",
                });
            }

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

                                {/* Detailed Content Editor */}
                                <div className="space-y-3">
                                    <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 font-mono tracking-tighter uppercase mb-2">
                                        상세 내용 작성
                                    </label>
                                    <textarea
                                        rows={8}
                                        value={content}
                                        onChange={(e) => setContent(e.target.value)}
                                        placeholder="상담 내용을 상세히 입력하세요..."
                                        className="w-full p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all resize-y"
                                    />
                                </div>
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
                                            <div className="text-[10px] text-zinc-400 font-bold mb-1">{c.date}</div>
                                            <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-2 truncate">{c.title}</div>
                                            <div 
                                                className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-3 leading-relaxed"
                                                dangerouslySetInnerHTML={{ __html: c.content }}
                                            />
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
