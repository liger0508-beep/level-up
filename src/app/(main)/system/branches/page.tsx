"use client";

import { useState, useEffect, useMemo } from "react";
import {
    MapPin,
    Plus,
    Building2,
    Users,
    UserCircle,
    User,
    ChevronRight,
    Search,
    MoreVertical,
    Trash2,
    Edit2,
    Shield,
    X,
    ChevronDown,
    Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

// ── Types ──
interface Branch {
    id: string;
    name: string;
    address: string;
    createdAt: string;
}

interface UserMember {
    id: string;
    name: string;
    role: "coach" | "athlete" | "parent" | "admin";
    branch: string | null;
}

// ── Standardized Branches ──
const STANDARD_BRANCHES: Branch[] = [
    { id: "조이마루점", name: "조이마루점", address: "대전광역시 유성구 엑스포로 97번길 40", createdAt: "2024-01-01" },
    { id: "구미점", name: "구미점", address: "경상북도 구미시 신시로 14", createdAt: "2024-06-15" }
];

export default function BranchesPage() {
    const supabase = createClient();
    const [branches] = useState<Branch[]>(STANDARD_BRANCHES);
    const [members, setMembers] = useState<UserMember[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeBranchId, setActiveBranchId] = useState<string | null>(STANDARD_BRANCHES[0].id);

    const [isAddBranchModalOpen, setIsAddBranchModalOpen] = useState(false);
    const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [detailSearchQuery, setDetailSearchQuery] = useState("");

    // Fetch members from Supabase
    useEffect(() => {
        const fetchMembers = async () => {
            setIsLoading(true);
            const { data, error } = await supabase
                .from("users")
                .select("id, name, role, branch");
            
            if (error) {
                console.error("Error fetching members:", error);
            } else if (data) {
                setMembers(data as UserMember[]);
            }
            setIsLoading(false);
        };
        fetchMembers();
    }, []);

    const activeBranch = branches.find(b => b.id === activeBranchId);

    // Derived stats
    const branchMembers = members.filter(m => m.branch === activeBranchId);

    // Filtered members for the detail view
    const filteredBranchMembers = branchMembers.filter(m =>
        m.name.toLowerCase().includes(detailSearchQuery.toLowerCase())
    );

    const coachesCount = branchMembers.filter(m => m.role === "coach" || m.role === "admin").length;
    const athletesCount = branchMembers.filter(m => m.role === "athlete").length;
    const parentsCount = branchMembers.filter(m => m.role === "parent").length;

    // Unassigned members (or members from other branches that could be transferred)
    const unassignedAthletes = members.filter(m => m.role === "athlete" && m.branch !== activeBranchId && m.name.includes(searchQuery));
    const unassignedCoaches = members.filter(m => (m.role === "coach" || m.role === "admin") && m.branch !== activeBranchId && m.name.includes(searchQuery));

    // Handlers
    const handleAssignMember = async (memberId: string) => {
        if (!activeBranchId) return;

        const { error } = await supabase
            .from("users")
            .update({ branch: activeBranchId })
            .eq("id", memberId);

        if (error) {
            console.error("Error assigning branch:", error);
            alert("지점 배정 중 오류가 발생했습니다.");
            return;
        }

        // Local state update
        setMembers(prev => prev.map(m => 
            m.id === memberId ? { ...m, branch: activeBranchId } : m
        ));
    };

    const handleChangeBranch = async (memberId: string, newBranchId: string | "exclude") => {
        const targetBranch = newBranchId === "exclude" ? null : newBranchId;

        const { error } = await supabase
            .from("users")
            .update({ branch: targetBranch })
            .eq("id", memberId);

        if (error) {
            console.error("Error changing branch:", error);
            alert("지점 변경 중 오류가 발생했습니다.");
            return;
        }

        // Local state update
        setMembers(prev => prev.map(m => 
            m.id === memberId ? { ...m, branch: targetBranch } : m
        ));
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-brand-navy animate-spin" />
                    <p className="text-sm text-zinc-500 font-medium">데이터를 불러오는 중...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-24">
            <main className="max-w-6xl mx-auto px-4 sm:px-8 py-10">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-2">
                        <Building2 size={24} className="text-brand-navy dark:text-brand-navy-light shrink-0" />
                        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
                            지점 관리
                        </h1>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Column: Branch List */}
                    <div className="lg:col-span-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 px-1">
                                지점 목록 ({branches.length})
                            </h2>
                            <button
                                onClick={() => alert("지점 추가 기능은 시스템 설정에서 가능합니다.")}
                                className="flex items-center gap-1 text-xs font-semibold text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-full transition-colors cursor-not-allowed"
                            >
                                <Plus size={14} />
                                지점 추가
                            </button>
                        </div>

                        <div className="space-y-3">
                            {branches.map(branch => {
                                const isActive = activeBranchId === branch.id;
                                const bMembers = members.filter(m => m.branch === branch.id);
                                return (
                                    <div
                                        key={branch.id}
                                        onClick={() => setActiveBranchId(branch.id)}
                                        className={cn(
                                            "p-4 rounded-2xl border cursor-pointer transition-all relative group",
                                            isActive
                                                ? "bg-white dark:bg-zinc-900 border-brand-navy shadow-md ring-1 ring-brand-navy"
                                                : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm"
                                        )}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className={cn(
                                                "font-bold text-lg",
                                                isActive ? "text-brand-navy dark:text-white" : "text-zinc-900 dark:text-zinc-100"
                                            )}>
                                                {branch.name}
                                            </h3>
                                        </div>
                                        <p className="text-xs text-zinc-500 flex items-center gap-1 mb-4">
                                            <MapPin size={12} />
                                            {branch.address}
                                        </p>
                                        <div className="flex items-center gap-4 text-xs font-medium text-zinc-600 dark:text-zinc-400 border-t border-zinc-100 dark:border-zinc-800 pt-3">
                                            <div className="flex items-center gap-1.5">
                                                <Shield size={14} className="text-zinc-400" />
                                                <span>코치 <b>{bMembers.filter(m => m.role === "coach" || m.role === "admin").length}</b>명</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Users size={14} className="text-zinc-400" />
                                                <span>선수 <b>{bMembers.filter(m => m.role === "athlete").length}</b>명</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Column: Branch Details */}
                    <div className="lg:col-span-8">
                        {activeBranch ? (
                            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                                {/* Header */}
                                <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 whitespace-nowrap">
                                                    {activeBranch.name} 상세 관리
                                                </h2>
                                                <span className="text-xs px-2 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-md font-medium whitespace-nowrap">
                                                    설립일: {activeBranch.createdAt}
                                                </span>
                                            </div>
                                            <p className="text-sm text-zinc-500 mt-1 break-keep leading-relaxed">{activeBranch.address}</p>
                                        </div>
                                        <button
                                            onClick={() => setIsAddMemberModalOpen(true)}
                                            className="px-4 py-2 bg-brand-navy hover:bg-brand-navy-light text-white text-sm font-bold rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 whitespace-nowrap shrink-0 w-full sm:w-auto"
                                        >
                                            <Plus size={16} />
                                            인원 배치
                                        </button>
                                    </div>

                                    {/* Stats grid */}
                                    <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-6">
                                        <div className="bg-white dark:bg-zinc-950 p-3 sm:p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-center">
                                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-brand-navy dark:text-brand-navy-light mb-2">
                                                <Shield size={16} className="sm:w-[18px] sm:h-[18px]" />
                                                <span className="text-[11px] sm:text-sm font-semibold whitespace-nowrap">소속 코치</span>
                                            </div>
                                            <span className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100">{coachesCount}명</span>
                                        </div>
                                        <div className="bg-white dark:bg-zinc-950 p-3 sm:p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-center">
                                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-emerald-600 dark:text-emerald-400 mb-2">
                                                <Users size={16} className="sm:w-[18px] sm:h-[18px]" />
                                                <span className="text-[11px] sm:text-sm font-semibold whitespace-nowrap">소속 선수</span>
                                            </div>
                                            <span className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100">{athletesCount}명</span>
                                        </div>
                                        <div className="bg-white dark:bg-zinc-950 p-3 sm:p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-center">
                                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-amber-600 dark:text-amber-500 mb-2">
                                                <UserCircle size={16} className="sm:w-[18px] sm:h-[18px]" />
                                                <span className="text-[11px] sm:text-sm font-semibold whitespace-nowrap tracking-tighter sm:tracking-normal">소속 학부모</span>
                                            </div>
                                            <span className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100">{parentsCount}명</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Lists */}
                                <div className="p-6 space-y-8">
                                    {/* Inline Search */}
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                        <input
                                            type="text"
                                            placeholder="소속 코치 또는 선수 검색"
                                            value={detailSearchQuery}
                                            onChange={(e) => setDetailSearchQuery(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-brand-navy/40 outline-none transition-all shadow-sm"
                                        />
                                    </div>

                                    {/* Coaches List */}
                                    <div>
                                        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-3 flex items-center gap-2">
                                            <Shield size={16} className="text-zinc-400" />
                                            코치 명단 ({filteredBranchMembers.filter(m => m.role === 'coach' || m.role === 'admin').length})
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {filteredBranchMembers.filter(m => m.role === 'coach' || m.role === 'admin').map(coach => (
                                                <div key={coach.id} className="flex items-center justify-between p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-brand-navy/10 text-brand-navy flex items-center justify-center font-bold text-xs">
                                                            {coach.name[0]}
                                                        </div>
                                                        <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{coach.name}</span>
                                                    </div>
                                                    <div className="relative flex items-center shrink-0">
                                                        <select
                                                            value=""
                                                            onChange={(e) => {
                                                                if (e.target.value) handleChangeBranch(coach.id, e.target.value);
                                                            }}
                                                            className="appearance-none flex items-center gap-1.5 pl-3 pr-7 py-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:text-brand-navy dark:hover:text-white bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:border-brand-navy/30 dark:hover:border-brand-navy-light/50 rounded-lg transition-colors cursor-pointer outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
                                                        >
                                                            <option value="" disabled hidden>변경</option>
                                                            {branches.filter(b => b.id !== activeBranchId).map(b => (
                                                                <option key={b.id} value={b.id}>{b.name} 이동</option>
                                                            ))}
                                                            <option value="exclude" className="text-red-500 font-medium">소속 제외</option>
                                                        </select>
                                                        <div className="absolute right-2 pointer-events-none text-zinc-400">
                                                            <ChevronDown size={14} />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            {coachesCount === 0 && (
                                                <p className="text-sm text-zinc-500 col-span-2 py-2">소속된 코치가 없습니다.</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Athletes & Parents List */}
                                    <div>
                                        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-3 flex items-center gap-2">
                                            <Users size={16} className="text-zinc-400" />
                                            선수 명단 ({filteredBranchMembers.filter(m => m.role === 'athlete').length})
                                        </h3>
                                        <div className="space-y-3">
                                            {filteredBranchMembers.filter(m => m.role === 'athlete').map(athlete => {
                                                return (
                                                    <div key={athlete.id} className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 rounded-full border border-zinc-200 dark:border-zinc-700 overflow-hidden bg-white">
                                                                <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${athlete.name}&backgroundColor=e4e4e7`} alt="" className="w-full h-full object-cover" />
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{athlete.name} 선수</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="relative flex items-center shrink-0">
                                                            <select
                                                                value=""
                                                                onChange={(e) => {
                                                                    if (e.target.value) handleChangeBranch(athlete.id, e.target.value);
                                                                }}
                                                                className="appearance-none flex items-center gap-1.5 pl-3 pr-7 py-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:text-brand-navy dark:hover:text-white bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:border-brand-navy/30 dark:hover:border-brand-navy-light/50 rounded-lg transition-colors cursor-pointer outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
                                                            >
                                                                <option value="" disabled hidden>변경</option>
                                                                {branches.filter(b => b.id !== activeBranchId).map(b => (
                                                                    <option key={b.id} value={b.id}>{b.name} 이동</option>
                                                                ))}
                                                                <option value="exclude" className="text-red-500 font-medium">소속 제외</option>
                                                            </select>
                                                            <div className="absolute right-2 pointer-events-none text-zinc-400">
                                                                <ChevronDown size={14} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {athletesCount === 0 && (
                                                <p className="text-sm text-zinc-500 py-2">소속된 선수가 없습니다.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full min-h-[400px] flex flex-col items-center justify-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl bg-white/50 dark:bg-zinc-900/50">
                                <Building2 size={48} className="text-zinc-300 mb-4" />
                                <p className="text-zinc-500 font-medium">좌측에서 지점을 선택해주세요.</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Assign Member Modal */}
            {isAddMemberModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-xl shadow-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[85vh]">
                        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 shrink-0">
                            <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                <Users size={20} className="text-brand-navy" />
                                {activeBranch?.name} 인원 배치
                            </h3>
                            <button onClick={() => setIsAddMemberModalOpen(false)} className="p-1.5 text-zinc-400 hover:text-zinc-900 bg-white rounded-lg border border-zinc-200">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="이름으로 검색 (다른 지점 인원 포함)"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all"
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-5 space-y-6">

                            {/* Coaches Header */}
                            <div>
                                <h4 className="text-sm font-bold text-zinc-600 dark:text-zinc-400 mb-3 border-b pb-2 flex items-center gap-2">
                                    <Shield size={16} /> 코치 ({unassignedCoaches.length})
                                </h4>
                                <div className="space-y-2">
                                    {unassignedCoaches.length > 0 ? unassignedCoaches.map(coach => (
                                        <div key={coach.id} className="flex flex-wrap sm:flex-nowrap items-center justify-between p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-brand-navy/50 transition-colors bg-white dark:bg-zinc-950">
                                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                                <div className="w-8 h-8 rounded-full bg-brand-navy/10 text-brand-navy flex items-center justify-center font-bold text-xs">
                                                    {coach.name[0]}
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{coach.name}</div>
                                                    <div className="text-xs text-zinc-400">{coach.branch ? (coach.branch + " 소속") : "소속 없음"}</div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleAssignMember(coach.id)}
                                                className="w-full sm:w-auto mt-2 sm:mt-0 px-4 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-brand-navy hover:text-white text-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-lg transition-colors border border-zinc-200 dark:border-zinc-700"
                                            >
                                                배치하기
                                            </button>
                                        </div>
                                    )) : (
                                        <p className="text-sm text-zinc-400 py-2 text-center bg-zinc-50 rounded-xl border border-dashed">검색된 코치가 없습니다.</p>
                                    )}
                                </div>
                            </div>

                            {/* Athletes Header */}
                            <div>
                                <h4 className="text-sm font-bold text-zinc-600 dark:text-zinc-400 mb-3 border-b pb-2 flex items-center gap-2">
                                    <Users size={16} /> 선수 ({unassignedAthletes.length})
                                </h4>
                                <div className="space-y-2">
                                    {unassignedAthletes.length > 0 ? unassignedAthletes.map(athlete => {
                                        return (
                                            <div key={athlete.id} className="flex flex-wrap sm:flex-nowrap items-center justify-between p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-brand-navy/50 transition-colors bg-white dark:bg-zinc-950">
                                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                                    <div className="w-8 h-8 rounded-full border border-zinc-200 dark:border-zinc-700 overflow-hidden bg-white">
                                                        <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${athlete.name}&backgroundColor=e4e4e7`} alt="" className="w-full h-full object-cover" />
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                                            {athlete.name}
                                                        </div>
                                                        <div className="text-xs text-zinc-400 mt-0.5">{athlete.branch ? (athlete.branch + " 소속") : "소속 없음"}</div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleAssignMember(athlete.id)}
                                                    className="w-full sm:w-auto mt-2 sm:mt-0 px-4 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-brand-navy hover:text-white text-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-lg transition-colors border border-zinc-200 dark:border-zinc-700 whitespace-nowrap"
                                                >
                                                    배치하기
                                                </button>
                                            </div>
                                        );
                                    }) : (
                                        <p className="text-sm text-zinc-400 py-2 text-center bg-zinc-50 rounded-xl border border-dashed">검색된 선수가 없습니다.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
