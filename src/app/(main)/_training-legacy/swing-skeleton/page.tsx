"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { ArrowLeft, Play, Settings, X, Video, Activity, RefreshCw, CheckCircle, Pause, SwitchCamera, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

const playSound = (text: string, rate: number = 1.2) => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = rate;
    window.speechSynthesis.speak(utterance);
  }
};

type AppMode = 'setup' | 'master_review' | 'challenge';
type SwingState = 'idle' | 'addressing' | 'ready' | 'swinging' | 'finished';
type TargetPart = 'all' | 'head' | 'shoulders' | 'upper_body_axis' | 'hips' | 'legs' | 'arms';

export default function SwingTestApp() {
  const router = useRouter();
  
  // Master Video Refs
  const masterVideoRef = useRef<HTMLVideoElement>(null);
  const masterCanvasRef = useRef<HTMLCanvasElement>(null);
  const masterRafRef = useRef<number>(0);
  const sliderRef = useRef<HTMLInputElement>(null);

  const handleStepFrame = (step: number) => {
      if (masterVideoRef.current) {
          const newTime = Math.min(Math.max(0, masterVideoRef.current.currentTime + step), masterDuration);
          masterVideoRef.current.currentTime = newTime;
          if (sliderRef.current) sliderRef.current.value = newTime.toString();
      }
  };
  
  // Live Video Refs
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement>(null);
  const liveRafRef = useRef<number>(0);

  const detectorRef = useRef<any>(null);

  // App State
  const [modelLoaded, setModelLoaded] = useState(false);
  const [mode, setMode] = useState<AppMode>('setup');
  const [masterVideoSrc, setMasterVideoSrc] = useState<string | null>(null);
  const [masterDuration, setMasterDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  
  // Challenge State
  const [targetPart, setTargetPart] = useState<TargetPart>('all');
  const [masterPose, setMasterPose] = useState<any | null>(null);
  const [swingState, setSwingState] = useState<SwingState>('idle');
  const [lastScore, setLastScore] = useState<number | null>(null);
  
  // Motion Tracking Variables
  const lastPoseRef = useRef<any | null>(null);
  const stillFramesCountRef = useRef(0);
  const swingStateRef = useRef<SwingState>('idle');
  const livePosesRef = useRef<any[]>([]);

  const [scriptsLoaded, setScriptsLoaded] = useState(0);

  // 모델 로드
  useEffect(() => {
    if (scriptsLoaded === 2) {
      const initModel = async () => {
        try {
          const tf = (window as any).tf;
          const poseDetection = (window as any).poseDetection;
          if (!tf || !poseDetection) return;
          await tf.ready();
          const detectorConfig = { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING };
          const detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, detectorConfig);
          detectorRef.current = detector;
          setModelLoaded(true);
        } catch (err) {
          console.error("AI Model Error:", err);
        }
      };
      initModel();
    }
  }, [scriptsLoaded]);

  // 카메라 시작/종료
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facingMode } }, audio: false });
      if (liveVideoRef.current) {
         liveVideoRef.current.srcObject = stream;
         liveVideoRef.current.play();
      }
    } catch (err) {
      console.error("Camera Error:", err);
    }
  };

  const stopCamera = () => {
     if (liveVideoRef.current?.srcObject) {
        const stream = liveVideoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        liveVideoRef.current.srcObject = null;
     }
  };

  useEffect(() => {
     if (mode === 'challenge') {
        stopCamera();
        startCamera();
     } else {
        stopCamera();
     }
     return () => stopCamera();
  }, [mode, facingMode]);

  const updateState = (newState: SwingState) => {
     swingStateRef.current = newState;
     setSwingState(newState);
  };

  const KEYPOINT_GROUPS: Record<TargetPart, string[]> = {
     all: ['nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear', 'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow', 'left_wrist', 'right_wrist', 'left_hip', 'right_hip', 'left_knee', 'right_knee', 'left_ankle', 'right_ankle'],
     head: ['nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear'],
     shoulders: ['left_shoulder', 'right_shoulder'],
     hips: ['left_hip', 'right_hip'],
     upper_body_axis: ['nose', 'left_shoulder', 'right_shoulder', 'left_hip', 'right_hip'],
     legs: ['left_knee', 'right_knee', 'left_ankle', 'right_ankle'],
     arms: ['left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow', 'left_wrist', 'right_wrist']
  };

  // 뼈대 그리기
  const drawSkeleton = (pose: any, ctx: CanvasRenderingContext2D, color = "rgba(0, 255, 100, 0.8)", highlightPart: TargetPart = 'all') => {
    if (!pose?.keypoints) return;
    const highlightKeys = KEYPOINT_GROUPS[highlightPart];
    
    pose.keypoints.forEach((keypoint: any) => {
      if ((keypoint.score || 0) > 0.3) {
        ctx.fillStyle = highlightKeys.includes(keypoint.name) ? color : "rgba(255,255,255,0.3)";
        ctx.beginPath();
        ctx.arc(keypoint.x, keypoint.y, highlightKeys.includes(keypoint.name) ? 6 : 3, 0, 2 * Math.PI);
        ctx.fill();
      }
    });

    const drawLine = (p1Id: string, p2Id: string) => {
      const p1 = pose.keypoints.find((p: any) => p.name === p1Id);
      const p2 = pose.keypoints.find((p: any) => p.name === p2Id);
      if (p1 && p2 && (p1.score || 0) > 0.3 && (p2.score || 0) > 0.3) {
        ctx.strokeStyle = (highlightKeys.includes(p1Id) || highlightKeys.includes(p2Id)) ? color : "rgba(255,255,255,0.3)";
        ctx.lineWidth = (highlightKeys.includes(p1Id) || highlightKeys.includes(p2Id)) ? 3 : 1;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    };

    drawLine("left_shoulder", "right_shoulder");
    drawLine("left_hip", "right_hip");
    drawLine("left_shoulder", "left_hip");
    drawLine("right_shoulder", "right_hip");
    drawLine("left_shoulder", "left_elbow");
    drawLine("left_elbow", "left_wrist");
    drawLine("right_shoulder", "right_elbow");
    drawLine("right_elbow", "right_wrist");
  };

  const normalizePose = (pose: any) => {
      if (!pose?.keypoints) return null;
      const lHip = pose.keypoints.find((k: any) => k.name === 'left_hip');
      const rHip = pose.keypoints.find((k: any) => k.name === 'right_hip');
      const lShoulder = pose.keypoints.find((k: any) => k.name === 'left_shoulder');
      
      if (!lHip || !rHip || !lShoulder || lHip.score < 0.2 || rHip.score < 0.2 || lShoulder.score < 0.2) return pose; 
      
      const centerX = (lHip.x + rHip.x) / 2;
      const centerY = (lHip.y + rHip.y) / 2;
      const scale = Math.hypot(lShoulder.x - centerX, lShoulder.y - centerY) || 1; 

      const normalizedKps = pose.keypoints.map((kp: any) => ({
          ...kp,
          nx: (kp.x - centerX) / scale,
          ny: (kp.y - centerY) / scale
      }));

      return { ...pose, normalizedKps };
  };

  const calculatePartSimilarity = (livePose: any, masterPose: any, part: TargetPart) => {
      const normLive = normalizePose(livePose);
      const normMaster = normalizePose(masterPose);
      
      if (!normLive?.normalizedKps || !normMaster?.normalizedKps) return 0;
      
      let totalDist = 0;
      let count = 0;
      const keys = KEYPOINT_GROUPS[part];
      
      keys.forEach(key => {
          const kp1 = normLive.normalizedKps.find((k: any) => k.name === key);
          const kp2 = normMaster.normalizedKps.find((k: any) => k.name === key);
          if (kp1 && kp2 && kp1.score > 0.3 && kp2.score > 0.3) {
              totalDist += Math.hypot(kp1.nx - kp2.nx, kp1.ny - kp2.ny);
              count++;
          }
      });
      
      if (count === 0) return 0;
      const avgDist = totalDist / count;
      let score = 100 - (avgDist * 100);
      return Math.max(0, Math.min(100, Math.round(score)));
  };

  const getMotionSpeed = (p1: any, p2: any) => {
     let totalDist = 0;
     let count = 0;
     if (!p1?.keypoints || !p2?.keypoints) return 100;
     p1.keypoints.forEach((kp1: any, i: number) => {
        const kp2 = p2.keypoints[i];
        if (kp2 && (kp1.score || 0) > 0.3 && (kp2.score || 0) > 0.3) {
           totalDist += Math.hypot(kp1.x - kp2.x, kp1.y - kp2.y);
           count++;
        }
     });
     return count > 0 ? totalDist / count : 100;
  };

  const processMasterFrame = useCallback(async () => {
      if (!masterVideoRef.current || !masterCanvasRef.current || !detectorRef.current || mode !== 'master_review') return;
      const video = masterVideoRef.current;
      const canvas = masterCanvasRef.current;
      const ctx = canvas.getContext("2d");

      if (video.readyState >= 2) {
          try {
             const poses = await detectorRef.current.estimatePoses(video);
             if (ctx) {
                 canvas.width = video.videoWidth;
                 canvas.height = video.videoHeight;
                 ctx.clearRect(0, 0, canvas.width, canvas.height);
                 if (poses.length > 0) {
                     drawSkeleton(poses[0], ctx, "rgba(255, 150, 0, 0.9)", targetPart);
                 }
             }
          } catch (e) {}
      }
      masterRafRef.current = requestAnimationFrame(processMasterFrame);
  }, [mode, targetPart]);

  useEffect(() => {
      if (mode === 'master_review') {
          masterRafRef.current = requestAnimationFrame(processMasterFrame);
      }
      return () => {
          if (masterRafRef.current) cancelAnimationFrame(masterRafRef.current);
      }
  }, [mode, processMasterFrame]);

  const registerMasterPose = async () => {
      if (!masterVideoRef.current || !detectorRef.current) return;
      const poses = await detectorRef.current.estimatePoses(masterVideoRef.current);
      if (poses.length > 0) {
          setMasterPose(poses[0]);
          playSound("현재 프레임이 훈련 목표로 등록되었습니다.");
      } else {
          alert("현재 프레임에서 사람을 찾지 못했습니다.");
      }
  };

  const processLiveFrame = useCallback(async () => {
    if (mode !== 'challenge' || !liveVideoRef.current || !liveCanvasRef.current || !detectorRef.current) return;
    
    const video = liveVideoRef.current;
    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      liveRafRef.current = requestAnimationFrame(processLiveFrame);
      return;
    }

    try {
        const poses = await detectorRef.current.estimatePoses(video);
        const canvas = liveCanvasRef.current;
        const ctx = canvas.getContext("2d");

        if (ctx && poses.length > 0) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          const currentPose = poses[0];
          const state = swingStateRef.current;

          drawSkeleton(currentPose, ctx, "rgba(0, 255, 100, 0.8)", targetPart);

          const prevPose = lastPoseRef.current;
          const speed = prevPose ? getMotionSpeed(currentPose, prevPose) : 0;

          if (state === 'idle' || state === 'addressing') {
             if (speed < 2) { 
                stillFramesCountRef.current++;
                if (state === 'idle') updateState('addressing');
                
                if (stillFramesCountRef.current > 45) { 
                   updateState('ready');
                   playSound("레디");
                   livePosesRef.current = [];
                   setLastScore(null);
                }
             } else {
                stillFramesCountRef.current = 0;
                updateState('idle');
             }
          } else if (state === 'ready') {
             if (speed > 10) { 
                updateState('swinging');
                livePosesRef.current.push(currentPose);
             }
          } else if (state === 'swinging') {
             livePosesRef.current.push(currentPose);
             
             if (speed < 3 && livePosesRef.current.length > 15) { 
                updateState('finished');
                
                const swingPoses = livePosesRef.current;
                
                if (masterPose) {
                   let bestPose = swingPoses[0];
                   let bestScore = -1;
                   
                   // 전체 프레임 스캔 (Full Frame Scan): 녹화된 모든 프레임을 마스터 포즈와 비교하여 가장 높은 점수를 찾음
                   swingPoses.forEach(p => {
                      const currentScore = calculatePartSimilarity(p, masterPose, targetPart);
                      if (currentScore > bestScore) {
                         bestScore = currentScore;
                         bestPose = p;
                      }
                   });

                   setLastScore(bestScore);
                   playSound(`일치율 ${bestScore} 퍼센트`);
                } else {
                   playSound("마스터 포즈가 없습니다.");
                }
                
                setTimeout(() => updateState('idle'), 4000);
             }
          }
          lastPoseRef.current = currentPose;
        }
    } catch (e) {}

    liveRafRef.current = requestAnimationFrame(processLiveFrame);
  }, [mode, masterPose, targetPart]);

  useEffect(() => {
    if (mode === 'challenge') {
       liveRafRef.current = requestAnimationFrame(processLiveFrame);
    }
    return () => {
       if (liveRafRef.current) cancelAnimationFrame(liveRafRef.current);
    };
  }, [mode, processLiveFrame]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (file) {
        const url = URL.createObjectURL(file);
        setMasterVideoSrc(url);
        setMode('master_review');
     }
  };

  const handleBack = () => {
      if (mode === 'challenge') {
          setMode('master_review');
          updateState('idle');
      } else if (mode === 'master_review') {
          setMode('setup');
          setMasterVideoSrc(null);
          setMasterPose(null);
      } else {
          router.back();
      }
  };

  return (
    <div className="relative w-full h-[calc(100dvh-70px)] bg-black overflow-hidden flex flex-col touch-none">
      
      <Script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs" onLoad={() => setScriptsLoaded(s => s + 1)} strategy="afterInteractive" />
      <Script src="https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection" onLoad={() => setScriptsLoaded(s => s + 1)} strategy="afterInteractive" />

      {/* Top Bar */}
      <div className="absolute top-4 left-0 z-40 flex items-center justify-between w-full px-4 pointer-events-none">
         <button onClick={handleBack} className="p-2 bg-black/50 text-white rounded-full backdrop-blur-md border border-white/10 pointer-events-auto">
            <ArrowLeft className="w-5 h-5" />
         </button>
         <div className="bg-black/50 px-5 py-1.5 rounded-full backdrop-blur-md border border-white/10 text-white font-bold text-sm pointer-events-auto shadow-xl">
            {mode === 'setup' ? '스윙 뼈대 분석' : mode === 'master_review' ? '마스터 영상 분석' : '내 스윙 분석'}
         </div>
         {mode === 'challenge' ? (
            <button 
               onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')} 
               className="p-2 bg-black/50 text-white rounded-full backdrop-blur-md border border-white/10 pointer-events-auto"
            >
               <SwitchCamera className="w-5 h-5" />
            </button>
         ) : (
            <div className="w-9"></div>
         )}
      </div>

      {/* 1. SETUP MODE */}
      {mode === 'setup' && (
         <div className="flex-1 flex flex-col items-center justify-center p-6 z-40 relative">
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 to-black pointer-events-none"></div>
            <div className="relative z-10 flex flex-col items-center text-center">
                <h2 className="text-white text-3xl font-black mb-4">마스터 영상 선택</h2>
                <p className="text-zinc-400 mb-10 text-sm leading-relaxed max-w-sm">
                   기준이 될 프로의 영상이나<br/>나의 베스트 스윙 영상을 업로드해주세요.
                </p>
                <input type="file" accept="video/*" className="hidden" id="videoUpload" onChange={handleFileUpload} />
                <label 
                   htmlFor="videoUpload"
                   className="px-8 py-4 rounded-2xl font-bold text-lg flex items-center gap-3 shadow-2xl transition-transform bg-brand-navy text-white hover:scale-105 cursor-pointer border border-brand-navy-light"
                >
                   <Video className="w-6 h-6" /> 동영상 파일 선택하기
                </label>
                {!modelLoaded && (
                    <div className="mt-8 text-orange-400 font-bold text-sm animate-pulse flex items-center gap-2">
                        <Activity className="w-4 h-4" /> AI 모델 로딩 중...
                    </div>
                )}
            </div>
         </div>
      )}

      {/* 2. MASTER REVIEW MODE */}
      {mode === 'master_review' && (
         <div className="flex-1 relative flex flex-col w-full h-full bg-zinc-900 pt-16">
             <div className="flex-1 relative bg-black flex items-center justify-center border-b border-zinc-800 overflow-hidden">
                 <TransformWrapper
                    initialScale={1}
                    minScale={1}
                    maxScale={4}
                    centerOnInit
                    pinch={{ step: 5 }}
                    wheel={{ step: 0.1 }}
                 >
                    <TransformComponent 
                        wrapperStyle={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyItems: "center" }}
                        contentStyle={{ width: "100%", height: "100%", position: "relative" }}
                    >
                         <video 
                            ref={masterVideoRef} 
                            src={masterVideoSrc || undefined} 
                            className="absolute inset-0 w-full h-full object-contain pointer-events-none" 
                            playsInline
                            muted
                            autoPlay
                            preload="auto"
                            onLoadedMetadata={(e) => {
                                setMasterDuration(e.currentTarget.duration);
                                e.currentTarget.pause();
                                e.currentTarget.currentTime = 0.01;
                            }}
                         />
                         <canvas ref={masterCanvasRef} className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
                    </TransformComponent>
                 </TransformWrapper>
                 
                 <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm text-white/70 text-[11px] px-2 py-1 rounded shadow-sm pointer-events-none">
                    두 손가락으로 확대/축소
                 </div>
                 
                 {masterPose && (
                    <div className="absolute top-4 right-4 bg-green-500/90 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 animate-in zoom-in">
                        <CheckCircle className="w-4 h-4" /> 훈련 목표 등록됨
                    </div>
                 )}
             </div>

             <div className="bg-zinc-950 px-4 pt-3 pb-2 border-b border-zinc-800">
                 <div className="flex justify-between items-center text-zinc-400 text-[11px] mb-2 font-bold px-1">
                     <div className="flex items-center gap-2">
                         <span>프레임 미세 조정</span>
                         <button 
                             onClick={() => {
                                 if (masterVideoRef.current) {
                                     if (isPlaying) masterVideoRef.current.pause();
                                     else masterVideoRef.current.play();
                                     setIsPlaying(!isPlaying);
                                 }
                             }}
                             className="flex items-center justify-center gap-1 bg-zinc-800 text-white px-2.5 py-1 rounded-md border border-zinc-700 active:scale-95"
                         >
                             {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                             {isPlaying ? "일시정지" : "재생"}
                         </button>
                     </div>
                     <span>가운데 슬라이더나 버튼 활용</span>
                 </div>

                 <div className="flex items-center gap-2 w-full pb-2">
                    <button onClick={() => handleStepFrame(-0.03)} className="bg-zinc-800 text-white rounded-lg px-2.5 py-2 flex-shrink-0 active:scale-95 shadow-sm border border-zinc-700">
                       <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="flex-1 relative">
                        <input 
                           ref={sliderRef}
                           type="range" 
                           min={0} 
                           max={masterDuration || 100} 
                           step={0.01} 
                           defaultValue={0}
                           onChange={(e) => {
                              if (masterVideoRef.current) {
                                  masterVideoRef.current.currentTime = Number(e.target.value);
                              }
                           }}
                           className="w-full h-8 accent-brand-navy"
                        />
                    </div>
                    <button onClick={() => handleStepFrame(0.03)} className="bg-zinc-800 text-white rounded-lg px-2.5 py-2 flex-shrink-0 active:scale-95 shadow-sm border border-zinc-700">
                       <ArrowLeft className="w-4 h-4 rotate-180" />
                    </button>
                 </div>
             </div>

             <div className="bg-zinc-950 p-4 flex flex-col gap-3 shadow-[0_-10px_20px_rgba(0,0,0,0.5)] z-20 pb-6">
                 <div>
                    <span className="text-zinc-400 text-[11px] font-bold block mb-2">타겟 지정 (가로로 스크롤하여 선택)</span>
                    <div className="flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-hide pb-2">
                       {(['all', 'head', 'shoulders', 'upper_body_axis', 'arms', 'hips', 'legs'] as TargetPart[]).map(part => (
                           <button 
                               key={part}
                               onClick={() => setTargetPart(part)}
                               className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${targetPart === part ? 'bg-orange-500 text-white scale-105 border-none' : 'bg-zinc-800 text-zinc-400 border border-zinc-700 active:scale-95'}`}
                           >
                               {part === 'all' ? '전체' : part === 'head' ? '머리' : part === 'shoulders' ? '어깨' : part === 'upper_body_axis' ? '상체 (축)' : part === 'arms' ? '팔 (궤도)' : part === 'hips' ? '골반' : '다리'}
                           </button>
                       ))}
                    </div>
                 </div>

                 <div className="flex gap-2 mt-1">
                    <button 
                       onClick={registerMasterPose}
                       className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-[13px] font-bold transition-colors flex items-center justify-center gap-1.5 border border-zinc-700 shadow-md"
                    >
                       <Pause className="w-4 h-4" /> 멈춘 장면 등록
                    </button>
                   
                   {masterPose && (
                      <button 
                         onClick={() => setMode('challenge')}
                         className="flex-1 py-3 bg-brand-navy hover:bg-brand-navy-light text-white rounded-xl text-[13px] font-bold transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-brand-navy/30 animate-in slide-in-from-right-4"
                      >
                         훈련 시작 <ChevronRight className="w-4 h-4" />
                      </button>
                   )}
                 </div>
             </div>
          </div>
      )}

      {/* 3. CHALLENGE (LIVE) MODE */}
      {mode === 'challenge' && (
         <div className="flex-1 relative w-full h-full bg-black">
             <video ref={liveVideoRef} className={`absolute inset-0 w-full h-full object-cover ${facingMode === 'user' ? 'transform scale-x-[-1]' : ''}`} playsInline muted autoPlay />
             <canvas ref={liveCanvasRef} className={`absolute inset-0 w-full h-full object-cover pointer-events-none ${facingMode === 'user' ? 'transform scale-x-[-1]' : ''}`} />

             {/* Status Overlays */}
             <div className="absolute top-24 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center pointer-events-none w-full px-4 text-center">
                 {swingState === 'addressing' && (
                    <div className="bg-yellow-500/90 backdrop-blur-sm text-black px-6 py-2 rounded-full text-lg font-black animate-pulse shadow-xl">어드레스 유지...</div>
                 )}
                 {swingState === 'ready' && (
                    <div className="bg-green-500/90 backdrop-blur-sm text-white px-8 py-3 rounded-full text-4xl font-black animate-bounce shadow-xl italic tracking-widest">READY!</div>
                 )}
                 {swingState === 'finished' && lastScore !== null && (
                    <div className="bg-black/90 backdrop-blur-xl px-10 py-8 rounded-3xl border border-white/20 shadow-[0_0_40px_rgba(0,0,0,0.5)] flex flex-col items-center animate-in zoom-in duration-300">
                       <div className="text-zinc-400 text-sm font-black tracking-widest mb-2 bg-zinc-800/50 px-3 py-1 rounded-full">{targetPart === 'all' ? '전체' : targetPart === 'head' ? '머리' : targetPart === 'shoulders' ? '어깨' : targetPart === 'upper_body_axis' ? '상체 (축)' : targetPart === 'hips' ? '골반' : targetPart === 'legs' ? '다리' : '팔'} 일치율</div>
                       <div className={`text-7xl font-black leading-none ${lastScore >= 80 ? 'text-green-400' : lastScore >= 60 ? 'text-orange-400' : 'text-red-400'}`}>
                          {lastScore}<span className="text-3xl text-white/50 ml-1">%</span>
                       </div>
                    </div>
                 )}
             </div>

             {/* Bottom Navigation Buttons */}
             <div className="absolute bottom-8 left-0 w-full flex justify-center gap-3 px-4 z-40">
                 <button 
                    onClick={() => { setMode('master_review'); updateState('idle'); }}
                    className="flex-1 max-w-[180px] py-3.5 bg-black/60 backdrop-blur-md text-white border border-white/20 rounded-2xl font-bold text-sm shadow-xl flex items-center justify-center gap-2 hover:bg-black/80 transition-all"
                 >
                    <ArrowLeft className="w-4 h-4" /> 마스터 스윙 가기
                 </button>
                 <button 
                    onClick={() => router.back()}
                    className="flex-1 max-w-[180px] py-3.5 bg-red-500/80 backdrop-blur-md text-white border border-red-400/50 rounded-2xl font-bold text-sm shadow-xl flex items-center justify-center gap-2 hover:bg-red-500 transition-all"
                 >
                    <X className="w-4 h-4" /> 훈련 종료
                 </button>
             </div>
         </div>
      )}

    </div>
  );
}
