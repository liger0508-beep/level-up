"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
    ChevronLeft,
    Vote as VoteIcon,
    Calendar,
    AlertCircle,
    Check,
    Layout,
    Plus,
    X,
} from "lucide-react";
import { VOTE_TYPE_LABELS, VoteType, getPollById, updatePoll, Vote } from "@/lib/vote-sync";
import { cn } from "@/lib/utils";

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

export default function EditVotePage() {
    const router = useRouter();
    const params = useParams();
    const { id } = params as { id: string };

    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [originalPoll, setOriginalPoll] = useState<Vote | null>(null);

    const [type, setType] = useState<VoteType>("all");
    const [branch, setBranch] = useState("전체");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [isImportant, setIsImportant] = useState(false);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [options, setOptions] = useState<string[]>(["", ""]);
    const [allowMultiple, setAllowMultiple] = useState(false);

    useEffect(() => {
        getPollById(id)
            .then(vote => {
                if (vote) {
                    setOriginalPoll(vote);
                    setType(vote.type);
                    setBranch(vote.branch || "전체");
                    setTitle(vote.title);
                    setDescription(vote.description);
                    setIsImportant(vote.isImportant || false);
                    setStartDate(vote.startDate);
                    setEndDate(vote.endDate);
                    setOptions(vote.options.map(opt => opt.text));
                }
            })
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, [id]);

    const addOption = () => {
        setOptions([...options, ""]);
    };

    const removeOption = (index: number) => {
        if (options.length <= 2) {
            alert("최소 2개의 선택지가 필요합니다.");
            return;
        }
        setOptions(options.filter((_, i) => i !== index));
    };

    const updateOption = (index: number, value: string) => {
        const newOptions = [...options];
        newOptions[index] = value;
        setOptions(newOptions);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim()) {
            alert("투표 제목을 입력해 주세요.");
            return;
        }
        if (options.some(opt => !opt.trim())) {
            alert("모든 선택지 내용을 입력해 주세요.");
            return;
        }

        try {
            setIsSubmitting(true);

            // Re-map options while preserving existing IDs and votes if possible
            const updatedOptions = options.map((text, idx) => {
                const existing = originalPoll?.options.find(opt => opt.text === text.trim());
                return {
                    id: existing?.id || `opt_${Date.now()}_${idx}`,
                    text: text.trim(),
                    votes: existing?.votes || 0
                };
            });

            await updatePoll(id, {
                type,
                branch,
                title,
                description,
                options: updatedOptions,
                startDate,
                endDate,
                isImportant
            });

            alert("투표가 수정되었습니다.");
            router.push(`/admin/polls/${id}`);
        } catch (error) {
            console.error(error);
            alert("수정에 실패했습니다.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="w-8 h-8 border-4 border-brand-navy/20 border-t-brand-navy rounded-full animate-spin"></div>
            </div>
        );
    }

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
                    <div className="flex items-center gap-2">
                        <VoteIcon size={24} className="text-brand-navy" />
                        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                            투표 수정
                        </h1>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8 pb-20">
                    {/* ── 1. Settings ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-6">
                        {/* Vote Type */}
                        <div className="space-y-3">
                            <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300">
                                투표 대상 <span className="text-brand-red">*</span>
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {(Object.entries(VOTE_TYPE_LABELS) as [VoteType, string][]).map(([key, label]) => {
                                    const isActive = type === key;
                                    return (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => setType(key)}
                                            className={cn(
                                                "px-5 py-2 rounded-full text-sm font-bold transition-all border",
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
                            <div className="flex flex-wrap gap-2">
                                {["전체", "조이마루", "구미"].map((b) => (
                                    <button
                                        key={b}
                                        type="button"
                                        onClick={() => setBranch(b)}
                                        className={cn(
                                            "px-5 py-2 rounded-full text-sm font-bold transition-all border",
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

                        {/* Title */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="md:col-span-1 space-y-3">
                                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300">
                                    중요 투표
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
                                    투표 제목 <span className="text-brand-red">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="투표 제목을 입력하세요..."
                                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent dark:bg-zinc-800 text-sm font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all"
                                />
                            </div>
                        </div>

                        {/* Description */}
                        <div className="space-y-3">
                            <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300">
                                투표 설명
                            </label>
                            <div className="quill-container border-zinc-200 dark:border-zinc-800">
                                <ReactQuill
                                    theme="snow"
                                    value={description}
                                    onChange={setDescription}
                                    modules={quillModules}
                                    formats={quillFormats}
                                    className="h-[400px] mb-12 dark:bg-zinc-800/50"
                                    placeholder="투표에 대한 상세 설명을 입력하세요..."
                                />
                            </div>
                        </div>
                    </section>

                    {/* ── 2. Options Section ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                                    <Layout size={18} className="text-zinc-400" />
                                    투표 항목 설정 <span className="text-brand-red">*</span>
                                </label>
                                <span className="text-[10px] text-zinc-400 font-medium">최소 2개 필수</span>
                            </div>

                            {/* Allow Multiple Toggle */}
                            <label className="flex items-center gap-2 cursor-pointer group bg-zinc-50 dark:bg-zinc-800/50 px-3 py-1.5 rounded-lg border border-zinc-100 dark:border-zinc-800 w-fit">
                                <div className={cn(
                                    "w-8 h-4.5 rounded-full transition-colors relative flex items-center",
                                    allowMultiple ? "bg-brand-navy" : "bg-zinc-300 dark:bg-zinc-600"
                                )}>
                                    <div className={cn(
                                        "w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform",
                                        allowMultiple ? "translate-x-[18px]" : "translate-x-0.5"
                                    )} />
                                </div>
                                <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 select-none group-hover:text-zinc-900 dark:group-hover:text-zinc-200 transition-colors">
                                    중복 선택 허용
                                </span>
                                <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={allowMultiple}
                                    onChange={(e) => setAllowMultiple(e.target.checked)}
                                />
                            </label>
                        </div>

                        <div className="space-y-3">
                            {options.map((option, index) => (
                                <div key={index} className="flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="flex-1 relative group">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-300">
                                            <span className="text-xs font-bold">{index + 1}</span>
                                        </div>
                                        <input
                                            type="text"
                                            value={option}
                                            onChange={(e) => updateOption(index, e.target.value)}
                                            placeholder={`선택지 ${index + 1} 입력...`}
                                            className="w-full pl-8 pr-4 py-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 text-sm font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/20 focus:border-brand-navy/30 transition-all"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeOption(index)}
                                        className="p-2.5 rounded-xl text-zinc-400 hover:text-brand-red hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            ))}

                            <button
                                type="button"
                                onClick={addOption}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-brand-navy hover:border-brand-navy/40 hover:bg-brand-navy/5 transition-all group"
                            >
                                <Plus size={18} className="group-hover:scale-110 transition-transform" />
                                <span className="text-sm font-bold">항목 추가하기</span>
                            </button>
                        </div>
                    </section>

                    {/* ── 3. Period Section ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-6">
                        <div className="space-y-3">
                            <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300">
                                투표 기간 설정 <span className="text-brand-red">*</span>
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
                                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent dark:bg-zinc-800 text-sm text-center cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* ── 4. Footer Actions ── */}
                    <div className="flex items-center justify-end gap-3 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="px-6 py-3 rounded-2xl text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-900 transition-colors"
                            disabled={isSubmitting}
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            className="bg-brand-navy hover:bg-brand-navy-dark text-white px-10 py-3 rounded-2xl text-sm font-bold transition-all shadow-md active:scale-95 flex items-center gap-2 disabled:opacity-50"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? "수정 중..." : (
                                <>
                                    <Check size={18} />
                                    투표 수정 완료
                                </>
                            )}
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
