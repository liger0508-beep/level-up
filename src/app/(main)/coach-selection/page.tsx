"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { UserCircle, Calendar, CheckCircle2, Check, ChevronLeft, ChevronRight } from "lucide-react";
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
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = new Date();
        if (now.getDate() >= 25) {
            const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            return format(nextMonth, "yyyy-MM");
        }
        return format(now, "yyyy-MM");
    });
    const [coaches, setCoaches] = useState<Coach[]>([]);
    const [selectedCoachId, setSelectedCoachId] = useState<string>("");
    const [originalCoachId, setOriginalCoachId] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [coachCounts, setCoachCounts] = useState<Record<string, number>>({});
    const [branchFilter, setBranchFilter] = useState("조이마루점");
    const [selectionSettings, setSelectionSettings] = useState({ enabled: true, startDay: 25, endDay: 31 });
    const [isSavingSettings, setIsSavingSettings] = useState(false);

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
                
                if (profile && ["athlete", "admin", "office", "headquarter"].includes(profile.role)) {
                    await fetchData(profile, selectedMonth);
                }
                
                try {
                    const res = await fetch("/api/coach-selection-settings");
                    if (res.ok) {
                        const settingsData = await res.json();
                        setSelectionSettings(settingsData);
                    }
                } catch (e) {
                    console.error("Failed to load settings from API", e);
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
        if (user && ["athlete", "admin", "office", "headquarter"].includes(user.role)) {
            fetchData(user, selectedMonth);
        }
    }, [selectedMonth, user]);

    const handleMonthChange = (offset: number) => {
        const [year, month] = selectedMonth.split('-').map(Number);
        const date = new Date(year, month - 1 + offset, 1);
        setSelectedMonth(format(date, "yyyy-MM"));
    };

    const fetchData = async (currentUser: User, month: string) => {
        try {
            // 1. Fetch Coaches
            const { data: coachesData, error: coachesError } = await supabase
                .from("users")
                .select("id, name, branch")
                .in("role", ["coach", "head_coach"]);
                
            if (coachesError) throw coachesError;
            
            let branchCoaches = coachesData || [];
            branchCoaches = branchCoaches.filter((c: any) => c.branch !== "오피스" && c.branch !== "총괄");
            
            // Joymaru specific filter: ONLY 6 coaches
            const allowedJoymaru = ["김규태", "김봉진", "이동진", "김종명", "박치우", "성세환"];
            // Gumi specific filter: ONLY 3 coaches
            const allowedGumi = ["이준", "문치환", "이기찬"];
            
            branchCoaches = branchCoaches.filter((c: any) => {
                if (c.branch === "조이마루점") {
                    return allowedJoymaru.includes(c.name);
                }
                if (c.branch === "구미점") {
                    return allowedGumi.includes(c.name);
                }
                return true;
            });
            
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
            
            // 3. Fetch all assignments for the month to calculate limits
            const { data: allAssignments } = await supabase
                .from("monthly_assignments")
                .select("coach_id")
                .eq("month", month);
                
            const counts: Record<string, number> = {};
            if (allAssignments) {
                allAssignments.forEach((a: any) => {
                    counts[a.coach_id] = (counts[a.coach_id] || 0) + 1;
                });
            }
            setCoachCounts(counts);
        } catch (error) {
            console.error("Error fetching data:", error);
        }
    };

    const handleSave = async () => {
        if (!user) return;
        
        setIsSaving(true);
        try {
            // Re-check count before saving to prevent race conditions
            if (selectedCoachId && selectedCoachId !== originalCoachId) {
                const { data: latestAssignments } = await supabase
                    .from("monthly_assignments")
                    .select("id")
                    .eq("coach_id", selectedCoachId)
                    .eq("month", selectedMonth);
                    
                if (latestAssignments && latestAssignments.length >= 7) {
                    alert("선택하신 코치님은 이미 최대 정원(7명)이 마감되었습니다. 다른 코치님을 선택해 주세요.");
                    await fetchData(user, selectedMonth); // Refresh list
                    setIsSaving(false);
                    return;
                }
            }

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
                        branch: user.branch || "전체"
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

    const handleSaveSettings = async () => {
        setIsSavingSettings(true);
        try {
            const res = await fetch("/api/coach-selection-settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(selectionSettings)
            });
            
            if (!res.ok) {
                throw new Error("API responded with an error");
            }
            alert("설정이 정상적으로 저장되었습니다.");
        } catch (e) {
            console.error("Settings save error:", e);
            alert("설정 저장 중 오류가 발생했습니다.");
        } finally {
            setIsSavingSettings(false);
        }
    };

    const isSelectionAllowed = () => {
        // 활성화 토글이 꺼져있으면 무조건 선택 불가 (관리자 포함)
        if (!selectionSettings.enabled) return false;
        
        // 관리자 권한은 기간에 상관없이(또는 테스트용) 선택 가능하게 하려면 아래 주석 해제 (현재는 주석 처리)
        // if (user && ["admin", "superadmin", "office", "headquarter"].includes(user.role)) return true;
        
        const now = new Date();
        const currentDay = now.getDate();
        return currentDay >= selectionSettings.startDay && currentDay <= selectionSettings.endDay;
    };

    const renderCoachButton = (coach: Coach) => {
        const isSelected = selectedCoachId === coach.id;
        const isMyCurrentOriginal = originalCoachId === coach.id;
        const currentCount = coachCounts[coach.id] || 0;
        const isFull = currentCount >= 7 && !isMyCurrentOriginal;
        const allowed = isSelectionAllowed();
        
        return (
            <button
                key={coach.id}
                onClick={() => setSelectedCoachId(isSelected ? "" : coach.id)}
                disabled={isFull || !allowed}
                className={`flex items-center justify-between p-4 rounded-xl border text-left transition-all ${
                    isSelected
                        ? "border-brand-navy bg-brand-navy/5 dark:bg-brand-navy/10 ring-1 ring-brand-navy"
                        : (isFull || !allowed)
                            ? "opacity-50 bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 cursor-not-allowed"
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
                        <div className={`font-bold flex items-center gap-2 ${isSelected ? "text-brand-navy dark:text-brand-navy-light" : "text-zinc-900 dark:text-zinc-100"}`}>
                            {coach.name} 코치
                            {isFull && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-md font-bold">마감</span>}
                        </div>
                        <div className="flex items-center gap-2">
                            {coach.branch && (
                                <span className="text-xs text-zinc-500">{coach.branch}</span>
                            )}
                            <span className={`text-[10px] font-bold ${currentCount >= 7 ? "text-red-500" : "text-zinc-400"}`}>
                                {currentCount}/7명
                            </span>
                        </div>
                    </div>
                </div>
                {isSelected && (
                    <CheckCircle2 size={20} className="text-brand-navy" />
                )}
            </button>
        );
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950">
                <span className="text-zinc-500 font-medium">로딩 중...</span>
            </div>
        );
    }

    if (user && !["athlete", "admin", "office", "headquarter"].includes(user.role)) {
        return (
            <div className="max-w-3xl mx-auto px-4 py-8">
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 text-center border border-zinc-200 dark:border-zinc-800">
                    <p className="text-zinc-600 dark:text-zinc-400">접근 권한이 없습니다.</p>
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
                    <div className="w-fit flex items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-1 shadow-sm transition-all focus-within:ring-2 focus-within:ring-brand-navy focus-within:border-transparent">
                        <button
                            onClick={() => handleMonthChange(-1)}
                            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 transition-colors active:scale-95"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-transparent px-2 py-1.5 text-sm font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none flex-1 text-center"
                        />
                        <button
                            onClick={() => handleMonthChange(1)}
                            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 transition-colors active:scale-95"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>

                {user && ["admin", "superadmin", "office", "headquarter"].includes(user.role) && (
                    <div className="flex flex-col gap-4 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-brand-navy"></span>
                                담임 코치 선택 기능 활성화
                            </label>
                            <button 
                                onClick={() => setSelectionSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
                                className={`w-12 h-6 rounded-full transition-colors relative flex items-center ${selectionSettings.enabled ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-600"}`}
                            >
                                <span className={`w-5 h-5 bg-white rounded-full absolute shadow-sm transition-all ${selectionSettings.enabled ? "left-6" : "left-1"}`}></span>
                            </button>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">시작일</span>
                                <input 
                                    type="number" 
                                    min="1" max="31"
                                    value={selectionSettings.startDay}
                                    onChange={(e) => setSelectionSettings(prev => ({ ...prev, startDay: Number(e.target.value) }))}
                                    className="w-16 px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-center focus:outline-none focus:border-brand-navy"
                                />
                                <span className="text-sm text-zinc-500">일</span>
                            </div>
                            <span className="text-zinc-300 dark:text-zinc-600 hidden sm:block">~</span>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">종료일</span>
                                <input 
                                    type="number" 
                                    min="1" max="31"
                                    value={selectionSettings.endDay}
                                    onChange={(e) => setSelectionSettings(prev => ({ ...prev, endDay: Number(e.target.value) }))}
                                    className="w-16 px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-center focus:outline-none focus:border-brand-navy"
                                />
                                <span className="text-sm text-zinc-500">일</span>
                            </div>
                            <button
                                onClick={handleSaveSettings}
                                disabled={isSavingSettings}
                                className="ml-auto px-4 py-1.5 bg-zinc-800 text-white text-xs font-bold rounded-lg hover:bg-zinc-700 transition-colors"
                            >
                                {isSavingSettings ? "저장 중..." : "설정 저장"}
                            </button>
                        </div>
                    </div>
                )}

                <hr className="border-zinc-100 dark:border-zinc-800" />
                
                {/* Branch Selection */}
                <div className="flex flex-col gap-2">
                    <label className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                        지점 선택
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {["전체", "조이마루점", "구미점"].map(branch => (
                            <button
                                key={branch}
                                onClick={() => setBranchFilter(branch)}
                                className={`px-5 py-2 rounded-xl text-sm font-bold transition-all border ${
                                    branchFilter === branch
                                        ? "bg-brand-navy border-brand-navy text-white shadow-md"
                                        : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                }`}
                            >
                                {branch}
                            </button>
                        ))}
                    </div>
                </div>

                <hr className="border-zinc-100 dark:border-zinc-800" />

                {/* Coach List */}
                <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-end">
                        <label className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                            {branchFilter !== "전체" ? `${branchFilter} 코치진` : "전체 코치진"}
                        </label>
                        <div className="flex items-center gap-3">
                            {!isSelectionAllowed() && user && user.role === "athlete" && (
                                <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded-md">
                                    현재는 선택 기간이 아닙니다 ({selectionSettings.startDay}일~{selectionSettings.endDay}일)
                                </span>
                            )}
                            <span className="text-xs font-medium text-zinc-500">※ 선착순 최대 7명</span>
                        </div>
                    </div>
                    
                    {coaches.filter(c => branchFilter === "전체" || c.branch === branchFilter).length === 0 ? (
                        <div className="py-8 text-center text-sm text-zinc-500 bg-zinc-50 dark:bg-zinc-800/20 rounded-xl border border-zinc-100 dark:border-zinc-800">
                            선택 가능한 코치가 없습니다.
                        </div>
                    ) : (
                        <>
                            {branchFilter === "조이마루점" ? (
                                <div className="space-y-6">
                                    <div className="space-y-3">
                                        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-brand-navy"></span>
                                            샷 파트
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {coaches
                                                .filter(c => c.branch === "조이마루점" && ["김규태", "김봉진", "이동진"].includes(c.name))
                                                .sort((a, b) => ["김규태", "김봉진", "이동진"].indexOf(a.name) - ["김규태", "김봉진", "이동진"].indexOf(b.name))
                                                .map(renderCoachButton)}
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-brand-navy"></span>
                                            숏게임 파트
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {coaches
                                                .filter(c => c.branch === "조이마루점" && ["김종명", "박치우", "성세환"].includes(c.name))
                                                .sort((a, b) => ["김종명", "박치우", "성세환"].indexOf(a.name) - ["김종명", "박치우", "성세환"].indexOf(b.name))
                                                .map(renderCoachButton)}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {coaches
                                        .filter(c => branchFilter === "전체" || c.branch === branchFilter)
                                        .map(renderCoachButton)}
                                </div>
                            )}
                        </>
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
