"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Delete,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Building2,
  Check,
  User,
  Users,
} from "lucide-react";
import { cn, getKstDateStr } from "@/lib/utils";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

const BRANCHES = ["조이마루점", "구미점"];

interface AttendanceKioskViewProps {
  showBackButton?: boolean;
}

export function AttendanceKioskView({ showBackButton = true }: AttendanceKioskViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialBranch = searchParams.get("branch");

  const [selectedBranch, setSelectedBranch] = useState(
    initialBranch && BRANCHES.includes(initialBranch) ? initialBranch : "조이마루점"
  );
  const [phoneNumber, setPhoneNumber] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error" | "select">("idle");
  const [message, setMessage] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [matches, setMatches] = useState<{ id: string; name: string }[]>([]);
  const [attendees, setAttendees] = useState<{ id: string; name: string; check_in_at: string }[]>([]);

  const todayKst = getKstDateStr(currentTime);

  const loadAttendees = useCallback(async (branch: string) => {
    try {
      const res = await fetch(`/api/kiosk/checkin?branch=${encodeURIComponent(branch)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (Array.isArray(data?.attendees)) {
        setAttendees(data.attendees);
      }
    } catch {
      // ignore transient network errors
    }
  }, []);

  useEffect(() => {
    loadAttendees(selectedBranch);
    const interval = setInterval(() => loadAttendees(selectedBranch), 15000);
    return () => clearInterval(interval);
  }, [selectedBranch, todayKst, loadAttendees]);

  useEffect(() => {
    if (initialBranch && BRANCHES.includes(initialBranch)) {
      setSelectedBranch(initialBranch);
    }
  }, [initialBranch]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const resetAfterDelay = () => {
    setTimeout(() => {
      setPhoneNumber("");
      setStatus("idle");
    }, 3000);
  };

  const processCheckIn = async (id: string, name: string) => {
    setStatus("loading");
    try {
      const res = await fetch("/api/kiosk/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId: id, branch: selectedBranch }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus("success");
        setMessage(`${name} 선수님, 출석 완료되었습니다!`);
        loadAttendees(selectedBranch);
        resetAfterDelay();
      } else {
        setStatus("error");
        setMessage(data.message || "출석 처리에 실패했습니다.");
        resetAfterDelay();
      }
    } catch {
      setStatus("error");
      setMessage("출석 처리 중 오류가 발생했습니다.");
      resetAfterDelay();
    }
  };

  const submitPhone = async (targetPhone: string) => {
    if (targetPhone.length < 4) return;

    setStatus("loading");
    try {
      const res = await fetch(`/api/kiosk/checkin?last4=${encodeURIComponent(targetPhone)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      const athletes = data.athletes || [];

      if (athletes.length === 0) {
        setStatus("error");
        setMessage("선수를 찾을 수 없습니다.");
        resetAfterDelay();
      } else if (athletes.length === 1) {
        await processCheckIn(athletes[0].id, athletes[0].name);
      } else {
        setMatches(athletes);
        setStatus("select");
      }
    } catch {
      setStatus("error");
      setMessage("서버 오류가 발생했습니다.");
      resetAfterDelay();
    }
  };

  const handleNumberClick = (num: string) => {
    if (status !== "idle" || phoneNumber.length >= 4) return;
    const nextPhone = phoneNumber + num;
    setPhoneNumber(nextPhone);
    if (nextPhone.length === 4) {
      submitPhone(nextPhone);
    }
  };

  const handleDelete = () => {
    setPhoneNumber((prev) => prev.slice(0, -1));
    if (status === "select") setStatus("idle");
  };

  const handleSubmit = () => submitPhone(phoneNumber);

  return (
    <div className="min-h-screen bg-white text-zinc-900 flex flex-col overflow-x-hidden">
      {/* Header: Left (ATTENDANCE), Right (Time & Date) */}
      <div className="p-6 sm:p-8 flex items-end justify-between border-b border-zinc-200 bg-white/95 backdrop-blur-md sticky top-0 z-10">
        <div className="flex flex-col gap-4">
          {showBackButton && (
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 transition-colors w-fit"
            >
              <ArrowLeft size={20} />
              <span className="text-sm font-bold">종료</span>
            </button>
          )}
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tight text-brand-navy">ATTENDANCE</h1>
            <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest">
              Digital Kiosk v1.0
            </p>
          </div>
        </div>

        <div className="text-right">
          <p
            suppressHydrationWarning
            className="text-3xl sm:text-4xl font-black tracking-tighter leading-none text-zinc-900"
          >
            {format(currentTime, "HH:mm:ss")}
          </p>
          <p
            suppressHydrationWarning
            className="text-xs sm:text-sm text-zinc-500 font-bold mt-1.5 uppercase"
          >
            {format(currentTime, "yyyy. MM. dd (EEEE)", { locale: ko })}
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center max-w-4xl mx-auto w-full px-6 sm:px-8 py-8">
        {/* Centered Instruction + Full-Width Branch Selection */}
        <div className="w-full mb-8 space-y-5">
          <p className="text-center text-zinc-800 font-bold text-lg sm:text-xl leading-snug break-keep">
            전화번호 뒷자리 4자리를 입력해 주세요.
          </p>

          <div className="w-full flex p-1.5 bg-zinc-100 rounded-2xl border border-zinc-200">
            {BRANCHES.map((b) => (
              <button
                key={b}
                onClick={() => setSelectedBranch(b)}
                className={cn(
                  "flex-1 py-4 rounded-xl text-base font-black transition-all flex items-center justify-center gap-2",
                  selectedBranch === b
                    ? "bg-brand-navy text-white shadow-lg shadow-brand-navy/20 scale-[1.01]"
                    : "text-zinc-500 hover:text-zinc-900"
                )}
              >
                <Building2 size={18} />
                {b}
              </button>
            ))}
          </div>
        </div>

        {/* Left: Keypad | Right: Today's Attendees */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 items-stretch">
          {/* Left Column: Phone Display + Keypad */}
          <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Phone Display */}
            <div
              className={cn(
                "w-full min-h-[6rem] bg-zinc-50 rounded-3xl border-2 flex items-center justify-center transition-all duration-300 overflow-hidden",
                status === "success"
                  ? "border-emerald-500 bg-emerald-50"
                  : status === "error"
                  ? "border-red-500 bg-red-50"
                  : status === "select"
                  ? "border-brand-navy bg-brand-navy/5"
                  : "border-zinc-200"
              )}
            >
              {status === "select" ? (
                <div className="w-full p-4 space-y-3 animate-in fade-in zoom-in-95 duration-300">
                  <p className="text-xs font-bold text-center text-zinc-500 uppercase tracking-widest mb-2">
                    본인 이름을 선택해 주세요
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {matches.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => processCheckIn(m.id, m.name)}
                        className="flex items-center justify-between px-4 py-3 bg-white border border-zinc-200 hover:bg-brand-navy hover:text-white hover:border-brand-navy rounded-xl transition-all text-zinc-900"
                      >
                        <span className="font-bold">{m.name}</span>
                        <User size={14} className="opacity-50" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : status === "idle" || status === "loading" ? (
                <span
                  className={cn(
                    "text-5xl font-black tracking-[0.5em] ml-[0.5em]",
                    phoneNumber ? "text-zinc-900" : "text-zinc-300"
                  )}
                >
                  {phoneNumber.padEnd(4, "*")}
                </span>
              ) : (
                <div className="flex flex-col items-center animate-in zoom-in-95 duration-300 px-6 text-center">
                  {status === "success" ? (
                    <CheckCircle2 size={32} className="text-emerald-500 mb-1" />
                  ) : (
                    <XCircle size={32} className="text-red-500 mb-1" />
                  )}
                  <p
                    className={cn(
                      "text-sm font-bold",
                      status === "success" ? "text-emerald-600" : "text-red-600"
                    )}
                  >
                    {message}
                  </p>
                </div>
              )}
            </div>

            {/* Keypad */}
            <div className="w-full grid grid-cols-3 gap-3.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  onClick={() => handleNumberClick(num.toString())}
                  disabled={status !== "idle" && status !== "select"}
                  className="h-20 bg-zinc-50 hover:bg-zinc-100 active:scale-95 transition-all rounded-2xl text-2xl font-black flex items-center justify-center border border-zinc-200 text-zinc-900 shadow-sm"
                >
                  {num}
                </button>
              ))}
              <button
                onClick={handleDelete}
                disabled={status !== "idle" && status !== "select" && status !== "error"}
                className="h-20 bg-zinc-50 hover:bg-zinc-100 active:scale-95 transition-all rounded-2xl flex items-center justify-center border border-zinc-200 shadow-sm"
              >
                <Delete size={28} className="text-zinc-500" />
              </button>
              <button
                onClick={() => handleNumberClick("0")}
                disabled={status !== "idle" && status !== "select"}
                className="h-20 bg-zinc-50 hover:bg-zinc-100 active:scale-95 transition-all rounded-2xl text-2xl font-black flex items-center justify-center border border-zinc-200 text-zinc-900 shadow-sm"
              >
                0
              </button>
              <button
                onClick={handleSubmit}
                disabled={(status !== "idle" && status !== "select") || phoneNumber.length < 4}
                className={cn(
                  "h-20 rounded-2xl flex items-center justify-center transition-all active:scale-95 shadow-lg",
                  phoneNumber.length >= 4
                    ? "bg-brand-navy hover:bg-brand-navy-dark text-white shadow-brand-navy/20"
                    : "bg-zinc-100 text-zinc-300 border border-zinc-200 cursor-not-allowed shadow-none"
                )}
              >
                <Check size={32} strokeWidth={3} />
              </button>
            </div>
          </div>

          {/* Right Column: Today's Attendees (matches keypad column height + internal scroll) */}
          <div className="relative min-h-[280px] sm:min-h-0">
            <div className="sm:absolute sm:inset-0 w-full h-full rounded-3xl border border-zinc-200 bg-zinc-50/70 p-5 flex flex-col">
              <div className="flex items-center justify-between pb-3.5 border-b border-zinc-200 shrink-0">
                <div className="flex items-center gap-2">
                  <Users size={18} className="text-brand-navy" />
                  <h2 className="text-base font-black text-zinc-900">오늘 출석 명단</h2>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-brand-navy text-white text-xs font-bold">
                  {attendees.length}명
                </span>
              </div>

              {attendees.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-sm font-medium text-zinc-400">
                  아직 출석한 선수가 없습니다.
                </div>
              ) : (
                <div className="mt-3 flex-1 min-h-0 overflow-y-auto divide-y divide-zinc-200/70 pr-1">
                  {attendees.map((att) => (
                    <div
                      key={att.id}
                      className="py-3 px-1 flex items-center justify-between text-base"
                    >
                      <span className="font-bold text-zinc-900">{att.name}</span>
                      <span className="font-semibold text-zinc-500 tabular-nums">
                        {new Date(att.check_in_at).toLocaleTimeString("en-GB", {
                          timeZone: "Asia/Seoul",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
