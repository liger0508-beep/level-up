"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { UserCircle, Calendar, CheckCircle2, Check } from "lucide-react";
import { useRouter } from "next/navigation";

interface Coach {
    id: string;
    name: string;
    branch?: string;
}

interface User {
    id: string;
    role: string;
    branch: string;
}

export default function CoachSelectionPage() {
    const router = useRouter();
    const supabase = createClient();
    
    const [user, setUser] = useState<User | null>(null);
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
    const [coaches, setCoaches] = useState<Coach[]>([]);
    const [selectedCoachId, setSelectedCoachId] = useState<string>("");
    const [originalCoachId, setOriginalCoachId] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const initialize = async () => {
            setIsLoading(true);
            try {
                const { data: { user: authUser } } = await supabase.auth.getUser();
                
                if (!authUser) {
                    router.push("/login");
                    return;
                }

                const { data: profile } = await supabase
                    .from("users")
                    .select("id, role, branch")
                    .eq("id", authUser.id)
                    .single();
                
                setUser(profile);
                
                if (profile && profile.role === "athlete") {
                    await fetchData(profile, selectedMonth);
                }
            } catch (err) {
                console.error("Auth init error:", err);
            } finally {
                setIsLoading(false);
            }
        };
        
        initialize();
    }, [router]);
    
    // When month changes, re-fetch assignments
    useEffect(() => {
        if (user && user.role === "athlete") {
            fetchData(user, selectedMonth);
        }
    }, [selectedMonth, user]);

    const fetchData = async (currentUser: User, month: string) => {
        try {
            // 1. Fetch Coaches in the same branch
            const { data: coachesData, error: coachesError } = await supabase
                .from("users")
                .select("id, name, branch")
                .in("role", ["coach", "head_coach"]);
                
            if (coachesError) throw coachesError;
            
            let branchCoaches = coachesData || [];
            if (currentUser.branch && currentUser.branch !== "총괄") {
                branchCoaches = branchCoaches.filter(c => c.branch === currentUser.branch || c.branch === "총괄");
            }
            setCoaches(branchCoaches);

            // 2. Fetch current assignment for the selected month
            const { data: assignmentData, error: assignmentError } = await supabase
                .from("monthly_assignments")
                .select("coach_id")
                .eq("athlete_id", currentUser.id)
                .eq("month", month)
                .maybeSingle();
                
            if (assignmentError) throw assignmentError;
            
            if (assignmentData && assignmentData.coach_id) {
                setSelectedCoachId(assignmentData.coach_id);
                setOriginalCoachId(assignmentData.coach_id);
            } else {
                setSelectedCoachId("");
                setOriginalCoachId("");
            }
        } catch (error) {
            console.error("Error fetching data:", error);
        }
    };

    const handleSave = async () => {
        if (!user) return;
        
        setIsSaving(true);
        try {
            // Delete existing assignment for this month first
            const { error: deleteError } = await supabase
                .from("monthly_assignments")
                .delete()
                .eq("athlete_id", user.id)
                .eq("month", selectedMonth);
                
            if (deleteError) {
                console.error("Delete error:", deleteError);
                throw deleteError;
            }

            if (selectedCoachId) {
                // Insert the new assignment
                const { error: insertError } = await supabase
                    .from("monthly_assignments")
                    .insert({
                        athlete_id: user.id,
                        coach_id: selectedCoachId,
                        month: selectedMonth,
                        branch: user.branch || "총괄"
                    });
                    
                if (insertError) {
                    console.error("Insert error:", insertError);
                    throw insertError;
                }
            }
            
            setOriginalCoachId(selectedCoachId);
            alert("담임 코치가 성공적으로 저장되었습니다.");
        } catch (error: any) {
            console.error("Save error:", error);
            
            // Extract detailed error info if available
            const detailedError = {
                message: error.message || "알 수 없는 오류",
                details: error.details || "상세 정보 없음",
                hint: error.hint || "힌트 없음",
                code: error.code || "코드 없음",
            };
            
            alert(`저장 중 오류가 발생했습니다: ${detailedError.message}\n상세: ${detailedError.details}`);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950">
                <span className="text-zinc-500 font-medium">로딩 중...</span>
            </div>
        );
    }

    if (user && user.role !== "athlete") {
        return (
            <div className="max-w-3xl mx-auto px-4 py-8">
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 text-center border border-zinc-200 dark:border-zinc-800">
                    <p className="text-zinc-600 dark:text-zinc-400">선수 계정으로만 접근할 수 있는 페이지입니다.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8 space-y-6">
            <div className="mb-6">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight flex items-center gap-2">
                    <UserCircle className="text-brand-navy" size={28} />
                    담임 코치 선택
                </h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
                    매월 나의 훈련과 기록을 전담할 코치를 직접 선택하세요. 소속 지점의 코치님들 중에서 선택할 수 있습니다.
                </p>
            </div>
            
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6 shadow-sm flex flex-col gap-6">
                
                {/* Month Selection */}
                <div className="flex flex-col gap-2">
                    <label className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <Calendar size={18} className="text-brand-navy" />
                        기준 월
                    </label>
                    <div className="w-fit">
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent transition-all"
                        />
                    </div>
                </div>

                <hr className="border-zinc-100 dark:border-zinc-800" />

                {/* Coach List */}
                <div className="flex flex-col gap-4">
                    <label className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                        {user?.branch ? `${user.branch} 코치진` : "코치진"}
                    </label>
                    
                    {coaches.length === 0 ? (
                        <div className="py-8 text-center text-sm text-zinc-500 bg-zinc-50 dark:bg-zinc-800/20 rounded-xl border border-zinc-100 dark:border-zinc-800">
                            선택 가능한 코치가 없습니다.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {coaches.map(coach => {
                                const isSelected = selectedCoachId === coach.id;
                                return (
                                    <button
                                        key={coach.id}
                                        onClick={() => setSelectedCoachId(coach.id)}
                                        className={`flex items-center justify-between p-4 rounded-xl border text-left transition-all ${
                                            isSelected
                                                ? "border-brand-navy bg-brand-navy/5 dark:bg-brand-navy/10 ring-1 ring-brand-navy"
                                                : "border-zinc-200 dark:border-zinc-700 hover:border-brand-navy/30 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 bg-white dark:bg-zinc-900"
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                                isSelected ? "bg-brand-navy text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                                            }`}>
                                                <UserCircle size={20} />
                                            </div>
                                            <div>
                                                <div className={`font-bold ${isSelected ? "text-brand-navy dark:text-brand-navy-light" : "text-zinc-900 dark:text-zinc-100"}`}>
                                                    {coach.name} 코치
                                                </div>
                                                {coach.branch && (
                                                    <div className="text-xs text-zinc-500">{coach.branch}</div>
                                                )}
                                            </div>
                                        </div>
                                        {isSelected && (
                                            <CheckCircle2 size={20} className="text-brand-navy" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex justify-end gap-3">
                <button
                    onClick={() => {
                        setSelectedCoachId(originalCoachId); // Reset
                    }}
                    disabled={selectedCoachId === originalCoachId || isSaving}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                >
                    취소
                </button>
                <button
                    onClick={handleSave}
                    disabled={selectedCoachId === originalCoachId || isSaving}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-brand-navy hover:bg-brand-navy/90 transition-colors disabled:opacity-50 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:text-zinc-500"
                >
                    {isSaving ? "저장 중..." : "변경사항 저장"}
                    {!isSaving && <Check size={16} />}
                </button>
            </div>
        </div>
    );
}
