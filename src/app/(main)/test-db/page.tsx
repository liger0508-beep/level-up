"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle2, XCircle, Loader2, Database } from "lucide-react";
import Link from "next/link";

export default function TestDBPage() {
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
    const [message, setMessage] = useState("수퍼베이스 서버에 접속 시도 중...");
    const [details, setDetails] = useState<string | null>(null);

    useEffect(() => {
        async function checkConnection() {
            try {
                const supabase = createClient();

                // 1. 단순 연결 테스트 (users 테이블 조회)
                const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true });

                if (error) {
                    setStatus("error");
                    setMessage("연결에 실패했습니다.");
                    setDetails(error.message);
                } else {
                    setStatus("success");
                    setMessage("수퍼베이스와 완벽하게 연결되었습니다!");
                    setDetails("데이터베이스 테이블('users') 접근 확인 완료");
                }
            } catch (err: any) {
                setStatus("error");
                setMessage("예기치 못한 오류가 발생했습니다.");
                setDetails(err.message);
            }
        }

        checkConnection();
    }, []);

    return (
        <div className="min-h-[80vh] flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-3xl p-8 shadow-xl border border-zinc-100 dark:border-zinc-800 text-center">
                <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Database className="text-brand-navy" size={32} />
                </div>

                <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">
                    Supabase 연결 테스트
                </h1>

                <div className="py-8">
                    {status === "loading" && (
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="animate-spin text-zinc-400" size={40} />
                            <p className="text-sm text-zinc-500">{message}</p>
                        </div>
                    )}

                    {status === "success" && (
                        <div className="flex flex-col items-center gap-3">
                            <CheckCircle2 className="text-emerald-500" size={60} />
                            <p className="text-lg font-bold text-emerald-600 underline decoration-emerald-200 underline-offset-4">{message}</p>
                            {details && <p className="text-xs text-zinc-400 mt-2">{details}</p>}
                        </div>
                    )}

                    {status === "error" && (
                        <div className="flex flex-col items-center gap-3">
                            <XCircle className="text-red-500" size={60} />
                            <p className="text-lg font-bold text-red-600">{message}</p>
                            {details && (
                                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl w-full text-left">
                                    <p className="text-xs font-mono text-red-700 dark:text-red-400 break-all">{details}</p>
                                </div>
                            )}
                            <p className="text-xs text-zinc-500 mt-4">
                                URL이나 Key 값이 정확한지, <br />
                                SQL Editor에서 테이블을 생성했는지 확인해 보세요.
                            </p>
                        </div>
                    )}
                </div>

                <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 mt-4">
                    <Link
                        href="/"
                        className="text-sm font-bold text-zinc-400 hover:text-brand-navy transition-colors"
                    >
                        홈으로 돌아가기
                    </Link>
                </div>
            </div>
        </div>
    );
}
