"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
    Users, 
    Calendar, 
    UserCheck, 
    UserPlus, 
    ChevronRight, 
    ArrowRightLeft, 
    Clock, 
    MapPin,
    Search,
    Filter
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, addMonths, getDate, startOfMonth, lastDayOfMonth } from "date-fns";
import { ko } from "date-fns/locale";

// --- Types ---
interface User {
    id: string;
    name: string;
    role: string;
    branch: string;
    avatar_url?: string;
}

interface Assignment {
    id: string;
    athlete_id: string;
    coach_id: string;
    month: string;
    branch: string;
    coach?: User;
    athlete?: User;
}

export default function AssignedAthletesPage() {
    const supabase = createClient();
    const [user, setUser] = useState<User | null>(null);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [coaches, setCoaches] = useState<User[]>([]);
    const [athletes, setAthletes] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
    const [branchFilter, setBranchFilter] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");

    // Date logic
    const today = new Date();
    const dayOfMonth = getDate(today);
    const isSelectionPeriod = dayOfMonth >= 27 && dayOfMonth <= 31;
    const nextMonth = format(addMonths(today, 1), "yyyy-MM");
    const currentMonthLabel = format(today, "MMMM", { locale: ko });
    const nextMonthLabel = format(addMonths(today, 1), "MMMM", { locale: ko });

    useEffect(() => {
        const initialize = async () => {
            setIsLoading(true);
            try {
                // 1. Get current user
                const { data: { user: authUser } } = await supabase.auth.getUser();
                if (!authUser) return;

                const { data: profile } = await supabase
                    .from('users')
                    .select('id, name, role, branch')
                    .eq('id', authUser.id)
                    .single();
                
                setUser(profile);

                // 2. Fetch all coaches (for selection or admin view)
                const { data: coachesData } = await supabase
                    .from('users')
                    .select('id, name, role, branch')
                    .in('role', ['coach', 'admin', 'head_coach']);
                setCoaches(coachesData || []);

                // 3. Fetch all athletes (for management view)
                if (profile?.role === 'admin' || profile?.role === 'coach' || profile?.role === 'head_coach') {
                    const { data: athletesData } = await supabase
                        .from('users')
                        .select('id, name, role, branch')
                        .eq('role', 'athlete')
                        .order('name');
                    setAthletes(athletesData || []);
                }

                // 4. Fetch assignments
                await fetchAssignments(selectedMonth);

            } catch (err) {
                console.error("Initialization error:", err);
            } finally {
                setIsLoading(false);
            }
        };

        initialize();
    }, [selectedMonth]);

    const fetchAssignments = async (month: string) => {
        const { data, error } = await supabase
            .from('monthly_assignments')
            .select(`
                *,
                coach:coach_id (id, name, branch),
                athlete:athlete_id (id, name, branch)
            `)
            .eq('month', month);
        
        if (data) setAssignments(data as any);
    };

    const handleSelectCoach = async (coachId: string) => {
        if (!user || user.role !== 'athlete') return;
        if (!isSelectionPeriod) {
            alert("지정 기간(매월 27~30일)이 아닙니다.");
            return;
        }

        const monthToAssign = nextMonth;
        const payload = {
            athlete_id: user.id,
            coach_id: coachId,
            month: monthToAssign,
            branch: user.branch || "총괄"
        };

        try {
            console.log("Attempting coach selection with payload:", payload);
            
            if (!coachId) {
                const { error } = await supabase
                    .from('monthly_assignments')
                    .delete()
                    .eq('athlete_id', user.id)
                    .eq('month', monthToAssign);
                
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('monthly_assignments')
                    .upsert(payload, { onConflict: 'athlete_id,month' });

                if (error) throw error;
            }
            alert(`${nextMonthLabel} 담임 코치가 지정되었습니다.`);
            fetchAssignments(selectedMonth);
        } catch (err: any) {
            console.error("Selection error DETAILED:", err);
            // Some error objects don't stringify well, let's pick fields manually
            const detailedError = {
                message: err.message || "Unknown error",
                details: err.details || "No details",
                hint: err.hint || "No hint",
                code: err.code || "No code",
                status: err.status || "No status"
            };
            console.error("Selection error object:", detailedError);
            alert(`코치 지정 실패: ${detailedError.message}\n상세: ${detailedError.details}`);
        }
    };

    const handleAdminAssignCoach = async (athlete: User, coachId: string) => {
        if (!user || (user.role !== 'admin' && user.role !== 'head_coach')) return;
        
        try {
            if (!coachId) {
                // If unassigned, delete the record
                const { error } = await supabase
                    .from('monthly_assignments')
                    .delete()
                    .eq('athlete_id', athlete.id)
                    .eq('month', selectedMonth);
                
                if (error) throw error;
            } else {
                // If coach selected, upsert the record
                const { error } = await supabase
                    .from('monthly_assignments')
                    .upsert({
                        athlete_id: athlete.id,
                        coach_id: coachId,
                        month: selectedMonth,
                        branch: athlete.branch || "총괄" // Fallback to avoid NOT NULL constraint
                    }, { onConflict: 'athlete_id,month' });

                if (error) throw error;
            }
            fetchAssignments(selectedMonth);
        } catch (err: any) {
            console.error("Admin assignment error FULL DETAILS:", {
                message: err.message,
                details: err.details,
                hint: err.hint,
                code: err.code,
                context: { athleteId: athlete.id, coachId, month: selectedMonth }
            });
            const errorMsg = err.message || (err.error_description) || "권한이 없거나 데이터베이스 오류가 발생했습니다.";
            alert(`코치 지정 실패: ${errorMsg}\n상세: ${err.details || "없음"}\n힌트: ${err.hint || "없음"}`);
        }
    };

    const handleMonthChange = (delta: number) => {
        const current = new Date(selectedMonth + "-01");
        const next = addMonths(current, delta);
        setSelectedMonth(format(next, "yyyy-MM"));
    };

    const filteredAthletesList = useMemo(() => {
        return athletes.filter(a => {
            const matchesBranch = branchFilter === 'all' || a.branch === branchFilter;
            const matchesSearch = !searchQuery || a.name.includes(searchQuery);
            return matchesBranch && matchesSearch;
        });
    }, [athletes, branchFilter, searchQuery]);

    const filteredAssignments = useMemo(() => {
        return assignments.filter(a => {
            const matchesBranch = branchFilter === 'all' || a.branch === branchFilter;
            const matchesSearch = !searchQuery || 
                a.athlete?.name.includes(searchQuery) || 
                a.coach?.name.includes(searchQuery);
            return matchesBranch && matchesSearch;
        });
    }, [assignments, branchFilter, searchQuery]);

    const myNextMonthCoach = useMemo(() => {
        if (user?.role !== 'athlete') return null;
        return assignments.find(a => a.athlete_id === user.id && a.month === nextMonth)?.coach;
    }, [assignments, user, nextMonth]);

    const myCurrentMonthCoach = useMemo(() => {
        if (user?.role !== 'athlete') return null;
        const currentMonth = format(new Date(), "yyyy-MM");
        return assignments.find(a => a.athlete_id === user.id && a.month === currentMonth)?.coach;
    }, [assignments, user]);

    const coachStats = useMemo(() => {
        const stats: Record<string, { name: string; count: number; branch: string; athleteNames: string[] }> = {};
        
        // Initialize with all visible coaches if needed, or just those with assignments
        filteredAssignments.forEach(a => {
            if (a.coach_id && a.coach) {
                if (!stats[a.coach_id]) {
                    stats[a.coach_id] = { name: a.coach.name, count: 0, branch: a.coach.branch, athleteNames: [] };
                }
                stats[a.coach_id].count++;
                if (a.athlete?.name) {
                    stats[a.coach_id].athleteNames.push(a.athlete.name);
                }
            }
        });
        
        return Object.values(stats).sort((a, b) => b.count - a.count);
    }, [filteredAssignments]);

    // Render for Athlete
    const renderAthleteView = () => {
        if (!user) return null;

        const assignment = assignments.find(a => a.athlete_id === user.id && a.month === selectedMonth);
        const assignedCoach = assignment?.coach;
        
        // Month label
        const monthDate = new Date(selectedMonth + "-01");
        const monthLabel = format(monthDate, "MMMM", { locale: ko });
        const isSelectedMonthNextMonth = selectedMonth === nextMonth;
        const canSelect = isSelectedMonthNextMonth && isSelectionPeriod;
        
        return (
            <div className="space-y-6 max-w-lg mx-auto">
                {/* Status Card */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-full mb-6">
                        <Calendar size={14} className="text-zinc-500" />
                        <span className="text-sm font-black text-zinc-700 dark:text-zinc-300 uppercase tracking-tight">{monthLabel} 담임 코치</span>
                    </div>

                    <div className="flex flex-col items-center justify-center py-4">
                        {assignedCoach ? (
                            <div className="space-y-3">
                                <div className="w-12 h-12 bg-brand-navy/10 rounded-full flex items-center justify-center mx-auto">
                                    <UserCheck size={24} className="text-brand-navy dark:text-brand-navy-light" />
                                </div>
                                <div>
                                    <p className="text-xl font-black text-zinc-900 dark:text-zinc-50">{assignedCoach.name} 코치</p>
                                    <p className="text-xs font-bold text-zinc-400">{assignedCoach.branch}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4 w-full">
                                <p className="text-sm font-black text-zinc-400">{monthLabel} 담임 코치를 지정해 주세요</p>
                                {canSelect ? (
                                    <div className="relative max-w-[200px] mx-auto">
                                        <select
                                            onChange={(e) => handleSelectCoach(e.target.value)}
                                            className="w-full bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 px-4 py-2.5 rounded-xl text-xs font-black appearance-none text-center cursor-pointer hover:border-brand-navy transition-all shadow-sm"
                                        >
                                            <option value="">코치 선택하기</option>
                                            {coaches
                                                .filter(c => c.branch === user.branch || user.branch === '총괄')
                                                .map(coach => (
                                                    <option key={coach.id} value={coach.id}>{coach.name} 코치 ({coach.branch})</option>
                                                ))
                                            }
                                        </select>
                                        <ChevronRight size={14} className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
                                    </div>
                                ) : (
                                    <p className="text-[11px] font-bold text-zinc-300">지정 기간에 가능합니다 (매월 27~말일)</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Change Button (If already assigned but still in period) */}
                    {assignedCoach && canSelect && (
                        <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                            <select
                                onChange={(e) => handleSelectCoach(e.target.value)}
                                className="inline-flex items-center gap-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg text-[11px] font-bold text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 transition-all cursor-pointer"
                            >
                                <option value="">코치 변경하기</option>
                                {coaches
                                    .filter(c => c.branch === user.branch || user.branch === '총괄')
                                    .filter(c => c.id !== assignedCoach.id)
                                    .map(coach => (
                                        <option key={coach.id} value={coach.id}>{coach.name} 코치 ({coach.branch})</option>
                                    ))
                                }
                            </select>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // Render for Coach/Admin
    const renderManagementView = () => {
        return (
            <div className="space-y-6">
                {/* Assignment Table */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800">
                                    <th className="px-4 py-4 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">선수</th>
                                    <th className="px-4 py-4 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">담임 코치</th>
                                    <th className="px-4 py-4 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">지점</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {filteredAthletesList.length > 0 ? (
                                    filteredAthletesList.map(athlete => {
                                        const assignment = assignments.find(a => a.athlete_id === athlete.id);
                                        const assignedCoach = assignment?.coach;

                                        return (
                                            <tr key={athlete.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                                                <td className="px-4 py-3">
                                                    <span className="text-sm font-black text-zinc-900 dark:text-zinc-100">{athlete.name}</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {user?.role === 'admin' || user?.role === 'head_coach' ? (
                                                        <select
                                                            value={assignedCoach?.id || ""}
                                                            onChange={(e) => handleAdminAssignCoach(athlete, e.target.value)}
                                                            className="text-sm font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-navy/20 w-full max-w-[120px]"
                                                        >
                                                            <option value="">미지정</option>
                                                            {coaches
                                                                .filter(c => c.branch === athlete.branch || athlete.branch === '총괄')
                                                                .map(c => (
                                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                                ))
                                                            }
                                                        </select>
                                                    ) : (
                                                        <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                                                            {assignedCoach ? assignedCoach.name : "미지정"}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="text-[11px] text-zinc-500 whitespace-nowrap">{athlete.branch}</span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-16 text-center text-zinc-400 text-sm">
                                            선수 데이터가 없습니다.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Coach Assignment Stats */}
                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 px-1">코치별 담당 인원 현황</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                        {coachStats.length > 0 ? (
                            coachStats.map(stat => (
                                <div key={stat.name} className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm flex flex-col items-center text-center">
                                    <div className="w-10 h-10 rounded-full bg-brand-navy/10 flex items-center justify-center mb-2">
                                        <UserCheck size={20} className="text-brand-navy dark:text-brand-navy-light" />
                                    </div>
                                    <p className="text-sm font-black text-zinc-900 dark:text-zinc-100">{stat.name}</p>
                                    <p className="text-[11px] text-zinc-400 mb-1">{stat.branch}</p>
                                    <p className="text-lg font-black text-brand-navy dark:text-brand-navy-light">{stat.count}명</p>
                                    {stat.athleteNames.length > 0 && (
                                        <p className="text-[10px] text-zinc-500 mt-1 break-all line-clamp-2">
                                            {stat.athleteNames.join(', ')}
                                        </p>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="col-span-full p-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-center text-zinc-400 text-sm">
                                배정 내역이 없습니다.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    if (isLoading) {
        return <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">로딩 중...</div>;
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-20">
            <header className="sticky top-0 z-30 bg-zinc-50/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
                <div className="max-w-5xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-brand-navy rounded-lg text-white">
                            <UserPlus size={20} />
                        </div>
                        <h1 className="text-lg font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
                            담임 선수 관리
                        </h1>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 sm:px-8 py-8">
                {/* Shared Month Navigation */}
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm">
                            <Calendar size={16} className="text-zinc-400" />
                            <input 
                                type="month" 
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="bg-transparent text-sm font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none"
                            />
                        </div>
                        <div className="flex gap-1">
                            <button
                                onClick={() => handleMonthChange(-1)}
                                className="px-3 py-2 rounded-xl text-[11px] font-bold transition-all border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 hover:bg-zinc-50"
                            >
                                이전 달
                            </button>
                            <button
                                onClick={() => setSelectedMonth(format(new Date(), "yyyy-MM"))}
                                className={cn(
                                    "px-3 py-2 rounded-xl text-[11px] font-bold transition-all border",
                                    selectedMonth === format(new Date(), "yyyy-MM")
                                        ? "bg-brand-navy border-brand-navy text-white"
                                        : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500"
                                )}
                            >
                                이번 달
                            </button>
                            <button
                                onClick={() => handleMonthChange(1)}
                                className="px-3 py-2 rounded-xl text-[11px] font-bold transition-all border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 hover:bg-zinc-50"
                            >
                                다음 달
                            </button>
                        </div>
                    </div>

                    {user?.role !== 'athlete' && (
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <div className="relative flex-1 sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                <input 
                                    type="text"
                                    placeholder="선수/코치 검색..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/40"
                                />
                            </div>
                            <select 
                                value={branchFilter}
                                onChange={(e) => setBranchFilter(e.target.value)}
                                className="px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none"
                            >
                                <option value="all">전체 지점</option>
                                {["총괄", "오피스", "조이마루점", "구미점"].map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>
                    )}
                </div>

                {user?.role === 'athlete' ? renderAthleteView() : renderManagementView()}
            </main>
        </div>
    );
}
