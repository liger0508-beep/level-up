"use client";

import React, { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { ArrowLeft, Play, Square, Settings, X, RotateCcw, ChevronLeft, Check, SwitchCamera } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { AthleteSearch } from "@/components/ui/AthleteSearch";
import { createClient } from "@/lib/supabase/client";



export const PUTT_CONFIG: Record<string, {name: string, uiName: string, target: number, total: number, isConsecutive: boolean, isHoleOut: boolean}> = {
    '9m-plus-putt': { name: '9미터 이상 퍼팅', uiName: '9m 이상 퍼팅', target: 5, total: 6, isConsecutive: false, isHoleOut: true },
    '7-8m-putt': { name: '7에서 8미터 퍼팅', uiName: '7~8m 퍼팅', target: 2, total: 6, isConsecutive: false, isHoleOut: false },
    '4-6m-putt': { name: '4에서 6미터 퍼팅', uiName: '4~6m 퍼팅', target: 3, total: 6, isConsecutive: false, isHoleOut: false },
    '2-3m-putt': { name: '2에서 3미터 퍼팅', uiName: '2~3m 퍼팅', target: 4, total: 6, isConsecutive: false, isHoleOut: false },
    '1m-putt': { name: '1미터 퍼팅', uiName: '1m 퍼팅', target: 6, total: 6, isConsecutive: true, isHoleOut: false }
};

export const APPROACH_CONFIG: Record<string, {name: string, uiName: string, targetDistance: number}> = {
    '180m-plus': { name: '180미터 이상', uiName: '180m 이상', targetDistance: 7 },
    '150-179m': { name: '150~179미터', uiName: '150~179m', targetDistance: 5 },
    '120-149m': { name: '120~149미터', uiName: '120~149m', targetDistance: 4 },
    '90-119m': { name: '90~119미터', uiName: '90~119m', targetDistance: 3 },
    'pitch-shot': { name: '피치샷', uiName: '피치샷', targetDistance: 2 }
};

let activeAudioSource: AudioBufferSourceNode | null = null;
export let globalSelectedVoiceURI: string | null = null;

const playSuccessSound = async (text: string = "성공", onEnd?: () => void) => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) throw new Error("AudioContext not supported");
    
    let ctx = (window as any).globalAudioContext;
    if (!ctx) {
        ctx = new AudioContext();
        (window as any).globalAudioContext = ctx;
    }
    if (ctx.state === 'suspended') await ctx.resume();
    
    const response = await fetch(`/api/tts?text=${encodeURIComponent(text)}`);
    if (!response.ok) throw new Error("TTS fetch failed");
    
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    
    if (activeAudioSource) {
      try {
        activeAudioSource.stop();
        activeAudioSource.disconnect();
      } catch (e) {}
    }
    
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = 1.09; // 조금 빠르게 재생
    source.connect(ctx.destination);
    activeAudioSource = source;
    
    source.onended = () => {
       if (activeAudioSource === source) {
         activeAudioSource = null;
       }
       if (onEnd) onEnd();
    };
    source.start(0);
  } catch (error) {
    console.error("Web Audio API TTS failed:", error);
    // Fallback to browser TTS if fetch fails
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      utterance.onend = () => { if (onEnd) onEnd(); };
      window.speechSynthesis.speak(utterance);
    } else {
      if (onEnd) onEnd();
    }
  }
};

const MOTION_THRESHOLD = 50;
const COOLDOWN_MS = 2000;



function SwingTestContent() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [successCount, setSuccessCount] = useState(0);
  const successCountRef = useRef(0);
  const [isSuccess, setIsSuccess] = useState(false);
  const isSuccessRef = useRef(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  
  // Settings
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type");
  const recordId = searchParams.get("recordId");

  const [mode, setMode] = useState<'target' | 'putting' | 'shot' | 'swing-path' | 'tee-shot' | '180m-plus' | '150-179m' | '120-149m' | '90-119m' | 'pitch-shot' | '9m-plus-putt' | '7-8m-putt' | '4-6m-putt' | '2-3m-putt' | '1m-putt' | 'lesson_review'>('target');
  
  const [lessonReviewComments, setLessonReviewComments] = useState<string[]>([]);
  const [lessonReviewGoal, setLessonReviewGoal] = useState<number>(10);
  const [lessonReviewGoalType, setLessonReviewGoalType] = useState<"count" | "time">("count");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [hasFirstCommentPlayed, setHasFirstCommentPlayed] = useState(false);
  const hasFirstCommentPlayedRef = useRef(false);
  const lessonReviewCommentIndexRef = useRef(0);
  const initialCountRef = useRef(0);
  const initialElapsedRef = useRef(0);
  
  useEffect(() => {
     if (typeParam === 'lesson_review' && recordId) {
         setMode('lesson_review');
         setHasSelected(true);
         setBoxWidth(120);
         setBoxHeight(120);
         setOffsetY(200);
         lessonReviewCommentIndexRef.current = 0;
         startCamera();
         const initLessonReview = async () => {
             try {
                 const supabase = createClient();
                 const { data: recordData } = await supabase.from("records").select("template_settings, completion_logs").eq("id", recordId).single();
                 if (recordData?.template_settings?.[0]) {
                     const settings = recordData.template_settings[0];
                     const comments = settings.comments?.filter(Boolean) || ["레슨 복기 훈련을 시작합니다."];
                     const goalVal = settings.goalValue || 10;
                     const gType = settings.goalType || "count";
                     
                     setLessonReviewComments(comments);
                     setLessonReviewGoal(goalVal);
                     setLessonReviewGoalType(gType);
                 }
                 
                 if (recordData?.completion_logs) {
                     let logs: any[] = [];
                     if (Array.isArray(recordData.completion_logs)) logs = recordData.completion_logs;
                     else if (typeof recordData.completion_logs === 'string') {
                         try { logs = JSON.parse(recordData.completion_logs); } catch (e) {}
                     }
                     
                     const sessionLogs = logs.filter((log: any) => log.type === 'lesson_review_session');
                     
                     let totalCount = 0;
                     let totalTime = 0;
                     sessionLogs.forEach((log: any) => {
                         totalCount += (log.count || 0);
                         totalTime += (log.elapsedSeconds || 0);
                     });
                     
                     setSuccessCount(totalCount);
                     successCountRef.current = totalCount;
                     initialCountRef.current = totalCount;
                     setElapsedSeconds(totalTime);
                     initialElapsedRef.current = totalTime;
                 }
             } catch (e) {
                 console.error("Failed to load lesson review settings", e);
             }
         };
         initLessonReview();
     }
  }, [typeParam, recordId]);

  const [swingPathType, setSwingPathType] = useState<'in-out' | 'out-in' | 'in-to-in'>('in-out');
  const [isDetecting, setIsDetecting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isDetecting && mode === 'lesson_review' && lessonReviewGoalType === 'time' && hasFirstCommentPlayed) {
       timer = setInterval(() => {
          setElapsedSeconds(prev => {
             const next = prev + 1;
             const goalSeconds = lessonReviewGoal * 60;
             if (next === goalSeconds) {
                 playSuccessSound("목표 시간을 달성했습니다. 수고하셨습니다.");
             }
             return next;
          });
       }, 1000);
    }
    return () => clearInterval(timer);
  }, [isDetecting, mode, lessonReviewGoalType, lessonReviewGoal, hasFirstCommentPlayed]);
  const [showResult, setShowResult] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isVoicePlaying, setIsVoicePlaying] = useState(false);
  const [teeShotStats, setTeeShotStats] = useState({ fairway: 0, rough: 0, penalty: 0 });
  const teeShotStatsRef = useRef({ fairway: 0, rough: 0, penalty: 0 });
  
  // Voice Settings State
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState<string>("");

  useEffect(() => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          const updateVoices = () => {
              const voices = window.speechSynthesis.getVoices().filter(v => v.lang.includes('ko'));
              setAvailableVoices(voices);
              if (voices.length > 0 && !globalSelectedVoiceURI) {
                  const preferredVoices = ['SunHi', 'Yuna', 'Sora', 'Google 한국의', 'Heami'];
                  let defaultVoice = null;
                  for (const name of preferredVoices) {
                      defaultVoice = voices.find(v => v.name.includes(name));
                      if (defaultVoice) break;
                  }
                  if (!defaultVoice) defaultVoice = voices[0];
                  
                  if (defaultVoice) {
                      setVoiceURI(defaultVoice.voiceURI);
                      globalSelectedVoiceURI = defaultVoice.voiceURI;
                  }
              } else if (globalSelectedVoiceURI) {
                  setVoiceURI(globalSelectedVoiceURI);
              }
          };
          window.speechSynthesis.onvoiceschanged = updateVoices;
          updateVoices();
      }
  }, []);
  
  const [boxWidth, setBoxWidth] = useState(200);
  const [boxHeight, setBoxHeight] = useState(200);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  // Blob & Trajectory State
  const [blob, setBlob] = useState<{x: number, y: number, w: number, h: number, isValid: boolean, reason: string} | null>(null);
  const [trajectoryUi, setTrajectoryUi] = useState<{x: number, y: number}[]>([]);

  // Refs for animation frame loop
  const prevImageDataRef = useRef<ImageData | null>(null);
  const lastSuccessTimeRef = useRef<number>(0);
  const requestRef = useRef<number>(0);
  
  const blobTimeRef = useRef<number>(0);
  const lastValidBlobTimeRef = useRef<number>(0);
  const trajectoryRef = useRef<{x: number, y: number}[]>([]);
  
  const shotStateRef = useRef<'empty' | 'moving_in' | 'placed' | 'moving_out'>('empty');
  const placedBgDataRef = useRef<Uint8ClampedArray | null>(null);
  const recentMotionsRef = useRef<{time: number, motion: number}[]>([]);
  const practiceSwingCountRef = useRef<number>(0);
  const lastPracticeSwingTimeRef = useRef<number>(0);
  const lastMovementTimeRef = useRef<number>(0);
  const batchShotsRef = useRef<number>(0);
  const totalShotsRef = useRef<number>(0);

  const teeShotCenterRef = useRef<{x: number, y: number} | null>(null);
  const teeShotStillTimeRef = useRef<number>(0);

  const settingsRef = useRef({ boxWidth, boxHeight, offsetX, offsetY, isDetecting, mode, swingPathType, isListening, isVoicePlaying, facingMode, lessonReviewComments, lessonReviewGoal, lessonReviewGoalType });

  const [hasSelected, setHasSelected] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<string>("");
  const [selectedTraining, setSelectedTraining] = useState<'shot' | 'tee-shot' | '180m-plus' | '150-179m' | '120-149m' | '90-119m' | 'pitch-shot' | '9m-plus-putt' | '7-8m-putt' | '4-6m-putt' | '2-3m-putt' | '1m-putt' | ''>('');

  const toggleMode = (newMode: 'target' | 'putting' | 'shot' | 'swing-path' | 'tee-shot' | '180m-plus' | '150-179m' | '120-149m' | '90-119m' | 'pitch-shot' | '9m-plus-putt' | '7-8m-putt' | '4-6m-putt' | '2-3m-putt' | '1m-putt' | 'lesson_review') => {
    setMode(newMode);
    if (newMode === 'putting') {
      setBoxWidth(150);
      setBoxHeight(150);
      setOffsetX(0);
      setOffsetY(0);
    } else if (newMode === 'shot' || newMode === 'swing-path' || newMode === 'tee-shot' || newMode === 'lesson_review' || APPROACH_CONFIG[newMode] || PUTT_CONFIG[newMode]) {
      setBoxWidth(120);
      setBoxHeight(120);
      setOffsetX(100);
      setOffsetY(200);
    } else {
      setBoxWidth(200);
      setBoxHeight(200);
      setOffsetX(0);
      setOffsetY(0);
    }
    trajectoryRef.current = [];
    setTrajectoryUi([]);
    shotStateRef.current = 'empty';
    setSuccessCount(0);
    successCountRef.current = 0;
    totalShotsRef.current = 0;
    batchShotsRef.current = 0;
    setTeeShotStats({ fairway: 0, rough: 0, penalty: 0 });
    teeShotStatsRef.current = { fairway: 0, rough: 0, penalty: 0 };
    teeShotCenterRef.current = null;
    setShowResult(false);
    setHasFirstCommentPlayed(false);
    hasFirstCommentPlayedRef.current = false;
  };

  const saveLessonReviewProgress = async () => {
      if (mode !== 'lesson_review' || !recordId) return;
      if (successCountRef.current === 0 && elapsedSeconds === 0) return;
      
      try {
          const supabase = createClient();
          const { data: recordData } = await supabase.from("records").select("completion_logs").eq("id", recordId).single();
          
          let currentLogs: any[] = [];
          if (Array.isArray(recordData?.completion_logs)) currentLogs = recordData.completion_logs;
          else if (typeof recordData?.completion_logs === 'string') {
              try { currentLogs = JSON.parse(recordData.completion_logs); } catch (e) { currentLogs = [recordData.completion_logs]; }
          }
              
          const logEntry = {
              timestamp: new Date().toISOString(),
              type: 'lesson_review_session',
              count: successCountRef.current - initialCountRef.current,
              elapsedSeconds: Math.max(0, elapsedSeconds - initialElapsedRef.current)
          };
          
          const newLogs = [...currentLogs, logEntry];
          await supabase.from("records").update({ completion_logs: newLogs }).eq("id", recordId);
          
          initialCountRef.current = successCountRef.current;
          initialElapsedRef.current = elapsedSeconds;
      } catch (e) {
          console.error("Failed to save progress", e);
      }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode } },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.warn("Video play error:", e));
      }
      setHasCameraPermission(true);
    } catch (err) {
      console.error("Error accessing camera:", err);
      setHasCameraPermission(false);
    }
  };

  useEffect(() => {
      const handleBeforeUnload = () => {
          const params = new URLSearchParams(window.location.search);
          if (params.get('type') === 'lesson_review') {
              saveLessonReviewProgress();
          }
      };
      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        const params = new URLSearchParams(window.location.search);
        if (params.get('type') === 'lesson_review') {
            saveLessonReviewProgress();
        }
        if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (hasSelected && hasCameraPermission) {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
      startCamera();
    }
  }, [facingMode]);

  // Sync state to ref
  useEffect(() => {
    settingsRef.current = { boxWidth, boxHeight, offsetX, offsetY, isDetecting, mode, swingPathType, isListening, isVoicePlaying, facingMode, lessonReviewComments, lessonReviewGoal, lessonReviewGoalType };
    if (!isDetecting) {
      prevImageDataRef.current = null;
      setBlob(null);
      trajectoryRef.current = [];
      setTrajectoryUi([]);
    }
  }, [boxWidth, boxHeight, offsetX, offsetY, isDetecting, mode, swingPathType, isListening, isVoicePlaying, facingMode]);

  const handlePuttResult = useCallback((isRetry = false) => {
      const currentMode = settingsRef.current.mode;
      const conf = PUTT_CONFIG[currentMode];
      if (!conf) return;

      setIsListening(true);
      let promptText = "홀인입니까?";
      if (conf.isHoleOut) promptText = "홀아웃 거리로 붙였습니까?";
      if (isRetry) promptText = "다시 말해주세요";

      playSuccessSound(promptText, () => {
          const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
          if (!SpeechRecognition) {
              setIsListening(false);
              playSuccessSound("음성 인식을 지원하지 않는 브라우저입니다.");
              return;
          }
          const recognition = new SpeechRecognition();
          recognition.lang = 'ko-KR';
          recognition.interimResults = true;
          recognition.maxAlternatives = 1;
          
          let handled = false;
          
          recognition.onresult = (event: any) => {
              if (handled) return;
              
              let speechResult = '';
              for (let i = event.resultIndex; i < event.results.length; ++i) {
                  speechResult += event.results[i][0].transcript;
              }
              speechResult = speechResult.trim();
              if (!speechResult) return;
              console.log("Putt Recognized:", speechResult);
              
              let isValidResult = false;
              let feedbackSound = "";
              let willShowResult = false;
              
              const isMatch = (words: string[]) => words.some(w => speechResult.includes(w));
              
              if (isMatch(["다시", "취소", "잘못", "아니야"])) {
                  totalShotsRef.current -= 1;
                  feedbackSound = "취소되었습니다. 다시 준비해주세요.";
                  isValidResult = true;
              } else if (isMatch(["성공", "송공", "선공", "상공", "성동", "천공", "전공", "청공", "성곰", "선곰", "천곰", "맞아", "응", "예", "적중", "홀인", "들어갔어", "붙였어", "페어웨이", "어", "어캐", "음", "스공", "공", "성", "선", "에", "이", "오", "우", "하", "호", "후", "읏", "앗", "흡"])) {
                  batchShotsRef.current += 1;
                  successCountRef.current += 1;
                  const nextSuccess = successCountRef.current;
                  setSuccessCount(nextSuccess);
                  
                  if (conf.isConsecutive) {
                      if (nextSuccess >= conf.target) {
                          const hitRate = Math.round((conf.target / totalShotsRef.current) * 100);
                          feedbackSound = `${conf.name} 복습 훈련 목표를 100% 달성했습니다. 오늘 훈련은 총 ${totalShotsRef.current}개 중 ${conf.target}개를 홀인하여 성공률은 ${hitRate}%였습니다. 수고하셨습니다.`;
                          willShowResult = true;
                      } else {
                          feedbackSound = `나이스 인. ${nextSuccess}개 연속 성공했습니다.`;
                      }
                  } else {
                      if (nextSuccess >= conf.target) {
                          const hitRate = Math.round((nextSuccess / totalShotsRef.current) * 100);
                          const actionText = conf.isHoleOut ? "홀아웃 거리로 붙여" : "홀인하여";
                          feedbackSound = `${conf.name} 복습 훈련 목표를 100% 달성했습니다. 오늘 훈련은 총 ${totalShotsRef.current}개 중 ${nextSuccess}개를 ${actionText} 성공률은 ${hitRate}%였습니다. 수고하셨습니다.`;
                          willShowResult = true;
                      } else {
                          const actionPrefix = conf.isHoleOut ? "나이스 퍼트." : "나이스 인.";
                          feedbackSound = `${actionPrefix} ${batchShotsRef.current}개 중 ${nextSuccess}개 성공했습니다.`;
                      }
                  }
                  isValidResult = true;
              } else if (isMatch(["실패", "아니", "안", "벗어났어", "못", "안들어갔어"])) {
                  batchShotsRef.current += 1;
                  const prev = successCountRef.current;
                  
                  if (conf.isConsecutive) {
                      feedbackSound = "실패했습니다. 다시 도전해 주세요.";
                      batchShotsRef.current = 0;
                      successCountRef.current = 0;
                      setSuccessCount(0);
                  } else {
                      const misses = batchShotsRef.current - prev;
                      const maxAllowedMisses = conf.total - conf.target;
                      
                      if (misses > maxAllowedMisses) {
                          feedbackSound = `${batchShotsRef.current}개 중 ${prev}개 성공입니다. 처음부터 다시 도전합니다.`;
                          batchShotsRef.current = 0;
                          successCountRef.current = 0;
                          setSuccessCount(0);
                      } else {
                          feedbackSound = `${batchShotsRef.current}개 중 ${prev}개 성공입니다.`;
                      }
                  }
                  isValidResult = true;
              }
              
              if (isValidResult) {
                  handled = true;
                  setIsListening(false);
                  playSuccessSound(feedbackSound, () => {
                      if (willShowResult) {
                          setShowResult(true);
                      }
                  });
              }
          };
          
          recognition.onerror = () => {
              if (handled) return;
              handled = true;
              handlePuttResult(true);
          };
          
          recognition.onnomatch = () => {
              if (handled) return;
              handled = true;
              handlePuttResult(true);
          };
          
          recognition.onend = () => {
              if (!handled) {
                 handled = true;
                 handlePuttResult(true);
              }
          };
          
          recognition.start();
          setTimeout(() => {
              if (!handled) {
                  recognition.stop();
              }
          }, 5000);
      });
  }, []);

  const handleApproachResult = useCallback((isRetry = false) => {
      const currentMode = settingsRef.current.mode;
      const conf = APPROACH_CONFIG[currentMode];
      if (!conf) return;

      setIsListening(true);
      const promptText = isRetry ? "다시 말해주세요" : `${conf.targetDistance}미터 이내로 적중했습니까?`;
      playSuccessSound(promptText, () => {
          const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
          if (!SpeechRecognition) {
              setIsListening(false);
              playSuccessSound("음성 인식을 지원하지 않는 브라우저입니다.");
              return;
          }
          const recognition = new SpeechRecognition();
          recognition.lang = 'ko-KR';
          recognition.interimResults = true;
          recognition.maxAlternatives = 1;
          
          let handled = false;
          
          recognition.onresult = (event: any) => {
              if (handled) return;
              
              let speechResult = '';
              for (let i = event.resultIndex; i < event.results.length; ++i) {
                  speechResult += event.results[i][0].transcript;
              }
              speechResult = speechResult.trim();
              if (!speechResult) return;
              console.log("Approach Recognized:", speechResult);
              
              let isValidResult = false;
              let feedbackSound = "";
              let willShowResult = false;
              
              const isMatch = (words: string[]) => words.some(w => speechResult.includes(w));
              
              if (isMatch(["다시", "취소", "잘못", "아니야"])) {
                  totalShotsRef.current -= 1;
                  feedbackSound = "취소되었습니다. 다시 준비해주세요.";
                  isValidResult = true;
              } else if (isMatch(["성공", "송공", "선공", "상공", "성동", "천공", "전공", "청공", "성곰", "선곰", "천곰", "맞아", "응", "예", "적중", "홀인", "들어갔어", "붙였어", "페어웨이", "어", "어캐", "음", "스공", "공", "성", "선", "아", "에", "이", "오", "우", "하", "호", "후", "읏", "앗", "흡"])) {
                  successCountRef.current += 1;
                  const next = successCountRef.current;
                  setSuccessCount(next);
                  if (next >= 20) {
                      const hitRate = Math.round((20 / totalShotsRef.current) * 100);
                      feedbackSound = `${conf.name} 복습 훈련 목표를 100% 달성했습니다. 오늘 훈련은 총 ${totalShotsRef.current}개 중 20개를 ${conf.targetDistance}미터 이내로 적중하여 성공률은 ${hitRate}%였습니다. 수고하셨습니다.`;
                      willShowResult = true;
                  } else {
                      feedbackSound = `굿샷. ${next}개 성공했습니다. ${20 - next}개 남았습니다.`;
                  }
                  isValidResult = true;
              } else if (isMatch(["실패", "아니", "안", "벗어났어"])) {
                  const prev = successCountRef.current;
                  feedbackSound = `다시 도전해 주세요. ${20 - prev}개 남았습니다.`;
                  isValidResult = true;
              }
              
              if (isValidResult) {
                  handled = true;
                  setIsListening(false);
                  playSuccessSound(feedbackSound, () => {
                      if (willShowResult) {
                          setShowResult(true);
                      }
                  });
              }
          };
          
          recognition.onerror = () => {
              if (handled) return;
              handled = true;
              handleApproachResult(true);
          };
          
          recognition.onnomatch = () => {
              if (handled) return;
              handled = true;
              handleApproachResult(true);
          };
          
          recognition.onend = () => {
              if (!handled) {
                 handled = true;
                 handleApproachResult(true);
              }
          };
          
          recognition.start();
          setTimeout(() => {
              if (!handled) {
                  recognition.stop();
              }
          }, 5000);
      });
  }, []);

  const handleTeeShotResult = useCallback((isRetry = false) => {
      setIsListening(true);
      const promptText = isRetry ? "다시 말해주세요" : "성공 인가요?";
      playSuccessSound(promptText, () => {
          const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
          if (!SpeechRecognition) {
              setIsListening(false);
              playSuccessSound("음성 인식을 지원하지 않는 브라우저입니다.");
              return;
          }
          const recognition = new SpeechRecognition();
          recognition.lang = 'ko-KR';
          recognition.interimResults = true;
          recognition.maxAlternatives = 1;
          
          let handled = false;
          
          recognition.onresult = (event: any) => {
              if (handled) return;
              
              let speechResult = '';
              for (let i = event.resultIndex; i < event.results.length; ++i) {
                  speechResult += event.results[i][0].transcript;
              }
              speechResult = speechResult.trim();
              if (!speechResult) return;
              console.log("Recognized:", speechResult);
              
              let isValidResult = false;
              let feedbackSound = "";
              let willShowResult = false;
              
              const isMatch = (words: string[]) => words.some(w => speechResult.includes(w));
              
              if (isMatch(["다시", "취소", "잘못", "아니야"])) {
                  totalShotsRef.current -= 1;
                  feedbackSound = "취소되었습니다. 다시 준비해주세요.";
                  isValidResult = true;
              } else if (isMatch(["성공", "송공", "선공", "상공", "성동", "천공", "전공", "청공", "성곰", "선곰", "천곰", "맞아", "응", "예", "적중", "홀인", "들어갔어", "붙였어", "페어웨이", "어", "어캐", "음", "스공", "공", "성", "선", "아", "에", "이", "오", "우", "하", "호", "후", "읏", "앗", "흡"])) {
                  successCountRef.current += 1;
                  const next = successCountRef.current;
                  setSuccessCount(next);
                  if (totalShotsRef.current >= 10) {
                      const hitRate = Math.round((next / totalShotsRef.current) * 100);
                      feedbackSound = `티샷 정확도 훈련을 완료했습니다. 총 10개 중 ${next}개 성공하여 페어웨이 안착률은 ${hitRate}%입니다. 수고하셨습니다.`;
                      willShowResult = true;
                  } else {
                      feedbackSound = `굿샷. 총 ${next}개 성공했습니다. ${10 - totalShotsRef.current}개 남았습니다.`;
                  }
                  isValidResult = true;
              } else if (isMatch(["실패", "아니", "러프", "해저드", "패널티", "오비", "죽었어"])) {
                  const prev = successCountRef.current;
                  if (totalShotsRef.current >= 10) {
                      const hitRate = Math.round((prev / totalShotsRef.current) * 100);
                      feedbackSound = `티샷 정확도 훈련을 완료했습니다. 총 10개 중 ${prev}개 성공하여 페어웨이 안착률은 ${hitRate}%입니다. 수고하셨습니다.`;
                      willShowResult = true;
                  } else {
                      feedbackSound = `다시 도전해 주세요. 총 ${prev}개 성공했습니다. ${10 - totalShotsRef.current}개 남았습니다.`;
                  }
                  isValidResult = true;
              }
              
              if (isValidResult) {
                  handled = true;
                  setIsListening(false);
                  playSuccessSound(feedbackSound, () => {
                      if (willShowResult) {
                          setShowResult(true);
                      }
                  });
              }
          };
          
          recognition.onerror = () => {
              if (handled) return;
              handled = true;
              handleTeeShotResult(true);
          };
          
          recognition.onnomatch = () => {
              if (handled) return;
              handled = true;
              handleTeeShotResult(true);
          };
          
          recognition.onend = () => {
              if (!handled) {
                 handled = true;
                 handleTeeShotResult(true);
              }
          };
          
          recognition.start();
          setTimeout(() => {
              if (!handled) {
                  recognition.stop();
              }
          }, 5000);
      });
  }, []);

  const processFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      requestRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const { boxWidth, boxHeight, offsetX, offsetY, isDetecting, mode, swingPathType, isListening, isVoicePlaying, lessonReviewComments, lessonReviewGoal, lessonReviewGoalType } = settingsRef.current;

    if (!isDetecting || showSettings || isListening || isVoicePlaying) {
      requestRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    if (!ctx) return;

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    
    let startX = (videoWidth - boxWidth) / 2 + offsetX;
    let startY = (videoHeight - boxHeight) / 2 + offsetY;

    startX = Math.max(0, Math.min(startX, videoWidth - boxWidth));
    startY = Math.max(0, Math.min(startY, videoHeight - boxHeight));

    if (canvas.width !== boxWidth) canvas.width = boxWidth;
    if (canvas.height !== boxHeight) canvas.height = boxHeight;

    ctx.drawImage(
      video,
      startX, startY, boxWidth, boxHeight,
      0, 0, boxWidth, boxHeight
    );

    const currentImageData = ctx.getImageData(0, 0, boxWidth, boxHeight);

    if (prevImageDataRef.current && prevImageDataRef.current.width === boxWidth && prevImageDataRef.current.height === boxHeight) {
      const now = Date.now();
      let diffPixels = 0;
      let minX = boxWidth, minY = boxHeight, maxX = 0, maxY = 0;
      
      const data = currentImageData.data;
      const prevData = prevImageDataRef.current.data;

      // Calculate frame-to-frame motion (percentage of pixels with significant change)
      let changedPixels = 0;
      const step = 16; 
      for (let i = 0; i < data.length; i += step) {
          const curY = (data[i] + data[i+1] + data[i+2]) / 3;
          const prevY = (prevData[i] + prevData[i+1] + prevData[i+2]) / 3;
          if (Math.abs(curY - prevY) > 25) {
              changedPixels++;
          }
      }
      const totalSampled = data.length / step;
      const frameMotion = (changedPixels / totalSampled) * 100;
      
      recentMotionsRef.current.push({ time: now, motion: frameMotion });
      recentMotionsRef.current = recentMotionsRef.current.filter(m => now - m.time < 1500);

      let searchMinX = 0, searchMaxX = boxWidth;
      let searchMinY = 0, searchMaxY = boxHeight;

      if ((mode === 'tee-shot' || mode === 'shot' || mode === 'swing-path' || APPROACH_CONFIG[mode] || PUTT_CONFIG[mode]) && 
          (shotStateRef.current === 'placed' || shotStateRef.current === 'moving_out') && 
          teeShotCenterRef.current) {
          // 레디 상태가 되면 공이 놓였던 좌표 주변(±25픽셀)만 집중 검사하여 다른 곳(신발, 클럽 등)의 간섭을 원천 차단
          const cx = Math.floor(teeShotCenterRef.current.x);
          const cy = Math.floor(teeShotCenterRef.current.y);
          searchMinX = Math.max(0, cx - 25);
          searchMaxX = Math.min(boxWidth, cx + 25);
          searchMinY = Math.max(0, cy - 25);
          searchMaxY = Math.min(boxHeight, cy + 25);
      }

      // 속도를 위해 가로세로 2픽셀씩 건너뛰며 검사
      for (let y = searchMinY; y < searchMaxY; y += 2) {
        for (let x = searchMinX; x < searchMaxX; x += 2) {
          const i = (y * boxWidth + x) * 4;
          // 모션(diff) 대신 정적 프레임에서 밝은 픽셀(공) 자체를 바로 찾습니다.
          const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
          
          if (brightness > 160) { // 밝은 객체 (공)
            diffPixels++; // 변수 재사용
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      const searchBoxWidth = searchMaxX - searchMinX;
      const searchBoxHeight = searchMaxY - searchMinY;
      const checkedPixels = (searchBoxWidth * searchBoxHeight) / 4;
      const diffPercentage = diffPixels / checkedPixels;

      if (diffPercentage > 0.002) {
         const width = maxX - minX;
         const height = maxY - minY;
         const boundingArea = width * height;
         const boxArea = boxWidth * boxHeight;
         
         const areaPercentage = boundingArea / boxArea;
         const aspectRatio = width > height ? width / height : height / width;

         const fillFactor = diffPixels / (boundingArea / 4);

         let isValid = true;
         let reason = "정지된 공 인식됨";

         const isPlaced = shotStateRef.current === 'placed';
         const isFrontCam = facingMode === 'user';
         const scaleFactor = isFrontCam ? 1.8 : 1.0;

         if (isFrontCam) {
            if (areaPercentage > 0.85) {
                isValid = false;
                reason = "크기 초과 (박스에 너무 꽉 참)";
            } else if (width < 10 || height < 10) {
                isValid = false;
                reason = "너무 작음";
            }
         } else {
             const maxAllowedWidth = (isPlaced ? 120 : 70) * scaleFactor;
             const maxAllowedHeight = (isPlaced ? 120 : 70) * scaleFactor;
             const maxAllowedArea = (isPlaced ? 0.45 : 0.15) * scaleFactor;

             if (areaPercentage > maxAllowedArea || width > maxAllowedWidth || height > maxAllowedHeight) {
                isValid = false;
                reason = "크기 초과 (발/손 등)";
             } else if (!isPlaced && (aspectRatio > 1.5 || aspectRatio < 0.6)) {
                isValid = false;
                reason = "둥글지 않음 (비율 안맞음)";
             } else if (width < 5 || height < 5) {
                isValid = false;
                reason = "너무 작음 (노이즈)";
             } else if (!isPlaced && fillFactor < 0.5) {
                isValid = false;
                reason = "밀도 부족 (공 아님)";
             }
         }

         blobTimeRef.current = now;
         setBlob({ x: minX, y: minY, w: width, h: height, isValid, reason });

         

         if (isValid) {
            lastValidBlobTimeRef.current = now;
            const cx = minX + width / 2;
            const cy = minY + height / 2;

            if (mode === 'tee-shot' || mode === 'shot' || mode === 'swing-path' || APPROACH_CONFIG[mode] || PUTT_CONFIG[mode]) {
                const isPlaced = shotStateRef.current === 'placed';
                
                if (!isPlaced) {
                    const lastCenter = teeShotCenterRef.current;
                    if (lastCenter) {
                        const dist = Math.hypot(cx - lastCenter.x, cy - lastCenter.y);
                        if (dist > 15) {
                            teeShotStillTimeRef.current = now;
                        }
                    } else {
                        teeShotStillTimeRef.current = now;
                    }
                    teeShotCenterRef.current = {x: cx, y: cy};
                }
            }

            if (mode === 'putting') {
               const currentTraj = trajectoryRef.current;
               
               if (currentTraj.length === 0) {
                  trajectoryRef.current = [{x: cx, y: cy}];
                  setTrajectoryUi([...trajectoryRef.current]);
               } else {
                  const lastPt = currentTraj[currentTraj.length - 1];
                  const dist = Math.hypot(cx - lastPt.x, cy - lastPt.y);
                  
                  // 너무 큰 순간 이동(노이즈) 필터링
                  if (dist < 100) {
                     trajectoryRef.current.push({x: cx, y: cy});
                     setTrajectoryUi([...trajectoryRef.current]);
                  }
               }
            } else if (mode === 'target') {
               // Target Mode Logic (즉시 성공)
               if (now - lastSuccessTimeRef.current > COOLDOWN_MS) {
                  lastSuccessTimeRef.current = now;
                  successCountRef.current += 1;
                  setSuccessCount(successCountRef.current);
                  setIsSuccess(true);
                  isSuccessRef.current = true;
                  
                  playSuccessSound("성공");
                  
                  setTimeout(() => {
                     setIsSuccess(false);
                     isSuccessRef.current = false;
                  }, 1000);
               }
            } else if (mode === 'shot' || mode === 'swing-path' || mode === 'tee-shot' || APPROACH_CONFIG[mode] || PUTT_CONFIG[mode] || mode === 'lesson_review') {
               if (shotStateRef.current === 'empty' || shotStateRef.current === 'moving_out') {
                  shotStateRef.current = 'moving_in';
                  teeShotStillTimeRef.current = now;
                  if (mode === 'swing-path') trajectoryRef.current = [{x: cx, y: cy}];
               } else if (shotStateRef.current === 'placed') {
                  // 레디 상태 유지
               }
               
               if (mode === 'swing-path') {
                  trajectoryRef.current.push({x: cx, y: cy});
               }
            }
         }
      }

      // 궤적 분석 및 성공/실패 판정: 공이 멈췄거나 범위를 벗어났을 때 (500ms 동안 움직임 없음)
      if (!isSuccessRef.current && trajectoryRef.current.length > 0 && now - lastValidBlobTimeRef.current > 500) {
         if (mode === 'putting') {
            const traj = trajectoryRef.current;
            const lastPt = traj[traj.length - 1];
            const centerX = boxWidth / 2;
            const centerY = boxHeight / 2;
            const radius = Math.min(boxWidth, boxHeight) / 2;
            const distFromCenter = Math.hypot(lastPt.x - centerX, lastPt.y - centerY);
            
            // 멈추기 직전 프레임간의 이동 거리를 계산하여, 공이 완전히 정지했는지(속도가 줄었는지) 확인
            let lastSpeed = 0;
            if (traj.length >= 3) {
               const p1 = traj[traj.length - 1];
               const p2 = traj[traj.length - 2];
               const p3 = traj[traj.length - 3];
               lastSpeed = (Math.hypot(p1.x - p2.x, p1.y - p2.y) + Math.hypot(p2.x - p3.x, p2.y - p3.y)) / 2;
            } else if (traj.length === 2) {
               const p1 = traj[traj.length - 1];
               const p2 = traj[traj.length - 2];
               lastSpeed = Math.hypot(p1.x - p2.x, p1.y - p2.y);
            } else {
               lastSpeed = 100; // 포인트가 부족하면 멈춘 것이 아니라 지나가거나 노이즈로 간주
            }
            
            const firstPt = traj[0];
            const startDistFromCenter = Math.hypot(firstPt.x - centerX, firstPt.y - centerY);
            
            // 공을 주울 때 궤적이 생기는 현상(오작동) 방지:
            // 정상적인 퍼팅이라면 궤적이 카메라 시야(원의 가장자리 부근) 밖에서부터 들어와야 함
            const startedNearEdge = startDistFromCenter > radius * 0.6;
            const hasEnoughFrames = traj.length >= 3;
            
            // 공이 원 안쪽 85% 이내에 있고, 이동 속도가 줄어서 멈췄고, 밖에서 들어온 정상 궤적일 때만 성공
            if (distFromCenter < radius * 0.85 && lastSpeed < 15 && startedNearEdge && hasEnoughFrames) {
               if (now - lastSuccessTimeRef.current > COOLDOWN_MS) {
                  lastSuccessTimeRef.current = now;
                  setSuccessCount(prev => prev + 1);
                  
                  setIsSuccess(true);
                  isSuccessRef.current = true;
                  playSuccessSound("성공");
                  
                  setTimeout(() => {
                     setIsSuccess(false);
                     isSuccessRef.current = false;
                     trajectoryRef.current = [];
                     setTrajectoryUi([]);
                  }, 2000);
               }
            } else {
               trajectoryRef.current = [];
               setTrajectoryUi([]);
            }
         } else {
            trajectoryRef.current = [];
            setTrajectoryUi([]);
         }
      }

      if (mode === 'shot' || mode === 'swing-path' || mode === 'lesson_review') {
         const timeSinceValid = now - lastValidBlobTimeRef.current;
         if (shotStateRef.current === 'moving_in') {
             if (timeSinceValid === 0 && now - teeShotStillTimeRef.current > 800) {
                 shotStateRef.current = 'placed';
                 placedBgDataRef.current = new Uint8ClampedArray(currentImageData.data);
                 if (mode === 'shot') {
                     playSuccessSound("빈스윙을 강하게 한 번 한 뒤 같은 스피드로 공을 쳐주세요.");
                 } else if (mode === 'lesson_review') {
                     const commentList = lessonReviewComments || [];
                     const comment = commentList[lessonReviewCommentIndexRef.current] || "레디";
                     
                     setTimeout(() => {
                         playSuccessSound(comment);
                     }, 1000);

                     if (commentList.length > 0) {
                         lessonReviewCommentIndexRef.current = (lessonReviewCommentIndexRef.current + 1) % commentList.length;
                     }
                     if (!hasFirstCommentPlayedRef.current) {
                         hasFirstCommentPlayedRef.current = true;
                         setHasFirstCommentPlayed(true);
                     }
                 }
             } else if (timeSinceValid > 500) {
                 shotStateRef.current = 'empty';
             }
         } else if (shotStateRef.current === 'placed') {
             // 연습스윙 감지 (공은 그대로 있고 모션만 크게 일어난 경우)
             if (timeSinceValid === 0) {
                 if (frameMotion > (PUTT_CONFIG[mode] ? 5 : 15) && now - lastPracticeSwingTimeRef.current > 3000) {
                     practiceSwingCountRef.current += 1;
                     lastPracticeSwingTimeRef.current = now;
                     console.log("연습스윙 감지됨! 총 연습스윙 수:", practiceSwingCountRef.current);
                 }
             }

             if (timeSinceValid > 300) {
                 // 1.5초 이내에 빠른 움직임(스윙 모션)이 있었는지 체크
                 const maxRecentMotion = recentMotionsRef.current.reduce((max, m) => Math.max(max, m.motion), 0);
                 const hasSwingSpike = maxRecentMotion > (PUTT_CONFIG[mode] ? 5 : 15); // 15% 또는 5% 이상 픽셀이 변한 경우
                 
                 let isRealShot = hasSwingSpike;
                 
                 // 추가로 배경 변화 검사 (손 가림 등 방지)
                 if (isRealShot && placedBgDataRef.current) {
                     let diffSum = 0; let count = 0;
                     const cur = currentImageData.data; const prev = placedBgDataRef.current;
                     for (let i = 0; i < cur.length; i += 16) {
                         const pb = (prev[i] + prev[i+1] + prev[i+2]) / 3;
                         if (pb <= 160) { // 공이 아닌 배경 픽셀만 검사
                             const cb = (cur[i] + cur[i+1] + cur[i+2]) / 3;
                             diffSum += Math.abs(cb - pb); count++;
                         }
                     }
                     if (count > 0 && (diffSum / count) > 40) isRealShot = false;
                 }
                 
                 if (isRealShot) {
                     shotStateRef.current = 'moving_out';
                 } else if (timeSinceValid > 5000) {
                     shotStateRef.current = 'empty'; // 스윙이 없고 5초 동안 공이 완전히 안 보이면 리셋
                 }
             }
         } else if (shotStateRef.current === 'moving_out') {
             if (timeSinceValid === 0) {
                 shotStateRef.current = 'placed'; // 다시 공이 보이면 레디
             } else if (timeSinceValid > 2000) { // 웨글(클럽 재정비) 시간 및 공 날아가는 시간 확보
                 shotStateRef.current = 'empty';
                 
                 if (now - lastSuccessTimeRef.current > COOLDOWN_MS) {
                     lastSuccessTimeRef.current = now;
                     
                     if (mode === 'shot' || mode === 'lesson_review') {
                         successCountRef.current += 1;
                         const next = successCountRef.current;
                         setSuccessCount(next);
                         
                         if (mode === 'lesson_review' && lessonReviewGoalType === 'time') {
                             // do nothing, no voice feedback needed
                         } else {
                             const goal = mode === 'lesson_review' ? lessonReviewGoal : 25;
                             const remaining = goal - next;
                             if (next >= goal) {
                                 if (mode === 'shot') {
                                     const total = practiceSwingCountRef.current + 25;
                                     playSuccessSound(`티샷 비거리 복습을 완료했습니다. 빈스윙 ${practiceSwingCountRef.current}회, 샷 25회, 총 ${total}회를 수행했습니다. 수고하셨습니다.`, () => {
                                         setShowResult(true);
                                     });
                                 } else {
                                     if (next === goal) {
                                         playSuccessSound("목표 횟수를 달성했습니다. 수고하셨습니다.");
                                     } else {
                                         playSuccessSound(`${next}회`);
                                     }
                                 }
                             } else {
                                 if (mode === 'shot') {
                                     playSuccessSound(`${remaining}개 남았습니다. 더 빠른 스피드에 도전해 보세요.`);
                                 } else {
                                     playSuccessSound(`${remaining}회 남았습니다.`);
                                 }
                             }
                         }
                         
                         setIsSuccess(true);
                         isSuccessRef.current = true;
                         setTimeout(() => {
                             setIsSuccess(false);
                             isSuccessRef.current = false;
                         }, 1000);
                     } else if (mode === 'swing-path') {
                         totalShotsRef.current += 1;
                         const traj = trajectoryRef.current;
                         let hitPath = 'in-to-in';
                         
                         if (traj.length >= 2) {
                             const first = traj[0];
                             const last = traj[traj.length - 1];
                             const dy = last.y - first.y;
                             
                             if (dy < -20) hitPath = 'in-out';
                             else if (dy > 20) hitPath = 'out-in';
                         } else {
                             const r = Math.random();
                             if (r < 0.33) hitPath = 'in-out';
                             else if (r < 0.66) hitPath = 'out-in';
                         }

                         if (hitPath === swingPathType) {
                             successCountRef.current += 1;
                             setSuccessCount(successCountRef.current);
                             playSuccessSound("성공");
                             setIsSuccess(true);
                             isSuccessRef.current = true;
                             setTimeout(() => {
                                 setIsSuccess(false);
                                 isSuccessRef.current = false;
                             }, 1000);
                         } else {
                             playSuccessSound("실패");
                         }
                     }
                 }
             }
         }
      } else if (mode === 'tee-shot' || APPROACH_CONFIG[mode] || PUTT_CONFIG[mode]) {
         const timeSinceValid = now - lastValidBlobTimeRef.current;
         if (shotStateRef.current === 'moving_in') {
             if (timeSinceValid === 0 && now - teeShotStillTimeRef.current > 1000) {
                 shotStateRef.current = 'placed';
                 placedBgDataRef.current = new Uint8ClampedArray(currentImageData.data);
                 playSuccessSound("레디");
             } else if (timeSinceValid > 500) {
                 shotStateRef.current = 'empty';
             }
         } else if (shotStateRef.current === 'placed') {
             // 연습스윙 감지 (공은 그대로 있고 모션만 크게 일어난 경우)
             if (timeSinceValid === 0) {
                 if (frameMotion > (PUTT_CONFIG[mode] ? 5 : 15) && now - lastPracticeSwingTimeRef.current > 3000) {
                     practiceSwingCountRef.current += 1;
                     lastPracticeSwingTimeRef.current = now;
                     console.log("연습스윙 감지됨! 총 연습스윙 수:", practiceSwingCountRef.current);
                 }
             }

             if (timeSinceValid > 300) {
                 // 1.5초 이내에 빠른 움직임(스윙 모션)이 있었는지 체크
                 const maxRecentMotion = recentMotionsRef.current.reduce((max, m) => Math.max(max, m.motion), 0);
                 const hasSwingSpike = maxRecentMotion > (PUTT_CONFIG[mode] ? 5 : 15); // 15% 이상 픽셀이 변한 경우
                 
                 let isRealShot = hasSwingSpike;
                 
                 // 추가로 배경 변화 검사 (손 가림 등 방지)
                 if (isRealShot && placedBgDataRef.current) {
                     let diffSum = 0; let count = 0;
                     const cur = currentImageData.data; const prev = placedBgDataRef.current;
                     for (let i = 0; i < cur.length; i += 16) {
                         const pb = (prev[i] + prev[i+1] + prev[i+2]) / 3;
                         if (pb <= 160) { // 공이 아닌 배경 픽셀만 검사
                             const cb = (cur[i] + cur[i+1] + cur[i+2]) / 3;
                             diffSum += Math.abs(cb - pb); count++;
                         }
                     }
                     if (count > 0 && (diffSum / count) > 40) isRealShot = false;
                 }
                 
                 if (isRealShot) {
                     shotStateRef.current = 'moving_out';
                 } else if (timeSinceValid > 5000) {
                     shotStateRef.current = 'empty'; // 스윙이 없고 5초 동안 공이 완전히 안 보이면 리셋
                 }
             }
         } else if (shotStateRef.current === 'moving_out') {
             if (timeSinceValid === 0) {
                 shotStateRef.current = 'placed'; // 공이 다시 보임 (클럽 재정비)
             } else if (timeSinceValid > 3500) { // 3.5초 대기: 웨글 시간 방지 + 공 떨어지는 결과 확인 시간 제공
                 shotStateRef.current = 'empty';
                 if (now - lastSuccessTimeRef.current > COOLDOWN_MS) {
                     lastSuccessTimeRef.current = now;
                     totalShotsRef.current += 1;
                     teeShotCenterRef.current = null;
                     
                     if (PUTT_CONFIG[mode]) {
                         handlePuttResult();
                     } else if (APPROACH_CONFIG[mode]) {
                         handleApproachResult();
                     } else {
                         handleTeeShotResult();
                     }
                 }
             }
         }
      }

      // 디버깅 UI 지우기
      if (blobTimeRef.current > 0 && now - blobTimeRef.current > 300) {
        setBlob(null);
        blobTimeRef.current = 0;
      }
    }

    prevImageDataRef.current = currentImageData;
    
    setTimeout(() => {
      requestRef.current = requestAnimationFrame(processFrame);
    }, 1000 / 30);
  }, [showSettings]);

  useEffect(() => {
    if (hasCameraPermission) {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      requestRef.current = requestAnimationFrame(processFrame);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [hasCameraPermission, processFrame]);

  if (hasCameraPermission === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-70px)] p-4 bg-black text-white">
        <p className="mb-4">카메라 접근 권한이 필요합니다.</p>
        <button onClick={startCamera} className="px-4 py-2 bg-white text-black font-semibold rounded-lg">권한 다시 요청</button>
      </div>
    );
  }

  if (!hasSelected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-70px)] bg-[#F8F9FC] dark:bg-zinc-950 p-6">
        <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 shadow-sm border border-zinc-200/60 dark:border-zinc-800/60 flex flex-col gap-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-brand-navy to-emerald-500"></div>
          
          <div className="flex items-center gap-2 pt-2">
            <button onClick={() => router.back()} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"><ChevronLeft size={24} /></button>
            <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">복습 카메라 (임시)</h1>
          </div>
          
          <div className="space-y-4">

             
             <div>
                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">훈련 선택</label>
                <div className="flex flex-col gap-2">
                   <button 
                      onClick={() => setSelectedTraining('shot')}
                      className={`p-3 rounded-xl border text-sm font-bold transition-all text-left ${selectedTraining === 'shot' ? 'bg-brand-navy text-white border-brand-navy shadow-sm' : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-brand-navy/50'}`}
                   >
                      티샷 비거리
                   </button>
                   <button 
                      onClick={() => setSelectedTraining('tee-shot')}
                      className={`p-3 rounded-xl border text-sm font-bold transition-all text-left ${selectedTraining === 'tee-shot' ? 'bg-brand-navy text-white border-brand-navy shadow-sm' : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-brand-navy/50'}`}
                   >
                      티샷 정확도
                   </button>
                   
                   
                   {Object.entries(APPROACH_CONFIG).map(([key, config]) => (
                       <button 
                          key={key}
                          onClick={() => setSelectedTraining(key as any)}
                          className={`p-3 rounded-xl border text-sm font-bold transition-all text-left ${selectedTraining === key ? 'bg-brand-navy text-white border-brand-navy shadow-sm' : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-brand-navy/50'}`}
                       >
                          {config.uiName}
                       </button>
                   ))}

                   {Object.entries(PUTT_CONFIG).map(([key, config]) => (
                       <button 
                          key={key}
                          onClick={() => setSelectedTraining(key as any)}
                          className={`p-3 rounded-xl border text-sm font-bold transition-all text-left ${selectedTraining === key ? 'bg-brand-navy text-white border-brand-navy shadow-sm' : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-brand-navy/50'}`}
                       >
                          {config.uiName}
                       </button>
                   ))}

                </div>
             </div>
             
             <button 
                onClick={() => {

                   if (!selectedTraining) { alert("훈련을 선택해주세요."); return; }
                   toggleMode(selectedTraining);
                   setHasSelected(true);
                   startCamera();
                }}
                className="w-full py-4 mt-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-lg transition-colors shadow-sm"
             >
                훈련 시작
             </button>
          </div>
        </div>
      </div>
    );
  }

  const targetBoxStyle = showSettings 
    ? 'border-red-500 bg-red-500/30' 
    : (!isDetecting 
        ? 'border-white/50 bg-white/10 border-dashed'
        : (isSuccess ? 'border-green-500 bg-green-500/30' : (mode === 'putting' ? 'border-blue-400 bg-blue-500/10' : 'border-red-500 bg-red-500/20'))
      );

  return (
    <div className="relative w-full h-[calc(100dvh-70px)] bg-black overflow-hidden flex items-center justify-center rounded-lg shadow-inner touch-none">
      
      <video ref={videoRef} className={`absolute inset-0 w-full h-full object-cover ${facingMode === 'user' ? 'transform scale-x-[-1]' : ''}`} playsInline muted autoPlay />
      <canvas ref={canvasRef} className="hidden" />

      {/* Top Controls Area */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-3 w-full px-4">
        <div className="flex items-center justify-center w-full max-w-sm gap-4 mb-4">
          <button 
            onClick={async () => {
              if (videoRef.current?.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach((track) => track.stop());
              }
              if (requestRef.current) cancelAnimationFrame(requestRef.current);
              
              if (mode === 'lesson_review') {
                  await saveLessonReviewProgress();
              }
              
              if (typeParam) {
                  router.back();
              } else {
                  setHasSelected(false);
              }
            }} 
            className="p-2 bg-black/50 text-white rounded-full backdrop-blur-md"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <button 
            onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
            className={`p-2 rounded-full backdrop-blur-md transition-colors ${showSettings ? 'opacity-0 pointer-events-none' : 'bg-black/50 text-white'}`}
          >
            <SwitchCamera className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-full backdrop-blur-md transition-colors ${showSettings ? 'opacity-0 pointer-events-none' : 'bg-black/50 text-white'}`}
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex justify-center w-full max-w-sm">
          {mode === 'lesson_review' ? (
            !showSettings ? (
              <button 
                onClick={() => {
                   const willDetect = !isDetecting;
                   if (willDetect) {
                      setIsDetecting(true);
                      setIsVoicePlaying(true);
                      playSuccessSound("훈련을 시작합니다.", () => setIsVoicePlaying(false));
                   } else {
                      setIsDetecting(false);
                      saveLessonReviewProgress();
                      const rate = lessonReviewGoalType === 'time' ? Math.round(((elapsedSeconds / 60) / lessonReviewGoal) * 100) : Math.round((successCount / lessonReviewGoal) * 100);
                      playSuccessSound(`진행률 ${rate}%를 달성했습니다. 수고하셨습니다.`);
                   }
                }}
                className={`flex items-center justify-center gap-2 px-4 py-1.5 rounded-full font-bold text-sm shadow-xl transition-all w-[240px] sm:w-[260px] ${
                  isDetecting 
                  ? 'bg-red-500/90 text-white hover:bg-red-600' 
                  : 'bg-green-500/90 text-white hover:bg-green-600 animate-pulse'
                }`}
              >
                {isDetecting ? (
                  <><Square className="w-3 h-3 fill-current" /> 중지</>
                ) : (
                  <><Play className="w-3 h-3 fill-current" /> 시작</>
                )}
              </button>
            ) : (
              <div className="h-[32px] w-[240px] sm:w-[260px]"></div>
            )
          ) : (
            <div className="bg-black/50 px-4 py-1.5 rounded-full backdrop-blur-md border border-white/10 flex justify-center items-center w-[240px] sm:w-[260px]">
               <span className="text-white text-sm font-bold">
                 {mode === 'shot' ? '티샷 비거리 복습' : mode === 'tee-shot' ? '티샷 정확도 복습' : APPROACH_CONFIG[mode] ? APPROACH_CONFIG[mode].uiName + ' 복습' : PUTT_CONFIG[mode] ? PUTT_CONFIG[mode].uiName + ' 복습' : '복습 훈련'}
               </span>
            </div>
          )}
        </div>

        {mode === 'swing-path' && (
          <div className="flex gap-2 w-full max-w-sm justify-center mb-1">
            {['in-out', 'out-in', 'in-to-in'].map(type => (
               <button 
                  key={type}
                  onClick={() => { setSwingPathType(type as any); setSuccessCount(0); totalShotsRef.current = 0; setShowResult(false); }}
                  className={`px-4 py-1.5 rounded-full text-xs font-black shadow-sm transition-all ${swingPathType === type ? 'bg-orange-500 text-white border-none' : 'bg-black/50 text-white/60 border border-white/10'}`}
               >
                  {type === 'in-out' ? '인아웃' : type === 'out-in' ? '아웃인' : '인투인'}
               </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className={`bg-black/50 px-4 py-1.5 rounded-full backdrop-blur-md border border-white/10 flex justify-center items-center ${mode === 'lesson_review' ? 'w-[240px] sm:w-[260px]' : ''}`}>
            <h1 className="text-[11px] font-bold text-white whitespace-nowrap">
              {mode === 'lesson_review' ? (
                lessonReviewGoalType === 'time' ? (
                   <>남은시간 <span className="text-orange-400 text-sm">{Math.floor(Math.max(0, lessonReviewGoal * 60 - elapsedSeconds) / 60).toString().padStart(2, '0')}:{Math.floor(Math.max(0, lessonReviewGoal * 60 - elapsedSeconds) % 60).toString().padStart(2, '0')}</span> <span className="text-white/70 ml-1">(누적시간: {Math.floor(elapsedSeconds / 60).toString().padStart(2, '0')}:{Math.floor(elapsedSeconds % 60).toString().padStart(2, '0')})</span></>
                ) : (
                   <>남은횟수 <span className="text-orange-400 text-sm">{Math.max(0, lessonReviewGoal - successCount)}회</span> <span className="text-white/70 ml-1">(누적횟수: {successCount}회)</span></>
                )
              ) : mode === 'shot' ? (
                <>샷: <span className="text-orange-400 text-sm">{successCount}</span><span className="text-white/50">/25</span></>
              ) : mode === 'swing-path' ? (
                <>진행: <span className="text-orange-400 text-sm">{totalShotsRef.current}</span> <span className="text-white/50">/ 10</span> <span className="mx-1">|</span> 성공: <span className="text-green-400 text-sm">{successCount}</span></>
              ) : mode === 'tee-shot' ? (
                <>성공: <span className="text-orange-400 text-sm">{successCount}</span><span className="text-white/50">/10</span> <span className="mx-1">|</span> 샷: <span className="text-green-400 text-sm">{totalShotsRef.current}</span></>
              ) : PUTT_CONFIG[mode] ? (
                <>성공: <span className="text-orange-400 text-sm">{successCount}</span><span className="text-white/50">/{PUTT_CONFIG[mode].target}</span> <span className="mx-1">|</span> 샷: <span className="text-green-400 text-sm">{totalShotsRef.current}</span></>
              ) : APPROACH_CONFIG[mode] ? (
                <>적중: <span className="text-orange-400 text-sm">{successCount}</span><span className="text-white/50">/20</span> <span className="mx-1">|</span> 샷: <span className="text-green-400 text-sm">{totalShotsRef.current}</span></>
              ) : (
                <>성공: <span className="text-green-400 text-sm">{successCount}</span></>
              )}
            </h1>
          </div>

          {!showSettings && (mode === 'tee-shot' || mode === 'shot' || APPROACH_CONFIG[mode] || PUTT_CONFIG[mode] || PUTT_CONFIG[mode]) && isDetecting && (
            <button 
              onClick={() => {
                 if (mode === 'tee-shot') {
                     totalShotsRef.current += 1;
                     teeShotCenterRef.current = null;
                     shotStateRef.current = 'empty';
                     handleTeeShotResult();
                 } else if (PUTT_CONFIG[mode]) {
                     totalShotsRef.current += 1;
                     teeShotCenterRef.current = null;
                     shotStateRef.current = 'empty';
                     handlePuttResult();
                 } else if (APPROACH_CONFIG[mode]) {
                     totalShotsRef.current += 1;
                     teeShotCenterRef.current = null;
                     shotStateRef.current = 'empty';
                     handleApproachResult();
                 } else if (mode === 'shot') {
                     setSuccessCount(prev => {
                         const next = prev + 1;
                         const remaining = 25 - next;
                         if (next >= 25) {
                             playSuccessSound(`티샷 비거리 복습을 완료했습니다. 빈스윙 25회, 샷 25회, 총 50회를 수행했습니다. 수고하셨습니다.`, () => {
                                 setShowResult(true);
                             });
                         } else {
                             playSuccessSound(`${remaining}개 남았습니다. 더 빠른 스피드에 도전해 보세요.`);
                         }
                         return next;
                     });
                     setIsSuccess(true);
                     isSuccessRef.current = true;
                     setTimeout(() => {
                         setIsSuccess(false);
                         isSuccessRef.current = false;
                     }, 1000);
                 }
              }}
              className="px-3 py-1.5 rounded-full font-bold text-sm shadow-xl transition-all bg-blue-500/90 text-white hover:bg-blue-600 border border-white/20"
            >
              샷 완료
            </button>
          )}
          {!showSettings && mode !== 'lesson_review' && (
            <button 
              onClick={() => {
                const willDetect = !isDetecting;
                if (willDetect && mode === 'tee-shot') {
                   setIsDetecting(true);
                   setIsVoicePlaying(true);
                   playSuccessSound("티샷 정확도 훈련을 시작합니다. 10번의 샷을 진행합니다.", () => {
                       setIsVoicePlaying(false);
                   });
                } else if (willDetect && mode === 'shot') {
                   setIsDetecting(true);
                   setIsVoicePlaying(true);
                   playSuccessSound("티샷 비거리 복습을 시작합니다. 목표는 빈스윙과 같은 스피드로 25개 치기입니다.", () => {
                       setIsVoicePlaying(false);
                   });
                } else if (willDetect && PUTT_CONFIG[mode]) {
                   const conf = PUTT_CONFIG[mode];
                   setIsDetecting(true);
                   setIsVoicePlaying(true);
                   if (conf.isConsecutive) {
                       playSuccessSound(`훈련 목표는 ${conf.total}개 연속 성공하기입니다.`, () => setIsVoicePlaying(false));
                   } else {
                       playSuccessSound(`훈련 목표는 ${conf.total}개 중 ${conf.target}개 ${conf.isHoleOut ? '' : '1퍼트 '}성공하기입니다.`, () => setIsVoicePlaying(false));
                   }
                } else if (willDetect && APPROACH_CONFIG[mode]) {
                   const conf = APPROACH_CONFIG[mode];
                   setIsDetecting(true);
                   setIsVoicePlaying(true);
                   playSuccessSound(`훈련 목표는 ${conf.targetDistance}미터 이내로 20개 적중시키기입니다.`, () => {
                       setIsVoicePlaying(false);
                   });
                } else {
                   setIsDetecting(willDetect);
                   if (!willDetect && mode === 'shot') {
                      const rate = Math.round((successCount / 25) * 100);
                      const total = successCount * 2;
                      playSuccessSound(`진행률 ${rate}%를 달성했습니다. 빈스윙 ${successCount}회, 샷 ${successCount}회, 총 ${total}회를 수행했습니다. 수고하셨습니다.`);
                   } else if (!willDetect && PUTT_CONFIG[mode]) {
                      const conf = PUTT_CONFIG[mode];
                      const rate = Math.round((successCount / conf.target) * 100);
                      const hitRate = totalShotsRef.current > 0 ? Math.round((successCount / totalShotsRef.current) * 100) : 0;
                      const actionText = conf.isHoleOut ? "홀아웃 거리로 붙여" : "홀인하여";
                      playSuccessSound(`${conf.name} 복습 훈련 목표를 ${rate}% 달성했습니다. 오늘 훈련은 총 ${totalShotsRef.current}개 중 ${successCount}개를 ${actionText} 성공률은 ${hitRate}%였습니다. 수고하셨습니다.`);
                   } else if (!willDetect && APPROACH_CONFIG[mode]) {
                      const conf = APPROACH_CONFIG[mode];
                      const rate = Math.round((successCount / 20) * 100);
                      const hitRate = totalShotsRef.current > 0 ? Math.round((successCount / totalShotsRef.current) * 100) : 0;
                      playSuccessSound(`${conf.name} 복습 훈련 목표를 ${rate}% 달성했습니다. 오늘 훈련은 총 ${totalShotsRef.current}개 중 ${successCount}개를 ${conf.targetDistance}미터 이내로 적중하여 성공률은 ${hitRate}%였습니다. 수고하셨습니다.`);
                   }
                }
              }}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-bold text-sm shadow-xl transition-all ${
                isDetecting 
                ? 'bg-red-500/90 text-white hover:bg-red-600' 
                : 'bg-green-500/90 text-white hover:bg-green-600 animate-pulse'
              }`}
            >
              {isDetecting ? (
                <><Square className="w-3 h-3 fill-current" /> 중지</>
              ) : (
                <><Play className="w-3 h-3 fill-current" /> 시작</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="absolute inset-0 z-30 pointer-events-none flex flex-col justify-between">
          <div className="mt-32 w-full flex justify-center">
            <div className="bg-black/60 backdrop-blur-sm px-4 py-1.5 rounded-full text-white text-xs font-bold pointer-events-auto flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              {mode === 'putting' ? '퍼팅 타깃 조정 모드' : '타깃 조정 모드'}
            </div>
          </div>

          <div className="flex-1 relative w-full h-full">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-auto">
              <div className="py-4 px-2 flex flex-col items-center gap-2">
                <span className="text-white/80 text-[10px] font-bold">{mode === 'target' ? '세로(H)' : '크기'}</span>
                <div className="h-[150px] w-6 flex items-center justify-center">
                  <input 
                    type="range" min="50" max="600" step="10" value={boxHeight} 
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setBoxHeight(val);
                      if (mode !== 'target') setBoxWidth(val);
                    }}
                    className="w-full h-full accent-red-500 cursor-pointer" 
                    style={{ WebkitAppearance: 'slider-vertical' }}
                  />
                </div>
                <span className="text-red-400 text-[10px] font-bold mt-2">{boxHeight}</span>
              </div>
            </div>

            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-auto">
              <div className="py-4 px-2 flex flex-col items-center gap-2">
                <span className="text-white/80 text-[10px] font-bold">상하(Y)</span>
                <div className="h-[150px] w-6 flex items-center justify-center">
                  <input 
                    type="range" min="-300" max="300" step="10" 
                    value={offsetY * -1} 
                    onChange={(e) => setOffsetY(Number(e.target.value) * -1)}
                    className="w-full h-full accent-red-500 cursor-pointer" 
                    style={{ WebkitAppearance: 'slider-vertical' }}
                  />
                </div>
                <span className="text-red-400 text-[10px] font-bold mt-2">{offsetY * -1}</span>
              </div>
            </div>
          </div>

          <div className="w-full pb-8 flex flex-col items-center gap-3 pointer-events-auto">
             <div className="px-6 py-3 flex flex-col items-center w-[85%] max-w-[320px]">
                <div className="flex justify-between w-full mb-1">
                   <span className="text-white/80 text-[10px] font-bold flex-1 text-center">좌우 위치 (X)</span>
                   {mode === 'target' && <span className="text-white/80 text-[10px] font-bold flex-1 text-center">가로 폭 (W)</span>}
                </div>
                <div className="flex w-full gap-4">
                   <input 
                     type="range" min="-300" max="300" step="10" 
                     value={offsetX} 
                     onChange={(e) => setOffsetX(Number(e.target.value))}
                     className={`${mode !== 'target' ? 'w-full' : 'w-1/2'} h-1.5 accent-red-500`} 
                   />
                   {mode === 'target' && (
                     <input 
                       type="range" min="50" max="400" step="10" 
                       value={boxWidth} 
                       onChange={(e) => setBoxWidth(Number(e.target.value))}
                       className="w-1/2 h-1.5 accent-red-500" 
                     />
                   )}
                </div>
             </div>

             <div className="flex items-center gap-3">
                 <button 
                    onClick={() => { 
                       if(mode === 'putting') { setOffsetX(0); setOffsetY(0); setBoxWidth(150); setBoxHeight(150); } 
                       else if(mode === 'shot' || mode === 'tee-shot') { setOffsetX(100); setOffsetY(200); setBoxWidth(120); setBoxHeight(120); } 
                       else { setOffsetX(0); setOffsetY(0); setBoxWidth(200); setBoxHeight(200); } 
                    }}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-zinc-800/80 backdrop-blur-md text-zinc-300 rounded-full text-xs font-bold border border-zinc-600 hover:bg-zinc-700"
                 >
                    <RotateCcw className="w-3 h-3" /> 초기화
                 </button>
                 <button 
                    onClick={() => setShowSettings(false)}
                    className="flex items-center gap-1.5 px-6 py-1.5 bg-green-500/90 backdrop-blur-md text-white rounded-full text-xs font-bold border border-green-500 hover:bg-green-600 shadow-lg"
                 >
                    <Check className="w-4 h-4" /> 완료
                 </button>
             </div>
          </div>
        </div>
      )}

      {/* Target Overlay */}
      <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
        <div 
          className={`relative border-2 transition-all duration-150 ${targetBoxStyle} ${mode === 'putting' ? 'rounded-full' : ''}`}
          style={{ width: boxWidth, height: boxHeight, transform: `translate(${offsetX}px, ${offsetY}px)` }}
        >
          {mode === 'target' && (
            <>
              <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-white/80" />
              <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-white/80" />
              <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-white/80" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-white/80" />
            </>
          )}

          {mode === 'putting' && (
            <>
              {/* Target Indicator */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none rounded-full">
                <div className="w-1/2 h-1/2 bg-black/40 rounded-full shadow-inner border border-white/30" />
              </div>
              
              {/* Trajectory Drawing */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                 <polyline 
                   points={trajectoryUi.map(p => `${p.x},${p.y}`).join(' ')} 
                   fill="none" 
                   stroke="rgba(0, 255, 100, 0.9)" 
                   strokeWidth="5" 
                   strokeLinecap="round"
                   strokeLinejoin="round"
                   className="drop-shadow-lg"
                 />
                 {trajectoryUi.length > 0 && (
                   <circle 
                     cx={trajectoryUi[trajectoryUi.length - 1].x} 
                     cy={trajectoryUi[trajectoryUi.length - 1].y} 
                     r="6" 
                     fill="white" 
                     className="animate-pulse shadow-md"
                   />
                 )}
              </svg>
            </>
          )}
          
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-white font-bold text-xs bg-black/60 backdrop-blur-sm px-2 py-1 rounded whitespace-nowrap shadow-sm">
            {showSettings ? '조정 중...' : (isDetecting ? (mode === 'putting' ? 'PUTTING PATH' : mode === 'shot' ? 'SHOT AREA' : mode === 'tee-shot' ? 'TEE SHOT AREA' : mode === 'swing-path' ? 'SWING AREA' : 'TARGET') : '대기중')}
          </div>

          {/* Blob Detection 시각화 영역 (디버깅 UI) */}
          {blob && !showSettings && (
            <div 
              className={`absolute border-[3px] bg-black/20 backdrop-blur-[2px] transition-all duration-75 flex items-end justify-center pb-1 ${blob.isValid ? 'border-green-400' : 'border-yellow-400/80'}`}
              style={{
                left: blob.x,
                top: blob.y,
                width: blob.w,
                height: blob.h,
              }}
            >
              <div className={`whitespace-nowrap text-[10px] font-black px-1.5 py-0.5 rounded shadow-sm ${blob.isValid ? 'bg-green-500 text-white' : 'bg-yellow-500 text-black'}`}>
                {blob.reason}
              </div>
            </div>
          )}
        </div>
      </div>

      {isSuccess && !showSettings && (
        <div className="absolute z-50 top-[40%] left-1/2 -translate-x-1/2 pointer-events-none animate-in fade-in zoom-in duration-300">
          <h2 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-green-300 to-green-600 drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)] italic tracking-tighter">
            {mode === 'shot' || mode === 'swing-path' || mode === 'tee-shot' ? `${successCount} SHOT` : 'SUCCESS!'}
          </h2>
        </div>
      )}

      {isListening && (
        <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center pointer-events-none backdrop-blur-[2px]">
           <div className="bg-black/80 text-white px-8 py-6 rounded-3xl flex flex-col items-center gap-4 border border-white/20 shadow-2xl animate-pulse">
              <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center animate-bounce">
                 <div className="w-6 h-6 bg-white rounded-full"></div>
              </div>
              <h2 className="text-2xl font-black">음성 인식 중...</h2>
              <p className="text-zinc-400 font-bold">"성공", "실패" 중 하나를 말해주세요</p>
           </div>
        </div>
      )}

      {showResult && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center gap-4">
            <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-50">훈련 완료!</h2>
            <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-500 my-4 drop-shadow-sm">
              {successCount} <span className="text-3xl text-zinc-300 dark:text-zinc-700">/ 10</span>
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 font-bold">
              10번의 샷 중 <span className="text-zinc-900 dark:text-zinc-100">{successCount}번</span>의 <br/>
              <span className="text-orange-500">{mode === 'tee-shot' ? '페어웨이 안착' : (swingPathType === 'in-out' ? '인아웃' : swingPathType === 'out-in' ? '아웃인' : '인투인')}</span> 궤도를 성공했습니다!
            </p>
            <button 
              onClick={() => { setShowResult(false); setSuccessCount(0); totalShotsRef.current = 0; }}
              className="mt-4 w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-2xl font-bold text-lg hover:scale-[1.02] active:scale-95 transition-all shadow-md"
            >
              다시 하기
            </button>
          </div>
        </div>
      )}

      {/* Bottom Temporary Controls for Debugging */}
      {mode === 'lesson_review' && isDetecting && !showSettings && (
         <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 pointer-events-auto">
             <button 
               onClick={() => {
                   if (!hasFirstCommentPlayedRef.current) {
                       hasFirstCommentPlayedRef.current = true;
                       setHasFirstCommentPlayed(true);
                   }
                   const commentList = lessonReviewComments || [];
                   const comment = commentList[lessonReviewCommentIndexRef.current] || "레디";
                   
                   setTimeout(() => {
                       playSuccessSound(comment);
                   }, 1000);

                   if (commentList.length > 0) {
                       lessonReviewCommentIndexRef.current = (lessonReviewCommentIndexRef.current + 1) % commentList.length;
                   }
               }}
               className="px-6 py-3 rounded-full font-bold text-base shadow-xl transition-all bg-yellow-500/90 text-white hover:bg-yellow-600 border border-white/20 whitespace-nowrap"
             >
               볼 인식
             </button>
             <button 
               onClick={() => {
                   successCountRef.current += 1;
                   const next = successCountRef.current;
                   setSuccessCount(next);
                   
                   if (lessonReviewGoalType === 'time') {
                       // do nothing
                   } else {
                       const goal = lessonReviewGoal;
                       const remaining = goal - next;
                       if (next >= goal) {
                           playSuccessSound("훈련을 종료합니다.", () => {
                               setIsDetecting(false);
                           });
                       } else {
                           playSuccessSound(`${remaining}회 남았습니다.`);
                       }
                   }
                   setIsSuccess(true);
                   isSuccessRef.current = true;
                   setTimeout(() => {
                       setIsSuccess(false);
                       isSuccessRef.current = false;
                   }, 1000);
               }}
               className="px-6 py-3 rounded-full font-bold text-base shadow-xl transition-all bg-blue-500/90 text-white hover:bg-blue-600 border border-white/20 whitespace-nowrap"
             >
               샷 완료
             </button>
         </div>
      )}
    </div>
  );
}

export default function SwingTestPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>}>
      <SwingTestContent />
    </Suspense>
  );
}
