"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Trophy, Calendar, MapPin, Lock, ChevronRight, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageTitle, SectionTitle } from "@/components/ui/Typography";

interface Tournament {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
    location: string;
    status: string;
}

export default function TournamentsListPage() {
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
                setUserRole(profile?.role || null);
            }

            const { data } = await supabase
                .from("score_tournaments")
                .select("*")
                .order("created_at", { ascending: false });

            setTournaments(data || []);
            setLoading(false);
        };
        load();
    }, []);

    return (
        <div className="p-4 sm:p-8 max-w-4xl mx-auto pb-24">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                    <Trophy size={24} className="text-brand-navy dark:text-brand-navy-light shrink-0" />
                    <PageTitle>토너먼트 관리</PageTitle>
                </div>
                {(userRole === 'admin' || userRole === 'coach') && (
                    <div className="flex items-center gap-2 shrink-0">
                        <Link
                            href="/scores/tournaments/create"
                            className="bg-brand-red hover:bg-brand-red-dark text-white px-5 py-2 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
                        >
                            <Plus size={18} />
                            대회 개설
                        </Link>
                    </div>
                )}
            </div>

            <section>
                <div className="flex items-center justify-between mb-4">
                    <SectionTitle>
                        진행 목록
                    </SectionTitle>
                </div>

                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center gap-3">
                        <Loader2 className="w-8 h-8 text-brand-navy animate-spin" />
                        <p className="text-zinc-500 text-sm font-medium">데이터를 불러오는 중...</p>
                    </div>
                ) : tournaments.length === 0 ? (
                    <div className="text-zinc-400 text-sm text-center py-12 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
                        개설된 토너먼트가 없습니다.
                    </div>
                ) : (
                    <>
                        {/* ── Mobile Card Grid (hidden on md+) ── */}
                        <div className="flex flex-col gap-2.5 md:hidden">
                            {tournaments.map((t) => (
                                <Link
                                    key={t.id}
                                    href={`/scores/tournaments/${t.id}`}
                                    className="block bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 py-5 px-6 shadow-sm hover:border-brand-navy/30 hover:shadow-md transition-all group"
                                >
                                    <div className="flex items-center justify-between gap-2 mb-3">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="w-8 h-8 rounded-full bg-brand-navy/10 text-brand-navy flex items-center justify-center shrink-0">
                                                <Trophy size={16} />
                                            </div>
                                            <span className="text-[15px] font-bold text-zinc-800 dark:text-zinc-100 truncate">
                                                {t.name}
                                            </span>
                                        </div>
                                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shrink-0 ${
                                            t.status === '진행중' ? 'bg-brand-red text-white' :
                                            t.status === '준비중' ? 'bg-amber-500 text-white' :
                                            'bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400'
                                        }`}>
                                            {t.status || "준비중"}
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-1.5 ml-10">
                                        <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
                                            <Calendar size={13} className="text-zinc-400" />
                                            <span>{t.start_date} ~ {t.end_date}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
                                            <MapPin size={13} className="text-zinc-400" />
                                            <span>{t.location}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-brand-navy/80">
                                            <Lock size={12} />
                                            비밀번호 입장하기 <ChevronRight size={14} className="ml-auto opacity-50" />
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>

                        {/* ── Desktop Table (hidden on mobile) ── */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-zinc-50/50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700 text-left text-zinc-500 dark:text-zinc-400">
                                        <th className="py-2.5 px-4 font-semibold text-center w-16">번호</th>
                                        <th className="py-2.5 px-4 font-semibold w-auto">대회명</th>
                                        <th className="py-2.5 px-4 font-semibold text-center w-40">일정</th>
                                        <th className="py-2.5 px-4 font-semibold text-center w-32">장소</th>
                                        <th className="py-2.5 px-4 font-semibold text-center w-24">상태</th>
                                        <th className="py-2.5 px-4 font-semibold text-center w-24">입장</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                    {tournaments.map((t, idx) => (
                                        <tr
                                            key={t.id}
                                            className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group"
                                        >
                                            <td className="py-3.5 px-4 text-center text-zinc-500 dark:text-zinc-500">
                                                {tournaments.length - idx}
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <div className="flex items-center gap-2">
                                                    <Trophy size={16} className="text-brand-navy opacity-70" />
                                                    <span className="text-zinc-700 dark:text-zinc-300 font-bold">
                                                        {t.name}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-4 text-center text-zinc-600 dark:text-zinc-400">
                                                <div className="flex flex-col text-[12px] leading-tight">
                                                    <span>{t.start_date.slice(5).replace("-", ".")} ~</span>
                                                    <span>{t.end_date.slice(5).replace("-", ".")}</span>
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-4 text-center text-zinc-600 dark:text-zinc-400 truncate">
                                                {t.location}
                                            </td>
                                            <td className="py-3.5 px-4 text-center">
                                                <span className={`text-[11px] font-black uppercase tracking-wider px-2 py-1 rounded-md ${
                                                    t.status === '진행중' ? 'bg-brand-red text-white' :
                                                    t.status === '준비중' ? 'bg-amber-500 text-white' :
                                                    'bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400'
                                                }`}>
                                                    {t.status || "준비중"}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4 text-center">
                                                <Link 
                                                    href={`/scores/tournaments/${t.id}`}
                                                    className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:bg-brand-navy hover:text-white transition-colors"
                                                >
                                                    <ChevronRight size={16} />
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </section>
        </div>
    );
}
