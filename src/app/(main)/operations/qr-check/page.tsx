"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Users, Search, ChevronRight, QrCode } from "lucide-react";
import { PageTitle } from "@/components/ui/Typography";
import { getQrEvents, QrEvent } from "@/lib/qr-sync";

export default function QrCheckEventsPage() {
    const router = useRouter();
    const [events, setEvents] = useState<QrEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await getQrEvents();
                setEvents(data);
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    const activeEvents = events.filter(e => e.status === "ACTIVE");
    const closedEvents = events.filter(e => e.status === "CLOSED");

    return (
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-8 bg-brand-navy rounded-full hidden sm:block" />
                    <PageTitle>스마트 패스 관리</PageTitle>
                </div>
                <Link href="/operations/qr-check/create" className="bg-brand-navy text-white px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl sm:rounded-2xl text-sm sm:text-base font-bold flex items-center justify-center gap-2 hover:bg-brand-navy-dark transition-colors shadow-sm sm:shadow-lg sm:shadow-brand-navy/20 shrink-0">
                    <Plus size={18} />
                    <span className="hidden sm:inline">새로운 패스 만들기</span>
                    <span className="sm:hidden">등록</span>
                </Link>
            </div>

            <div className="space-y-6">
                <section>
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                        <QrCode className="text-emerald-500" size={20} />
                        진행 중인 체크
                        <span className="text-sm font-normal text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">{activeEvents.length}</span>
                    </h2>
                    
                    {isLoading ? (
                        <div className="py-12 flex justify-center"><div className="w-6 h-6 border-2 border-brand-navy border-t-transparent rounded-full animate-spin" /></div>
                    ) : activeEvents.length === 0 ? (
                        <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 rounded-3xl p-8 text-center">
                            <p className="text-zinc-500 dark:text-zinc-400 font-medium">현재 진행 중인 스마트 패스 체크가 없습니다.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {activeEvents.map(event => (
                                <Link key={event.id} href={`/operations/qr-check/${event.id}`} className="bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-emerald-900/30 rounded-3xl p-5 sm:p-6 shadow-sm hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700 transition-all group flex flex-col sm:flex-row sm:items-center justify-between relative overflow-hidden">
                                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-500" />
                                    
                                    <div className="flex-1 w-full flex justify-between items-start sm:items-center gap-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">진행중</span>
                                                <span className="text-xs font-bold text-zinc-400">{event.date}</span>
                                            </div>
                                            <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-50 mb-1">{event.title}</h3>
                                            <p className="text-sm font-medium text-zinc-500 flex items-center gap-1.5">
                                                <Users size={14} /> 대상: {
                                                    event.targetType === "ALL" ? "전체" :
                                                    event.targetType === "BRANCH" ? `${event.targetData} 지점` :
                                                    event.targetType === "POLL_PARTICIPANTS" ? "투표 참여자" : "지정 인원"
                                                }
                                            </p>
                                        </div>

                                        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4 shrink-0">
                                            <div className="flex flex-col items-end">
                                                <span className="text-[10px] text-zinc-400 font-medium">생성자</span>
                                                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{event.authorName}</span>
                                            </div>
                                            <div className="hidden sm:flex w-10 h-10 rounded-full bg-zinc-50 dark:bg-zinc-800 items-center justify-center text-zinc-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors shrink-0">
                                                <ChevronRight size={20} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Mobile arrow at bottom right */}
                                    <div className="sm:hidden absolute bottom-5 right-5 w-8 h-8 rounded-full bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                                        <ChevronRight size={16} />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>

                <section>
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4 mt-8 flex items-center gap-2">
                        마감된 체크 기록
                    </h2>
                    
                    {closedEvents.length === 0 ? null : (
                        <div className="grid gap-3">
                            {closedEvents.map(event => (
                                <Link key={event.id} href={`/operations/qr-check/${event.id}`} className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-4 shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors flex items-center justify-between gap-4">
                                    <div>
                                        <h3 className="text-base font-bold text-zinc-700 dark:text-zinc-300">{event.title}</h3>
                                        <p className="text-xs text-zinc-500">{event.date} | 대상: {event.targetType === "ALL" ? "전체" : "특정 인원"}</p>
                                    </div>
                                    <ChevronRight size={16} className="text-zinc-300" />
                                </Link>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
