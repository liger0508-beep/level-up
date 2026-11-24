"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Delete,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Building2,
  Check,
  User,
} from "lucide-react";
import { cn, getKstDateStr } from "@/lib/utils";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { QRCodeSVG } from "qrcode.react";

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
  const [origin, setOrigin] = useState("");
  const [dailyQr, setDailyQr] = useState<{ date: string; token: string } | null>(null);

  const todayKst = getKstDateStr(currentTime);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (initialBranch && BRANCHES.includes(initialBranch)) {
      setSelectedBranch(initialBranch);
    }
  }, [initialBranch]);

  useEffect(() => {
    let active = true;
    fetch(`/api/kiosk/qr?branch=${encodeURIComponent(selectedBranch)}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (active && data?.token && data?.date) {
          setDailyQr({ date: data.date, token: data.token });
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [selectedBranch, todayKst]);

  const qrValue = dailyQr
    ? `${origin}/attendance/scan?branch=${encodeURIComponent(selectedBranch)}&date=${encodeURIComponent(dailyQr.date)}&token=${encodeURIComponent(dailyQr.token)}`
    : `${origin}/attendance/scan?branch=${encodeURIComponent(selectedBranch)}`;

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
    <div className="min-h-screen bg-white text-zinc-900 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-6 sm:p-8 flex items-start justify-between border-b border-zinc-200 bg-white/95 backdrop-blur-md sticky top-0 z-10">
        <div className="flex flex-col gap-5">
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

        <div className="flex items-start gap-8">
          <div className="flex flex-col items-end gap-4">
            <div className="text-right">
              <p className="text-3xl sm:text-4xl font-black tracking-tighter leading-none text-zinc-900">
                {format(currentTime, "HH:mm:ss")}
              </p>
              <p className="text-xs text-zinc-500 font-bold mt-1 uppercase">
                {format(currentTime, "yyyy. MM. dd (EEEE)", { locale: ko })}
              </p>
            </div>

            <div className="bg-white p-2.5 rounded-2xl border border-zinc-200 shadow-lg shadow-zinc-200/60 group transition-transform hover:scale-105 active:scale-95 cursor-pointer">
              <QRCodeSVG value={qrValue} size={100} level="H" includeMargin={false} />
              <div className="mt-1.5 text-center">
                <p className="text-[9px] font-black text-brand-navy leading-none">SCAN QR</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto w-full px-8 py-10">
        <div className="text-center mb-8 space-y-2">
          <p className="text-zinc-500 font-medium text-sm">
            전화번호 뒷자리 4자리 입력 또는 QR 스캔으로 출석해 주세요.
          </p>
        </div>

        {/* Branch Selection */}
        <div className="w-full flex p-1.5 bg-zinc-100 rounded-2xl border border-zinc-200 mb-8">
          {BRANCHES.map((b) => (
            <button
              key={b}
              onClick={() => setSelectedBranch(b)}
              className={cn(
                "flex-1 py-4 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2",
                selectedBranch === b
                  ? "bg-brand-navy text-white shadow-lg shadow-brand-navy/20 scale-[1.02]"
                  : "text-zinc-500 hover:text-zinc-900"
              )}
            >
              <Building2 size={18} />
              {b}
            </button>
          ))}
        </div>

        <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Phone Display */}
          <div
            className={cn(
              "w-full min-h-[6rem] bg-zinc-50 rounded-3xl border-2 flex items-center justify-center mb-8 transition-all duration-300 overflow-hidden",
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
          <div className="w-full grid grid-cols-3 gap-4">
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
      </div>
    </div>
  );
}
