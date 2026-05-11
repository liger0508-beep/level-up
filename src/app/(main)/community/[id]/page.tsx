"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
    ChevronLeft,
    MoreVertical,
    Calendar,
    User,
    Edit2,
    Trash2,
    Megaphone
} from "lucide-react";
import { getNoticeById, deleteNotice, NOTICE_TYPE_LABELS, NoticeType, NOTICE_TYPE_COLORS, Notice } from "@/lib/notice-sync";
import { cn } from "@/lib/utils";

export default function NoticeDetailPage() {
    const router = useRouter();
    const params = useParams();
    const { id } = params;

    const [notice, setNotice] = useState<Notice | null>(null);
    const [loading, setLoading] = useState(true);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (id) {
            getNoticeById(id as string).then(data => {
                setNotice(data);
                setLoading(false);
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
        setIsMenuOpen(false);
        if (window.confirm("공지사항을 삭제하시겠습니까?")) {
            try {
                await deleteNotice(id as string);
                alert("삭제되었습니다.");
                router.push("/community");
            } catch (err) {
                console.error(err);
                alert("삭제 중 오류가 발생했습니다.");
            }
        }
    };

    if (loading) return <div className="flex items-center justify-center min-h-screen">로딩 중...</div>;
    if (!notice) return <div className="flex items-center justify-center min-h-screen">공지사항을 찾을 수 없습니다.</div>;

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
                            <Megaphone size={18} className="text-brand-navy dark:text-brand-navy-light shrink-0" />
                            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                                공지 상세
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
                                    href={`/community/${id}/edit`}
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
                {/* ── Notice Info ── */}
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className={cn(
                                "text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider border",
                                NOTICE_TYPE_COLORS[notice.type].bg,
                                NOTICE_TYPE_COLORS[notice.type].text,
                                NOTICE_TYPE_COLORS[notice.type].border
                            )}>
                                {NOTICE_TYPE_LABELS[notice.type]}
                            </span>
                            <span className="text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                                {notice.branch}
                            </span>
                            {notice.isImportant && (
                                <span className="text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 px-2 py-1 rounded-full">
                                    중요
                                </span>
                            )}
                        </div>
                    </div>

                    <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-50 leading-tight">
                        {notice.title}
                    </h2>

                    <div className="flex items-center gap-4 pt-5 border-t border-zinc-100 dark:border-zinc-800/50">
                        <div className="flex items-center gap-2 flex-1">
                            <div className="w-8 h-8 rounded-full bg-brand-navy/5 flex items-center justify-center text-brand-navy dark:bg-brand-navy-light/10 dark:text-brand-navy-light">
                                <User size={16} />
                            </div>
                            <div>
                                <p className="text-[10px] text-zinc-500 font-medium leading-none mb-1">작성자</p>
                                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-none">{notice.author}</p>
                            </div>
                        </div>
                        <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-800"></div>
                        <div className="flex items-center gap-2 flex-1">
                            <div className="w-8 h-8 rounded-full bg-brand-navy/5 flex items-center justify-center text-brand-navy dark:bg-brand-navy-light/10 dark:text-brand-navy-light">
                                <Calendar size={16} />
                            </div>
                            <div>
                                <p className="text-[10px] text-zinc-500 font-medium leading-none mb-1">작성일</p>
                                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-none">{notice.date.replace(/-/g, ".")}</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── Content (Rich Text) ── */}
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl shadow-sm min-h-[200px]">
                    <div
                        className="prose prose-sm sm:prose-base prose-zinc dark:prose-invert max-w-none text-zinc-700 dark:text-zinc-300 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: notice.content }}
                    />
                </section>

                {/* ── Footer Actions ── */}
                <div className="flex justify-center pt-4">
                    <button
                        onClick={() => router.push("/community")}
                        className="px-8 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all active:scale-95"
                    >
                        목록으로 돌아가기
                    </button>
                </div>
            </main>
        </div>
    );
}
