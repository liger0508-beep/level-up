"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
    ChevronLeft,
    Megaphone,
    Calendar,
    AlertCircle,
    Check,
    Clock,
    Layout,
} from "lucide-react";
import { NOTICE_TYPE_LABELS, NoticeType, NOTICE_TYPE_COLORS, saveNotice } from "@/lib/notice-sync";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

// Load ReactQuill dynamically to avoid SSR issues
const ReactQuill = dynamic(() => import("react-quill-new"), {
    ssr: false,
    loading: () => <div className="h-64 bg-zinc-50 dark:bg-zinc-900 rounded-xl animate-pulse flex items-center justify-center text-zinc-400">에디터 로딩 중...</div>
});

import "react-quill-new/dist/quill.snow.css";
import { DatePickerInput } from "@/components/ui/DatePickerInput";

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

export default function CreateNoticePage() {
    const router = useRouter();

    const [type, setType] = useState<NoticeType>("all");
    const [branch, setBranch] = useState("전체");
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [isImportant, setIsImportant] = useState(false);
    const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
    const [endDate, setEndDate] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    useMemo(() => {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data }) => {
            if (data?.user) setUserId(data.user.id);
        });
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isSubmitting) return;

        if (!title.trim()) {
            alert("제목을 입력해 주세요.");
            return;
        }
        if (!content.trim() || content === "<p><br></p>") {
            alert("내용을 입력해 주세요.");
            return;
        }

        try {
            setIsSubmitting(true);
            await saveNotice({
                type,
                branch,
                title,
                content,
                date: new Date().toISOString().split("T")[0],
                authorId: userId || undefined,
                isImportant,
                startDate,
                endDate,
            });
            alert("공지사항이 등록되었습니다.");
            router.push("/community");
        } catch (err) {
            console.error(err);
            alert("등록 중 오류가 발생했습니다.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-white dark:bg-zinc-950 px-4 sm:px-8 py-6">
            <div className="max-w-3xl mx-auto">
                {/* ── Header ── */}
                <div className="flex items-center gap-3 mb-8">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-50 transition-colors"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                        공지사항 작성
                    </h1>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8 pb-20">
                    {/* ── 1. Settings ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-6">
                        {/* Notice Type */}
                        <div className="space-y-3">
                            <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300">
                                공지 대상 <span className="text-brand-red">*</span>
                            </label>
                            <div className="flex flex-nowrap gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
                                {(Object.entries(NOTICE_TYPE_LABELS) as [NoticeType, string][]).map(([key, label]) => {
                                    const isActive = type === key;
                                    return (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => setType(key)}
                                            className={cn(
                                                "px-5 py-2 rounded-full text-sm font-bold transition-all border shrink-0",
                                                isActive
                                                    ? "bg-brand-navy text-white border-brand-navy shadow-sm"
                                                    : "bg-transparent text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-brand-navy/50"
                                            )}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Branch Selection */}
                        <div className="space-y-3">
                            <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300">
                                지점 선택 <span className="text-brand-red">*</span>
                            </label>
                            <div className="flex flex-nowrap gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
                                {["전체", "조이마루", "구미"].map((b) => (
                                    <button
                                        key={b}
                                        type="button"
                                        onClick={() => setBranch(b)}
                                        className={cn(
                                            "px-5 py-2 rounded-full text-sm font-bold transition-all border shrink-0",
                                            branch === b
                                                ? "bg-brand-navy text-white border-brand-navy shadow-sm"
                                                : "bg-transparent text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-brand-navy/50"
                                        )}
                                    >
                                        {b}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Importance & Title */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="md:col-span-1 space-y-3">
                                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300">
                                    중요 공지
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setIsImportant(!isImportant)}
                                    className={cn(
                                        "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold transition-all",
                                        isImportant
                                            ? "bg-red-50 text-red-600 border-red-200 shadow-sm"
                                            : "bg-transparent text-zinc-400 border-zinc-200 dark:border-zinc-800"
                                    )}
                                >
                                    <AlertCircle size={18} />
                                    중요 표시
                                </button>
                            </div>
                            <div className="md:col-span-3 space-y-3">
                                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300">
                                    공지 제목 <span className="text-brand-red">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="제목을 입력하세요..."
                                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent dark:bg-zinc-800 text-sm font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all"
                                />
                            </div>
                        </div>

                        {/* Period */}
                        <div className="space-y-3">
                            <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300">
                                게시 기간 설정
                            </label>
                            <div className="flex items-center gap-3">
                                <div className="relative flex-1">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                    <DatePickerInput
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent dark:bg-zinc-800 text-sm text-center cursor-pointer"
                                    />
                                </div>
                                <span className="text-zinc-400">~</span>
                                <div className="relative flex-1">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                    <DatePickerInput
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        placeholder="종료일 없음"
                                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent dark:bg-zinc-800 text-sm text-center cursor-pointer"
                                    />
                                </div>
                            </div>
                            <p className="text-[11px] text-zinc-400 ml-1 flex items-center gap-1">
                                <Clock size={12} />
                                종료일을 입력하지 않으면 상시 게시됩니다.
                            </p>
                        </div>
                    </section>

                    {/* ── 2. Editor Section ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-4 overflow-hidden">
                        <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                            <Layout size={18} className="text-zinc-400" />
                            상세 내용 작성
                        </label>
                        <div className="quill-container border-zinc-200 dark:border-zinc-800">
                            <ReactQuill
                                theme="snow"
                                value={content}
                                onChange={setContent}
                                modules={quillModules}
                                formats={quillFormats}
                                className="h-[400px] mb-12 dark:bg-zinc-800/50"
                            />
                        </div>
                    </section>

                    {/* ── 3. Footer Actions ── */}
                    <div className="flex items-center justify-end gap-3 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="px-6 py-3 rounded-2xl text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-900 transition-colors"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-brand-navy hover:bg-brand-navy-dark disabled:bg-zinc-400 text-white px-10 py-3 rounded-2xl text-sm font-bold transition-all shadow-md active:scale-95 flex items-center gap-2"
                        >
                            <Check size={18} />
                            {isSubmitting ? "등록 중..." : "등록 완료"}
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
