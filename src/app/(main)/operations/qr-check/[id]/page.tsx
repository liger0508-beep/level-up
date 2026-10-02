"use client";

import React, { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PageTitle } from "@/components/ui/Typography";
import { ChevronLeft, Camera, CheckCircle2, XCircle, Users, RefreshCw } from "lucide-react";
import { Html5QrcodeScanner, Html5Qrcode } from "html5-qrcode";
import { getQrScanLogs, QrScanLog } from "@/lib/qr-sync";

const playSuccessSound = () => {
    try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); 
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.1);
        oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (e) { console.error(e); }
};

const playErrorSound = () => {
    try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(150, audioCtx.currentTime); 
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.3);
        oscillator.stop(audioCtx.currentTime + 0.3);
    } catch (e) { console.error(e); }
};

export default function QrCheckEventDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const resolvedParams = use(params);
    const eventId = resolvedParams.id;
    const [event, setEvent] = useState<any>(null);
    const [logs, setLogs] = useState<QrScanLog[]>([]);
    const [targetAthletes, setTargetAthletes] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<"ATTENDED" | "NOT_ATTENDED">("ATTENDED");
    const [isLoading, setIsLoading] = useState(true);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
    const [scanResult, setScanResult] = useState<{success: boolean, msg: string} | null>(null);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    
    // To prevent double scanning the same QR quickly
    const lastScannedToken = useRef<string>("");

    const loadData = async () => {
        try {
            const supabase = createClient();
            const { data: eData } = await supabase.from("polls").select("*").eq("id", eventId).single();
            if (eData) setEvent(eData);

            const lData = await getQrScanLogs(eventId);
            setLogs(lData);
            
            if (eData) {
                const { data: users } = await supabase.from("users").select("id, name, branch").eq("status", "등록").eq("role", "athlete");
                if (users) {
                    const targetType = eData.description;
                    const targetData = eData.final_roster || {};
                    const extraAthletes = targetData.extraAthletes || [];
                    
                    let eligible: any[] = [];
                    if (targetType === "ALL") {
                        eligible = users;
                    } else if (targetType === "BRANCH") {
                        eligible = users.filter((u: any) => u.branch === targetData.branch);
                    } else if (targetType === "POLL_PARTICIPANTS") {
                        const voters = targetData.voters || [];
                        eligible = users.filter((u: any) => voters.includes(u.name));
                    }
                    
                    extraAthletes.forEach((ea: any) => {
                        if (!eligible.find((u: any) => u.id === ea.id)) {
                            eligible.push(ea);
                        }
                    });
                    
                    setTargetAthletes(eligible);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        // Setup realtime subscription for logs to auto-update
        const supabase = createClient();
        const sub = supabase.channel(`qr_logs_${eventId}`)
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "poll_responses", filter: `poll_id=eq.${eventId}` }, () => {
                loadData(); // reload on new scan
            })
            .subscribe();
            
        return () => {
            sub.unsubscribe();
            if (scannerRef.current) {
                try { scannerRef.current.stop(); } catch(e) {}
            }
        };
    }, [eventId]);

    const startScanner = async (mode = facingMode) => {
        // If scanner is already running or active, stop it first
        if (scannerRef.current) {
            try {
                await scannerRef.current.stop();
                scannerRef.current.clear();
            } catch (e) {}
            scannerRef.current = null;
        }

        setIsScannerOpen(true);
        setScanResult(null);
        lastScannedToken.current = "";
        
        // Wait for DOM to render the reader div
        setTimeout(() => {
            const readerEl = document.getElementById("reader");
            if (!readerEl) return;
            
            const html5QrCode = new Html5Qrcode("reader");
            scannerRef.current = html5QrCode;
            
            const qrConfig = { 
                fps: 10, 
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            };

            const qrCallback = async (decodedText: string) => {
                if (lastScannedToken.current === decodedText) return;
                lastScannedToken.current = decodedText;
                
                try {
                    const res = await fetch("/api/qr-scan", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ token: decodedText, eventId })
                    });
                    const data = await res.json();
                    
                    if (res.ok) {
                        playSuccessSound();
                        setScanResult({ success: true, msg: "출석 처리되었습니다!" });
                    } else {
                        playErrorSound();
                        setScanResult({ success: false, msg: data.error || "스캔 실패" });
                    }
                } catch (err) {
                    playErrorSound();
                    setScanResult({ success: false, msg: "네트워크 오류" });
                }
                setTimeout(() => setScanResult(null), 2500);
            };

            const qrErrorCallback = () => {};

            // Start camera with exact facingMode string or fallback object
            html5QrCode.start(
                { facingMode: { exact: mode } },
                qrConfig,
                qrCallback,
                qrErrorCallback
            ).catch(() => {
                // Fallback to simple facingMode if exact mode fails
                html5QrCode.start(
                    { facingMode: mode },
                    qrConfig,
                    qrCallback,
                    qrErrorCallback
                ).catch((err: any) => {
                    console.error("Camera start error:", err);
                    alert("카메라 연결 실패: " + (err?.message || "카메라 장치를 시작할 수 없습니다. 권한을 확인해주세요."));
                    setIsScannerOpen(false);
                });
            });
        }, 200);
    };

    const stopScanner = async () => {
        if (scannerRef.current) {
            try {
                await scannerRef.current.stop();
                scannerRef.current.clear();
            } catch (e) {}
        }
        setIsScannerOpen(false);
    };

    const toggleCamera = async () => {
        const newMode = facingMode === "environment" ? "user" : "environment";
        setFacingMode(newMode);
        if (isScannerOpen) {
            if (scannerRef.current) {
                try {
                    await scannerRef.current.stop();
                    scannerRef.current.clear();
                } catch(e) {}
            }
            startScanner(newMode);
        }
    };

    const unattended = targetAthletes.filter(a => !logs.some(l => l.athleteId === a.id));

    return (
        <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col h-[calc(100vh-80px)]">
            <div className="flex items-center gap-4 mb-6 shrink-0">
                <button onClick={() => { stopScanner(); router.back(); }} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                    <ChevronLeft size={24} className="text-zinc-700 dark:text-zinc-300" />
                </button>
                <PageTitle>{event?.title || "스마트 패스 방"}</PageTitle>
            </div>

            <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0">
                {/* Scanner Section */}
                <div className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-6 flex flex-col shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                            <Camera size={20} className="text-brand-navy" /> QR 스캐너
                        </h2>
                        <div className="flex items-center gap-2">
                            {isScannerOpen && (
                                <button
                                    onClick={toggleCamera}
                                    className="p-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                                    title="카메라 전환"
                                >
                                    <RefreshCw size={18} />
                                </button>
                            )}
                            <button 
                                onClick={isScannerOpen ? stopScanner : () => startScanner(facingMode)}
                                className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${isScannerOpen ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-brand-navy text-white hover:bg-brand-navy-dark'}`}
                            >
                                {isScannerOpen ? "카메라 끄기" : "카메라 켜기"}
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-800/50 rounded-3xl overflow-hidden relative border-2 border-dashed border-zinc-200 dark:border-zinc-700">
                        {isScannerOpen ? (
                            <div className="w-full h-full absolute inset-0">
                                <div id="reader" className="w-full h-full [&>video]:w-full [&>video]:h-full [&>video]:object-cover" />
                                
                                {/* Overlay scan result */}
                                {scanResult && (
                                    <div className={`absolute inset-0 flex flex-col items-center justify-center bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm z-10 animate-in fade-in zoom-in duration-200`}>
                                        {scanResult.success ? (
                                            <CheckCircle2 size={64} className="text-emerald-500 mb-4" />
                                        ) : (
                                            <XCircle size={64} className="text-red-500 mb-4" />
                                        )}
                                        <p className={`text-xl font-black ${scanResult.success ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {scanResult.msg}
                                        </p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center text-zinc-400">
                                <Camera size={48} className="mx-auto mb-2 opacity-50" />
                                <p className="font-medium text-sm">상단의 '카메라 켜기' 버튼을 눌러 스캔을 시작하세요.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Logs Section */}
                <div className="w-full md:w-80 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-6 flex flex-col shadow-sm">
                    <div className="flex flex-col mb-4 shrink-0">
                        <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2 mb-3">
                            <Users size={20} className="text-brand-navy" /> 스캔 기록
                        </h2>
                        <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
                            <button 
                                onClick={() => setActiveTab("ATTENDED")} 
                                className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-colors ${activeTab === "ATTENDED" ? "bg-white dark:bg-zinc-900 text-brand-navy shadow-sm" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"}`}
                            >
                                참가 ({logs.length})
                            </button>
                            <button 
                                onClick={() => setActiveTab("NOT_ATTENDED")} 
                                className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-colors ${activeTab === "NOT_ATTENDED" ? "bg-white dark:bg-zinc-900 text-red-500 shadow-sm" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"}`}
                            >
                                미참가 ({unattended.length})
                            </button>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-700">
                        {isLoading ? (
                            <div className="text-center py-4 text-zinc-400 text-sm">불러오는 중...</div>
                        ) : activeTab === "ATTENDED" ? (
                            logs.length === 0 ? (
                                <div className="text-center py-8 text-zinc-400 text-sm font-medium">아직 스캔된 기록이 없습니다.</div>
                            ) : (
                                logs.map((log, i) => (
                                    <div key={log.id} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-100 dark:border-zinc-700/50 animate-in slide-in-from-right-4 fade-in">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-brand-navy/10 dark:bg-brand-navy/30 text-brand-navy flex items-center justify-center font-bold text-xs">
                                                {logs.length - i}
                                            </div>
                                            <span className="font-bold text-zinc-700 dark:text-zinc-200">{log.athleteName}</span>
                                        </div>
                                        <span className="text-[10px] text-zinc-400 font-medium">
                                            {new Date(log.scannedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </span>
                                    </div>
                                ))
                            )
                        ) : (
                            unattended.length === 0 ? (
                                <div className="text-center py-8 text-emerald-500 text-sm font-bold flex flex-col items-center gap-2">
                                    <CheckCircle2 size={32} />
                                    전원 참가 완료!
                                </div>
                            ) : (
                                unattended.map((u, i) => (
                                    <div key={u.id} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30 animate-in slide-in-from-right-4 fade-in">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 text-red-500 flex items-center justify-center font-bold text-xs">
                                                {i + 1}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-zinc-700 dark:text-zinc-200">{u.name}</span>
                                                <span className="text-[10px] text-zinc-500">{u.branch}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
