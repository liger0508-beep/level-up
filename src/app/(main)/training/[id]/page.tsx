"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { BookOpen, ChevronLeft, ChevronRight, MoreVertical, Calendar, Download, AlertCircle, MessageSquare, Send, Flag, MapPin, User, CheckCircle2, Check, Edit2, Trash2, Layers, Paperclip, X, Play, ChevronDown, Trophy, AlertTriangle, Target, Video, Square, Volume2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchTrainingTemplates, TrainingTemplate } from "@/lib/training-template-sync";
import { saveTrainingRecord, fetchRecentTrainingsByPlayer, TrainingRecord } from "@/lib/training-sync";
import { parseMediaUrls, fetchComments, saveComment, updateComment, deleteComment, AnalysisComment } from "@/lib/analysis-sync";
import { cn } from "@/lib/utils";
import { CustomVideoPlayer } from "@/components/ui/CustomVideoPlayer";
import { TrainingType } from "@/components/training/TrainingCard";
import { uploadFile } from "@/lib/storage-sync";
import { fetchScoreById, ScoreData } from "@/lib/score-sync";
import { generateReviewFocusCategories, ReviewFocusShot } from "@/lib/score-calculations";

const typeBadgeConfig: Record<string, { label: string; bg: string; text: string; labelColor: string; accentBorder: string }> = {
    basic: { label: "기본기", bg: "bg-emerald-500", text: "text-white", labelColor: "text-emerald-500", accentBorder: "border-l-emerald-500" },
    preview: { label: "예습", bg: "bg-blue-500", text: "text-white", labelColor: "text-blue-500", accentBorder: "border-l-blue-500" },
    review: { label: "복습", bg: "bg-orange-500", text: "text-white", labelColor: "text-orange-500", accentBorder: "border-l-orange-500" },
    lesson_review: { label: "스윙키", bg: "bg-purple-500", text: "text-white", labelColor: "text-purple-500", accentBorder: "border-l-purple-500" },
    swing_pose: { label: "스윙모션", bg: "bg-rose-500", text: "text-white", labelColor: "text-rose-500", accentBorder: "border-l-rose-500" },
    motion_test: { label: "모션", bg: "bg-teal-500", text: "text-white", labelColor: "text-teal-500", accentBorder: "border-l-teal-500" },
};

const POS_MAP: Record<string, string> = {
    "TE": "티샷",
    "FW": "페어웨이",
    "RO": "러프",
    "FB": "페어웨이 벙커",
    "GR": "그린",
    "GA": "그린주변어프로치",
    "GB": "그린주변벙커",
    "HI": "홀인",
    "PA": "패널티구역",
    "OB": "오비",
    "PS": "벌타",
    "FO": "숲속",
};


export default function TrainingDetailPage() {
    const router = useRouter();
    const params = useParams();
    const { id } = params;
    const searchParams = useSearchParams();
    const autoStart = searchParams.get("autoStart") === "true";

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const [training, setTraining] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [comments, setComments] = useState<AnalysisComment[]>([]);
    const [dbTemplates, setDbTemplates] = useState<TrainingTemplate[]>([]);
    const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);

    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
    const [editingCommentText, setEditingCommentText] = useState("");
    const [isUpdatingComment, setIsUpdatingComment] = useState(false);
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);

    const [newComment, setNewComment] = useState("");
    const [commentFile, setCommentFile] = useState<File | null>(null);
    const [commentPreviewUrl, setCommentPreviewUrl] = useState<string | null>(null);
    const commentFileRef = useRef<HTMLInputElement>(null);
    const carouselRef = useRef<HTMLDivElement>(null);
    const contentCarouselRef = useRef<HTMLDivElement>(null);

    // ── Completion Video State ─────────────────────────────────────
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [completionVideo, setCompletionVideo] = useState<File | null>(null);
    const [completionVideoPreview, setCompletionVideoPreview] = useState<string | null>(null);
    const [isUploadingVideo, setIsUploadingVideo] = useState(false);
    const completionVideoInputRef = useRef<HTMLInputElement>(null);
    const [expandedSessionIndex, setExpandedSessionIndex] = useState<number | null>(null);
    const [showAllHistory, setShowAllHistory] = useState(false);

    // ── Confirm Dialog State ─────────────────────────────────────
    const [confirmDialog, setConfirmDialog] = useState<{isOpen: boolean, message: string, onConfirm: () => void} | null>(null);


    const [reviewData, setReviewData] = useState<{
        scorecardId: string;
        analysis: any[];
        completedHoles: string[];
        recentScore: ScoreData | null;
        categoryTimes?: Record<string, number>;
        historicalCompletedCount?: number;
        historicalTrainingSeconds?: number;
    } | null>(null);
    const [selectedFocusHole, setSelectedFocusHole] = useState<number | string | null>(null);
    const [expandedReviewIdx, setExpandedReviewIdx] = useState<number | null>(null);
    const [hasAutoExpanded, setHasAutoExpanded] = useState(false);

    const CATEGORY_TO_FIELD: Record<string, string | string[]> = {
        "퍼팅": ["distSG_Putt9Plus", "distSG_Putt4_8", "distSG_Putt2_3", "distSG_Putt1"],
        "그린주변샷": ["distSG_Approach", "distSG_Bunker"],
        "아이언&피치샷": ["distSG_180Plus", "distSG_150_179", "distSG_120_149", "distSG_90_119", "distSG_Pitch31_89"],
        "티샷": "distSG_DriverAcc",
    };

    const LOCATION_ABBR_REV: Record<string, string> = {
        "TE": "티박스",
        "FW": "페어웨이",
        "RO": "러프",
        "FB": "페어웨이 벙커",
        "GR": "그린",
        "GA": "어프로치",
        "GB": "벙커",
        "HI": "홀인",
        "PA": "패널티구역",
        "OB": "오비",
        "PS": "벌타",
        "FO": "숲속",
        "-": "패널티구역"
    };


const PREP_CATEGORIES = [
    "퍼팅", "그린주변샷", "아이언&피치샷", "티샷"
];

function getCategoryShots(catName: string, h: any, isPrep: boolean) {
    const shots = h.shots || [];
    let isMatchFn;
    if (catName === "티샷 비거리" || catName === "티샷 정확도" || catName === "티샷") {
        isMatchFn = (s: any) => s.shotLabel.split('/')[0].trim().toUpperCase() === "TE" && h.par >= 4;
    } else if (catName === "아이언&피치샷") {
        isMatchFn = (s: any) => { const l = s.shotLabel.split('/')[0].trim().toUpperCase(); return l !== "GR" && l !== "GB" && (l !== "TE" || h.par === 3) && s.attemptDistance >= 31; };
    } else if (catName === "그린주변샷") {
        isMatchFn = (s: any) => { const l = s.shotLabel.split('/')[0].trim().toUpperCase(); return l === "GB" || (l !== "GR" && l !== "TE" && s.attemptDistance > 0 && s.attemptDistance <= 30); };
    } else if (catName === "퍼팅") {
        isMatchFn = (s: any) => s.shotLabel.split('/')[0].trim().toUpperCase() === "GR" && s.attemptDistance >= 1;
    } else {
        isMatchFn = () => false;
    }

    return shots.filter((s: any) => {
        if (!isMatchFn(s)) return false;
        if (isPrep || s.shotSG >= 0) return true;
        if ((catName === "티샷 비거리" || catName === "티샷 정확도" || catName === "티샷") && !["FW", "GA", "GB", "GR"].includes(s.landingLabel)) return true;
        return false;
    });
}

function createWorstShotInfo(s: any, h: any) {
    const startAbbr = s.shotLabel.split('/')[0].trim();
    const attemptLoc = LOCATION_ABBR_REV[startAbbr] || startAbbr;
    const isTeeShot = startAbbr === "TE";
    const attemptText = (isTeeShot && h.par !== 3) 
        ? attemptLoc 
        : `${attemptLoc} / ${s.attemptDistance > 0 ? s.attemptDistance + 'm' : "-"}`;

    const resultLoc = LOCATION_ABBR_REV[s.landingLabel] || s.landingLabel || "알수없음";
    let resultText = resultLoc;

    if (s.landingLabel !== "HI" && !['OB', 'PA', 'PS', '-'].includes(s.landingLabel)) {
        resultText += ` / ${s.remainingDistance > 0 ? s.remainingDistance + 'm' : "-"}`;
    }

    return {
        attempt: attemptText,
        result: resultText,
        isPenalty: ['OB', 'PA', 'PS', '-'].includes(s.landingLabel),
        score: s.shotSG,
        note: s.memo || s.shotNote || null,
        rawAttemptDistance: s.attemptDistance,
        shotNumber: s.shotNumber || 0
    };
}

function getTrainingCategories(isPrep: boolean, reviewData: any) {
    if (!reviewData || !reviewData.analysis) return [];

    if (isPrep) {
        return PREP_CATEGORIES.map(catName => {

            
            let focusHoles: any[] = [];
            if (catName === "퍼팅") {
                focusHoles = [...reviewData.analysis].flatMap(h => {
                    const relevantShots = getCategoryShots(catName, h, true);
                    return relevantShots.map((shot: any) => ({
                        holeNumber: h.holeNumber,
                        hData: h,
                        worstShotInfo: createWorstShotInfo(shot, h),
                        uniqueId: `${catName}_${h.holeNumber}_${shot.attemptDistance}`
                    }));
                });
            } else {
                focusHoles = [...reviewData.analysis].flatMap(h => {
                    const relevantShots = getCategoryShots(catName, h, true);
                    if (relevantShots.length === 0) return [];
                    const sortedShots = relevantShots.sort((a: any, b: any) => b.attemptDistance - a.attemptDistance);
                    
                    let filteredShots: any[] = [];
                    for (const shot of sortedShots) {
                        if (catName === "아이언&피치샷") {
                            if (!filteredShots.some(s => Math.abs(s.attemptDistance - shot.attemptDistance) <= 50)) {
                                filteredShots.push(shot);
                            }
                        } else if (catName === "그린주변샷") {
                            const isCurrentBunker = shot.shotLabel.split('/')[0].trim().toUpperCase() === "GB";
                            if (!filteredShots.some(s => {
                                const isSBunker = s.shotLabel.split('/')[0].trim().toUpperCase() === "GB";
                                return isCurrentBunker === isSBunker;
                            })) {
                                filteredShots.push(shot);
                            }
                        } else {
                            filteredShots.push(shot);
                            break;
                        }
                    }
                    return filteredShots.map(shot => ({
                        holeNumber: h.holeNumber,
                        hData: h,
                        worstShotInfo: createWorstShotInfo(shot, h),
                        uniqueId: `${catName}_${h.holeNumber}_${shot.attemptDistance}_${shot.shotNumber || 0}`
                    }));
                });
            }
            
            if (catName === "티샷" || catName === "퍼팅") {
                focusHoles.sort((a: any, b: any) => a.holeNumber - b.holeNumber);
            } else if (catName === "그린주변샷") {
                focusHoles.sort((a: any, b: any) => {
                    const isBunkerA = a.worstShotInfo.attempt.includes("벙커");
                    const isBunkerB = b.worstShotInfo.attempt.includes("벙커");
                    if (isBunkerA && !isBunkerB) return 1;
                    if (!isBunkerA && isBunkerB) return -1;
                    return a.holeNumber - b.holeNumber;
                });
            } else if (catName === "아이언&피치샷") {
                focusHoles.sort((a: any, b: any) => a.worstShotInfo.rawAttemptDistance - b.worstShotInfo.rawAttemptDistance);
            }
            
            return { name: catName, holes: focusHoles };
        }).filter(cat => cat.holes.length > 0);
    } else {
        const focusCategories = generateReviewFocusCategories(reviewData.analysis);
        const result = [];
        const MAJORS = ["퍼팅", "그린주변샷", "아이언&피치샷", "티샷"];
        for (const major of MAJORS) {
            if (focusCategories[major] && focusCategories[major].length > 0) {
                const holes = focusCategories[major].map((s: ReviewFocusShot) => {
                    const h = reviewData.analysis.find((hole: any) => hole.holeNumber === s.holeNumber);
                    const originalShot = h?.shots.find((os: any) => os.shotLabel === s.shotLabel && os.attemptDistance === s.attemptDistance);
                    
                    return {
                        holeNumber: s.holeNumber,
                        hData: h,
                        worstShotInfo: originalShot ? createWorstShotInfo(originalShot, h) : {
                            attempt: s.subCategory,
                            result: "알수없음",
                            isPenalty: false,
                            score: s.shotSG,
                            note: null,
                            rawAttemptDistance: s.attemptDistance,
                            shotNumber: 0
                        },
                        uniqueId: `${major}_${s.holeNumber}_${s.attemptDistance}_${originalShot?.shotNumber || 0}`,
                        shotSG: s.shotSG,
                        attemptDistance: s.attemptDistance,
                        shotLabel: s.shotLabel,
                        groupId: s.subCategory
                    };
                });
                result.push({ name: major, holes });
            }
        }
        return result;
    }
}


    useEffect(() => {
        if (!reviewData || !training) return;

        const isPrep = training.title?.includes("[예습]");
        const currentCats = getTrainingCategories(isPrep, reviewData);

        let totalTasks = 0;
        currentCats.forEach(cat => totalTasks += cat.holes.length);

        if (training.total_count !== totalTasks) {
            const supabase = createClient();
            supabase.from("records").update({ total_count: totalTasks }).eq("id", training.id).then(() => {
                // Ignore error, silently sync
            });
            // Update local state so it doesn't loop
            setTraining((prev: any) => prev ? { ...prev, total_count: totalTasks } : prev);
        }

        if (hasAutoExpanded) return;

        setHasAutoExpanded(true);
        let foundUncompleted = false;
            for (let i = 0; i < currentCats.length; i++) {
                const cat = currentCats[i];
                const uncompletedHoles = cat.holes.filter((h: any) => !reviewData.completedHoles.includes(h.uniqueId || `${cat.name}_${h.holeNumber}`));

                if (uncompletedHoles.length > 0) {
                    setExpandedReviewIdx(i);
                    setSelectedFocusHole(uncompletedHoles[0].uniqueId || `${cat.name}_${uncompletedHoles[0].holeNumber}`);
                    foundUncompleted = true;
                    break;
                }
            }
            if (!foundUncompleted) {
                setExpandedReviewIdx(null);
                setSelectedFocusHole(null);
            }
        // Handle autoStart separately
        if (autoStart) {
            for (let i = 0; i < currentCats.length; i++) {
                const cat = currentCats[i];
                const uncompletedHoles = cat.holes.filter((h: any) => !reviewData.completedHoles.includes(h.uniqueId || `${cat.name}_${h.holeNumber}`));

                if (uncompletedHoles.length > 0) {
                    const hData = uncompletedHoles[0];
                    const catName = cat.name;
                    const subsequentHoles = cat.holes.slice(cat.holes.findIndex((h: any) => h.holeNumber === hData.holeNumber));
                    let targetHoles = subsequentHoles.filter((h: any) => 
                        !reviewData.completedHoles.includes(h.uniqueId || `${catName}_${h.holeNumber}` as any)
                    );
                    targetHoles = targetHoles.map((h: any) => ({
                        hole: h.holeNumber,
                        uniqueId: h.uniqueId || `${catName}_${h.holeNumber}`,
                        par: h.hData ? h.hData.par : (h.par || 4),
                        attempt: h.worstShotInfo?.attempt || "-",
                        result: h.worstShotInfo?.result || "-",
                        score: h.worstShotInfo?.score?.toFixed(1) || "-",
                        note: h.worstShotInfo?.note || "",
                        putts: h.hData?.summary?.putts || 0,
                        shotNumber: h.worstShotInfo?.shotNumber || 0
                    }));
                    
                    let allowedCats = [cat];
                    if (catName === "아이언&피치샷") {
                        const teeShotCat = currentCats.find((c: any) => c.name === "티샷");
                        if (teeShotCat) allowedCats.push(teeShotCat);
                    }

                    const trainingChain = allowedCats.map(c => {
                        const cHoles = c.holes.map((ch: any) => ({
                            hole: ch.holeNumber,
                            uniqueId: ch.uniqueId || `${c.name}_${ch.holeNumber}`,
                            par: ch.hData ? ch.hData.par : (ch.par || 4),
                            attempt: ch.worstShotInfo?.attempt || "-",
                            result: ch.worstShotInfo?.result || "-",
                            score: ch.worstShotInfo?.score?.toFixed(1) || "-",
                            note: ch.worstShotInfo?.note || "",
                            putts: ch.hData?.summary?.putts || 0,
                            shotNumber: ch.worstShotInfo?.shotNumber || 0
                        }));
                        return {
                            catName: c.name,
                            encodedHoles: encodeURIComponent(JSON.stringify(cHoles))
                        };
                    });
                    sessionStorage.setItem('trainingChain', JSON.stringify(trainingChain));
                    sessionStorage.setItem('lastTrainingCat', catName);
                    
                    const encodedHoles = encodeURIComponent(JSON.stringify(targetHoles));
                    router.replace(`/training/voice-guide?type=review_category&cat=${encodeURIComponent(catName)}&holes=${encodedHoles}&recordId=${training.id}&isPrep=${isPrep}`);
                    return;
                }
            }
        }
    }, [reviewData, training, hasAutoExpanded]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            if (!id) return;
            setIsLoading(true);
            const supabase = createClient();
            
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    setCurrentUser({ id: user.id, name: user.user_metadata?.name || 'User' });
                }

                // 1. Fetch training record
                const { data, error } = await supabase
                    .from("records")
                    .select(`
                        id,
                        type,
                        category,
                        title,
                        content,
                        media_urls,
                        created_at,
                        training_start,
                        training_end,
                        completion_logs,
                        template_settings,
                        total_count,
                        user:users!records_user_id_fkey(name),
                        coach:users!records_coach_id_fkey(name)
                    `)
                    .eq("id", id)
                    .single();
                
                if (error) throw error;

                // 2. Fetch comments and templates in parallel
                const [commentsData, templatesData] = await Promise.all([
                    fetchComments(id as string),
                    fetchTrainingTemplates()
                ]);

                setComments(commentsData);
                setDbTemplates(templatesData);

                // 3. Parse media_urls
                const allMedia = parseMediaUrls(data.media_urls);
                const attachedMedia = allMedia.filter(url => url.startsWith('http')).map(url => ({
                    type: url.match(/\.(mp4|mov|webm)$/i) ? 'video' : 'image',
                    url
                }));
                const templateIds = allMedia
                    .filter(url => url.startsWith('template:'))
                    .map(url => url.replace('template:', ''));

                // Prioritize customized settings from the record, fallback to template defaults
                const templates = (data.template_settings && data.template_settings.length > 0)
                    ? data.template_settings.map((s: any) => {
                        const original = templatesData.find(t => t.id === s.id);
                        return { ...original, ...s };
                    })
                    : templatesData.filter(t => templateIds.includes(t.id));

                const templateMedia = templates
                    .filter((t: any) => t.mediaUrl)
                    .map((t: any) => ({
                        type: (t.mediaType?.startsWith('video') || t.mediaUrl?.match(/\.(mp4|mov|webm)$/i)) ? 'video' : 'image',
                        url: t.mediaUrl,
                        title: t.title
                    }));

                setTraining({
                    id: data.id,
                    writer: (data.coach as any)?.[0]?.name || (data.coach as any)?.name || "Unknown",
                    player: (data.user as any)?.[0]?.name || (data.user as any)?.name || "Unknown",
                    type: data.category,
                    date: ((data.created_at) ? new Date(data.created_at).toLocaleDateString('en-CA', {timeZone: 'Asia/Seoul'}) : ""),
                    time: ((data.created_at) ? new Date(data.created_at).toLocaleTimeString('en-GB', {timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit'}) : "09:00"),
                    training_start: data.training_start,
                    training_end: data.training_end,
                    title: data.title || "제목 없음",
                    content: data.content || "",
                    media: [...templateMedia, ...attachedMedia],
                    templates: templates,
                    completion_logs: data.completion_logs || [],
                    total_count: data.total_count || 0
                });

                const reviewSetting = (data.template_settings || []).find((s: any) => s.type === "review_scorecard" || s.type === "prep_scorecard");
                if (reviewSetting && reviewSetting.scorecardId) {
                    try {
                        const { calculateScorecardAnalysis } = await import("@/lib/score-calculations");
                        const analysis = await calculateScorecardAnalysis(reviewSetting.scorecardId);
                        const recentScore = await fetchScoreById(reviewSetting.scorecardId);
                        
                        const newReviewData = {
                            scorecardId: reviewSetting.scorecardId,
                            analysis,
                            completedHoles: reviewSetting.completedHoles || [],
                            recentScore,
                            categoryTimes: reviewSetting.categoryTimes || {},
                            historicalCompletedCount: reviewSetting.historicalCompletedCount || 0,
                            historicalTrainingSeconds: reviewSetting.historicalTrainingSeconds || 0
                        };
                        setReviewData(newReviewData);

                        // Fix total_count mismatch automatically
                        const isPrep = data.title?.includes("[예습]");
                        const currentCats = getTrainingCategories(isPrep, newReviewData);
                        let totalTasks = 0;
                        currentCats.forEach(cat => {
                            totalTasks += cat.holes.length;
                        });
                        
                        // Because uniqueId might have duplicates, actual maximum unique completedHoles might be less than totalTasks.
                        // Let's count how many UNIQUE uniqueIds exist in currentCats.
                        const uniqueIds = new Set();
                        currentCats.forEach(cat => {
                            cat.holes.forEach(h => {
                                uniqueIds.add(h.uniqueId || `${cat.name}_${h.holeNumber}`);
                            });
                        });
                        const realTotalTasks = uniqueIds.size;

                        if (data.total_count !== realTotalTasks && realTotalTasks > 0) {
                            const supabase = createClient();
                            await supabase.from("records").update({ total_count: realTotalTasks }).eq("id", data.id);
                            setTraining((prev: any) => prev ? { ...prev, total_count: realTotalTasks } : prev);
                        }
                    } catch (innerErr) {
                        console.error("Failed to calculate scorecard analysis:", innerErr);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch training detail:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [id]);

    const getLogs = (logs: any): string[] => {
        if (!logs) return [];
        if (Array.isArray(logs)) return logs;
        if (typeof logs === 'string') {
            try {
                const parsed = JSON.parse(logs);
                return Array.isArray(parsed) ? parsed : [];
            } catch {
                return [logs];
            }
        }
        return [];
    };

    const [isCompleting, setIsCompleting] = useState(false);

    const handleCompleteTraining = () => {
        if (!training || isCompleting) return;
        setIsUploadModalOpen(true);
    };

    const handleCompletionVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;
        setCompletionVideo(file);
        if (file) {
            setCompletionVideoPreview(URL.createObjectURL(file));
        } else {
            setCompletionVideoPreview(null);
        }
    };

    const handleUploadAndComplete = async () => {
        if (!training || !completionVideo || isUploadingVideo) return;
        
        setIsUploadingVideo(true);
        try {
            const supabase = createClient();
            
            // 1. Upload Video
            const videoUrl = await uploadFile(completionVideo, 'records', `training-completion/${id}/${Date.now()}`);
            if (!videoUrl) throw new Error("Video upload failed");

            // 2. Prepare Log
            const now = new Date().toISOString();
            const logEntry = JSON.stringify({
                timestamp: now,
                mediaUrl: videoUrl,
                mediaType: completionVideo.type
            });

            const currentLogs = getLogs(training.completion_logs);
            const newLogs = [...currentLogs, logEntry];
            
            // 3. Update DB
            const { error } = await supabase
                .from("records")
                .update({ completion_logs: newLogs })
                .eq("id", id);

            if (error) throw error;

            // 4. Update UI
            setTraining({ ...training, completion_logs: newLogs });
            setIsUploadModalOpen(false);
            setCompletionVideo(null);
            setCompletionVideoPreview(null);
            alert("훈련 완료가 영상과 함께 기록되었습니다!");
        } catch (err) {
            console.error("Failed to complete training with video:", err);
            alert("훈련 완료 처리에 실패했습니다.");
        } finally {
            setIsUploadingVideo(false);
        }
    };

    const calculateProgress = () => {
        if (!training) return 0;
        
        const isPrep = training.title?.includes("[예습]");
        if ((training.title?.includes("[복습]") || isPrep) && reviewData) {
            const currentCats = getTrainingCategories(isPrep, reviewData);
            
            let totalTasks = 0;
            let completedTasks = reviewData.historicalCompletedCount || 0;
            currentCats.forEach(cat => {
                totalTasks += cat.holes.length;
                cat.holes.forEach(h => {
                    const uid = h.uniqueId || `${cat.name}_${h.holeNumber}`;
                    const count = reviewData.completedHoles.filter((id: string) => id === uid).length;
                    completedTasks += count;
                });
            });

            const total = totalTasks || 1;
            return Math.round((completedTasks / total) * 100);
        }

        if (training.type === 'lesson_review') {
            const template = training.templates?.[0];
            const goalType = template?.goalType || 'count';
            const goalValue = template?.goalValue || 10;
            const logs = getLogs(training.completion_logs);
            
            let accumulated = 0;
            if (goalType === 'time') {
                logs.forEach((log: any) => {
                    if (log.type === 'lesson_review_session') {
                        accumulated += (log.elapsedSeconds || 0) / 60;
                    }
                });
            } else {
                logs.forEach((log: any) => {
                    if (log.type === 'lesson_review_session') {
                        accumulated += (log.count || 0);
                    }
                });
            }
            if (goalValue === 0) return 0;
            return Math.round((accumulated / goalValue) * 100);
        }

        const total = training.total_count || 7;
        const logs = getLogs(training.completion_logs);
        const completed = logs.length;
        return Math.round((completed / total) * 100);
    };

    const handleDelete = async () => {
        setIsMenuOpen(false);
        if (window.confirm("훈련 내용을 삭제하시겠습니까?")) {
            const supabase = createClient();
            const { error } = await supabase.from("records").delete().eq("id", id);
            if (error) {
                alert("삭제에 실패했습니다.");
            } else {
                alert("삭제되었습니다.");
                router.push("/training");
            }
        }
    };

    const handleEdit = () => {
        setIsMenuOpen(false);
        router.push(`/training/${id}/edit`);
    };

    const handleCommentSubmit = async (e?: React.FormEvent | React.KeyboardEvent) => {
        if (e) e.preventDefault();
        if (!newComment.trim() && !commentFile) return;

        try {
            setIsSubmittingComment(true);
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            let fileUrl = undefined;
            let fileType = undefined;

            if (commentFile) {
                const { uploadFile } = await import("@/lib/storage-sync");
                fileUrl = await uploadFile(commentFile, 'records', `comments/${id}`);
                fileType = commentFile.type;
            }

            await saveComment({
                recordId: id as string,
                userId: user.id,
                content: newComment.trim(),
                mediaUrl: fileUrl,
                mediaType: fileType
            });

            // Refresh comments
            const updatedComments = await fetchComments(id as string);
            setComments(updatedComments);

            setNewComment("");
            setCommentFile(null);
            setCommentPreviewUrl(null);
        } catch (err) {
            console.error("Failed to save comment:", err);
            alert("댓글 저장에 실패했습니다.");
        } finally {
            setIsSubmittingComment(false);
        }
    };

    const handleEditComment = async (commentId: string) => {
        if (!editingCommentText.trim() || isUpdatingComment) return;
        setIsUpdatingComment(true);
        try {
            await updateComment(commentId, editingCommentText.trim());
            setComments(comments.map(c => c.id === commentId ? { ...c, text: editingCommentText.trim() } : c));
            setEditingCommentId(null);
        } catch (err) {
            alert("댓글 수정에 실패했습니다.");
        } finally {
            setIsUpdatingComment(false);
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!confirm("이 댓글을 삭제하시겠습니까?")) return;
        try {
            await deleteComment(commentId);
            setComments(comments.filter(c => c.id !== commentId));
        } catch (err) {
            alert("댓글 삭제에 실패했습니다.");
        }
    };

    const handleResetTraining = async () => {
        if (!confirm("훈련 진행 상황을 초기화하시겠습니까? (누적 훈련 시간과 진행률은 유지됩니다)")) return;
        
        try {
            const supabase = createClient();
            
            const { data, error } = await supabase
                .from("records")
                .select("template_settings")
                .eq("id", id)
                .single();
                
            if (error) throw error;
            
            let settings = data.template_settings || [];
            let newHistoricalCount = 0;
            let newHistoricalSeconds = 0;
            
            settings = settings.map((s: any) => {
                if (s.type === "review_scorecard" || s.type === "prep_scorecard") {
                    const currentCount = s.completedHoles?.length || 0;
                    let currentSeconds = 0;
                    if (s.categoryTimes) {
                        Object.values(s.categoryTimes).forEach((t: any) => {
                            currentSeconds += (Number(t) || 0);
                        });
                    }
                    
                    newHistoricalCount = (s.historicalCompletedCount || 0) + currentCount;
                    newHistoricalSeconds = (s.historicalTrainingSeconds || 0) + currentSeconds;
                    
                    return { 
                        ...s, 
                        completedHoles: [], 
                        categoryTimes: {},
                        historicalCompletedCount: newHistoricalCount,
                        historicalTrainingSeconds: newHistoricalSeconds
                    };
                }
                return s;
            });
            
            const { error: updateError } = await supabase
                .from("records")
                .update({ template_settings: settings })
                .eq("id", id);
                
            if (updateError) throw updateError;
            
            if (reviewData) {
                setReviewData({ 
                    ...reviewData, 
                    completedHoles: [], 
                    categoryTimes: {},
                    historicalCompletedCount: newHistoricalCount,
                    historicalTrainingSeconds: newHistoricalSeconds
                });
            }
            alert("훈련 진행 상황이 초기화되었습니다.");
        } catch (err) {
            console.error("Failed to reset training:", err);
            alert("초기화에 실패했습니다.");
        }
    };

    const handleCommentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;
        setCommentFile(file);
        setCommentPreviewUrl(file ? URL.createObjectURL(file) : null);
        e.target.value = "";
    };

    const scrollCarousel = (direction: "left" | "right") => {
        if (carouselRef.current) {
            const scrollAmount = carouselRef.current.clientWidth;
            carouselRef.current.scrollBy({
                left: direction === "left" ? -scrollAmount : scrollAmount,
                behavior: "smooth"
            });
        }
    };

    if (isLoading) return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-brand-navy/20 border-t-brand-navy rounded-full animate-spin"></div>
        </div>
    );
    
    if (!training) return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
            <p className="text-zinc-500">훈련 정보를 찾을 수 없습니다.</p>
        </div>
    );

    let badge = typeBadgeConfig[training.type] || typeBadgeConfig.basic;
    if (training.title?.includes("[예습]")) {
        badge = { ...badge, label: "예습" };
    } else if (training.title?.includes("[복습]")) {
        badge = { ...badge, label: "복습" };
    }
    let derivedTitle = training.title;
    if (derivedTitle) {
        derivedTitle = derivedTitle.replace(/\[레슨 복기\]/g, '[스윙키]');
        derivedTitle = derivedTitle.replace(/\[스윙\]/g, '[스윙모션]');

        const match = derivedTitle.match(/^(\[(?:예습|복습)\])\s*(.+)/);
        if (match) {
            let prefix = match[1];
            let rest = match[2];
            rest = rest.replace(/^(?:\d{2,4}[\.\-])?\d{1,2}[\.\-]\d{1,2}(?:,\s*|\s+)/, '');
            derivedTitle = `${prefix} ${rest}`.trim();
        }
    }

    const formatTimeDisplay = (seconds?: number) => {
        if (!seconds) return "00:00";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        return h > 0 ? `${h.toString().padStart(2, '0')}:${m}:${s}` : `${m}:${s}`;
    };

    const formatTotalTimeDisplay = (seconds?: number) => {
        if (!seconds) return "00분 00초";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        
        if (h > 0) {
            return `${h.toString().padStart(2, '0')}시간 ${m}분 ${s}초`;
        }
        return `${m}분 ${s}초`;
    };

    let totalTrainingSeconds = reviewData?.historicalTrainingSeconds || 0;
    if (reviewData?.categoryTimes) {
        Object.values(reviewData.categoryTimes).forEach((t: any) => {
            totalTrainingSeconds += (Number(t) || 0);
        });
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-24">
            {/* ── 1. Header ── */}
            <header className="sticky top-0 z-40 bg-zinc-50/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
                <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => router.push('/training')} className="p-2 -ml-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-50 transition-colors">
                            <ChevronLeft size={24} />
                        </button>
                        <div className="flex items-center gap-2">
                            <Layers size={18} className="text-brand-navy dark:text-brand-navy-light shrink-0" />
                            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">훈련 상세</h1>
                        </div>
                    </div>
                    <div className="relative" ref={menuRef}>
                        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 -mr-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                            <MoreVertical size={20} />
                        </button>
                        {isMenuOpen && (
                            <div className="absolute right-0 mt-2 w-36 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg overflow-hidden z-50 animate-in fade-in zoom-in-95 origin-top-right duration-100">
                                {!(training.title?.includes("[복습]") || training.title?.includes("[예습]")) && (
                                    <button onClick={handleEdit} className="w-full text-left px-4 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2 transition-colors">
                                        <Edit2 size={16} className="text-zinc-400" /> 수정
                                    </button>
                                )}
                                <button onClick={handleDelete} className="w-full text-left px-4 py-3 text-sm font-medium text-brand-red hover:bg-brand-red/5 flex items-center gap-2 transition-colors border-t border-zinc-100 dark:border-zinc-800"
                                >
                                    <Trash2 size={16} className="text-brand-red/70" /> 삭제
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
                {/* ── 2. Core Info ── */}
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold px-3 py-1 rounded-full text-white uppercase tracking-wider ${badge.bg}`}>
                                {badge.label}
                            </span>
                            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                                <Calendar size={14} /> {training.date} {training.time}
                            </span>
                        </div>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-50 truncate" title={derivedTitle}>{derivedTitle}</h2>
                    
                    {/* Training Period */}
                    {training.training_start && training.training_end && (
                        <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 bg-zinc-50 dark:bg-zinc-800/50 w-fit px-3 py-1.5 rounded-lg border border-zinc-100 dark:border-zinc-800">
                            <span className="text-zinc-400">훈련 기간 ({Math.ceil((new Date(training.training_end).getTime() - new Date(training.training_start).getTime()) / (1000 * 60 * 60 * 24)) + 1}일):</span>
                            <span className="text-zinc-700 dark:text-zinc-300">
                                {training.training_start} ~ {training.training_end}
                            </span>
                        </div>
                    )}
                    
                    {reviewData && totalTrainingSeconds > 0 && (
                        <div className="flex items-center gap-2 text-xs font-bold text-brand-navy dark:text-brand-navy-light bg-brand-navy/5 dark:bg-brand-navy-light/10 w-fit px-3 py-1.5 rounded-lg border border-brand-navy/10 dark:border-brand-navy-light/20">
                            <span className="text-zinc-500 dark:text-zinc-400">총 훈련 시간:</span>
                            <span>{formatTimeDisplay(totalTrainingSeconds)}</span>
                        </div>
                    )}

                    <div className="flex items-center justify-end pt-4 border-t border-zinc-100 dark:border-zinc-800/50">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-brand-navy/10 flex items-center justify-center text-brand-navy dark:bg-brand-navy-light/20 dark:text-brand-navy-light">
                                <User size={16} />
                            </div>
                            <div className="text-left">
                                <p className="text-[10px] text-zinc-500">선수</p>
                                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{training.player}</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── 3. Media Gallery ── */}
                {training.media && training.media.length > 0 && (
                    <section className="relative group">
                        <div ref={carouselRef} className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-2 scrollbar-hide">
                            {training.media.map((item: any, idx: number) => (
                                <div key={idx} className="shrink-0 w-full aspect-[4/5] sm:aspect-[4/3] snap-center rounded-3xl overflow-hidden shadow-sm relative border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 py-4 sm:py-8 px-2 sm:px-4 flex items-center justify-center">
                                    {item.type === "video" ? (
                                        <CustomVideoPlayer src={item.url} className="w-full h-full" />
                                    ) : (
                                        <img src={item.url} alt={`Training Media ${idx + 1}`} className="w-full h-full object-contain rounded-2xl" />
                                    )}
                                    {training.media.length > 1 && (
                                        <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold px-3 py-1.5 rounded-full z-10">
                                            {idx + 1} / {training.media.length}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        {training.media.length > 1 && (
                            <>
                                <button onClick={() => scrollCarousel("left")} className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 dark:bg-black/60 backdrop-blur-sm hover:bg-white dark:hover:bg-black text-zinc-800 dark:text-zinc-200 rounded-full items-center justify-center shadow-lg transition-all opacity-0 group-hover:opacity-100 z-10">
                                    <ChevronLeft size={24} />
                                </button>
                                <button onClick={() => scrollCarousel("right")} className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 dark:bg-black/60 backdrop-blur-sm hover:bg-white dark:hover:bg-black text-zinc-800 dark:text-zinc-200 rounded-full items-center justify-center shadow-lg transition-all opacity-0 group-hover:opacity-100 z-10">
                                    <ChevronRight size={24} />
                                </button>
                            </>
                        )}
                    </section>
                )}

                {/* ── 4. Progress & Training Content ── */}
                <div className="space-y-6">
                    {/* ── Review Training Plan UI ── */}
                    {reviewData && (() => {
                        const isPrep = training.title?.includes("[예습]");
                        const currentCats = getTrainingCategories(isPrep, reviewData);

                        let totalTasks = 0;
                        currentCats.forEach(cat => {
                            totalTasks += cat.holes.length;
                        });

                        return (
                            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-6">
                                <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                            <BookOpen size={16} className={training.title?.includes("[예습]") ? "text-blue-500" : "text-orange-500"} />
                                            {training.title?.includes("[예습]") ? "예습 훈련 방법" : "복습 훈련 방법"}
                                        </h3>
                                        <button 
                                            onClick={handleResetTraining}
                                            className="text-xs font-bold text-zinc-500 hover:text-brand-navy transition-colors flex items-center gap-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 px-3 py-1.5 rounded-full"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                                            훈련 초기화
                                        </button>
                                    </div>
                                    <p className="text-xs text-zinc-500 font-medium leading-relaxed">
                                        {training.title?.includes("[예습]") ? (
                                            <>
                                                스코어카드에서 기록된 모든 상황을 차례대로 복기해 봅니다.<br />
                                                성공 여부와 관계 없이 각 상황별로 1번씩만 쳐보며 감각을 점검합니다.
                                            </>
                                        ) : (
                                            <>
                                                라운드 중 취약했던 상황을 복기하며 반복 훈련합니다.
                                            </>
                                        )}
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    {currentCats.map((cat, idx) => {
                                        const catName = cat.name;
                                        const focusHolesForCat = cat.holes;
                                        if (focusHolesForCat.length === 0) return null;

                                        const isExpanded = expandedReviewIdx === idx;
                                        const rankNumber = idx + 1;
                                        const uniqueFocusHoles = focusHolesForCat.filter((h: any, index: number, self: any[]) => index === self.findIndex((t) => t.holeNumber === h.holeNumber));
                                        const totalCount = uniqueFocusHoles.length;
                                        const completedCount = uniqueFocusHoles.filter((h: any) => reviewData.completedHoles.includes(h.uniqueId || `${catName}_${h.holeNumber}` as any)).length;
                                        const isAllCompleted = totalCount > 0 && completedCount === totalCount;

                                    return (
                                        <div key={catName} className={cn("border rounded-2xl overflow-hidden shadow-sm transition-colors", isAllCompleted ? "border-indigo-200 dark:border-indigo-800/50" : "border-zinc-200 dark:border-zinc-800")}>
                                            <button 
                                                onClick={() => {
                                                    if (isExpanded) {
                                                        setExpandedReviewIdx(null);
                                                    } else {
                                                        setExpandedReviewIdx(idx);
                                                        if (focusHolesForCat.length > 0) {
                                                            setSelectedFocusHole(focusHolesForCat[0].uniqueId || `${cat.name}_${focusHolesForCat[0].holeNumber}`);
                                                        } else {
                                                            setSelectedFocusHole(null);
                                                        }
                                                    }
                                                }}
                                                className={cn(
                                                    "w-full flex items-center justify-between p-4 transition-colors",
                                                    isAllCompleted
                                                        ? isExpanded 
                                                            ? "bg-indigo-100/50 dark:bg-indigo-900/30" 
                                                            : "bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100/50 dark:hover:bg-indigo-900/30"
                                                        : isExpanded 
                                                            ? "bg-orange-50 dark:bg-orange-950/20" 
                                                            : "bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className={cn(
                                                        "flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0 transition-colors",
                                                        isAllCompleted
                                                            ? "bg-indigo-200 text-indigo-700 dark:bg-indigo-500/30 dark:text-indigo-300"
                                                            : "bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400"
                                                    )}>
                                                        {rankNumber}
                                                    </span>
                                                    <span className={cn(
                                                        "text-sm font-bold transition-colors",
                                                        isAllCompleted ? "text-indigo-900 dark:text-indigo-100" : "text-zinc-900 dark:text-zinc-100"
                                                    )}>
                                                        {catName}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {reviewData?.categoryTimes?.[catName] ? (
                                                        <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full font-mono">
                                                            {formatTimeDisplay(reviewData.categoryTimes[catName])}
                                                        </span>
                                                    ) : null}
                                                    {isAllCompleted && (
                                                        <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-500/20 px-2 py-0.5 rounded-full">완료</span>
                                                    )}
                                                    <ChevronDown size={18} className={cn("transition-transform", isExpanded ? "rotate-180 text-zinc-500" : "text-zinc-400", isAllCompleted && !isExpanded ? "text-indigo-400" : "")} />
                                                </div>
                                            </button>

                                            {isExpanded && (
                                                <div className="p-4 bg-zinc-50/50 dark:bg-zinc-800/10 border-t border-zinc-200 dark:border-zinc-800 relative">
                                                    {(() => {
                                                        const sortedHoles = (catName === "그린주변샷" || catName === "아이언&피치샷")
                                                            ? [...uniqueFocusHoles]
                                                            : [...uniqueFocusHoles].sort((a, b) => Number(a.holeNumber) - Number(b.holeNumber));
                                                            
                                                        const renderHoleButton = (h: any) => {
                                                            const hKey = h.uniqueId || `${catName}_${h.holeNumber}`;
                                                            const isCompleted = reviewData.completedHoles.includes(hKey as any);
                                                            const isSelected = selectedFocusHole === hKey;
                                                            return (
                                                                <button
                                                                    key={hKey}
                                                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedFocusHole(hKey); }}
                                                                    className={cn(
                                                                        "flex flex-col items-center justify-center py-1.5 w-full shrink-0 rounded-xl border transition-all cursor-pointer shadow-sm active:scale-95 relative",
                                                                        isSelected 
                                                                            ? "bg-brand-red text-white border-brand-red shadow-md z-10" 
                                                                            : isCompleted
                                                                                ? "bg-zinc-100 text-zinc-400 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-600 opacity-70"
                                                                                : "bg-white text-zinc-600 border-zinc-200 hover:border-brand-red/50 hover:bg-brand-red/5 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700"
                                                                    )}
                                                                >
                                                                    <span className={cn("text-[10px] font-bold opacity-80 mb-0.5", isSelected ? "text-white/80" : "text-zinc-400")}>Hole</span>
                                                                    <span className="text-base font-bold leading-none">{h.holeNumber}</span>
                                                                    {isCompleted && !isSelected && (
                                                                        <Check size={12} strokeWidth={4} className="absolute -top-1 -right-1 text-brand-navy dark:text-brand-navy-light" />
                                                                    )}
                                                                </button>
                                                            );
                                                        };

                                                        // Select the current hole data based on selectedFocusHole, default to first hole
                                                        const selectedHoleData = sortedHoles.find(h => (h.uniqueId || `${catName}_${h.holeNumber}`) === selectedFocusHole) || sortedHoles[0];
                                                        const isSelectedHoleCompleted = selectedHoleData && reviewData.completedHoles.includes((selectedHoleData.uniqueId || `${catName}_${selectedHoleData.holeNumber}`) as any);

                                                        return (
                                                            <div onClick={(e) => e.stopPropagation()}>
                                                                <div className="mb-5">
                                                                    <div className="text-[11px] font-bold text-brand-red mb-3">집중 관리 홀</div>
                                                                    <div className="grid grid-cols-5 gap-1.5 sm:gap-2 w-full">
                                                                        {sortedHoles.map(renderHoleButton)}
                                                                    </div>
                                                                </div>

                                                                {selectedHoleData && (() => {
                                                                    const currentIndex = sortedHoles.findIndex((h: any) => (h.uniqueId || `${catName}_${h.holeNumber}`) === (selectedHoleData.uniqueId || `${catName}_${selectedHoleData.holeNumber}`));
                                                                    const hasPrev = currentIndex > 0;
                                                                    const hasNext = currentIndex >= 0 && currentIndex < sortedHoles.length - 1;
                                                                    
                                                                    const handlePrev = (e?: React.MouseEvent) => {
                                                                        e?.stopPropagation();
                                                                        if (hasPrev) setSelectedFocusHole(sortedHoles[currentIndex - 1].uniqueId || `${catName}_${sortedHoles[currentIndex - 1].holeNumber}`);
                                                                    };
                                                                    
                                                                    const handleNext = (e?: React.MouseEvent) => {
                                                                        e?.stopPropagation();
                                                                        if (hasNext) setSelectedFocusHole(sortedHoles[currentIndex + 1].uniqueId || `${catName}_${sortedHoles[currentIndex + 1].holeNumber}`);
                                                                    };

                                                                    let touchStartX = 0;
                                                                    let touchEndX = 0;

                                                                    return (
                                                                        <div className="relative group">
                                                                            {hasPrev && (
                                                                                <button 
                                                                                    onClick={handlePrev} 
                                                                                    className="hidden sm:flex absolute -left-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-full items-center justify-center shadow-md transition-all opacity-0 group-hover:opacity-100 z-10 hover:scale-105"
                                                                                >
                                                                                    <ChevronLeft size={20} />
                                                                                </button>
                                                                            )}
                                                                            {hasNext && (
                                                                                <button 
                                                                                    onClick={handleNext} 
                                                                                    className="hidden sm:flex absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-full items-center justify-center shadow-md transition-all opacity-0 group-hover:opacity-100 z-10 hover:scale-105"
                                                                                >
                                                                                    <ChevronRight size={20} />
                                                                                </button>
                                                                            )}
                                                                            <div 
                                                                                className="bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/30 rounded-2xl shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                                                                                onTouchStart={e => { touchStartX = e.changedTouches[0].screenX; }}
                                                                                onTouchEnd={e => { 
                                                                                    touchEndX = e.changedTouches[0].screenX;
                                                                                    if (touchStartX - touchEndX > 50) handleNext();
                                                                                    if (touchEndX - touchStartX > 50) handlePrev();
                                                                                }}
                                                                            >
                                                                                {/* Card Header */}
                                                                        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100 dark:border-zinc-800/50 bg-white dark:bg-zinc-900">
                                                                            <div className="flex items-center gap-2">
                                                                                <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                                                                                    {selectedHoleData.holeNumber}번 홀 분석
                                                                                </h4>
                                                                                <span className="text-[11px] font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                                                                    PAR {selectedHoleData.hData ? selectedHoleData.hData.par : (selectedHoleData.par || 4)}
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex items-center gap-3">
                                                                                {isSelectedHoleCompleted && (
                                                                                    <span className="text-[11px] font-bold text-indigo-500 flex items-center gap-1 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-md">
                                                                                        <CheckCircle2 size={12} /> 완료됨
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        
                                                                        {/* Card Body */}
                                                                        <div className="p-4 sm:p-5">
                                                                            <div className="bg-zinc-50/80 dark:bg-zinc-800/30 rounded-xl p-4 space-y-4 border border-zinc-100 dark:border-zinc-800/50 overflow-hidden">
                                                                                <div className="flex items-center">
                                                                                    <div className="w-1 h-3.5 bg-zinc-300 dark:bg-zinc-600 rounded-full mr-3 shrink-0"></div>
                                                                                    <span className="text-sm font-medium text-zinc-500 w-10 shrink-0">시도</span>
                                                                                    <span className="text-[13px] sm:text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate flex-1" title={selectedHoleData.worstShotInfo?.attempt || "-"}>{selectedHoleData.worstShotInfo?.attempt || "-"}</span>
                                                                                </div>
                                                                                <div className="flex items-center">
                                                                                    <div className="w-1 h-3.5 bg-orange-400 rounded-full mr-3 shrink-0"></div>
                                                                                    <span className="text-sm font-medium text-zinc-500 w-10 shrink-0">결과</span>
                                                                                    <span className="text-[13px] sm:text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate flex-1" title={selectedHoleData.worstShotInfo?.result === "오비" ? "OB" : (selectedHoleData.worstShotInfo?.result || "-")}>{selectedHoleData.worstShotInfo?.result === "오비" ? "OB" : (selectedHoleData.worstShotInfo?.result || "-")}</span>
                                                                                </div>
                                                                                {selectedHoleData.worstShotInfo?.score != null && (
                                                                                    <div className="flex items-center pt-4 border-t border-zinc-200/50 dark:border-zinc-700/50">
                                                                                        <div className="w-1 h-3.5 bg-blue-500 rounded-full mr-3 shrink-0"></div>
                                                                                        <span className="text-sm font-medium text-zinc-500 w-10 shrink-0">점수</span>
                                                                                        <span className="text-[13px] sm:text-sm font-medium text-blue-500 truncate flex-1">{selectedHoleData.worstShotInfo.score > 0 ? `+${selectedHoleData.worstShotInfo.score.toFixed(1)}` : selectedHoleData.worstShotInfo.score.toFixed(1)}</span>
                                                                                    </div>
                                                                                )}
                                                                                {selectedHoleData.worstShotInfo?.note && (
                                                                                    <div className="flex items-start pt-4 border-t border-zinc-200/50 dark:border-zinc-700/50">
                                                                                        <div className="w-1 h-3.5 bg-emerald-500 rounded-full mr-3 shrink-0 mt-0.5"></div>
                                                                                        <span className="text-sm font-medium text-zinc-500 w-10 shrink-0">노트</span>
                                                                                        <span className="text-[13px] sm:text-sm font-medium text-zinc-900 dark:text-zinc-100 flex-1 whitespace-pre-wrap">{selectedHoleData.worstShotInfo.note}</span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            
                                                                            {/* Actions */}
                                                                            <div className="mt-5 flex justify-end">
                                                                                <button 
                                                                                    onClick={(e) => {
                                                                                        e.preventDefault();
                                                                                        e.stopPropagation();
                                                                                        const uniqueKey = selectedHoleData.uniqueId || `${catName}_${selectedHoleData.holeNumber}`;
                                                                                        const clickedIndex = focusHolesForCat.findIndex((fh: any) => (fh.uniqueId || `${catName}_${fh.holeNumber}`) === uniqueKey);
                                                                                        const subsequentHoles = focusHolesForCat.slice(clickedIndex >= 0 ? clickedIndex : 0);
                                                                                        const previousHoles = focusHolesForCat.slice(0, clickedIndex >= 0 ? clickedIndex : 0);
                                                                                        
                                                                                        const executeTraining = async (isRetrain: boolean) => {
                                                                                            let targetHoles: any[] = [];
                                                                                            if (isRetrain) {
                                                                                                targetHoles = [...subsequentHoles, ...previousHoles];
                                                                                            } else {
                                                                                                targetHoles = subsequentHoles.filter((fh: any) => 
                                                                                                    !reviewData.completedHoles.includes(fh.uniqueId || `${catName}_${fh.holeNumber}` as any)
                                                                                                );
                                                                                            }
                                                                                            
                                                                                            const catIndex = currentCats.findIndex((c: any) => c.name === catName);
                                                                                            let subsequentCats = isRetrain ? [currentCats[catIndex]] : [];
                                                                                            if (!isRetrain) {
                                                                                                if (catName === "퍼팅" || catName === "그린주변샷") {
                                                                                                    subsequentCats = [currentCats[catIndex]];
                                                                                                } else if (catName === "아이언&피치샷") {
                                                                                                    subsequentCats = currentCats.slice(catIndex >= 0 ? catIndex : 0).filter((c: any) => c.name === "아이언&피치샷" || c.name === "티샷");
                                                                                                } else {
                                                                                                    subsequentCats = currentCats.slice(catIndex >= 0 ? catIndex : 0);
                                                                                                }
                                                                                            }
                                                                                            
                                                                                            const trainingChain = subsequentCats.map((c: any) => {
                                                                                                let rawHoles = [];
                                                                                                if (c.name === catName) {
                                                                                                    rawHoles = targetHoles;
                                                                                                } else {
                                                                                                    rawHoles = c.holes.filter((ch: any) => 
                                                                                                        !reviewData.completedHoles.includes(ch.uniqueId || `${c.name}_${ch.holeNumber}`)
                                                                                                    );
                                                                                                }
                                                                                                
                                                                                                const cHoles = rawHoles.map((ch: any) => ({
                                                                                                    hole: ch.holeNumber,
                                                                                                    uniqueId: ch.uniqueId || `${c.name}_${ch.holeNumber}`,
                                                                                                    par: ch.hData ? ch.hData.par : (ch.par || 4),
                                                                                                    attempt: ch.worstShotInfo?.attempt || "-",
                                                                                                    result: ch.worstShotInfo?.result || "-",
                                                                                                    score: ch.worstShotInfo?.score?.toFixed(1) || "-",
                                                                                                    note: ch.worstShotInfo?.note || "",
                                                                                                    putts: ch.hData?.summary?.putts || 0,
                                                                                                    shotNumber: ch.worstShotInfo?.shotNumber || 0
                                                                                                }));

                                                                                                return {
                                                                                                    catName: c.name,
                                                                                                    encodedHoles: encodeURIComponent(JSON.stringify(cHoles)),
                                                                                                    holeCount: cHoles.length
                                                                                                };
                                                                                            }).filter((c: any) => c.holeCount > 0);

                                                                                            targetHoles = targetHoles.map((fh: any) => ({
                                                                                                hole: fh.holeNumber,
                                                                                                uniqueId: fh.uniqueId || `${catName}_${fh.holeNumber}`,
                                                                                                par: fh.hData ? fh.hData.par : (fh.par || 4),
                                                                                                attempt: fh.worstShotInfo?.attempt || "-",
                                                                                                result: fh.worstShotInfo?.result || "-",
                                                                                                score: fh.worstShotInfo?.score?.toFixed(1) || "-",
                                                                                                note: fh.worstShotInfo?.note || "",
                                                                                                putts: fh.hData?.summary?.putts || 0,
                                                                                                shotNumber: fh.worstShotInfo?.shotNumber || 0
                                                                                            }));
                                                                                            sessionStorage.setItem('trainingChain', JSON.stringify(trainingChain));
                                                                                            
                                                                                            const encodedHoles = encodeURIComponent(JSON.stringify(targetHoles));
                                                                                            sessionStorage.setItem('lastTrainingCat', catName);
                                                                                            router.push(`/training/voice-guide?type=review_category&cat=${encodeURIComponent(catName)}&holes=${encodedHoles}&recordId=${id}&isPrep=${isPrep}`);
                                                                                        };
                                                                                        
                                                                                        setConfirmDialog({
                                                                                            isOpen: true,
                                                                                            message: isSelectedHoleCompleted ? `${selectedHoleData.holeNumber}홀 재훈련을 하시겠습니까?` : `${selectedHoleData.holeNumber}홀부터 훈련을 시작하시겠습니까?`,
                                                                                            onConfirm: () => {
                                                                                                setConfirmDialog(null);
                                                                                                executeTraining(isSelectedHoleCompleted);
                                                                                            }
                                                                                        });
                                                                                    }}
                                                                                    className="bg-brand-red hover:bg-brand-red-dark text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-sm active:scale-95 transition-all flex items-center gap-1.5"
                                                                                >
                                                                                    <Play size={16} className="fill-current" />
                                                                                    {isSelectedHoleCompleted ? "재훈련 시작" : "훈련 시작"}
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    );
                })()}

                
                    {/* Progress Bar */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-3">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                <CheckCircle2 size={16} className="text-brand-navy" />
                                훈련 진행률
                            </h3>
                            {!training.title?.includes("[복습]") && !training.title?.includes("[예습]") && (
                                <span className="text-[11px] text-zinc-400 font-medium">
                                    {training.type === 'lesson_review' 
                                        ? (() => {
                                            const template = training.templates?.[0];
                                            const goalType = template?.goalType || 'count';
                                            const goalValue = template?.goalValue || 10;
                                            const logs = getLogs(training.completion_logs);
                                            let acc = 0;
                                            logs.forEach((log: any) => {
                                                if (log.type === 'lesson_review_session') {
                                                    acc += goalType === 'time' ? (log.elapsedSeconds || 0) : (log.count || 0);
                                                }
                                            });
                                            if (goalType === 'time') {
                                                const totalSecs = Math.floor(acc);
                                                const hours = Math.floor(totalSecs / 3600);
                                                const mins = Math.floor((totalSecs % 3600) / 60);
                                                const secs = totalSecs % 60;
                                                const timeParts = [];
                                                if (hours > 0) timeParts.push(`${hours}시간`);
                                                if (mins > 0) timeParts.push(`${mins}분`);
                                                if (secs > 0 || timeParts.length === 0) timeParts.push(`${secs}초`);
                                                const timeString = timeParts.length > 0 ? timeParts.join(" ") : "0초";
                                                
                                                const totalGoalMins = goalValue;
                                                const goalHours = Math.floor(totalGoalMins / 60);
                                                const goalMins = totalGoalMins % 60;
                                                const goalParts = [];
                                                if (goalHours > 0) goalParts.push(`${goalHours}시간`);
                                                if (goalMins > 0 || goalParts.length === 0) goalParts.push(`${goalMins}분`);
                                                const goalString = goalParts.join(" ");
                                                
                                                return `${timeString} 누적 / 총 ${goalString} 기준`;
                                            }
                                            return `${acc}회 누적 / 총 ${goalValue}회 기준`;
                                        })()
                                        : `${training.completion_logs?.length || 0}회 완료 / 총 ${training.total_count || 0}회 기준`
                                    }
                                </span>
                            )}
                        </div>
                        <div className="w-full h-12 bg-zinc-100 dark:bg-zinc-800 rounded-2xl overflow-hidden relative shadow-inner border border-zinc-200 dark:border-zinc-700">
                            <div 
                                className={cn(
                                    "h-full transition-all duration-500 ease-out flex items-center justify-center shadow-lg",
                                    calculateProgress() > 100 ? "bg-gradient-to-r from-brand-navy to-red-500" : "bg-brand-navy"
                                )} 
                                style={{ width: `${Math.min(calculateProgress(), 100)}%` }}
                            >
                                {calculateProgress() >= 15 && (
                                    <span className="text-sm font-black text-white drop-shadow-sm">
                                        {calculateProgress()}%
                                        {calculateProgress() > 100 && " 🔥"}
                                    </span>
                                )}
                            </div>
                            {calculateProgress() < 15 && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <span className="text-sm font-black text-brand-navy">{calculateProgress()}%</span>
                                </div>
                            )}
                        </div>

                        {reviewData && (
                            <div className="pt-2">
                                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-3">
                                    <CheckCircle2 size={16} className="text-brand-navy" />
                                    훈련 총 누적시간
                                </h3>
                                {(() => {
                                    const currentCats = getTrainingCategories(training.title?.includes("[예습]"), reviewData);
                                    const totalTasks = currentCats.reduce((sum, cat) => sum + cat.holes.length, 0) || 1;
                                    const targetSeconds = totalTasks * 3 * 60;
                                    const timeProgress = Math.round((totalTrainingSeconds / targetSeconds) * 100);

                                    return (
                                        <div className="w-full h-12 bg-zinc-100 dark:bg-zinc-800 rounded-2xl overflow-hidden relative shadow-inner border border-zinc-200 dark:border-zinc-700">
                                            <div 
                                                className={cn(
                                                    "h-full transition-all duration-500 ease-out flex items-center justify-center shadow-lg",
                                                    timeProgress > 100 ? "bg-gradient-to-r from-brand-navy to-red-500" : "bg-brand-navy"
                                                )} 
                                                style={{ width: `${Math.min(timeProgress, 100)}%` }}
                                            >
                                                {timeProgress >= 30 && (
                                                    <span className="text-sm font-black text-white drop-shadow-sm whitespace-nowrap">
                                                        {formatTotalTimeDisplay(totalTrainingSeconds)}
                                                        {timeProgress > 100 && " 🔥"}
                                                    </span>
                                                )}
                                            </div>
                                            {timeProgress < 30 && (
                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                    <span className="text-sm font-black text-brand-navy whitespace-nowrap">{formatTotalTimeDisplay(totalTrainingSeconds)}</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {training.type === 'lesson_review' && (
                            <div className="w-full h-12 px-5 rounded-xl font-bold text-xs bg-zinc-100 dark:bg-zinc-800 text-brand-navy dark:text-blue-400 flex items-center justify-center gap-6 shadow-sm border border-zinc-200 dark:border-zinc-700 mt-4">
                                {(() => {
                                    const template = training.templates?.[0];
                                    const goalType = template?.goalType || 'count';
                                    const goalValue = template?.goalValue || 10;
                                    const logs = getLogs(training.completion_logs);
                                    let acc = 0;
                                    logs.forEach((log: any) => {
                                        if (log.type === 'lesson_review_session') {
                                            acc += goalType === 'time' ? (log.elapsedSeconds || 0) : (log.count || 0);
                                        }
                                    });
                                    
                                    if (goalType === 'time') {
                                        const totalSecs = Math.floor(acc);
                                        const hours = Math.floor(totalSecs / 3600);
                                        const mins = Math.floor((totalSecs % 3600) / 60);
                                        const secs = totalSecs % 60;
                                        const timeParts = [];
                                        if (hours > 0) timeParts.push(`${hours}시간`);
                                        if (mins > 0) timeParts.push(`${mins}분`);
                                        if (secs > 0 || timeParts.length === 0) timeParts.push(`${secs}초`);
                                        const timeString = timeParts.length > 0 ? timeParts.join(" ") : "0초";
                                        
                                        const goalHours = Math.floor(goalValue / 60);
                                        const goalMins = goalValue % 60;
                                        const goalParts = [];
                                        if (goalHours > 0) goalParts.push(`${goalHours}시간`);
                                        if (goalMins > 0 || goalParts.length === 0) goalParts.push(`${goalMins}분`);
                                        const goalString = goalParts.join(" ");
                                        
                                        return (
                                            <>
                                                <span className="text-zinc-500 font-semibold dark:text-zinc-400">누적 훈련 시간</span>
                                                <span className="text-sm font-black tracking-tight">{timeString}</span>
                                                <span className="text-zinc-400 font-medium">(목표: {goalString})</span>
                                            </>
                                        );
                                    }
                                    return (
                                        <>
                                            <span className="text-zinc-500 font-semibold dark:text-zinc-400">누적 훈련 횟수</span>
                                            <span className="text-sm font-black tracking-tight">{acc || 0}회</span>
                                            <span className="text-zinc-400 font-medium">(목표: {goalValue || 0}회)</span>
                                        </>
                                    );
                                })()}
                            </div>
                        )}

                        {!training.title?.includes("[복습]") && !training.title?.includes("[예습]") && (
                            <button 
                                onClick={() => {
                                    if (training.type === 'lesson_review' && training.templates?.[0]) {
                                        const method = training.templates[0].trainingMethod;
                                        if (method === 'camera') {
                                            router.push(`/training/swing-test?recordId=${training.id}&type=lesson_review`);
                                        } else {
                                            router.push(`/training/voice-guide?recordId=${training.id}&type=lesson_review`);
                                        }
                                    } else if (training.type === 'swing_pose') {
                                        router.push(`/training/swing-pose?recordId=${training.id}`);
                                    } else {
                                        handleCompleteTraining();
                                    }
                                }}
                                disabled={isUploadingVideo}
                                className={cn(
                                    "w-full h-12 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95 mt-2",
                                    isUploadingVideo 
                                        ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
                                        : "bg-brand-red hover:bg-brand-red-dark text-white shadow-brand-red/20"
                                )}
                            >
                                <CheckCircle2 size={18} />
                                <span>
                                    {training.type === 'lesson_review' || training.type === 'swing_pose'
                                        ? (() => {
                                            const template = training.templates?.[0];
                                            const goalType = template?.goalType || 'count';
                                            const goalValue = template?.goalValue || 10;
                                            const logs = getLogs(training.completion_logs);
                                            let acc = 0;
                                            logs.forEach((log: any) => {
                                                if (log.type === 'lesson_review_session' || log.type === 'swing_pose_session') {
                                                    acc += goalType === 'time' ? (log.elapsedSeconds || 0) : (log.count || 0);
                                                }
                                            });
                                            if (goalType === 'time') {
                                                return `훈련 진행`;
                                            }
                                            return `훈련 진행`;
                                        })()
                                        : `훈련 진행`
                                    }
                                </span>
                            </button>
                        )}
                    </section>

                    {/* ── 4-1. Training History (List Style) ── */}
                    {training.type !== 'lesson_review' && training.completion_logs && training.completion_logs.length > 0 && (
                        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-4">
                            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                    <Play size={16} className="text-brand-navy" />
                                    훈련 히스토리
                                </h3>
                                <span className="text-[10px] text-zinc-400 font-medium">최신순</span>
                            </div>

                            <div className="space-y-3">
                                {(() => {
                                    const reversedLogs = [...training.completion_logs].reverse();
                                    const displayedLogs = showAllHistory ? reversedLogs : reversedLogs.slice(0, 3);
                                    
                                    return displayedLogs.map((log: string, idx: number) => {
                                        // Since it's reversed, we need to calculate the original index for labeling
                                        const originalIndex = training.completion_logs.length - 1 - idx;
                                        let timestamp, mediaUrl, mediaType;
                                        try {
                                            const data = JSON.parse(log);
                                            timestamp = data.timestamp;
                                            mediaUrl = data.mediaUrl;
                                            mediaType = data.mediaType;
                                        } catch {
                                            timestamp = log;
                                        }

                                        const date = new Date(timestamp);
                                        const mm = (date.getMonth() + 1).toString().padStart(2, '0');
                                        const dd = date.getDate().toString().padStart(2, '0');
                                        const isExpanded = expandedSessionIndex === originalIndex;
                                        
                                        return (
                                            <div key={originalIndex} className="group">
                                                <div 
                                                    onClick={() => setExpandedSessionIndex(isExpanded ? null : originalIndex)}
                                                    className={cn(
                                                        "flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all",
                                                        isExpanded 
                                                            ? "bg-brand-navy text-white shadow-md shadow-brand-navy/20" 
                                                            : "bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <span className={cn(
                                                            "text-xs font-bold",
                                                            isExpanded ? "text-white" : "text-zinc-900 dark:text-zinc-100"
                                                        )}>
                                                            {originalIndex + 1}회차:
                                                        </span>
                                                        <span className={cn(
                                                            "text-[11px] font-medium",
                                                            isExpanded ? "text-white/80" : "text-zinc-500"
                                                        )}>
                                                            {mm}.{dd}
                                                        </span>
                                                    </div>
                                                    <button className={cn(
                                                        "text-[10px] font-bold flex items-center gap-1 px-3 py-1.5 rounded-full transition-all",
                                                        isExpanded 
                                                            ? "bg-white/20 text-white" 
                                                            : "bg-white dark:bg-zinc-900 text-brand-navy border border-zinc-200 dark:border-zinc-700"
                                                    )}>
                                                        훈련 영상보기
                                                        <ChevronRight size={12} className={cn("transition-transform", isExpanded && "rotate-90")} />
                                                    </button>
                                                </div>

                                                {/* Expandable Video Area */}
                                                {isExpanded && (
                                                    <div className="mt-3 animate-in slide-in-from-top-2 duration-300">
                                                        <div className="relative aspect-video rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-black shadow-inner">
                                                            {mediaUrl ? (
                                                                mediaType?.startsWith('video') ? (
                                                                    <video 
                                                                        src={mediaUrl} 
                                                                        controls 
                                                                        autoPlay
                                                                        playsInline 
                                                                        className="w-full h-full object-contain" 
                                                                    />
                                                                ) : (
                                                                    <img src={mediaUrl} alt="Log" className="w-full h-full object-contain" />
                                                                )
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-400">
                                                                    <AlertCircle size={24} />
                                                                    <span className="text-xs ml-2">영상을 불러올 수 없습니다.</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    });
                                })()}

                                {training.completion_logs.length > 3 && !showAllHistory && (
                                    <button 
                                        onClick={() => setShowAllHistory(true)}
                                        className="w-full py-3 text-xs font-bold text-zinc-400 hover:text-brand-navy transition-colors flex items-center justify-center gap-1.5 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl mt-2"
                                    >
                                        <span>이전 히스토리 더보기</span>
                                        <ChevronDown size={14} />
                                    </button>
                                )}
                            </div>
                        </section>
                    )}

                    {training.type === 'lesson_review' ? (
                        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-6">
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                    <Calendar size={14} className="text-zinc-400" />
                                    훈련 기간
                                </h3>
                                <div className="prose prose-zinc dark:prose-invert max-w-none text-zinc-700 dark:text-zinc-300 whitespace-pre-line leading-relaxed text-sm bg-zinc-50 dark:bg-zinc-800/30 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                                    {training.training_start} ~ {training.training_end}
                                </div>
                            </div>
                            
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                    <Target size={14} className="text-zinc-400" />
                                    훈련 목표
                                </h3>
                                <div className="prose prose-zinc dark:prose-invert max-w-none text-zinc-700 dark:text-zinc-300 whitespace-pre-line leading-relaxed text-sm bg-zinc-50 dark:bg-zinc-800/30 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                                    {training.templates?.[0]?.goalType === 'count' ? `${training.templates[0].goalValue}회` : `${training.templates?.[0]?.goalValue || 0}분`}
                                </div>
                            </div>



                            {training.templates?.[0]?.comments?.length > 0 && (
                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                        <BookOpen size={14} className="text-zinc-400" />
                                        코치 코멘트 및 상세 내용
                                    </h3>
                                    <div className="prose prose-zinc dark:prose-invert max-w-none text-zinc-700 dark:text-zinc-300 whitespace-pre-line leading-relaxed text-sm bg-zinc-50 dark:bg-zinc-800/30 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                                        {training.templates[0].comments.filter(Boolean).map((c: string) => c.replace(/\n+/g, (match) => `\n(${match.length}초)\n`)).join('\n\n')}
                                    </div>
                                </div>
                            )}
                        </section>
                    ) : (
                        !training.title?.includes("[복습]") && !training.title?.includes("[예습]") && (
                            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-6">
                                <div className="border-b border-zinc-100 dark:border-zinc-800/50 pb-4">
                                    <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-4">훈련 정보</h3>
                                    <div className="grid grid-cols-1 gap-4">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-tight">훈련명</span>
                                            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{derivedTitle}</p>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-tight">훈련 기간</span>
                                            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                                {training.training_start} ~ {training.training_end}
                                            </p>
                                        </div>
                                        
                                        {training.templates && training.templates.length > 0 ? (
                                            <>
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-tight">훈련 목적</span>
                                                    <div className="space-y-1">
                                                        {training.templates.map((t: any) => t.purpose).filter(Boolean).map((p: string, i: number) => (
                                                            <p key={i} className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">• {p}</p>
                                                        )) || <p className="text-sm text-zinc-400">등록된 목적이 없습니다.</p>}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-tight">훈련 목표</span>
                                                    <div className="space-y-1">
                                                        {training.templates.map((t: any) => t.goal).filter(Boolean).map((g: string, i: number) => (
                                                            <p key={i} className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">• {g}</p>
                                                        )) || <p className="text-sm text-zinc-400">등록된 목표가 없습니다.</p>}
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700">
                                                <p className="text-xs text-zinc-500 text-center">연결된 훈련 컨텐츠 정보가 없습니다.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {training.content && (
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                            <BookOpen size={14} className="text-zinc-400" />
                                            코치 코멘트 및 상세 내용
                                        </h3>
                                        <div className="prose prose-zinc dark:prose-invert max-w-none text-zinc-700 dark:text-zinc-300 whitespace-pre-line leading-relaxed text-sm bg-zinc-50 dark:bg-zinc-800/30 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                                            {training.content.replace(/\n+/g, (match: string) => `\n(${match.length}초)\n`)}
                                        </div>
                                    </div>
                                )}
                            </section>
                        )
                    )}
                </div>

                {reviewData?.recentScore && (
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm flex flex-col mb-8">
                        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                            <Trophy size={18} className="text-amber-500" />
                            최근 라운드 요약 <span className="text-[11px] font-normal text-zinc-400">({training.player})</span>
                        </h3>
                        
                        <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-[1.5rem] p-5 border border-zinc-100 dark:border-zinc-800 space-y-5 flex-1">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{reviewData.recentScore.courseName}</p>
                                    <p className="text-[11px] text-zinc-400 font-medium">{reviewData.recentScore.title}</p>
                                    <div className="flex items-center gap-1.5 mt-1.5 px-2 py-0.5 w-fit rounded bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold text-zinc-500">
                                        <Calendar size={10} />
                                        {reviewData.recentScore.date.replace(/-/g, ".")}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={cn(
                                        "text-2xl font-black tracking-tighter leading-none",
                                        reviewData.recentScore.score < (reviewData.recentScore.totalPar || 72) ? "text-red-500" : reviewData.recentScore.score > (reviewData.recentScore.totalPar || 72) ? "text-blue-500" : "text-zinc-900 dark:text-zinc-100"
                                    )}>
                                        {reviewData.recentScore.score}타
                                    </div>
                                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mt-1">Final Score</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-2">
                                {[
                                    { label: "티샷", val: reviewData.recentScore.teeShotSG },
                                    { label: "세컨샷", val: reviewData.recentScore.secondShotSG },
                                    { label: "그린주변", val: reviewData.recentScore.aroundGreenSG },
                                    { label: "퍼팅", val: reviewData.recentScore.puttingSG }
                                ].map((item, i) => (
                                    <div key={i} className="bg-white dark:bg-zinc-900/50 p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800/60 text-center">
                                        <p className="text-[10px] font-bold text-zinc-400 mb-1">{item.label}</p>
                                        <p className={cn(
                                            "text-[13px] font-black tracking-tight",
                                            item.val < 0 ? "text-red-500" : item.val > 0 ? "text-blue-500" : "text-zinc-600 dark:text-zinc-400"
                                        )}>
                                            {item.val > 0 ? `+${item.val.toFixed(2)}` : item.val.toFixed(2)}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            <div className="flex flex-col gap-4 pt-1">
                                <div className="w-full space-y-2">
                                    <div className="flex items-center gap-1.5">
                                        <Trophy size={14} className="text-amber-500" />
                                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight">Strong</span>
                                    </div>
                                    <div className="px-3 py-2 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-[11px] font-black text-red-600 dark:text-red-400 text-center">
                                        {reviewData.recentScore.strongPoint}
                                    </div>
                                </div>

                                <div className="w-full space-y-2">
                                    <div className="flex items-center gap-1.5">
                                        <AlertTriangle size={14} className="text-blue-500" />
                                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight">Weak</span>
                                    </div>
                                    <div className="flex gap-2">
                                        {reviewData.recentScore.weakPoints.map((wp, idx) => (
                                            <div key={idx} className="flex-1 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 text-[11px] font-black text-blue-600 dark:text-blue-400 text-center">
                                                {wp}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="pt-2 flex justify-end">
                                <button 
                                    type="button"
                                    onClick={() => router.push(`/scores/${reviewData.scorecardId}`)}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-navy text-white text-[11px] font-bold hover:bg-brand-navy/90 transition-all shadow-md shadow-brand-navy/10 active:scale-95"
                                >
                                    상세 분석
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    </section>
                )}



                {/* ── 5. Feedback Section (Identical to Lesson) ── */}
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden mb-8">
                    <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                        <MessageSquare size={14} className="text-zinc-400" />
                        <h3 className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">댓글 {comments.length}건</h3>
                    </div>

                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {comments.map(c => (
                            <div key={c.id} className="px-5 py-4 space-y-1 group">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{c.author}</span>
                                        {currentUser?.id === c.userId && (
                                            <div className="hidden group-hover:flex items-center gap-1">
                                                <button onClick={() => { setEditingCommentId(c.id); setEditingCommentText(c.text); }} className="p-1 text-zinc-400 hover:text-brand-navy"><Edit2 size={12} /></button>
                                                <button onClick={() => handleDeleteComment(c.id)} className="p-1 text-zinc-400 hover:text-brand-red"><Trash2 size={12} /></button>
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-[11px] text-zinc-400 font-medium">{c.time}</span>
                                </div>
                                {editingCommentId === c.id ? (
                                    <div className="mt-2 space-y-2">
                                        <textarea
                                            rows={2}
                                            value={editingCommentText}
                                            onChange={(e) => setEditingCommentText(e.target.value)}
                                            className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all resize-none"
                                        />
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => setEditingCommentId(null)} className="px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">취소</button>
                                            <button onClick={() => handleEditComment(c.id)} disabled={isUpdatingComment} className="px-3 py-1.5 text-xs bg-brand-navy text-white rounded-lg hover:bg-brand-navy/90 transition-colors disabled:opacity-50">저장</button>
                                        </div>
                                    </div>
                                ) : (
                                    c.text && <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{c.text}</p>
                                )}
                                {c.fileUrl && c.fileType?.startsWith("image/") && (
                                    <img src={c.fileUrl} className="mt-2 rounded-xl max-h-60 w-auto object-cover border border-zinc-200 dark:border-zinc-700" alt="첨부" />
                                )}
                                {c.fileUrl && c.fileType?.startsWith("video/") && (
                                    <video src={c.fileUrl} controls className="mt-2 rounded-xl max-h-60 w-full border border-zinc-200 dark:border-zinc-700" />
                                )}
                            </div>
                        ))}
                        {comments.length === 0 && (
                            <p className="text-sm text-zinc-400 text-center py-6">아직 댓글이 없습니다.</p>
                        )}
                    </div>

                    <div className="border-t border-zinc-100 dark:border-zinc-800 px-4 py-3 space-y-2">
                        <textarea
                            rows={2}
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleCommentSubmit();
                                }
                            }}
                            placeholder="메시지를 입력하세요..."
                            className="w-full px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all resize-none"
                        />
                        <div className="flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => commentFileRef.current?.click()}
                                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:text-brand-navy transition-colors"
                            >
                                <Paperclip size={14} />
                                {commentFile ? commentFile.name : "파일 첨부"}
                            </button>
                            <input ref={commentFileRef} type="file" className="hidden" onChange={handleCommentFileChange} />
                            <button
                                onClick={() => handleCommentSubmit()}
                                disabled={isSubmittingComment || (!newComment.trim() && !commentFile)}
                                className="px-4 py-1.5 bg-brand-navy text-white text-xs font-bold rounded-xl hover:bg-brand-navy/90 transition-all disabled:opacity-50"
                            >
                                전송
                            </button>
                        </div>
                    </div>
                </section>
            </main>

            {/* ── Completion Video Modal ── */}
            {isUploadModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-bottom-4 duration-300">
                        <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50">
                            <div>
                                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">훈련 완료 인증</h3>
                                <p className="text-xs text-zinc-500 mt-0.5">{training.completion_logs?.length + 1}회차 영상을 업로드해주세요.</p>
                            </div>
                            <button 
                                onClick={() => {
                                    setIsUploadModalOpen(false);
                                    setCompletionVideo(null);
                                    setCompletionVideoPreview(null);
                                }}
                                className="p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-6">
                            <div className="space-y-4">
                                {completionVideoPreview ? (
                                    <div className="relative w-full aspect-[4/5] sm:aspect-[4/3] rounded-3xl overflow-hidden shadow-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 py-4 sm:py-8 px-2 sm:px-4 flex items-center justify-center group">
                                        <CustomVideoPlayer src={completionVideoPreview} className="w-full h-full" />
                                        <button 
                                            onClick={() => {
                                                setCompletionVideo(null);
                                                setCompletionVideoPreview(null);
                                            }}
                                            className="absolute top-3 right-3 p-2 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <button 
                                        onClick={() => completionVideoInputRef.current?.click()}
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
                                    ref={completionVideoInputRef}
                                    type="file" 
                                    accept="video/*" 
                                    className="hidden" 
                                    onChange={handleCompletionVideoChange} 
                                />
                            </div>

                            <button
                                onClick={handleUploadAndComplete}
                                disabled={!completionVideo || isUploadingVideo}
                                className={cn(
                                    "w-full py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg active:scale-[0.98]",
                                    completionVideo && !isUploadingVideo
                                        ? "bg-brand-red text-white hover:bg-brand-red-dark shadow-brand-red/20"
                                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
                                )}
                            >
                                {isUploadingVideo ? (
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
        
            {/* Custom Confirm Dialog */}
            {confirmDialog && confirmDialog.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-[360px] overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 text-center">
                            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2 whitespace-pre-line leading-relaxed break-keep">
                                {confirmDialog.message}
                            </h3>
                        </div>
                        <div className="flex border-t border-zinc-200 dark:border-zinc-800">
                            <button
                                onClick={() => setConfirmDialog(null)}
                                className="flex-1 py-4 text-zinc-500 dark:text-zinc-400 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                            >
                                취소
                            </button>
                            <div className="w-[1px] bg-zinc-200 dark:bg-zinc-800"></div>
                            <button
                                onClick={confirmDialog.onConfirm}
                                className="flex-1 py-4 text-red-600 dark:text-red-500 font-bold hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                            >
                                확인
                            </button>
                        </div>
                    </div>
                </div>
            )}
</div>
    );
}
