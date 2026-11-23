"use client";

import React, { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export function VoiceInputButton({ onTranscript, disabled = false }: VoiceInputButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const stopAll = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
  };

  useEffect(() => {
    return () => {
      stopAll();
    };
  }, []);

  const handleToggle = async () => {
    if (disabled || isTranscribing) return;

    if (isRecording) {
      stopAll();
      return;
    }

    const win = window as any;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;

    // 1. Browser Web Speech API (Chrome, Safari, Android Chrome)
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = "ko-KR";
        recognition.continuous = true;
        recognition.interimResults = false;

        recognition.onresult = (event: any) => {
          let spoken = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              spoken += event.results[i][0].transcript;
            }
          }
          const trimmed = spoken.trim();
          if (trimmed) {
            onTranscriptRef.current(trimmed);
          }
        };

        recognition.onerror = (event: any) => {
          if (event?.error === "not-allowed" || event?.error === "service-not-allowed") {
            alert("마이크 권한을 허용해 주세요.");
          }
          recognitionRef.current = null;
          setIsRecording(false);
        };

        recognition.onend = () => {
          recognitionRef.current = null;
          setIsRecording(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
        setIsRecording(true);
        return;
      } catch {
        recognitionRef.current = null;
      }
    }

    // 2. Fallback: MediaRecorder + Gemini Transcribe API (for iOS/Android WebView)
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      alert("이 기기에서는 음성 녹음을 지원하지 않습니다.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const recordedType = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: recordedType });
        chunksRef.current = [];
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        mediaRecorderRef.current = null;

        if (blob.size === 0) return;

        setIsTranscribing(true);
        try {
          const formData = new FormData();
          formData.append("audio", blob, "voice.webm");
          const res = await fetch("/api/ai/transcribe", {
            method: "POST",
            body: formData,
          });
          const data = await res.json();
          if (!res.ok) {
            alert(data.error || "음성 변환에 실패했습니다.");
            return;
          }
          if (data.text) {
            onTranscriptRef.current(data.text);
          }
        } catch {
          alert("음성 변환 중 오류가 발생했습니다.");
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      alert("마이크 권한을 허용해 주세요.");
      stopAll();
    }
  };

  return (
    <button
      type="button"
      disabled={disabled || isTranscribing}
      onClick={handleToggle}
      className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold border transition-all shadow-sm disabled:opacity-50 whitespace-nowrap shrink-0 ${
        isRecording
          ? "border-red-300 bg-red-50 text-red-600 dark:border-red-700/60 dark:bg-red-950/40 dark:text-red-400 animate-pulse"
          : "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
      }`}
    >
      {isTranscribing ? (
        <div className="w-3.5 h-3.5 border-2 border-zinc-400/40 border-t-zinc-600 rounded-full animate-spin shrink-0" />
      ) : isRecording ? (
        <Square size={12} className="shrink-0 fill-current" />
      ) : (
        <Mic size={14} className="shrink-0" />
      )}
      <span>{isTranscribing ? "변환중" : isRecording ? "중지" : "음성"}</span>
    </button>
  );
}
