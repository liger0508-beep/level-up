"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  BarChart3,
  ArrowLeft,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  ClipboardCheck,
  Search,
  Calendar as CalendarIcon,
  X,
} from "lucide-react";
import { cn, getKstDateStr } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  fetchAttendance,
  checkInAthlete,
  deleteAttendance,
  AttendanceRecord,
} from "@/lib/attendance-sync";
import { getStoredTournaments } from "@/lib/tournament-sync";
import {
  format,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  addDays,
  subDays,
} from "date-fns";
import { ko } from "date-fns/locale";

const BRANCHES = ["조이마루점", "구미점"];

type BranchFilter = "all" | "조이마루점" | "구미점";
type CoachScope = "all" | "assigned" | "by_coach";

export default function AttendancePage() {
  const supabase = createClient();

  // Auth & Role
  const [authLoaded, setAuthLoaded] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [targetAthleteId, setTargetAthleteId] = useState<string | null>(null);
  const [targetAthleteName, setTargetAthleteName] = useState<string>("");
  const [assignedAthleteIds, setAssignedAthleteIds] = useState<string[]>([]);
  const [coachesList, setCoachesList] = useState<{ id: string; name: string; branch?: string }[]>([]);
  const [allAssignments, setAllAssignments] = useState<{ coach_id: string; athlete_id: string }[]>([]);
  const [selectedCoachIds, setSelectedCoachIds] = useState<string[]>([]);
  const [coachDropdownOpen, setCoachDropdownOpen] = useState(false);
  const coachDropdownRef = useRef<HTMLDivElement | null>(null);

  // Shared Navigation & Filters
  const [activeTab, setActiveTab] = useState<"daily" | "stats">("daily");
  const [selectedDate, setSelectedDate] = useState(() => getKstDateStr());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [coachScope, setCoachScope] = useState<CoachScope>("all");
  const [branchFilter, setBranchFilter] = useState<BranchFilter>("all");
  const [statusFilter, setStatusFilter] = useState<"checked" | "unchecked">("checked");
  const [searchQuery, setSearchQuery] = useState("");

  // Data
  const [allAthletes, setAllAthletes] = useState<any[]>([]);
  const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [statsTournaments, setStatsTournaments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Detail modal for monthly athlete click
  const [detailAthlete, setDetailAthlete] = useState<{
    id: string;
    name: string;
    records: any[];
  } | null>(null);

  const isAthleteOrParent = userRole === "athlete" || userRole === "parent";
  const isSuperAdmin =
    userRole === "admin" ||
    userRole === "super_admin" ||
    userRole === "superadmin" ||
    userName === "슈퍼관리자";
  const canUseCoachScope = userRole === "coach" || isSuperAdmin;

  useEffect(() => {
    async function initUser() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setAuthLoaded(true);
          return;
        }

        const { data: profile } = await supabase
          .from("users")
          .select("id, role, name, branch")
          .eq("id", user.id)
          .maybeSingle();

        const role = profile?.role || "athlete";
        setUserRole(role);
        setUserName(profile?.name || "");

        if (role === "athlete") {
          setTargetAthleteId(user.id);
          setTargetAthleteName(profile?.name || "");
        } else if (role === "parent") {
          const match = profile?.name?.match(/^(.*?) \(/);
          const childName = match ? match[1] : profile?.name || "";
          setTargetAthleteName(childName);
          if (childName) {
            const { data: child } = await supabase
              .from("users")
              .select("id, name")
              .eq("role", "athlete")
              .eq("name", childName)
              .maybeSingle();
            if (child) setTargetAthleteId(child.id);
          }
        } else {
          // Coach or admin/office/headquarter
          const [{ data: assignmentsData }, { data: coachesData }, { data: athletesData }] =
            await Promise.all([
              supabase.from("coach_athlete_assignments").select("coach_id, athlete_id"),
              supabase
                .from("users")
                .select("id, name, branch")
                .eq("role", "coach")
                .order("name"),
              supabase
                .from("users")
                .select("id, name, branch, phone")
                .eq("role", "athlete")
                .eq("status", "등록")
                .order("name"),
            ]);

          const safeAssignments = (assignmentsData || []).filter(
            (a: any) => a.coach_id && a.athlete_id
          );
          setAllAssignments(safeAssignments);

          if (coachesData) {
            setCoachesList(
              coachesData.filter(
                (c: any) => c.name !== "슈퍼관리자" && c.name !== "전체 관리자"
              )
            );
          }

          if (role === "coach") {
            const myIds = safeAssignments
              .filter((a: any) => a.coach_id === user.id)
              .map((a: any) => a.athlete_id);
            setAssignedAthleteIds(myIds);
            setCoachScope("assigned");
          } else {
            setCoachScope("all");
          }

          if (athletesData) setAllAthletes(athletesData);
        }
      } catch (err) {
        console.error("Failed to initialize attendance page:", err);
      } finally {
        setAuthLoaded(true);
      }
    }
    initUser();
  }, []);

  // Load daily attendance (for coach/admin or athlete today check)
  useEffect(() => {
    if (!authLoaded) return;
    loadDailyData();
  }, [authLoaded, selectedDate, branchFilter, targetAthleteId]);

  // Load monthly attendance (for stats tab or athlete/parent view)
  useEffect(() => {
    if (!authLoaded) return;
    if (isAthleteOrParent || activeTab === "stats") {
      loadStatsData();
    }
  }, [authLoaded, activeTab, currentMonth, isAthleteOrParent, targetAthleteId]);

  async function loadDailyData() {
    setIsLoading(true);
    try {
      const data = await fetchAttendance(selectedDate, branchFilter);
      setAttendanceList(data);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadStatsData() {
    setIsLoading(true);
    try {
      const start = getKstDateStr(startOfMonth(currentMonth));
      const end = getKstDateStr(endOfMonth(currentMonth));

      let query = supabase
        .from("attendance")
        .select("*")
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: false });

      if (isAthleteOrParent && targetAthleteId) {
        query = query.eq("athlete_id", targetAthleteId);
      }

      const [{ data: attData }, tourData] = await Promise.all([
        query,
        getStoredTournaments(),
      ]);

      setMonthlyData(attData || []);
      setStatsTournaments(tourData);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCheckIn(athleteId: string, athleteName: string, athleteBranch?: string) {
    const branchToUse =
      branchFilter !== "all"
        ? branchFilter
        : athleteBranch && BRANCHES.includes(athleteBranch)
        ? athleteBranch
        : "조이마루점";

    if (!confirm(`${athleteName} 선수를 ${branchToUse} 출석 처리 하시겠습니까?`)) return;
    try {
      const res = await checkInAthlete(athleteId, branchToUse);
      if (res.success) {
        await loadDailyData();
        if (activeTab === "stats") await loadStatsData();
      } else {
        alert(res.message);
      }
    } catch {
      alert("출석 체크에 실패했습니다.");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("출석 기록을 삭제하시겠습니까?")) return;
    try {
      await deleteAttendance(id);
      await loadDailyData();
      if (activeTab === "stats") await loadStatsData();
    } catch {
      alert("삭제에 실패했습니다.");
    }
  }

  const moveDate = (delta: number) => {
    const base = new Date(`${selectedDate}T12:00:00+09:00`);
    const next = delta > 0 ? addDays(base, delta) : subDays(base, Math.abs(delta));
    setSelectedDate(getKstDateStr(next));
  };

  // Close coach multi-select dropdown on outside click
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (
        coachDropdownRef.current &&
        !coachDropdownRef.current.contains(e.target as Node)
      ) {
        setCoachDropdownOpen(false);
      }
    }
    if (coachDropdownOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
      return () => document.removeEventListener("mousedown", handleOutsideClick);
    }
  }, [coachDropdownOpen]);

  const byCoachAthleteIdSet = useMemo(() => {
    if (selectedCoachIds.length === 0) return new Set<string>();
    const selectedSet = new Set(selectedCoachIds);
    return new Set(
      allAssignments
        .filter((a) => selectedSet.has(a.coach_id))
        .map((a) => a.athlete_id)
    );
  }, [allAssignments, selectedCoachIds]);

  // Athletes visible under current coachScope + branchFilter (for coach/admin)
  const scopedAthletes = useMemo(() => {
    return allAthletes.filter((a) => {
      if (canUseCoachScope && coachScope === "assigned") {
        if (!assignedAthleteIds.includes(a.id)) return false;
      } else if (coachScope === "by_coach") {
        if (!byCoachAthleteIdSet.has(a.id)) return false;
      }
      if (branchFilter !== "all" && a.branch !== branchFilter) {
        return false;
      }
      return true;
    });
  }, [
    allAthletes,
    canUseCoachScope,
    coachScope,
    branchFilter,
    assignedAthleteIds,
    byCoachAthleteIdSet,
  ]);

  const scopedAthleteIdSet = useMemo(
    () => new Set(scopedAthletes.map((a) => a.id)),
    [scopedAthletes]
  );

  // Daily checked & unchecked filtered by scope + search
  const filteredAttendanceList = useMemo(() => {
    const q = searchQuery.trim();
    return attendanceList.filter((att) => {
      if (!scopedAthleteIdSet.has(att.athlete_id)) {
        return false;
      }
      if (q && !att.athlete_name.includes(q)) return false;
      return true;
    });
  }, [attendanceList, scopedAthleteIdSet, searchQuery]);

  const uncheckedAthletes = useMemo(() => {
    const q = searchQuery.trim();
    return scopedAthletes.filter((a) => {
      const alreadyChecked = attendanceList.some((att) => att.athlete_id === a.id);
      if (alreadyChecked) return false;
      if (q && !a.name.includes(q)) return false;
      return true;
    });
  }, [scopedAthletes, attendanceList, searchQuery]);

  // Monthly stats list (for coach/admin)
  const statsList = useMemo(() => {
    const daysInMonth = endOfMonth(currentMonth).getDate();
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;
    const q = searchQuery.trim();

    return scopedAthletes
      .filter((a) => !q || a.name.includes(q))
      .map((athlete) => {
        const athleteAttendance = monthlyData.filter((d) => d.athlete_id === athlete.id);
        const attendanceDays = new Set(athleteAttendance.map((d) => d.date)).size;

        let avgTime = "-";
        if (athleteAttendance.length > 0) {
          const totalMinutes = athleteAttendance.reduce((acc, curr) => {
            const kstTime = new Date(curr.check_in_at).toLocaleTimeString("en-GB", {
              timeZone: "Asia/Seoul",
              hour: "2-digit",
              minute: "2-digit",
            });
            const [hh, mm] = kstTime.split(":").map(Number);
            return acc + (hh * 60 + mm);
          }, 0);
          const avgMinutes = Math.round(totalMinutes / athleteAttendance.length);
          avgTime = `${String(Math.floor(avgMinutes / 60)).padStart(2, "0")}:${String(
            avgMinutes % 60
          ).padStart(2, "0")}`;
        }

        let tournamentDays = 0;
        statsTournaments.forEach((t) => {
          if (t.year === year && t.players?.includes(athlete.name)) {
            const parts = t.date.split(" ~ ");
            if (parts.length === 2) {
              const [m1, d1] = parts[0].split("-").map(Number);
              const [m2, d2] = parts[1].split("-").map(Number);
              if (m1 === month || m2 === month) {
                const startDay = m1 === month ? d1 : 1;
                const endDay = m2 === month ? d2 : daysInMonth;
                tournamentDays += endDay - startDay + 1;
              }
            } else {
              const [m] = t.date.split("-").map(Number);
              if (m === month) tournamentDays += 1;
            }
          }
        });

        const rate = Math.round(((attendanceDays + tournamentDays) / daysInMonth) * 100);

        return {
          ...athlete,
          attendanceDays,
          avgTime,
          tournamentDays,
          rate,
          records: athleteAttendance,
        };
      });
  }, [scopedAthletes, monthlyData, statsTournaments, currentMonth, searchQuery]);

  // Athlete/Parent personal monthly summary
  const myTodayRecord = useMemo(() => {
    if (!targetAthleteId) return null;
    return attendanceList.find((a) => a.athlete_id === targetAthleteId) || null;
  }, [attendanceList, targetAthleteId]);

  const myMonthlySummary = useMemo(() => {
    const daysInMonth = endOfMonth(currentMonth).getDate();
    const myRecords = monthlyData.filter(
      (d) => !targetAthleteId || d.athlete_id === targetAthleteId
    );
    const days = new Set(myRecords.map((d) => d.date)).size;
    let avgTime = "-";
    if (myRecords.length > 0) {
      const totalMinutes = myRecords.reduce((acc, curr) => {
        const kstTime = new Date(curr.check_in_at).toLocaleTimeString("en-GB", {
          timeZone: "Asia/Seoul",
          hour: "2-digit",
          minute: "2-digit",
        });
        const [hh, mm] = kstTime.split(":").map(Number);
        return acc + (hh * 60 + mm);
      }, 0);
      const avgMinutes = Math.round(totalMinutes / myRecords.length);
      avgTime = `${String(Math.floor(avgMinutes / 60)).padStart(2, "0")}:${String(
        avgMinutes % 60
      ).padStart(2, "0")}`;
    }
    const rate = Math.round((days / daysInMonth) * 100);
    return { days, avgTime, rate, records: myRecords };
  }, [monthlyData, currentMonth, targetAthleteId]);

  const formattedSelectedDate = useMemo(() => {
    const d = new Date(`${selectedDate}T12:00:00+09:00`);
    return format(d, "yyyy. MM. dd (EEE)", { locale: ko });
  }, [selectedDate]);

  const selectedCoachesLabel = useMemo(() => {
    if (selectedCoachIds.length === 0) return "코치 선택";
    const names = coachesList
      .filter((c) => selectedCoachIds.includes(c.id))
      .map((c) => c.name);
    if (names.length === 1) return `${names[0]} 코치`;
    return `${names[0]} 외 ${names.length - 1}명`;
  }, [coachesList, selectedCoachIds]);

  if (!authLoaded) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-navy border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Athlete / Parent Personal View ──
  if (isAthleteOrParent) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-24">
        <main className="max-w-5xl mx-auto px-4 sm:px-8 py-10 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <ClipboardCheck size={24} className="text-brand-navy dark:text-brand-navy-light shrink-0" />
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
                내 출석 현황
              </h1>
            </div>
            {targetAthleteName && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-brand-navy/10 text-brand-navy dark:bg-brand-navy/25 dark:text-zinc-200">
                {targetAthleteName}
              </span>
            )}
          </div>

          {/* Today Status Card */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 flex items-center justify-between gap-4 shadow-sm">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-zinc-400">
                오늘 ({format(new Date(), "yyyy. MM. dd (EEE)", { locale: ko })})
              </p>
              {myTodayRecord ? (
                <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 size={18} />
                  출석 완료 ·{" "}
                  {new Date(myTodayRecord.check_in_at).toLocaleTimeString("en-GB", {
                    timeZone: "Asia/Seoul",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  ({myTodayRecord.branch})
                </p>
              ) : (
                <p className="text-base font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <XCircle size={18} className="text-zinc-400" />
                  오늘 출석 기록이 없습니다.
                </p>
              )}
            </div>
          </div>

          {/* Month Navigation */}
          <div className="flex items-center justify-center gap-4 py-1">
            <button
              type="button"
              onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
              className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-2.5">
              <span className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                {format(currentMonth, "yyyy년 M월", { locale: ko })}
              </span>
              <button
                type="button"
                onClick={() => setCurrentMonth(new Date())}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50"
              >
                이번 달
              </button>
            </div>
            <button
              type="button"
              onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
              className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* 3 Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 p-4 text-center">
              <p className="text-2xl font-black text-brand-navy dark:text-zinc-100">
                {myMonthlySummary.days}일
              </p>
              <p className="text-xs font-medium text-zinc-500 mt-1">총 출석일</p>
            </div>
            <div className="rounded-2xl border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 p-4 text-center">
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {myMonthlySummary.avgTime}
              </p>
              <p className="text-xs font-medium text-zinc-500 mt-1">평균 출석 시간</p>
            </div>
            <div className="rounded-2xl border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 p-4 text-center">
              <p className="text-2xl font-black text-zinc-900 dark:text-zinc-100">
                {myMonthlySummary.rate}%
              </p>
              <p className="text-xs font-medium text-zinc-500 mt-1">출석률</p>
            </div>
          </div>

          {/* My Monthly Attendance List */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                월별 출석 기록
              </span>
              <span className="text-xs text-zinc-400">{myMonthlySummary.records.length}건</span>
            </div>
            {myMonthlySummary.records.length === 0 ? (
              <div className="py-14 text-center text-sm text-zinc-400">
                해당 월에 출석 기록이 없습니다.
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {myMonthlySummary.records.map((rec: any) => (
                  <div
                    key={rec.id}
                    className="px-5 py-3.5 flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {rec.date}
                      </span>
                      <span className="text-xs text-zinc-500">{rec.branch}</span>
                    </div>
                    <span className="text-xs font-medium text-zinc-500">
                      {new Date(rec.check_in_at).toLocaleTimeString("en-GB", {
                        timeZone: "Asia/Seoul",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      출석
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  // ── Coach / Admin View (Lounge UI Style) ──
  const branchTabs: { key: BranchFilter; label: string }[] = [
    { key: "all", label: "전체" },
    { key: "조이마루점", label: "조이마루점" },
    { key: "구미점", label: "구미점" },
  ];

  const toggleCoachSelection = (coachId: string) => {
    setSelectedCoachIds((prev) =>
      prev.includes(coachId)
        ? prev.filter((id) => id !== coachId)
        : [...prev, coachId]
    );
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-24">
      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-10 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ClipboardCheck size={24} className="text-brand-navy dark:text-brand-navy-light shrink-0" />
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
              {activeTab === "daily" ? "출석 체크" : "월별 통계"}
            </h1>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab((prev) => (prev === "daily" ? "stats" : "daily"))}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-100 text-xs sm:text-sm font-semibold px-3.5 py-2 shadow-sm transition-colors cursor-pointer"
          >
            {activeTab === "daily" ? (
              <>
                <BarChart3 size={15} />
                월별 통계
              </>
            ) : (
              <>
                <ArrowLeft size={15} />
                일일 출석
              </>
            )}
          </button>
        </div>

        {/* Row 1 (Top): Branch Pills | Row 2 (Below): Aligned Scope Toggle + Coach Multi-Select */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="inline-flex flex-col gap-2.5 w-fit">
            {/* Row 1: Branch Pills (same component style as Schedule) */}
            <div className="flex flex-nowrap justify-start items-center gap-1.5 overflow-x-auto scrollbar-hide">
              {branchTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setBranchFilter(tab.key)}
                  className={cn(
                    "flex items-center gap-1 px-4 py-2 rounded-full text-sm font-semibold border transition-all duration-200 shrink-0 cursor-pointer",
                    branchFilter === tab.key
                      ? "bg-brand-navy text-white border-brand-navy shadow-md"
                      : "bg-white text-zinc-600 border-zinc-200 hover:bg-brand-navy-light hover:text-brand-navy dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 dark:hover:bg-brand-navy-dark dark:hover:text-white"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Row 2: All / Assigned / By Coach (exact left & right alignment with Row 1) */}
            <div
              className={cn(
                "w-full grid rounded-xl bg-zinc-200/80 dark:bg-zinc-800 p-1 text-xs sm:text-sm font-semibold",
                canUseCoachScope ? "grid-cols-3" : "grid-cols-2"
              )}
            >
              <button
                type="button"
                onClick={() => {
                  setCoachScope("all");
                  setCoachDropdownOpen(false);
                }}
                className={cn(
                  "whitespace-nowrap py-1.5 rounded-lg transition-all cursor-pointer text-center",
                  coachScope === "all"
                    ? "bg-brand-navy text-white shadow-sm"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                )}
              >
                전체
              </button>
              {canUseCoachScope && (
                <button
                  type="button"
                  onClick={() => {
                    setCoachScope("assigned");
                    setCoachDropdownOpen(false);
                  }}
                  className={cn(
                    "whitespace-nowrap py-1.5 rounded-lg transition-all cursor-pointer text-center",
                    coachScope === "assigned"
                      ? "bg-brand-navy text-white shadow-sm"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                  )}
                >
                  담당
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setCoachScope("by_coach");
                  if (selectedCoachIds.length === 0) {
                    setCoachDropdownOpen(true);
                  }
                }}
                className={cn(
                  "whitespace-nowrap py-1.5 rounded-lg transition-all cursor-pointer text-center",
                  coachScope === "by_coach"
                    ? "bg-brand-navy text-white shadow-sm"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                )}
              >
                코치별
              </button>
            </div>
          </div>

          {coachScope === "by_coach" && (
            <div className="relative" ref={coachDropdownRef}>
              <button
                type="button"
                onClick={() => setCoachDropdownOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-xs sm:text-sm font-semibold text-zinc-800 dark:text-zinc-100 shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <span>{selectedCoachesLabel}</span>
                <ChevronDown
                  size={14}
                  className={cn(
                    "text-zinc-400 transition-transform",
                    coachDropdownOpen && "rotate-180"
                  )}
                />
              </button>

              {coachDropdownOpen && (
                <div className="absolute left-0 mt-1.5 w-56 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-lg z-30 py-1.5">
                  <div className="px-3 py-1.5 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800">
                    <span className="text-[11px] font-semibold text-zinc-400">
                      코치 중복 선택
                    </span>
                    {selectedCoachIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedCoachIds([])}
                        className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
                      >
                        선택 해제
                      </button>
                    )}
                  </div>
                  <div className="max-h-60 overflow-y-auto py-1">
                    {coachesList.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-zinc-400">
                        등록된 코치가 없습니다.
                      </p>
                    ) : (
                      coachesList.map((coach) => {
                        const checked = selectedCoachIds.includes(coach.id);
                        return (
                          <button
                            key={coach.id}
                            type="button"
                            onClick={() => toggleCoachSelection(coach.id)}
                            className="w-full px-3 py-2 flex items-center justify-between gap-2 text-left text-xs sm:text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/70 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={cn(
                                  "w-4 h-4 rounded flex items-center justify-center border shrink-0 transition-colors",
                                  checked
                                    ? "bg-brand-navy border-brand-navy text-white"
                                    : "border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800"
                                )}
                              >
                                {checked && <Check size={11} strokeWidth={3} />}
                              </span>
                              <span className="font-medium text-zinc-800 dark:text-zinc-100 truncate">
                                {coach.name}
                              </span>
                            </div>
                            {coach.branch && (
                              <span className="text-[11px] text-zinc-400 shrink-0">
                                {coach.branch}
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Date / Month Navigation */}
        {activeTab === "daily" ? (
          <div className="flex items-center justify-center gap-3 py-1">
            <button
              type="button"
              onClick={() => moveDate(-1)}
              className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="이전 날짜"
            >
              <ChevronLeft size={18} />
            </button>
            <label className="relative inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 cursor-pointer hover:border-brand-navy/40 transition-colors">
              <CalendarIcon size={15} className="text-zinc-400" />
              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {formattedSelectedDate}
              </span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </label>
            <button
              type="button"
              onClick={() => setSelectedDate(getKstDateStr())}
              className="px-3 py-2 rounded-xl text-xs font-semibold border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50"
            >
              오늘
            </button>
            <button
              type="button"
              onClick={() => moveDate(1)}
              className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="다음 날짜"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3 py-1">
            <button
              type="button"
              onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
              className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="px-4 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm font-bold text-zinc-900 dark:text-zinc-100">
              {format(currentMonth, "yyyy년 M월", { locale: ko })}
            </span>
            <button
              type="button"
              onClick={() => setCurrentMonth(new Date())}
              className="px-3 py-2 rounded-xl text-xs font-semibold border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50"
            >
              이번 달
            </button>
            <button
              type="button"
              onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
              className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* Daily Summary Cards */}
        {activeTab === "daily" && (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setStatusFilter("checked")}
              className={cn(
                "rounded-2xl border p-4 text-center transition-all",
                statusFilter === "checked"
                  ? "bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/30 ring-2 ring-offset-1 ring-emerald-500/30"
                  : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
              )}
            >
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {filteredAttendanceList.length}
              </p>
              <p className="text-xs font-medium text-zinc-500 mt-1">출석 완료</p>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("unchecked")}
              className={cn(
                "rounded-2xl border p-4 text-center transition-all",
                statusFilter === "unchecked"
                  ? "bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 ring-2 ring-offset-1 ring-brand-navy/30"
                  : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
              )}
            >
              <p className="text-2xl font-black text-zinc-700 dark:text-zinc-200">
                {uncheckedAthletes.length}
              </p>
              <p className="text-xs font-medium text-zinc-500 mt-1">미출석</p>
            </button>
          </div>
        )}

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="선수 이름으로 검색..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
          />
        </div>

        {/* Content List / Table */}
        {activeTab === "daily" ? (
          statusFilter === "checked" ? (
            <>
              {/* Mobile Cards */}
              <div className="md:hidden space-y-2">
                {filteredAttendanceList.length === 0 ? (
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl py-14 text-center text-sm text-zinc-400">
                    출석한 선수가 없습니다.
                  </div>
                ) : (
                  filteredAttendanceList.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex items-center justify-between"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                            {item.athlete_name}
                          </span>
                          <span className="text-xs text-zinc-500">{item.branch}</span>
                        </div>
                        <p className="text-xs text-zinc-400 flex items-center gap-1">
                          <Clock size={12} />
                          {new Date(item.check_in_at).toLocaleTimeString("en-GB", {
                            timeZone: "Asia/Seoul",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          출석
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
                        title="출석 취소"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* PC Table */}
              <div className="hidden md:block bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-zinc-50/50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400">
                      <th className="py-2.5 px-4 font-semibold text-center w-16">번호</th>
                      <th className="py-2.5 px-4 font-semibold text-center w-28">지점</th>
                      <th className="py-2.5 px-4 font-semibold text-center">선수명</th>
                      <th className="py-2.5 px-4 font-semibold text-center w-32">출석 시간</th>
                      <th className="py-2.5 px-4 font-semibold text-center w-20">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {filteredAttendanceList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-14 text-center text-zinc-400">
                          출석한 선수가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      filteredAttendanceList.map((item, idx) => (
                        <tr
                          key={item.id}
                          className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
                        >
                          <td className="py-3.5 px-4 text-center text-zinc-500">
                            {filteredAttendanceList.length - idx}
                          </td>
                          <td className="py-3.5 px-4 text-center text-zinc-900 dark:text-zinc-100 font-semibold">
                            {item.branch}
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold text-zinc-900 dark:text-zinc-100">
                            {item.athlete_name}
                          </td>
                          <td className="py-3.5 px-4 text-center text-zinc-500">
                            {new Date(item.check_in_at).toLocaleTimeString("en-GB", {
                              timeZone: "Asia/Seoul",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleDelete(item.id)}
                              className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors"
                              title="출석 취소"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              {/* Unchecked Mobile Cards */}
              <div className="md:hidden space-y-2">
                {uncheckedAthletes.length === 0 ? (
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl py-14 text-center text-sm text-zinc-400">
                    모든 선수가 출석했습니다!
                  </div>
                ) : (
                  uncheckedAthletes.map((athlete) => (
                    <div
                      key={athlete.id}
                      className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          {athlete.name}
                        </p>
                        <p className="text-xs text-zinc-400">{athlete.branch || "미지정"}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCheckIn(athlete.id, athlete.name, athlete.branch)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-brand-navy text-white text-xs font-semibold hover:bg-brand-navy/90 transition-colors"
                      >
                        <Plus size={14} />
                        출석
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Unchecked PC Table */}
              <div className="hidden md:block bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-zinc-50/50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400">
                      <th className="py-2.5 px-4 font-semibold text-center w-16">번호</th>
                      <th className="py-2.5 px-4 font-semibold text-center w-28">지점</th>
                      <th className="py-2.5 px-4 font-semibold text-center">선수명</th>
                      <th className="py-2.5 px-4 font-semibold text-center w-28">처리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {uncheckedAthletes.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-14 text-center text-zinc-400">
                          모든 선수가 출석했습니다!
                        </td>
                      </tr>
                    ) : (
                      uncheckedAthletes.map((athlete, idx) => (
                        <tr
                          key={athlete.id}
                          className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
                        >
                          <td className="py-3.5 px-4 text-center text-zinc-500">{idx + 1}</td>
                          <td className="py-3.5 px-4 text-center text-zinc-900 dark:text-zinc-100 font-semibold">
                            {athlete.branch || "미지정"}
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold text-zinc-900 dark:text-zinc-100">
                            {athlete.name}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleCheckIn(athlete.id, athlete.name, athlete.branch)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-navy text-white text-xs font-semibold hover:bg-brand-navy/90 transition-colors"
                            >
                              <Plus size={13} />
                              출석
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )
        ) : (
          /* Monthly Stats View */
          <>
            {/* Mobile Cards */}
            <div className="md:hidden space-y-2">
              {statsList.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl py-14 text-center text-sm text-zinc-400">
                  선수가 없습니다.
                </div>
              ) : (
                statsList.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      setDetailAthlete({
                        id: item.id,
                        name: item.name,
                        records: item.records,
                      })
                    }
                    className="w-full text-left bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex items-center justify-between hover:border-brand-navy/40 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          {item.name}
                        </span>
                        <span className="text-xs text-zinc-500">{item.branch || "미지정"}</span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">
                        출석 {item.attendanceDays}일 · 평균 {item.avgTime}
                      </p>
                    </div>
                    <span className="text-sm font-black text-brand-navy dark:text-zinc-100">
                      {item.rate}%
                    </span>
                  </button>
                ))
              )}
            </div>

            {/* PC Table */}
            <div className="hidden md:block bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-50/50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400">
                    <th className="py-2.5 px-4 font-semibold text-center w-16">번호</th>
                    <th className="py-2.5 px-4 font-semibold text-center w-28">지점</th>
                    <th className="py-2.5 px-4 font-semibold text-center">선수명</th>
                    <th className="py-2.5 px-4 font-semibold text-center w-24">출석일</th>
                    <th className="py-2.5 px-4 font-semibold text-center w-24">대회일</th>
                    <th className="py-2.5 px-4 font-semibold text-center w-28">평균 시간</th>
                    <th className="py-2.5 px-4 font-semibold text-center w-24">출석률</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {statsList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-14 text-center text-zinc-400">
                        선수가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    statsList.map((item, idx) => (
                      <tr
                        key={item.id}
                        onClick={() =>
                          setDetailAthlete({
                            id: item.id,
                            name: item.name,
                            records: item.records,
                          })
                        }
                        className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                      >
                        <td className="py-3.5 px-4 text-center text-zinc-500">{idx + 1}</td>
                        <td className="py-3.5 px-4 text-center text-zinc-900 dark:text-zinc-100 font-semibold">
                          {item.branch || "미지정"}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-zinc-900 dark:text-zinc-100">
                          {item.name}
                        </td>
                        <td className="py-3.5 px-4 text-center text-zinc-700 dark:text-zinc-300 font-semibold">
                          {item.attendanceDays}일
                        </td>
                        <td className="py-3.5 px-4 text-center text-zinc-500">
                          {item.tournamentDays}일
                        </td>
                        <td className="py-3.5 px-4 text-center text-zinc-500">{item.avgTime}</td>
                        <td className="py-3.5 px-4 text-center font-bold text-brand-navy dark:text-zinc-100">
                          {item.rate}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      {/* Athlete Monthly Attendance Detail Modal */}
      {detailAthlete && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setDetailAthlete(null)}
        >
          <div
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  {detailAthlete.name} · {format(currentMonth, "yyyy년 M월", { locale: ko })}
                </h3>
                <p className="text-xs text-zinc-400">
                  출석 기록 {detailAthlete.records.length}건
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailAthlete(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
              {detailAthlete.records.length === 0 ? (
                <div className="py-12 text-center text-sm text-zinc-400">
                  해당 월에 출석 기록이 없습니다.
                </div>
              ) : (
                detailAthlete.records.map((rec: any) => (
                  <div
                    key={rec.id}
                    className="px-5 py-3 flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 size={15} className="text-emerald-500" />
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {rec.date}
                      </span>
                      <span className="text-xs text-zinc-400">{rec.branch}</span>
                    </div>
                    <span className="text-xs text-zinc-500">
                      {new Date(rec.check_in_at).toLocaleTimeString("en-GB", {
                        timeZone: "Asia/Seoul",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
