"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Trophy, Calendar, MapPin, Hash, Lock, Loader2, ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DatePickerInput } from "@/components/ui/DatePickerInput";

export default function CreateTournamentPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    
    const [formData, setFormData] = useState({
        name: "",
        start_date: "",
        end_date: "",
        total_rounds: 1,
        location: "",
        password: ""
    });

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
        
        if (!formData.name || !formData.start_date || !formData.end_date || !formData.location || !formData.password) {
            alert("모든 필드를 입력해주세요.");
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

            const { error } = await supabase.from("score_tournaments").insert({
                name: formData.name,
                start_date: formData.start_date,
                end_date: formData.end_date,
                total_rounds: formData.total_rounds,
                location: formData.location,
                password: formData.password,
                status: "준비중",
                created_by: user.id
            });

            if (error) throw error;

            alert("토너먼트가 성공적으로 개설되었습니다.");
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
                    새 토너먼트 개설
                </h1>
                <p className="text-sm text-zinc-500 mt-2">
                    공식 대회의 기본 정보를 입력하고 참가자들이 입장할 수 있는 비밀번호를 설정합니다.
                </p>
            </div>

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
                                className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none transition-all cursor-not-allowed"
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
                            참가 입장 비밀번호
                        </label>
                        <input
                            type="text" // 텍스트로 보여주거나 type="password" 선택 가능, 일단 텍스트
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="선수들에게 안내할 입장 비밀번호 (예: 1234)"
                            className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/50 transition-all"
                            required
                        />
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
                        {loading ? "개설 중..." : "토너먼트 개설하기"}
                    </button>
                </div>
            </form>
        </div>
    );
}
