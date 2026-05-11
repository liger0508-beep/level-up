"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { format } from "date-fns";
import { formatLocalDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { fetchAthletes } from "@/lib/athlete-sync";
import { createClient } from "@/lib/supabase/client";
import {
    Consultation,
    saveConsultation,
    fetchConsultations,
    fetchRecentActivityByPlayer,
    fetchRecentScorecardByPlayer
} from "@/lib/consultation-sync";
import { AthleteSearch } from "@/components/ui/AthleteSearch";

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

function CreateConsultationContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentCoach, setCurrentCoach] = useState<{ id: string; name: string } | null>(null);

    // Consultation State
    const [athleteName, setAthleteName] = useState("");
    const [content, setContent] = useState("");

    // Initialize athleteName from searchParams
    useEffect(() => {
        const player = searchParams.get("player");
        if (player) {
            setAthleteName(player);
        }
    }, [searchParams]);

    // RBAC and User Info
    useEffect(() => {
        const supabase = createClient();
        supabase.auth.getUser().then(async ({ data: { user } }) => {
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
        });
    }, [router]);

    const [previousConsultations, setPreviousConsultations] = useState<Consultation[]>([]);
    const [recentAnalysis, setRecentAnalysis] = useState<any[]>([]);
    const [recentLessons, setRecentLessons] = useState<any[]>([]);
    const [recentTraining, setRecentTraining] = useState<any[]>([]);
    const [recentScore, setRecentScore] = useState<any | null>(null);

    useEffect(() => {
        if (athleteName) {
            // Fetch previous consultations
            fetchConsultations().then(data => {
                setPreviousConsultations(data.filter(c => c.athleteName === athleteName).slice(0, 5));
            });
            
            // Fetch recent activities
            fetchRecentActivityByPlayer(athleteName, 'analysis').then(setRecentAnalysis);
            fetchRecentActivityByPlayer(athleteName, 'lesson').then(setRecentLessons);
            fetchRecentActivityByPlayer(athleteName, 'training').then(setRecentTraining);
            fetchRecentScorecardByPlayer(athleteName).then(setRecentScore);
        } else {
            setPreviousConsultations([]);
            setRecentAnalysis([]);
            setRecentLessons([]);
            setRecentTraining([]);
            setRecentScore(null);
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

                const start = new Date(today.getTime());
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
            router.push("/consultations");
        } catch (err) {
            console.error(err);
            alert("상담 일지 등록에 실패했습니다.");
        } finally {
            setIsSubmitting(false);
        }
    };

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
                    {/* ── Desktop Row 1: Consultation Info & Recent Activity ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
                        {/* Consultation Info Box */}
                        <div className="lg:col-span-2">
                            <section className="h-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm flex flex-col">
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
                                        <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 font-mono tracking-tighter uppercase">
                                            상세 내용 작성
                                        </label>
                                        <div className="quill-container border-zinc-200 dark:border-zinc-800 pb-16">
                                            <ReactQuill
                                                theme="snow"
                                                value={content}
                                                onChange={setContent}
                                                modules={quillModules}
                                                formats={quillFormats}
                                                className="h-[380px] dark:bg-zinc-800/50"
                                                placeholder="상담 내용을 상세히 입력하세요..."
                                            />
                                        </div>
                                    </div>
                                </div>


                            </section>
                        </div>

                        {/* Recent Activity Summary Box */}
                        <div className="lg:col-span-1">
                            <section className="h-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-3xl shadow-sm flex flex-col space-y-5">
                                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                                    <Activity size={18} className="text-brand-red" />
                                    최근 활동 요약
                                </h2>

                                <div className="space-y-5 flex-1 overflow-y-auto pr-1">
                                    {/* Shot Analysis */}
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-[11px] font-bold text-zinc-500 uppercase tracking-tighter">
                                            <Activity size={14} /> 분석 (최근 3건)
                                        </div>
                                        <div className="space-y-1.5 font-medium">
                                            {recentAnalysis.map(a => (
                                                <Link
                                                    key={a.id}
                                                    href={`/analysis/${a.id}`}
                                                    className="block p-2.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl text-[11px] border border-zinc-100 dark:border-zinc-800 hover:border-brand-navy/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all flex justify-between gap-2"
                                                >
                                                    <span className="font-semibold text-zinc-700 dark:text-zinc-300 truncate">{a.title}</span>
                                                    <span className="text-zinc-400 shrink-0">{a.date.slice(5)}</span>
                                                </Link>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Lessons */}
                                    <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                                        <div className="flex items-center gap-2 text-[11px] font-bold text-zinc-500 uppercase tracking-tighter">
                                            <BookOpen size={14} /> 레슨 (최근 3건)
                                        </div>
                                        <div className="space-y-1.5 font-medium">
                                            {recentLessons.map(l => (
                                                <Link
                                                    key={l.id}
                                                    href={`/lessons/${l.id}`}
                                                    className="block p-2.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl text-[11px] border border-zinc-100 dark:border-zinc-800 hover:border-brand-navy/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all flex justify-between gap-2"
                                                >
                                                    <span className="font-semibold text-zinc-700 dark:text-zinc-300 truncate">{l.title}</span>
                                                    <span className="text-zinc-400 shrink-0">{l.date.slice(5)}</span>
                                                </Link>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Training */}
                                    <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 font-medium">
                                        <div className="flex items-center gap-2 text-[11px] font-bold text-zinc-500 uppercase tracking-tighter">
                                            <Dumbbell size={14} /> 훈련 (최근 3건)
                                        </div>
                                        <div className="space-y-1.5 ">
                                            {recentTraining.map(t => (
                                                <Link
                                                    key={t.id}
                                                    href={`/training/${t.id}`}
                                                    className="block p-2.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl text-[11px] border border-zinc-100 dark:border-zinc-800 hover:border-brand-navy/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all flex justify-between gap-2"
                                                >
                                                    <span className="font-semibold text-zinc-700 dark:text-zinc-300 truncate">{t.title}</span>
                                                    <span className="text-zinc-400 shrink-0">{t.date.slice(5)}</span>
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>

                    {/* ── Desktop Row 2: Previous Consultations & Recent Scorecard ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
                        {/* Previous Consultations Box */}
                        <div className="lg:col-span-2">
                            <section className="h-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm flex flex-col">
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

                        {/* Recent Scorecard Summary Box */}
                        <div className="lg:col-span-1">
                            <section className="h-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-3xl shadow-sm flex flex-col">
                                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                                    <Flag size={18} className="text-brand-navy" />
                                    최근 스코어 카드 요약
                                </h3>
                                {recentScore ? (
                                    <Link
                                        href={`/scores/${recentScore.id}`}
                                        className="block h-full rounded-2xl border border-zinc-100 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-800/30 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all p-4 space-y-3 shadow-sm hover:shadow-md border-b-4 border-b-brand-navy flex flex-col justify-between"
                                    >
                                        <div>
                                            <div className="flex justify-between items-baseline mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-2xl font-black text-brand-navy dark:text-white">{recentScore.score}</span>
                                                    <span className="text-xs text-zinc-500">타</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[10px] text-zinc-400 font-bold">{recentScore.date}</div>
                                                    <div className="text-[10px] text-zinc-500">{recentScore.course}</div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[11px]">
                                                <div className="flex justify-between">
                                                    <span className="text-zinc-500">티샷</span>
                                                    <span className="font-bold text-zinc-800 dark:text-zinc-200">{recentScore.teeShot}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-zinc-500">아이언샷</span>
                                                    <span className="font-bold text-zinc-800 dark:text-zinc-200">{recentScore.iron}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-zinc-500">피치샷</span>
                                                    <span className="font-bold text-zinc-800 dark:text-zinc-200">{recentScore.pitch}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-zinc-500">그린주변</span>
                                                    <span className="font-bold text-zinc-800 dark:text-zinc-200">{recentScore.aroundGreen}</span>
                                                </div>
                                                <div className="flex justify-between col-span-2 pt-1 border-t border-zinc-100 dark:border-zinc-800/50">
                                                    <span className="text-zinc-500 font-medium">퍼팅 평균</span>
                                                    <span className="font-bold text-zinc-800 dark:text-zinc-200">{recentScore.putting}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-2 mt-2 border-t border-zinc-200 dark:border-zinc-700/50 space-y-1.5">
                                            <div className="flex gap-2">
                                                <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-600">CHALLENGE</span>
                                                <span className="text-[10px] text-zinc-600 dark:text-zinc-400 truncate">{recentScore.challengeFocus}</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-brand-navy/10 text-brand-navy dark:bg-brand-navy-light/20 dark:text-brand-navy-light">STRONG</span>
                                                <span className="text-[10px] text-zinc-600 dark:text-zinc-400 truncate">{recentScore.strongPoint}</span>
                                            </div>
                                        </div>
                                    </Link>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-800/30 rounded-2xl border border-zinc-100 dark:border-zinc-800 border-dashed">
                                        <Flag size={24} className="text-zinc-300 mb-2" />
                                        <p className="text-[11px] text-zinc-400 text-center leading-relaxed">
                                            {athleteName ? "등록된 스코어카드가 없습니다." : "선수를 선택하면 최근 스코어 요약이 표시됩니다."}
                                        </p>
                                    </div>
                                )}
                            </section>
                        </div>
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

            {/* Global style for Quill in Dark Mode */}
            <style jsx global>{`
                .dark .ql-toolbar {
                    background-color: #18181b;
                    border-color: #27272a !important;
                }
                .dark .ql-container {
                    border-color: #27272a !important;
                }
                .dark .ql-stroke {
                    stroke: #a1a1aa !important;
                }
                .dark .ql-fill {
                    fill: #a1a1aa !important;
                }
                .dark .ql-picker {
                    color: #a1a1aa !important;
                }
                .dark .ql-picker-options {
                    background-color: #18181b !important;
                    border-color: #27272a !important;
                }
                .dark .ql-editor.ql-blank::before {
                    color: #52525b !important;
                }
                .ql-editor {
                    font-size: 15px;
                    line-height: 1.6;
                }
                .ql-toolbar.ql-snow {
                    border-top-left-radius: 12px;
                    border-top-right-radius: 12px;
                }
                .ql-container.ql-snow {
                    border-bottom-left-radius: 12px;
                    border-bottom-right-radius: 12px;
                }
            `}</style>
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
