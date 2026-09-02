"use client";

import React, { useState, useEffect, useRef } from "react";
import Script from "next/script";
import { Upload, X, Trash2, Crosshair, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// Types
export interface SwingPoseConfig {
    type: "swing_pose";
    targetJoints: number[]; // e.g. [11, 13, 15] for left arm angle
    targetValue: number; // e.g. 145 degrees
    margin: number; // e.g. 10 degrees
    evaluationPhase: "address" | "takeback" | "top" | "downswing" | "impact" | "followthrough" | "finish" | "continuous";
}

interface SwingPoseSetupProps {
    onChange: (config: SwingPoseConfig | null) => void;
    onImageSelected: (file: File | null) => void;
    initialConfig?: SwingPoseConfig | null;
    initialImageUrl?: string | null;
}

// MediaPipe Pose Landmark Names for reference (0-32)
const POSE_LANDMARKS = [
    "코", "왼쪽 눈 안쪽", "왼쪽 눈", "왼쪽 눈 바깥쪽", "오른쪽 눈 안쪽", "오른쪽 눈", "오른쪽 눈 바깥쪽",
    "왼쪽 귀", "오른쪽 귀", "입 왼쪽", "입 오른쪽", "왼쪽 어깨", "오른쪽 어깨", "왼쪽 팔꿈치", "오른쪽 팔꿈치",
    "왼쪽 손목", "오른쪽 손목", "왼쪽 새끼손가락", "오른쪽 새끼손가락", "왼쪽 검지", "오른쪽 검지", "왼쪽 엄지", "오른쪽 엄지",
    "왼쪽 엉덩이", "오른쪽 엉덩이", "왼쪽 무릎", "오른쪽 무릎", "왼쪽 발목", "오른쪽 발목", "왼쪽 발 뒤꿈치", "오른쪽 발 뒤꿈치",
    "왼쪽 발 앞꿈치", "오른쪽 발 앞꿈치"
];

// Calculate Angle between 3 points (A-B-C, B is vertex)
function calculateAngle(a: {x: number, y: number}, b: {x: number, y: number}, c: {x: number, y: number}) {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    if (angle > 180.0) {
        angle = 360.0 - angle;
    }
    return angle;
}

export function SwingPoseSetup({ onChange, onImageSelected, initialConfig, initialImageUrl }: SwingPoseSetupProps) {
    const [scriptsLoaded, setScriptsLoaded] = useState(0);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(initialImageUrl || null);
    const [isDetecting, setIsDetecting] = useState(false);
    
    const [landmarks, setLandmarks] = useState<any[]>([]);
    const [selectedJoints, setSelectedJoints] = useState<number[]>(initialConfig?.targetJoints || []);
    const [calculatedValue, setCalculatedValue] = useState<number>(initialConfig?.targetValue || 0);
    
    const [margin, setMargin] = useState<number>(initialConfig?.margin || 10);
    const [evaluationPhase, setEvaluationPhase] = useState<SwingPoseConfig["evaluationPhase"]>(initialConfig?.evaluationPhase || "top");

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const detectorRef = useRef<any>(null);

    const onChangeRef = useRef(onChange);
    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    // Notify parent on config change
    useEffect(() => {
        if (selectedJoints.length >= 2 && imageUrl) {
            onChangeRef.current({
                type: "swing_pose",
                targetJoints: selectedJoints,
                targetValue: calculatedValue,
                margin: margin,
                evaluationPhase: evaluationPhase
            });
        } else {
            onChangeRef.current(null);
        }
    }, [selectedJoints, calculatedValue, margin, evaluationPhase, imageUrl]);

    // Update calculated value when selected joints change
    useEffect(() => {
        if (selectedJoints.length === 3 && landmarks.length > 0) {
            const [p1, p2, p3] = selectedJoints.map(idx => landmarks[idx]);
            const angle = calculateAngle(p1, p2, p3);
            setCalculatedValue(Math.round(angle));
        } else if (selectedJoints.length === 2 && landmarks.length > 0) {
            // Distance or relative X/Y
            const [p1, p2] = selectedJoints.map(idx => landmarks[idx]);
            const dist = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
            setCalculatedValue(Math.round(dist)); // Pixels or normalized distance
        } else {
            setCalculatedValue(0);
        }
    }, [selectedJoints, landmarks]);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            setImageUrl(URL.createObjectURL(file));
            onImageSelected(file);
            setSelectedJoints([]);
            setLandmarks([]);
        }
        e.target.value = "";
    };

    const detectPose = async () => {
        if (!imageRef.current) return;
        
        // @ts-ignore
        if (!window.poseDetection) {
            if (scriptsLoaded < 2) return;
            alert("포즈 인식 모듈을 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.");
            return;
        }

        setIsDetecting(true);

        try {
            // @ts-ignore
            const poseDetection = window.poseDetection;
            if (!detectorRef.current) {
                const detectorConfig = { modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER };
                detectorRef.current = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, detectorConfig);
            }

            const poses = await detectorRef.current.estimatePoses(imageRef.current);
            if (poses.length > 0) {
                setLandmarks(poses[0].keypoints);
                drawCanvas(poses[0].keypoints, selectedJoints);
            } else {
                alert("사람의 포즈를 인식하지 못했습니다. 다른 사진을 시도해주세요.");
            }
        } catch (error) {
            console.error(error);
            alert("포즈 인식 중 오류가 발생했습니다.");
        } finally {
            setIsDetecting(false);
        }
    };

    // Draw image and landmarks on canvas
    const drawCanvas = (pts = landmarks, selected = selectedJoints) => {
        const canvas = canvasRef.current;
        const img = imageRef.current;
        if (!canvas || !img || pts.length === 0) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Match canvas size to image natural size
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const base = Math.max(canvas.width, canvas.height);
        const lineWidth = base * 0.005;
        const radius = base * 0.01;

        // Draw connections (skeleton)
        // @ts-ignore
        const poseDetection = window.poseDetection;
        if (poseDetection?.util?.getAdjacentPairs) {
            const connections = poseDetection.util.getAdjacentPairs(poseDetection.SupportedModels.MoveNet);
            connections.forEach(([i, j]: [number, number]) => {
                const kp1 = pts[i];
                const kp2 = pts[j];
                if (kp1.score > 0.3 && kp2.score > 0.3) {
                    ctx.beginPath();
                    ctx.moveTo(kp1.x, kp1.y);
                    ctx.lineTo(kp2.x, kp2.y);
                    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
                    ctx.lineWidth = lineWidth;
                    ctx.stroke();
                }
            });
        }

        // Draw lines between selected points
        if (selected.length > 1) {
            ctx.beginPath();
            ctx.moveTo(pts[selected[0]].x, pts[selected[0]].y);
            ctx.lineTo(pts[selected[1]].x, pts[selected[1]].y);
            if (selected.length === 3) {
                ctx.lineTo(pts[selected[2]].x, pts[selected[2]].y);
            }
            ctx.strokeStyle = "#ef4444";
            ctx.lineWidth = lineWidth * 2;
            ctx.stroke();
        }

        // Draw points
        pts.forEach((kp, idx) => {
            if (kp.score > 0.3) {
                const isSelected = selected.includes(idx);
                const isVertex = selected.length === 3 && selected[1] === idx;
                
                ctx.beginPath();
                ctx.arc(kp.x, kp.y, isSelected ? radius * 2 : radius, 0, 2 * Math.PI);
                ctx.fillStyle = isVertex ? "#f59e0b" : (isSelected ? "#ef4444" : "#3b82f6");
                ctx.fill();
                
                if (isSelected) {
                    ctx.strokeStyle = "#ffffff";
                    ctx.lineWidth = lineWidth;
                    ctx.stroke();
                }
            }
        });

        // Extract composite blob if joints are selected
        if (selected.length >= 2) {
            const offscreen = document.createElement("canvas");
            offscreen.width = canvas.width;
            offscreen.height = canvas.height;
            const offCtx = offscreen.getContext("2d");
            if (offCtx) {
                offCtx.drawImage(img, 0, 0, offscreen.width, offscreen.height);
                offCtx.drawImage(canvas, 0, 0, offscreen.width, offscreen.height);
                offscreen.toBlob((blob) => {
                    if (blob) {
                        const compFile = new File([blob], "composite.png", { type: "image/png" });
                        onImageSelected(compFile);
                    }
                }, "image/png", 0.9);
            }
        } else if (imageFile) {
            onImageSelected(imageFile);
        }
    };

    // Re-draw when selected joints change
    useEffect(() => {
        if (landmarks.length > 0) {
            drawCanvas();
        }
    }, [selectedJoints]);

    // Re-run pose detection if scripts finish loading after the image is already loaded
    useEffect(() => {
        if (scriptsLoaded >= 2 && imageRef.current?.complete && imageUrl && landmarks.length === 0) {
            detectPose();
        }
    }, [scriptsLoaded]);

    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (landmarks.length === 0) return;

        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        // Calculate click position relative to canvas natural size
        const scaleX = canvasRef.current!.width / rect.width;
        const scaleY = canvasRef.current!.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        // Find closest landmark within radius
        const threshold = 20; // click radius
        let closestIdx = -1;
        let minDist = Infinity;

        landmarks.forEach((kp, idx) => {
            if (kp.score > 0.3) {
                const dist = Math.sqrt(Math.pow(kp.x - x, 2) + Math.pow(kp.y - y, 2));
                if (dist < threshold && dist < minDist) {
                    minDist = dist;
                    closestIdx = idx;
                }
            }
        });

        if (closestIdx !== -1) {
            setSelectedJoints(prev => {
                // If already selected, remove it
                if (prev.includes(closestIdx)) {
                    return prev.filter(i => i !== closestIdx);
                }
                // Add new (max 3)
                if (prev.length >= 3) {
                    // Replace the last one
                    return [prev[0], prev[1], closestIdx];
                }
                return [...prev, closestIdx];
            });
        }
    };

    return (
        <div className="space-y-6 bg-zinc-50 dark:bg-zinc-800/30 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <Script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs" onLoad={() => setScriptsLoaded(s => s + 1)} strategy="afterInteractive" />
            {scriptsLoaded >= 1 && (
                <Script src="https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection" onLoad={() => setScriptsLoaded(s => s + 1)} strategy="afterInteractive" />
            )}

            <div className="flex items-center gap-2 mb-2">
                <Crosshair size={20} className="text-brand-navy" />
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100">스윙 포즈(관절) 설정</h3>
            </div>

            {/* Step 1: Upload Image */}
            <div className="space-y-2">
                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    1. 레퍼런스 사진 업로드
                </label>
                {!imageUrl ? (
                    <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer">
                        <Upload size={24} className="text-zinc-400 mb-2" />
                        <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">사진 선택하기</span>
                        <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </label>
                ) : (
                    <div className="relative inline-block w-full max-w-[400px] rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-black">
                        <img 
                            key={imageUrl || "empty"}
                            ref={imageRef} 
                            src={imageUrl} 
                            crossOrigin={imageUrl?.startsWith("blob:") ? undefined : "anonymous"}
                            alt="Reference" 
                            className="w-full h-auto object-contain opacity-80"
                            onLoad={detectPose}
                        />
                        <canvas 
                            ref={canvasRef} 
                            onClick={handleCanvasClick}
                            className="absolute top-0 left-0 w-full h-full cursor-crosshair"
                        />
                        
                        {isDetecting && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                                <div className="text-white flex flex-col items-center">
                                    <div className="w-6 h-6 border-2 border-brand-navy border-t-transparent rounded-full animate-spin mb-2" />
                                    <span className="text-xs font-bold">AI 관절 추출 중...</span>
                                </div>
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={() => {
                                setImageUrl(null);
                                setImageFile(null);
                                onImageSelected(null);
                                setLandmarks([]);
                                setSelectedJoints([]);
                            }}
                            className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-lg hover:bg-black/70 backdrop-blur-md"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                )}
            </div>

            {/* Step 2: Select Joints */}
            {landmarks.length > 0 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="flex items-start justify-between gap-4 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
                        <div className="space-y-1">
                            <label className="flex items-center gap-1.5 text-sm font-bold text-zinc-900 dark:text-zinc-100">
                                2. 타겟 관절 선택 <span className="text-brand-red">*</span>
                            </label>
                            <p className="text-xs text-zinc-500">
                                사진 위에서 추적할 관절을 2~3개 클릭하세요.<br/>
                                (세 점을 찍으면 중심점의 <b>각도</b>를, 두 점을 찍으면 <b>거리</b>를 측정합니다)
                            </p>
                        </div>
                        <div className="text-right">
                            <div className="text-[10px] font-bold text-zinc-400 mb-1">선택됨</div>
                            <div className="flex gap-1">
                                {[0, 1, 2].map((i) => (
                                    <div key={i} className={cn(
                                        "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white",
                                        selectedJoints[i] !== undefined 
                                            ? (i === 1 && selectedJoints.length === 3 ? "bg-amber-500" : "bg-brand-red") 
                                            : "bg-zinc-200 dark:bg-zinc-800"
                                    )}>
                                        {i + 1}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Step 3: Config */}
                    {selectedJoints.length >= 2 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                    측정된 기준값
                                </label>
                                <div className="px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-center">
                                    <span className="text-2xl font-black text-brand-navy">
                                        {calculatedValue}{selectedJoints.length === 3 ? "°" : "px"}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                    오차 허용 범위 (±)
                                </label>
                                <div className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                                    <input 
                                        type="number"
                                        value={margin}
                                        onChange={(e) => setMargin(Number(e.target.value))}
                                        className="w-full bg-transparent text-center font-bold focus:outline-none"
                                        min="1" max="90"
                                    />
                                    <span className="text-sm font-bold text-zinc-500">
                                        {selectedJoints.length === 3 ? "도" : "px"}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-2 sm:col-span-2">
                                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                    판정 타이밍 (구간)
                                </label>
                                <div className="grid grid-cols-4 gap-2">
                                    {[
                                        { v: "address", l: "어드레스" },
                                        { v: "takeback", l: "테이크백" },
                                        { v: "top", l: "백스윙 탑" },
                                        { v: "downswing", l: "다운스윙" },
                                        { v: "impact", l: "임팩트" },
                                        { v: "followthrough", l: "펄러스루" },
                                        { v: "finish", l: "피니쉬" },
                                        { v: "continuous", l: "상시" },
                                    ].map(opt => (
                                        <button
                                            type="button"
                                            key={opt.v}
                                            onClick={() => setEvaluationPhase(opt.v as any)}
                                            className={cn(
                                                "py-2 px-1 rounded-xl text-[13px] sm:text-sm font-bold transition-all border text-center break-keep",
                                                evaluationPhase === opt.v
                                                    ? "bg-brand-navy text-white border-brand-navy"
                                                    : "bg-white dark:bg-zinc-900 text-zinc-600 border-zinc-200 hover:border-brand-navy"
                                            )}
                                        >
                                            {opt.l}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
