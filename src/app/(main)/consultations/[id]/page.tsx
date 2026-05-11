"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
    MessageSquare,
    ChevronLeft,
    MoreVertical,
    Calendar,
    User,
    Edit2,
    Trash2,
    Download,
    Paperclip,
    FileText
} from "lucide-react";
import { Consultation, fetchConsultationById, deleteConsultation, CONSULTATION_TYPE_LABELS, CONSULTATION_TYPE_COLORS } from "@/lib/consultation-sync";
import { cn } from "@/lib/utils";

export default function ConsultationDetailPage() {
    const router = useRouter();
    const params = useParams();
    const { id } = params as { id: string };

    const [consultation, setConsultation] = useState<Consultation | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (id) {
            fetchConsultationById(id).then(data => {
                setConsultation(data);
                setIsLoading(false);
            });
        }
    }, [id]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleDelete = async () => {
        if (!id) return;
        setIsMenuOpen(false);
        if (window.confirm("상담 일지를 삭제하시겠습니까?")) {
            try {
                await deleteConsultation(id);
                alert("삭제되었습니다.");
                router.push("/consultations");
            } catch (err) {
                alert("삭제에 실패했습니다.");
            }
        }
    };

    if (isLoading) return <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center text-zinc-400">로딩 중...</div>;
    if (!consultation) return <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center text-zinc-400">상담 정보를 찾을 수 없습니다.</div>;

    return (
        <div className="min-h-screen bg-white dark:bg-zinc-950 pb-20">
            {/* ── Header ── */}
            <header className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
                <div className="max-w-3xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.back()}
                            className="p-2 -ml-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-50 transition-colors"
                        >
                            <ChevronLeft size={24} />
                        </button>
                        <div className="flex items-center gap-2">
                            <MessageSquare size={18} className="text-brand-navy dark:text-brand-navy-light shrink-0" />
                            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                                상담 상세
                            </h1>
                        </div>
                    </div>

                    <div className="relative" ref={menuRef}>
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="p-2 -mr-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                        >
                            <MoreVertical size={20} />
                        </button>

                        {isMenuOpen && (
                            <div className="absolute right-0 mt-2 w-36 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg overflow-hidden z-50 animate-in fade-in zoom-in-95 origin-top-right duration-100">
                                <Link
                                    href={`/consultations/${id}/edit`}
                                    className="w-full text-left px-4 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2 transition-colors"
                                >
                                    <Edit2 size={16} className="text-zinc-400" />
                                    수정
                                </Link>
                                <button
                                    onClick={handleDelete}
                                    className="w-full text-left px-4 py-3 text-sm font-medium text-brand-red hover:bg-brand-red/5 flex items-center gap-2 transition-colors border-t border-zinc-100 dark:border-zinc-800"
                                >
                                    <Trash2 size={16} className="text-brand-red/70" />
                                    삭제
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 sm:px-8 py-6 space-y-6">
                {/* ── Consultation Info Header Card ── */}
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-5">
                    <div className="flex items-center gap-2">
                        <span className={cn(
                            "text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider border",
                            CONSULTATION_TYPE_COLORS[consultation.type].bg,
                            CONSULTATION_TYPE_COLORS[consultation.type].text,
                            CONSULTATION_TYPE_COLORS[consultation.type].border
                        )}>
                            {CONSULTATION_TYPE_LABELS[consultation.type]}
                        </span>
                        {consultation.isImportant && (
                            <span className="text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 px-2 py-1 rounded-full">
                                중요
                            </span>
                        )}
                    </div>

                    <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-50 leading-tight">
                        {consultation.title}
                    </h2>

                    <div className="flex items-center gap-4 pt-4 border-t border-zinc-100 dark:border-zinc-800/50">
                        <div className="flex items-center gap-2 flex-1">
                            <div className="w-8 h-8 rounded-full bg-brand-navy/10 flex items-center justify-center text-brand-navy dark:bg-brand-navy-light/20 dark:text-brand-navy-light">
                                <User size={16} />
                            </div>
                            <div>
                                <p className="text-[10px] text-zinc-500">작성자</p>
                                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{consultation.author}</p>
                            </div>
                        </div>
                        <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-800"></div>
                        <div className="flex items-center gap-2 flex-1">
                            <div className="w-8 h-8 rounded-full bg-brand-navy/10 flex items-center justify-center text-brand-navy dark:bg-brand-navy-light/20 dark:text-brand-navy-light">
                                <Calendar size={16} />
                            </div>
                            <div>
                                <p className="text-[10px] text-zinc-500">작성일</p>
                                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{consultation.date.replace(/-/g, ".")}</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── Content Card ── */}
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl shadow-sm min-h-[250px]">
                    <div
                        className="prose prose-sm sm:prose-base prose-zinc dark:prose-invert max-w-none text-zinc-700 dark:text-zinc-300 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: consultation.content }}
                    />
                </section>

                {/* ── Footer Button ── */}
                <div className="flex justify-center pt-4">
                    <button
                        onClick={() => router.push("/consultations")}
                        className="px-8 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all active:scale-95 shadow-sm"
                    >
                        목록으로 돌아가기
                    </button>
                </div>
            </main>
        </div>
    );
}
