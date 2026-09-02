"use client";

import { useRouter } from "next/navigation";
import { TrainingData, TrainingType } from "./TrainingCard";
import { cn } from "@/lib/utils";
import { CheckCircle2, X, Paperclip, AlertCircle, Dumbbell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { TrainingRecord } from "@/lib/training-sync";
import { useState, useRef, useEffect } from "react";
import { uploadFile } from "@/lib/storage-sync";

// ── Scorecard Meta Display Component ───────────────────────────
function ScorecardMetaDisplay({ scorecardId, dateStr, courseStr }: { scorecardId: string, dateStr: string, courseStr: string }) {
    const [scoreData, setScoreData] = useState<{ score: number, par: number } | null>(null);

    useEffect(() => {
        if (!scorecardId) return;
        const fetchScore = async () => {
            const supabase = createClient();
            const { data } = await supabase.from('scorecards').select('total_score, scorecard_holes(par)').eq('id', scorecardId).single();
            if (data) {
                const totalPar = (data.scorecard_holes as any[])?.reduce((sum: number, h: any) => sum + (h.par || 0), 0) || 72;
                setScoreData({ score: data.total_score || 0, par: totalPar });
            }
        };
        fetchScore();
    }, [scorecardId]);

    if (!scoreData) {
        return (
            <span className="text-[11px] font-bold text-zinc-400 shrink-0 mb-0.5 pl-[40px]">
                {dateStr} <span className="opacity-40 font-normal mx-0.5">|</span> {courseStr}
            </span>
        );
    }

    const diff = scoreData.score - scoreData.par;
    let colorClass = "text-zinc-900 dark:text-zinc-100";
    if (diff < 0) colorClass = "text-red-500";
    else if (diff > 0) colorClass = "text-blue-500";

    return (
        <span className="text-[11px] font-bold text-zinc-400 shrink-0 mb-0.5 pl-[40px]">
            {dateStr} <span className="opacity-40 font-normal mx-0.5">|</span> {courseStr} <span className="opacity-40 font-normal mx-0.5">|</span> <span className={colorClass}>{scoreData.score}타</span>
        </span>
    );
}


const typeConfig: Record<string, {
    label: string;
    accentBorder: string;
    dotColor: string;
    labelColor: string;
    iconColor: string;
    iconBg: string;
}> = {
    basic: { label: "기본기", accentBorder: "border-l-emerald-500", dotColor: "bg-emerald-500", labelColor: "text-emerald-700 dark:text-emerald-400", iconColor: "text-emerald-500", iconBg: "bg-emerald-50 dark:bg-emerald-500/10" },
    preview: { label: "예습", accentBorder: "border-l-blue-500", dotColor: "bg-blue-500", labelColor: "text-blue-700 dark:text-blue-400", iconColor: "text-blue-500", iconBg: "bg-blue-50 dark:bg-blue-500/10" },
    review: { label: "복습", accentBorder: "border-l-orange-500", dotColor: "bg-orange-500", labelColor: "text-orange-700 dark:text-orange-400", iconColor: "text-orange-500", iconBg: "bg-orange-50 dark:bg-orange-500/10" },
    lesson_review: { label: "스윙키", accentBorder: "border-l-purple-500", dotColor: "bg-purple-500", labelColor: "text-purple-700 dark:text-purple-400", iconColor: "text-purple-500", iconBg: "bg-purple-50 dark:bg-purple-500/10" },
    swing_pose: { label: "스윙모션", accentBorder: "border-l-rose-500", dotColor: "bg-rose-500", labelColor: "text-rose-700 dark:text-rose-400", iconColor: "text-rose-500", iconBg: "bg-rose-50 dark:bg-rose-500/10" },
};

interface TrainingTableProps {
    trainings: any[];
    totalCount?: number;
    onUpdate?: () => void;
    basePath?: string;
}

export function TrainingTable({ trainings, totalCount, onUpdate, basePath }: TrainingTableProps) {
    const router = useRouter();

    // ── Completion Modal State ─────────────────────────────────────
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTraining, setSelectedTraining] = useState<TrainingRecord | null>(null);
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [videoPreview, setVideoPreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const videoInputRef = useRef<HTMLInputElement>(null);

    const getLogs = (logs: any): string[] => {
        if (!logs) return [];
        if (Array.isArray(logs)) return logs;
        if (typeof logs === 'string') {
            try {
                const parsed = JSON.parse(logs);
                return Array.isArray(parsed) ? parsed : [];
            } catch {
                // If it's a single string that's not JSON, treat it as one log
                return [logs];
            }
        }
        return [];
    };

    const getAuthorOrCourseName = (training: TrainingRecord) => {
        if (training.type === 'preview' || training.type === 'review' || training.title?.includes('[예습]') || training.title?.includes('[복습]')) {
            const reviewSetting = (training.template_settings || []).find((s: any) => s.type === "review_scorecard");
            if (reviewSetting && reviewSetting.courseName) {
                let courseStr = reviewSetting.courseName;
                courseStr = courseStr.replace(/^(?:\d{2,4}[\.\-])?\d{1,2}[\.\-]\d{1,2}(?:,\s*|\s+)/, '');
                return courseStr.trim();
            }
            if (training.title) {
                const match = training.title.match(/^\[(?:예습|복습)\]\s*(.+)/);
                if (match) {
                    let courseStr = match[1].replace(/\s*라운드$/, '').trim();
                    courseStr = courseStr.replace(/^(?:\d{2,4}[\.\-])?\d{1,2}[\.\-]\d{1,2}(?:,\s*|\s+)/, '');
                    return courseStr.trim();
                }
            }
        }
        return training.coachName;
    };

    const calculateProgress = (training: TrainingRecord) => {
        if (training.title?.includes("[복습]") || training.title?.includes("[예습]")) {
            const reviewSetting = (training.template_settings || []).find((s: any) => s.type === "review_scorecard");
            if (reviewSetting) {
                const completed = reviewSetting.completedHoles?.length || 0;
                // If old record still has total_count=7 but more completed, fallback to completed
                const total = (training.total_count === 7 && completed > 7) ? completed : Math.max(training.total_count || 1, 1);
                return Math.min(Math.round((completed / total) * 100), 100);
            }
        }
        const total = training.total_count || 7;
        const logs = getLogs(training.completion_logs);
        const completed = logs.length;
        return Math.min(Math.round((completed / total) * 100), 100);
    };

    const handleCompleteTraining = (e: React.MouseEvent, training: TrainingRecord) => {
        e.stopPropagation();
        if (training.title?.includes("[복습]") || training.title?.includes("[예습]")) {
            router.push(`${basePath || '/training'}/${training.id}?autoStart=true`);
            return;
        }
        setSelectedTraining(training);
        setIsModalOpen(true);
    };

    const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;
        setVideoFile(file);
        if (file) {
            setVideoPreview(URL.createObjectURL(file));
        } else {
            setVideoPreview(null);
        }
    };

    const handleUploadAndComplete = async () => {
        if (!selectedTraining || !videoFile || isUploading) return;
        
        setIsUploading(true);
        try {
            const supabase = createClient();
            
            // 1. Upload Video
            const videoUrl = await uploadFile(videoFile, 'records', `training-completion/${selectedTraining.id}/${Date.now()}`);
            if (!videoUrl) throw new Error("Video upload failed");

            // 2. Prepare Log
            const now = new Date().toISOString();
            const logEntry = JSON.stringify({
                timestamp: now,
                mediaUrl: videoUrl,
                mediaType: videoFile.type
            });

            const currentLogs = getLogs(selectedTraining.completion_logs);
            const newLogs = [...currentLogs, logEntry];
            
            // 3. Update DB
            const { error } = await supabase
                .from("records")
                .update({ completion_logs: newLogs })
                .eq("id", selectedTraining.id);

            if (error) throw error;

            // 4. Update UI
            setIsModalOpen(false);
            setVideoFile(null);
            setVideoPreview(null);
            setSelectedTraining(null);
            alert("훈련 완료가 영상과 함께 기록되었습니다!");
            if (onUpdate) onUpdate();
        } catch (err) {
            console.error("Failed to complete training with video:", err);
            alert("훈련 완료 처리에 실패했습니다.");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <>
            {/* ── Mobile Card Grid (hidden on md+) ── */}
            <div className="flex flex-col gap-2.5 md:hidden">
                {trainings.map((training) => {
                    const cfg = typeConfig[training.type] || typeConfig.basic;
                    
                    // Extract training type from title if it exists (e.g., "[기본기] ...")
                    const typeMatch = training.title?.match(/^\[(.+?)\]/);
                    const trainingTypeLabel = typeMatch ? typeMatch[1] : null;

                    return (
                        <div
                            key={training.id}
                            onClick={() => {
                                sessionStorage.setItem("gla_training_keep_alive", "true");
                                router.push(`${basePath || '/training'}/${training.id}`);
                            }}
                            className="w-full text-left bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 py-4 px-6 shadow-sm hover:border-brand-navy/30 hover:shadow-md transition-all group cursor-pointer"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", cfg.iconBg, cfg.iconColor)}>
                                        <Dumbbell size={16} />
                                    </div>
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <span className="text-sm font-bold text-zinc-600 dark:text-zinc-300 truncate mr-1">{cfg.label}</span>
                                        <button 
                                            onClick={(e) => handleCompleteTraining(e, training)}
                                            className="p-1 bg-brand-red/10 text-brand-red rounded-lg hover:bg-brand-red hover:text-white transition-colors active:scale-90"
                                        >
                                            <CheckCircle2 size={16} />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 mr-2">
                                    <span className="text-[14px] font-black text-brand-navy shrink-0">
                                        {calculateProgress(training)}%
                                    </span>
                                </div>
                            </div>
                            
                            <div className="flex items-end justify-between mt-3">
                                {(() => {
                                    const dateStr = training.date.slice(5).replace("-", ".");
                                    const courseStr = getAuthorOrCourseName(training);
                                    let scorecardId = null;
                                    if (training.type === 'preview' || training.type === 'review' || training.title?.includes('[예습]') || training.title?.includes('[복습]')) {
                                        const reviewSetting = (training.template_settings || []).find((s: any) => s.type === "review_scorecard" || s.type === "prep_scorecard");
                                        if (reviewSetting && reviewSetting.scorecardId) {
                                            scorecardId = reviewSetting.scorecardId;
                                        }
                                    }
                                    
                                    if (scorecardId) {
                                        return <ScorecardMetaDisplay scorecardId={scorecardId} dateStr={dateStr} courseStr={courseStr} />;
                                    }
                                    return (
                                        <span className="text-[11px] font-bold text-zinc-400 shrink-0 mb-0.5 pl-[40px]">
                                            {dateStr} <span className="opacity-40 font-normal mx-0.5">|</span> {courseStr}
                                        </span>
                                    );
                                })()}
                                <span className="text-sm font-bold text-zinc-600 dark:text-zinc-300 truncate mr-2">
                                    {training.playerName}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── Desktop Table (hidden on mobile) ── */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-zinc-50/50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700 text-left text-zinc-500 dark:text-zinc-400">
                            <th className="py-2.5 px-4 font-semibold text-center w-16">번호</th>
                            <th className="py-2.5 px-4 font-semibold text-center w-20">유형</th>
                            <th className="py-2.5 px-4 font-semibold text-center w-24">선수명</th>
                            <th className="py-2.5 px-4 font-semibold text-center w-24">진행률</th>
                            <th className="py-2.5 px-4 font-semibold text-center w-24">작성자/골프장</th>
                            <th className="py-2.5 px-4 font-semibold text-center w-20">날짜</th>
                            <th className="py-2.5 px-4 font-semibold text-center w-20">완료</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {trainings.map((training, idx) => {
                            const cfg = typeConfig[training.type] || typeConfig.basic;
                            return (
                                <tr
                                    key={training.id}
                                    onClick={() => {
                                        sessionStorage.setItem("gla_training_keep_alive", "true");
                                        router.push(`${basePath || '/training'}/${training.id}`);
                                    }}
                                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                                >
                                    <td className="py-3.5 px-4 text-center text-zinc-500 dark:text-zinc-500">
                                        {(totalCount ?? trainings.length) - idx}
                                    </td>
                                    <td className="py-3.5 px-4 text-center">
                                        <div className="flex flex-col items-center leading-tight">

                                            <span className={cn("text-[11px] font-bold uppercase", cfg.labelColor)}>
                                                {cfg.label}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="py-3.5 px-4 text-center">
                                        <span className="text-zinc-700 dark:text-zinc-300 font-bold truncate">
                                            {training.playerName}
                                        </span>
                                    </td>
                                    <td className="py-3.5 px-4 text-center">
                                        <div className="w-16 h-4 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden relative mx-auto shadow-inner">
                                            <div 
                                                className="h-full bg-brand-navy transition-all duration-500 ease-out flex items-center justify-center" 
                                                style={{ width: `${calculateProgress(training)}%` }}
                                            >
                                                {calculateProgress(training) >= 50 && (
                                                    <span className="text-[9px] font-black text-white">{calculateProgress(training)}%</span>
                                                )}
                                            </div>
                                            {calculateProgress(training) < 50 && (
                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                    <span className="text-[9px] font-black text-brand-navy">{calculateProgress(training)}%</span>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-3.5 px-4 text-center text-zinc-600 dark:text-zinc-400 truncate">
                                        {getAuthorOrCourseName(training)}
                                    </td>
                                    <td className="py-3.5 px-4 text-center text-zinc-500 dark:text-zinc-500">
                                        {training.date.slice(5).replace("-", ".")}
                                    </td>
                                    <td className="py-3.5 px-4 text-center">
                                        <button 
                                            onClick={(e) => handleCompleteTraining(e, training)}
                                            className="p-1.5 bg-brand-red text-white rounded-lg shadow-sm active:scale-95 transition-all"
                                        >
                                            <CheckCircle2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {/* ── Completion Video Modal ── */}
            {isModalOpen && selectedTraining && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-bottom-4 duration-300">
                        <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50">
                            <div>
                                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">훈련 완료 인증</h3>
                                <p className="text-xs text-zinc-500 mt-0.5">{selectedTraining.playerName} • {getLogs(selectedTraining.completion_logs).length + 1}회차</p>
                            </div>
                            <button 
                                onClick={() => {
                                    setIsModalOpen(false);
                                    setVideoFile(null);
                                    setVideoPreview(null);
                                }}
                                className="p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-6">
                            <div className="space-y-4">
                                {videoPreview ? (
                                    <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-zinc-200 dark:border-zinc-800 group">
                                        <video src={videoPreview} controls className="w-full h-full object-contain" />
                                        <button 
                                            onClick={() => {
                                                setVideoFile(null);
                                                setVideoPreview(null);
                                            }}
                                            className="absolute top-3 right-3 p-2 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <button 
                                        onClick={() => videoInputRef.current?.click()}
                                        className="w-full aspect-video rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 flex flex-col items-center justify-center gap-3 text-zinc-400 hover:border-brand-navy hover:text-brand-navy transition-all"
                                    >
                                        <div className="w-12 h-12 rounded-full bg-white dark:bg-zinc-900 flex items-center justify-center shadow-sm">
                                            <Paperclip size={20} />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-bold">훈련 영상 선택</p>
                                            <p className="text-[11px] opacity-60 mt-1">MP4, MOV 파일 가능 (최대 50MB)</p>
                                        </div>
                                    </button>
                                )}
                                <input 
                                    ref={videoInputRef}
                                    type="file" 
                                    accept="video/*" 
                                    className="hidden" 
                                    onChange={handleVideoChange} 
                                />
                            </div>

                            <button
                                onClick={handleUploadAndComplete}
                                disabled={!videoFile || isUploading}
                                className={cn(
                                    "w-full py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg active:scale-[0.98]",
                                    videoFile && !isUploading
                                        ? "bg-brand-red text-white hover:bg-brand-red-dark shadow-brand-red/20"
                                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
                                )}
                            >
                                {isUploading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                        <span>업로드 중...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={20} />
                                        <span>훈련 완료 저장하기</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
