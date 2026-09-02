"use client";

import React, { useEffect, useRef, useState, Suspense } from "react";
import { Play, Square, Mic, MicOff, CheckCircle, ChevronLeft, Lock, Unlock, Pause } from "lucide-react";
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

const TRAINING_CONFIGS: Record<TrainingType, TrainingConfig> = {
  'shot': {
    id: 'shot',
    title: '티샷 비거리',
    uiName: '티샷 비거리',
    successPrefix: '',
    successSuffix: '개 남았습니다. 더 빠르게 빈스윙 하고 같은 스피드로 쳐보세요.',
    stages: [
      {
        stageNum: 1,
        target: 7,
        introPrompt: "목표는 빈스윙과 같은 스피드로 7개 치기입니다.",
        goalDesc: "빈스윙과 같은 스피드로 7개 치기"
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

// --- Utility Functions ---
const playDingSound = () => {
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
    if (onEnd) onEnd();
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
  const parsedHoles = React.useMemo(() => {
    let holes = reviewHolesParam ? JSON.parse(reviewHolesParam) : [];
    if (!isPrep && reviewCat === '티샷 비거리' && holes.length > 1) {
        holes = holes.slice(0, 1);
    }
    // 예습 훈련 시 벙커, 어프로치는 거리/홀 순서를 랜덤으로 섞음
    if (isPrep && reviewCat && (reviewCat.includes('벙커') || reviewCat.includes('어프로치')) && holes.length > 1) {
        holes = [...holes].sort(() => Math.random() - 0.5);
    }
    return holes;
  }, [reviewHolesParam, isPrep, reviewCat]);
  
  const [hasSelected, setHasSelected] = useState(false);
  const [trainingType, setTrainingType] = useState<TrainingType | 'review_hole' | 'review_category' | ''>('');
  
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
  
  const [voiceState, setVoiceState] = useState<VoiceState>({
    isListening: false,
    transcript: '',
    statusText: '대기 중...'
  });
  
  const recognitionRef = useRef<any>(null);
  const isPlayingSpeechRef = useRef(false);
  const handleVoiceInputRef = useRef<any>(null);
  const handleShotSuccessRef = useRef<any>(null);
  const silentAudioRef = useRef<HTMLVideoElement | null>(null);
  
  // Custom refs for double-tap and double-knock
  const lastTapRef = useRef(0);
  const unlockTimerRef = useRef<NodeJS.Timeout | null>(null);
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
  // 핵심: 유튜브처럼 실제 DOM <audio> 요소에서 오디오가 재생되어야 브라우저가 MediaSession을 인식함
  useEffect(() => {
    // 1. DOM에 숨겨진 <audio> 요소 생성 (유튜브와 동일한 방식)
    const audioEl = document.createElement('audio');
    audioEl.id = 'silent-audio-loop';
    audioEl.src = '/api/silent'; // 서버에서 생성한 10초짜리 무음 WAV
    audioEl.loop = true;
    audioEl.volume = 0.01; // 완전 0이면 일부 브라우저가 무시함, 거의 들리지 않는 수준
    (audioEl as any).playsInline = true;
    audioEl.preload = 'auto';
    document.body.appendChild(audioEl);
    silentAudioRef.current = audioEl as any;

    // 2. 사용자 터치/클릭 시 오디오 재생 시작 (자동재생 정책 우회)
    const startAudio = () => {
      audioEl.play().then(() => {
        console.log('✅ Silent audio playing - MediaSession active');
        
        // 3. 오디오가 실제로 재생된 후에만 MediaSession 설정
        if ('mediaSession' in navigator) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: '훈련 진행 중',
            artist: '레벨업 골프',
            album: '스윙 분석',
          });
          navigator.mediaSession.playbackState = 'playing';
        }
      }).catch(e => {
        console.warn("Audio play failed:", e);
      });
      
      // AudioContext도 함께 초기화 (TTS용)
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext && !(window as any).globalAudioContext) {
        const ctx = new AudioContext();
        ctx.resume();
        (window as any).globalAudioContext = ctx;
      }
    };
    window.addEventListener('touchstart', startAudio, { once: true });
    window.addEventListener('click', startAudio, { once: true });

    // 4. MediaSession 핸들러 등록 (모든 이어폰 버튼 → "성공")
    if ('mediaSession' in navigator) {
      const handleMediaEvent = () => {
        console.log('🎧 Earphone button pressed!');
        
        if (stateRef.current.isWaitingForChainConfirm) {
          if (stateRef.current.nextChainUrl) {
            window.location.href = stateRef.current.nextChainUrl;
          }
        } else if (stateRef.current.isActive && !stateRef.current.isPaused && handleShotSuccessRef.current) {
          handleShotSuccessRef.current();
        }
        // 이어폰의 pause 동작으로 오디오가 멈출 수 있으므로 즉시 재생 보장
        if (audioEl.paused) {
          audioEl.play().catch(() => {});
        }
        navigator.mediaSession.playbackState = 'playing';
      };

      // 이어폰 한 번 탭 (재생/일시정지 토글)
      navigator.mediaSession.setActionHandler('play', handleMediaEvent);
      navigator.mediaSession.setActionHandler('pause', handleMediaEvent);
      // 이어폰 두 번 탭 (다음 곡), 세 번 탭 (이전 곡)
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

  const currentConfig = (trainingType && trainingType !== 'review_hole' && trainingType !== 'review_category') ? TRAINING_CONFIGS[trainingType as TrainingType] : null;
  const currentStage = currentConfig ? currentConfig.stages[stageIndex] : null;
    const getTargetForCategory = (catName: string | null) => {
    if (!catName) return 4;
    const n = catName.toUpperCase();
    if (n.includes("비거리")) return 7;
    if (n.includes("정확도")) return 3;
    if (n.includes("180")) return 4;
    if (n.includes("150") || n.includes("120") || n.includes("149") || n.includes("90") || n.includes("119")) return 4;
    if (n.includes("피치샷") || n.includes("벙커") || n.includes("어프로치")) return 4;
    if (n.includes("9M")) return 4;
    if (n.includes("4-8")) return 2;
    if (n.includes("2-3") || n.includes("2~3")) return 5;
    if (n.includes("1M")) return 6;
    return 4;
  };

  
  const getGoalTextForCategory = (catName: string | null) => {
    if (!catName) return "4회 성공";
    const n = catName.toUpperCase();
    if (n.includes("비거리")) return "빈스윙과 같은 스피드로 7회 치기";
    if (n.includes("정확도")) return "페어웨이 3회 적중";
    if (n.includes("180")) return "7m 이내 붙이기";
    if (n.includes("150") || n.includes("120") || n.includes("149")) return "5m 이내 붙이기";
    if (n.includes("90") || n.includes("119")) return "4m 이내 붙이기";
    if (n.includes("피치샷")) return "3m 이내 붙이기";
    if (n.includes("벙커")) return "3m 이내 붙이기";
    if (n.includes("어프로치")) return "2m 이내 붙이기";
    if (n.includes("9M") || n.includes("9m")) return "1m 이내 붙이기";
    if (n.includes("4-8")) return "원퍼트 2개";
    if (n.includes("2-3") || n.includes("2~3")) return "원퍼트 5개";
    if (n.includes("1M") || n.includes("1m")) return "원퍼트 6개";
    return "4회 성공";
  };

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

  const generatePrompt = (holeNum: string|number, attemptLabel: string, par: number) => {
       const cleanAttempt = attemptLabel?.replace(/\//g, '').trim() || "";
       const holeNumInt = parseInt(holeNum.toString(), 10);
       const KOREAN_NUMBERS = ["영", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구", "십", "십일", "십이", "십삼", "십사", "십오", "십육", "십칠", "십팔", "십구"];
       const holeText = (!isNaN(holeNumInt) && holeNumInt > 0 && holeNumInt <= 19) ? KOREAN_NUMBERS[holeNumInt] : holeNum;
       
       let parReading = "";
       if (par === 3) parReading = "쓰리";
       else if (par === 4) parReading = "포";
       else if (par === 5) parReading = "파이브";
       else parReading = par.toString();

       if (isPrep) {
           const hideHoleCategories = ["벙커", "어프로치", "9m", "4-8", "2-3", "1m"];
           const shouldHideHole = hideHoleCategories.some(c => reviewCat?.toLowerCase().includes(c.toLowerCase()));

           if (reviewCat === "티샷" || reviewCat === "티샷 비거리" || reviewCat === "티샷 정확도") {
               return `${holeText}번홀, 파 ${parReading}, 티샷입니다.`;
           } else if (cleanAttempt.startsWith("TE") || cleanAttempt.startsWith("티박스")) {
               const match = cleanAttempt.match(/\d+/);
               const dist = match ? numberToKorean(parseInt(match[0], 10)) : "";
               return `${holeText}번홀 파 ${parReading} 티박스, 홀까지 거리 ${dist} 미터 입니다.`;
           } else {
               const match = cleanAttempt.match(/\d+/);
               const dist = match ? numberToKorean(parseInt(match[0], 10)) : "";
               
               if (shouldHideHole) {
                   return dist ? `시도 거리는 ${dist} 미터 입니다.` : `${reviewCat} 훈련입니다.`;
               }
               
               return dist ? `${holeText}번홀, 홀까지 거리 ${dist} 미터 입니다.` : `${holeText}번홀 훈련입니다.`;
           }
       } else {
           const finalClean = cleanAttempt.replace(/m\s*이상/g, ' 미터 이상').replace(/m/g, ' 미터').replace(/\d+/g, (m) => numberToKorean(parseInt(m, 10)));
           return `${holeText}번홀, ${finalClean} 지점입니다.`;
       }
  };

  const targetForReview = isPrep ? 1 : getTargetForCategory(reviewCat);
  const goalTextForReview = getGoalTextForCategory(reviewCat);
  const target = (reviewType === 'review_category' || reviewType === 'review_hole') ? targetForReview : (currentStage ? currentStage.target : 10);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if ((reviewType === 'review_hole' || reviewType === 'review_category') && reviewCat) {
      setTrainingType(reviewType as any);
      setHasSelected(true);
      
      timer = setTimeout(() => {
        setIsStarted(true);
        setIsActive(true);
        setIsPaused(false);
        setProgress(0);
        setStageIndex(0);
        setVoiceState({ isListening: false, transcript: '', statusText: '샷 결과 대기 중 ("성공" 등)' });
        requestMotionPermission();
        silentAudioRef.current?.play().catch(e => console.warn("Audio play failed:", e));
        
        let promptText = "";
        if (reviewType === 'review_category' && parsedHoles.length > 0) {
            const firstHole = parsedHoles[0];
            promptText = generatePrompt(firstHole.hole, firstHole.attempt, firstHole.par || 4);
        } else if (reviewHole) {
            promptText = generatePrompt(reviewHole, reviewAttempt || "", 4);
        }
        if (promptText) speakAndWait(promptText);
      }, 500);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [reviewType, reviewCat, reviewHole, reviewAttempt, recordId]);

  useEffect(() => {
     stateRef.current = { 
       isActive, 
       isPaused,
       progress, 
       stageIndex, 
       currentConfig, 
       currentStage,
       trainingType,
       isPrep,
       isWaitingForChainConfirm: stateRef.current.isWaitingForChainConfirm,
       nextChainCat: stateRef.current.nextChainCat,
       nextChainUrl: stateRef.current.nextChainUrl,
     };
     sensorStateRef.current.isActive = isActive;
     sensorStateRef.current.isPaused = isPaused;
     sensorStateRef.current.isLocked = isLocked;
  }, [isActive, isPaused, isLocked, progress, stageIndex, currentConfig, currentStage]);
  
  const togglePause = () => {
      setIsPaused(prev => !prev);
  };
  
  // Stable event listener proxy
  const stableDeviceMotionListener = (e: DeviceMotionEvent) => {
    if (deviceMotionHandlerRef.current) {
      deviceMotionHandlerRef.current(e);
    }
  };

  // Update deviceMotionHandlerRef on every render to avoid stale closure state
  useEffect(() => {
    deviceMotionHandlerRef.current = (event: DeviceMotionEvent) => {
      const state = sensorStateRef.current;
      if (!state.isActive || state.isPaused) return;
      if (!state.isLocked || Date.now() - state.lockTime < 10000) return;

      const x = event.acceleration?.x ?? event.accelerationIncludingGravity?.x ?? 0;
      const y = event.acceleration?.y ?? event.accelerationIncludingGravity?.y ?? 0;
      const z = event.acceleration?.z ?? event.accelerationIncludingGravity?.z ?? 0;

      const accel = Math.sqrt(x*x + y*y + z*z);
      
      if (state.prevAccel === 0) {
        state.prevAccel = accel;
        return;
      }

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
          } else {
            state.lastKnockTime = now;
          }
        }
      }
    };
  });

  // Request motion permission (works for iOS and Android)
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
        } else {
          setSensorAvailable(false);
          console.warn("Motion permission denied");
        }
      } catch (e) {
        console.error("Error requesting motion permission:", e);
        setSensorAvailable(false);
      }
    } else {
      if ('DeviceMotionEvent' in window) {
        window.removeEventListener('devicemotion', stableDeviceMotionListener, true);
        window.addEventListener('devicemotion', stableDeviceMotionListener, true);
        setSensorAvailable(true);
      } else {
        setSensorAvailable(false);
      }
    }
  };

  // Removed Speech Recognition initialization
  useEffect(() => {
    return () => {
      stateRef.current.isActive = false;
      window.removeEventListener('devicemotion', stableDeviceMotionListener, true);
      if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
    };
  }, []);
  
  // 컴포넌트 언마운트 시에만 cancel
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
  
  const speakAndWait = (text: string, callback?: () => void) => {
    isPlayingSpeechRef.current = true;
    if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
    }
    setVoiceState(prev => ({ ...prev, statusText: '안내 중...' }));
    
    let isFinished = false;
    const finishSpeech = () => {
        if (isFinished) return;
        isFinished = true;
        isPlayingSpeechRef.current = false;
        
        setVoiceState(prev => ({ ...prev, statusText: '샷 결과 대기 중 ("성공" 등)' }));
        
        // Background video keeps looping, so we don't need to change its src
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'playing';
        }
        
        if (callback) callback();
    };
    
    playSpeech(text, null, finishSpeech);
    
    // API 타임아웃 대비 안전장치 (네트워크 지연 등)
    const fallbackMs = Math.max(text.length * 300, 5000) + 1000;
    setTimeout(() => {
        if (!isFinished) {
            console.warn("TTS timeout, forcing finish");
            finishSpeech();
        }
    }, fallbackMs);
  };

  const handleVoiceInput = (text: string) => {
     if (stateRef.current.isWaitingForChainConfirm) {
         const confirmKeywords = ["네", "예", "오케이", "응", "어", "시작", "진행", "해줘", "훈련"];
         const rejectKeywords = ["아니", "그만", "끝", "종료", "안해"];
         
         const isConfirm = confirmKeywords.some(k => text.includes(k));
         const isReject = rejectKeywords.some(k => text.includes(k));
         
         if (isConfirm && stateRef.current.nextChainUrl) {
             setIsWaitingForChainConfirm(false);
             stateRef.current.isWaitingForChainConfirm = false;
             window.location.href = stateRef.current.nextChainUrl; // Using href to ensure full reload/state reset for next category
             return;
         } else if (isReject) {
             setIsWaitingForChainConfirm(false);
             stateRef.current.isWaitingForChainConfirm = false;
             router.back();
             return;
         }
     } else {
         const isSuccess = SUCCESS_KEYWORDS.some(k => text.includes(k));
         if (isSuccess) {
             handleShotSuccess();
         }
     }
  };

  useEffect(() => {
     handleVoiceInputRef.current = handleVoiceInput;
     handleShotSuccessRef.current = handleShotSuccess;
  });

  const handleShotSuccess = () => {
     const { currentConfig: config, currentStage: stage, progress: currentProgress, stageIndex: currentIndex, trainingType: tType } = stateRef.current;
     
     if (tType === 'review_hole' || tType === 'review_category') {
         const isCategory = tType === 'review_category';
         const currentHoleTarget = targetForReview;
         const newProgress = currentProgress + 1;
         
         const holeCompleted = newProgress >= currentHoleTarget;
         
         if (holeCompleted) {
             (async () => {
                if (recordId && reviewCat) {
                    try {
                        const supabase = createClient();
                        const { data: recordData } = await supabase.from("records").select("template_settings").eq("id", recordId).single();
                        if (recordData) {
                            const holeToMark = isCategory ? parsedHoles[currentIndex]?.hole : reviewHole;
                            if (holeToMark) {
                                const uniqueKey = `${reviewCat}_${holeToMark}`;
                                const currentSettings = recordData.template_settings || [];
                                const updatedSettings = currentSettings.map((s: any) => {
                                    if (s.type === "review_scorecard" || s.type === "prep_scorecard") {
                                        const currentCompleted = s.completedHoles || [];
                                        if (!currentCompleted.includes(uniqueKey)) {
                                            return { ...s, completedHoles: [...currentCompleted, uniqueKey] };
                                        }
                                    }
                                    return s;
                                });
                                await supabase.from("records").update({ template_settings: updatedSettings }).eq("id", recordId);
                            }
                        }
                    } catch (e) {
                        console.error("Failed to update completed status", e);
                    }
                }
             })();
             
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
                                 const nextUrl = `/training/motion-test?type=review_category&cat=${encodeURIComponent(nextCat.catName)}&holes=${nextCat.encodedHoles}&recordId=${recordId}&isPrep=${isPrep}`;
                                 
                                 stateRef.current.nextChainCat = nextCat.catName;
                                 stateRef.current.nextChainUrl = nextUrl;
                                 stateRef.current.isWaitingForChainConfirm = true;
                                 setIsWaitingForChainConfirm(true);
                                 setVoiceState(prev => ({ ...prev, transcript: '', statusText: '대답 대기 중 ("네", "아니오" 등)' }));
                                 
                                 speakAndWait(`해당 훈련을 완료하였습니다. 다음 ${nextCat.catName.replace(/m\s*이상/gi, ' 미터 이상').replace(/m/gi, ' 미터')} 훈련도 이어서 진행하시겠습니까?`);
                                 return;
                             }
                         }
                     } catch (e) {
                         console.error("Failed to parse trainingChain", e);
                     }
                 }
                 
                 setVoiceState(prev => ({ ...prev, transcript: '', statusText: '훈련 완료 저장 중...' }));
                 setIsActive(false);
                 setIsStarted(false);
                 silentAudioRef.current?.pause();
                 speakAndWait(`준비된 모든 ${isPrep ? '예습' : '복습'} 훈련을 완료하였습니다. 수고하셨습니다.`, () => {
                     router.back();
                 });
             } else {
                 setStageIndex(currentIndex + 1);
                 setProgress(0);
                 const nextHole = parsedHoles[currentIndex + 1];
                 if (nextHole) {
                     speakAndWait(generatePrompt(nextHole.hole, nextHole.attempt || "", nextHole.par || 4), () => {
                         setVoiceState(prev => ({ ...prev, transcript: '', statusText: '샷 결과 대기 중 ("성공" 등)' }));
                     });
                 }
             }
         } else {
             setProgress(newProgress);
             const remain = currentHoleTarget - newProgress;
             speakAndWait(`${remain}개 남았습니다.`);
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
         speakAndWait(prompt);
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
     
     speakAndWait(config.stages[0].introPrompt);
  };

  const stopTraining = () => {
     setIsActive(false);
     setIsStarted(false);
     setIsPaused(false);
     setIsLocked(false);
     window.removeEventListener('devicemotion', stableDeviceMotionListener, true);
     silentAudioRef.current?.pause();
     window.speechSynthesis.cancel();
     
     router.back();
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

  
  let displayTotalRemaining = 0;
  let displayTotalProgress = 0;
  let displayTotalTarget = 0;

  if (isPrep && trainingType === 'review_category') {
      displayTotalRemaining = Math.max(0, parsedHoles.length - stageIndex);
      displayTotalProgress = stageIndex;
      displayTotalTarget = parsedHoles.length;
  } else if (!isPrep && trainingType === 'review_category') {
      displayTotalTarget = parsedHoles.length * target;
      displayTotalProgress = (stageIndex * target) + progress;
      displayTotalRemaining = Math.max(0, target - progress);
  } else {
      displayTotalRemaining = Math.max(0, target - progress);
      displayTotalProgress = progress;
      displayTotalTarget = target;
  }

  if (!hasSelected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-70px)] bg-[#F8F9FC] dark:bg-zinc-950 p-6">
        <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 shadow-sm border border-zinc-200/60 dark:border-zinc-800/60 flex flex-col gap-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-brand-navy to-emerald-500"></div>
          
          <div className="flex items-center gap-2 pt-2">
            <button onClick={() => router.back()} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
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
  if (hasSelected && !isStarted && trainingType !== 'review_hole' && trainingType !== 'review_category') {
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
                   {currentConfig?.stages.map((stage, idx) => (
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
    >
       <div className="w-full max-w-sm flex flex-col items-center text-center relative">
           
           <h2 className="text-zinc-500 dark:text-zinc-400 font-bold text-sm mb-2 uppercase tracking-widest mt-4">
               {trainingType === 'review_category' 
                   ? `${reviewCat} ${isPrep ? '예습' : '복습'} -${parsedHoles[Math.min(stageIndex, Math.max(0, parsedHoles.length - 1))]?.hole || ''}번홀` 
                   : (trainingType === 'review_hole' ? `${reviewHole}번 홀 집중 분석` : `${currentConfig?.title} (${stageIndex + 1}단계)`)}
           </h2>
           
           <div className="flex items-center justify-center gap-3 mb-8 mt-2 bg-white dark:bg-zinc-900 py-2.5 px-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 w-full max-w-sm mx-auto shadow-sm">
               <div className="flex items-baseline gap-2">
                   <span className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                       남은 횟수 {displayTotalRemaining}회
                   </span>
                   <span className="text-sm sm:text-base font-bold text-zinc-400">
                       ({displayTotalProgress}/{displayTotalTarget})
                   </span>
               </div>
           </div>
           
           {(trainingType === 'review_hole' || trainingType === 'review_category') && (
           (() => {
               const currentHoleData = trainingType === 'review_category' ? parsedHoles[Math.min(stageIndex, parsedHoles.length - 1)] : { hole: reviewHole, attempt: reviewAttempt, result: reviewResult, score: reviewScore, note: reviewNote };
               if (!currentHoleData) return null;
               
               return (
               <div className="w-full bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm overflow-hidden mb-10 text-left">
                   <div className="bg-zinc-500 dark:bg-zinc-700 px-4 py-2 flex items-center justify-between">
                       <span className="text-[11px] font-bold text-white uppercase tracking-wider">{currentHoleData.hole}번 홀 집중 분석</span>
                   </div>
                   <div className="p-4 space-y-1">
                       <div className="flex items-center p-3 rounded-xl bg-zinc-50/50 dark:bg-zinc-800/50">
                           <div className="w-1 h-4 bg-zinc-300 dark:bg-zinc-600 rounded-full mr-3 shrink-0"></div>
                           <span className="text-[10px] font-bold text-zinc-400 w-12 shrink-0">시도</span>
                           <span className="flex-1 text-[13px] font-semibold text-zinc-700 dark:text-zinc-300 truncate">
                               {currentHoleData.attempt}
                           </span>
                       </div>
                       <div className="flex items-center p-3 rounded-xl bg-rose-50/30 dark:bg-rose-950/10">
                           <div className="w-1 h-4 bg-rose-500 rounded-full mr-3 shrink-0"></div>
                           <span className="text-[10px] font-bold text-zinc-400 w-12 shrink-0">결과</span>
                           <span className="flex-1 text-[13px] font-bold text-zinc-900 dark:text-zinc-100 whitespace-nowrap overflow-hidden text-ellipsis">
                               {currentHoleData.result}
                           </span>
                       </div>
                       {currentHoleData.score && currentHoleData.score !== '-' && (
                           <div className="flex items-center p-3 rounded-xl bg-rose-50/30 dark:bg-rose-950/10">
                               <div className="w-1 h-4 bg-zinc-300 dark:bg-zinc-600 rounded-full mr-3 shrink-0"></div>
                               <span className="text-[10px] font-bold text-zinc-400 w-12 shrink-0">샷별점수</span>
                               <span className={`flex-1 text-[13px] font-bold whitespace-nowrap overflow-hidden text-ellipsis ${Number(currentHoleData.score) < 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                   {Number(currentHoleData.score) > 0 ? `+${currentHoleData.score}` : currentHoleData.score}
                               </span>
                           </div>
                       )}
                       {currentHoleData.note && (
                           <div className="mt-2 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[12px] text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap shadow-sm mx-1 mb-1">
                               {currentHoleData.note}
                           </div>
                       )}
                   </div>
               </div>
               );
           })()
           )}
           
           <div className="w-full grid grid-cols-2 gap-3 mb-4">
               {/* Lock Button */}
               <button
                   onClick={(e) => { e.stopPropagation(); setIsLocked(true); sensorStateRef.current.lockTime = Date.now(); }}
                   className="py-4 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-2xl font-bold text-sm shadow-sm flex flex-col items-center justify-center gap-2 transition-all border border-zinc-200 dark:border-zinc-800"
               >
                   <Lock className="w-6 h-6 text-zinc-400" /> 화면 잠금
               </button>

               {/* Shot Success Button */}
               <button 
                  onClick={(e) => { e.stopPropagation(); handleShotSuccess(); }}
                  className="py-4 bg-green-50 dark:bg-green-500/10 hover:bg-green-100 dark:hover:bg-green-500/20 text-green-600 dark:text-green-400 rounded-2xl font-bold text-sm shadow-sm flex flex-col items-center justify-center gap-2 transition-all border border-green-200 dark:border-green-500/30"
               >
                  <CheckCircle className="w-6 h-6" /> {isPrep ? '완료' : '성공'}
               </button>

               {/* Pause / Resume Button */}
               <button
                   onClick={(e) => { e.stopPropagation(); togglePause(); }}
                   className={`py-4 ${isPaused ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30' : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'} hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-2xl font-bold text-sm shadow-sm flex flex-col items-center justify-center gap-2 transition-all border`}
               >
                   {isPaused ? <Play className="w-6 h-6" /> : <Pause className="w-6 h-6 text-zinc-400" />} 
                   {isPaused ? '훈련 재개' : '일시 정지'}
               </button>

               {/* End Training Button */}
               <button 
                  onClick={(e) => { e.stopPropagation(); stopTraining(); }}
                  className="py-4 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-2xl font-bold text-sm shadow-sm flex flex-col items-center justify-center gap-2 transition-all border border-red-200 dark:border-red-500/30"
               >
                  <Square className="w-6 h-6" /> 훈련 완료
               </button>
           </div>
           
       </div>

       {/* Lock Screen Overlay */}
       {isLocked && (
         <div className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center backdrop-blur-md select-none touch-none">
           <div className="flex flex-col items-center text-center px-6 max-w-sm">
             <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-6">
               <Lock className="w-10 h-10 text-red-500 animate-pulse" />
             </div>
             
             <h2 className="text-xl font-bold text-white mb-2">화면이 잠겼습니다</h2>
             <p className="text-white/60 text-sm mb-10 leading-relaxed">
               훈련 중 오작동 방지를 위해 화면이 잠겼습니다.<br />
               아래 버튼을 3초간 길게 누르면 잠금이 해제됩니다.
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

// Force Turbopack Cache 1782286860575
// Rebuild Targets
// Rebuild Putts
// Rebuild shortgame
// Rebuild remaining count display
// Rebuild goals