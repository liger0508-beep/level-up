"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Trophy, Calendar, MapPin, Hash, Lock, Loader2, ChevronLeft, FileText } from "lucide-react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { DatePickerInput } from "@/components/ui/DatePickerInput";

const ReactQuill = dynamic(() => import("react-quill-new"), {
    ssr: false,
    loading: () => <div className="h-48 bg-zinc-50 dark:bg-zinc-900 rounded-xl animate-pulse flex items-center justify-center text-zinc-400">에디터 로딩 중...</div>
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

export default function EditTournamentPage() {
    const router = useRouter();
    const params = useParams();
    const tournamentId = params.id as string;
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    
    const [formData, setFormData] = useState({
        name: "",
        start_date: "",
        end_date: "",
        total_rounds: 1,
        location: "",
        password: "",
        notice: ""
    });

    useEffect(() => {
        const fetchTournament = async () => {
            const supabase = createClient();
            const { data, error } = await supabase
                .from("score_tournaments")
                .select("*")
                .eq("id", tournamentId)
                .single();
                
            if (data && !error) {
                setFormData({
                    name: data.name || "",
                    start_date: data.start_date || "",
                    end_date: data.end_date || "",
                    total_rounds: data.total_rounds || 1,
                    location: data.location || "",
                    password: data.password || "",
                    notice: data.notice || ""
                });
            } else {
                alert("대회 정보를 불러올 수 없습니다.");
                router.back();
            }
            setInitialLoading(false);
        };
        if (tournamentId) fetchTournament();
    }, [tournamentId, router]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === "total_rounds" ? parseInt(value) || 1 : value
        }));
    };

    // 날짜 변경 시 라운드 수 자동 계산
    useEffect(() => {
        if (formData.start_date && formData.end_date) {
            const start = new Date(formData.start_date);
            const end = new Date(formData.end_date);
            if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                const diffTime = end.getTime() - start.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                if (diffDays > 0 && diffDays <= 10) {
                    setFormData(prev => ({ ...prev, total_rounds: diffDays }));
                }
            }
        }
    }, [formData.start_date, formData.end_date]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.name || !formData.start_date || !formData.end_date || !formData.location) {
            alert("필수 필드를 모두 입력해주세요.");
            return;
        }

        if (formData.start_date > formData.end_date) {
            alert("종료일이 시작일보다 빠를 수 없습니다.");
            return;
        }

        setLoading(true);
        const supabase = createClient();

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("로그인이 필요합니다.");

            const { error } = await supabase.from("score_tournaments")
                .update({
                    name: formData.name,
                    start_date: formData.start_date,
                    end_date: formData.end_date,
                    total_rounds: formData.total_rounds,
                    location: formData.location,
                    password: formData.password,
                    notice: formData.notice
                })
                .eq("id", tournamentId);

            if (error) throw error;

            alert("토너먼트가 성공적으로 수정되었습니다.");
            router.push("/scores/tournaments");
            
        } catch (error: any) {
            console.error("Error creating tournament:", error);
            const errDetails = Object.getOwnPropertyNames(error).map(key => `${key}: ${error[key]}`).join('\n');
            alert(`오류가 발생했습니다:\n${errDetails || error?.toString() || JSON.stringify(error)}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 sm:p-8 max-w-3xl mx-auto pb-24">
            <button
                onClick={() => router.back()}
                className="flex items-center gap-1 text-sm font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 mb-6 transition-colors"
            >
                <ChevronLeft size={16} />
                뒤로 가기
            </button>

            <div className="mb-8">
                <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                    <Trophy className="text-brand-navy" size={24} />
                    토너먼트 수정
                </h1>
                <p className="text-sm text-zinc-500 mt-2">
                    대회의 정보를 수정합니다.
                </p>
            </div>

            {initialLoading ? (
                <div className="flex justify-center items-center h-48">
                    <Loader2 className="w-8 h-8 text-brand-navy animate-spin" />
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-sm">
                
                <div className="space-y-6">
                    {/* 대회명 */}
                    <div>
                        <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-1.5">
                            <Trophy size={16} className="text-zinc-400" />
                            대회명
                        </label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="예: 2024 전국 체전 예선"
                            className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/50 transition-all"
                            required
                        />
                    </div>

                    {/* 일정 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-1.5">
                                <Calendar size={16} className="text-zinc-400" />
                                시작 일정
                            </label>
                            <DatePickerInput
                                value={formData.start_date}
                                onChange={handleChange}
                                name="start_date"
                                className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/50 transition-all cursor-pointer"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-1.5">
                                <Calendar size={16} className="text-zinc-400" />
                                종료 일정
                            </label>
                            <DatePickerInput
                                value={formData.end_date}
                                onChange={handleChange}
                                name="end_date"
                                className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/50 transition-all cursor-pointer"
                                required
                            />
                        </div>
                    </div>

                    {/* 라운드 수 & 장소 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-1.5">
                                <Hash size={16} className="text-zinc-400" />
                                총 라운드 수
                            </label>
                            <input
                                type="number"
                                name="total_rounds"
                                min="1"
                                max="10"
                                value={formData.total_rounds}
                                onChange={handleChange}
                                className="w-full text-center px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none transition-all cursor-not-allowed"
                                required
                                readOnly
                            />
                            <p className="text-xs text-zinc-400 mt-1.5 ml-1">일정에 따라 자동 계산됩니다.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-1.5">
                                <MapPin size={16} className="text-zinc-400" />
                                골프장 (장소)
                            </label>
                            <input
                                type="text"
                                name="location"
                                value={formData.location}
                                onChange={handleChange}
                                placeholder="예: 솔모로 CC"
                                className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/50 transition-all"
                                required
                            />
                        </div>
                    </div>

                    {/* 입장 비밀번호 */}
                    <div>
                        <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-1.5">
                            <Lock size={16} className="text-zinc-400" />
                            참가 입장 비밀번호 (선택)
                        </label>
                        <input
                            type="text" // 텍스트로 보여주거나 type="password" 선택 가능, 일단 텍스트
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="선수들에게 안내할 입장 비밀번호 (입력하지 않으면 누구나 참가 가능)"
                            className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/50 transition-all"
                        />
                    </div>

                    {/* 안내사항 */}
                    <div>
                        <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-1.5">
                            <FileText size={16} className="text-zinc-400" />
                            안내사항
                        </label>
                        <div className="quill-container border-zinc-200 dark:border-zinc-800">
                            <ReactQuill
                                theme="snow"
                                value={formData.notice}
                                onChange={(val) => setFormData(prev => ({ ...prev, notice: val }))}
                                modules={quillModules}
                                formats={quillFormats}
                                className="h-[300px] pb-12 mb-8 dark:bg-zinc-800/50"
                            />
                        </div>
                    </div>
                </div>

                <div className="mt-10">
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-brand-navy hover:bg-brand-navy-dark text-white px-6 py-4 rounded-xl font-bold text-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                            <Trophy size={20} />
                        )}
                        {loading ? "개설 중..." : "수정 완료"}
                    </button>
                </div>
            </form>
            )}

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
