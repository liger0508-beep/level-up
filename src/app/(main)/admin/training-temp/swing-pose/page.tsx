"use client";

import React, { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { ArrowLeft, Play, Square, Settings, SwitchCamera } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Script from "next/script";
import { createClient } from "@/lib/supabase/client";
import { SwingPoseConfig } from "@/components/training/SwingPoseSetup";
import { cn } from "@/lib/utils";

function SwingPoseTrainingContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const recordId = searchParams.get("recordId");

    const [isLoading, setIsLoading] = useState(true);
    const [training, setTraining] = useState<any>(null);
    const [config, setConfig] = useState<SwingPoseConfig | null>(null);
    const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null);
    const [scriptsLoaded, setScriptsLoaded] = useState(0);

    const [isTraining, setIsTraining] = useState(false);
    const [successCount, setSuccessCount] = useState(0);
    const [targetCount, setTargetCount] = useState(10);
    const [currentValue, setCurrentValue] = useState<number>(0);
    const [isSuccessState, setIsSuccessState] = useState(false);

    // Webcam refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const detectorRef = useRef<any>(null);
    const requestRef = useRef<number>(0);
    
    // Reference Refs
    const referenceImageRef = useRef<HTMLImageElement>(null);
    
    // Status tracking
    const lastSuccessTimeRef = useRef<number>(0);
    const sessionLogsRef = useRef<any[]>([]);

    useEffect(() => {
        const fetchRecord = async () => {
            if (!recordId) return;
            const supabase = createClient();
            const { data, error } = await supabase
                .from("records")
                .select("*")
                .eq("id", recordId)
                .single();
            
            if (error || !data) {
                console.error("Failed to load training:", error);
                alert("훈련 데이터를 불러오지 못했습니다.");
                router.back();
                return;
            }

            setTraining(data);
            setTargetCount(data.total_count || 10);
            
            if (data.template_settings && data.template_settings.length > 0) {
                setConfig(data.template_settings[0] as SwingPoseConfig);
            }
            if (data.media_urls && data.media_urls.length > 0) {
                setReferenceImageUrl(data.media_urls[0]);
            }
            setIsLoading(false);
        };
        fetchRecord();
    }, [recordId, router]);

    // Calculate Angle or Distance
    const calculateValue = (landmarks: any[], joints: number[]) => {
        if (joints.length === 3) {
            const [p1, p2, p3] = joints.map(i => landmarks[i]);
            const radians = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
            let angle = Math.abs(radians * 180.0 / Math.PI);
            if (angle > 180.0) angle = 360.0 - angle;
            return angle;
        } else if (joints.length === 2) {
            const [p1, p2] = joints.map(i => landmarks[i]);
            // For distance, we need normalization in real-time, but for now we calculate raw pixel distance (which might vary by camera).
            // A better approach is to use normalized coordinates provided by MoveNet or normalize by shoulder width.
            const dist = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
            return dist;
        }
        return 0;
    };

    const playSuccessSound = async () => {
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            let ctx = (window as any).globalAudioContext;
            if (!ctx) {
                ctx = new AudioContext();
                (window as any).globalAudioContext = ctx;
            }
            if (ctx.state === 'suspended') await ctx.resume();
            const response = await fetch(`/api/tts?text=${encodeURIComponent("성공")}`);
            if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                source.playbackRate.value = 1.2;
                source.connect(ctx.destination);
                source.start();
            }
        } catch (e) {
            console.error("Audio error", e);
        }
    };

    const initDetector = async () => {
        // @ts-ignore
        if (!window.poseDetection) return;
        try {
            // @ts-ignore
            const detectorConfig = { modelType: window.poseDetection.movenet.modelType.SINGLEPOSE_THUNDER };
            // @ts-ignore
            detectorRef.current = await window.poseDetection.createDetector(window.poseDetection.SupportedModels.MoveNet, detectorConfig);
        } catch (e) {
            console.error("Failed to load detector", e);
        }
    };

    const startCamera = async () => {
        if (!videoRef.current) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user", width: 640, height: 480 },
                audio: false
            });
            videoRef.current.srcObject = stream;
            
            videoRef.current.onloadedmetadata = () => {
                videoRef.current?.play();
                if (!detectorRef.current && scriptsLoaded >= 2) {
                    initDetector().then(() => detectFrame());
                } else if (detectorRef.current) {
                    detectFrame();
                }
            };
        } catch (err) {
            console.error("Camera access denied:", err);
            alert("카메라 접근이 거부되었습니다.");
        }
    };

    const stopCamera = () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        if (videoRef.current?.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
    };

    const detectFrame = async () => {
        if (!videoRef.current || !canvasRef.current || !detectorRef.current || !isTraining || !config) return;

        try {
            const poses = await detectorRef.current.estimatePoses(videoRef.current);
            const ctx = canvasRef.current.getContext("2d");
            
            if (ctx) {
                canvasRef.current.width = videoRef.current.videoWidth;
                canvasRef.current.height = videoRef.current.videoHeight;
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

                if (poses.length > 0) {
                    const keypoints = poses[0].keypoints;
                    
                    // Draw Skeleton
                    // @ts-ignore
                    const connections = window.poseDetection.util.getAdjacentPairs(window.poseDetection.SupportedModels.MoveNet);
                    connections.forEach(([i, j]: [number, number]) => {
                        const kp1 = keypoints[i];
                        const kp2 = keypoints[j];
                        if (kp1.score > 0.3 && kp2.score > 0.3) {
                            ctx.beginPath();
                            ctx.moveTo(kp1.x, kp1.y);
                            ctx.lineTo(kp2.x, kp2.y);
                            ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
                            ctx.lineWidth = 2;
                            ctx.stroke();
                        }
                    });

                    // Check config logic
                    const joints = config.targetJoints;
                    const isValid = joints.every(idx => keypoints[idx] && keypoints[idx].score > 0.3);

                    if (isValid) {
                        const val = calculateValue(keypoints, joints);
                        setCurrentValue(Math.round(val));

                        // Draw target lines
                        ctx.beginPath();
                        ctx.moveTo(keypoints[joints[0]].x, keypoints[joints[0]].y);
                        ctx.lineTo(keypoints[joints[1]].x, keypoints[joints[1]].y);
                        if (joints.length === 3) {
                            ctx.lineTo(keypoints[joints[2]].x, keypoints[joints[2]].y);
                        }
                        
                        const diff = Math.abs(val - config.targetValue);
                        const isMatch = diff <= config.margin;
                        
                        ctx.strokeStyle = isMatch ? "#22c55e" : "#ef4444";
                        ctx.lineWidth = 4;
                        ctx.stroke();

                        if (isMatch) {
                            setIsSuccessState(true);
                            const now = Date.now();
                            if (now - lastSuccessTimeRef.current > 2000) { // 2 second cooldown
                                lastSuccessTimeRef.current = now;
                                setSuccessCount(prev => prev + 1);
                                playSuccessSound();
                                sessionLogsRef.current.push({
                                    time: new Date().toISOString(),
                                    value: val,
                                    target: config.targetValue
                                });
                            }
                        } else {
                            setIsSuccessState(false);
                        }
                    }
                }
            }
        } catch (e) {
            console.error(e);
        }

        if (isTraining) {
            requestRef.current = requestAnimationFrame(detectFrame);
        }
    };

    useEffect(() => {
        if (isTraining) {
            startCamera();
        } else {
            stopCamera();
        }
        return () => stopCamera();
    }, [isTraining, config, scriptsLoaded]);

    const handleSave = async () => {
        if (!training || sessionLogsRef.current.length === 0) return;
        
        try {
            const supabase = createClient();
            const logEntry = JSON.stringify({
                timestamp: new Date().toISOString(),
                type: 'swing_pose_session',
                count: successCount,
                target: targetCount
            });

            const currentLogs = Array.isArray(training.completion_logs) 
                ? training.completion_logs 
                : (training.completion_logs ? [training.completion_logs] : []);
            
            const { error } = await supabase
                .from("records")
                .update({ completion_logs: [...currentLogs, logEntry] })
                .eq("id", training.id);

            if (error) throw error;
        } catch (err) {
            console.error("Save failed", err);
        }
    };

    // Auto save and exit on unmount if count > 0
    useEffect(() => {
        return () => {
            if (successCount > 0) {
                handleSave();
            }
        };
    }, [successCount]);

    useEffect(() => {
        if (successCount >= targetCount && isTraining) {
            setIsTraining(false);
            playSuccessSound(); // final cheer
            alert(`목표 횟수(${targetCount}회)를 달성했습니다! 훈련이 자동 종료됩니다.`);
            router.back();
        }
    }, [successCount, targetCount, isTraining]);

    if (isLoading) {
        return <div className="flex h-screen items-center justify-center text-zinc-500 font-bold">로딩 중...</div>;
    }

    if (!config) {
        return <div className="p-8 text-center text-red-500 font-bold">잘못된 훈련 설정입니다.</div>;
    }

    return (
        <div className="flex flex-col h-screen bg-black text-white overflow-hidden">
            <Script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs" onLoad={() => setScriptsLoaded(s => s + 1)} strategy="afterInteractive" />
            {scriptsLoaded >= 1 && (
                <Script src="https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection" onLoad={() => setScriptsLoaded(s => s + 1)} strategy="afterInteractive" />
            )}

            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-zinc-900 border-b border-zinc-800 relative z-10 h-16">
                <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-zinc-800 transition-colors">
                    <ArrowLeft size={24} />
                </button>
                
                <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
                    <h1 className="font-bold text-lg leading-tight">{training?.title || "스윙"}</h1>
                    <p className="text-xs text-zinc-400">
                        {config.evaluationPhase === "address" ? "어드레스" : 
                         config.evaluationPhase === "takeback" ? "테이크백" :
                         config.evaluationPhase === "top" ? "백스윙 탑" :
                         config.evaluationPhase === "downswing" ? "다운스윙" :
                         config.evaluationPhase === "impact" ? "임팩트" :
                         config.evaluationPhase === "followthrough" ? "펄러스루" :
                         config.evaluationPhase === "finish" ? "피니쉬" : "상시"} 자세 점검
                    </p>
                </div>

                <div className="w-10"></div> {/* Placeholder to balance flex */}
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col md:flex-row relative">
                
                {/* Left: Reference */}
                <div className="w-full md:w-1/3 h-[30vh] md:h-full p-4 flex flex-col gap-4 border-b md:border-b-0 md:border-r border-zinc-800 bg-zinc-950">
                    <div className="flex-1 rounded-2xl overflow-hidden border-2 border-zinc-800 bg-zinc-900 flex flex-col relative">
                        <div className="absolute top-2 left-2 bg-black/60 px-3 py-1 rounded-full text-xs font-bold text-white z-10">
                            레퍼런스 목표
                        </div>
                        {referenceImageUrl && (
                            <div className="absolute inset-0 flex items-center justify-center p-2 overflow-hidden">
                                <img 
                                    ref={referenceImageRef}
                                    src={referenceImageUrl} 
                                    crossOrigin="anonymous"
                                    className="w-full h-full object-contain opacity-80" 
                                    alt="Reference" 
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Camera */}
                <div className="flex-1 relative bg-black flex flex-col">
                    <div className="absolute top-4 inset-x-0 flex justify-center z-10">
                        <div className="bg-zinc-900/80 backdrop-blur-md px-6 py-3 rounded-full border border-zinc-800 shadow-2xl flex items-center gap-6">
                            <div className="text-center">
                                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">목표 기준값</div>
                                <div className="flex items-baseline justify-center gap-1">
                                    <span className="text-3xl font-black text-white">{config.targetValue}</span>
                                    <span className="text-sm font-bold opacity-50 ml-1">
                                        {config.targetJoints.length === 3 ? "°" : "px"}
                                    </span>
                                </div>
                            </div>
                            <div className="w-px h-10 bg-zinc-700"></div>
                            <div className="text-center">
                                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">현재 상태</div>
                                <div className={cn(
                                    "text-3xl font-black transition-colors duration-300 flex items-baseline justify-center gap-1",
                                    isSuccessState ? "text-green-500" : "text-white"
                                )}>
                                    {currentValue}
                                    <span className="text-sm font-bold opacity-50 ml-1">
                                        {config.targetJoints.length === 3 ? "°" : "px"}
                                    </span>
                                </div>
                            </div>
                            <div className="w-px h-10 bg-zinc-700"></div>
                            <div className="text-center">
                                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">성공 횟수</div>
                                <div className="text-3xl font-black text-brand-red flex items-baseline justify-center gap-1">
                                    {successCount} <span className="text-base text-zinc-500">/ {targetCount}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 relative flex items-center justify-center overflow-hidden">
                        {/* Video Element */}
                        <video 
                            ref={videoRef}
                            playsInline
                            muted
                            className="absolute inset-0 w-full h-full object-contain transform scale-x-[-1]"
                        />
                        {/* Canvas Overlay */}
                        <canvas 
                            ref={canvasRef}
                            className="absolute inset-0 w-full h-full object-contain transform scale-x-[-1] pointer-events-none"
                        />
                        
                        {!isTraining && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-20">
                                <button
                                    onClick={() => {
                                        setIsTraining(true);
                                        setSuccessCount(0);
                                        setCurrentValue(0);
                                    }}
                                    className="w-24 h-24 rounded-full bg-brand-red text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl shadow-brand-red/30 mb-4"
                                >
                                    <Play size={40} className="ml-2" />
                                </button>
                                <span className="text-lg font-bold">훈련 시작하기</span>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}

export default function SwingPoseTrainingPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center text-white">Loading...</div>}>
            <SwingPoseTrainingContent />
        </Suspense>
    );
}
