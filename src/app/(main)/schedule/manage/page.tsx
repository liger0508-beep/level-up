"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    Plus,
    Clock,
    User,
    Users,
    Slash,
    Trash2,
    CalendarOff,
    CheckCircle2,
    Search,
    Grid,
    ListFilter,
    ShieldAlert,
    X,
    Building2,
    FileText,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { format, addDays, subDays, startOfWeek, eachDayOfInterval, addWeeks, subWeeks, isSameDay } from "date-fns";
import { ko } from "date-fns/locale";
import { ScheduleEventDialog } from "@/components/schedule/ScheduleEventDialog";
import { saveEvent, deleteEvent } from "@/lib/schedule-sync";
import { CoachSlotConfig, generateSlotsFromConfig, resolveCoachSlotConfig } from "@/lib/schedule-slots";

const WEEK_DAYS = ["일", "월", "화", "수", "목", "금", "토"];

const TIME_SLOTS = [
    { key: "08:00", label: "8시", start: "08:00", end: "09:00" },
    { key: "09:00", label: "9시", start: "09:00", end: "10:00" },
    { key: "10:00", label: "10시", start: "10:00", end: "11:00" },
    { key: "11:00", label: "11시", start: "11:00", end: "12:00" },
    { key: "13:00", label: "13시", start: "13:00", end: "14:00" },
    { key: "14:00", label: "14시", start: "14:00", end: "15:00" },
    { key: "15:00", label: "15시", start: "15:00", end: "16:00" },
    { key: "16:00", label: "16시", start: "16:00", end: "17:00" },
    { key: "17:00", label: "17시", start: "17:00", end: "18:00" },
    { key: "18:00", label: "18시", start: "18:00", end: "19:00" },
    { key: "19:00", label: "19시", start: "19:00", end: "20:00" },
    { key: "20:00", label: "20시", start: "20:00", end: "21:00" },
];

const DAYS_OF_WEEK = [
    { value: 1, label: "월요일" },
    { value: 2, label: "화요일" },
    { value: 3, label: "수요일" },
    { value: 4, label: "목요일" },
    { value: 5, label: "금요일" },
    { value: 6, label: "토요일" },
    { value: 0, label: "일요일" },
];

const REASON_PRESETS = [
    "정기 휴무",
    "연차 휴가",
    "오전 반차",
    "오후 반차",
    "대회 출장",
    "외부 교육/세미나",
    "개인 사정",
];

interface BlockoutRule {
    id: string;
    coachId: string;
    coachName: string;
    type: "recurring" | "specific_date";
    dayOfWeek?: number;
    date?: string;
    allDay: boolean;
    slots?: string[];
    reason: string;
    createdAt: string;
    createdBy?: string;
}

interface DBUser {
    id: string;
    name: string;
    role: string;
    branch?: string;
    status?: string;
}

export default function ScheduleManagePage() {
    const router = useRouter();
    const [currentRole, setCurrentRole] = useState<string>("");
    const [currentUserName, setCurrentUserName] = useState<string>("");
    const [currentUserBranch, setCurrentUserBranch] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);

    // Filters
    const [selectedDate, setSelectedDate] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));
    const [selectedBranch, setSelectedBranch] = useState<string>("all");
    const [activeTab, setActiveTab] = useState<"coach" | "athlete" | "matrix" | "blockouts">("coach");

    // Data
    const [coaches, setCoaches] = useState<DBUser[]>([]);
    const [athletes, setAthletes] = useState<DBUser[]>([]);
    const [schedules, setSchedules] = useState<any[]>([]);
    const [blockouts, setBlockouts] = useState<BlockoutRule[]>([]);
    const [slotConfigs, setSlotConfigs] = useState<CoachSlotConfig[]>([]);

    // Selection
    const [selectedCoachName, setSelectedCoachName] = useState<string>("");
    const [athleteSearchQuery, setAthleteSearchQuery] = useState<string>("");

    // Modals
    const [isBlockoutModalOpen, setIsBlockoutModalOpen] = useState(false);
    const [isSlotConfigModalOpen, setIsSlotConfigModalOpen] = useState(false);
    const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
    const [dialogInitialDate, setDialogInitialDate] = useState<Date>(new Date());
    const [dialogInitialSlot, setDialogInitialSlot] = useState<string | null>(null);

    // Blockout Form State
    const [boCoachName, setBoCoachName] = useState("");
    const [boType, setBoType] = useState<"recurring" | "specific_date">("recurring");
    const [boDayOfWeek, setBoDayOfWeek] = useState<number>(3); // Wednesday default
    const [boDate, setBoDate] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));
    const [boAllDay, setBoAllDay] = useState(false);
    const [boSlots, setBoSlots] = useState<string[]>([]);
    const [boReason, setBoReason] = useState("정기 휴무");
    const [isSubmittingBo, setIsSubmittingBo] = useState(false);

    // Slot Config Form State
    const [scCoachName, setScCoachName] = useState("");
    const [scMonthMode, setScMonthMode] = useState<"default" | "month">("month");
    const [scMonth, setScMonth] = useState<string>(() => format(new Date(), "yyyy-MM"));
    const [scUseAm, setScUseAm] = useState(true);
    const [scAmStart, setScAmStart] = useState("09:00");
    const [scAmEnd, setScAmEnd] = useState("12:00");
    const [scUsePm, setScUsePm] = useState(true);
    const [scPmStart, setScPmStart] = useState("14:00");
    const [scPmEnd, setScPmEnd] = useState("18:00");
    const [scDuration, setScDuration] = useState(60);
    const [scBreak, setScBreak] = useState(0);
    const [scDisabledSlots, setScDisabledSlots] = useState<string[]>([]);
    const [isSubmittingSc, setIsSubmittingSc] = useState(false);

    // Initial Auth & Data Load
    useEffect(() => {
        const init = async () => {
            setIsLoading(true);
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();

                if (!user) {
                    router.push("/login");
                    return;
                }

                const { data: profile } = await supabase
                    .from("users")
                    .select("id, name, role, branch, status")
                    .eq("id", user.id)
                    .single();

                if (!profile) {
                    router.push("/login");
                    return;
                }

                // Athletes and parents cannot access
                if (profile.role === "athlete" || profile.role === "parent") {
                    alert("접근 권한이 없습니다. (코치 및 관리자 전용)");
                    router.push("/schedule");
                    return;
                }

                setCurrentRole(profile.role);
                setCurrentUserName(profile.name || "");
                setCurrentUserBranch(profile.branch || "");

                // Set default branch
                if (profile.branch && profile.branch !== "미지정" && profile.branch !== "총괄" && profile.branch !== "오피스") {
                    setSelectedBranch(profile.branch);
                } else {
                    setSelectedBranch("all");
                }

                // If coach, default to own name
                if (profile.role === "coach") {
                    setSelectedCoachName(profile.name || "");
                }

                // Fetch Coaches & Athletes
                const { data: allUsers } = await supabase
                    .from("users")
                    .select("id, name, role, branch, status")
                    .order("name", { ascending: true });

                if (allUsers) {
                    const activeCoaches: DBUser[] = (allUsers as DBUser[]).filter(
                        (u: DBUser) => ["coach", "admin", "head_coach", "headquarter"].includes(u.role) &&
                            u.status !== "휴직" && u.status !== "퇴직" &&
                            u.name !== "전체 관리자" && u.name !== "슈퍼관리자"
                    );
                    setCoaches(activeCoaches);

                    if (profile.role !== "coach" && activeCoaches.length > 0) {
                        setSelectedCoachName(activeCoaches[0].name);
                    }

                    const allAthletes: DBUser[] = (allUsers as DBUser[]).filter((u: DBUser) => u.role === "athlete");
                    setAthletes(allAthletes);
                }

                await Promise.all([loadBlockoutsData(), loadSlotConfigsData()]);
            } catch (err) {
                console.error("Init schedule manage error:", err);
            } finally {
                setIsLoading(false);
            }
        };

        init();
    }, [router]);

    // Load blockout rules
    const loadBlockoutsData = async () => {
        try {
            const res = await fetch("/api/schedule-manage/blockouts", { cache: "no-store" });
            const data = await res.json();
            if (data.blockouts) {
                setBlockouts(data.blockouts);
            }
        } catch (e) {
            console.error("Failed to load blockouts", e);
        }
    };

    // Load coach slot configs
    const loadSlotConfigsData = async () => {
        try {
            const res = await fetch("/api/schedule-manage/slot-configs", { cache: "no-store" });
            const data = await res.json();
            if (data.configs) {
                setSlotConfigs(data.configs);
            }
        } catch (e) {
            console.error("Failed to load slot configs", e);
        }
    };

    // Load schedules for selected date
    const loadSchedules = async () => {
        try {
            const supabase = createClient();
            const startKst = `${selectedDate}T00:00:00+09:00`;
            const endKst = `${selectedDate}T23:59:59+09:00`;

            const { data } = await supabase
                .from("schedules")
                .select(`
                    id,
                    title,
                    event_type,
                    start_time,
                    end_time,
                    status,
                    user_id,
                    creator_id,
                    users!schedules_user_id_fkey(id, name, branch),
                    creator:users!schedules_creator_id_fkey(id, name, branch)
                `)
                .gte("end_time", startKst)
                .lte("start_time", endKst)
                .neq("status", "cancelled");

            setSchedules(data || []);
        } catch (e) {
            console.error("Failed to load schedules:", e);
        }
    };

    useEffect(() => {
        if (!isLoading) {
            loadSchedules();
        }
    }, [selectedDate, isLoading]);

    // Filter coaches by branch
    const filteredCoaches = useMemo(() => {
        if (selectedBranch === "all") return coaches;
        return coaches.filter(c => c.branch === selectedBranch);
    }, [coaches, selectedBranch]);

    // Ensure selectedCoachName is valid in filteredCoaches
    useEffect(() => {
        if (filteredCoaches.length > 0 && !filteredCoaches.some(c => c.name === selectedCoachName)) {
            setSelectedCoachName(filteredCoaches[0].name);
        }
    }, [filteredCoaches, selectedCoachName]);

    // Day of week for selectedDate (0=Sun, 1=Mon, ..., 6=Sat)
    const currentDayOfWeek = useMemo(() => {
        const [y, m, d] = selectedDate.split('-').map(Number);
        return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    }, [selectedDate]);

    // Dynamic slots for currently selected coach & date
    const selectedCoachConfig = useMemo(() => {
        return resolveCoachSlotConfig(slotConfigs, selectedCoachName, selectedDate);
    }, [slotConfigs, selectedCoachName, selectedDate]);

    const selectedCoachSlots = useMemo(() => {
        if (selectedCoachConfig) {
            const generated = generateSlotsFromConfig(selectedCoachConfig);
            if (generated.length > 0) return generated;
        }
        return TIME_SLOTS;
    }, [selectedCoachConfig]);

    // Dynamic slots for the coach selected in Blockout Modal
    const boCoachTimeSlots = useMemo(() => {
        const targetDate = boType === "specific_date" ? boDate : selectedDate;
        const cfg = resolveCoachSlotConfig(slotConfigs, boCoachName, targetDate);
        if (cfg) {
            const generated = generateSlotsFromConfig(cfg);
            if (generated.length > 0) return generated;
        }
        return TIME_SLOTS;
    }, [slotConfigs, boCoachName, boType, boDate, selectedDate]);

    // Real-time preview slots in Slot Config Modal
    const scPreviewSlots = useMemo(() => {
        return generateSlotsFromConfig({
            useAm: scUseAm,
            amStart: scAmStart,
            amEnd: scAmEnd,
            usePm: scUsePm,
            pmStart: scPmStart,
            pmEnd: scPmEnd,
            durationMinutes: scDuration,
            breakMinutes: scBreak,
            disabledSlots: scDisabledSlots,
        }, true);
    }, [scUseAm, scAmStart, scAmEnd, scUsePm, scPmStart, scPmEnd, scDuration, scBreak, scDisabledSlots]);

    const handleOpenSlotConfigModal = (coachDefault?: string) => {
        const targetCoach = coachDefault || selectedCoachName || (coaches[0]?.name ?? "");
        const currentMonth = selectedDate.slice(0, 7);
        const existing = resolveCoachSlotConfig(slotConfigs, targetCoach, selectedDate);

        setScCoachName(targetCoach);
        if (existing) {
            setScMonthMode(existing.month === "default" ? "default" : "month");
            setScMonth(existing.month === "default" ? currentMonth : existing.month);
            setScUseAm(existing.useAm);
            setScAmStart(existing.amStart);
            setScAmEnd(existing.amEnd);
            setScUsePm(existing.usePm);
            setScPmStart(existing.pmStart);
            setScPmEnd(existing.pmEnd);
            setScDuration(existing.durationMinutes);
            setScBreak(existing.breakMinutes);
            setScDisabledSlots(existing.disabledSlots || []);
        } else {
            setScMonthMode("month");
            setScMonth(currentMonth);
            setScUseAm(true);
            setScAmStart("09:00");
            setScAmEnd("12:00");
            setScUsePm(true);
            setScPmStart("14:00");
            setScPmEnd("18:00");
            setScDuration(60);
            setScBreak(0);
            setScDisabledSlots([]);
        }
        setIsSlotConfigModalOpen(true);
    };

    const handleSaveSlotConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!scCoachName) {
            alert("코치를 선택해주세요.");
            return;
        }
        if (scPreviewSlots.filter(s => !scDisabledSlots.includes(s.start)).length === 0) {
            alert("최소 1개 이상의 타임이 생성되도록 시간 범위를 설정해주세요.");
            return;
        }

        setIsSubmittingSc(true);
        try {
            const targetCoach = coaches.find(c => c.name === scCoachName);
            const res = await fetch("/api/schedule-manage/slot-configs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    coachId: targetCoach?.id || "",
                    coachName: scCoachName,
                    month: scMonthMode === "default" ? "default" : scMonth,
                    useAm: scUseAm,
                    amStart: scAmStart,
                    amEnd: scAmEnd,
                    usePm: scUsePm,
                    pmStart: scPmStart,
                    pmEnd: scPmEnd,
                    durationMinutes: scDuration,
                    breakMinutes: scBreak,
                    disabledSlots: scDisabledSlots,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "저장 실패");

            alert("타임 설정이 저장되었습니다.");
            setIsSlotConfigModalOpen(false);
            await loadSlotConfigsData();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsSubmittingSc(false);
        }
    };

    const handleDeleteSlotConfig = async (id: string) => {
        if (!confirm("이 타임 설정을 삭제하고 기본 시간표로 되돌리시겠습니까?")) return;
        try {
            const res = await fetch("/api/schedule-manage/slot-configs", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
            });
            if (!res.ok) throw new Error("삭제 실패");
            await loadSlotConfigsData();
        } catch (err: any) {
            alert(err.message);
        }
    };

    // Helper: Find schedule for a coach at a slot
    const getCoachSlotInfo = (coachName: string, slotStart: string, slotEnd?: string) => {
        const cleanCoach = coachName.replace(/ (감독|코치|프로)$/, '').trim();
        const slotStartMs = new Date(`${selectedDate}T${slotStart}:00+09:00`).getTime();
        const slotEndMs = slotEnd
            ? new Date(`${selectedDate}T${slotEnd}:00+09:00`).getTime()
            : slotStartMs + 60 * 60 * 1000;

        // 1. Check Blockouts
        const matchedBlockout = blockouts.find(b => {
            const matchCoach = b.coachName === coachName || b.coachName === cleanCoach;
            if (!matchCoach) return false;

            if (b.type === "recurring") {
                if (b.dayOfWeek !== currentDayOfWeek) return false;
            } else if (b.type === "specific_date") {
                if (b.date !== selectedDate) return false;
            }

            if (b.allDay) return true;
            if (b.slots?.includes(slotStart)) return true;
            return b.slots?.some(bs => {
                const bsStart = new Date(`${selectedDate}T${bs}:00+09:00`).getTime();
                const bsEnd = bsStart + 60 * 60 * 1000;
                return slotStartMs < bsEnd && slotEndMs > bsStart;
            });
        });

        if (matchedBlockout) {
            return {
                status: "blocked" as const,
                reason: matchedBlockout.reason,
                blockoutId: matchedBlockout.id,
                type: matchedBlockout.type
            };
        }

        // 2. Check Active Schedules
        const matchedSchedule = schedules.find(s => {
            const creatorName = s.creator?.name || "";
            const userName = s.users?.name || "";
            const isThisCoach = creatorName === cleanCoach || creatorName === coachName || userName === cleanCoach;
            if (!isThisCoach) return false;

            const evStart = new Date(s.start_time).getTime();
            let evEnd = new Date(s.end_time).getTime();
            if (isNaN(evEnd) || evEnd <= evStart) evEnd = evStart + 30 * 60 * 1000;

            return slotStartMs < evEnd && slotEndMs > evStart;
        });

        if (matchedSchedule) {
            return {
                status: "booked" as const,
                schedule: matchedSchedule,
                participantName: matchedSchedule.users?.name || "선수",
                title: matchedSchedule.title,
                eventType: matchedSchedule.event_type
            };
        }

        return { status: "available" as const };
    };

    // Weekly Calendar navigation
    const [calendarWeekDate, setCalendarWeekDate] = useState<Date>(() => new Date());

    const weekDays = useMemo(() => {
        const start = startOfWeek(calendarWeekDate, { weekStartsOn: 0 });
        return eachDayOfInterval({ start, end: addDays(start, 6) });
    }, [calendarWeekDate]);

    const weekHeaderLabel = `${format(weekDays[0], "M월 d일", { locale: ko })} ~ ${format(weekDays[6], "M월 d일", { locale: ko })}`;

    const navigateWeek = (direction: "prev" | "next" | "today") => {
        if (direction === "today") {
            const now = new Date();
            setCalendarWeekDate(now);
            setSelectedDate(format(now, "yyyy-MM-dd"));
            return;
        }
        const nextWeek = direction === "next" ? addWeeks(calendarWeekDate, 1) : subWeeks(calendarWeekDate, 1);
        setCalendarWeekDate(nextWeek);
        const currentSelected = new Date(`${selectedDate}T00:00:00`);
        const movedSelected = direction === "next" ? addWeeks(currentSelected, 1) : subWeeks(currentSelected, 1);
        setSelectedDate(format(movedSelected, "yyyy-MM-dd"));
    };

    // Open blockout modal
    const handleOpenBlockoutModal = (coachDefault?: string) => {
        setBoCoachName(coachDefault || selectedCoachName || (coaches[0]?.name ?? ""));
        setBoType("recurring");
        setBoDayOfWeek(currentDayOfWeek);
        setBoDate(selectedDate);
        setBoAllDay(false);
        setBoSlots([]);
        setBoReason("정기 휴무");
        setIsBlockoutModalOpen(true);
    };

    // Submit blockout
    const handleSubmitBlockout = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!boCoachName) {
            alert("코치를 선택해주세요.");
            return;
        }
        if (boSlots.length === 0) {
            alert("시간을 최소 1개 이상 선택해주세요.");
            return;
        }

        const isAllDaySelected = boSlots.length === boCoachTimeSlots.length;

        setIsSubmittingBo(true);
        try {
            const targetCoach = coaches.find(c => c.name === boCoachName);
            const res = await fetch("/api/schedule-manage/blockouts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    coachId: targetCoach?.id || "",
                    coachName: boCoachName,
                    type: boType,
                    dayOfWeek: boDayOfWeek,
                    date: boDate,
                    allDay: isAllDaySelected,
                    slots: boSlots,
                    reason: boReason,
                    createdBy: currentUserName
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "등록 실패");

            alert("휴무/불가 설정이 등록되었습니다.");
            setIsBlockoutModalOpen(false);
            await loadBlockoutsData();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsSubmittingBo(false);
        }
    };

    // Delete blockout
    const handleDeleteBlockout = async (id: string, reason: string) => {
        if (!confirm(`이 휴무/불가 설정(${reason})을 해제하시겠습니까?`)) return;
        try {
            const res = await fetch("/api/schedule-manage/blockouts", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id })
            });

            if (!res.ok) throw new Error("삭제 실패");
            alert("해제되었습니다.");
            await loadBlockoutsData();
        } catch (e: any) {
            alert(e.message);
        }
    };

    // Quick Book on slot
    const handleQuickBook = (coachName: string, slotStart: string) => {
        setSelectedCoachName(coachName);
        setDialogInitialDate(new Date(selectedDate));
        setDialogInitialSlot(slotStart);
        setIsScheduleDialogOpen(true);
    };

    // Cancel schedule
    const handleCancelSchedule = async (scheduleId: string, title: string) => {
        if (!confirm(`예약 [${title}]을 취소하시겠습니까?`)) return;
        try {
            await deleteEvent(scheduleId);
            alert("예약이 취소되었습니다.");
            await loadSchedules();
        } catch (e: any) {
            alert("취소 중 오류가 발생했습니다.");
        }
    };

    // Slot toggle for blockout form
    const toggleBoSlot = (slotKey: string) => {
        setBoSlots(prev =>
            prev.includes(slotKey) ? prev.filter(s => s !== slotKey) : [...prev, slotKey]
        );
    };

    // Filtered athletes for athlete view
    const filteredAthletesList = useMemo(() => {
        if (!athleteSearchQuery.trim()) return [];
        return athletes.filter(a =>
            a.name.toLowerCase().includes(athleteSearchQuery.toLowerCase())
        );
    }, [athletes, athleteSearchQuery]);

    // Schedules filtered by selected athlete
    const [selectedAthleteId, setSelectedAthleteId] = useState<string>("");
    const [athleteSchedules, setAthleteSchedules] = useState<any[]>([]);

    useEffect(() => {
        if (!selectedAthleteId) {
            setAthleteSchedules([]);
            return;
        }

        const fetchAthleteSchedules = async () => {
            const supabase = createClient();
            const { data } = await supabase
                .from("schedules")
                .select(`
                    id,
                    title,
                    event_type,
                    start_time,
                    end_time,
                    status,
                    creator:users!schedules_creator_id_fkey(id, name, branch)
                `)
                .eq("user_id", selectedAthleteId)
                .order("start_time", { ascending: false })
                .limit(20);

            setAthleteSchedules(data || []);
        };

        fetchAthleteSchedules();
    }, [selectedAthleteId]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
                <div className="w-8 h-8 border-3 border-brand-navy border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-zinc-50 dark:bg-zinc-950 pb-20">
            {/* Top Header */}
            <div className="w-full bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-30">
                <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <CalendarIcon size={24} className="text-brand-navy dark:text-brand-navy-light shrink-0" />
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 truncate">
                            스케쥴 관리
                        </h1>
                    </div>
                </div>

                {/* Filter Bar: Branch, Tabs */}
                <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 pb-3 pt-1 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 border-t border-zinc-100 dark:border-zinc-800/60 min-w-0">
                    {/* Branch Filter */}
                    <div className="w-full md:w-auto flex flex-nowrap justify-start items-center gap-1.5 overflow-x-auto scrollbar-hide pb-0.5 min-w-0">
                        {[
                            { key: "all", label: "전체" },
                            { key: "조이마루점", label: "조이마루" },
                            { key: "구미점", label: "구미" },
                        ].map(({ key, label }) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setSelectedBranch(key)}
                                className={cn(
                                    "flex items-center gap-1 px-4 py-2 rounded-full text-sm font-semibold border transition-all duration-200 shrink-0",
                                    selectedBranch === key
                                        ? "bg-brand-navy text-white border-brand-navy shadow-md"
                                        : "bg-white text-zinc-600 border-zinc-200 hover:bg-brand-navy-light hover:text-brand-navy dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 dark:hover:bg-brand-navy-dark dark:hover:text-white"
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Tabs */}
                    <div className="w-full md:w-auto flex flex-nowrap justify-start items-center gap-1.5 overflow-x-auto scrollbar-hide pb-0.5 min-w-0">
                        {[
                            { key: "matrix" as const, label: "전체" },
                            { key: "coach" as const, label: "코치별" },
                            { key: "athlete" as const, label: "선수별" },
                            { key: "blockouts" as const, label: "휴무 목록" },
                        ].map(({ key, label }) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setActiveTab(key)}
                                className={cn(
                                    "flex items-center gap-1 px-4 py-2 rounded-full text-sm font-semibold border transition-all duration-200 shrink-0",
                                    activeTab === key
                                        ? "bg-brand-navy text-white border-brand-navy shadow-md"
                                        : "bg-white text-zinc-600 border-zinc-200 hover:bg-brand-navy-light hover:text-brand-navy dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 dark:hover:bg-brand-navy-dark dark:hover:text-white"
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 min-w-0">
                {/* Weekly Calendar Strip (matching ScheduleCalendar format without dots) */}
                {activeTab !== "blockouts" && (
                    <div className="mb-5">
                        <div className="flex items-center justify-center gap-4 py-1.5">
                            <button
                                type="button"
                                onClick={() => navigateWeek("prev")}
                                className="p-1.5 rounded-lg hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition-colors"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <div className="flex items-center gap-3">
                                <span className="text-base font-bold text-zinc-900 dark:text-zinc-200">{weekHeaderLabel}</span>
                                <button
                                    type="button"
                                    onClick={() => navigateWeek("today")}
                                    className="px-3 py-1 rounded-lg text-xs font-semibold border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-zinc-600 dark:text-zinc-400"
                                >
                                    오늘
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={() => navigateWeek("next")}
                                className="p-1.5 rounded-lg hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition-colors"
                            >
                                <ChevronRight size={20} />
                            </button>
                        </div>

                        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                            <div className="grid grid-cols-7 border-b border-zinc-100 dark:border-zinc-800">
                                {WEEK_DAYS.map((day, i) => (
                                    <div
                                        key={day}
                                        className={cn(
                                            "py-2 text-center text-xs font-semibold",
                                            i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-zinc-500 dark:text-zinc-400"
                                        )}
                                    >
                                        {day}
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7">
                                {weekDays.map((day, idx) => {
                                    const dayStr = format(day, "yyyy-MM-dd");
                                    const isToday = isSameDay(day, new Date());
                                    const isSelected = selectedDate === dayStr;
                                    const dow = day.getDay();

                                    return (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => setSelectedDate(dayStr)}
                                            className={cn(
                                                "relative flex flex-col items-center justify-center py-2.5 min-h-[52px] border-r border-zinc-100 dark:border-zinc-800 transition-colors",
                                                isSelected ? "bg-sky-50 dark:bg-sky-900/40" : "hover:bg-zinc-50 dark:hover:bg-zinc-800",
                                                idx % 7 === 6 ? "border-r-0" : ""
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    "w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium",
                                                    isToday ? "bg-blue-500 text-white" : "",
                                                    isSelected && !isToday ? "bg-sky-200 text-sky-800 dark:bg-sky-700 dark:text-sky-100 font-bold" : "",
                                                    !isToday && !isSelected && dow === 0 ? "text-red-500" : "",
                                                    !isToday && !isSelected && dow === 6 ? "text-blue-500" : ""
                                                )}
                                            >
                                                {format(day, "d")}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
                {/* ── TAB 1: 코치별 타임테이블 ── */}
                {activeTab === "coach" && (
                    <div className="space-y-4 min-w-0">
                        {/* Coach Selector Bar */}
                        <div className="w-full flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide min-w-0">
                            {filteredCoaches.map(c => {
                                const isSelected = selectedCoachName === c.name;
                                return (
                                    <button
                                        key={c.id}
                                        onClick={() => setSelectedCoachName(c.name)}
                                        className={cn(
                                            "shrink-0 h-[42px] px-4 rounded-xl text-sm font-semibold transition-all border shadow-sm whitespace-nowrap flex items-center justify-center",
                                            isSelected
                                                ? "bg-brand-navy border-brand-navy text-white font-bold scale-[1.02] shadow"
                                                : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-zinc-400 text-zinc-700 dark:text-zinc-200"
                                        )}
                                    >
                                        {c.name}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Coach Daily Summary Card */}
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 shadow-sm">
                            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 gap-2">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                                            {selectedCoachName} 일정
                                        </h2>
                                        {selectedCoachConfig && (
                                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-brand-navy/10 text-brand-navy dark:bg-brand-navy-light/20 dark:text-brand-navy-light whitespace-nowrap">
                                                {selectedCoachConfig.durationMinutes}분 단위
                                                {selectedCoachConfig.month !== "default" ? ` (${selectedCoachConfig.month})` : ""}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-zinc-500">
                                        {format(new Date(`${selectedDate}T00:00:00`), "yyyy년 MM월 dd일")} (
                                        {DAYS_OF_WEEK.find(d => d.value === currentDayOfWeek)?.label})
                                    </p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                        onClick={() => handleOpenSlotConfigModal(selectedCoachName)}
                                        className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border border-brand-navy/30 dark:border-brand-navy/60 bg-brand-navy/5 dark:bg-brand-navy/20 text-brand-navy dark:text-zinc-200 hover:bg-brand-navy/10 transition-colors flex items-center gap-1 whitespace-nowrap"
                                    >
                                        <Clock size={13} />
                                        타임 설정
                                    </button>
                                    <button
                                        onClick={() => handleOpenBlockoutModal(selectedCoachName)}
                                        className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 transition-colors flex items-center gap-1 whitespace-nowrap"
                                    >
                                        <CalendarOff size={13} />
                                        휴무 설정
                                    </button>
                                </div>
                            </div>

                            {/* Time Slots Compact List */}
                            <div className="space-y-2 mt-4">
                                {selectedCoachSlots.map((slot) => {
                                    const info = getCoachSlotInfo(selectedCoachName, slot.start, slot.end);

                                    if (info.status === "blocked") {
                                        return (
                                            <div
                                                key={slot.key}
                                                className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-800/40 relative overflow-hidden"
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0 relative z-10">
                                                    <span className="text-xs font-bold text-zinc-400 w-9 shrink-0 line-through">
                                                        {slot.label}
                                                    </span>
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 shrink-0">
                                                        {info.type === "recurring" ? "정기 휴무" : "일정 불가"}
                                                    </span>
                                                    <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 truncate">
                                                        {info.reason}
                                                    </span>
                                                </div>
                                                {info.blockoutId && (
                                                    <button
                                                        onClick={() => handleDeleteBlockout(info.blockoutId!, info.reason)}
                                                        className="relative z-10 text-[11px] font-semibold text-red-500 hover:text-red-700 transition-colors shrink-0 ml-2"
                                                    >
                                                        설정 해제
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    }

                                    if (info.status === "booked") {
                                        const typeBadge =
                                            info.eventType === "analysis" ? "bg-orange-500 text-white" :
                                                info.eventType === "lesson" ? "bg-blue-500 text-white" :
                                                    info.eventType === "consultation" ? "bg-amber-500 text-white" :
                                                        "bg-zinc-500 text-white";

                                        const typeLabel =
                                            info.eventType === "analysis" ? "분석" :
                                                info.eventType === "lesson" ? "레슨" :
                                                    info.eventType === "consultation" ? "상담" : "기타";

                                        return (
                                            <div
                                                key={slot.key}
                                                className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-brand-navy/30 dark:border-brand-navy/50 bg-white dark:bg-zinc-900 shadow-sm hover:shadow transition-all"
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200 w-9 shrink-0">
                                                        {slot.label}
                                                    </span>
                                                    <span className={cn("text-[10px] font-black px-2 py-0.5 rounded-full shrink-0", typeBadge)}>
                                                        {typeLabel}
                                                    </span>
                                                    <span className="text-sm font-black text-zinc-900 dark:text-zinc-100 truncate">
                                                        {info.participantName}
                                                    </span>
                                                    <span className="text-xs text-zinc-400 truncate hidden sm:inline">
                                                        {info.title}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-3 shrink-0 ml-2">
                                                    <button
                                                        onClick={() => router.push(`/lessons/create?player=${encodeURIComponent(info.participantName)}&date=${selectedDate}&start=${slot.start}&end=${slot.end}`)}
                                                        className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                                    >
                                                        <FileText size={11} />
                                                        레슨 작성
                                                    </button>
                                                    <button
                                                        onClick={() => handleCancelSchedule(info.schedule.id, info.title)}
                                                        className="text-[11px] font-semibold text-red-500 hover:text-red-700"
                                                    >
                                                        취소
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    }

                                    // Available Slot
                                    return (
                                        <div
                                            key={slot.key}
                                            className="flex items-center justify-between px-3.5 py-2 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700 bg-zinc-50/40 dark:bg-zinc-900/40 hover:border-zinc-300 dark:hover:border-zinc-600 transition-all"
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <span className="text-xs font-bold text-zinc-500 w-9">
                                                    {slot.label}
                                                </span>
                                                <span className="text-xs text-zinc-400">
                                                    ({slot.start} ~ {slot.end})
                                                </span>
                                                <span className="text-[11px] font-medium text-zinc-400">
                                                    비어있음
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => handleQuickBook(selectedCoachName, slot.start)}
                                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-brand-navy hover:text-white hover:border-brand-navy transition-all shadow-sm"
                                            >
                                                <Plus size={12} />
                                                예약 등록
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── TAB 2: 지점 통합 매트릭스 ── */}
                {activeTab === "matrix" && (
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                        <div className="p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2">
                            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                지점 코치별 시간대 현황
                            </h2>
                            <span className="shrink-0 whitespace-nowrap text-xs font-semibold text-zinc-400">
                                코치 총 {filteredCoaches.length}명
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[780px]">
                                <thead>
                                    <tr className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-700 text-xs text-zinc-500">
                                        <th className="py-3 px-3 sm:px-4 font-bold w-20 sm:w-28 sticky left-0 z-30 bg-zinc-50 dark:bg-zinc-800 whitespace-nowrap shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]">코치명</th>
                                        {TIME_SLOTS.map(s => (
                                            <th key={s.key} className="py-3 px-2 font-bold text-center min-w-[60px] whitespace-nowrap">{s.label}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                                    {filteredCoaches.map((c) => (
                                        <tr key={c.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                                            <td className="py-2.5 px-3 sm:px-4 font-black text-zinc-900 dark:text-zinc-100 sticky left-0 z-20 bg-white dark:bg-zinc-900 whitespace-nowrap shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]">
                                                {c.name}
                                            </td>
                                            {TIME_SLOTS.map(s => {
                                                const info = getCoachSlotInfo(c.name, s.start);

                                                if (info.status === "blocked") {
                                                    return (
                                                        <td key={s.key} className="py-2 px-1 text-center">
                                                            <div className="py-1.5 px-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-400 text-[11px] font-semibold flex flex-col items-center justify-center border border-zinc-200 dark:border-zinc-700 whitespace-nowrap">
                                                                <span className="line-through leading-tight">{s.label}</span>
                                                                <span className="text-[9px] text-zinc-400 leading-tight">(휴무)</span>
                                                            </div>
                                                        </td>
                                                    );
                                                }

                                                if (info.status === "booked") {
                                                    const badgeBg =
                                                        info.eventType === "analysis" ? "bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950/20" :
                                                            info.eventType === "lesson" ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/20" :
                                                                "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/20";

                                                    return (
                                                        <td key={s.key} className="py-2 px-1 text-center">
                                                            <div className={cn("py-1.5 px-1 rounded-lg border font-bold text-[11px] flex flex-col items-center justify-center", badgeBg)}>
                                                                <span className="truncate max-w-[65px] leading-tight">{info.participantName}</span>
                                                                <span className="text-[9px] opacity-75 font-normal leading-tight">
                                                                    {info.eventType === "analysis" ? "분석" : info.eventType === "lesson" ? "레슨" : "상담"}
                                                                </span>
                                                            </div>
                                                        </td>
                                                    );
                                                }

                                                return (
                                                    <td key={s.key} className="py-2 px-1 text-center">
                                                        <button
                                                            onClick={() => handleQuickBook(c.name, s.start)}
                                                            className="w-full py-2 px-1 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-700 hover:border-brand-navy hover:text-brand-navy text-zinc-400 text-[11px] font-medium transition-colors whitespace-nowrap"
                                                            title="클릭하여 예약 등록"
                                                        >
                                                            가능
                                                        </button>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ── TAB 3: 선수별 일정 조회 ── */}
                {activeTab === "athlete" && (
                    <div className="space-y-4">
                        {/* Athlete Search Bar */}
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 shadow-sm">
                            <label className="block text-xs font-bold text-zinc-500 mb-2">선수 검색</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="선수 이름을 입력하세요..."
                                    value={athleteSearchQuery}
                                    onChange={(e) => setAthleteSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy text-zinc-900 dark:text-zinc-100"
                                />
                            </div>

                            {/* Search Suggestions */}
                            {filteredAthletesList.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                                    {filteredAthletesList.slice(0, 10).map(a => (
                                        <button
                                            key={a.id}
                                            onClick={() => {
                                                setSelectedAthleteId(a.id);
                                                setAthleteSearchQuery(a.name);
                                            }}
                                            className={cn(
                                                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border",
                                                selectedAthleteId === a.id
                                                    ? "bg-brand-navy border-brand-navy text-white"
                                                    : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                                            )}
                                        >
                                            {a.name} ({a.branch || "미지정"})
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Athlete Schedules Daily Timetable + History */}
                        {selectedAthleteId ? (
                            <div className="space-y-4">
                                {/* 1. Daily 7-slot timetable for selectedDate */}
                                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 shadow-sm">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800 gap-1">
                                        <div>
                                            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                                                {athleteSearchQuery} 선수 일간 일정
                                            </h3>
                                            <p className="text-xs text-zinc-500">
                                                {format(new Date(`${selectedDate}T00:00:00`), "yyyy년 MM월 dd일")} (
                                                {DAYS_OF_WEEK.find(d => d.value === currentDayOfWeek)?.label})
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-2 mt-4">
                                        {TIME_SLOTS.map((slot) => {
                                            const slotStartMs = new Date(`${selectedDate}T${slot.start}:00+09:00`).getTime();
                                            const slotEndMs = slotStartMs + 60 * 60 * 1000;

                                            const bookedItem = schedules.find((s) => {
                                                if (s.user_id !== selectedAthleteId) return false;
                                                const evStart = new Date(s.start_time).getTime();
                                                let evEnd = new Date(s.end_time).getTime();
                                                if (isNaN(evEnd) || evEnd <= evStart) evEnd = evStart + 30 * 60 * 1000;
                                                return slotStartMs < evEnd && slotEndMs > evStart;
                                            });

                                            if (bookedItem) {
                                                const isAnalysis = bookedItem.title?.includes("[분석]") || bookedItem.event_type === "analysis";
                                                const isConsult = bookedItem.title?.includes("[상담]") || bookedItem.event_type === "consultation";
                                                const typeBadge = isAnalysis
                                                    ? "bg-orange-500 text-white"
                                                    : isConsult
                                                        ? "bg-amber-500 text-white"
                                                        : "bg-blue-500 text-white";
                                                const typeLabel = isAnalysis ? "분석" : isConsult ? "상담" : "레슨";

                                                return (
                                                    <div
                                                        key={slot.key}
                                                        className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-brand-navy/30 dark:border-brand-navy/50 bg-white dark:bg-zinc-900 shadow-sm"
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200 w-9 shrink-0">
                                                                {slot.label}
                                                            </span>
                                                            <span className={cn("text-[10px] font-black px-2 py-0.5 rounded-full shrink-0", typeBadge)}>
                                                                {typeLabel}
                                                            </span>
                                                            <span className="text-sm font-black text-zinc-900 dark:text-zinc-100 truncate">
                                                                담당: {bookedItem.creator?.name || "코치"}
                                                            </span>
                                                            <span className="text-xs text-zinc-400 truncate hidden sm:inline">
                                                                {bookedItem.title}
                                                            </span>
                                                        </div>
                                                        <button
                                                            onClick={() => handleCancelSchedule(bookedItem.id, bookedItem.title)}
                                                            className="text-[11px] font-semibold text-red-500 hover:text-red-700 shrink-0 ml-2"
                                                        >
                                                            예약 취소
                                                        </button>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div
                                                    key={slot.key}
                                                    className="flex items-center justify-between px-3.5 py-2 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700 bg-zinc-50/40 dark:bg-zinc-900/40"
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        <span className="text-xs font-bold text-zinc-500 w-9">
                                                            {slot.label}
                                                        </span>
                                                        <span className="text-xs text-zinc-400">
                                                            ({slot.start} ~ {slot.end})
                                                        </span>
                                                    </div>
                                                    <span className="text-[11px] font-medium text-zinc-400">
                                                        비어있음
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* 2. All Upcoming/Recent Bookings Summary */}
                                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 shadow-sm">
                                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-3">
                                        {athleteSearchQuery} 선수의 전체 예약 내역
                                    </h3>

                                    {athleteSchedules.length > 0 ? (
                                        <div className="space-y-2">
                                            {athleteSchedules.map(item => {
                                                const startDate = new Date(item.start_time);
                                                const dateStr = format(startDate, "yyyy-MM-dd");
                                                const timeStr = format(startDate, "HH:mm");
                                                const isAnalysis = item.title?.includes("[분석]") || item.event_type === "analysis";
                                                const isConsult = item.title?.includes("[상담]") || item.event_type === "consultation";
                                                const typeBadge = isAnalysis
                                                    ? "bg-orange-500 text-white"
                                                    : isConsult
                                                        ? "bg-amber-500 text-white"
                                                        : "bg-blue-500 text-white";

                                                return (
                                                    <div
                                                        key={item.id}
                                                        className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30"
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0", typeBadge)}>
                                                                {isAnalysis ? "분석" : isConsult ? "상담" : "레슨"}
                                                            </span>
                                                            <div className="min-w-0">
                                                                <p className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                                                    {item.title}
                                                                </p>
                                                                <p className="text-[11px] text-zinc-500">
                                                                    {dateStr} {timeStr} | 담당: {item.creator?.name || "코치"}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <button
                                                            onClick={() => handleCancelSchedule(item.id, item.title)}
                                                            className="text-xs font-semibold text-red-500 hover:text-red-700 px-2 py-1 rounded shrink-0"
                                                        >
                                                            취소
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-center py-6 text-zinc-400 text-xs">
                                            예약된 스케쥴 내역이 없습니다.
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-zinc-400 text-sm">
                                위 검색창에서 선수를 검색하여 선택해 주세요.
                            </div>
                        )}
                    </div>
                )}

                {/* ── TAB 4: 휴무/불가 목록 ── */}
                {activeTab === "blockouts" && (
                    <div className="space-y-4">
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 shadow-sm flex items-center justify-between gap-2">
                            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                휴무/예약 불가 규칙
                            </h2>
                            <button
                                onClick={() => handleOpenBlockoutModal()}
                                className="shrink-0 whitespace-nowrap px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1"
                            >
                                <Plus size={14} />
                                신규 등록
                            </button>
                        </div>

                        {/* List */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                            {blockouts.length > 0 ? (
                                blockouts.map(b => {
                                    const dayLabel = DAYS_OF_WEEK.find(d => d.value === b.dayOfWeek)?.label || "";
                                    const timeLabel = b.allDay ? "종일 (8시~21시 전체)" : (b.slots?.join(", ") || "전체");

                                    return (
                                        <div
                                            key={b.id}
                                            className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex flex-col justify-between gap-3"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <span className={cn(
                                                        "text-[10px] font-black px-2 py-0.5 rounded-full inline-block mb-1.5",
                                                        b.type === "recurring" ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300" : "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300"
                                                    )}>
                                                        {b.type === "recurring" ? "매주 정기 반복" : "특정 날짜 지정"}
                                                    </span>
                                                    <h3 className="text-base font-black text-zinc-900 dark:text-zinc-100">
                                                        {b.coachName} 코치
                                                    </h3>
                                                    <p className="text-xs text-zinc-500 mt-0.5">
                                                        {b.type === "recurring" ? `매주 ${dayLabel}` : `${b.date}`} | {timeLabel}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteBlockout(b.id, b.reason)}
                                                    className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                                                    title="규칙 삭제"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>

                                            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
                                                <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                                                    사유: {b.reason}
                                                </span>
                                                <span className="text-[11px] text-zinc-400">
                                                    등록자: {b.createdBy || "관리자"}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="col-span-full text-center py-12 text-zinc-400 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-sm">
                                    등록된 휴무/불가 설정이 없습니다.
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* ── MODAL 1: 휴무/불가 등록 모달 ── */}
            {isBlockoutModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/40 animate-in fade-in duration-200">
                    <div
                        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 max-w-md w-full p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                                <CalendarOff size={18} className="text-amber-500" />
                                코치 휴무 / 예약 불가 설정
                            </h2>
                            <button
                                onClick={() => setIsBlockoutModalOpen(false)}
                                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmitBlockout} className="space-y-4 text-xs sm:text-sm">
                            {/* 1. Coach Selector */}
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 mb-1.5">대상 코치 *</label>
                                <select
                                    value={boCoachName}
                                    onChange={(e) => setBoCoachName(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-brand-navy"
                                    required
                                >
                                    {coaches.map(c => (
                                        <option key={c.id} value={c.name}>
                                            {c.name} ({c.branch || "미지정"})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* 2. Type Selector */}
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 mb-1.5">유형 선택 *</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setBoType("recurring")}
                                        className={cn(
                                            "py-2.5 rounded-xl text-xs font-bold transition-all border",
                                            boType === "recurring"
                                                ? "bg-brand-navy border-brand-navy text-white shadow-sm"
                                                : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400"
                                        )}
                                    >
                                        매주 반복 (정기 휴무)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setBoType("specific_date")}
                                        className={cn(
                                            "py-2.5 rounded-xl text-xs font-bold transition-all border",
                                            boType === "specific_date"
                                                ? "bg-brand-navy border-brand-navy text-white shadow-sm"
                                                : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400"
                                        )}
                                    >
                                        특정 날짜 (휴가/출장)
                                    </button>
                                </div>
                            </div>

                            {/* 3. Day of week OR Specific Date */}
                            {boType === "recurring" ? (
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 mb-1.5">반복 요일 *</label>
                                    <div className="grid grid-cols-7 gap-1">
                                        {DAYS_OF_WEEK.map(d => (
                                            <button
                                                key={d.value}
                                                type="button"
                                                onClick={() => setBoDayOfWeek(d.value)}
                                                className={cn(
                                                    "py-2 rounded-xl text-xs font-bold transition-all border text-center",
                                                    boDayOfWeek === d.value
                                                        ? "bg-brand-navy border-brand-navy text-white shadow"
                                                        : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300"
                                                )}
                                            >
                                                {d.label.slice(0, 1)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 mb-1.5">해당 날짜 *</label>
                                    <input
                                        type="date"
                                        value={boDate}
                                        onChange={(e) => setBoDate(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-semibold text-zinc-800 dark:text-zinc-200"
                                        required
                                    />
                                </div>
                            )}

                            {/* 4. Time Range */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-xs font-bold text-zinc-500">시간 범위 *</label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (boSlots.length === boCoachTimeSlots.length) {
                                                setBoSlots([]);
                                            } else {
                                                setBoSlots(boCoachTimeSlots.map(s => s.start));
                                            }
                                        }}
                                        className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                                    >
                                        {boSlots.length === boCoachTimeSlots.length ? "전체 해제" : "종일 전체 선택"}
                                    </button>
                                </div>

                                <div className="grid grid-cols-4 gap-1.5">
                                    {boCoachTimeSlots.map(s => {
                                        const isSelected = boSlots.includes(s.start);
                                        return (
                                            <button
                                                key={s.key}
                                                type="button"
                                                onClick={() => toggleBoSlot(s.start)}
                                                className={cn(
                                                    "py-2 rounded-xl text-xs font-semibold border transition-all text-center",
                                                    isSelected
                                                        ? "bg-amber-500 border-amber-500 text-white font-bold shadow-sm"
                                                        : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-zinc-400"
                                                )}
                                            >
                                                {s.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 5. Reason Presets & Custom */}
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 mb-1.5">사유 *</label>
                                <div className="flex flex-wrap gap-1 mb-2">
                                    {REASON_PRESETS.map(preset => (
                                        <button
                                            key={preset}
                                            type="button"
                                            onClick={() => setBoReason(preset)}
                                            className={cn(
                                                "px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors",
                                                boReason === preset
                                                    ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900 border-transparent"
                                                    : "bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
                                            )}
                                        >
                                            {preset}
                                        </button>
                                    ))}
                                </div>
                                <input
                                    type="text"
                                    value={boReason}
                                    onChange={(e) => setBoReason(e.target.value)}
                                    placeholder="사유를 입력하세요 (예: 연차, 세미나 참석 등)"
                                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-semibold text-zinc-800 dark:text-zinc-200"
                                    required
                                />
                            </div>

                            {/* Buttons */}
                            <div className="flex items-center gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                                <button
                                    type="button"
                                    onClick={() => setIsBlockoutModalOpen(false)}
                                    className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-600 dark:text-zinc-300"
                                >
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingBo}
                                    className="flex-1 py-2.5 rounded-xl bg-brand-navy text-white text-xs font-bold shadow hover:bg-brand-navy/90 transition-all disabled:opacity-50"
                                >
                                    {isSubmittingBo ? "등록 중..." : "등록하기"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── MODAL 1.5: 코치 타임 단위 설정 모달 ── */}
            {isSlotConfigModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
                    onClick={() => setIsSlotConfigModalOpen(false)}
                >
                    <div
                        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 max-w-lg w-full p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                                <Clock size={18} className="text-brand-navy dark:text-brand-navy-light" />
                                코치 타임 단위 설정
                            </h2>
                            <button
                                type="button"
                                onClick={() => setIsSlotConfigModalOpen(false)}
                                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveSlotConfig} className="space-y-4 text-xs sm:text-sm">
                            {/* 1. Coach Selector */}
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 mb-1.5">대상 코치 *</label>
                                <select
                                    value={scCoachName}
                                    onChange={(e) => setScCoachName(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-brand-navy"
                                    required
                                >
                                    {coaches.map(c => (
                                        <option key={c.id} value={c.name}>
                                            {c.name} ({c.branch || "미지정"})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* 2. Target Scope: Default vs Specific Month */}
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 mb-1.5">적용 기간 *</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setScMonthMode("default")}
                                        className={cn(
                                            "py-2 rounded-xl text-xs font-bold transition-all border",
                                            scMonthMode === "default"
                                                ? "bg-brand-navy border-brand-navy text-white shadow-sm"
                                                : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400"
                                        )}
                                    >
                                        기본 설정 (전체 월)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setScMonthMode("month")}
                                        className={cn(
                                            "py-2 rounded-xl text-xs font-bold transition-all border",
                                            scMonthMode === "month"
                                                ? "bg-brand-navy border-brand-navy text-white shadow-sm"
                                                : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400"
                                        )}
                                    >
                                        특정 월 지정
                                    </button>
                                </div>
                                {scMonthMode === "month" && (
                                    <input
                                        type="month"
                                        value={scMonth}
                                        onChange={(e) => setScMonth(e.target.value)}
                                        className="mt-2 w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-semibold text-zinc-800 dark:text-zinc-200"
                                        required
                                    />
                                )}
                            </div>

                            {/* 3. AM / PM Operating Hours */}
                            <div className="space-y-2.5 bg-zinc-50 dark:bg-zinc-800/40 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                <label className="block text-xs font-bold text-zinc-500">운영 시간대</label>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <label className="flex items-center gap-2 text-xs font-bold text-zinc-700 dark:text-zinc-200 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={scUseAm}
                                            onChange={(e) => setScUseAm(e.target.checked)}
                                            className="rounded border-zinc-300 text-brand-navy focus:ring-brand-navy"
                                        />
                                        오전 타임
                                    </label>
                                    <div className={cn("flex items-center gap-1.5", !scUseAm && "opacity-40 pointer-events-none")}>
                                        <input
                                            type="time"
                                            value={scAmStart}
                                            onChange={(e) => setScAmStart(e.target.value)}
                                            className="px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold"
                                        />
                                        <span className="text-zinc-400">~</span>
                                        <input
                                            type="time"
                                            value={scAmEnd}
                                            onChange={(e) => setScAmEnd(e.target.value)}
                                            className="px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-200/70 dark:border-zinc-700/60">
                                    <label className="flex items-center gap-2 text-xs font-bold text-zinc-700 dark:text-zinc-200 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={scUsePm}
                                            onChange={(e) => setScUsePm(e.target.checked)}
                                            className="rounded border-zinc-300 text-brand-navy focus:ring-brand-navy"
                                        />
                                        오후 타임
                                    </label>
                                    <div className={cn("flex items-center gap-1.5", !scUsePm && "opacity-40 pointer-events-none")}>
                                        <input
                                            type="time"
                                            value={scPmStart}
                                            onChange={(e) => setScPmStart(e.target.value)}
                                            className="px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold"
                                        />
                                        <span className="text-zinc-400">~</span>
                                        <input
                                            type="time"
                                            value={scPmEnd}
                                            onChange={(e) => setScPmEnd(e.target.value)}
                                            className="px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 4. Duration & Break Presets */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 mb-1.5">1타임 수업 시간</label>
                                    <div className="grid grid-cols-3 gap-1">
                                        {[20, 30, 40, 45, 50, 60].map((mins) => (
                                            <button
                                                key={mins}
                                                type="button"
                                                onClick={() => setScDuration(mins)}
                                                className={cn(
                                                    "py-1.5 rounded-lg text-xs font-bold border transition-all",
                                                    scDuration === mins
                                                        ? "bg-brand-navy border-brand-navy text-white shadow-sm"
                                                        : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300"
                                                )}
                                            >
                                                {mins}분
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 mb-1.5">타임 간 휴식 시간</label>
                                    <div className="grid grid-cols-3 gap-1">
                                        {[0, 5, 10, 15, 20, 30].map((mins) => (
                                            <button
                                                key={mins}
                                                type="button"
                                                onClick={() => setScBreak(mins)}
                                                className={cn(
                                                    "py-1.5 rounded-lg text-xs font-bold border transition-all",
                                                    scBreak === mins
                                                        ? "bg-brand-navy border-brand-navy text-white shadow-sm"
                                                        : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300"
                                                )}
                                            >
                                                {mins}분
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* 5. Live Slot Preview & Toggle Excluded Slots */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-xs font-bold text-zinc-500">
                                        생성된 타임 미리보기 ({scPreviewSlots.length - scDisabledSlots.length}개 활성)
                                    </label>
                                    <span className="text-[11px] text-zinc-400">클릭하여 특정 타임 제외/복구</span>
                                </div>
                                {scPreviewSlots.length === 0 ? (
                                    <p className="text-xs text-zinc-400 py-3 text-center border border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl">
                                        생성된 타임이 없습니다. 운영 시간과 수업 시간을 확인해주세요.
                                    </p>
                                ) : (
                                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 max-h-40 overflow-y-auto p-1">
                                        {scPreviewSlots.map((slot) => {
                                            const isDisabled = scDisabledSlots.includes(slot.start);
                                            return (
                                                <button
                                                    key={slot.key}
                                                    type="button"
                                                    onClick={() => {
                                                        setScDisabledSlots((prev) =>
                                                            prev.includes(slot.start)
                                                                ? prev.filter((s) => s !== slot.start)
                                                                : [...prev, slot.start]
                                                        );
                                                    }}
                                                    className={cn(
                                                        "py-1.5 px-1 rounded-lg text-[11px] font-semibold border transition-all text-center",
                                                        isDisabled
                                                            ? "bg-zinc-100 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-800 text-zinc-400 line-through"
                                                            : "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                                                    )}
                                                    title={`${slot.start}~${slot.end}`}
                                                >
                                                    {slot.start}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* 6. Existing Saved Configs for this Coach */}
                            {slotConfigs.filter((c) => c.coachName === scCoachName).length > 0 && (
                                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                                    <label className="block text-xs font-bold text-zinc-500 mb-1.5">
                                        {scCoachName} 코치 저장된 설정
                                    </label>
                                    <div className="space-y-1.5 max-h-28 overflow-y-auto">
                                        {slotConfigs
                                            .filter((c) => c.coachName === scCoachName)
                                            .map((cfg) => (
                                                <div
                                                    key={cfg.id}
                                                    className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-xs"
                                                >
                                                    <div className="min-w-0 truncate">
                                                        <span className="font-bold text-zinc-800 dark:text-zinc-200">
                                                            {cfg.month === "default" ? "기본 설정" : cfg.month}
                                                        </span>
                                                        <span className="text-zinc-500 ml-2">
                                                            {cfg.durationMinutes}분 (휴식 {cfg.breakMinutes}분)
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteSlotConfig(cfg.id)}
                                                        className="text-red-500 hover:text-red-700 p-1 shrink-0"
                                                        title="설정 삭제"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}

                            {/* Buttons */}
                            <div className="flex items-center gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                                <button
                                    type="button"
                                    onClick={() => setIsSlotConfigModalOpen(false)}
                                    className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-600 dark:text-zinc-300"
                                >
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingSc}
                                    className="flex-1 py-2.5 rounded-xl bg-brand-navy text-white text-xs font-bold shadow hover:bg-brand-navy/90 transition-all disabled:opacity-50"
                                >
                                    {isSubmittingSc ? "저장 중..." : "저장하기"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── MODAL 2: 신규 예약 등록 팝업 (연동) ── */}
            <ScheduleEventDialog
                isOpen={isScheduleDialogOpen}
                onClose={() => setIsScheduleDialogOpen(false)}
                onSave={async (newEvent) => {
                    await saveEvent({
                        ...newEvent,
                        id: crypto.randomUUID(),
                    });
                    setIsScheduleDialogOpen(false);
                    await loadSchedules();
                }}
                initialDate={dialogInitialDate}
                currentCoachName={selectedCoachName}
                currentRole={currentRole === "athlete" ? "athlete" : "coach"}
                currentUserName={currentUserName}
                currentUserBranch={currentUserBranch}
            />
        </div>
    );
}
