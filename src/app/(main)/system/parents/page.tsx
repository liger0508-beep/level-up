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
    UserCircle,
    Phone,
    Mail
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

// ── Types ──
type RegistrationStatus = "active" | "inactive";

interface Parent {
    id: string;
    name: string;
    phone: string;
    email: string;
    branch: string;
    registeredAt: string;
    status: RegistrationStatus;
}

// ── Status metadata ──
const statusConfig: Record<RegistrationStatus, { label: string; color: string; bgColor: string; icon: typeof UserCheck }> = {
    active: { label: "활성", color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20", icon: UserCheck },
    inactive: { label: "비활성", color: "text-red-500 dark:text-red-400", bgColor: "bg-red-500/10 border-red-200 dark:border-red-500/20", icon: UserX },
};

export default function ParentsListPage() {
    const router = useRouter();
    const supabase = createClient();

    const [parents, setParents] = useState<Parent[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [branchFilter, setBranchFilter] = useState<string>("all");
    const [availableBranches, setAvailableBranches] = useState<string[]>(["조이마루점", "구미점"]);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                // Fetch branches
                const { data: bData } = await supabase.from('users').select('branch');
                if (bData) {
                    const unique = Array.from(new Set(bData.map(b => b.branch).filter(v => v && v !== "미지정" && v !== "")));
                    setAvailableBranches(["조이마루점", "구미점", ...unique.filter(v => v !== "조이마루점" && v !== "구미점")]);
                }

                // Fetch Parents
                const { data, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('role', 'parent')
                    .order('name');

                if (data) {
                    const mapped: Parent[] = data.map(u => ({
                        id: u.id,
                        name: u.name,
                        phone: u.phone || "",
                        email: u.email || "",
                        branch: u.branch || "미지정",
                        registeredAt: ((u.created_at) ? new Date(u.created_at).toLocaleDateString('en-CA', {timeZone: 'Asia/Seoul'}) : "") || "",
                        status: u.status === "비활성화" ? "inactive" : "active",
                    }));
                    setParents(mapped);
                }
                const isFromDetail = sessionStorage.getItem("gla_parents_keep_alive") === "true";
                if (isFromDetail) {
                    const stored = sessionStorage.getItem("gla_parents_filter");
                    if (stored) {
                        try {
                            const parsed = JSON.parse(stored);
                            if (parsed.searchQuery !== undefined) setSearchQuery(parsed.searchQuery);
                            if (parsed.branchFilter !== undefined) setBranchFilter(parsed.branchFilter);
                        } catch (e) {}
                    }
                    setTimeout(() => {
                        sessionStorage.removeItem("gla_parents_keep_alive");
                    }, 100);
                } else {
                    sessionStorage.removeItem("gla_parents_filter");
                    sessionStorage.removeItem("gla_parents_scroll");
                }
            } catch (err) {
                console.error("Error fetching parents:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    // Save filter state to sessionStorage
    useEffect(() => {
        sessionStorage.setItem("gla_parents_filter", JSON.stringify({
            searchQuery,
            branchFilter
        }));
    }, [searchQuery, branchFilter]);

    // Scroll state management
    useEffect(() => {
        if (typeof window !== "undefined" && !loading) {
            const savedScroll = sessionStorage.getItem("gla_parents_scroll");
            if (savedScroll) {
                window.scrollTo(0, parseInt(savedScroll, 10));
                sessionStorage.removeItem("gla_parents_scroll");
            }
            
            const handleScroll = () => {
                sessionStorage.setItem("gla_parents_scroll", window.scrollY.toString());
            };
            window.addEventListener("scroll", handleScroll);
            return () => window.removeEventListener("scroll", handleScroll);
        }
    }, [loading]);

    const filteredParents = useMemo(() => {
        return parents.filter((p) => {
            const matchesSearch =
                !searchQuery ||
                p.name.includes(searchQuery) ||
                p.phone.includes(searchQuery) ||
                p.branch.includes(searchQuery);
            const matchesBranch = branchFilter === "all" || p.branch === branchFilter;
            return matchesSearch && matchesBranch;
        });
    }, [parents, searchQuery, branchFilter]);

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-24">
            <main className="max-w-5xl mx-auto px-4 sm:px-8 py-10 space-y-8">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                        <Users size={24} className="text-amber-600 shrink-0" />
                    </div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
                        학부모 관리
                    </h1>
                </div>

                {/* Branch Tabs */}
                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
                    <button
                        onClick={() => setBranchFilter("all")}
                        className={`whitespace-nowrap shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all
                            ${branchFilter === "all" ? "bg-brand-navy text-white" : "bg-white dark:bg-zinc-900 text-zinc-500 border border-zinc-200 dark:border-zinc-800"}`}
                    >
                        전체
                    </button>
                    {availableBranches.map(branch => (
                        <button
                            key={branch}
                            onClick={() => setBranchFilter(branch)}
                            className={`whitespace-nowrap shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all
                                ${branchFilter === branch ? "bg-brand-navy text-white" : "bg-white dark:bg-zinc-900 text-zinc-500 border border-zinc-200 dark:border-zinc-800"}`}
                        >
                            {branch}
                        </button>
                    ))}
                </div>

                {/* Search Bar */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <input
                        type="text"
                        placeholder="이름, 연락처, 지점으로 검색..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-brand-navy/40 outline-none transition-all"
                    />
                </div>

                {/* Result count */}
                <p className="text-xs text-zinc-400 px-1">
                    검색 결과 <span className="font-semibold text-zinc-600 dark:text-zinc-300">{filteredParents.length}</span>명
                </p>

                {/* List */}
                <div className="space-y-2">
                    {loading ? (
                        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-zinc-300" /></div>
                    ) : filteredParents.length > 0 ? (
                        filteredParents.map((parent) => {
                            const status = statusConfig[parent.status];
                            const StatusIcon = status.icon;
                            return (
                                <Link
                                    key={parent.id}
                                    href={`/system/parents/${parent.id}`}
                                    onClick={() => sessionStorage.setItem("gla_parents_keep_alive", "true")}
                                    className="block bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 hover:shadow-md transition-all group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20">
                                            <User size={24} className="text-amber-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{parent.name}</h3>
                                                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", status.bgColor, status.color)}>
                                                    {status.label}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
                                                <span className="flex items-center gap-1"><MapPin size={12} /> {parent.branch}</span>
                                                <span className="flex items-center gap-1"><Phone size={12} /> {parent.phone}</span>
                                            </div>
                                        </div>
                                        <ChevronRight size={18} className="text-zinc-300 group-hover:text-brand-navy transition-colors" />
                                    </div>
                                </Link>
                            );
                        })
                    ) : (
                        <div className="text-center py-20 text-zinc-400">검색 결과가 없습니다.</div>
                    )}
                </div>
            </main>
        </div>
    );
}
