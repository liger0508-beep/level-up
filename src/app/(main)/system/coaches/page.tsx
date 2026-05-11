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
    Building2,
    UserCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

// ── Types ──
type CoachStatus = "active" | "paused";

interface Coach {
    id: string;
    name: string;
    phone: string;
    email: string;
    branch: string;
    status: CoachStatus;
    gender: string;
    assignedAthletes: string[];
}

const branches = ["총괄", "오피스", "조이마루점", "구미점"];

export default function CoachesListPage() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [branchFilter, setBranchFilter] = useState<string>("all");
    const [coaches, setCoaches] = useState<Coach[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchCoaches = async () => {
            try {
                const supabase = createClient();
                const { data, error } = await supabase
                    .from("users")
                    .select("*")
                    .in("role", ["coach", "admin", "head_coach"]);

                if (error) {
                    console.error("Error fetching coaches:", error);
                    return;
                }

                if (data) {
                    const loadedCoaches: Coach[] = data
                        .filter((d: any) => d.name !== '전체 관리자' && d.name !== '슈퍼관리자')
                        .map((d: any) => ({
                            id: d.id,
                            name: d.name,
                            phone: d.phone || "",
                            email: "",
                            branch: d.branch || "미지정",
                            status: d.status === "휴직" ? "paused" : "active",
                            gender: d.gender === 'male' ? '남' : d.gender === 'female' ? '여' : (d.gender === 'other' ? '기타' : '미지정'),
                            assignedAthletes: [],
                        }));
                    setCoaches(loadedCoaches);
                }
            } catch (err) {
                console.error("Failed to load coaches", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchCoaches();
    }, []);

    const filteredCoaches = useMemo(() => {
        return coaches.filter((c) => {
            const matchesSearch =
                !searchQuery ||
                c.name.includes(searchQuery) ||
                c.branch.includes(searchQuery);
            const matchesBranch = branchFilter === "all" || c.branch === branchFilter;
            return matchesSearch && matchesBranch;
        });
    }, [coaches, searchQuery, branchFilter]);

    // Grouping counts for summary (Active/Paused)
    const branchFiltered = useMemo(() => {
        if (branchFilter === "all") return coaches;
        return coaches.filter(c => c.branch === branchFilter);
    }, [branchFilter, coaches]);

    const stats = useMemo(() => ({
        total: branchFiltered.length,
        active: branchFiltered.filter(c => c.status === "active").length,
        paused: branchFiltered.filter(c => c.status === "paused").length,
    }), [branchFiltered]);

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-24">
            <main className="max-w-5xl mx-auto px-4 sm:px-8 py-10 space-y-8">
                <div className="flex items-center gap-2">
                    <UserCircle size={24} className="text-brand-navy dark:text-brand-navy-light shrink-0" />
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
                        코치 관리
                    </h1>
                </div>

                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
                    <button
                        onClick={() => {
                            setBranchFilter("all");
                            setSearchQuery("");
                        }}
                        className={`whitespace-nowrap shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200
                            ${branchFilter === "all"
                                ? "bg-brand-navy text-white shadow-md border-brand-navy"
                                : "bg-transparent text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-brand-navy-light dark:hover:bg-brand-navy-dark hover:text-brand-navy dark:hover:text-white"
                            }`}
                    >
                        전체
                    </button>
                    {branches.map(branch => (
                        <button
                            key={branch}
                            onClick={() => setBranchFilter(prev => prev === branch ? "all" : branch)}
                            className={`whitespace-nowrap shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200
                                ${branchFilter === branch
                                    ? "bg-brand-navy text-white shadow-md border-brand-navy"
                                    : "bg-transparent text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-brand-navy-light dark:hover:bg-brand-navy-dark hover:text-brand-navy dark:hover:text-white"
                                }`}
                        >
                            {branch}
                        </button>
                    ))}
                </div>

                {/* Stats Summary Cards */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 text-center">
                        <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{stats.active}</p>
                        <p className="text-xs font-medium text-zinc-500 mt-1">재직</p>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 text-center">
                        <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{stats.paused}</p>
                        <p className="text-xs font-medium text-zinc-500 mt-1">휴직</p>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <input
                        type="text"
                        placeholder="이름으로 코치 검색..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all"
                    />
                </div>

                {/* Result count */}
                <p className="text-xs text-zinc-400 px-1">
                    {branchFilter !== "all" && <span className="font-semibold text-brand-navy">{branchFilter}</span>}
                    코치 현황 <span className="font-semibold text-zinc-600 dark:text-zinc-300">{filteredCoaches.length}</span>명
                </p>

                {/* Coach List */}
                <div className="space-y-2">
                    {isLoading ? (
                        <div className="text-center py-16 text-zinc-400">
                            <p className="text-sm">로딩 중...</p>
                        </div>
                    ) : filteredCoaches.length > 0 ? (
                        filteredCoaches.map((coach) => (
                            <Link
                                key={coach.id}
                                href={`/system/coaches/${coach.id}`}
                                className="block bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all group"
                            >
                                <div className="flex items-center gap-4">
                                    {/* Avatar */}
                                    <div className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700">
                                        <UserCircle size={28} className="text-zinc-400" />
                                    </div>

                                    {/* Main Info (Simple as requested: Name and Branch) */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-0.5">
                                            {coach.name} <span className="ml-1 text-xs font-medium text-zinc-400">{coach.gender}</span>
                                        </h3>
                                        <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                                            <MapPin size={12} className="text-zinc-400" />
                                            {coach.branch}
                                        </div>
                                    </div>

                                    <ChevronRight size={18} className="shrink-0 text-zinc-300 dark:text-zinc-600 group-hover:text-brand-navy dark:group-hover:text-brand-navy-light transition-colors" />
                                </div>
                            </Link>
                        ))
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
