"use client";

import { useState, useEffect } from "react";
import { Car, Settings } from "lucide-react";
import { CoachTrip, getStoredCoachTrips } from "@/lib/coach-trip-sync";
import { CoachTripCalendar } from "@/components/schedule/CoachTripCalendar";
import Link from "next/link";

export default function CoachTripsPage() {
    const [trips, setTrips] = useState<CoachTrip[]>([]);
    const [hasMounted, setHasMounted] = useState(false);

    useEffect(() => {
        setHasMounted(true);
        getStoredCoachTrips().then(setTrips);
    }, []);

    if (!hasMounted) return null;

    return (
        <div className="p-4 sm:p-8 max-w-5xl mx-auto min-h-screen animate-in fade-in duration-500">
            <div className="flex items-start justify-between gap-4 mb-8">
                <div className="space-y-1">
                    <div className="flex items-center gap-2.5 mb-1">
                        <div className="w-10 h-10 rounded-xl bg-brand-navy flex items-center justify-center text-white shadow-lg shadow-brand-navy/20 transition-transform hover:scale-105 shrink-0">
                            <Car size={24} />
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                            출장 스케쥴
                        </h1>
                    </div>
                    <p className="text-zinc-500 dark:text-zinc-400 text-xs sm:text-sm font-medium pl-12">
                        코치들의 출장 및 외부 레슨 일정을 확인하세요.
                    </p>
                </div>

                <Link
                    href="/admin/coach-trip-schedule"
                    className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs sm:text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all shadow-sm active:scale-95 shrink-0"
                >
                    <Settings size={18} />
                    <span className="hidden xs:inline">출장 스케쥴 등록</span>
                    <span className="xs:hidden">등록</span>
                </Link>
            </div>

            <CoachTripCalendar trips={trips} />
        </div>
    );
}
