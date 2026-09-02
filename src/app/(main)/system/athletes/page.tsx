"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    ChevronLeft,
    Users,
    Search,
    ChevronRight,
    MapPin,
    User,
    UserCheck,
    UserMinus,
    UserX,
    Building2,
    Loader2,
    Trash2,
    UserCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

// ── Types ──
type RegistrationStatus = "active" | "paused" | "inactive";

interface Athlete {
    id: string;
    name: string;
    phone: string;
    age: number;
    email: string;
    branch: string;
    registeredAt: string;
    status: RegistrationStatus;
    coachName: string;
    level?: string;
    gender?: string;
}

// ── Status metadata ──
const statusConfig: Record<RegistrationStatus, { label: string; color: string; bgColor: string; icon: typeof UserCheck }> = {
    active: { label: "등록", color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20", icon: UserCheck },
    paused: { label: "휴회", color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-500/10 border-amber-200 dark:border-amber-500/20", icon: UserMinus },
    inactive: { label: "비활성화", color: "text-red-500 dark:text-red-400", bgColor: "bg-red-500/10 border-red-200 dark:border-red-500/20", icon: UserX },
};

const statusFilterOptions: { key: RegistrationStatus | "all"; label: string }[] = [
    { key: "all", label: "전체" },
    { key: "active", label: "등록" },
    { key: "paused", label: "휴회" },
    { key: "inactive", label: "비활성화" },
];

export default function AthletesListPage() {
    const router = useRouter();
    const supabase = createClient();

    const [availableBranches, setAvailableBranches] = useState<string[]>(["총괄", "오피스", "조이마루점", "구미점"]);
    const [athletes, setAthletes] = useState<Athlete[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<RegistrationStatus | "all">("all");
    const [branchFilter, setBranchFilter] = useState<string>("all");
    const [userRole, setUserRole] = useState<string | null>(null);
    const [userName, setUserName] = useState<string | null>(null);
    const [openStatusPickerId, setOpenStatusPickerId] = useState<string | null>(null);

    // Fetch Athletes and User Role from Supabase
    useEffect(() => {
        async function initialize() {
            setLoading(true);
            try {
                // Get current user role
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: profile } = await supabase
                        .from('users')
                        .select('role, name')
                        .eq('id', user.id)
                        .single();
                    setUserRole(profile?.role || null);
                    setUserName(profile?.name || null);
                }

                // Fetch athletes
                const { data, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('role', 'athlete')
                    .order('name');

                if (data) {
                    const mapped: Athlete[] = data.map(u => ({
                        id: u.id,
                        name: u.name,
                        phone: u.phone || "",
                        age: u.dob ? (new Date().getFullYear() - new Date(u.dob).getFullYear()) : 0,
                        email: `${u.name}@gla.com`,
                        branch: u.branch || "미지정",
                        registeredAt: ((u.created_at) ? new Date(u.created_at).toLocaleDateString('en-CA', {timeZone: 'Asia/Seoul'}) : "") || "",
                        status: u.status === "휴회" ? "paused" : (u.status === "비활성화" ? "inactive" : "active"),
                        coachName: u.coach_name || "담당 없음",
                        level: u.level || "미지정",
                        gender: u.gender === 'male' ? '남' : u.gender === 'female' ? '여' : (u.gender === 'other' ? '기타' : '미지정')
                    }));
                    setAthletes(mapped);
                }
                const isFromDetail = sessionStorage.getItem("gla_athletes_keep_alive") === "true";
                if (isFromDetail) {
                    const stored = sessionStorage.getItem("gla_athletes_filter");
                    if (stored) {
                        try {
                            const parsed = JSON.parse(stored);
                            if (parsed.searchQuery !== undefined) setSearchQuery(parsed.searchQuery);
                            if (parsed.statusFilter !== undefined) setStatusFilter(parsed.statusFilter);
                            if (parsed.branchFilter !== undefined) setBranchFilter(parsed.branchFilter);
                        } catch (e) {}
                    }
                    setTimeout(() => {
                        sessionStorage.removeItem("gla_athletes_keep_alive");
                    }, 100);
                } else {
                    sessionStorage.removeItem("gla_athletes_filter");
                    sessionStorage.removeItem("gla_athletes_scroll");
                }
            } catch (err) {
                console.error("Initialization error:", err);
            } finally {
                setLoading(false);
            }
        }

        initialize();
    }, []);

    // Save filter state to sessionStorage
    useEffect(() => {
        sessionStorage.setItem("gla_athletes_filter", JSON.stringify({
            searchQuery,
            statusFilter,
            branchFilter
        }));
    }, [searchQuery, statusFilter, branchFilter]);

    // Scroll state management
    useEffect(() => {
        if (typeof window !== "undefined" && !loading) {
            const savedScroll = sessionStorage.getItem("gla_athletes_scroll");
            if (savedScroll) {
                window.scrollTo(0, parseInt(savedScroll, 10));
                sessionStorage.removeItem("gla_athletes_scroll");
            }
            
            const handleScroll = () => {
                sessionStorage.setItem("gla_athletes_scroll", window.scrollY.toString());
            };
            window.addEventListener("scroll", handleScroll);
            return () => window.removeEventListener("scroll", handleScroll);
        }
    }, [loading]);

    // Close status picker when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setOpenStatusPickerId(null);
        if (openStatusPickerId) {
            window.addEventListener('click', handleClickOutside);
        }
        return () => window.removeEventListener('click', handleClickOutside);
    }, [openStatusPickerId]);

    const updateAthleteStatus = async (athleteId: string, newStatus: RegistrationStatus) => {
        const dbStatus = newStatus === "active" ? "등록" : newStatus === "paused" ? "휴회" : "비활성화";
        try {
            const { error } = await supabase
                .from('users')
                .update({ status: dbStatus })
                .eq('id', athleteId);
            
            if (error) throw error;
            
            setAthletes(prev => prev.map(a => a.id === athleteId ? { ...a, status: newStatus } : a));
        } catch (err) {
            console.error("Error updating status:", err);
            alert("상태 변경에 실패했습니다.");
        }
    };

    const deleteAthlete = async (id: string, name: string) => {
        if (!confirm(`\n선수명: ${name}\n\n정말로 이 선수를 삭제하시겠습니까?\n모든 기록이 삭제됩니다.`)) return;
        if (userName !== '슈퍼관리자') {
            alert('슈퍼관리자만 사용할 수 있는 기능입니다.');
            return;
        }

        try {
            const res = await fetch('/api/admin/delete-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetUserId: id,
                    callerName: userName
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || '삭제 실패');

            setAthletes(prev => prev.filter(a => a.id !== id));
            alert("삭제되었습니다.");
        } catch (err: any) {
            console.error("Error deleting athlete:", err);
            alert(`삭제에 실패했습니다: ${err.message}`);
        }
    };

    const filteredAthletes = useMemo(() => {
        return athletes.filter((a) => {
            const matchesSearch =
                !searchQuery ||
                a.name.includes(searchQuery) ||
                a.email.includes(searchQuery) ||
                a.phone.includes(searchQuery) ||
                a.branch.includes(searchQuery);
            const matchesStatus = statusFilter === "all" || a.status === statusFilter;
            const matchesBranch = branchFilter === "all" || a.branch === branchFilter || a.branch.startsWith(branchFilter);
            return matchesSearch && matchesStatus && matchesBranch;
        });
    }, [athletes, searchQuery, statusFilter, branchFilter]);

    // Stats based on branch filter
    const branchFiltered = useMemo(() => {
        if (branchFilter === "all") return athletes;
        return athletes.filter(a => a.branch === branchFilter || a.branch.startsWith(branchFilter));
    }, [athletes, branchFilter]);

    const stats = useMemo(() => ({
        total: branchFiltered.length,
        active: branchFiltered.filter(a => a.status === "active").length,
        paused: branchFiltered.filter(a => a.status === "paused").length,
        inactive: branchFiltered.filter(a => a.status === "inactive").length,
    }), [branchFiltered]);

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-24">
            <main className="max-w-5xl mx-auto px-4 sm:px-8 py-10 space-y-8">
                <div className="flex items-center gap-2">
                    <Users size={24} className="text-brand-navy dark:text-brand-navy-light shrink-0" />
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
                        선수 관리
                    </h1>
                </div>

                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
                    <button
                        onClick={() => setBranchFilter("all")}
                        className={`whitespace-nowrap shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200
                            ${branchFilter === "all"
                                ? "bg-brand-navy text-white shadow-md border-brand-navy"
                                : "bg-white text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-brand-navy-light dark:hover:bg-brand-navy-dark hover:text-brand-navy dark:hover:text-white"
                            }`}
                    >
                        전체
                    </button>
                    {availableBranches.map(branch => (
                        <button
                            key={branch}
                            onClick={() => setBranchFilter(prev => prev === branch ? "all" : branch)}
                            className={`whitespace-nowrap shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200
                                ${branchFilter === branch
                                    ? "bg-brand-navy text-white shadow-md border-brand-navy"
                                    : "bg-white text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-brand-navy-light dark:hover:bg-brand-navy-dark hover:text-brand-navy dark:hover:text-white"
                                }`}
                        >
                            {branch}
                        </button>
                    ))}
                </div>

                {/* Stats Summary Cards */}
                <div className="grid grid-cols-3 gap-3">
                    {([
                        { key: "active" as const, count: stats.active, label: "등록", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20" },
                        { key: "paused" as const, count: stats.paused, label: "휴회", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/5 border-amber-200 dark:border-amber-500/20" },
                        { key: "inactive" as const, count: stats.inactive, label: "비활성화", color: "text-red-500 dark:text-red-400", bg: "bg-red-500/5 border-red-200 dark:border-red-500/20" },
                    ]).map(s => (
                        <button
                            key={s.key}
                            onClick={() => setStatusFilter(prev => prev === s.key ? "all" : s.key)}
                            className={cn(
                                "rounded-2xl border p-4 text-center transition-all",
                                statusFilter === s.key
                                    ? `${s.bg} ring-2 ring-offset-1 ring-brand-navy/30`
                                    : `bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300`
                            )}
                        >
                            <p className={cn("text-2xl font-black", s.color)}>{s.count}</p>
                            <p className="text-xs font-medium text-zinc-500 mt-1">{s.label}</p>
                        </button>
                    ))}
                </div>

                {/* Search + Status Filter Bar */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                        <input
                            type="text"
                            placeholder="이름으로 검색..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all"
                        />
                    </div>
                    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                        {statusFilterOptions.map(opt => (
                            <button
                                key={opt.key}
                                onClick={() => setStatusFilter(opt.key)}
                                className={cn(
                                    "whitespace-nowrap shrink-0 px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors",
                                    statusFilter === opt.key
                                        ? "bg-brand-navy text-white border-brand-navy"
                                        : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-brand-navy/50"
                                )}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Result count */}
                <p className="text-xs text-zinc-400 px-1">
                    {branchFilter !== "all" && <span className="font-semibold text-brand-navy">{branchFilter}</span>}
                    검색 결과 <span className="font-semibold text-zinc-600 dark:text-zinc-300">{filteredAthletes.length}</span>명
                </p>

                {/* Athlete List */}
                <div className="space-y-2">
                    {filteredAthletes.length > 0 ? (
                        filteredAthletes.map((athlete) => {
                            const status = statusConfig[athlete.status];
                            const StatusIcon = status.icon;
                            return (
                                <Link
                                    key={athlete.id}
                                    href={`/system/athletes/${athlete.id}`}
                                    onClick={() => sessionStorage.setItem("gla_athletes_keep_alive", "true")}
                                    className="block bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all group"
                                >
                                    <div className="flex items-center gap-4">
                                        {/* Avatar */}
                                        <div className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700">
                                            <UserCircle size={28} className="text-zinc-400" />
                                        </div>

                                        {/* Main Info */}
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-0.5">
                                                {athlete.name}
                                            </h3>
                                            <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                                                {athlete.age}세 · {athlete.gender} · {athlete.level}
                                            </p>
                                            <div className="flex items-center gap-1 text-[11px] sm:text-xs text-zinc-400">
                                                <MapPin size={12} className="shrink-0" />
                                                <span className="truncate">{athlete.branch}</span>
                                            </div>
                                        </div>

                                        <div className="shrink-0 flex items-center gap-2">
                                            {/* Status Button */}
                                            {userRole === 'admin' ? (
                                                <div className="relative">
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            setOpenStatusPickerId(openStatusPickerId === athlete.id ? null : athlete.id);
                                                        }}
                                                        className={cn(
                                                            "inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-full border transition-all hover:brightness-95 active:scale-95",
                                                            status.bgColor, status.color
                                                        )}
                                                    >
                                                        {status.label}
                                                    </button>
                                                    {openStatusPickerId === athlete.id && (
                                                        <div className="absolute right-0 top-full mt-2 w-28 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                                            {statusFilterOptions.filter(o => o.key !== 'all').map(opt => (
                                                                <button
                                                                    key={opt.key}
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        updateAthleteStatus(athlete.id, opt.key as RegistrationStatus);
                                                                        setOpenStatusPickerId(null);
                                                                    }}
                                                                    className="w-full px-4 py-2.5 text-left text-xs font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-700/50 text-zinc-700 dark:text-zinc-300 transition-colors"
                                                                >
                                                                    {opt.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className={cn(
                                                    "inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-full border",
                                                    status.bgColor, status.color
                                                )}>
                                                    {status.label}
                                                </span>
                                            )}


                                        </div>
                                        <ChevronRight size={16} className="shrink-0 text-zinc-300 dark:text-zinc-600 group-hover:text-brand-navy dark:group-hover:text-brand-navy-light transition-colors" />
                                    </div>
                                </Link>
                            );
                        })
                    ) : (
                        <div className="text-center py-16 text-zinc-400">
                            <Users size={40} className="mx-auto mb-3 opacity-30" />
                            <p className="text-sm">검색 결과가 없습니다.</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
