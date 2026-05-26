"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { checkInAthlete } from "@/lib/attendance-sync";
import { CheckCircle2, XCircle, Loader2, Home } from "lucide-react";
import Link from "next/link";

function AttendanceScanContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
    const [message, setMessage] = useState("");
    const branch = searchParams.get("branch");

    useEffect(() => {
        const processCheckIn = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                setStatus("error");
                setMessage("로그인이 필요합니다. 로그인 후 다시 스캔해주세요.");
                return;
            }

            if (!branch) {
                setStatus("error");
                setMessage("잘못된 접근입니다. 지점 정보가 없습니다.");
                return;
            }

            try {
                const res = await checkInAthlete(user.id, branch);
                if (res.success) {
                    setStatus("success");
                    setMessage(`${branch} 출석 체크가 완료되었습니다!`);
                } else {
                    setStatus("error");
                    setMessage(res.message || "이미 출석되었거나 오류가 발생했습니다.");
                }
            } catch (err) {
                console.error(err);
                setStatus("error");
                setMessage("출석 처리 중 서버 오류가 발생했습니다.");
            }
        };

        processCheckIn();
    }, [branch]);

    return (
        <div className="max-w-sm w-full bg-white dark:bg-zinc-900 rounded-[2.5rem] p-10 shadow-xl border border-zinc-100 dark:border-zinc-800 space-y-6">
            {status === "loading" && (
                <div className="flex flex-col items-center gap-4">
                    <Loader2 size={48} className="text-brand-navy animate-spin" />
                    <p className="text-sm font-bold text-zinc-500">출석 처리 중...</p>
                </div>
            )}

            {status === "success" && (
                <div className="flex flex-col items-center gap-4 animate-in zoom-in-95 duration-300">
                    <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                        <CheckCircle2 size={48} />
                    </div>
                    <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">출석 완료!</h2>
                    <p className="text-sm font-medium text-zinc-500 leading-relaxed">{message}</p>
                </div>
            )}

            {status === "error" && (
                <div className="flex flex-col items-center gap-4 animate-in zoom-in-95 duration-300">
                    <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                        <XCircle size={48} />
                    </div>
                    <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">출석 실패</h2>
                    <p className="text-sm font-medium text-zinc-500 leading-relaxed">{message}</p>
                    {!message.includes("로그인") && (
                         <button 
                            onClick={() => window.location.reload()}
                            className="text-xs font-bold text-brand-navy underline mt-2"
                         >
                            다시 시도하기
                         </button>
                    )}
                </div>
            )}

            <div className="pt-6">
                <Link 
                    href="/"
                    className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-sm font-bold text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 transition-all"
                >
                    <Home size={18} />
                    홈으로 가기
                </Link>
            </div>
        </div>
    );
}

export default function AttendanceScanPage() {
    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
            <Suspense fallback={
                <div className="max-w-sm w-full bg-white dark:bg-zinc-900 rounded-[2.5rem] p-10 shadow-xl border border-zinc-100 dark:border-zinc-800 flex flex-col items-center gap-4">
                    <Loader2 size={48} className="text-brand-navy animate-spin" />
                    <p className="text-sm font-bold text-zinc-500">잠시만 기다려주세요...</p>
                </div>
            }>
                <AttendanceScanContent />
            </Suspense>
        </div>
    );
}
