"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { ShieldAlert, ShieldCheck, RefreshCw, ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageTitle } from "@/components/ui/Typography";

export default function MyQRPage() {
    const router = useRouter();
    const [token, setToken] = useState<string>("");
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [userName, setUserName] = useState("");
    const [userBranch, setUserBranch] = useState("");

    const fetchToken = async () => {
        setIsLoading(true);
        setError("");
        try {
            const res = await fetch("/api/qr-token");
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to generate QR");
            }
            const data = await res.json();
            setToken(data.token);
            setTimeLeft(data.expires_in);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const init = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase.from("users").select("name, branch").eq("id", user.id).single();
                if (profile) {
                    setUserName(profile.name);
                    setUserBranch(profile.branch || "");
                }
            }
            await fetchToken();
        };
        init();
    }, []);

    useEffect(() => {
        if (timeLeft <= 0 && !isLoading && token) {
            fetchToken();
            return;
        }
        
        if (timeLeft > 0) {
            const timer = setTimeout(() => {
                setTimeLeft(prev => prev - 1);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [timeLeft, isLoading, token]);

    return (
        <div className="max-w-md mx-auto px-4 py-8 flex flex-col min-h-[80vh]">
            <div className="flex items-center mb-8 gap-4">
                <button onClick={() => router.back()} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                    <ChevronLeft size={24} className="text-zinc-700 dark:text-zinc-300" />
                </button>
                <PageTitle>{userName ? `${userName} 스마트 패스` : "스마트 패스"}</PageTitle>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center">
                <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 w-full shadow-lg border border-zinc-100 dark:border-zinc-800 flex flex-col items-center">
                    
                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-50">{userName}</h2>
                        {userBranch && <p className="text-sm font-medium text-zinc-500 mt-1">{userBranch}</p>}
                    </div>

                    <div className="bg-zinc-50 dark:bg-zinc-800 p-6 rounded-[2rem] mb-8 relative">
                        {isLoading ? (
                            <div className="w-[200px] h-[200px] flex flex-col items-center justify-center gap-4 text-zinc-400">
                                <RefreshCw className="animate-spin" size={32} />
                                <span className="text-sm font-bold">QR 생성 중...</span>
                            </div>
                        ) : error ? (
                            <div className="w-[200px] h-[200px] flex flex-col items-center justify-center gap-4 text-red-500">
                                <ShieldAlert size={48} />
                                <span className="text-sm font-bold text-center">오류가 발생했습니다.<br/>{error}</span>
                            </div>
                        ) : (
                            <QRCodeSVG 
                                value={token} 
                                size={200} 
                                level="H"
                                includeMargin={false}
                                className="bg-white p-2 rounded-xl"
                            />
                        )}
                    </div>

                    {!isLoading && !error && (
                        <div className="w-full">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold text-zinc-500 flex items-center gap-1">
                                    <ShieldCheck size={14} className="text-emerald-500" /> 
                                    보안 인증됨
                                </span>
                                <span className="text-xs font-bold text-brand-navy">
                                    {timeLeft}초 후 갱신
                                </span>
                            </div>
                            <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-brand-navy transition-all duration-1000 ease-linear"
                                    style={{ width: `${(timeLeft / 180) * 100}%` }}
                                />
                            </div>
                            <p className="text-[10px] text-zinc-400 text-center mt-4 font-medium">
                                안전한 출결을 위해 QR 코드는 3분마다 자동으로 변경됩니다.<br/>화면을 캡처하여 사용할 수 없습니다.
                            </p>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
