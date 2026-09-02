"use client";

import React, { useEffect, useRef, useState, Suspense } from "react";
import { Play, Square, Mic, MicOff, CheckCircle, ChevronLeft, Lock, Unlock, Pause, Volume2, Target, Flag, BarChart2, Check, ChevronRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Force Turbopack Cache Invalidation - 2026-06-24
console.log("Motion Test Training Module Loaded Successfully");

// --- Types & Constants ---
export type TrainingType = 
  | 'shot' 
  | 'tee-shot'
  | '180m-plus'
  | '150-179m'
  | '120-149m'
  | '90-119m'
  | 'pitch-shot'
  | 'bunker'
  | 'approach'
  | '9m-plus-putt'
  | '4-8m-putt'
  | '2-3m-putt'
  | '1m-putt';

interface TrainingConfig {
  id: TrainingType;
  title: string;
  uiName: string;
  stages: {
    stageNum: number;
    target: number;
    introPrompt: string;
    goalDesc: string;
    nextStagePrompt?: string;
  }[];
  completionText: string;
  successPrefix?: string;
  successSuffix?: string;
}

interface VoiceState {
  isListening: boolean;
  transcript: string;
  statusText: string;
}

const SUCCESS_KEYWORDS = ['성공', '완료', '왈료', '알료', '송공', '선공', '상공', '성동', '천공', '전공', '청공', '성곰', '선곰', '천곰', '어', '어캐', '응', '음', '스공', '공', '성', '선', '에', '이', '오', '우', '하', '호', '후', '예', '맞아', '읏', '앗', '흡', '굿', '굳', '구', '군', 'good'];
const READY_KEYWORDS = ['레디', '준비', '네디', '래디', '매디'];

// --- Utility Functions ---
const playDingSound = () => {
  return;
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(600, ctx.currentTime);
    gain1.gain.setValueAtTime(0, ctx.currentTime);
    gain1.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.15);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(900, ctx.currentTime + 0.1);
    gain2.gain.setValueAtTime(0, ctx.currentTime + 0.1);
    gain2.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.1);
    osc2.stop(ctx.currentTime + 0.5);

  } catch (e) {
    console.error("Audio playback error:", e);
  }
};

// 안드로이드 크롬 등에서 onend 이벤트가 버그로 증발하는 것을 막기 위한 전역 변수
let globalUtterance: SpeechSynthesisUtterance | null = null;
let activeAudioSource: AudioBufferSourceNode | null = null;

const playSpeech = async (text: string, audioElement: HTMLVideoElement | null, onEnd?: () => void) => {
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
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "ko-KR";
        utterance.rate = 1.09;
        utterance.onend = () => { if (onEnd) onEnd(); };
        utterance.onerror = () => { if (onEnd) onEnd(); };
        window.speechSynthesis.speak(utterance);
    } else {
        if (onEnd) onEnd();
    }
  }
};

export default function VoiceReviewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <VoiceReviewContent />
    </Suspense>
  );
}

function VoiceReviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reviewType = searchParams.get('type');
  const reviewCat = searchParams.get('cat');
  const reviewHole = searchParams.get('hole');
  const reviewAttempt = searchParams.get('attempt');
  const reviewResult = searchParams.get('result');
  const reviewScore = searchParams.get('score');
  const reviewNote = searchParams.get('note');
  const reviewHolesParam = searchParams.get('holes');
  const recordId = searchParams.get('recordId');
  const isPrep = searchParams.get('isPrep') === 'true';
  let parsedHoles = reviewHolesParam ? JSON.parse(reviewHolesParam) : [];
  if (!isPrep && reviewCat === '티샷 비거리' && parsedHoles.length > 1) {
      parsedHoles = parsedHoles.slice(0, 1);
  }
  
  if (isPrep && reviewCat && (reviewCat.includes('퍼팅') || reviewCat.toLowerCase().includes('putt'))) {
      const filteredHoles = [];
      for (let i = 0; i < parsedHoles.length; i++) {
          const ch = parsedHoles[i];
          let currentDist = null;
          if (ch && ch.attempt) {
              const parts = String(ch.attempt).split('/');
              const distMatch = parts.length >= 2 ? parts[1].match(/(\d+)m?/i) : String(ch.attempt).match(/(\d+)m?/i);
              if (distMatch && distMatch[1]) currentDist = parseInt(distMatch[1], 10);
          }
          
          if (i > 0 && currentDist === 1) {
              const prevCh = parsedHoles[i - 1];
              const currentHoleNum = ch.hole || ch.holeNumber;
              const prevHoleNum = prevCh.hole || prevCh.holeNumber;
              if (currentHoleNum === prevHoleNum) {
                  let prevDist = null;
                  if (prevCh && prevCh.attempt) {
                      const prevParts = String(prevCh.attempt).split('/');
                      const prevDistMatch = prevParts.length >= 2 ? prevParts[1].match(/(\d+)m?/i) : String(prevCh.attempt).match(/(\d+)m?/i);
                      if (prevDistMatch && prevDistMatch[1]) prevDist = parseInt(prevDistMatch[1], 10);
                  }
                  if (prevDist !== null && prevDist <= 4) {
                      continue; // Skip 1m putt
                  }
              }
          }
          filteredHoles.push(ch);
      }
      parsedHoles = filteredHoles;
  }

  const navigateBack = () => {
      if (recordId) {
          router.replace(`/admin/training-temp/${recordId}`);
      } else {
          router.back();
      }
  };
  
  const [hasSelected, setHasSelected] = useState(() => {
    if ((reviewType === 'review_hole' || reviewType === 'review_category') && reviewCat) return true;
    if (reviewType === 'lesson_review' && recordId) return true;
    return false;
  });
  const [currentPrompt, setCurrentPrompt] = useState<string>('');
  const [currentSpokenPrompt, setCurrentSpokenPrompt] = useState<string>('');
  const [trainingType, setTrainingType] = useState<TrainingType | 'review_hole' | 'review_category' | 'lesson_review' | ''>(() => {
    if ((reviewType === 'review_hole' || reviewType === 'review_category') && reviewCat) return reviewType as any;
    if (reviewType === 'lesson_review' && recordId) return 'lesson_review';
    return '';
  });
  
  const [lessonReviewComments, setLessonReviewComments] = useState<string[]>([]);
  const [lessonReviewGoal, setLessonReviewGoal] = useState<number>(10);
  const [lessonReviewGoalType, setLessonReviewGoalType] = useState<"count" | "time">("count");
  const [lessonReviewInterval, setLessonReviewInterval] = useState<number>(25);
  const lessonReviewCommentIndexRef = useRef(0);
  const lastPlayedTimeRef = useRef<number>(-1);
  
  // Training State
  const [isStarted, setIsStarted] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isHoldingUnlock, setIsHoldingUnlock] = useState(false);
  const [sensorAvailable, setSensorAvailable] = useState<boolean | null>(null);
  const [isWaitingForChainConfirm, setIsWaitingForChainConfirm] = useState(false);
  const [sessionElapsedTime, setSessionElapsedTime] = useState(0);
  
  const [currentTimeSeconds, setCurrentTimeSeconds] = useState(180);
  

  const [voiceState, setVoiceState] = useState<VoiceState>({
    isListening: false,
    transcript: '',
    statusText: '대기 중...'
  });
  
  const recognitionRef = useRef<any>(null);
  const isPlayingSpeechRef = useRef(false);
  const handleVoiceInputRef = useRef<any>(null);
  const handleShotSuccessRef = useRef<any>(null);
  const handleStartLessonReviewRef = useRef<any>(null);
  const silentAudioRef = useRef<HTMLVideoElement | null>(null);
  
  // Custom refs for double-tap and double-knock
  const lastTapRef = useRef(0);
  const unlockTimerRef = useRef<NodeJS.Timeout | null>(null);
  const windAssignmentsRef = useRef<any>({});
  const deviceMotionHandlerRef = useRef<((e: DeviceMotionEvent) => void) | undefined>(undefined);
  
  const stateRef = useRef({ 
    isActive: false,
    isPaused: false,
    progress: 0,
    stageIndex: 0,
    currentConfig: null as any,
    currentStage: null as any,
    trainingType: '' as string,
    isPrep: false as boolean,
    isWaitingForChainConfirm: false,
    nextChainCat: null as string | null,
    nextChainUrl: null as string | null,
    sessionElapsedTime: 0,
    lastSavedElapsedTime: 0,
    lessonReviewGoalType: 'count' as 'count' | 'time',
    lessonReviewGoal: 10,
    isStarted: false
  });
  const sensorStateRef = useRef({
    isActive: false,
    isPaused: false,
    isLocked: false,
    lockTime: 0,
    lastKnockTime: 0,
    lastSuccessTime: 0,
    prevAccel: 0
  });

  // Initialize Media Session for Earphone Tap
  useEffect(() => {
    const audioEl = document.createElement('audio');
    audioEl.id = 'silent-audio-loop';
    audioEl.src = '/api/silent';
    audioEl.loop = true;
    audioEl.volume = 0.01;
    (audioEl as any).playsInline = true;
    audioEl.preload = 'auto';
    document.body.appendChild(audioEl);
    silentAudioRef.current = audioEl as any;

    const startAudio = () => {
      audioEl.play().then(() => {
        if ('mediaSession' in navigator) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: '훈련 진행 중',
            artist: '레벨업 골프',
            album: '스윙 분석',
          });
          navigator.mediaSession.playbackState = 'playing';
        }
      }).catch(e => {});
      
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext && !(window as any).globalAudioContext) {
        const ctx = new AudioContext();
        ctx.resume();
        (window as any).globalAudioContext = ctx;
      }
    };
    window.addEventListener('touchstart', startAudio, { once: true });
    window.addEventListener('click', startAudio, { once: true });

    if ('mediaSession' in navigator) {
      const handleMediaEvent = () => {
        if (stateRef.current.isWaitingForChainConfirm) {
          if (stateRef.current.nextChainUrl) {
            router.replace(stateRef.current.nextChainUrl);
          }
        } else if (stateRef.current.trainingType === 'lesson_review' && !stateRef.current.isStarted && handleStartLessonReviewRef.current) {
          handleStartLessonReviewRef.current();
        } else if (stateRef.current.isActive && !stateRef.current.isPaused && handleShotSuccessRef.current) {
          handleShotSuccessRef.current();
        }
        if (audioEl.paused) {
          audioEl.play().catch(() => {});
        }
        navigator.mediaSession.playbackState = 'playing';
      };

      navigator.mediaSession.setActionHandler('play', handleMediaEvent);
      navigator.mediaSession.setActionHandler('pause', handleMediaEvent);
      navigator.mediaSession.setActionHandler('nexttrack', handleMediaEvent);
      navigator.mediaSession.setActionHandler('previoustrack', handleMediaEvent);
    }

    return () => {
      window.removeEventListener('touchstart', startAudio);
      window.removeEventListener('click', startAudio);
      audioEl.pause();
      audioEl.remove();
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
      }
    };
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if ((reviewType === 'review_hole' || reviewType === 'review_category') && reviewCat) {
      setTrainingType(reviewType as any);
      setHasSelected(true);
      setIsStarted(false);
      setIsActive(false);
      setProgress(0);
      setStageIndex(0);
      
      timer = setTimeout(() => {
        setIsStarted(true);
        setIsActive(true);
        setIsPaused(false);
        setProgress(0);
        setStageIndex(0);
        setVoiceState({ isListening: false, transcript: '', statusText: '샷 결과 대기 중 ("성공" 등)' });
        requestMotionPermission();
        silentAudioRef.current?.play().catch(e => {});
        
        setCurrentTimeSeconds(180);
        lastPlayedTimeRef.current = 180;
        const { spoken, visual } = generatePrompt(0);
        speakAndWait(spoken, visual);
      }, 500);
    } else if (reviewType === 'lesson_review' && recordId) {
      setTrainingType('lesson_review');
      setHasSelected(true);
      setIsStarted(false);
      setIsActive(false);
      setProgress(0);
      setStageIndex(0);
      lessonReviewCommentIndexRef.current = 0;
      
      const initLessonReview = async () => {
          try {
              const supabase = createClient();
              const { data: recordData } = await supabase.from("records").select("template_settings, completion_logs").eq("id", recordId).single();
              if (recordData?.template_settings?.[0]) {
                  const settings = recordData.template_settings[0];
                  const comments = settings.comments?.filter(Boolean) || ["레슨 복기 훈련을 시작합니다."];
                  setLessonReviewComments(comments);
                  setLessonReviewGoal(settings.goalValue || 10);
                  setLessonReviewGoalType(settings.goalType || "count");
                  setLessonReviewInterval(settings.swingKeyInterval || 25);
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
                  
                  setProgress(totalCount);
                  setSessionElapsedTime(totalTime);
                  
                  if (stateRef.current) {
                      stateRef.current.progress = totalCount;
                      stateRef.current.sessionElapsedTime = totalTime;
                      stateRef.current.lastSavedElapsedTime = totalTime;
                      (stateRef.current as any).lastSavedProgress = totalCount;
                  }
              }
          } catch (e) {
              console.error("Failed to load lesson review settings", e);
          }
      };
      initLessonReview();
    }
    return () => { if (timer) clearTimeout(timer); };
  }, [reviewType, reviewCat, reviewHole, reviewAttempt, recordId]);

  useEffect(() => {
      const windTypes = ["맞바람", "뒷바람", "강한 맞바람", "강한 뒷바람", "슬라이스 바람", "훅바람"];
      let availableHoles = [];
      for (let i = 1; i <= 18; i++) availableHoles.push(i);
      availableHoles.sort(() => Math.random() - 0.5);
      const winds: Record<number, string> = {};
      const shuffledWinds = [...windTypes].sort(() => Math.random() - 0.5);
      const selectedHoles = availableHoles.slice(0, 6);
      selectedHoles.forEach((h, idx) => {
          winds[h] = shuffledWinds[idx];
      });
      windAssignmentsRef.current = winds;
  }, []);

  useEffect(() => {
     stateRef.current = { 
       ...stateRef.current,
       isActive, 
       isPaused,
       progress, 
       stageIndex, 
       trainingType,
       isPrep,
       isWaitingForChainConfirm,
       isStarted
     };
     sensorStateRef.current.isActive = isActive;
     sensorStateRef.current.isPaused = isPaused;
     sensorStateRef.current.isLocked = isLocked;
  }, [isActive, isPaused, isLocked, progress, stageIndex, trainingType, isWaitingForChainConfirm]);
  
  const stableDeviceMotionListener = (e: DeviceMotionEvent) => {
    if (deviceMotionHandlerRef.current) {
      deviceMotionHandlerRef.current(e);
    }
  };

  useEffect(() => {
    deviceMotionHandlerRef.current = (event: DeviceMotionEvent) => {
      const state = sensorStateRef.current;
      if (!state.isActive || state.isPaused) return;
      if (!state.isLocked || Date.now() - state.lockTime < 10000) return;

      const x = event.acceleration?.x ?? event.accelerationIncludingGravity?.x ?? 0;
      const y = event.acceleration?.y ?? event.accelerationIncludingGravity?.y ?? 0;
      const z = event.acceleration?.z ?? event.accelerationIncludingGravity?.z ?? 0;

      const accel = Math.sqrt(x*x + y*y + z*z);
      if (state.prevAccel === 0) { state.prevAccel = accel; return; }
      const delta = Math.abs(accel - state.prevAccel);
      state.prevAccel = accel;

      const KNOCK_THRESHOLD = 9;
      const now = Date.now();
      if (delta > KNOCK_THRESHOLD) {
        if (now - state.lastKnockTime > 100) { 
          const timeDiff = now - state.lastKnockTime;
          if (timeDiff > 100 && timeDiff < 800) {
            if (now - state.lastSuccessTime > 2000) {
              state.lastSuccessTime = now;
              playDingSound();
              handleShotSuccess();
            }
            state.lastKnockTime = 0;
          } else { state.lastKnockTime = now; }
        }
      }
    };
  });

  const handleTimeOverNextStage = () => {
      const { stageIndex: currentIndex, trainingType: tType } = stateRef.current;
      if (tType === 'review_hole' || tType === 'review_category') {
          const isCategory = tType === 'review_category';
          const isAllFinished = isCategory ? currentIndex + 1 >= parsedHoles.length : true;
          
          if (recordId) {
              const supabase = createClient();
              (async () => {
                  try {
                      const { data: recordData, error } = await supabase.from("records").select("template_settings").eq("id", recordId).single();
                      if (!error && recordData) {
                         const holeToMark = isCategory ? parsedHoles[currentIndex]?.hole : reviewHole;
                         if (holeToMark) {
                             const uniqueKey = isCategory && parsedHoles[currentIndex]?.uniqueId ? parsedHoles[currentIndex].uniqueId : `${reviewCat}_${holeToMark}`;
                             const currentSettings = recordData.template_settings || [];
                             let shouldUpdate = false;
                             const updatedSettings = currentSettings.map((s: any) => {
                                 if (s.type === "review_scorecard" || s.type === "prep_scorecard") {
                                     const currentCompleted = s.completedHoles || [];
                                     let updatedCompleted = [...currentCompleted];
                                     shouldUpdate = true;
                                     updatedCompleted.push(uniqueKey);
                                     
                                     const currentTimes = s.categoryTimes || {};
                                     const newlyElapsed = stateRef.current.sessionElapsedTime - stateRef.current.lastSavedElapsedTime;
                                     if (newlyElapsed > 0) {
                                         shouldUpdate = true;
                                         currentTimes[reviewCat || ""] = (currentTimes[reviewCat || ""] || 0) + newlyElapsed;
                                         stateRef.current.lastSavedElapsedTime = stateRef.current.sessionElapsedTime;
                                     }
                                     return { ...s, completedHoles: updatedCompleted, categoryTimes: currentTimes };
                                 }
                                 return s;
                             });
                             if (shouldUpdate) {
                                 await supabase.from("records").update({ template_settings: updatedSettings }).eq("id", recordId);
                             }
                         }
                      }
                  } catch (e) {
                      console.error("Failed to update completed status", e);
                  }
              })();
          }

          if (isAllFinished) {
               if (typeof sessionStorage !== 'undefined') {
                   try {
                       const chainStr = sessionStorage.getItem('trainingChain') || sessionStorage.getItem('prepChain');
                       if (chainStr) {
                           const chain = JSON.parse(chainStr);
                           const currentIndexInChain = chain.findIndex((c: any) => c.catName === reviewCat);
                           
                           if (currentIndexInChain !== -1 && currentIndexInChain + 1 < chain.length) {
                               const nextCat = chain[currentIndexInChain + 1];
                               const currentPath = window.location.pathname;
                               const nextUrl = `${currentPath}?type=review_category&cat=${encodeURIComponent(nextCat.catName)}&holes=${nextCat.encodedHoles}&recordId=${recordId}&isPrep=${isPrep}`;
                               
                               const normalizedCat = reviewCat?.toLowerCase() || "";
                               const nextNormalized = nextCat.catName.toLowerCase();

                               const getCategoryGroup = (cat: string) => {
                                   if (cat.includes("티샷")) return "tee";
                                   if (["180m이상", "150-179m", "120-149m", "90-119m", "피치샷", "아이언"].some(g => cat.includes(g))) return "second";
                                   if (cat.includes("벙커") || cat.includes("어프로치") || cat.includes("그린주변") || cat.includes("숏게임")) return "short";
                                   if (cat.includes("퍼팅") || cat.includes("putt") || ["9m", "4-8m", "2-3m", "1m"].some(g => cat.includes(g))) return "putt";
                                   return "unknown";
                               };

                               const currentGroup = getCategoryGroup(normalizedCat);
                               const nextGroup = getCategoryGroup(nextNormalized);

                               if (currentGroup === nextGroup && currentGroup !== "unknown") {
                                   router.replace(nextUrl);
                                   return;
                               }
                               
                               const groupNames: Record<string, string> = {
                                   "putt": "퍼팅",
                                   "short": "그린 주변 샷",
                                   "second": "아이언 앤 피치샷",
                                   "tee": "티샷"
                               };
                               
                               let completionPhrase = `다음 훈련을 진행해 주세요.`;
                               if (groupNames[currentGroup]) {
                                   completionPhrase = `${groupNames[currentGroup]} 훈련을 완료하였습니다.`;
                               }

                               speakAndWait(completionPhrase, () => {
                                   router.replace(nextUrl);
                               });
                               return;
                           }
                       }
                   } catch (e) {
                       console.error("Failed to parse trainingChain", e);
                   }
               }
               
               const getGroupName = (cat: string) => {
                   if (cat.includes("티샷")) return "티샷";
                   if (["180m이상", "150-179m", "120-149m", "90-119m", "피치샷", "세컨샷", "아이언"].some(g => cat.includes(g))) return "아이언 앤 피치샷";
                   if (cat.includes("벙커") || cat.includes("어프로치") || cat.includes("그린주변") || cat.includes("숏게임")) return "숏게임";
                   if (cat.includes("퍼팅") || cat.includes("putt") || ["9m", "4-8m", "2-3m", "1m"].some(g => cat.includes(g))) return "퍼팅";
                   return "";
               };
               
               let finalCompletionPhrase = `모든 ${isPrep ? '예습' : '복습'} 훈련을 마쳤습니다.`;
               if (reviewCat) {
                   const cat = reviewCat.toLowerCase();
                   const groupName = getGroupName(cat);
                   if (groupName) {
                       finalCompletionPhrase = `${groupName} ${isPrep ? '예습' : '복습'} 훈련을 마쳤습니다.`;
                   }
               }
               
               setVoiceState(prev => ({ ...prev, transcript: '', statusText: '훈련 완료 저장 중...' }));
               setIsActive(false);
               setIsStarted(false);
               silentAudioRef.current?.pause();
               speakAndWait(finalCompletionPhrase, () => {
                   navigateBack();
               });
           } else {
              setStageIndex(currentIndex + 1);
              setProgress(0);
              stateRef.current.stageIndex = currentIndex + 1;
              stateRef.current.progress = 0;
              setCurrentTimeSeconds(180);
              lastPlayedTimeRef.current = 180;
              const nextHole = parsedHoles[currentIndex + 1];
              if (nextHole) {
                  const { spoken, visual } = generatePrompt(currentIndex + 1);
                  speakAndWait(spoken, visual, () => {
                      setVoiceState(prev => ({ ...prev, transcript: '', statusText: '샷 결과 대기 중 ("성공" 등)' }));
                  });
              }
          }
      }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive && !isPaused && !isLocked) {
      interval = setInterval(() => {
        setSessionElapsedTime(prev => {
          const next = prev + 1;
          stateRef.current.sessionElapsedTime = next;
          return next;
        });

        setCurrentTimeSeconds(prev => {
          const next = prev - 1;
          if (next <= 0) {
             setTimeout(() => {
                 handleTimeOverNextStage();
             }, 0);
              return 180;
          }
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, isPaused, isLocked, parsedHoles, reviewHole, reviewCat, recordId, isPrep]);

  useEffect(() => {
    let commentInterval: NodeJS.Timeout;
    if (trainingType === 'lesson_review' && isActive && !isPaused) {
      commentInterval = setInterval(() => {
        if (lessonReviewComments.length > 0) {
          const comment = lessonReviewComments[lessonReviewCommentIndexRef.current] || "레디";
          lessonReviewCommentIndexRef.current = (lessonReviewCommentIndexRef.current + 1) % lessonReviewComments.length;
          speakAndWait(comment, comment);
        }
      }, (lessonReviewInterval || 25) * 1000);
    }
    return () => clearInterval(commentInterval);
  }, [isActive, isPaused, trainingType, lessonReviewComments, lessonReviewInterval]);

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const requestMotionPermission = async () => {
    if (typeof window === 'undefined') return;
    const DeviceMotion = window.DeviceMotionEvent as any;
    if (typeof DeviceMotion !== 'undefined' && typeof DeviceMotion.requestPermission === 'function') {
      try {
        const response = await DeviceMotion.requestPermission();
        if (response === 'granted') {
          window.removeEventListener('devicemotion', stableDeviceMotionListener, true);
          window.addEventListener('devicemotion', stableDeviceMotionListener, true);
          setSensorAvailable(true);
        } else { setSensorAvailable(false); }
      } catch (e) { setSensorAvailable(false); }
    } else {
      if ('DeviceMotionEvent' in window) {
        window.removeEventListener('devicemotion', stableDeviceMotionListener, true);
        window.addEventListener('devicemotion', stableDeviceMotionListener, true);
        setSensorAvailable(true);
      } else { setSensorAvailable(false); }
    }
  };

  useEffect(() => {
    const handleBeforeUnload = () => {
        if (stateRef.current.trainingType === 'lesson_review') {
            saveLessonReviewProgress(undefined, true);
        }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      stateRef.current.isActive = false;
      window.removeEventListener('devicemotion', stableDeviceMotionListener, true);
      if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (stateRef.current.trainingType === 'lesson_review') {
          saveLessonReviewProgress(undefined, true);
      }
    };
  }, []);
  
  useEffect(() => {
     return () => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
           window.speechSynthesis.cancel();
        }
        if (activeAudioSource) {
           try {
             activeAudioSource.stop();
             activeAudioSource.disconnect();
           } catch (e) {}
           activeAudioSource = null;
        }
     };
  }, []);
  
  useEffect(() => {
     if (!isActive || isPaused) return;
     
     const cat = (reviewCat || "").toLowerCase();
     const currentHoleIndex = stageIndex;
     const ch = parsedHoles[currentHoleIndex];
     const holeText = ch?.hole || reviewHole || "1";
     
     let actualPar = 0;
     if (ch?.par) actualPar = parseInt(ch.par, 10);
     
     let parString = "4";
     let parReading = "포";
     const hStr = String(holeText);
     if (actualPar === 3 || (!actualPar && ["3", "8", "12", "17"].includes(hStr))) {
         parString = "3";
         parReading = "쓰리";
     } else if (actualPar === 5 || (!actualPar && ["4", "9", "13", "15"].includes(hStr))) {
         parString = "5";
         parReading = "파이브";
     } else {
         parString = "4";
         parReading = "포";
     }

     // 티샷 카테고리
     if (cat.includes("티샷")) {
         if (currentTimeSeconds === 120 && sessionElapsedTime > 5 && lastPlayedTimeRef.current !== currentTimeSeconds) {
             lastPlayedTimeRef.current = currentTimeSeconds;
             speakAndWait(`${holeText}번홀 파 ${parReading} 티샷`, `${holeText}번홀 파${parString} 티샷`);
         } else if (currentTimeSeconds === 70 && lastPlayedTimeRef.current !== currentTimeSeconds) {
             lastPlayedTimeRef.current = currentTimeSeconds;
             speakAndWait(`${holeText}번홀 파 ${parReading} 티샷`, `${holeText}번홀 파${parString} 티샷`);
         } else if (currentTimeSeconds === 30 && lastPlayedTimeRef.current !== currentTimeSeconds) {
             lastPlayedTimeRef.current = currentTimeSeconds;
             if (stageIndex === parsedHoles.length - 1) {
                 let hasNextCat = false;
                 try {
                     const chainStr = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('trainingChain') || sessionStorage.getItem('prepChain') : null;
                     if (chainStr) {
                         const chain = JSON.parse(chainStr);
                         const cIdx = chain.findIndex((c: any) => c.catName === reviewCat);
                         if (cIdx !== -1 && cIdx + 1 < chain.length) hasNextCat = true;
                     }
                 } catch(e) {}
                 
                 if (hasNextCat) {
                     speakAndWait(`30초 후 다음훈련을 진행합니다.`, `30초후 다음 훈련으로`);
                 } else {
                     speakAndWait(`30초후 티샷 훈련을 종료합니다.`, `30초후 훈련 종료`);
                 }
             } else {
                 speakAndWait(`30초 후 다음훈련을 진행합니다.`, `30초후 다음 훈련으로`);
             }
         }
     }
     // 아이언&피치샷 카테고리
     else if (cat.includes("아이언") || cat.includes("피치샷") || cat.includes("180") || cat.includes("150") || cat.includes("120") || cat.includes("90")) {
         let distStr = "";
         if (ch && ch.attempt) {
             const parts = String(ch.attempt).split('/');
             if (parts.length >= 2) {
                 const distMatch = parts[1].match(/(\d+)m?/i);
                 if (distMatch && distMatch[1]) distStr = distMatch[1];
             } else {
                 const distMatch = String(ch.attempt).match(/(\d+)m?/i);
                 if (distMatch && distMatch[1]) distStr = distMatch[1];
             }
         }
         if (!distStr) distStr = reviewCat?.replace(/[^0-9]/g, '') || "";
         const distToRead = convertDistToKorean(distStr);
         
         if (currentTimeSeconds === 120 && sessionElapsedTime > 5 && lastPlayedTimeRef.current !== currentTimeSeconds) {
             lastPlayedTimeRef.current = currentTimeSeconds;
             speakAndWait(`${holeText}번홀 파 ${parReading} ${distToRead} 미터`, `${holeText}번홀 파${parString} ${distStr}m`);
         } else if (currentTimeSeconds === 70 && lastPlayedTimeRef.current !== currentTimeSeconds) {
             lastPlayedTimeRef.current = currentTimeSeconds;
             speakAndWait(`${holeText}번홀 파 ${parReading} ${distToRead} 미터`, `${holeText}번홀 파${parString} ${distStr}m`);
         } else if (currentTimeSeconds === 30 && lastPlayedTimeRef.current !== currentTimeSeconds) {
             lastPlayedTimeRef.current = currentTimeSeconds;
             if (stageIndex === parsedHoles.length - 1) {
                 let hasNextCat = false;
                 try {
                     const chainStr = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('trainingChain') || sessionStorage.getItem('prepChain') : null;
                     if (chainStr) {
                         const chain = JSON.parse(chainStr);
                         const cIdx = chain.findIndex((c: any) => c.catName === reviewCat);
                         if (cIdx !== -1 && cIdx + 1 < chain.length) hasNextCat = true;
                     }
                 } catch(e) {}
                 
                 if (hasNextCat) {
                     speakAndWait(`30초 후 다음훈련을 진행합니다.`, `30초후 다음 훈련으로`);
                 } else {
                     speakAndWait(`30초후 세컨샷 훈련을 종료합니다.`, `30초후 훈련 종료`);
                 }
             } else {
                 speakAndWait(`30초 후 다음훈련을 진행합니다.`, `30초후 다음 훈련으로`);
             }
         }
     }
     // 그린주변샷 (어프로치/벙커/숏게임/그린주변샷) 카테고리
     else if (cat.includes("어프로치") || cat.includes("그린주변") || cat.includes("숏게임") || cat.includes("벙커")) {
         let distStr = "";
         let attemptLoc = "어프로치";
         if (ch && ch.attempt) {
             const parts = String(ch.attempt).split('/');
             if (parts.length >= 2) {
                 attemptLoc = parts[0].trim();
                 const distMatch = parts[1].match(/(\d+)m?/i);
                 if (distMatch && distMatch[1]) distStr = distMatch[1];
             } else {
                 if (String(ch.attempt).includes("벙커")) attemptLoc = "벙커";
                 const distMatch = String(ch.attempt).match(/(\d+)m?/i);
                 if (distMatch && distMatch[1]) distStr = distMatch[1];
             }
         }
         
         if (currentTimeSeconds === 120 && sessionElapsedTime > 5 && lastPlayedTimeRef.current !== currentTimeSeconds) {
             lastPlayedTimeRef.current = currentTimeSeconds;
             speakAndWait(`${holeText}번홀 파 ${parReading} ${attemptLoc} ${distStr}미터`, `${holeText}번홀 파${parString} ${attemptLoc} ${distStr}m`);
         } else if (currentTimeSeconds === 70 && lastPlayedTimeRef.current !== currentTimeSeconds) {
             lastPlayedTimeRef.current = currentTimeSeconds;
             speakAndWait(`${holeText}번홀 파 ${parReading} ${attemptLoc} ${distStr}미터`, `${holeText}번홀 파${parString} ${attemptLoc} ${distStr}m`);
         } else if (currentTimeSeconds === 30 && lastPlayedTimeRef.current !== currentTimeSeconds) {
             lastPlayedTimeRef.current = currentTimeSeconds;
             if (stageIndex === parsedHoles.length - 1) {
                 let hasNextCat = false;
                 try {
                     const chainStr = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('trainingChain') || sessionStorage.getItem('prepChain') : null;
                     if (chainStr) {
                         const chain = JSON.parse(chainStr);
                         const cIdx = chain.findIndex((c: any) => c.catName === reviewCat);
                         if (cIdx !== -1 && cIdx + 1 < chain.length) hasNextCat = true;
                     }
                 } catch(e) {}
                 
                 if (hasNextCat) {
                     speakAndWait(`30초 후 다음훈련을 진행합니다.`, `30초후 다음 훈련으로`);
                 } else {
                     speakAndWait(`30초후 숏게임 훈련을 종료합니다.`, `30초후 훈련 종료`);
                 }
             } else {
                 speakAndWait(`30초 후 다음훈련을 진행합니다.`, `30초후 다음 훈련으로`);
             }
         }
     }
     // 퍼팅 카테고리
     else if (cat.includes("퍼팅") || cat.includes("putt") || ["9m이상", "4-8m", "2-3m", "1m"].includes(cat)) {
         let distStr = "";
         if (ch && ch.attempt) {
             const parts = String(ch.attempt).split('/');
             if (parts.length >= 2) {
                 const distMatch = parts[1].match(/(\d+)m?/i);
                 if (distMatch && distMatch[1]) distStr = distMatch[1];
             } else {
                 const distMatch = String(ch.attempt).match(/(\d+)m?/i);
                 if (distMatch && distMatch[1]) distStr = distMatch[1];
             }
         }
         if (!distStr) distStr = reviewCat?.replace(/[^0-9]/g, '') || "";
         const distToRead = convertDistToKorean(distStr);
         
         if (currentTimeSeconds === 120 && sessionElapsedTime > 5 && lastPlayedTimeRef.current !== currentTimeSeconds) {
             lastPlayedTimeRef.current = currentTimeSeconds;
             speakAndWait(`${holeText}번홀 파 ${parReading} ${distToRead} 미터`, `${holeText}번홀 파${parString} ${distStr}m`);
         } else if (currentTimeSeconds === 70 && lastPlayedTimeRef.current !== currentTimeSeconds) {
             lastPlayedTimeRef.current = currentTimeSeconds;
             speakAndWait(`${holeText}번홀 파 ${parReading} ${distToRead} 미터`, `${holeText}번홀 파${parString} ${distStr}m`);
         } else if (currentTimeSeconds === 30 && lastPlayedTimeRef.current !== currentTimeSeconds) {
             lastPlayedTimeRef.current = currentTimeSeconds;
             if (stageIndex === parsedHoles.length - 1) {
                 let hasNextCat = false;
                 try {
                     const chainStr = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('trainingChain') || sessionStorage.getItem('prepChain') : null;
                     if (chainStr) {
                         const chain = JSON.parse(chainStr);
                         const cIdx = chain.findIndex((c: any) => c.catName === reviewCat);
                         if (cIdx !== -1 && cIdx + 1 < chain.length) hasNextCat = true;
                     }
                 } catch(e) {}
                 
                 if (hasNextCat) {
                     speakAndWait(`30초 후 다음훈련을 진행합니다.`, `30초후 다음 훈련으로`);
                 } else {
                     speakAndWait(`30초후 퍼팅 훈련을 종료합니다.`, `30초후 훈련 종료`);
                 }
             } else {
                 speakAndWait(`30초 후 다음훈련을 진행합니다.`, `30초후 다음 훈련으로`);
             }
         }
     }
  }, [currentTimeSeconds, isActive, isPaused, stageIndex, reviewCat, parsedHoles, reviewHole, sessionElapsedTime]);

  const speakAndWait = (text: string, visualTextOrCallback?: string | (() => void), callback?: () => void) => {
    let cb = callback;
    let visual = text;
    if (typeof visualTextOrCallback === 'function') {
        cb = visualTextOrCallback;
    } else if (typeof visualTextOrCallback === 'string') {
        visual = visualTextOrCallback;
    }
    
    setCurrentPrompt(visual);
    setCurrentSpokenPrompt(text);
    isPlayingSpeechRef.current = true;
    if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
    }
    setVoiceState(prev => ({ ...prev, statusText: '안내 중...' }));
    
    const startTime = Date.now();
    let isFinished = false;
    const finishSpeech = () => {
        if (isFinished) return;
        isFinished = true;
        isPlayingSpeechRef.current = false;
        setVoiceState(prev => ({ ...prev, statusText: '샷 결과 대기 중 ("성공" 등)' }));
        if ('mediaSession' in navigator) { navigator.mediaSession.playbackState = 'playing'; }
        
        const elapsed = Date.now() - startTime;
        if (elapsed < 3000 && cb) {
            setTimeout(() => { if (cb) cb(); }, 3000 - elapsed);
        } else {
            if (cb) cb();
        }
    };

    const lines = text.split('\n').map(l => l.trim());
    if (lines.every(l => l.length === 0)) {
        finishSpeech();
        return;
    }

    let currentLineIndex = 0;
    const playNextLine = () => {
        if (isFinished) return;
        if (currentLineIndex >= lines.length) {
            finishSpeech();
            return;
        }
        
        const line = lines[currentLineIndex];
        currentLineIndex++;
        
        if (line.length === 0) {
            // 빈 줄(엔터)인 경우 1초 대기 후 다음 줄로 넘어감
            setTimeout(() => {
                if (!isFinished) playNextLine();
            }, 1000);
        } else {
            playSpeech(line, null, () => {
                if (currentLineIndex < lines.length) {
                    setTimeout(() => {
                        if (!isFinished) playNextLine();
                    }, 1000);
                } else {
                    finishSpeech();
                }
            });
        }
    };

    playNextLine();

    const fallbackMs = Math.max(text.length * 300, 5000) + 1000 + (lines.length - 1) * 1000;
    setTimeout(() => { if (!isFinished) finishSpeech(); }, fallbackMs);
  };

  const handleVoiceInput = (text: string) => {
     if (stateRef.current.isWaitingForChainConfirm) {
         const confirmKeywords = ["네", "예", "오케이", "응", "어", "시작", "진행", "해줘", "훈련"];
         const rejectKeywords = ["아니", "그만", "끝", "종료", "안해"];
         if (confirmKeywords.some(k => text.includes(k)) && stateRef.current.nextChainUrl) {
             setIsWaitingForChainConfirm(false);
             router.replace(stateRef.current.nextChainUrl);
         } else if (rejectKeywords.some(k => text.includes(k))) {
             navigateBack();
         }
     } else if (SUCCESS_KEYWORDS.some(k => text.includes(k))) {
         handleShotSuccess();
     }
  };

  const handleStartLessonReview = () => {
      setIsStarted(true);
      setIsActive(true);
      const comment = lessonReviewComments[0] || "레슨 복기 훈련을 시작합니다.";
      lessonReviewCommentIndexRef.current = 1 % Math.max(1, lessonReviewComments.length);
      
      setTimeout(() => {
          speakAndWait(comment, comment);
      }, 2000);
      
      requestMotionPermission();
      silentAudioRef.current?.play().catch(e => {});
  };

  useEffect(() => {
     handleVoiceInputRef.current = handleVoiceInput;
     handleShotSuccessRef.current = handleShotSuccess;
     handleStartLessonReviewRef.current = handleStartLessonReview;
  });

  const getTargetForCategory = (cat: string) => {
    return 1;
  };

  const getGoalTextForCategory = (cat: string, n: string, distStr?: string) => {
    if (n.includes("180")) {
        const dist = distStr ? parseInt(distStr, 10) : 0;
        if (dist >= 211) return "다음샷 하기 좋은 위치로 적중 시키기";
        return "10미터 이내로 적중 시키기";
    }
    if (n.includes("150")) return "7미터 이내 붙이기";
    if (n.includes("120") || n.includes("149")) return "5미터 이내 붙이기";
    if (n.includes("119") || n.includes("90") || n.includes("피치샷")) return "3미터 이내 붙이기";
    if (n.includes("어프로치")) {
        const dist = distStr ? parseInt(distStr, 10) : 0;
        if (dist > 0 && dist <= 10) return "1미터 이내로 붙이기";
        return "2미터 이내 붙이기";
    }
    if (n.includes("벙커")) return "3미터 이내 붙이기";
    if (n.includes("9m") || n.includes("9M")) return "1미터 이내로 적중 시키기";
    if (n.includes("4-8m") || n.includes("4~8m") || n.includes("4-8M") || n.includes("4~8M")) return "원퍼트 하기";
    if (n.includes("2-3m") || n.includes("2~3m") || n.includes("2-3M") || n.includes("2~3M")) return "원퍼트 하기";
    if (n.includes("1m") || n.includes("1M")) return "원퍼트 하기";
    if (n.includes("티샷")) return "페어웨이 적중";
    return "성공하기";
  };

  const TRAINING_CONFIGS: Record<TrainingType, TrainingConfig> = {
  'shot': {
    id: 'shot',
    title: '티샷 비거리',
    uiName: '티샷 비거리',
    successPrefix: '',
    successSuffix: '개 남았습니다. 최대 스피드로 쳐보세요.',
    stages: [
      {
        stageNum: 1,
        target: 7,
        introPrompt: "목표는 최대 스피드로 7개 치기입니다.",
        goalDesc: "최대 스피드로 7개 치기"
      }
    ],
    completionText: "티샷 비거리 복습 목표를 달성하였습니다. 수고하셨습니다."
  },
  'tee-shot': {
    id: 'tee-shot',
    title: '티샷 정확도',
    uiName: '티샷 정확도',
    successPrefix: '굿샷 ',
    successSuffix: '개 남았습니다.',
    stages: [
      {
        stageNum: 1,
        target: 3,
        introPrompt: "1번홀 티샷 목표는 페어웨이 3회 적중입니다.",
        goalDesc: "페어웨이 3회 적중",
        nextStagePrompt: "다음 티샷 정확도 복습홀은 2번홀 입니다. 티샷 목표는 페어웨이 3회 적중입니다."
      },
      {
        stageNum: 2,
        target: 3,
        introPrompt: "티샷 목표는 페어웨이 3회 적중입니다.",
        goalDesc: "페어웨이 3회 적중"
      }
    ],
    completionText: "티샷 정확도 복습 목표를 달성하였습니다. 수고하셨습니다."
  },
  '150-179m': {
    id: '150-179m',
    title: '150~179m',
    uiName: '150~179m 복습',
    successPrefix: "성공",
    successSuffix: "",
    stages: [
      { stageNum: 1, target: 4, introPrompt: "150~179m 복습 훈련을 시작합니다.", goalDesc: "그린 안착" }
    ],
    completionText: "150~179미터 복습 목표를 달성하였습니다. 수고하셨습니다."
  },
  '180m-plus': {
    id: '180m-plus',
    title: '180m 이상',
    uiName: '180m 이상 복습',
    successPrefix: '굿샷 ',
    successSuffix: '개 남았습니다.',
    stages: [
      {
        stageNum: 1,
        target: 4,
        introPrompt: "1번홀 185미터 지점 입니다. 목표는 7미터 이내로 4개 적중 시키기.",
        goalDesc: "7미터 이내로 4개 적중 시키기",
        nextStagePrompt: "다음 복습홀은 2번홀 185미터 지점 입니다. 목표는 7미터 이내로 4개 적중 시키기."
      },
      {
        stageNum: 2,
        target: 4,
        introPrompt: "목표는 7미터 이내로 4개 적중 시키기.",
        goalDesc: "7미터 이내로 4개 적중 시키기"
      }
    ],
    completionText: "180미터 이상 복습 목표를 달성하였습니다. 수고하셨습니다."
  },
  '120-149m': {
    id: '120-149m',
    title: '120~149m',
    uiName: '120~149m 복습',
    successPrefix: '굿샷 ',
    successSuffix: '개 남았습니다.',
    stages: [
      {
        stageNum: 1,
        target: 4,
        introPrompt: "3번홀 130미터 지점 입니다. 목표는 5미터 이내로 4개 적중 시키기.",
        goalDesc: "5미터 이내로 4개 적중 시키기",
        nextStagePrompt: "다음 복습홀은 4번홀 140미터 지점 입니다. 목표는 5미터 이내로 4개 적중 시키기."
      },
      {
        stageNum: 2,
        target: 4,
        introPrompt: "목표는 5미터 이내로 4개 적중 시키기.",
        goalDesc: "5미터 이내로 4개 적중 시키기"
      }
    ],
    completionText: "120에서 149미터 복습 목표를 달성하였습니다. 수고하셨습니다."
  },
  '90-119m': {
    id: '90-119m',
    title: '90~119m',
    uiName: '90~119m 복습',
    successPrefix: '굿샷 ',
    successSuffix: '개 남았습니다.',
    stages: [
      {
        stageNum: 1,
        target: 4,
        introPrompt: "5번홀 100미터 지점 입니다. 목표는 4미터 이내로 4개 적중 시키기.",
        goalDesc: "4미터 이내로 4개 적중 시키기",
        nextStagePrompt: "다음 복습홀은 6번홀 110미터 지점 입니다. 목표는 4미터 이내로 4개 적중 시키기."
      },
      {
        stageNum: 2,
        target: 4,
        introPrompt: "목표는 4미터 이내로 4개 적중 시키기.",
        goalDesc: "4미터 이내로 4개 적중 시키기"
      }
    ],
    completionText: "90에서 119미터 복습 목표를 달성하였습니다. 수고하셨습니다."
  },
  'pitch-shot': {
    id: 'pitch-shot',
    title: '피치샷',
    uiName: '피치샷 복습',
    successPrefix: '굿샷 ',
    successSuffix: '개 남았습니다.',
    stages: [
      {
        stageNum: 1,
        target: 4,
        introPrompt: "7번홀 50미터 지점 입니다. 목표는 3미터 이내로 4개 적중 시키기.",
        goalDesc: "3미터 이내로 4개 적중 시키기",
        nextStagePrompt: "다음 복습홀은 8번홀 60미터 지점 입니다. 목표는 3미터 이내로 4개 적중 시키기."
      },
      {
        stageNum: 2,
        target: 4,
        introPrompt: "목표는 3미터 이내로 4개 적중 시키기.",
        goalDesc: "3미터 이내로 4개 적중 시키기"
      }
    ],
    completionText: "피치샷 복습 목표를 달성하였습니다. 수고하셨습니다."
  },
  'bunker': {
    id: 'bunker',
    title: '벙커',
    uiName: '벙커 복습',
    successPrefix: '굿샷 ',
    successSuffix: '개 남았습니다.',
    stages: [
      {
        stageNum: 1,
        target: 4,
        introPrompt: "1번홀 벙커 지점 입니다. 목표는 3미터 이내로 4개 적중 시키기.",
        goalDesc: "3미터 이내로 4개 적중 시키기",
        nextStagePrompt: "다음 복습홀은 2번홀 벙커 지점 입니다. 목표는 3미터 이내로 4개 적중 시키기."
      },
      {
        stageNum: 2,
        target: 4,
        introPrompt: "목표는 3미터 이내로 4개 적중 시키기.",
        goalDesc: "3미터 이내로 4개 적중 시키기"
      }
    ],
    completionText: "벙커 복습 목표를 달성하였습니다. 수고하셨습니다."
  },
  'approach': {
    id: 'approach',
    title: '어프로치',
    uiName: '어프로치 복습',
    successPrefix: '굿 어프로치 ',
    successSuffix: '개 남았습니다.',
    stages: [
      {
        stageNum: 1,
        target: 4,
        introPrompt: "3번홀 20미터 지점 입니다. 목표는 2미터 이내로 4개 적중 시키기.",
        goalDesc: "2미터 이내로 4개 적중 시키기",
        nextStagePrompt: "다음 복습홀은 4번홀 15미터 지점 입니다. 목표는 2미터 이내로 4개 적중 시키기."
      },
      {
        stageNum: 2,
        target: 4,
        introPrompt: "목표는 2미터 이내로 4개 적중 시키기.",
        goalDesc: "2미터 이내로 4개 적중 시키기"
      }
    ],
    completionText: "어프로치 복습 목표를 달성하였습니다. 수고하셨습니다."
  },
  '9m-plus-putt': {
    id: '9m-plus-putt',
    title: '9m 이상 퍼팅',
    uiName: '9미터 이상 퍼팅',
    successPrefix: '굿 펏 ',
    successSuffix: '개 남았습니다.',
    stages: [
      {
        stageNum: 1,
        target: 4,
        introPrompt: "1번홀 10미터 지점 입니다. 목표는 1미터 이내로 4개 적중 시키기.",
        goalDesc: "1미터 이내로 4개 적중 시키기",
        nextStagePrompt: "다음 복습홀은 2번홀 12미터 지점 입니다. 목표는 1미터 이내로 4개 적중 시키기."
      },
      {
        stageNum: 2,
        target: 4,
        introPrompt: "목표는 1미터 이내로 4개 적중 시키기.",
        goalDesc: "1미터 이내로 4개 적중 시키기"
      }
    ],
    completionText: "9미터 이상 퍼팅 복습 목표를 달성하였습니다. 수고하셨습니다."
  },
  '4-8m-putt': {
    id: '4-8m-putt',
    title: '4~8m 퍼팅',
    uiName: '4~8미터 퍼팅 복습',
    successPrefix: '굿 펏 ',
    successSuffix: '개 남았습니다.',
    stages: [
      {
        stageNum: 1,
        target: 2,
        introPrompt: "3번홀 5미터 지점 입니다. 목표는 원퍼트 2개 하기 입니다.",
        goalDesc: "원퍼트 2개 하기",
        nextStagePrompt: "다음 복습홀은 4번홀 6미터 지점 입니다. 목표는 원퍼트 2개 하기 입니다."
      },
      {
        stageNum: 2,
        target: 2,
        introPrompt: "목표는 원퍼트 2개 하기 입니다.",
        goalDesc: "원퍼트 2개 하기"
      }
    ],
    completionText: "4에서 8미터 퍼팅 복습 목표를 달성하였습니다. 수고하셨습니다."
  },
  '2-3m-putt': {
    id: '2-3m-putt',
    title: '2~3m 퍼팅',
    uiName: '2~3미터 퍼팅 복습',
    successPrefix: '굿 펏 ',
    successSuffix: '개 남았습니다.',
    stages: [
      {
        stageNum: 1,
        target: 5,
        introPrompt: "5번홀 2미터 지점 입니다. 목표는 원퍼트 5개 하기 입니다.",
        goalDesc: "원퍼트 5개 하기",
        nextStagePrompt: "다음 복습홀은 6번홀 3미터 지점 입니다. 목표는 원퍼트 5개 하기 입니다."
      },
      {
        stageNum: 2,
        target: 5,
        introPrompt: "목표는 원퍼트 5개 하기 입니다.",
        goalDesc: "원퍼트 5개 하기"
      }
    ],
    completionText: "2에서 3미터 퍼팅 복습 목표를 달성하였습니다. 수고하셨습니다."
  },
  '1m-putt': {
    id: '1m-putt',
    title: '1m 퍼팅',
    uiName: '1미터 퍼팅 복습',
    successPrefix: '굿 펏 ',
    successSuffix: '개 남았습니다.',
    stages: [
      {
        stageNum: 1,
        target: 6,
        introPrompt: "7번홀 1미터 지점 입니다. 목표는 원퍼트 6개 하기 입니다.",
        goalDesc: "원퍼트 6개 하기",
        nextStagePrompt: "다음 복습홀은 8번홀 1미터 지점 입니다. 목표는 원퍼트 6개 하기 입니다."
      },
      {
        stageNum: 2,
        target: 6,
        introPrompt: "목표는 원퍼트 6개 하기 입니다.",
        goalDesc: "원퍼트 6개 하기"
      }
    ],
    completionText: "1미터 퍼팅 복습 목표를 달성하였습니다. 수고하셨습니다."
  }
};

interface VoiceState {
  isListening: boolean;
  transcript: string;
  statusText: string;
}

const SUCCESS_KEYWORDS = ['성공', '완료', '왈료', '알료', '송공', '선공', '상공', '성동', '천공', '전공', '청공', '성곰', '선곰', '천곰', '어', '어캐', '응', '음', '스공', '공', '성', '선', '에', '이', '오', '우', '하', '호', '후', '예', '맞아', '읏', '앗', '흡', '굿', '굳', '구', '군', 'good'];
const READY_KEYWORDS = ['레디', '준비', '네디', '래디', '매디'];


const numberToKorean = (num: number) => {
    const KOREAN_DIGITS = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
    const KOREAN_UNITS = ["", "십", "백", "천"];
    let res = "";
    const strNum = num.toString();
    for (let i = 0; i < strNum.length; i++) {
        const digit = parseInt(strNum[i]);
        if (digit !== 0) {
            let digitStr = KOREAN_DIGITS[digit];
            if (digit === 1 && i < strNum.length - 1) {
                digitStr = "";
            }
            res += digitStr + KOREAN_UNITS[strNum.length - 1 - i];
        }
    }
    return res || "영";
};

const convertDistToKorean = (str: string) => {
    let res = str.replace(/m/gi, ' 미터 ');
    res = res.replace(/-/g, '에서 ');
    res = res.replace(/~/g, '에서 ');
    res = res.replace(/\d+/g, (match) => numberToKorean(parseInt(match, 10)));
    return res;
};

  const generatePrompt = (stageIndex: number) => {
      const tType = reviewType || stateRef.current.trainingType;
      const categoryName = reviewCat || '';
      
      let spoken = '';
      let visual = '';
      
      if (tType === 'review_hole' || tType === 'review_category') {
           const isCategory = tType === 'review_category';
           let holeText = "";
           let prefixSpoken = "";
           
           const isPuttSubCategory = !isPrep && (categoryName.toLowerCase().includes("putt") || 
                                     categoryName.includes("퍼팅") || 
                                     ["9m이상", "4-8m", "2-3m", "1m"].includes(categoryName.toLowerCase()));
                                  
           if (stageIndex === 0 && isCategory) {
                if (isPuttSubCategory) {
                    try {
                        const chainStr = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('trainingChain') : null;
                        if (chainStr) {
                            const chain = JSON.parse(chainStr);
                            const puttingShots = chain.filter((c: any) => ["9m이상", "4-8m", "2-3m", "1m"].includes(c.catName.toLowerCase()) || c.catName.includes("퍼팅"));
                            if (puttingShots.length > 0) {
                                const firstPuttCat = puttingShots[0].catName;
                                if (firstPuttCat === categoryName) {
                                    prefixSpoken = "퍼팅 복습 훈련입니다. ";
                                }
                            } else {
                                prefixSpoken = "퍼팅 복습 훈련입니다. ";
                            }
                        } else {
                            prefixSpoken = "퍼팅 복습 훈련입니다. ";
                        }
                    } catch(e) {
                        prefixSpoken = "퍼팅 복습 훈련입니다. ";
                    }
                } else if (isPrep) {
                    if (categoryName === "티샷") {
                        prefixSpoken = "티샷 예습 훈련입니다. ";
                    } else if (categoryName.includes("벙커")) {
                        prefixSpoken = "벙커 예습 훈련입니다. ";
                    } else if (categoryName.includes("어프로치")) {
                        prefixSpoken = "어프로치 예습 훈련입니다. ";
                    } else if (categoryName === "아이언&피치샷") {
                        prefixSpoken = "세컨샷 훈련입니다. ";
                    }
                } else {
                    if (categoryName === "티샷 정확도") {
                       prefixSpoken = "티샷 복습 훈련입니다. ";
                   } else if (["180M이상", "150-179M", "120-149M", "90-119M", "피치샷"].includes(categoryName)) {
                       prefixSpoken = "";
                   } else if (categoryName === "아이언&피치샷") {
                       prefixSpoken = "세컨샷 훈련입니다. ";
                   } else {
                       prefixSpoken = `${convertDistToKorean(categoryName).trim()} 훈련입니다. `;
                   }
               }
           }
          
          if (isCategory && isPrep) {
              const ch = parsedHoles[stageIndex];
              holeText = ch?.holeText || ch?.hole || String(stageIndex + 1);
          } else if (isCategory && !isPrep) {
              holeText = parsedHoles[stageIndex]?.hole || "1";
          } else {
              holeText = reviewHole || "1";
          }
          
          let parString = "";
          let parReading = "";
          let actualPar = 0;
          if (isCategory && parsedHoles[stageIndex]?.par) {
              actualPar = parseInt(parsedHoles[stageIndex].par, 10);
          }
          const hStr = String(holeText);
          
          if (actualPar === 3 || (!actualPar && ["3", "8", "12", "17"].includes(hStr))) {
              parString = "3";
              parReading = "쓰리";
          } else if (actualPar === 5 || (!actualPar && ["4", "9", "13", "15"].includes(hStr))) {
              parString = "5";
              parReading = "파이브";
          } else {
              parString = "4";
              parReading = "포";
          }
          
          const targetStr = categoryName || '';
          
          let actualPos: string | null = null;
          let actualDist: string | null = null;
          if (isCategory) {
              const ch = parsedHoles[stageIndex];
              if (ch && ch.attempt) {
                  const parts = String(ch.attempt).split('/');
                  if (parts.length >= 2) {
                      actualPos = parts[0].trim();
                      const distMatch = parts[1].match(/(\d+)m?/i);
                      if (distMatch && distMatch[1]) {
                          actualDist = distMatch[1];
                      }
                  } else {
                      const distMatch = String(ch.attempt).match(/(\d+)m?/i);
                      if (distMatch && distMatch[1]) {
                          actualDist = distMatch[1];
                      }
                  }
              }
          }
          
          if (targetStr.includes("티샷")) {
              if (isPrep) {
                  const ch = parsedHoles[stageIndex];
                  const resText = ch?.result || "";
                  const isPenalty = resText.includes("오비") || resText.includes("패널티") || resText.includes("페널티") || resText.includes("벌타") || resText === "OB" || resText === "PA" || resText.includes("해저드");
                  const isFairwayBunker = resText.includes("페어웨이 벙커");
                  
                  let remainDist = 9999;
                  const parts = resText.split('/');
                  if (parts.length > 1) {
                      const distMatch = parts[1].match(/(\d+)/);
                      if (distMatch) {
                          remainDist = parseInt(distMatch[1], 10);
                      }
                  }
                  
                  const isRough = resText.includes("러프") || resText.includes("RO");
                  const isForest = resText.includes("숲속") || resText.includes("FO");
                  const isLongPar4 = parString === "4" && remainDist >= 170 && remainDist !== 9999;
                  
                  if (parString === "5" && remainDist <= 230) {
                      spoken = `${holeText}번홀, 투온이 가능한 파 ${parReading}입니다. 정확하게 멀리 쳐주세요.`;
                      visual = `${holeText}번홀 투온 찬스 - 티샷 집중`;
                  } else if (parString === "4" && remainDist <= 89) {
                      spoken = `${holeText}번홀, 버디 확률이 높은 파 ${parReading} 입니다. 티샷에 집중해 주세요.`;
                      visual = `${holeText}번홀 버디 찬스 - 티샷 집중`;
                  } else if (isLongPar4) {
                      spoken = `${holeText}번홀, 세컨샷 부담을 줄일 수 있도록 비거리를 확보해 티샷해 주세요.`;
                      visual = `${holeText}번홀 - 비거리 확보 필요`;
                  } else if (isRough) {
                      spoken = `${holeText}번홀, 파 ${parReading}, 페어웨이를 지킬 수 있도록 티샷해 주세요.`;
                      visual = `${holeText}번홀 - 페어웨이 지키기`;
                  } else if (isForest) {
                      spoken = `${holeText}번홀, 파 ${parReading}, 페어웨이를 지킬 수 있도록 안전하게 공략해 주세요.`;
                      visual = `${holeText}번홀 - 안전한 공략`;
                  } else if (isPenalty) {
                      spoken = `${holeText}번홀, 파 ${parReading}, 페널티 구역을 주의하며 티샷에 집중해 주세요.`;
                      visual = `${holeText}번홀 파${parString} - 페널티 주의`;
                  } else if (isFairwayBunker) {
                      spoken = `${holeText}번홀, 파 ${parReading}, 페어웨이 벙커를 주의하며 티샷해 주세요.`;
                      visual = `${holeText}번홀 파${parString} - 페어웨이 벙커 주의`;
                  } else {
                      let wind = windAssignmentsRef.current[parseInt(holeText)];
                      if (wind) {
                          let windText = "";
                          if (wind === "맞바람") windText = "한클럽 맞바람 입니다. 낮은 탄도로 티샷해 주세요.";
                          else if (wind === "뒷바람") windText = "한클럽 뒷바람 입니다. 높은 탄도로 티샷해 주세요.";
                          else if (wind === "강한 맞바람") windText = "두클럽 맞바람 입니다. 낮은 탄도로 티샷해 주세요.";
                          else if (wind === "강한 뒷바람") windText = "두클럽 뒷바람 입니다. 높은 탄도로 티샷해 주세요.";
                          else if (wind === "훅바람") windText = "티샷. 훅바람에 대비하여 우측을 에임하고 훈련해 주세요.";
                          else if (wind === "슬라이스 바람") windText = "티샷. 슬라이스 바람에 대비하여 좌측을 에임하고 훈련해 주세요.";
                          else windText = `티샷. 바람은 ${wind} 입니다.`;
                          spoken = `${holeText}번홀, 파 ${parReading}, ${windText}`;
                          visual = `${holeText}번홀 - Par ${parString} - ${wind}`;
                      } else {
                          const noWindPrompts = ["세컨샷 하기 좋은 위치로 티샷 해 주세요.", "홀 형태에 맞는 구질로 티샷해 주세요."];
                            const randomNoWindPrompt = noWindPrompts[Math.floor(Math.random() * noWindPrompts.length)];
                            spoken = `${holeText}번홀, 파 ${parReading}, ${randomNoWindPrompt}`;
                          visual = `${holeText}번홀 - Par ${parString} - 페어웨이 지키기`;
                      }
                  }
                  return { spoken: prefixSpoken + spoken, visual };
              } else {
                  let wind = windAssignmentsRef.current[parseInt(holeText)];
                  if (wind) {
                      spoken = `${holeText}번홀, 파 ${parReading}, 티샷, ${wind} 입니다.`;
                      visual = `${holeText}번홀 - Par ${parString} - ${wind}`;
                  } else {
                      let resultText = "";
                      const ch = parsedHoles[stageIndex];
                      const resultParts = ch?.result ? ch.result.split(' / ') : ["알수없음", ""];
                      const loc = resultParts[0];
                      const remainDist = resultParts[1] ? resultParts[1].replace('m', '') : "";
                      if (loc.includes("그린")) {
                          resultText = remainDist ? `${convertDistToKorean(remainDist.trim())} 미터` : "온그린";
                      } else if (loc.includes("벙커")) {
                          resultText = "벙커";
                      } else if (loc.includes("오비") || loc === "OB" || loc === "PA") {
                          resultText = "오비";
                      } else if (loc.includes("페널티") || loc.includes("패널티") || loc.includes("해저드") || loc.includes("벌타")) {
                          resultText = "페널티";
                      } else {
                          resultText = "온그린미스";
                      }
                      spoken = `${holeText}번홀, 파 ${parReading}, 티샷 결과  ${resultText}`;
                      visual = `${holeText}번홀 - Par ${parString} 결과: ${resultText}`;
                  }
                  
                  if (targetStr === "티샷 비거리") {
                      spoken = "목표는 최대 스피드로 1개 치기입니다.";
                      visual = "최대 스피드로 1개 치기";
                  } else {
                      const ch = parsedHoles[stageIndex];
                      const resultParts = ch?.result ? ch.result.split(' / ') : ["알수없음", ""];
                      const loc = resultParts[0];
                      const remainDist = resultParts[1] ? resultParts[1].replace('m', '') : "";
                      
                      if (loc.includes("페어웨이") && !loc.includes("벙커")) {
                          let distText = remainDist ? `${convertDistToKorean(remainDist.trim())} 미터` : "페어웨이";
                          spoken = `${holeText}번홀 파 ${parReading} 티샷\n${holeText}번홀 파 ${parReading} 티샷 결과  ${distText}`;
                      } else {
                          spoken = `${holeText}번홀 파 ${parReading} 티샷\n${holeText}번홀 파 ${parReading} 티샷 결과  ${loc}`;
                      }
                      visual = `${holeText}번홀 파 ${parReading} 티샷 결과: ${loc}`;
                  }
                  return { spoken: prefixSpoken + spoken, visual };
              }
          }
          
          if (targetStr.includes("180") || targetStr.includes("150") || targetStr.includes("120") || targetStr.includes("90") || targetStr.includes("피치샷")) {
              const pinArr = ["앞핀", "백핀", "좌핀", "우핀", "센터핀"];
              const windArr = ["맞바람", "뒷바람", "강한 맞바람", "강한 뒷바람", "훅바람", "슬라이스 바람"];
              const pin = pinArr[Math.floor(Math.random() * pinArr.length)];
              const wind = windArr[Math.floor(Math.random() * windArr.length)];
              
              const isOver = !actualDist && targetStr.includes('이상');
              let distStr = actualDist || targetStr.replace(/\s*이상/g, '').replace(/m/gi, '');
              if (distStr === "피치샷") distStr = actualDist || "60~80";
              const distToRead = convertDistToKorean(distStr);
              
              const goalText = getGoalTextForCategory(targetStr, targetStr, distStr);
              let windStrategy = "";
              if (wind === "맞바람") windStrategy = "한클럽 맞바람 입니다. 낮은 탄도로 공략해주세요.";
              else if (wind === "뒷바람") windStrategy = "한클럽 뒷바람 입니다. 높은 탄도로 공략해주세요.";
              else if (wind === "강한 맞바람") windStrategy = "두클럽 맞바람 입니다. 낮은 탄도로 공략해주세요.";
              else if (wind === "강한 뒷바람") windStrategy = "두클럽 뒷바람 입니다. 높은 탄도로 공략해주세요.";
              else if (wind === "훅바람") windStrategy = "훅바람에 대비하여 우측을 에임하고 훈련해 주세요.";
              else if (wind === "슬라이스 바람") windStrategy = "슬라이스 바람에 대비하여 좌측을 에임하고 훈련해 주세요.";
              else windStrategy = "바람에 맞는 탄도와 구질로 공략해 주세요.";
              if (!isPrep) {
                  const ch = parsedHoles[stageIndex];
                  const resultParts = ch?.result ? ch.result.split(' / ') : ["알수없음", ""];
                  const loc = resultParts[0];
                  const remainDist = resultParts[1] ? resultParts[1].replace('m', '') : "";
                  
                  let resultSentence = "";
                  if (loc.includes("그린")) {
                      resultSentence = `그린 ${remainDist} 미터 였습니다.`;
                  } else if (loc.includes("벙커")) {
                      resultSentence = "벙커 였습니다.";
                  } else if (loc.includes("어프로치")) {
                      resultSentence = "온 그린 미스였습니다.";
                  } else if (loc.includes("페어웨이")) {
                      if (parString !== "5") {
                          resultSentence = "그린 근처까지 가지 못했습니다.";
                      } else {
                          resultSentence = "페어웨이 였습니다.";
                      }
                  } else if (loc.includes("러프")) {
                      resultSentence = "러프 였습니다.";
                  } else if (loc.includes("숲")) {
                      resultSentence = "숲속이었습니다.";
                  } else if (loc.includes("페널티") || loc.includes("패널티") || loc.includes("해저드") || loc.includes("벌타")) {
                      resultSentence = "패널티 구역이었습니다.";
                  } else if (loc.includes("오비") || loc === "OB" || loc === "PA") {
                      resultSentence = "오비 였습니다.";
                  } else {
                      resultSentence = `${loc} 였습니다.`;
                  }
                  
                  // 목표 거리 조건 분리됨

                  const distNum = parseInt(distStr, 10) || 0;
                  let resultText = "";
                  if (loc.includes("그린")) {
                      resultText = remainDist ? `${convertDistToKorean(remainDist.trim())} 미터` : "온그린";
                  } else if (loc.includes("벙커")) {
                      resultText = "벙커";
                  } else if (loc.includes("오비") || loc === "OB" || loc === "PA") {
                      resultText = "오비";
                  } else if (loc.includes("페널티") || loc.includes("패널티") || loc.includes("해저드") || loc.includes("벌타")) {
                      resultText = "페널티";
                  } else if (distNum >= 300 && remainDist) {
                      resultText = `${convertDistToKorean(remainDist.trim())} 미터`;
                  } else {
                      resultText = "온그린미스";
                  }
                  spoken = `${holeText}번홀 파 ${parReading} ${distToRead}미터\n${holeText}번홀 파 ${parReading} ${distToRead}미터 결과  ${resultText}`;
                  visual = `${holeText}번홀 파${parString} ${distStr}m 결과: ${resultText}`;
              } else {
                  const ch = parsedHoles[stageIndex];
                  const resText = ch?.result || "";
                  const putts = ch?.putts || 0;
                  
                  const isPenalty = resText.includes("오비") || resText.includes("패널티") || resText.includes("페널티") || resText.includes("벌타") || resText === "OB" || resText === "PA" || resText.includes("해저드");
                  const isBunker = resText.includes("벙커");
                  
                  const shotNum = ch?.shotNumber || 0;
                  const distNum = parseInt(distStr, 10) || 0;

                  if (parString === "5" && distNum <= 230) {
                      if (shotNum === 2 || shotNum === 0) {
                          spoken = `${holeText}번홀 시도거리는 ${distToRead} 미터, 투온 공략 훈련을 해주세요.`;
                          visual = `${holeText}번홀 - ${distStr}m - 투 온 찬스`;
                      } else {
                          if (distNum >= 31 && distNum <= 50) {
                              spoken = `${holeText}번홀 시도거리는 ${distToRead}미터${isOver ? ' 이상' : ''}, 원퍼트 확률이 높은 위치로 공략해 주세요.`;
                          } else if (distNum >= 51 && distNum <= 89) {
                              spoken = `${holeText}번홀 시도거리는 ${distToRead}미터${isOver ? ' 이상' : ''}, 퍼팅하기 좋은 위치로 핀에 붙여 주세요.`;
                              visual = `${holeText}번홀 - ${distStr}m`;
                          } else {
                              const showPin = Math.random() > 0.5;
                              if (showPin) {
                                  let pinStrategy = "거리 컨트롤에 집중하여 공략해 주세요.";
                                  if (pin === "좌핀" || pin === "우핀") pinStrategy = "핀위치에 맞는 구질로 공략해 주세요.";
                                  else if (pin === "앞핀" || pin === "백핀") pinStrategy = "핀위치에 맞는 탄도로 공략해 주세요.";
                                  
                                  spoken = `${holeText}번홀 시도거리는 ${distToRead}미터${isOver ? ' 이상' : ''}, ${pin}, ${pinStrategy}`;
                                  visual = `${holeText}번홀 - ${distStr}m - ${pin}`;
                              } else {
                                  spoken = `${holeText}번홀 시도거리는 ${distToRead}미터${isOver ? ' 이상' : ''}, ${windStrategy}`;
                                  visual = `${holeText}번홀 - ${distStr}m - ${wind}`;
                              }
                          }
                      }
                  } else if (distNum >= 231 && distNum <= 260) {
                      spoken = `${holeText}번홀 시도거리 ${distToRead}미터, 다음 샷을 하기 좋은 위치로 공략해 주세요.`;
                      visual = `${holeText}번홀 - ${distStr}m - 세컨샷 공략`;
                  } else if (distNum >= 261) {
                      spoken = `${holeText}번홀 시도거리 ${distToRead}미터, 자신 있는 거리가 남도록 거리 계산하여 샷을 해주세요.`;
                      visual = `${holeText}번홀 - ${distStr}m - 거리 계산 샷`;
                  } else if (isPenalty) {
                      spoken = `${holeText}번홀 시도거리는 ${distToRead}미터${isOver ? ' 이상' : ''}, 그린 주변 페널티 구역을 피해 안전하게 공략해주세요.`;
                      visual = `${holeText}번홀 - ${distStr}m - 페널티 주의`;
                  } else if (isBunker) {
                      spoken = `${holeText}번홀 시도거리 ${distToRead}미터${isOver ? ' 이상' : ''}, 벙커를 피해 그린 중앙을 공략해 주세요.`;
                      visual = `${holeText}번홀 - ${distStr}m - 벙커 주의`;
                  } else if (putts >= 3) {
                      spoken = `${holeText}번홀 시도거리는 ${distToRead}미터${isOver ? ' 이상' : ''}, 퍼팅하기 어려운 경사는 피해서 공략해 주세요.`;
                      visual = `${holeText}번홀 - ${distStr}m - 어려운 경사 주의`;
                  } else {
                      const distNum = parseInt(distStr, 10);
                      if (distNum >= 31 && distNum <= 50) {
                          spoken = `${holeText}번홀 시도거리는 ${distToRead}미터${isOver ? ' 이상' : ''}, 원퍼트 확률이 높은 위치로 공략해 주세요.`;
                      } else if (distNum >= 51 && distNum <= 89) {
                          spoken = `${holeText}번홀 시도거리는 ${distToRead}미터${isOver ? ' 이상' : ''}, 퍼팅하기 좋은 위치로 핀에 붙여 주세요.`;
                          visual = `${holeText}번홀 - ${distStr}m`;
                      } else {
                          const showPin = Math.random() > 0.5;
                          if (showPin) {
                              let pinStrategy = "거리 컨트롤에 집중하여 공략해 주세요.";
                              if (pin === "좌핀" || pin === "우핀") pinStrategy = "핀위치에 맞는 구질로 공략해 주세요.";
                              else if (pin === "앞핀" || pin === "백핀") pinStrategy = "핀위치에 맞는 탄도로 공략해 주세요.";
                              
                              spoken = `${holeText}번홀 시도거리는 ${distToRead}미터${isOver ? ' 이상' : ''}, ${pin}, ${pinStrategy}`;
                              visual = `${holeText}번홀 - ${distStr}m - ${pin}`;
                          } else {
                              spoken = `${holeText}번홀 시도거리는 ${distToRead}미터${isOver ? ' 이상' : ''}, ${windStrategy}`;
                              visual = `${holeText}번홀 - ${distStr}m - ${wind}`;
                          }
                      }
                  }
              }
              return { spoken: prefixSpoken + spoken, visual };
          }
          
          if (targetStr.includes("어프로치") || targetStr.includes("그린주변샷") || targetStr.includes("숏게임")) {
              const posArr = ["평지", "러프", "타이트한 라이", "왼발 오르막 라이", "왼발 내리막 라이", "공이 발보다 높은 라이", "공이 발보다 낮은 라이"];
              const pos = posArr[Math.floor(Math.random() * posArr.length)];
              const dists = ["10", "20", "30"];
              const distStr = actualDist || dists[Math.floor(Math.random() * dists.length)];
              const finalPos = pos;
              
              if (!isPrep) {
                  const ch = parsedHoles[stageIndex];
                  const resultParts = ch?.result ? ch.result.split(' / ') : ["알수없음", ""];
                  const loc = resultParts[0];
                  const remainDist = resultParts[1] ? resultParts[1].replace('m', '').trim() : "";
                  
                  let numericDist = parseInt(distStr, 10) || 0;
                  let subGoal = "";
                  if (numericDist >= 25) subGoal = "2 미터 이내를 목표로 훈련을 진행해 주세요.";
                  else if (numericDist >= 11) subGoal = "2 미터 이내를 목표로 훈련을 진행해 주세요.";
                  else subGoal = "1 미터 이내를 목표로 훈련을 진행해 주세요.";
                  
                  let attemptLoc = "어프로치";
                  if (ch && ch.attempt) {
                      const attemptParts = String(ch.attempt).split('/');
                      if (attemptParts.length > 1) {
                          attemptLoc = attemptParts[0].trim();
                      } else {
                          if (String(ch.attempt).includes("벙커")) attemptLoc = "벙커";
                      }
                  }
                  
                  visual = `${holeText}번홀 - ${attemptLoc} ${distStr}m`;
                  
                  let resultSentence = "";
                  if (!loc.includes("그린")) {
                      resultSentence = "온그린미스";
                  } else if (loc.includes("그린")) {
                      resultSentence = `${remainDist ? remainDist + '미터 ' : '0미터 '}였습니다. ${subGoal}`;
                  } else {
                      resultSentence = `${loc}, ${remainDist ? remainDist + '미터 ' : ''}였습니다. ${subGoal}`;
                  }
                   spoken = `${holeText}번홀 파 ${parReading} ${attemptLoc} ${distStr}미터\n${holeText}번홀 파 ${parReading} ${attemptLoc} ${distStr}미터 결과  ${loc.includes("그린") ? (remainDist ? convertDistToKorean(remainDist) + " 미터" : "0미터") : "온그린미스"}`;
                   visual = `${holeText}번홀 파${parString} ${attemptLoc} ${distStr}m 결과: ${loc.includes("그린") ? (remainDist ? remainDist + "m" : "0m") : "온그린미스"}`;
              } else {
                  visual = `${holeText}번홀 - ${distStr}m - ${finalPos}`;
                  spoken = `${holeText}번홀, 시도거리 ${convertDistToKorean(distStr)} 미터, ${finalPos} 에서 훈련을 진행해 주세요.`;
              }
              return { spoken: prefixSpoken + spoken, visual };
          }
          
          if (targetStr.includes("벙커")) {
              const posArr = ["평평한 라이", "박힌 라이", "발자국 라이", "업힐 라이", "다운힐 라이", "사이드 업힐 라이", "사이드 다운힐 라이"];
              const pos = posArr[Math.floor(Math.random() * posArr.length)];
              const dists = ["10", "20", "30"];
              const distStr = actualDist || dists[Math.floor(Math.random() * dists.length)];
              const finalPos = pos;
              
              if (!isPrep) {
                  const ch = parsedHoles[stageIndex];
                  const resultParts = ch?.result ? ch.result.split(' / ') : ["알수없음", ""];
                  const loc = resultParts[0];
                  const remainDist = resultParts[1] ? resultParts[1].replace('m', '').trim() : "";
                  
                  let numericDist = parseInt(distStr, 10) || 0;
                  let subGoal = "";
                  if (numericDist >= 25) subGoal = "3 미터 이내를 목표로 훈련을 진행해 주세요.";
                  else subGoal = "2 미터 이내를 목표로 훈련을 진행해 주세요.";
                  
                  visual = `${holeText}번홀 - 벙커 ${distStr}m`;
                  
                  let resultSentence = "";
                  if (!loc.includes("그린")) {
                      resultSentence = "온그린미스";
                  } else if (loc.includes("그린")) {
                      resultSentence = `${remainDist ? remainDist + '미터 ' : '0미터 '}였습니다. ${subGoal}`;
                  } else {
                      resultSentence = `${loc}, ${remainDist ? remainDist + '미터 ' : ''}였습니다. ${subGoal}`;
                  }
                  spoken = `${holeText}번홀 ${distStr} 미터 샷 결과는 ${resultSentence}`;
              } else {
                  visual = `${holeText}번홀 - ${distStr}m - ${finalPos}`;
                  spoken = `${holeText}번홀, 시도거리 ${convertDistToKorean(distStr)} 미터, ${finalPos} 에서 훈련을 진행해 주세요.`;
              }
              return { spoken: prefixSpoken + spoken, visual };
          }
          
          if (targetStr.includes("퍼팅") || targetStr.includes("putt") || ["9M이상", "4-8M", "2-3M", "1M"].includes(targetStr.toUpperCase())) {
              const slopeArr = ["스트레이트", "오르막", "내리막", "슬라이스", "훅", "오르막 슬라이스", "오르막 훅", "내리막 슬라이스", "내리막 훅"];
              const slope = slopeArr[Math.floor(Math.random() * slopeArr.length)];
              let distStr = actualDist || targetStr.replace(/이상/g, '').replace(/m/gi, '').replace(/퍼팅/g, '').trim();
              
              let holePrefix = "";
              if (!isPrep && targetStr.toUpperCase() === "9M이상") {
                  holePrefix = `${holeText}번홀 `;
              }
              
              if (!isPrep) {
                  const ch = parsedHoles[stageIndex];
                  const resText = ch?.result || "";
                  // result는 "그린 / 3m" 형식이므로 ' / '로 분리 후 거리 추출
                  const resultParts = resText.split(' / ');
                  let numericRemain = 0;
                  if (resultParts.length >= 2) {
                      const distPart = resultParts[1].replace('m', '').trim();
                      numericRemain = parseInt(distPart, 10) || 0;
                  } else {
                      // 단순 숫자만 있는 경우 (예: "3m" 또는 "3")
                      const distMatch = resText.match(/(\d+)/);
                      if (distMatch) numericRemain = parseInt(distMatch[1], 10) || 0;
                  }
                  
                  visual = `${holeText}번홀 - ${distStr}m`;
                  const distToRead = convertDistToKorean(distStr);
                  
                  if (numericRemain <= 1) {
                      // 결과가 1미터인 경우: 홀 정보만 두 번 반복
                      spoken = `${holeText}번홀 파 ${parReading} ${distToRead} 미터\n${holeText}번홀 파 ${parReading} ${distToRead} 미터`;
                      visual = `${holeText}번홀 파${parString} ${distStr}m`;
                  } else {
                      // 결과가 1미터 이상인 경우: 두 번째에 결과 포함
                      const remainToRead = convertDistToKorean(String(numericRemain));
                      spoken = `${holeText}번홀 파 ${parReading} ${distToRead} 미터\n${holeText}번홀 파 ${parReading} ${distToRead} 미터 결과  ${remainToRead} 미터`;
                      visual = `${holeText}번홀 파${parString} ${distStr}m 결과: ${numericRemain}m`;
                  }
              } else {
                  visual = `${distStr}m - ${slope} 경사`;
                  
                  if (targetStr === "퍼팅") {
                      const ch = parsedHoles[stageIndex];
                      const actualParStr = ch?.par || "4";
                      const actualPar = parseInt(actualParStr, 10);
                      const shotNum = ch?.shotNumber || 1;
                      const strokesBefore = shotNum - 1;
                      const currentPuttStrokes = strokesBefore + 1;
                      
                      let puttType = "";
                      if (currentPuttStrokes <= actualPar - 2) puttType = "이글";
                      else if (currentPuttStrokes === actualPar - 1) puttType = "버디";
                      else if (currentPuttStrokes === actualPar) puttType = "파";
                      
                      const distToRead = convertDistToKorean(distStr);
                      const totalHoles = parsedHoles.length;
                      
                      let isSameHole = false;
                      if (stageIndex > 0) {
                          const prevCh = parsedHoles[stageIndex - 1];
                          const prevHoleText = prevCh?.holeText || prevCh?.hole || String(stageIndex);
                          if (prevHoleText === holeText) isSameHole = true;
                      }
                      
                      let puttSuffix = "";
                      if (puttType === "이글" || puttType === "버디" || puttType === "파") {
                          puttSuffix = `, ${puttType} 퍼트`;
                      }
                      
                      let currentSpoken = "";
                      if (isSameHole) {
                          currentSpoken = `시도위치는 ${distToRead} 미터, ${slope} 경사${puttSuffix} 입니다.`;
                      } else {
                          currentSpoken = `${holeText}번홀 ${distToRead} 미터 ${slope} 경사${puttSuffix} 입니다.`;
                      }
                      
                      if (stageIndex === 0) {
                          spoken = `퍼팅 예습 훈련입니다. 총 횟수는 ${totalHoles}회 입니다. ${currentSpoken}`;
                      } else {
                          spoken = currentSpoken;
                      }
                  } else {
                      spoken = `${holePrefix}시도 위치는 ${convertDistToKorean(distStr)} 미터, ${slope} 경사입니다`;
                  }
              }
              return { spoken: prefixSpoken + spoken, visual };
          }
          
          return { spoken: "훈련을 진행해주세요.", visual: "훈련 진행 중" };
      }
      return { spoken: "훈련을 진행해주세요.", visual: "훈련 진행 중" };
  };


  const saveLessonReviewProgress = async (finalCount?: number, skipNavigation = false) => {
      if (!recordId) {
            if (!skipNavigation) navigateBack();
            return;
        }
      const currentProgress = finalCount ?? stateRef.current.progress;
      const count = currentProgress - ((stateRef.current as any).lastSavedProgress || 0);
      const elapsed = stateRef.current.sessionElapsedTime - stateRef.current.lastSavedElapsedTime;
      if (count === 0 && elapsed === 0) {
            if (!skipNavigation) navigateBack();
            return;
        }
      
      try {
          const supabase = createClient();
          const { data: recordData } = await supabase.from("records").select("completion_logs").eq("id", recordId).single();
          if (recordData) {
              const currentLogs = Array.isArray(recordData.completion_logs) ? recordData.completion_logs : [];
              currentLogs.push({
                  type: 'lesson_review_session',
                  method: 'voice',
                  count: count,
                  elapsedSeconds: elapsed,
                  timestamp: new Date().toISOString()
              });
              await supabase.from("records").update({ completion_logs: currentLogs }).eq("id", recordId);
              (stateRef.current as any).lastSavedProgress = currentProgress;
              stateRef.current.lastSavedElapsedTime = stateRef.current.sessionElapsedTime;
          }
      } catch (e) {
          console.error("Failed to save lesson review progress", e);
        }
        if (!skipNavigation) navigateBack();
    };

  const handleShotSuccess = () => {
     const { progress: currentProgress, stageIndex: currentIndex, trainingType: tType, isPrep, currentConfig: config, currentStage: stage } = stateRef.current;
     const supabase = createClient();
     
     if (tType === 'lesson_review') {
         if (!stateRef.current.isStarted && handleStartLessonReviewRef.current) {
             handleStartLessonReviewRef.current();
             return;
         }

         if (stateRef.current.lessonReviewGoalType === 'count') {
             const newProgress = currentProgress + 1;
             setProgress(newProgress);
             stateRef.current.progress = newProgress;
             const remain = stateRef.current.lessonReviewGoal - newProgress;
             if (remain === 0) {
                 speakAndWait("목표 횟수를 달성했습니다. 수고하셨습니다.");
             } else {
                 playDingSound();
             }
         } else {
             playDingSound();
         }
         return;
     }
     
     if (tType === 'review_hole' || tType === 'review_category') {
         const isCategory = tType === 'review_category';
         const currentHoleTarget = isPrep ? 1 : (isCategory ? getTargetForCategory(reviewCat || "") : 10);
         const newProgress = currentProgress + 1;
         
         const holeCompleted = newProgress >= currentHoleTarget;
         
         if (holeCompleted) {
             if (recordId) {
                 (async () => {
                     try {
                         const { data: recordData, error } = await supabase.from("records").select("template_settings").eq("id", recordId).single();
                         if (!error && recordData) {
                            const holeToMark = isCategory ? parsedHoles[currentIndex]?.hole : reviewHole;
                            if (holeToMark) {
                                const uniqueKey = isCategory && parsedHoles[currentIndex]?.uniqueId ? parsedHoles[currentIndex].uniqueId : `${reviewCat}_${holeToMark}`;
                                const currentSettings = recordData.template_settings || [];
                                let shouldUpdate = false;
                                const updatedSettings = currentSettings.map((s: any) => {
                                    if (s.type === "review_scorecard" || s.type === "prep_scorecard") {
                                        const currentCompleted = s.completedHoles || [];
                                        let updatedCompleted = [...currentCompleted];
                                        shouldUpdate = true;
                                        updatedCompleted.push(uniqueKey);

                                        const currentTimes = s.categoryTimes || {};
                                        const newlyElapsed = stateRef.current.sessionElapsedTime - stateRef.current.lastSavedElapsedTime;
                                        if (newlyElapsed > 0) {
                                            shouldUpdate = true;
                                            currentTimes[reviewCat || ""] = (currentTimes[reviewCat || ""] || 0) + newlyElapsed;
                                            stateRef.current.lastSavedElapsedTime = stateRef.current.sessionElapsedTime;
                                        }

                                        return { ...s, completedHoles: updatedCompleted, categoryTimes: currentTimes };
                                    }
                                    return s;
                                });
                                if (shouldUpdate) {
                                    await supabase.from("records").update({ template_settings: updatedSettings }).eq("id", recordId);
                                }
                            }
                         }
                     } catch (e) {
                         console.error("Failed to update completed status", e);
                     }
                 })();
             }
             
             const isAllFinished = isCategory ? currentIndex + 1 >= parsedHoles.length : true;
             
             if (isAllFinished) {
                 setProgress(newProgress);
                 
                 if (typeof sessionStorage !== 'undefined') {
                     try {
                         const chainStr = sessionStorage.getItem('trainingChain') || sessionStorage.getItem('prepChain');
                         if (chainStr) {
                             const chain = JSON.parse(chainStr);
                             const currentIndexInChain = chain.findIndex((c: any) => c.catName === reviewCat);
                             
                             if (currentIndexInChain !== -1 && currentIndexInChain + 1 < chain.length) {
                                 const nextCat = chain[currentIndexInChain + 1];
                                 const currentPath = window.location.pathname;
                                 const nextUrl = `${currentPath}?type=review_category&cat=${encodeURIComponent(nextCat.catName)}&holes=${nextCat.encodedHoles}&recordId=${recordId}&isPrep=${isPrep}`;
                                 
                                 const normalizedCat = reviewCat?.toLowerCase() || "";
                                 const nextNormalized = nextCat.catName.toLowerCase();

                                 const getCategoryGroup = (cat: string) => {
                                     if (cat.includes("티샷")) return "tee";
                                     if (["180m이상", "150-179m", "120-149m", "90-119m", "피치샷", "아이언"].some(g => cat.includes(g))) return "second";
                                     if (cat.includes("벙커") || cat.includes("어프로치") || cat.includes("그린주변") || cat.includes("숏게임")) return "short";
                                     if (cat.includes("퍼팅") || cat.includes("putt") || ["9m", "4-8m", "2-3m", "1m"].some(g => cat.includes(g))) return "putt";
                                     return "unknown";
                                 };

                                 const currentGroup = getCategoryGroup(normalizedCat);
                                 const nextGroup = getCategoryGroup(nextNormalized);

                                 if (currentGroup === nextGroup && currentGroup !== "unknown") {
                                     router.replace(nextUrl);
                                     return;
                                 }
                                 
                                 const groupNames: Record<string, string> = {
                                     "putt": "퍼팅",
                                     "short": "그린 주변 샷",
                                     "second": "아이언 앤 피치샷",
                                     "tee": "티샷"
                                 };
                                 
                                 let completionPhrase = `다음 훈련을 진행해 주세요.`;
                                 if (groupNames[currentGroup]) {
                                     completionPhrase = `${groupNames[currentGroup]} 훈련을 완료하였습니다.`;
                                 }

                                 speakAndWait(completionPhrase, () => {
                                     router.replace(nextUrl);
                                 });
                                 return;
                             }
                         }
                     } catch (e) {
                         console.error("Failed to parse trainingChain", e);
                     }
                 }
                 
                 const getGroupName = (cat: string) => {
                     if (cat.includes("티샷")) return "티샷";
                     if (["180m이상", "150-179m", "120-149m", "90-119m", "피치샷", "세컨샷", "아이언"].some(g => cat.includes(g))) return "아이언 앤 피치샷";
                     if (cat.includes("벙커") || cat.includes("어프로치") || cat.includes("그린주변") || cat.includes("숏게임")) return "숏게임";
                     if (cat.includes("퍼팅") || cat.includes("putt") || ["9m", "4-8m", "2-3m", "1m"].some(g => cat.includes(g))) return "퍼팅";
                     return "";
                 };
                 
                 let finalCompletionPhrase = `모든 ${isPrep ? '예습' : '복습'} 훈련을 마쳤습니다.`;
                 if (reviewCat) {
                     const cat = reviewCat.toLowerCase();
                     const groupName = getGroupName(cat);
                     if (groupName) {
                         finalCompletionPhrase = `${groupName} ${isPrep ? '예습' : '복습'} 훈련을 마쳤습니다.`;
                     }
                 }
                 
                 setVoiceState(prev => ({ ...prev, transcript: '', statusText: '훈련 완료 저장 중...' }));
                 setIsActive(false);
                 setIsStarted(false);
                 silentAudioRef.current?.pause();
                 speakAndWait(finalCompletionPhrase, () => {
                     navigateBack();
                 });
             } else {
                 setStageIndex(currentIndex + 1);
                 setCurrentTimeSeconds(180);
                 lastPlayedTimeRef.current = 180;
                 setProgress(0);
                 stateRef.current.stageIndex = currentIndex + 1;
                 stateRef.current.progress = 0;
                 const nextHole = parsedHoles[currentIndex + 1];
                 if (nextHole) {
                     const { spoken, visual } = generatePrompt(currentIndex + 1);
                     speakAndWait(spoken, visual, () => {
                         setVoiceState(prev => ({ ...prev, transcript: '', statusText: '샷 결과 대기 중 ("성공" 등)' }));
                     });
                 }
             }
         } else {
             setProgress(newProgress);
             const remain = currentHoleTarget - newProgress;
             speakAndWait(`${remain}개 남았습니다.`, currentPrompt);
             setVoiceState(prev => ({ ...prev, transcript: '', statusText: '샷 결과 대기 중 ("성공" 등)' }));
         }
         return;
     }

     if (!config || !stage) return;
     
     const newProgress = currentProgress + 1;
     setProgress(newProgress);
     setVoiceState(prev => ({ ...prev, transcript: '', statusText: '샷 결과 대기 중 ("성공" 등)' }));
     
     if (newProgress >= stage.target) {
         if (currentIndex + 1 < config.stages.length) {
             // 다음 스테이지로 이동
             const nextIndex = currentIndex + 1;
             setStageIndex(nextIndex);
             setProgress(0);
             if (stage.nextStagePrompt) {
                 speakAndWait(stage.nextStagePrompt);
             }
         } else {
             // 전체 완료
             setIsActive(false);
             setIsStarted(false);
             silentAudioRef.current?.pause();
             speakAndWait(config.completionText);
         }
     } else {
         const remain = stage.target - newProgress;
         const prefix = config.successPrefix || '';
         const suffix = config.successSuffix || '개 남았습니다.';
         const prompt = `${prefix}${remain}${suffix}`;
         speakAndWait(prompt, currentPrompt);
     }
  };

  const selectTraining = (type: TrainingType) => {
     setTrainingType(type);
     setHasSelected(true);
     setIsStarted(false);
     setIsActive(false);
     setIsPaused(false);
     setProgress(0);
     setStageIndex(0);
     setVoiceState({ isListening: false, transcript: '', statusText: '대기 중...' });
  };

  const handleStartTraining = () => {
     if (!trainingType) return;
     const config = (trainingType && trainingType !== 'review_hole' && trainingType !== 'review_category') ? TRAINING_CONFIGS[trainingType as TrainingType] : null;
     if (!config) return;
     
     setIsStarted(true);
     setIsActive(true);
     setIsPaused(false);
     setProgress(0);
     setStageIndex(0);
     setVoiceState({ isListening: false, transcript: '', statusText: '샷 결과 대기 중 ("성공" 등)' });
     
     requestMotionPermission();
     silentAudioRef.current?.play().catch(e => console.warn("Audio play failed:", e));
     if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
     }

      if (trainingType === 'review_hole' || trainingType === 'review_category') {
          const { spoken, visual } = generatePrompt(0);
          speakAndWait(spoken, visual, () => {
              setIsActive(true);
          });
      }
     
     speakAndWait(config.stages[0].introPrompt);
  };

  const stopTraining = () => {
     setIsActive(false);
     setIsStarted(false);
     setIsPaused(false);
     setIsLocked(false);
     window.removeEventListener('devicemotion', stableDeviceMotionListener, true);
     silentAudioRef.current?.pause();
     
     if (trainingType === 'lesson_review') {
         speakAndWait("스윙키 훈련을 종료합니다.", () => {
             saveLessonReviewProgress();
         });
         return;
     }
     
     if (progress > 0) {
         const percentage = Math.round((progress / target) * 100);
         speakAndWait(`훈련을 종료합니다. 현재 스테이지 달성률은 ${percentage}퍼센트 입니다.`, () => {
             navigateBack();
         });
     } else {
         window.speechSynthesis.cancel();
         navigateBack();
     }
  };

  const handleUnlockStart = (e: React.TouchEvent | React.MouseEvent) => {
     e.preventDefault();
     setIsHoldingUnlock(true);
     
     if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
     
     unlockTimerRef.current = setTimeout(() => {
       setIsLocked(false);
       setIsHoldingUnlock(false);
       playDingSound();
     }, 3000);
  };

  const handleUnlockEnd = () => {
     setIsHoldingUnlock(false);
     if (unlockTimerRef.current) {
       clearTimeout(unlockTimerRef.current);
       unlockTimerRef.current = null;
     }
  };

  const handleScreenDoubleTap = (e: React.TouchEvent | React.MouseEvent) => {
     if (!isActive || !isLocked) return;
     if (Date.now() - sensorStateRef.current.lockTime < 10000) return;
     
     const target = e.target as HTMLElement;
     if (target.closest('button') || target.closest('a')) return;

     const now = Date.now();
     const DOUBLE_TAP_DELAY = 300;
     if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
       playDingSound();
       handleShotSuccess();
       lastTapRef.current = 0;
     } else {
       lastTapRef.current = now;
     }
  };

  const maxStage = (trainingType === 'review_category') ? parsedHoles.length - 1 : (TRAINING_CONFIGS[trainingType as TrainingType]?.stages?.length ? TRAINING_CONFIGS[trainingType as TrainingType].stages.length - 1 : 0);

  const handlePrevStage = (e?: React.MouseEvent | React.TouchEvent) => {
      if (e) { e.stopPropagation(); }
      if (stageIndex > 0) {
          const newStage = stageIndex - 1;
          setStageIndex(newStage);
          setProgress(0);
          playDingSound();
          
          setTimeout(() => {
              if (trainingType === 'review_hole' || trainingType === 'review_category') {
                  const { spoken, visual } = generatePrompt(newStage);
                  speakAndWait(spoken, visual);
              } else {
                  speakAndWait(TRAINING_CONFIGS[trainingType as TrainingType]?.stages[newStage]?.introPrompt || "");
              }
          }, 300);
      }
  };

  const handleNextStage = (e?: React.MouseEvent | React.TouchEvent) => {
      if (e) { e.stopPropagation(); }
      if (stageIndex < maxStage) {
          const newStage = stageIndex + 1;
          setStageIndex(newStage);
          setProgress(0);
          setCurrentTimeSeconds(180);
          lastPlayedTimeRef.current = 180;
          playDingSound();
          
          setTimeout(() => {
              if (trainingType === 'review_hole' || trainingType === 'review_category') {
                  const { spoken, visual } = generatePrompt(newStage);
                  speakAndWait(spoken, visual);
              } else {
                  speakAndWait(TRAINING_CONFIGS[trainingType as TrainingType]?.stages[newStage]?.introPrompt || "");
              }
          }, 300);
      }
  };

  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
      touchStartX.current = e.changedTouches[0].screenX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
      touchEndX.current = e.changedTouches[0].screenX;
      handleSwipe();
  };

  const handleSwipe = () => {
      if (!isActive || isLocked) return;
      const swipeDistance = touchStartX.current - touchEndX.current;
      const SWIPE_THRESHOLD = 50;

      if (swipeDistance > SWIPE_THRESHOLD) {
          handleNextStage();
      } else if (swipeDistance < -SWIPE_THRESHOLD) {
          handlePrevStage();
      }
  };

  const currentConfig = (trainingType && trainingType !== 'review_hole' && trainingType !== 'review_category') ? TRAINING_CONFIGS[trainingType as TrainingType] : null;
  const currentStage = currentConfig && currentConfig.stages ? currentConfig.stages[stageIndex] : null;
  const targetForReview = isPrep ? 1 : getTargetForCategory(reviewCat || "");
  const target = (trainingType === 'review_category' || trainingType === 'review_hole') ? targetForReview : (currentStage ? currentStage.target : 10);

  
  let displayTotalRemaining = 0;
  let displayTotalProgress = 0;
  let displayTotalTarget = 0;

  if (isPrep && trainingType === 'review_category') {
      displayTotalTarget = parsedHoles.length;
      displayTotalProgress = stageIndex;
      displayTotalRemaining = Math.max(0, displayTotalTarget - displayTotalProgress);
  } else if (!isPrep && trainingType === 'review_category') {
      displayTotalTarget = parsedHoles.length * target;
      displayTotalProgress = (stageIndex * target) + progress;
      displayTotalRemaining = Math.max(0, displayTotalTarget - displayTotalProgress);
  } else if (trainingType === 'lesson_review') {
      if (lessonReviewGoalType === 'time') {
          displayTotalTarget = lessonReviewGoal * 60;
          displayTotalProgress = sessionElapsedTime;
          displayTotalRemaining = Math.max(0, displayTotalTarget - displayTotalProgress);
      } else {
          displayTotalTarget = lessonReviewGoal;
          displayTotalProgress = progress;
          displayTotalRemaining = Math.max(0, displayTotalTarget - displayTotalProgress);
      }
  } else {
      displayTotalTarget = target;
      displayTotalProgress = progress;
      displayTotalRemaining = Math.max(0, displayTotalTarget - displayTotalProgress);
  }

  if (!hasSelected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-70px)] bg-[#F8F9FC] dark:bg-zinc-950 p-6">
        <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 shadow-sm border border-zinc-200/60 dark:border-zinc-800/60 flex flex-col gap-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-brand-navy to-emerald-500"></div>
          
          <div className="flex items-center gap-2 pt-2">
            <button onClick={() => navigateBack()} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
              <ChevronLeft size={24} />
            </button>
            <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">복습 음성</h1>
          </div>
          
          <div className="space-y-4">
             <div>
                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">훈련 선택</label>
                <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-2 pb-10">
                   {Object.values(TRAINING_CONFIGS).map((config) => (
                       <button 
                          key={config.id}
                          onClick={() => selectTraining(config.id)}
                          className="group relative w-full p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl font-bold transition-all shadow-sm hover:shadow-md hover:border-brand-navy/50 active:scale-95 text-left flex items-center gap-3"
                       >
                          <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 group-hover:text-brand-navy group-hover:bg-brand-navy/10 transition-colors">
                             {config.id === 'shot' || config.id === 'tee-shot' ? <Mic size={20} /> : <CheckCircle size={20} />}
                          </div>
                          <span className="text-zinc-800 dark:text-zinc-200 text-[15px]">{config.uiName}</span>
                       </button>
                   ))}
                </div>
             </div>
          </div>
        </div>
      </div>
    );
  }

  // 훈련 대기(Ready) 화면
  if (hasSelected && !isStarted && trainingType !== 'review_hole' && trainingType !== 'review_category' && trainingType !== 'lesson_review') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-70px)] bg-[#F8F9FC] dark:bg-zinc-950 p-6">
        <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 shadow-sm border border-zinc-200/60 dark:border-zinc-800/60 flex flex-col gap-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-brand-navy to-emerald-500"></div>
          
          <div className="flex items-center gap-2 pt-2">
            <button onClick={() => setHasSelected(false)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
              <ChevronLeft size={24} />
            </button>
            <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">훈련 준비</h1>
          </div>
          
          <div className="space-y-6 my-4">
             <div className="bg-zinc-50 dark:bg-zinc-800/50 p-5 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                <span className="text-xs font-bold text-brand-navy dark:text-brand-navy-light uppercase tracking-wider">선택된 훈련</span>
                <h3 className="text-xl font-extrabold text-zinc-950 dark:text-zinc-50 mt-1">{currentConfig?.uiName}</h3>
             </div>
             
             <div className="space-y-3">
                <h4 className="text-sm font-bold text-zinc-500 dark:text-zinc-400">훈련 목표</h4>
                <div className="space-y-2">
                   {currentConfig?.stages.map((stage: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-800/30 px-4 py-3 rounded-xl border border-zinc-100 dark:border-zinc-800/40">
                         <div className="w-6 h-6 rounded-full bg-brand-navy/10 text-brand-navy dark:bg-brand-navy/20 dark:text-white flex items-center justify-center text-xs font-extrabold">
                            {stage.stageNum}
                         </div>
                         <div className="flex-1">
                            <p className="text-xs text-zinc-400">단계 목표</p>
                            <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{stage.goalDesc} (목표: {stage.target}회)</p>
                         </div>
                      </div>
                   ))}
                </div>
             </div>
             
             <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 p-4 rounded-2xl flex gap-3">
                <div className="text-emerald-600 dark:text-emerald-400 mt-0.5 font-bold">ℹ️</div>
                <div className="text-xs text-emerald-800/90 dark:text-emerald-400/90 leading-relaxed">
                   <strong>안내:</strong> 훈련 중 폰을 가볍게 두 번 두드리거나, 화면의 빈 곳을 빠르게 더블 탭하면 샷 성공이 기록됩니다.
                </div>
             </div>
          </div>
          
          <button 
             onClick={handleStartTraining}
             className="w-full py-4 bg-brand-navy hover:bg-brand-navy-dark text-white rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
          >
             <Play className="w-5 h-5 fill-current" /> 훈련 시작하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="flex flex-col items-center justify-center min-h-[calc(100dvh-70px)] bg-zinc-50 dark:bg-zinc-950 p-6 relative select-none"
      onClick={handleScreenDoubleTap}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >

       <div className="w-full max-w-sm flex flex-col items-center text-center relative">
           
           {/* Header Section (Hole, Par, Banner) */}
           {(() => {
               let holeStr = "";
               let parStr = "";
               let envStr = "";
               
               if (trainingType === 'review_category') {
                   const ch = parsedHoles[Math.min(stageIndex, Math.max(0, parsedHoles.length - 1))];
                   holeStr = ch?.hole ? `${ch.hole}번홀` : "";
                   parStr = ch?.par ? `Par ${ch.par}` : "";
                   envStr = reviewCat || "훈련";
               } else if (trainingType === 'review_hole') {
                   holeStr = `${reviewHole}번홀`;
                   envStr = "집중 분석";
               } else if (trainingType === 'lesson_review') {
                   holeStr = "레슨 복기";
                   envStr = "훈련";
               } else {
                   holeStr = `${currentConfig?.title || ""}`;
                   envStr = `${stageIndex + 1}단계`;
               }

               if (trainingType === 'lesson_review' || trainingType === 'review_hole' || trainingType === 'review_category') return null;
               return (
                   <div className="w-full flex items-center justify-between mt-2 mb-4 px-4">
                       <div className="flex items-center gap-2">
                           <span className="text-red-600 font-black text-2xl italic tracking-tighter">»</span>
                           <h2 className="text-zinc-900 dark:text-zinc-100 font-black text-3xl italic tracking-tighter">
                               {holeStr}{parStr ? ` - ${parStr}` : ''}
                           </h2>
                       </div>
                       <div className="bg-white/80 dark:bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-zinc-200 dark:border-white/10 flex items-center gap-2 shadow-sm">
                           <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
                           <span className="text-zinc-800 dark:text-white font-mono font-bold text-sm tracking-wider">
                               {formatTime(sessionElapsedTime)}
                           </span>
                       </div>
                   </div>
               );
           })()}

                       {false && currentSpokenPrompt && (
                (() => {
                    const koreanToNumber = (kor: string) => {
                        const KOR_UNITS: Record<string, number> = { '십': 10, '백': 100, '천': 1000 };
                        const KOR_DIGITS: Record<string, number> = { '일': 1, '이': 2, '삼': 3, '사': 4, '오': 5, '육': 6, '칠': 7, '팔': 8, '구': 9 };
                        let total = 0;
                        let currentDigit = 1;
                        for (let i = 0; i < kor.length; i++) {
                            const char = kor[i];
                            if (KOR_DIGITS[char]) {
                                currentDigit = KOR_DIGITS[char];
                                if (i === kor.length - 1) total += currentDigit;
                            } else if (KOR_UNITS[char]) {
                                total += currentDigit * KOR_UNITS[char];
                                currentDigit = 1;
                            }
                        }
                        return total.toString();
                    };

                    let visualPrompt = currentSpokenPrompt
                        .replace(/파\s*쓰리/g, 'PAR 3')
                        .replace(/파\s*포/g, 'PAR 4')
                        .replace(/파\s*파이브/g, 'PAR 5')
                        .replace(/미터/g, 'm')
                        .replace(/,/g, '')
                        .replace(/\./g, '')
                        .replace(/([일이삼사오육칠팔구십백천]+)\s*m/g, (match, p1) => `${koreanToNumber(p1)}m`);

                    return (
                        <div className="relative w-full mb-6">
                            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] bg-red-600/30 -z-10 skew-y-[-2deg]"></div>
                            <div className="flex items-center justify-center relative w-full">
                                <div 
                                    className="bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white py-3.5 w-full font-black text-[clamp(15px,4.5vw,22px)] flex items-center justify-center overflow-hidden border-b-[3px] border-red-600"
                                    style={{ clipPath: "polygon(5% 0, 100% 0, 95% 100%, 0 100%)" }}
                                >
                                    <div className="flex w-max animate-marquee">
                                        <span className="tracking-widest whitespace-nowrap pr-8">
                                            {visualPrompt}
                                        </span>
                                        <span className="tracking-widest whitespace-nowrap pr-8">
                                            {visualPrompt}
                                        </span>
                                    </div>
                                </div>
                                <div className="absolute right-[5%] bottom-0 translate-y-[3px] flex gap-1.5">
                                    <div className="w-2 h-2 bg-zinc-400 skew-x-[-20deg]"></div>
                                    <div className="w-2 h-2 bg-zinc-300 skew-x-[-20deg]"></div>
                                    <div className="w-2 h-2 bg-zinc-200 skew-x-[-20deg]"></div>
                                </div>
                            </div>
                        </div>
                    );
                })()
            )}
           {/* Progress Section */}
           {trainingType !== 'review_hole' && trainingType !== 'review_category' && (
           <div className="w-full relative mb-12 px-2">
               <div className="absolute left-0 right-0 bottom-2 h-[2px] bg-gradient-to-r from-transparent via-zinc-200 dark:via-zinc-800 to-transparent -z-10"></div>
               
               {trainingType === 'lesson_review' && lessonReviewGoalType === 'time' ? (
                   <div className="flex flex-col items-center justify-center gap-6 w-full">
                       <div className="flex flex-col items-center gap-1">
                           <span className="text-xl font-black text-zinc-900 dark:text-zinc-100 tracking-tighter italic" style={{ transform: "skewX(-10deg)" }}>남은 시간</span>
                           <div className="flex items-baseline justify-center gap-1 sm:gap-2 italic whitespace-nowrap">
                               <span className="text-6xl sm:text-7xl font-black text-red-600 tracking-tighter leading-none" style={{ transform: "skewX(-10deg)", textShadow: "2px 2px 0px rgba(0,0,0,0.1)" }}>{Math.floor(displayTotalRemaining / 60)}</span>
                               <span className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tighter" style={{ transform: "skewX(-10deg)" }}>분</span>
                               <span className="text-6xl sm:text-7xl font-black text-red-600 tracking-tighter leading-none" style={{ transform: "skewX(-10deg)", textShadow: "2px 2px 0px rgba(0,0,0,0.1)" }}>{displayTotalRemaining % 60}</span>
                               <span className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tighter" style={{ transform: "skewX(-10deg)" }}>초</span>
                           </div>
                       </div>
                       
                       <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-2 w-full px-2 sm:px-4">
                           {/* Interval Pill */}
                           <div className="bg-white/80 dark:bg-black/60 backdrop-blur-md px-2 py-2.5 rounded-full border border-zinc-200 dark:border-white/10 flex items-center justify-center gap-1 sm:gap-2 shadow-sm w-full">
                               <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0"></div>
                               <span className="text-zinc-800 dark:text-white font-mono font-bold text-[13px] sm:text-[14px] tracking-wider not-italic shrink-0">간격</span>
                               <div className="flex items-center">
                                   <button 
                                       onClick={(e) => { e.stopPropagation(); setLessonReviewInterval(prev => Math.max(1, prev - 1)); }}
                                       className="text-zinc-500 hover:text-zinc-800 px-1 sm:px-2 font-bold text-lg leading-none shrink-0"
                                   >
                                       -
                                   </button>
                                   <span className="text-zinc-800 dark:text-white font-mono font-bold text-[13px] sm:text-[14px] tracking-wider not-italic w-[36px] sm:w-[40px] text-center shrink-0">
                                       {lessonReviewInterval}초
                                   </span>
                                   <button 
                                       onClick={(e) => { e.stopPropagation(); setLessonReviewInterval(prev => prev + 1); }}
                                       className="text-zinc-500 hover:text-zinc-800 px-1 sm:px-2 font-bold text-lg leading-none shrink-0"
                                   >
                                       +
                                   </button>
                               </div>
                           </div>

                           {/* Accumulated Time Pill */}
                           <div className="bg-white/80 dark:bg-black/60 backdrop-blur-md px-2 py-2.5 rounded-full border border-zinc-200 dark:border-white/10 flex items-center justify-center gap-1 sm:gap-2 shadow-sm w-full">
                               <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0"></div>
                               <span className="text-zinc-800 dark:text-white font-mono font-bold text-[13px] sm:text-[14px] tracking-wider not-italic truncate">
                                   누적 {Math.floor(displayTotalProgress / 60)}분{displayTotalProgress % 60 > 0 ? ` ${displayTotalProgress % 60}초` : ' 0초'}
                               </span>
                           </div>
                       </div>
                   </div>
               ) : trainingType === 'lesson_review' ? (
                   <div className="flex flex-col items-center justify-center gap-10 w-full">
                       <div className="flex items-baseline justify-center gap-1 sm:gap-2 italic whitespace-nowrap">
                           <span className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tighter mr-1 sm:mr-2" style={{ transform: "skewX(-10deg)" }}>남은 횟수</span>
                           <span className="text-6xl sm:text-7xl font-black text-red-600 tracking-tighter leading-none" style={{ transform: "skewX(-10deg)", textShadow: "2px 2px 0px rgba(0,0,0,0.1)" }}>{displayTotalRemaining}</span>
                           <span className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tighter" style={{ transform: "skewX(-10deg)" }}>회</span>
                       </div>
                       <div className="bg-white/80 dark:bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-zinc-200 dark:border-white/10 flex items-center gap-2 shadow-sm mt-1">
                           <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
                           <span className="text-zinc-800 dark:text-white font-mono font-bold text-[14px] tracking-wider not-italic">
                               누적 {displayTotalProgress}회
                           </span>
                       </div>
                   </div>
               ) : (
                   <div className="flex items-baseline justify-center gap-2 italic pr-4 sm:pr-8">
                       <span className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tighter mr-2" style={{ transform: "skewX(-10deg)" }}>남은 횟수</span>
                       <span className="text-6xl font-black text-red-600 tracking-tighter leading-none" style={{ transform: "skewX(-10deg)", textShadow: "2px 2px 0px rgba(0,0,0,0.1)" }}>{displayTotalRemaining}</span>
                       <span className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tighter" style={{ transform: "skewX(-10deg)" }}>회</span>
                       <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tighter ml-1" style={{ transform: "skewX(-10deg)" }}>
                           ({displayTotalProgress} / {displayTotalTarget})
                       </span>
                   </div>
               )}
           </div>
           )}

            {trainingType === 'lesson_review' && (
                <div className="w-full flex justify-center mt-0 mb-8 px-2 sm:px-4">
                    <div className={`w-full min-h-[140px] sm:min-h-[160px] p-4 sm:p-6 rounded-3xl flex items-center justify-center text-center transition-all shadow-sm ${isStarted && !isPaused ? 'bg-zinc-100 border-2 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700' : 'bg-zinc-50 dark:bg-zinc-900 border-2 border-transparent'}`}>
                        {currentSpokenPrompt ? (
                            <p className="text-lg sm:text-xl font-black tracking-tight text-zinc-800 dark:text-zinc-100 leading-relaxed whitespace-pre-wrap break-keep">
                                {currentSpokenPrompt}
                            </p>
                        ) : (
                            <div className="flex flex-col items-center gap-3 text-zinc-400">
                                <Mic size={32} className="opacity-50" />
                                <p className="text-sm font-bold">멘트 대기 중...</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

           
           {(trainingType === 'review_hole' || trainingType === 'review_category') && (
           (() => {
               const ch = trainingType === 'review_category' ? parsedHoles[Math.min(stageIndex, Math.max(0, parsedHoles.length - 1))] : { hole: reviewHole, attempt: reviewAttempt, result: reviewResult, score: reviewScore, note: reviewNote };
               if (!ch) return null;
               
               let holeStr = ch?.hole ? `${ch.hole}번홀` : "";
               let parStr = ch?.par ? `Par ${ch.par}` : "";
               
               const attemptStr = ch?.attempt ? String(ch.attempt) : "";
               const resultStr = ch?.result ? String(ch.result) : "";
               const attemptParts = attemptStr.split(' / ').map((s) => s.trim());
               const attemptLoc = attemptParts[0] || "-";
               const attemptDist = attemptParts[1] || "-";
               const resultParts = resultStr.split(' / ').map((s) => s.trim());
               const resultLoc = resultParts[0] || "-";
               const resultDist = resultParts[1] || "-";

               return (
                   <div className="w-full flex flex-col items-center px-4 gap-5 mb-10">

                        {/* ── 2. HOLE HEADER (홀/Par 정보) ── */}
                        {true && (
                            <div className="w-full flex mb-0 px-2 mt-2">
                                <div className="flex items-center px-6 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 shadow-sm w-fit">
                                    <h2 className="text-[30px] font-extrabold text-zinc-800 dark:text-zinc-100 tracking-tighter leading-none mt-1 flex items-center">
                                        {holeStr}
                                        {parStr && (
                                            <>
                                                <span>&nbsp;&nbsp;&nbsp;</span>
                                                <span className="relative -top-[4px]">.</span>
                                                <span>&nbsp;&nbsp;&nbsp;</span>
                                                {parStr}
                                            </>
                                        )}
                                    </h2>
                                </div>
                            </div>
                        )}

                        {/* ── 3. ATTEMPT / RESULT CARD ── */}
                        <div className="w-full mt-1">
                            <div className="bg-zinc-50/80 dark:bg-zinc-800/30 rounded-xl p-5 border border-zinc-100 dark:border-zinc-800/50 overflow-hidden text-left space-y-4">
                                <div className="flex items-center">
                                    <div className="w-1 h-5 bg-zinc-300 dark:bg-zinc-600 rounded-full mr-3 shrink-0"></div>
                                    <span className="text-[20px] font-medium text-zinc-500 w-16 shrink-0">시도</span>
                                    <span className="text-[20px] font-semibold text-zinc-700 dark:text-zinc-200 truncate flex-1 text-left">
                                        {attemptLoc} / {attemptDist}
                                    </span>
                                </div>
                                <div className="flex items-center">
                                    <div className="w-1 h-5 bg-orange-400 rounded-full mr-3 shrink-0"></div>
                                    <span className="text-[20px] font-medium text-zinc-500 w-16 shrink-0">결과</span>
                                    <span className="text-[20px] font-semibold text-zinc-700 dark:text-zinc-200 truncate flex-1 text-left">
                                        {resultLoc} / {resultDist}
                                    </span>
                                </div>
                                
                                <div className="flex items-center pt-4 border-t border-zinc-300 dark:border-zinc-600 w-fit">
                                    <div className="w-1 h-12 bg-blue-500 rounded-full mr-3 shrink-0"></div>
                                    <div className="flex flex-col text-base font-medium text-zinc-500 w-14 shrink-0 leading-tight justify-center gap-0.5">
                                        <span>남은</span>
                                        <span>시간</span>
                                    </div>
                                    <div className="flex items-center gap-5 flex-1 text-left">
                                        <span className="text-[40px] font-extrabold text-zinc-800 dark:text-zinc-100 tracking-tighter leading-none -mt-1.5">
                                            {formatTime(currentTimeSeconds)}
                                        </span>
                                        <div className="flex flex-col gap-0">
                                            <button 
                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentTimeSeconds(prev => prev + 10); }}
                                                className="w-9 h-[22px] rounded-t-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors shadow-sm text-zinc-500 dark:text-zinc-400"
                                            ><ChevronLeft style={{ transform: 'rotate(90deg)' }} size={16} /></button>
                                            <button 
                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentTimeSeconds(prev => Math.max(0, prev - 10)); }}
                                                className="w-9 h-[22px] rounded-b-md bg-white dark:bg-zinc-800 border-x border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-center hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors shadow-sm text-zinc-500 dark:text-zinc-400"
                                            ><ChevronLeft style={{ transform: 'rotate(270deg)' }} size={16} /></button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                   </div>
               );
           })()
           )}

           {/* ── 5. ACTION BUTTONS ── */}
           <div className="w-full flex justify-between items-end mb-6 px-4 sm:px-8">
               {(!isStarted && trainingType === 'lesson_review') ? (
                   <button
                       onClick={(e) => { e.stopPropagation(); handleStartLessonReview(); }}
                       className="flex flex-col items-center gap-2.5 group active:scale-95 transition-all"
                   >
                       <div className="w-14 h-14 sm:w-16 sm:h-16 bg-zinc-900 dark:bg-white rounded-2xl flex items-center justify-center shadow-md group-hover:scale-95 transition-transform">
                           <Play className="w-6 h-6 sm:w-7 sm:h-7 text-white dark:text-zinc-900 fill-current ml-1" />
                       </div>
                       <span className="text-[12px] font-bold text-zinc-500">시작</span>
                   </button>
               ) : (
                   <button
                       onClick={(e) => { e.stopPropagation(); setIsPaused(!isPaused); }}
                       className="flex flex-col items-center gap-2.5 group active:scale-95 transition-all"
                   >
                       <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shadow-md group-hover:scale-95 transition-transform ${isPaused ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900' : 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'}`}>
                           {isPaused ? <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-current ml-1" /> : <Pause className="w-6 h-6 sm:w-7 sm:h-7 fill-current" />}
                       </div>
                       <span className="text-[12px] font-bold text-zinc-600 dark:text-zinc-400">{isPaused ? '재개' : '정지'}</span>
                   </button>
               )}

               {trainingType !== 'lesson_review' ? (
                   <button 
                      onClick={(e) => { e.stopPropagation(); handleShotSuccess(); }}
                      className="flex flex-col items-center gap-2.5 group active:scale-95 transition-all"
                   >
                       <div className="w-14 h-14 sm:w-16 sm:h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-md group-hover:scale-95 transition-transform text-white">
                           <Check className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={3} />
                       </div>
                       <span className="text-[12px] font-bold text-blue-500">완료</span>
                   </button>
               ) : (
                   <div />
               )}

               <button
                   onClick={(e) => { 
                       e.stopPropagation(); 
                       if (currentSpokenPrompt) {
                           speakAndWait(currentSpokenPrompt, currentPrompt);
                       } else if (trainingType === 'lesson_review') {
                           const commentIndex = (lessonReviewCommentIndexRef.current - 1 + lessonReviewComments.length) % lessonReviewComments.length;
                           const comment = lessonReviewComments[commentIndex] || "레디";
                           speakAndWait(comment, comment);
                       }
                   }}
                   className="flex flex-col items-center gap-2.5 group active:scale-95 transition-all"
               >
                   <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white dark:bg-zinc-800 border-2 border-zinc-100 dark:border-zinc-700 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-95 transition-transform">
                       <Volume2 className="w-6 h-6 sm:w-7 sm:h-7 text-zinc-700 dark:text-zinc-300" />
                   </div>
                   <span className="text-[12px] font-bold text-zinc-600 dark:text-zinc-400">듣기</span>
               </button>

               <button 
                   onClick={(e) => { e.stopPropagation(); stopTraining(); }}
                   className="flex flex-col items-center gap-2.5 group active:scale-95 transition-all"
               >
                   <div className="w-14 h-14 sm:w-16 sm:h-16 bg-rose-50 dark:bg-rose-500/10 border-2 border-rose-100 dark:border-rose-500/20 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-95 transition-transform text-rose-500">
                       <Square className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
                   </div>
                   <span className="text-[12px] font-bold text-rose-500">종료</span>
               </button>
           </div>

           {/* Navigation Buttons */}
           {trainingType !== 'lesson_review' && (
               <div className="w-full grid grid-cols-2 gap-3 mb-4">
                   <button 
                       onClick={handlePrevStage}
                       disabled={stageIndex <= 0}
                       className={`py-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${stageIndex <= 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-50 dark:hover:bg-zinc-700 active:scale-95'}`}
                   >
                       <ChevronLeft size={20} /> 이전 훈련
                   </button>
                   <button 
                       onClick={handleNextStage}
                       disabled={stageIndex >= maxStage}
                       className={`py-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${stageIndex >= maxStage ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-50 dark:hover:bg-zinc-700 active:scale-95'}`}
                   >
                       다음 훈련 <ChevronLeft size={20} className="rotate-180" />
                   </button>
               </div>
           )}
           
       </div>

       {/* Lock Screen Overlay */}
       {isLocked && (
         <div className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center backdrop-blur-md select-none touch-none">
           <div className="flex flex-col items-center text-center px-6 max-w-sm">
             <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-6">
               <Lock className="w-10 h-10 text-red-500 animate-pulse" />
             </div>
             
             <h2 className="text-xl font-bold text-white mb-2">화면이 잠겼습니다.</h2>
             <p className="text-white/60 text-sm mb-10 leading-relaxed">
               잠금 상태에서 휴대폰을 두드리면<br />
               다음 훈련으로 이동합니다.<br />
               <br />
               단, 오작동 방지를 위해<br />
               화면 잠금 10초후<br />
               해당 기능이 활성화 됩니다.
             </p>
             
             <button
               onTouchStart={handleUnlockStart}
               onTouchEnd={handleUnlockEnd}
               onMouseDown={handleUnlockStart}
               onMouseUp={handleUnlockEnd}
               onMouseLeave={handleUnlockEnd}
               className="relative w-32 h-32 rounded-full bg-zinc-800 border border-zinc-700 flex flex-col items-center justify-center active:scale-95 transition-all overflow-hidden select-none"
             >
               {/* Progress Fill Indicator */}
               <div 
                 className="absolute inset-0 bg-red-500/20 origin-bottom scale-y-0 transition-transform duration-[3000ms] ease-linear"
                 style={{ transform: isHoldingUnlock ? 'scaleY(1)' : 'scaleY(0)' }} 
               />
               
               <div className="z-10 flex flex-col items-center gap-1 text-white">
                 <Unlock className="w-8 h-8" />
                 <span className="text-xs font-bold mt-1">길게 누르기</span>
                 <span className="text-[10px] text-white/50">3초간 대기</span>
               </div>
             </button>
           </div>
         </div>
       )}
    </div>
  );
}

// Force Turbopack Cache 1782286860574
// Rebuild Targets
// Rebuild Putts
// Rebuild shortgame
// Rebuild remaining count display
// Rebuild goals