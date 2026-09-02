"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { calculateScorecardAnalysis, HoleAnalysis } from "@/lib/score-calculations";
import { fetchComments, saveComment, updateComment, deleteComment, AnalysisComment } from "@/lib/analysis-sync";
import {
    ChevronLeft,
    MoreHorizontal,
    TrendingDown,
    Activity,
    Target,
    Zap,
    Flag,
    Info,
    BarChart3,
    Calendar,
    Trophy,
    User,
    Trophy as TrophyIcon,
    BookOpen,
    Edit3,
    Trash2,
    Search,
    Loader2,
    X,
    MessageSquare,
    Send,
    Edit2,
    Paperclip
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";
import { FileUploadButton } from "@/components/ui/FileUploadButton";
import { PageTitle, SectionTitle, LabelText } from "@/components/ui/Typography";

const CODE_TO_LOCATION: Record<string, string> = {
    "TE": "티박스",
    "FW": "페어웨이",
    "RU": "러프",
    "FB": "페어웨이 벙커",
    "GA": "그린 주변 어프로치",
    "GB": "그린 주변 벙커",
    "GR": "그린",
    "HI": "홀인",
    "PA": "패널티구역",
    "OB": "오비",
    "PS": "벌타",
    "FO": "숲속",
    "-": "-",
};

const CATEGORY_TO_FIELD: Record<string, string> = {
    "티샷 비거리": "distSG_DriverDist",
    "티샷 정확도": "distSG_DriverAcc",
    "180M이상": "distSG_180Plus",
    "150-179M": "distSG_150_179",
    "120-149M": "distSG_120_149",
    "90-119M": "distSG_90_119",
    "피치샷": "distSG_Pitch31_89",
    "벙커": "distSG_Bunker",
    "어프로치": "distSG_Approach",
    "9M이상": "distSG_Putt9Plus",
    "4-8M": "distSG_Putt4_8",
    "2-3M": "distSG_Putt2_3",
    "1M": "distSG_Putt1",
};

const POS_MAP: Record<string, string> = {
    "TE": "티샷",
    "FW": "페어웨이",
    "RO": "러프",
    "FB": "페어웨이 벙커",
    "GR": "그린",
    "GA": "그린 주변 어프로치",
    "GB": "그린 주변 벙커",
    "HI": "홀인",
    "PA": "패널티구역",
    "OB": "오비",
    "PS": "벌타",
    "FO": "숲속",
};
// ── Components ───────────────────────────────────────────────

const SectionHeader = ({ title, icon: Icon, badge }: { title: string; icon: any; badge?: string }) => (
    <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400">
                <Icon size={18} />
            </div>
            <SectionTitle>{title}</SectionTitle>
        </div>
        {badge && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-brand-navy/5 text-brand-navy dark:bg-brand-navy/20 dark:text-brand-navy-light border border-brand-navy/10">
                {badge}
            </span>
        )}
    </div>
);

const IndicatorCard = ({ label, value, unit, icon: Icon, colorClass = "text-brand-navy" }: { label: string; value: string | number; unit?: string; icon: any; colorClass?: string }) => (
    <div className="bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800/50 p-4 rounded-2xl flex flex-col justify-between h-full">
        <div className="flex items-center gap-1.5 mb-3 text-[12px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-tight">
            <Icon size={14} className="text-zinc-400 shrink-0" />
            {label}
        </div>
        <div className="flex items-baseline justify-end gap-1">
            <span className={cn("text-2xl font-black tracking-tighter", colorClass)}>{value}</span>
            {unit && <span className="text-[12px] font-bold text-zinc-400 ml-0.5">{unit}</span>}
        </div>
    </div>
);

const SummaryBox = ({ label, value, icon: Icon, colorClass = "text-brand-navy" }: { label: React.ReactNode; value: string | number; icon: any; colorClass?: string }) => {
    const isPositive = typeof value === 'string' && value.startsWith('+');
    const isNegative = typeof value === 'string' && value.startsWith('-');
    // Negative is Red (Good), Positive is Blue (Bad) in this app's convention
    const displayColor = isPositive ? "text-blue-500" : isNegative ? "text-red-500" : colorClass;

    return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-5 py-7 rounded-[2.5rem] shadow-sm flex flex-col items-start justify-between min-h-[190px]">
            <div className="flex flex-col items-start gap-2 mb-2 text-[11px] font-black text-zinc-400 text-left">
                <Icon size={20} className="text-zinc-400/80 shrink-0" />
                <div className="leading-tight">
                    {label}
                </div>
            </div>
            <div className="w-full flex items-baseline justify-end">
                <span className={cn("text-2xl font-black tracking-tighter", displayColor)}>{value}</span>
            </div>
        </div>
    );
};

const SectorChangeBadge = ({ type, value }: { type: string; value: string | number }) => {
    const valNum = Number(value);
    const isPositive = valNum > 0;
    const isZero = valNum === 0;
    // Blue for bad (pos), Red for good (neg)
    const colorClass = isPositive ? "text-blue-500" : isZero ? "text-zinc-900 dark:text-zinc-100" : "text-red-500";
    const bgClass = isPositive ? "bg-blue-50 dark:bg-blue-900/10" : isZero ? "bg-zinc-50 dark:bg-zinc-900/10" : "bg-red-50 dark:bg-red-900/10";

    return (
        <div className={cn("p-4 rounded-3xl flex flex-col justify-between gap-3 border border-zinc-100/50 dark:border-zinc-800/50", bgClass)}>
            <div className="w-full text-left">
                <span className="text-[12px] font-bold text-zinc-500 dark:text-zinc-400">{type}</span>
            </div>
            <div className="w-full text-center">
                <span className={cn("text-2xl font-black tracking-tighter", colorClass)}>
                    {isPositive ? `+${value}` : value}
                </span>
            </div>
        </div>
    );
};

// ── Page Component ───────────────────────────────────────────

export default function ScoreDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [mode, setMode] = useState<"score" | "contribution">("score");
    const [loading, setLoading] = useState(true);
    const [scorecard, setScorecard] = useState<any>(null);
    const [analysis, setAnalysis] = useState<HoleAnalysis[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [isMoreOpen, setIsMoreOpen] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [userName, setUserName] = useState<string | null>(null);
    const [selectedPlanLabel, setSelectedPlanLabel] = useState<string | null>(null);
    const [selectedHoleDetails, setSelectedHoleDetails] = useState<{ holeNumber: number, label: string } | null>(null);

    const [comments, setComments] = useState<AnalysisComment[]>([]);
    const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);

    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
    const [editingCommentText, setEditingCommentText] = useState("");
    const [isUpdatingComment, setIsUpdatingComment] = useState(false);

    const [newComment, setNewComment] = useState("");
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const [commentFile, setCommentFile] = useState<File | null>(null);
    const [commentPreviewUrl, setCommentPreviewUrl] = useState<string | null>(null);
    const commentFileRef = useRef<HTMLInputElement>(null);

    const roundToOne = (num: number | undefined) => {
        if (num === undefined || num === null) return "0";
        const val = Number(Math.round(Number(num + "e1")) + "e-1");
        return val % 1 === 0 ? val.toString() : val.toFixed(1);
    };

    const formatScore = (val: number, decimals: number = 2) => {
        if (val === 0) return "0";
        return (val > 0 ? "+" : "") + val.toFixed(decimals);
    };

    const getRelevantShots = (holeNumber: number, category: string) => {
        const hole = analysis.find(h => h.holeNumber === holeNumber);
        if (!hole) return [];

        const filtered = hole.shots.filter(s => {
            const label = (s.shotLabel || "").split('/')[0].trim().toUpperCase();
            const dist = s.attemptDistance;

            if (category === "티샷 비거리" || category === "티샷 정확도") return label === "TE";
            if (category === "180M이상") return label !== "GR" && label !== "GB" && dist >= 180;
            if (category === "150-179M") return label !== "GR" && label !== "GB" && dist >= 150 && dist < 180;
            if (category === "120-149M") return label !== "GR" && label !== "GB" && dist >= 120 && dist < 150;
            if (category === "90-119M") return label !== "GR" && label !== "GB" && dist >= 90 && dist < 120;
            if (category === "피치샷") return label !== "GR" && label !== "GB" && dist >= 31 && dist < 90;
            if (category === "벙커") return label === "GB";
            if (category === "어프로치") return label !== "GR" && label !== "GB" && label !== "TE" && dist <= 30;
            if (category === "9M이상") return label === "GR" && dist >= 9;
            if (category === "4-8M") return label === "GR" && dist >= 4 && dist < 9;
            if (category === "2-3M") return label === "GR" && dist >= 2 && dist < 4;
            if (category === "1M") return label === "GR" && dist === 1;
            return false;
        });

        return filtered.filter((s, idx, arr) => {
            if (idx === 0) return true;
            const prev = arr[idx - 1];
            const prevLanding = (prev.landingLabel || "").toUpperCase().trim();
            const isPenalty = ["PA", "OB", "PS"].includes(prevLanding);
            if (isPenalty && s.attemptDistance === prev.attemptDistance) return false;
            return true;
        });
    };

    const handleDelete = async () => {
        if (!confirm("정말 이 스코어 기록을 삭제하시겠습니까?")) return;

        const supabase = createClient();
        const { error } = await supabase
            .from("scorecards")
            .delete()
            .eq("id", params.id);

        if (error) {
            alert("삭제 중 오류가 발생했습니다.");
            console.error(error);
        } else {
            router.push("/scores");
        }
    };

    const handleCommentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;
        setCommentFile(file);
        setCommentPreviewUrl(file ? URL.createObjectURL(file) : null);
        e.target.value = "";
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

    const handleCommentSubmit = async (e?: React.FormEvent | React.KeyboardEvent) => {
        if (e) e.preventDefault();
        if (!newComment.trim() && !commentFile) return;

        try {
            setIsSubmittingComment(true);
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const id = (Array.isArray(params.id) ? params.id[0] : params.id) as string;

            // Ensure the records row exists for this scorecard
            const { data: existingRecord } = await supabase.from("records").select("id").eq("id", id).maybeSingle();

            if (!existingRecord) {
                const { data: sc } = await supabase.from("scorecards").select("athlete_id, coach_id, course_name, total_score").eq("id", id).single();
                if (sc) {
                    const { error: insertError } = await supabase.from("records").insert({
                        id: id,
                        user_id: sc.athlete_id,
                        coach_id: sc.coach_id,
                        type: "analysis",
                        title: `${sc.course_name} 분석 기록`,
                        category: "field",
                        content: `${sc.total_score || 0}타 기록`
                    });

                    if (insertError) {
                        alert("연결된 기록 자동 생성에 실패했습니다: " + insertError.message);
                        setIsSubmittingComment(false);
                        return;
                    }
                }
            }

            let fileUrl = undefined;
            let fileType = undefined;

            if (commentFile) {
                const { uploadFile } = await import("@/lib/storage-sync");
                fileUrl = await uploadFile(commentFile, 'records', `comments/${id}`);
                fileType = commentFile.type;
            }

            await saveComment({
                recordId: id,
                userId: user.id,
                content: newComment.trim(),
                mediaUrl: fileUrl,
                mediaType: fileType
            });

            // Refresh comments
            const updatedComments = await fetchComments(id);
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

    useEffect(() => {
        const fetchData = async () => {
            const id = (Array.isArray(params.id) ? params.id[0] : params.id) as string;
            const supabase = createClient();

            const { data: sc } = await supabase
                .from("scorecards")
                .select(`
                    id, round_date, course_name, total_score, distance_unit, athlete_id, coach_id,
                    athlete:users!scorecards_athlete_id_fkey(name),
                    coach:users!scorecards_coach_id_fkey(name),
                    holes:scorecard_holes(
                        hole_number, par, score,
                        shots:scorecard_shots(*)
                    )
                `)
                .eq("id", id)
                .single();

            if (sc) {
                setScorecard(sc);
                try {
                    const result = await calculateScorecardAnalysis(id as string);
                    setAnalysis(result);

                    const totalPoint = result.reduce((sum, h) => sum + h.totalSG, 0);
                    const teePoint = result.reduce((sum, h) => sum + (h.summary.distSG_DriverDist + h.summary.distSG_DriverAcc), 0);
                    const secondPoint = result.reduce((sum, h) => sum + (h.summary.distSG_180Plus + h.summary.distSG_150_179 + h.summary.distSG_120_149 + h.summary.distSG_90_119), 0);
                    const greenPoint = result.reduce((sum, h) => sum + (h.summary.distSG_Pitch31_89 + h.summary.distSG_Bunker + h.summary.distSG_Approach), 0);
                    const puttingPoint = result.reduce((sum, h) => sum + (h.summary.distSG_Putt9Plus + h.summary.distSG_Putt4_8 + h.summary.distSG_Putt2_3 + h.summary.distSG_Putt1), 0);

                    // SG Categories grouping
                    const cats = [
                        { name: "티샷 비거리", sg: result.reduce((s, h) => s + h.summary.distSG_DriverDist, 0) },
                        { name: "티샷 정확도", sg: result.reduce((s, h) => s + h.summary.distSG_DriverAcc, 0) },
                        { name: "180M이상", sg: result.reduce((s, h) => s + h.summary.distSG_180Plus, 0) },
                        { name: "150-179M", sg: result.reduce((s, h) => s + h.summary.distSG_150_179, 0) },
                        { name: "120-149M", sg: result.reduce((s, h) => s + h.summary.distSG_120_149, 0) },
                        { name: "90-119M", sg: result.reduce((s, h) => s + h.summary.distSG_90_119, 0) },
                        { name: "피치샷", sg: result.reduce((s, h) => s + h.summary.distSG_Pitch31_89, 0) },
                        { name: "벙커", sg: result.reduce((s, h) => s + h.summary.distSG_Bunker, 0) },
                        { name: "어프로치", sg: result.reduce((s, h) => s + h.summary.distSG_Approach, 0) },
                        { name: "9M이상", sg: result.reduce((s, h) => s + h.summary.distSG_Putt9Plus, 0) },
                        { name: "4-8M", sg: result.reduce((s, h) => s + h.summary.distSG_Putt4_8, 0) },
                        { name: "2-3M", sg: result.reduce((s, h) => s + h.summary.distSG_Putt2_3, 0) },
                        { name: "1M", sg: result.reduce((s, h) => s + h.summary.distSG_Putt1, 0) },
                    ];

                    const totalAbsSG = cats.reduce((s, c) => s + Math.abs(c.sg), 0);
                    const categoriesWithPercent = cats.map(c => ({
                        ...c,
                        percent: totalAbsSG > 0 ? (Math.abs(c.sg) / totalAbsSG) * 100 : 0
                    })).sort((a, b) => a.sg - b.sg);

                    const teeSG = cats.filter(c => c.name === "티샷 비거리" || c.name === "티샷 정확도").reduce((s, c) => s + c.sg, 0);
                    const secondSG = cats.filter(c => ["180M이상", "150-179M", "120-149M", "90-119M"].includes(c.name)).reduce((s, c) => s + c.sg, 0);
                    const greenSG = cats.filter(c => ["피치샷", "벙커", "어프로치"].includes(c.name)).reduce((s, c) => s + c.sg, 0);
                    const puttingSG = cats.filter(c => ["9M이상", "4-8M", "2-3M", "1M"].includes(c.name)).reduce((s, c) => s + c.sg, 0);

                    const longSG = teeSG + secondSG; // 90M ~ 비거리,정확도 점수
                    const shortSG = greenSG + puttingSG; // 피치샷 ~ 1M 점수

                    // 1. 롱게임대비 숏게임 = (피치샷~1M 점수) - (90~비거리, 정확도 점수)
                    const longVsShort = shortSG - longSG;

                    // 2. 플레이 내용 = 스코어 + ((롱게임대비 숏게임 * -1) / 2)
                    const playContent = sc.total_score + ((longVsShort * -1) / 2);

                    // 3. 내용대비 스코어 = 스코어 - 플레이 내용
                    const scoreVsContent = sc.total_score - playContent;

                    const totalPutts = result.reduce((s, h) => s + h.summary.putts, 0);
                    const sumFirstPuttDist = result.reduce((s, h) => s + parseFloat(h.summary.firstPuttAttemptDist || "0"), 0);
                    const threePuttCount = result.filter(h => h.summary.putts >= 3).length;
                    const totalPA = result.reduce((s, h) => s + h.summary.paCount, 0);
                    const totalOB = result.reduce((s, h) => s + h.summary.obCount, 0);

                    const fwHoles = result.filter(h => h.summary.fairwayHit !== '-');
                    const fwHits = fwHoles.filter(h => h.summary.fairwayHit === 'O').length;
                    const fairwayHitRate = fwHoles.length > 0 ? (fwHits / fwHoles.length) * 100 : 0;

                    const girHits = result.filter(h => h.summary.gir === 'O').length;
                    const girRate = result.length > 0 ? (girHits / result.length) * 100 : 0;

                    // Segment & Par Type Scores
                    const getRelScore = (list: HoleAnalysis[]) => {
                        const s = list.reduce((acc, h) => acc + (h.score - h.par), 0);
                        if (s === 0) return "0";
                        return (s > 0 ? "+" : "") + s;
                    };

                    const score1_3 = getRelScore(result.slice(0, 3));
                    const score4_15 = getRelScore(result.slice(3, 15));
                    const score16_18 = getRelScore(result.slice(15, 18));
                    const scorePar3 = getRelScore(result.filter(h => h.par === 3));
                    const scorePar4 = getRelScore(result.filter(h => h.par === 4));
                    const scorePar5 = getRelScore(result.filter(h => h.par === 5));

                    // Average Remaining Distance stats
                    const distStats: Record<string, { sum: number; count: number }> = {
                        "티샷": { sum: 0, count: 0 },
                        "180M이상": { sum: 0, count: 0 },
                        "150-179M": { sum: 0, count: 0 },
                        "120-149M": { sum: 0, count: 0 },
                        "90-119M": { sum: 0, count: 0 },
                        "피치샷": { sum: 0, count: 0 },
                        "벙커": { sum: 0, count: 0 },
                        "어프로치": { sum: 0, count: 0 },
                        "9M이상": { sum: 0, count: 0 },
                        "4-8M": { sum: 0, count: 0 },
                        "2-3M": { sum: 0, count: 0 },
                        "1M": { sum: 0, count: 0 },
                    };

                    result.forEach(h => {
                        h.shots.forEach(r => {
                            const label = r.shotLabel.split('/')[0].trim().toUpperCase();
                            const dist = r.attemptDistance;
                            const rem = r.remainingDistance;
                            const landing = (r.landingLabel || "").toUpperCase().trim();

                            // EXCLUDE penalties from distance stats (PA, OB, PS)
                            if (["PA", "OB", "PS"].includes(landing)) return;

                            // Tee Shot (Par 4 only)
                            if (label === 'TE' && h.par === 4) {
                                distStats["티샷"].sum += rem;
                                distStats["티샷"].count++;
                            }

                            // Distance categories (Non-green, non-bunker, dist > 0)
                            if (label !== 'GR' && label !== 'GB' && dist > 0) {
                                if (dist >= 180) { distStats["180M이상"].sum += rem; distStats["180M이상"].count++; }
                                else if (dist >= 150) { distStats["150-179M"].sum += rem; distStats["150-179M"].count++; }
                                else if (dist >= 120) { distStats["120-149M"].sum += rem; distStats["120-149M"].count++; }
                                else if (dist >= 90) { distStats["90-119M"].sum += rem; distStats["90-119M"].count++; }
                                else if (dist >= 31) { distStats["피치샷"].sum += rem; distStats["피치샷"].count++; }
                            }

                            if (label === 'GB') { distStats["벙커"].sum += rem; distStats["벙커"].count++; }

                            if (label !== 'GR' && label !== 'GB' && label !== 'TE' && dist > 0 && dist <= 30) {
                                distStats["어프로치"].sum += rem; distStats["어프로치"].count++;
                            }

                            if (label === 'GR') {
                                if (dist >= 9) { distStats["9M이상"].sum += rem; distStats["9M이상"].count++; }
                                else if (dist >= 4) { distStats["4-8M"].sum += rem; distStats["4-8M"].count++; }
                                else if (dist >= 2) { distStats["2-3M"].sum += rem; distStats["2-3M"].count++; }
                                else if (dist === 1) { distStats["1M"].sum += rem; distStats["1M"].count++; }
                            }
                        });
                    });

                    const avgRemainingDists = Object.entries(distStats).map(([label, stat]) => ({
                        label: `${label} (${stat.count})`,
                        value: stat.count > 0 ? (stat.sum / stat.count).toFixed(1) : "-"
                    }));

                    // Points
                    const negativeCats = [...cats].filter(c => c.sg < 0).sort((a, b) => a.sg - b.sg);
                    const positiveCats = categoriesWithPercent.filter(c => c.sg > 0).sort((a, b) => b.percent - a.percent);

                    const strongPlan = negativeCats.slice(0, 1).map((c, i) => {
                        const fieldName = CATEGORY_TO_FIELD[c.name];
                        const holeNumbers = result
                            .filter(h => (h.summary as any)[fieldName] < 0)
                            .sort((a, b) => (a.summary as any)[fieldName] - (b.summary as any)[fieldName])
                            .slice(0, 5)
                            .sort((a, b) => a.holeNumber - b.holeNumber)
                            .map(h => h.holeNumber);
                        return { label: c.name, holeNumbers };
                    });

                    const challengePlan = positiveCats.slice(0, 2).map((c, i) => {
                        const fieldName = CATEGORY_TO_FIELD[c.name];
                        const holeNumbers = result
                            .filter(h => (h.summary as any)[fieldName] > 0)
                            .sort((a, b) => (b.summary as any)[fieldName] - (a.summary as any)[fieldName])
                            .slice(0, 5)
                            .sort((a, b) => a.holeNumber - b.holeNumber)
                            .map(h => h.holeNumber);
                        return { label: c.name, holeNumbers };
                    });

                    setSummary({
                        totalPoint,
                        teePoint,
                        secondPoint,
                        greenPoint,
                        puttingPoint,
                        playContent,
                        scoreVsContent,
                        longVsShort,
                        totalPutts,
                        avgFirstPuttDist: result.length > 0 ? sumFirstPuttDist / result.length : 0,
                        threePuttCount,
                        penaltyCount: totalPA + totalOB,
                        fairwayHitRate,
                        girRate,
                        score1_3,
                        score4_15,
                        score16_18,
                        scorePar3,
                        scorePar4,
                        scorePar5,
                        avgRemainingDists,
                        sectorChanges: [
                            { type: "티샷", value: formatScore(teeSG, 2), items: cats.slice(0, 2) },
                            { type: "세컨샷", value: formatScore(secondSG, 2), items: cats.slice(2, 6) },
                            { type: "그린주변샷", value: formatScore(greenSG, 2), items: cats.slice(6, 9) },
                            { type: "퍼팅", value: formatScore(puttingSG, 2), items: cats.slice(9, 13) }
                        ],
                        contributions: categoriesWithPercent,
                        strongPlan,
                        challengePlan
                    });

                } catch (err) {
                    console.error("Calculation error:", err);
                }
            }

            // Fetch user role
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase
                    .from("users")
                    .select("role, name")
                    .eq("id", user.id)
                    .single();
                if (profile) {
                    setUserRole(profile.role);
                    setUserName(profile.name);
                    setCurrentUser({ id: user.id, name: profile.name || 'User' });
                }
            }

            // Ensure a matching records row exists so we can display/fetch comments.
            // If it doesn't exist, create it with the same ID as the scorecard.
            const { data: existingRecord } = await supabase
                .from("records")
                .select("id")
                .eq("id", id)
                .maybeSingle();

            if (!existingRecord && sc) {
                await supabase.from("records").insert({
                    id: id,
                    user_id: sc.athlete_id,
                    coach_id: sc.coach_id,
                    type: "analysis",
                    title: `${sc.course_name} 분석 기록`,
                    category: "field",
                    content: `${sc.total_score || 0}타 기록`
                });
            }

            const commentsData = await fetchComments(id);
            setComments(commentsData);

            setLoading(false);
        };
        fetchData();
    }, [params.id]);

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
            <Loader2 className="w-8 h-8 text-brand-navy animate-spin" />
        </div>
    );

    if (!scorecard || !summary) return <div className="p-20 text-center">데이터를 찾을 수 없습니다.</div>;

    const data = {
        player: scorecard.athlete?.name || "선수",
        coach: scorecard.coach?.name || "코치",
        date: scorecard.round_date.slice(5).replace(/-/g, "."),
        title: scorecard.course_name,
        totalScore: scorecard.total_score || analysis.reduce((s, h) => s + h.score, 0),
        summary: {
            totalPoint: summary.totalPoint,
            teePoint: summary.teePoint,
            secondPoint: summary.secondPoint,
            greenPoint: summary.greenPoint,
            puttingPoint: summary.puttingPoint,
            playContent: roundToOne(summary.playContent),
            scoreVsContent: (summary.scoreVsContent > 0 ? "+" : "") + roundToOne(summary.scoreVsContent),
            longVsShort: (summary.longVsShort > 0 ? "+" : "") + roundToOne(summary.longVsShort)
        },
        avgMetrics: [
            { label: "페어웨이 안착률", value: roundToOne(summary.fairwayHitRate), unit: "%" },
            { label: "첫 퍼트 거리", value: roundToOne(summary.avgFirstPuttDist), unit: "m" },
            { label: "그린 적중률", value: roundToOne(summary.girRate), unit: "%" },
            { label: "퍼트수", value: summary.totalPutts, unit: "개" },
            { label: "3퍼트 이상", value: summary.threePuttCount, unit: "회" },
            { label: "패널티/OB", value: summary.penaltyCount, unit: "개" }
        ],
        sectorChanges: summary.sectorChanges,
        contributions: summary.contributions,
        strongPlan: summary.strongPlan,
        challengePlan: summary.challengePlan,
        avgRemainingDists: summary.avgRemainingDists,
        notes: (scorecard.holes || [])
            .sort((a: any, b: any) => a.hole_number - b.hole_number)
            .flatMap((h: any) => {
                const sortedShots = (h.shots || []).sort((a: any, b: any) => a.shot_number - b.shot_number);
                return sortedShots
                    .filter((s: any) => s.memo && s.memo.trim() !== "")
                    .map((s: any) => {
                        const sIdx = sortedShots.findIndex((x: any) => x.shot_number === s.shot_number);
                        const nextShot = sortedShots[sIdx + 1];
                        return {
                            hole: h.hole_number,
                            shotNumber: s.shot_number,
                            attemptPos: CODE_TO_LOCATION[s.location_code] || s.location_code || "-",
                            attemptDist: s.distance || "",
                            resultPos: nextShot ? (CODE_TO_LOCATION[nextShot.location_code] || nextShot.location_code || "-") : "홀인",
                            resultDist: nextShot ? (nextShot.distance || "") : "",
                            memo: s.memo
                        };
                    });
            }),
        holes: analysis.map(h => ({
            hole: h.holeNumber,
            par: h.par,
            score: h.score,
            fairway: h.summary.fairwayHit,
            gir: h.summary.gir,
            girDist: h.summary.onGreenAttemptDist,
            appDist: h.summary.approachAttemptDist,
            bunkerDist: h.summary.bunkerAttemptDist,
            putt1st: h.summary.firstPuttAttemptDist,
            putts: h.summary.putts,
            appReview: h.summary.putts >= 3 || h.summary.approachAttemptDist !== "",
            summary: h.summary
        }))
    };

    return (
        <div className="min-h-screen bg-[#F8F9FC] dark:bg-zinc-950 pb-24">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200/60 dark:border-zinc-800/60">
                <div className="max-w-3xl lg:max-w-6xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-50 transition-colors">
                            <ChevronLeft size={24} />
                        </button>
                        <div className="flex items-center gap-2">
                            <BarChart3 size={20} className="text-brand-navy dark:text-brand-navy-light shrink-0" />
                            <PageTitle>스코어 상세</PageTitle>
                        </div>
                    </div>
                    <div className="relative">
                        <button
                            onClick={() => setIsMoreOpen(!isMoreOpen)}
                            className="p-2 -mr-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                        >
                            <MoreHorizontal size={20} />
                        </button>

                        {isMoreOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsMoreOpen(false)} />
                                <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in duration-200">
                                    {userName === "슈퍼관리자" && (
                                        <button
                                            onClick={() => router.push(`/scores/review/${params.id}`)}
                                            className="w-full px-4 py-3 text-sm font-bold text-brand-navy hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2 transition-colors border-b border-zinc-100 dark:border-zinc-800"
                                        >
                                            <Search size={16} />
                                            상세 분석
                                        </button>
                                    )}
                                    <button
                                        onClick={() => router.push(`/scores/create?id=${params.id}`)}
                                        className="w-full px-4 py-3 text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2 transition-colors border-b border-zinc-100 dark:border-zinc-800"
                                    >
                                        <Edit3 size={16} />
                                        수정하기
                                    </button>
                                    <button
                                        onClick={handleDelete}
                                        className="w-full px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors"
                                    >
                                        <Trash2 size={16} />
                                        삭제하기
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-3xl lg:max-w-6xl mx-auto px-4 sm:px-8 py-6 space-y-6">

                {/* ── 1. Header Card ── */}
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm space-y-4">
                    <div className="flex items-center gap-2">
                        <span className="text-zinc-500 text-sm font-medium flex items-center gap-1.5">
                            <Calendar size={16} className="text-zinc-400" />
                            {data.date.replace(/\./g, "-")}
                        </span>
                    </div>

                    <SectionTitle>
                        {data.title}
                    </SectionTitle>

                    <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-end">
                        <div className="text-right">
                            <p className="text-[11px] text-zinc-400 font-medium">선수</p>
                            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{data.player}</p>
                        </div>
                    </div>
                </section>

                {/* Total Score Card */}
                {(() => {
                    const totalPar = analysis.reduce((sum, h) => sum + h.par, 0);
                    const scoreDiff = data.totalScore - totalPar;
                    const scoreDiffStr = scoreDiff > 0 ? `+${scoreDiff}` : scoreDiff === 0 ? "E" : `${scoreDiff}`;
                    const isUnderPar = scoreDiff < 0;
                    const isOverPar = scoreDiff > 0;

                    const scoreBgClass = isUnderPar ? "bg-red-50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30" : isOverPar ? "bg-blue-50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900/30" : "bg-zinc-100 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700";
                    const scoreTextClass = isUnderPar ? "text-red-500" : isOverPar ? "text-blue-500" : "text-zinc-900 dark:text-zinc-100";

                    return (
                        <div className={cn("relative overflow-hidden p-6 sm:px-8 rounded-[2.5rem] border flex flex-col justify-between h-32 sm:h-36", scoreBgClass)}>
                            <div className={cn("absolute right-[-10px] top-[-10px] opacity-[0.05]", scoreTextClass)}>
                                <Activity size={100} />
                            </div>
                            <div className="relative z-10 flex items-center gap-2">
                                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center bg-white/60 dark:bg-black/20")}>
                                    <Activity size={18} className={scoreTextClass} />
                                </div>
                                <SectionTitle>Score</SectionTitle>
                            </div>
                            <div className="relative z-10 w-full flex justify-center items-baseline gap-1.5 sm:gap-2 whitespace-nowrap">
                                <span className={cn("text-4xl sm:text-5xl font-black tracking-tighter", scoreTextClass)}>
                                    {data.totalScore}
                                </span>
                                <span className={cn("text-lg sm:text-xl font-bold", scoreTextClass)}>
                                    ({scoreDiffStr})
                                </span>
                                <span className="text-base sm:text-lg font-bold text-zinc-400">
                                    / par {totalPar}
                                </span>
                            </div>
                        </div>
                    );
                })()}

                {/* Summary Boxes */}
                <div className="grid grid-cols-3 gap-3 sm:gap-5">
                    <SummaryBox label={<>플레이<br />내용</>} value={data.summary.playContent} icon={Flag} />
                    <SummaryBox label={<>내용<br />대비<br />스코어</>} value={data.summary.scoreVsContent} icon={Target} />
                    <SummaryBox label={<>롱게임<br />대비<br />숏게임</>} value={data.summary.longVsShort} icon={Zap} />
                </div>


                {/* 부문별 스코어 */}
                <section className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 shadow-sm border border-zinc-200/60 dark:border-zinc-800/60">
                    <SectionHeader title="부문별 스코어" icon={Target} />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {data.sectorChanges.map((sc: any, idx: number) => {
                            const isPositive = parseFloat(sc.value) > 0;
                            return (
                                <div key={idx} className={cn(
                                    "p-3 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] border flex flex-col gap-2 sm:gap-3 transition-all",
                                    isPositive ? "bg-blue-50/30 border-blue-100 dark:bg-blue-900/10 dark:border-blue-800/30" : "bg-red-50/30 border-red-100 dark:bg-red-900/10 dark:border-red-800/30"
                                )}>
                                    <div className="flex flex-col">
                                        <p className="text-[13px] font-black text-zinc-400 uppercase tracking-tight">{sc.type}</p>
                                        <p className={cn("text-2xl font-black tracking-tighter text-right mt-1", isPositive ? "text-blue-500" : "text-red-500")}>
                                            {sc.value}
                                        </p>
                                    </div>
                                    <div className="space-y-1.5 pt-3 mt-1 border-t border-zinc-100/50 dark:border-zinc-800/50">
                                        {sc.items.map((item: any, iIdx: number) => (
                                            <div key={iIdx} className="flex justify-between items-center text-[clamp(10px,3.5vw,13px)] font-bold whitespace-nowrap gap-0.5">
                                                <span className="text-zinc-500 dark:text-zinc-400 truncate">{item.name}</span>
                                                <span className={cn("shrink-0", item.sg >= 0 ? "text-blue-500" : "text-red-500")}>
                                                    {item.sg > 0 ? "+" : ""}{item.sg.toFixed(1)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* 주요 평균 지표 */}
                <section className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 shadow-sm border border-zinc-200/60 dark:border-zinc-800/60">
                    <SectionHeader title="주요 평균 지표" icon={TrendingDown} />
                    <div className="grid grid-cols-2 gap-4">
                        {data.avgMetrics.map((m, idx) => (
                            <IndicatorCard key={idx} label={m.label} value={m.value} unit={m.unit} icon={Activity} />
                        ))}
                    </div>
                </section>

                {/* Strong Point */}
                {data.strongPlan && data.strongPlan.length > 0 && (
                    <section className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 shadow-sm border border-zinc-200/60 dark:border-zinc-800/60">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/10 flex items-center justify-center text-red-500 shrink-0">
                                <TrophyIcon size={18} />
                            </div>
                            <SectionTitle>STRONG POINT</SectionTitle>
                        </div>
                        <div className="space-y-3">
                            {data.strongPlan.map((item: any, idx: number) => {
                                const validHoles = item.holeNumbers.filter((hn: number) => getRelevantShots(hn, item.label).some((shot: any) => shot.shotSG < 0));
                                const isExpanded = selectedPlanLabel === item.label;
                                return (
                                    <div key={idx} className="space-y-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (isExpanded) {
                                                    setSelectedPlanLabel(null);
                                                    setSelectedHoleDetails(null);
                                                } else {
                                                    setSelectedPlanLabel(item.label);
                                                    if (validHoles && validHoles.length > 0) {
                                                        setSelectedHoleDetails({ holeNumber: validHoles[0], label: item.label });
                                                    } else {
                                                        setSelectedHoleDetails(null);
                                                    }
                                                }
                                            }}
                                            className={cn(
                                                "w-full bg-white dark:bg-zinc-900 border rounded-2xl flex items-center justify-center p-4 transition-all relative",
                                                isExpanded ? "border-orange-500 ring-1 ring-orange-500" : "border-zinc-200 dark:border-zinc-800 hover:border-orange-400"
                                            )}
                                        >
                                            <span className="font-black text-[15px] sm:text-[17px] text-zinc-800 dark:text-zinc-200 block break-keep leading-tight text-center">{item.label}</span>
                                            {isExpanded ? <ChevronUp size={16} className="text-zinc-400 absolute right-4" /> : <ChevronDown size={16} className="text-zinc-400 absolute right-4" />}
                                        </button>
                                        {isExpanded && (
                                            <div className="px-4 py-3 bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 rounded-2xl animate-in slide-in-from-top-2 duration-200">
                                                <div className="grid grid-cols-5 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
                                                    {validHoles.map((hn: number) => {
                                                        const isSelected = selectedHoleDetails?.holeNumber === hn && selectedHoleDetails?.label === item.label;
                                                        return (
                                                            <button
                                                                key={hn}
                                                                onClick={() => {
                                                                    if (isSelected) {
                                                                        setSelectedHoleDetails(null);
                                                                    } else {
                                                                        setSelectedHoleDetails({ holeNumber: hn, label: item.label });
                                                                        setTimeout(() => {
                                                                            const el = document.getElementById(`hole-detail-${item.label}-${hn}`);
                                                                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
                                                                        }, 10);
                                                                    }
                                                                }}
                                                                className={cn(
                                                                    "px-3 py-1.5 rounded-lg border shadow-sm flex flex-col items-center transition-all",
                                                                    isSelected
                                                                        ? "bg-orange-500 border-orange-600 scale-105"
                                                                        : "bg-white dark:bg-zinc-900 border-orange-200 dark:border-orange-800/50 hover:border-orange-400"
                                                                )}
                                                            >
                                                                <span className={cn("text-[10px] font-bold", isSelected ? "text-orange-100" : "text-zinc-400")}>Hole</span>
                                                                <span className={cn("text-sm font-black", isSelected ? "text-white" : "text-orange-600 dark:text-orange-400")}>{hn}</span>
                                                            </button>
                                                        );
                                                    })}
                                                    {validHoles.length === 0 && (
                                                        <span className="text-[11px] text-zinc-400 italic">기록된 홀이 없습니다.</span>
                                                    )}
                                                </div>

                                                {/* Shot Details for selected hole */}
                                                {selectedHoleDetails && selectedHoleDetails.label === item.label && (
                                                    <div
                                                        className="mt-4 flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-4 pb-2"
                                                        onScroll={(e) => {
                                                            const container = e.currentTarget;
                                                            const scrollLeft = container.scrollLeft;
                                                            const width = container.offsetWidth;
                                                            const index = Math.round(scrollLeft / (width + 16));
                                                            if (validHoles[index] && selectedHoleDetails.holeNumber !== validHoles[index]) {
                                                                setSelectedHoleDetails({ holeNumber: validHoles[index], label: item.label });
                                                            }
                                                        }}
                                                    >
                                                        {validHoles.map((hn: number) => (
                                                            <div key={hn} id={`hole-detail-${item.label}-${hn}`} className="w-full shrink-0 snap-center p-4 bg-white dark:bg-zinc-900 rounded-xl border border-orange-200 dark:border-orange-800/50 shadow-inner animate-in fade-in slide-in-from-left-2 duration-300">
                                                                <div className="flex items-center justify-between mb-3 border-b border-zinc-100 dark:border-zinc-800 pb-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{hn}번 홀 분석</span>
                                                                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 uppercase">
                                                                            Par {analysis.find(h => h.holeNumber === hn)?.par}
                                                                        </span>
                                                                    </div>
                                                                    <button onClick={() => setSelectedHoleDetails(null)} className="text-zinc-400 hover:text-zinc-600">
                                                                        <X size={14} />
                                                                    </button>
                                                                </div>
                                                                <div className="space-y-4">
                                                                    {getRelevantShots(hn, item.label).filter((shot: any) => shot.shotSG < 0).map((shot: any, sIdx: number) => {
                                                                        const attemptPos = (shot.shotLabel || "").split('/')[0].trim().toUpperCase();
                                                                        const landingPos = (shot.landingLabel || "").toUpperCase().trim();
                                                                        const isPenalty = ["PA", "OB", "PS"].includes(landingPos);
                                                                        const unit = (shot.shotLabel || "").toUpperCase().includes("GR") ? "m" : "m";
                                                                        return (
                                                                            <div key={sIdx} className="space-y-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-100 dark:border-zinc-800/50">
                                                                                <div className="flex items-center gap-4">
                                                                                    <div className="flex items-center gap-1.5 w-12 shrink-0">
                                                                                        <div className="w-1 h-3 bg-zinc-300 rounded-full" />
                                                                                        <span className="text-[10px] font-bold text-zinc-400 uppercase">시도</span>
                                                                                    </div>
                                                                                    <p className="text-xs font-black text-zinc-800 dark:text-zinc-200">
                                                                                        {(POS_MAP[attemptPos] || attemptPos).replace('그린 주변 어프로치', '어프로치').replace('그린 주변 벙커', '벙커')} {shot.attemptDistance > 0 ? `/ ${shot.attemptDistance}${unit}` : ""}
                                                                                    </p>
                                                                                </div>
                                                                                <div className="flex items-center gap-4">
                                                                                    <div className="flex items-center gap-1.5 w-12 shrink-0">
                                                                                        <div className={cn("w-1 h-3 rounded-full", isPenalty ? "bg-red-500" : "bg-orange-500")} />
                                                                                        <span className={cn("text-[10px] font-bold uppercase", isPenalty ? "text-red-500" : "text-zinc-400")}>
                                                                                            {isPenalty ? "패널티" : "결과"}
                                                                                        </span>
                                                                                    </div>
                                                                                    <p className={cn("text-xs font-black", isPenalty ? "text-red-600 dark:text-red-400" : "text-zinc-800 dark:text-zinc-200")}>
                                                                                        {isPenalty ? "패널티" : (POS_MAP[landingPos] || landingPos).replace('그린 주변 어프로치', '어프로치').replace('그린 주변 벙커', '벙커')} {shot.remainingDistance > 0 ? `/ ${shot.remainingDistance}${unit}` : ""}
                                                                                    </p>
                                                                                </div>
                                                                                <div className="flex items-center gap-4">
                                                                                    <div className="flex items-center gap-1.5 w-12 shrink-0">
                                                                                        <div className="w-1 h-3 bg-zinc-300 dark:bg-zinc-600 rounded-full" />
                                                                                        <span className="text-[10px] font-bold text-zinc-400 uppercase">점수</span>
                                                                                    </div>
                                                                                    <p className={cn("text-xs font-black", shot.shotSG < 0 ? "text-red-500" : shot.shotSG > 0 ? "text-blue-500" : "text-zinc-800 dark:text-zinc-200")}>
                                                                                        {shot.shotSG > 0 ? "+" : ""}{Number(shot.shotSG || 0).toFixed(1)}
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* Challenge Point */}
                {data.challengePlan && data.challengePlan.length > 0 && (
                    <section className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 shadow-sm border border-zinc-200/60 dark:border-zinc-800/60">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-brand-navy dark:text-brand-navy-light shrink-0">
                                <TrendingDown size={18} />
                            </div>
                            <SectionTitle>CHALLENGE POINT</SectionTitle>
                        </div>
                        <div className="space-y-3">
                            {data.challengePlan.map((item: any, idx: number) => {
                                const validHoles = item.holeNumbers.filter((hn: number) => getRelevantShots(hn, item.label).some((shot: any) => shot.shotSG > 0));
                                const isExpanded = selectedPlanLabel === item.label;
                                return (
                                    <div key={idx} className="space-y-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (isExpanded) {
                                                    setSelectedPlanLabel(null);
                                                    setSelectedHoleDetails(null);
                                                } else {
                                                    setSelectedPlanLabel(item.label);
                                                    if (validHoles && validHoles.length > 0) {
                                                        setSelectedHoleDetails({ holeNumber: validHoles[0], label: item.label });
                                                    } else {
                                                        setSelectedHoleDetails(null);
                                                    }
                                                }
                                            }}
                                            className={cn(
                                                "w-full bg-white dark:bg-zinc-900 border rounded-2xl flex items-center justify-center p-4 transition-all relative",
                                                isExpanded ? "border-sky-500 ring-1 ring-sky-500" : "border-zinc-200 dark:border-zinc-800 hover:border-sky-400"
                                            )}
                                        >
                                            <span className="font-black text-[15px] sm:text-[17px] text-zinc-800 dark:text-zinc-200 block break-keep leading-tight text-center">{item.label}</span>
                                            {isExpanded ? <ChevronUp size={16} className="text-zinc-400 absolute right-4" /> : <ChevronDown size={16} className="text-zinc-400 absolute right-4" />}
                                        </button>
                                        {isExpanded && (
                                            <div className="px-4 py-3 bg-sky-50 dark:bg-sky-900/10 border border-sky-100 dark:border-sky-900/30 rounded-2xl animate-in slide-in-from-top-2 duration-200">
                                                <div className="grid grid-cols-5 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
                                                    {validHoles.map((hn: number) => {
                                                        const isSelected = selectedHoleDetails?.holeNumber === hn && selectedHoleDetails?.label === item.label;
                                                        return (
                                                            <button
                                                                key={hn}
                                                                onClick={() => {
                                                                    if (isSelected) {
                                                                        setSelectedHoleDetails(null);
                                                                    } else {
                                                                        setSelectedHoleDetails({ holeNumber: hn, label: item.label });
                                                                        setTimeout(() => {
                                                                            const el = document.getElementById(`hole-detail-${item.label}-${hn}`);
                                                                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
                                                                        }, 10);
                                                                    }
                                                                }}
                                                                className={cn(
                                                                    "px-3 py-1.5 rounded-lg border shadow-sm flex flex-col items-center transition-all",
                                                                    isSelected
                                                                        ? "bg-sky-500 border-sky-600 scale-105"
                                                                        : "bg-white dark:bg-zinc-900 border-sky-200 dark:border-sky-800/50 hover:border-sky-400"
                                                                )}
                                                            >
                                                                <span className={cn("text-[10px] font-bold", isSelected ? "text-sky-100" : "text-zinc-400")}>Hole</span>
                                                                <span className={cn("text-sm font-black", isSelected ? "text-white" : "text-sky-600 dark:text-sky-400")}>{hn}</span>
                                                            </button>
                                                        );
                                                    })}
                                                    {validHoles.length === 0 && (
                                                        <span className="text-[11px] text-zinc-400 italic">기록된 홀이 없습니다.</span>
                                                    )}
                                                </div>

                                                {/* Shot Details for selected hole */}
                                                {selectedHoleDetails && selectedHoleDetails.label === item.label && (
                                                    <div
                                                        className="mt-4 flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-4 pb-2"
                                                        onScroll={(e) => {
                                                            const container = e.currentTarget;
                                                            const scrollLeft = container.scrollLeft;
                                                            const width = container.offsetWidth;
                                                            const index = Math.round(scrollLeft / (width + 16));
                                                            if (validHoles[index] && selectedHoleDetails.holeNumber !== validHoles[index]) {
                                                                setSelectedHoleDetails({ holeNumber: validHoles[index], label: item.label });
                                                            }
                                                        }}
                                                    >
                                                        {validHoles.map((hn: number) => (
                                                            <div key={hn} id={`hole-detail-${item.label}-${hn}`} className="w-full shrink-0 snap-center p-4 bg-white dark:bg-zinc-900 rounded-xl border border-sky-200 dark:border-sky-800/50 shadow-inner animate-in fade-in slide-in-from-left-2 duration-300">
                                                                <div className="flex items-center justify-between mb-3 border-b border-zinc-100 dark:border-zinc-800 pb-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{hn}번 홀 분석</span>
                                                                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 uppercase">
                                                                            Par {analysis.find(h => h.holeNumber === hn)?.par}
                                                                        </span>
                                                                    </div>
                                                                    <button onClick={() => setSelectedHoleDetails(null)} className="text-zinc-400 hover:text-zinc-600">
                                                                        <X size={14} />
                                                                    </button>
                                                                </div>
                                                                <div className="space-y-4">
                                                                    {getRelevantShots(hn, item.label).filter((shot: any) => shot.shotSG > 0).map((shot: any, sIdx: number) => {
                                                                        const attemptPos = (shot.shotLabel || "").split('/')[0].trim().toUpperCase();
                                                                        const landingPos = (shot.landingLabel || "").toUpperCase().trim();
                                                                        const isPenalty = ["PA", "OB", "PS"].includes(landingPos);
                                                                        const unit = (shot.shotLabel || "").toUpperCase().includes("GR") ? "m" : "m";
                                                                        return (
                                                                            <div key={sIdx} className="space-y-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-100 dark:border-zinc-800/50">
                                                                                <div className="flex items-center gap-4">
                                                                                    <div className="flex items-center gap-1.5 w-12 shrink-0">
                                                                                        <div className="w-1 h-3 bg-zinc-300 rounded-full" />
                                                                                        <span className="text-[10px] font-bold text-zinc-400 uppercase">시도</span>
                                                                                    </div>
                                                                                    <p className="text-xs font-black text-zinc-800 dark:text-zinc-200">
                                                                                        {(POS_MAP[attemptPos] || attemptPos).replace('그린 주변 어프로치', '어프로치').replace('그린 주변 벙커', '벙커')} {shot.attemptDistance > 0 ? `/ ${shot.attemptDistance}${unit}` : ""}
                                                                                    </p>
                                                                                </div>
                                                                                <div className="flex items-center gap-4">
                                                                                    <div className="flex items-center gap-1.5 w-12 shrink-0">
                                                                                        <div className={cn("w-1 h-3 rounded-full", isPenalty ? "bg-red-500" : "bg-sky-500")} />
                                                                                        <span className={cn("text-[10px] font-bold uppercase", isPenalty ? "text-red-500" : "text-zinc-400")}>
                                                                                            {isPenalty ? "패널티" : "결과"}
                                                                                        </span>
                                                                                    </div>
                                                                                    <p className={cn("text-xs font-black", isPenalty ? "text-red-600 dark:text-red-400" : "text-zinc-800 dark:text-zinc-200")}>
                                                                                        {isPenalty ? "패널티" : (POS_MAP[landingPos] || landingPos).replace('그린 주변 어프로치', '어프로치').replace('그린 주변 벙커', '벙커')} {shot.remainingDistance > 0 ? `/ ${shot.remainingDistance}${unit}` : ""}
                                                                                    </p>
                                                                                </div>
                                                                                <div className="flex items-center gap-4">
                                                                                    <div className="flex items-center gap-1.5 w-12 shrink-0">
                                                                                        <div className="w-1 h-3 bg-zinc-300 dark:bg-zinc-600 rounded-full" />
                                                                                        <span className="text-[10px] font-bold text-zinc-400 uppercase">점수</span>
                                                                                    </div>
                                                                                    <p className={cn("text-xs font-black", shot.shotSG < 0 ? "text-red-500" : shot.shotSG > 0 ? "text-blue-500" : "text-zinc-800 dark:text-zinc-200")}>
                                                                                        {shot.shotSG > 0 ? "+" : ""}{Number(shot.shotSG || 0).toFixed(1)}
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}


                {/* Score Card */}
                <section className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 shadow-sm border border-zinc-200/60 dark:border-zinc-800/60 overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400">
                                <BookOpen size={18} />
                            </div>
                            <SectionTitle>Score Card</SectionTitle>
                        </div>

                        {/* Legend */}
                        <div className="flex flex-wrap items-center justify-end gap-3 text-[10px] font-bold">
                            <div className="flex items-center gap-1">
                                <div className="relative w-3.5 h-3.5 flex items-center justify-center rounded-full border-[1.5px] border-orange-400">
                                    <div className="w-2.5 h-2.5 rounded-full border-[1.5px] border-orange-400"></div>
                                </div>
                                <span className="text-zinc-500 dark:text-zinc-400">이글 이하</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3.5 h-3.5 rounded-full border-[1.5px] border-yellow-400" />
                                <span className="text-zinc-500 dark:text-zinc-400">버디</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3.5 h-3.5 border-[1.5px] border-sky-400" />
                                <span className="text-zinc-500 dark:text-zinc-400">보기</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="relative w-3.5 h-3.5 flex items-center justify-center border-[1.5px] border-sky-400">
                                    <div className="w-2.5 h-2.5 border-[1.5px] border-sky-400"></div>
                                </div>
                                <span className="text-zinc-500 dark:text-zinc-400">더블보기 이상</span>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto -mx-6 pb-2 scrollbar-hide">
                        <table className="w-max border-separate border-spacing-0 text-center">
                            <thead>
                                <tr className="text-[10px] font-black text-zinc-600 dark:text-zinc-400 uppercase tracking-tighter">
                                    <th className="sticky left-0 z-30 py-2 px-1 bg-white dark:bg-zinc-900 border-y border-zinc-100 dark:border-zinc-800 w-24 sm:w-28 text-left pl-6 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)]">Hole</th>
                                    {data.holes.map(h => {
                                        const fieldName = selectedPlanLabel ? CATEGORY_TO_FIELD[selectedPlanLabel] : null;
                                        const isHighlighted = fieldName && (h.summary as any)[fieldName] > 0;
                                        return (
                                            <th key={h.hole} className={cn(
                                                "py-2 px-0.5 sm:px-1 text-[11px] font-black border-y border-zinc-100 dark:border-zinc-800 transition-colors w-10 sm:w-12",
                                                isHighlighted ? "bg-orange-500 text-white" : "text-zinc-900 dark:text-zinc-50 bg-white dark:bg-zinc-950"
                                            )}>
                                                {h.hole}
                                            </th>
                                        );
                                    })}
                                    <th className="py-2 px-2 text-[11px] font-black text-brand-navy dark:text-brand-navy-light border-y border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/80 pr-6 w-16 sm:w-20">총계</th>
                                </tr>
                            </thead>
                            <tbody className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                                <tr className="border-b border-zinc-50 dark:border-zinc-800/50">
                                    <td className="sticky left-0 z-30 py-2 px-1 text-[10px] font-black text-zinc-800 dark:text-zinc-200 tracking-tighter bg-white dark:bg-zinc-900 text-left pl-6 uppercase border-b border-zinc-50 dark:border-zinc-800/50 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)]">PAR</td>
                                    {data.holes.map(h => {
                                        const fieldName = selectedPlanLabel ? CATEGORY_TO_FIELD[selectedPlanLabel] : null;
                                        const isHighlighted = fieldName && (h.summary as any)[fieldName] > 0;
                                        return (
                                            <td key={h.hole} className={cn(
                                                "py-2 px-1 font-black border-b border-zinc-50 dark:border-zinc-800/50 transition-colors",
                                                isHighlighted ? "bg-orange-100 dark:bg-orange-900/40" : "bg-white dark:bg-zinc-950"
                                            )}>
                                                {h.par}
                                            </td>
                                        );
                                    })}
                                    <td className="py-2 px-2 font-black border-b border-zinc-50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-800/50 text-brand-navy pr-6">{data.holes.reduce((s, h) => s + h.par, 0)}</td>
                                </tr>
                                <tr className="border-b border-zinc-50 dark:border-zinc-800/50">
                                    <td className="sticky left-0 z-30 py-3 px-1 text-[10px] font-black text-zinc-900 dark:text-zinc-100 tracking-tighter bg-white dark:bg-zinc-900 text-left pl-6 uppercase border-b border-zinc-50 dark:border-zinc-800/50 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)]">스코어</td>
                                    {data.holes.map(h => {
                                        const fieldName = selectedPlanLabel ? CATEGORY_TO_FIELD[selectedPlanLabel] : null;
                                        const isHighlighted = fieldName && (h.summary as any)[fieldName] > 0;
                                        const diff = h.score - h.par;

                                        return (
                                            <td key={h.hole} className={cn(
                                                "py-2 px-0 border-b border-zinc-50 dark:border-zinc-800/50 transition-colors",
                                                isHighlighted ? "bg-orange-100 dark:bg-orange-900/40" : "bg-white dark:bg-zinc-950"
                                            )}>
                                                <div className="relative inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 font-black mx-auto">
                                                    {diff <= -2 && (
                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                            <div className="w-full h-full rounded-full border-[1.5px] border-orange-400 absolute" />
                                                            <div className="w-[75%] h-[75%] rounded-full border-[1.5px] border-orange-400 absolute" />
                                                        </div>
                                                    )}
                                                    {diff === -1 && (
                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                            <div className="w-[90%] h-[90%] rounded-full border-[1.5px] border-yellow-400 absolute" />
                                                        </div>
                                                    )}
                                                    {diff === 1 && (
                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                            <div className="w-[85%] h-[85%] border-[1.5px] border-sky-400 absolute" />
                                                        </div>
                                                    )}
                                                    {diff >= 2 && (
                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                            <div className="w-[85%] h-[85%] border-[1.5px] border-sky-400 absolute" />
                                                            <div className="w-[70%] h-[70%] border-[1.5px] border-sky-400 absolute" />
                                                        </div>
                                                    )}
                                                    <span className={cn(
                                                        "relative z-10 text-[11px] sm:text-[12px]",
                                                        diff <= -2 ? "text-orange-500" :
                                                            diff === -1 ? "text-yellow-600 dark:text-yellow-500" :
                                                                diff > 0 ? "text-sky-600 dark:text-sky-500" :
                                                                    "text-zinc-900 dark:text-zinc-100"
                                                    )}>{h.score}</span>
                                                </div>
                                            </td>
                                        );
                                    })}
                                    <td className="py-2 px-2 font-black border-b border-zinc-50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-800/50 text-brand-navy pr-6">{data.holes.reduce((s, h) => s + h.score, 0)}</td>
                                </tr>
                                <tr className="border-b border-zinc-50 dark:border-zinc-800/50">
                                    <td className="sticky left-0 z-30 py-2 px-1 text-[10px] font-black text-zinc-900 dark:text-zinc-100 tracking-tighter bg-white dark:bg-zinc-900 text-left pl-6 uppercase border-b border-zinc-50 dark:border-zinc-800/50 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)]">페어웨이</td>
                                    {data.holes.map(h => {
                                        const fieldName = selectedPlanLabel ? CATEGORY_TO_FIELD[selectedPlanLabel] : null;
                                        const isHighlighted = fieldName && (h.summary as any)[fieldName] > 0;
                                        return (
                                            <td key={h.hole} className={cn(
                                                "py-2 px-1 font-black border-b border-zinc-50 dark:border-zinc-800/50 transition-colors",
                                                isHighlighted ? "bg-orange-100 dark:bg-orange-900/40" : "bg-white dark:bg-zinc-950"
                                            )}>
                                                {h.fairway}
                                            </td>
                                        );
                                    })}
                                    <td className="py-2 px-2 font-black border-b border-zinc-50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-800/50 text-brand-navy pr-6">
                                        {Math.round((data.holes.filter(h => h.fairway === "O").length / data.holes.filter(h => h.fairway !== "-").length) * 100)}%
                                    </td>
                                </tr>
                                <tr className="border-b border-zinc-50 dark:border-zinc-800/50">
                                    <td className="sticky left-0 z-30 py-2 px-1 text-[10px] font-black text-zinc-900 dark:text-zinc-100 tracking-tighter bg-white dark:bg-zinc-900 text-left pl-6 uppercase leading-tight border-b border-zinc-50 dark:border-zinc-800/50 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)]">온그린시도</td>
                                    {data.holes.map(h => {
                                        const fieldName = selectedPlanLabel ? CATEGORY_TO_FIELD[selectedPlanLabel] : null;
                                        const isHighlighted = fieldName && (h.summary as any)[fieldName] > 0;
                                        return (
                                            <td key={h.hole} className={cn(
                                                "py-2 px-1 border-b border-zinc-50 dark:border-zinc-800/50 transition-colors",
                                                isHighlighted ? "bg-orange-100 dark:bg-orange-900/40" : "bg-white dark:bg-zinc-950"
                                            )}>
                                                {h.girDist}
                                            </td>
                                        );
                                    })}
                                    <td className="py-2 px-2 font-black border-b border-zinc-50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-800/50 text-brand-navy pr-6">
                                        {(() => {
                                            const valid = data.holes.filter(h => h.girDist && h.girDist !== "-");
                                            return valid.length > 0 ? Math.round(valid.reduce((s, h) => s + parseFloat(h.girDist as string), 0) / valid.length) : "-";
                                        })()}
                                    </td>
                                </tr>
                                <tr className="border-b border-zinc-50 dark:border-zinc-800/50">
                                    <td className="sticky left-0 z-30 py-2 px-1 text-[10px] font-black text-zinc-900 dark:text-zinc-100 tracking-tighter bg-white dark:bg-zinc-900 text-left pl-6 uppercase border-b border-zinc-50 dark:border-zinc-800/50 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)]">파온 여부</td>
                                    {data.holes.map(h => {
                                        const fieldName = selectedPlanLabel ? CATEGORY_TO_FIELD[selectedPlanLabel] : null;
                                        const isHighlighted = fieldName && (h.summary as any)[fieldName] > 0;
                                        return (
                                            <td key={h.hole} className={cn(
                                                "py-2 px-0.5 sm:px-1 font-black border-b border-zinc-50 dark:border-zinc-800/50 transition-colors",
                                                isHighlighted ? "bg-orange-100 dark:bg-orange-900/40" : "bg-white dark:bg-zinc-950"
                                            )}>
                                                {h.gir}
                                            </td>
                                        );
                                    })}
                                    <td className="py-2 px-2 font-black border-b border-zinc-50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-800/50 text-brand-navy pr-6">
                                        {Math.round((data.holes.filter(h => h.gir === "O").length / data.holes.length) * 100)}%
                                    </td>
                                </tr>
                                <tr className="border-b border-zinc-50 dark:border-zinc-800/50">
                                    <td className="sticky left-0 z-30 py-2 px-1 text-[10px] font-black text-zinc-900 dark:text-zinc-100 tracking-tighter bg-white dark:bg-zinc-900 text-left pl-6 uppercase border-b border-zinc-50 dark:border-zinc-800/50 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)]">벙커시도</td>
                                    {data.holes.map(h => {
                                        const fieldName = selectedPlanLabel ? CATEGORY_TO_FIELD[selectedPlanLabel] : null;
                                        const isHighlighted = fieldName && (h.summary as any)[fieldName] > 0;
                                        return (
                                            <td key={h.hole} className={cn(
                                                "py-2 px-0.5 sm:px-1 border-b border-zinc-50 dark:border-zinc-800/50 transition-colors text-[10px] sm:text-[11px]",
                                                isHighlighted ? "bg-orange-100 dark:bg-orange-900/40" : "bg-white dark:bg-zinc-950"
                                            )}>
                                                {h.bunkerDist || "-"}
                                            </td>
                                        );
                                    })}
                                    <td className="py-2 px-2 font-black border-b border-zinc-50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-800/50 text-brand-navy pr-6">
                                        {(() => {
                                            const valid = data.holes.filter(h => h.bunkerDist && h.bunkerDist !== "-" && h.bunkerDist !== "");
                                            return valid.length > 0 ? Math.round(valid.reduce((s, h) => s + parseFloat(h.bunkerDist as string), 0) / valid.length) : "-";
                                        })()}
                                    </td>
                                </tr>
                                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                                    <td className="sticky left-0 z-30 py-2 px-1 text-[10px] font-black text-zinc-900 dark:text-zinc-100 tracking-tighter bg-white dark:bg-zinc-900 text-left pl-6 uppercase leading-tight border-b border-zinc-100 dark:border-zinc-800 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)]">어프로치시도</td>
                                    {data.holes.map(h => {
                                        const fieldName = selectedPlanLabel ? CATEGORY_TO_FIELD[selectedPlanLabel] : null;
                                        const isHighlighted = fieldName && (h.summary as any)[fieldName] > 0;
                                        return (
                                            <td key={h.hole} className={cn(
                                                "py-2 px-0.5 sm:px-1 border-b border-zinc-100 dark:border-zinc-800 transition-colors text-[10px] sm:text-[11px]",
                                                isHighlighted ? "bg-orange-100 dark:bg-orange-900/40" : "bg-white dark:bg-zinc-950"
                                            )}>
                                                {h.appDist}
                                            </td>
                                        );
                                    })}
                                    <td className="py-2 px-2 font-black border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-brand-navy pr-6">
                                        {(() => {
                                            const valid = data.holes.filter(h => h.appDist && h.appDist !== "-");
                                            return valid.length > 0 ? Math.round(valid.reduce((s, h) => s + parseFloat(h.appDist as string), 0) / valid.length) : "-";
                                        })()}
                                    </td>
                                </tr>
                                <tr className="border-b border-zinc-50 dark:border-zinc-800/50 leading-tight">
                                    <td className="sticky left-0 z-30 py-2 px-1 text-[10px] font-black text-zinc-900 dark:text-zinc-100 tracking-tighter bg-white dark:bg-zinc-900 text-left pl-6 uppercase leading-tight border-b border-zinc-50 dark:border-zinc-800/50 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)]">첫퍼트시도</td>
                                    {data.holes.map(h => {
                                        const fieldName = selectedPlanLabel ? CATEGORY_TO_FIELD[selectedPlanLabel] : null;
                                        const isHighlighted = fieldName && (h.summary as any)[fieldName] > 0;
                                        return (
                                            <td key={h.hole} className={cn(
                                                "py-2 px-0.5 sm:px-1 border-b border-zinc-50 dark:border-zinc-800/50 transition-colors text-[10px] sm:text-[11px]",
                                                isHighlighted ? "bg-orange-100 dark:bg-orange-900/40" : "bg-white dark:bg-zinc-950"
                                            )}>
                                                {h.putt1st}
                                            </td>
                                        );
                                    })}
                                    <td className="py-2 px-2 font-black border-b border-zinc-50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-800/50 text-brand-navy pr-6">
                                        {(() => {
                                            const valid = data.holes.filter(h => h.putt1st && h.putt1st !== "-");
                                            return valid.length > 0 ? (valid.reduce((s, h) => s + parseFloat(h.putt1st as string), 0) / valid.length).toFixed(1) : "-";
                                        })()}
                                    </td>
                                </tr>
                                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                                    <td className="sticky left-0 z-30 py-2 px-1 text-[10px] font-black text-zinc-900 dark:text-zinc-100 tracking-tighter bg-white dark:bg-zinc-900 text-left pl-6 uppercase border-b border-zinc-100 dark:border-zinc-800 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)]">퍼터수</td>
                                    {data.holes.map(h => {
                                        const fieldName = selectedPlanLabel ? CATEGORY_TO_FIELD[selectedPlanLabel] : null;
                                        const isHighlighted = fieldName && (h.summary as any)[fieldName] > 0;
                                        return (
                                            <td key={h.hole} className={cn(
                                                "py-2 px-1 font-black border-b border-zinc-100 dark:border-zinc-800 transition-colors",
                                                isHighlighted ? "bg-orange-100 dark:bg-orange-900/40" : "bg-white dark:bg-zinc-950"
                                            )}>
                                                {h.putts}
                                            </td>
                                        );
                                    })}
                                    <td className="py-2 px-2 font-black border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-brand-navy pr-6">{data.holes.reduce((s, h) => s + h.putts, 0)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* 샷 노트 */}
                {data.notes && data.notes.length > 0 && (
                    <section className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 shadow-sm border border-zinc-200/60 dark:border-zinc-800/60 overflow-hidden mt-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400">
                                    <MessageSquare size={18} />
                                </div>
                                <SectionTitle>샷 노트</SectionTitle>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {data.notes.map((note: any, idx: number) => {
                                const unit = "m";
                                return (
                                    <div key={idx} className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800/50">
                                        <div className="flex items-center gap-2 mb-3 border-b border-zinc-100 dark:border-zinc-800/50 pb-2">
                                            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{note.hole}번 홀</span>
                                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 uppercase">
                                                {note.shotNumber}번째 샷
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-1.5 w-12 shrink-0">
                                                    <div className="w-1 h-3 bg-zinc-300 rounded-full" />
                                                    <span className="text-[10px] font-bold text-zinc-400 uppercase">시도</span>
                                                </div>
                                                <p className="text-xs font-black text-zinc-800 dark:text-zinc-200">
                                                    {note.attemptPos} {note.attemptDist ? `/ ${note.attemptDist}${unit}` : ""}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-1.5 w-12 shrink-0">
                                                    <div className="w-1 h-3 bg-orange-400 rounded-full" />
                                                    <span className="text-[10px] font-bold text-zinc-400 uppercase">결과</span>
                                                </div>
                                                <p className="text-xs font-black text-zinc-800 dark:text-zinc-200">
                                                    {note.resultPos} {note.resultDist ? `/ ${note.resultDist}${unit}` : ""}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
                                            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">{note.memo}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* ── Comments Section ── */}
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden mb-8 mt-6">
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
                                        <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded leading-none">{c.role}</span>
                                        {currentUser?.id === c.userId && (
                                            <div className="hidden group-hover:flex items-center gap-1 ml-2">
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
                                    <img src={c.fileUrl} className="mt-2 rounded-xl max-h-60 w-auto object-contain bg-white border border-zinc-200 dark:border-zinc-700" alt="첨부" />
                                )}
                                {c.fileUrl && c.fileType?.startsWith("video/") && (
                                    <video src={c.fileUrl} controls className="mt-2 rounded-xl max-h-60 w-full border border-zinc-200 dark:border-zinc-700" />
                                )}
                            </div>
                        ))}
                        {comments.length === 0 && (
                            <p className="text-sm text-zinc-400 text-center py-8">아직 댓글이 없습니다.</p>
                        )}
                    </div>

                    <div className="border-t border-zinc-100 dark:border-zinc-800 px-4 py-3 space-y-2 bg-zinc-50/50 dark:bg-zinc-900/50">
                        <textarea
                            rows={2}
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="댓글이나 질문을 남겨보세요..."
                            disabled={isSubmittingComment}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleCommentSubmit(e);
                                }
                            }}
                            className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all resize-none disabled:opacity-50"
                        />
                        {commentFile && (
                            <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 relative group">
                                {commentFile.type.startsWith("image/") && commentPreviewUrl ? (
                                    <img src={commentPreviewUrl} className="w-full max-h-48 object-cover" alt="미리보기" />
                                ) : (
                                    <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-500 truncate">{commentFile.name}</div>
                                )}
                                <button onClick={() => { setCommentFile(null); setCommentPreviewUrl(null); }} className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1"><X size={12} /></button>
                            </div>
                        )}
                        <div className="flex items-center justify-between">
                            <FileUploadButton iconOnly icon={<Paperclip size={18} />} accept="image/*,video/*" onChange={handleCommentFileChange} disabled={isSubmittingComment} />
                            <button
                                onClick={handleCommentSubmit}
                                disabled={(!newComment.trim() && !commentFile) || isSubmittingComment}
                                className={cn(
                                    "flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                                    (newComment.trim() || commentFile) && !isSubmittingComment
                                        ? "bg-brand-navy text-white hover:bg-brand-navy/90 active:scale-95"
                                        : "bg-zinc-200 dark:bg-zinc-700 text-zinc-400 cursor-not-allowed"
                                )}
                            >
                                <Send size={12} /> {isSubmittingComment ? "저장 중..." : "등록"}
                            </button>
                        </div>
                    </div>
                </section>
            </main>

            {/* Custom Scrollbar Styling */}
            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    height: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #E4E4E7;
                    border-radius: 10px;
                }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #27272A;
                }
            `}</style>
        </div>
    );
}