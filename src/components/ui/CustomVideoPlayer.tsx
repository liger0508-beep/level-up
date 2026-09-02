"use client";

import { useRef, useState, useEffect } from "react";
import { Play, Pause, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface CustomVideoPlayerProps {
    src: string;
    className?: string;
    hideCustomControls?: boolean;
}

export function CustomVideoPlayer({ src, className, hideCustomControls = false }: CustomVideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [showNativeControls, setShowNativeControls] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    const togglePlay = () => {
        if (!videoRef.current) return;
        if (isPlaying) {
            videoRef.current.pause();
        } else {
            videoRef.current.play();
        }
    };

    const handleRate = (rate: number) => {
        if (!videoRef.current) return;
        videoRef.current.playbackRate = rate;
        setPlaybackRate(rate);
        setShowNativeControls(false);
    };

    const handleFrame = (forward: boolean) => {
        if (!videoRef.current) return;
        // Assume 30fps
        videoRef.current.pause();
        videoRef.current.currentTime += (forward ? 1 / 30 : -1 / 30);
        setShowNativeControls(false);
    };

    const handleDownload = async () => {
        if (isDownloading) return;
        setIsDownloading(true);
        try {
            const response = await fetch(src);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            const filename = src.split("/").pop()?.split("?")[0] || "video.mp4";
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch {
            // Fallback: open in new tab
            window.open(src, "_blank");
        } finally {
            setIsDownloading(false);
        }
    };

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onRateChange = () => setPlaybackRate(video.playbackRate);

        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);
        video.addEventListener('ratechange', onRateChange);

        return () => {
            video.removeEventListener('play', onPlay);
            video.removeEventListener('pause', onPause);
            video.removeEventListener('ratechange', onRateChange);
        };
    }, []);

    return (
        <div className={cn("w-full h-full flex items-center justify-center overflow-hidden", className)}>
            <div className="flex flex-col items-center justify-center min-w-0 min-h-0 max-w-full h-full w-full">
                <div className="relative flex-1 w-full min-h-0 flex items-center justify-center">
                    <video
                        ref={videoRef}
                        src={src}
                        controls={showNativeControls}
                        playsInline
                        onClick={() => setShowNativeControls(true)}
                        className="flex-1 w-auto max-w-full h-full object-contain rounded-xl sm:rounded-2xl bg-black/5 [&::-webkit-media-controls-overlay-play-button]:!hidden"
                    />
                    <button
                        onClick={handleDownload}
                        disabled={isDownloading}
                        title="영상 다운로드"
                        className="absolute left-2 top-0 z-10 w-[28px] h-[28px] flex items-center justify-center rounded-full bg-black/60 hover:bg-black/70 text-white backdrop-blur-sm transition-all shadow-md active:scale-95 disabled:opacity-50"
                    >
                        {isDownloading ? (
                            <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Download size={14} strokeWidth={2.5} />
                        )}
                    </button>
                </div>
                {!hideCustomControls && (
                    <div className="w-full mt-3 pt-3 pb-3 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
                        <div className="flex items-center justify-center gap-2 sm:gap-3">
                            <button
                                onClick={() => handleFrame(false)}
                                className="w-24 sm:w-28 py-1.5 sm:py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-400 hover:text-zinc-500 dark:text-zinc-500 dark:hover:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center font-bold bg-white dark:bg-zinc-900 shadow-sm active:scale-95 flex-none"
                            >
                                <ChevronLeft size={16} strokeWidth={2.5} />
                            </button>
                            <button
                                onClick={togglePlay}
                                className="w-24 sm:w-28 py-1.5 sm:py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-400 hover:text-zinc-500 dark:text-zinc-500 dark:hover:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center font-bold bg-white dark:bg-zinc-900 shadow-sm active:scale-95 flex-none"
                            >
                                {isPlaying ? <Pause size={16} strokeWidth={2.5} /> : <Play size={16} strokeWidth={2.5} />}
                            </button>
                            <button
                                onClick={() => handleFrame(true)}
                                className="w-24 sm:w-28 py-1.5 sm:py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-400 hover:text-zinc-500 dark:text-zinc-500 dark:hover:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center font-bold bg-white dark:bg-zinc-900 shadow-sm active:scale-95 flex-none"
                            >
                                <ChevronRight size={16} strokeWidth={2.5} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}