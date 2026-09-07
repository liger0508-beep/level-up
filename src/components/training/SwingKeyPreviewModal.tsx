"use client";

import React, { useEffect, useState, useRef } from "react";
import { X, Play, Square, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SwingKeyPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    comments: string[];
    commentIntervals: (number | "")[];
    swingKeyInterval: number;
}

export function SwingKeyPreviewModal({ isOpen, onClose, comments, commentIntervals, swingKeyInterval }: SwingKeyPreviewModalProps) {
    
    const [isPlaying, setIsPlaying] = useState(false);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [timeRemaining, setTimeRemaining] = useState(0);
    const [currentInterval, setCurrentInterval] = useState(0);
    
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const stateRef = useRef({
        index: 0,
        timeRemaining: 0,
        currentInterval: 0,
    });

    const validComments: string[] = [];
    const validIntervals: number[] = [];
    for (let i = 0; i < comments.length; i++) {
        if (comments[i].trim() !== "") {
            validComments.push(comments[i]);
            if (validComments.length > 1) {
                validIntervals.push((commentIntervals[i - 1] as number) || 3);
            }
        }
    }

    const getIntervalForNext = (currentIndex: number) => {
        if (currentIndex < validComments.length - 1) {
            return validIntervals[currentIndex] || 3;
        }
        return swingKeyInterval || 25;
    };

    // Stop everything when closed
    useEffect(() => {
        if (!isOpen) {
            stopPreview();
        }
    }, [isOpen]);

    const speak = (text: string) => {
        if (typeof window !== "undefined" && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = "ko-KR";
            window.speechSynthesis.speak(utterance);
        }
    };

    const stopPreview = () => {
        setIsPlaying(false);
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        if (typeof window !== "undefined" && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        setElapsedSeconds(0);
        setCurrentIndex(-1);
        setTimeRemaining(0);
        setCurrentInterval(0);
    };

    const startPreview = () => {
        if (validComments.length === 0) {
            alert("입력된 코멘트가 없습니다.");
            return;
        }
        
        const firstInterval = getIntervalForNext(0);
        
        setIsPlaying(true);
        setElapsedSeconds(0);
        setCurrentIndex(0);
        setTimeRemaining(firstInterval);
        setCurrentInterval(firstInterval);
        
        stateRef.current = {
            index: 0,
            timeRemaining: firstInterval,
            currentInterval: firstInterval
        };
        
        speak(validComments[0]);

        timerRef.current = setInterval(() => {
            stateRef.current.timeRemaining -= 1;
            setElapsedSeconds((prev) => prev + 1);
            
            if (stateRef.current.timeRemaining <= 0) {
                const nextIdx = (stateRef.current.index + 1) % validComments.length;
                speak(validComments[nextIdx]);
                
                const nextInterval = getIntervalForNext(nextIdx);
                stateRef.current = {
                    index: nextIdx,
                    timeRemaining: nextInterval,
                    currentInterval: nextInterval
                };
            }
            
            setCurrentIndex(stateRef.current.index);
            setTimeRemaining(stateRef.current.timeRemaining);
            setCurrentInterval(stateRef.current.currentInterval);
        }, 1000);
    };

    if (!isOpen) return null;

    const progressPercentage = currentInterval > 0 
        ? ((currentInterval - timeRemaining) / currentInterval) * 100 
        : 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800/50">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <Volume2 size={20} className="text-brand-navy dark:text-brand-navy-light" />
                        스윙키 재생 시뮬레이션
                    </h3>
                    <button 
                        onClick={onClose}
                        className="p-2 -mr-2 rounded-full text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-8">
                    {/* Visualizer */}
                    <div className="flex flex-col items-center justify-center space-y-4">
                        <div className="relative w-32 h-32 flex items-center justify-center">
                            <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                                <circle 
                                    cx="64" cy="64" r="60" 
                                    fill="none" 
                                    stroke="currentColor" 
                                    strokeWidth="8" 
                                    className="text-zinc-100 dark:text-zinc-800" 
                                />
                                {isPlaying && (
                                    <circle 
                                        cx="64" cy="64" r="60" 
                                        fill="none" 
                                        stroke="currentColor" 
                                        strokeWidth="8" 
                                        strokeLinecap="round"
                                        className="text-brand-navy dark:text-brand-navy-light transition-all duration-1000 ease-linear"
                                        strokeDasharray={`${2 * Math.PI * 60}`}
                                        strokeDashoffset={`${2 * Math.PI * 60 * (1 - progressPercentage / 100)}`}
                                    />
                                )}
                            </svg>
                            <div className="flex flex-col items-center">
                                <span className="text-3xl font-black text-zinc-900 dark:text-zinc-100 font-mono tracking-tighter">
                                    {Math.floor(elapsedSeconds / 60).toString().padStart(2, '0')}:{(elapsedSeconds % 60).toString().padStart(2, '0')}
                                </span>
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mt-1">Elapsed Time</span>
                            </div>
                        </div>

                        <div className="text-center space-y-1">
                            <p className="text-sm text-zinc-500 font-medium">현재 간격: {currentInterval}초</p>
                        </div>
                    </div>

                    {/* Current Comment */}
                    <div className="bg-zinc-50 dark:bg-zinc-800/30 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700/50 min-h-[100px] flex flex-col justify-center relative overflow-hidden">
                        {isPlaying ? (
                            <>
                                <span className="text-[10px] font-bold text-blue-500 mb-2 block absolute top-3 left-4">
                                    코멘트 {currentIndex + 1} / {validComments.length}
                                </span>
                                <p className="text-center text-lg font-bold text-zinc-800 dark:text-zinc-200 mt-4">
                                    "{validComments[currentIndex]}"
                                </p>
                            </>
                        ) : (
                            <p className="text-center text-zinc-400 font-medium">
                                하단의 재생 버튼을 눌러 시뮬레이션을 시작하세요.
                            </p>
                        )}
                    </div>

                    {/* Controls */}
                    <div className="flex justify-center">
                        {isPlaying ? (
                            <button
                                onClick={stopPreview}
                                className="flex items-center gap-2 px-8 py-3 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 rounded-full font-bold transition-all shadow-lg shadow-zinc-900/20 active:scale-95"
                            >
                                <Square size={18} fill="currentColor" /> 시뮬레이션 중지
                            </button>
                        ) : (
                            <button
                                onClick={startPreview}
                                className="flex items-center gap-2 px-8 py-3 bg-brand-navy hover:bg-brand-navy-dark text-white rounded-full font-bold transition-all shadow-lg shadow-brand-navy/20 active:scale-95"
                            >
                                <Play size={18} fill="currentColor" /> 시뮬레이션 시작
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
