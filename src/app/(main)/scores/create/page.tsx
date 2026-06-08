"use client";

import { useState, useMemo, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    ChevronLeft, ChevronRight, Search, X, Calendar, ChevronDown, Check, MessageSquare
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DatePickerInput } from "@/components/ui/DatePickerInput";
import { AthleteSearch } from "@/components/ui/AthleteSearch";
import { createClient } from "@/lib/supabase/client";
import { formatLocalDate } from "@/lib/utils";
import { calculateAnalysisFromHoles, HoleAnalysis } from "@/lib/score-calculations";

// ── 위치명 → 약어 매핑 (이미지1 기반)
const LOCATION_ABBR: Record<string, string> = {
    "티박스":              "TE",
    "티샷":               "TE",
    "페어웨이":            "FW",
    "러프":               "RO",
    "페어웨이 벙커":       "FB",
    "그린":               "GR",
    "그린 주변 어프로치":   "GA",
    "그린 주변 벙커":      "GB",
    "홀인":               "HI",
    "패널티구역":           "PA",
    "오비":               "OB",
    "벌타":               "PS",
    "숲속":               "FO",
    "-":                  "-",
};

// 거리 없이 저장하는 위치 코드
const NO_DISTANCE = new Set(["HI", "OB", "PA", "PS"]);

/** UI Shot → DB 저장 형식 인코딩
 *  "페어웨이", 150 → "FW / 150"
 *  "티박스", undefined → "TE"
 *  "홀인" → "HI"
 */
function encodeShotValue(location: string, distance: string, par: number, idx: number): string {
    const code = LOCATION_ABBR[location] ?? location.toUpperCase();
    const dist = parseInt(distance, 10);
    // 거리 없는 케이스
    if (NO_DISTANCE.has(code)) return code;
    // 티샷 (PAR4/5): 거리 없음
    if (code === "TE" && par !== 3 && idx === 0) return code;
    // 거리 있는 케이스
    if (!isNaN(dist) && dist > 0) return `${code} / ${dist}`;
    return code;
}

// ── Constants ─────────────────────────────────────────────────

const BALL_LOCATIONS = [
    "티샷",
    "페어웨이",
    "러프",
    "페어웨이 벙커",
    "숲속",
    "그린 주변 어프로치",
    "그린 주변 벙커",
    "그린",
    "홀인",
    "패널티구역",
    "오비",
    "벌타",
    "-",
];



// ── Types ─────────────────────────────────────────────────────

interface Shot {
    location: string;
    distance: string;
    memo?: string;
}

interface HoleData {
    par: number;
    shots: Shot[];
}

// ── Bottom Sheet Picker (mobile only) ────────────────────────

interface BottomSheetPickerProps {
    isOpen: boolean;
    onClose: () => void;
    options: string[];
    value: string;
    onSelect: (val: string) => void;
    title?: string;
}

function BottomSheetPicker({ isOpen, onClose, options, value, onSelect, title }: BottomSheetPickerProps) {
    useEffect(() => {
        if (isOpen) document.body.style.overflow = "hidden";
        else document.body.style.overflow = "";
        return () => { document.body.style.overflow = ""; };
    }, [isOpen]);

    if (!isOpen) return null;

    // All items: empty + BALL_LOCATIONS (13) = 14 rows
    // Keep each row compact so all fit in ~50vh without scrolling
    const rowCls = (active: boolean) => cn(
        "w-full px-2 py-3 rounded-xl border text-[14px] font-medium text-center transition-all",
        active
            ? "bg-brand-navy/10 border-brand-navy/30 text-brand-navy dark:text-brand-navy-light font-bold shadow-sm"
            : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-100 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 active:bg-zinc-100"
    );

    return (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />

            {/* Sheet */}
            <div
                className="relative bg-white dark:bg-zinc-900 rounded-t-3xl shadow-2xl flex flex-col"
                style={{ animation: "slideUp 0.22s ease-out", maxHeight: "90vh" }}
            >
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-1 shrink-0">
                    <div className="w-10 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                </div>

                {/* Title */}
                {title && (
                    <div className="px-4 py-3 shrink-0">
                        <p className="text-[13px] font-bold text-zinc-800 dark:text-zinc-200 text-center">{title}</p>
                    </div>
                )}

                {/* Options */}
                <div className="flex-1 grid grid-cols-2 gap-2 px-4 pb-4 pt-1 overflow-y-auto">
                    <div className="flex flex-col gap-2">
                        {options.slice(0, Math.ceil(options.length / 2)).map(opt => (
                            <button key={opt} type="button" onClick={() => { onSelect(opt); onClose(); }} className={rowCls(value === opt)}>
                                {opt}
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-col gap-2">
                        {options.slice(Math.ceil(options.length / 2)).map(opt => (
                            <button key={opt} type="button" onClick={() => { onSelect(opt); onClose(); }} className={rowCls(value === opt)}>
                                {opt}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Close */}
                <div className="px-4 pb-4 pt-1 shrink-0 border-t border-zinc-100 dark:border-zinc-800">
                    <button type="button" onClick={onClose}
                        className="w-full py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-[13px] font-semibold text-zinc-600 dark:text-zinc-300 active:bg-zinc-200 transition-colors">
                        닫기
                    </button>
                </div>
            </div>

            <style jsx>{`
                @keyframes slideUp {
                    from { transform: translateY(100%); }
                    to   { transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}

// ── Helpers ───────────────────────────────────────────────────

function getDefaultShots(par: number): Shot[] {
    if (par === 3) return [
        { location: "티박스", distance: "" },   // 0 - 거리 입력 가능
        { location: "그린", distance: "" },     // 1
        { location: "그린", distance: "" },     // 2
        { location: "홀인", distance: "" },     // 3
    ];
    if (par === 5) return [
        { location: "티박스", distance: "" },   // 0 - 거리 입력 불가
        { location: "페어웨이", distance: "" }, // 1
        { location: "페어웨이", distance: "" }, // 2
        { location: "그린", distance: "" },     // 3
        { location: "그린", distance: "" },     // 4
        { location: "홀인", distance: "" },     // 5
    ];
    // PAR 4 (default)
    return [
        { location: "티박스", distance: "" },   // 0 - 거리 입력 불가
        { location: "페어웨이", distance: "" }, // 1
        { location: "그린", distance: "" },     // 2
        { location: "그린", distance: "" },     // 3
        { location: "홀인", distance: "" },     // 4
    ];
}

function buildDefaultShots(): Shot[] {
    return getDefaultShots(4);
}

// Helper: is distance field required (not disabled)?
function checkDistanceRequired(idx: number, shot: Shot, shots: Shot[], par: number): boolean {
    const prevLoc = shots[idx - 1]?.location;
    return !(
        shot.location === "\ud640\uc778" || // 홀인
        shot.location === "-" ||           // -
        (idx === 0 && par !== 3) ||
        shot.location === "\uc624\ube44" ||
        shot.location === "\ud328\ub110\ud2f0\uad6c\uc5ed" ||
        prevLoc === "\uc624\ube44"
    );
}

// 이번홀 = PAR - 홀인이 입력된 샷 번호(인덱스)
function calcHoleScore(shots: Shot[], par: number): number {
    if (!par || par === 0) return 0;
    const idx = shots.findIndex(s => s.location === "홀인" || s.location === "HI");
    if (idx < 0) return 0; // 홀인 미완료
    return idx - par;
}

// ── Page Component ────────────────────────────────────────────

export default function ScoreCreatePage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center"><div className="w-8 h-8 border-4 border-brand-navy/20 border-t-brand-navy rounded-full animate-spin" /></div>}>
            <ScoreCreateContent />
        </Suspense>
    );
}

function ScoreCreateContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const editId = searchParams.get("id");
    const isEditMode = !!editId && editId !== 'draft';

    const [isSaving, setIsSaving] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);
    const formRef = useRef<HTMLDivElement>(null);

    // Player selection
    const [selectedPlayer, setSelectedPlayer] = useState("");

    // Form fields
    const [distanceUnit, setDistanceUnit] = useState("미터 (m)");
    const [roundDate, setRoundDate] = useState(() => formatLocalDate(new Date()));
    const [category, setCategory] = useState("연습");
    const [golfCourse, setGolfCourse] = useState("");

    // Hole data
    const [currentHole, setCurrentHole] = useState(1);
    const [holes, setHoles] = useState<HoleData[]>(
        Array.from({ length: 18 }, () => ({
            par: 0,
            shots: buildDefaultShots(),
        }))
    );





    // Basic info confirmation state
    const [isBasicInfoConfirmed, setIsBasicInfoConfirmed] = useState(isEditMode);

    const hasFinalized = useRef(false);
    const draftIdRef = useRef<string | null>(null);
    const isOriginallyFinal = useRef(false);

    const saveDraftToDB = async (): Promise<boolean> => {
        if (!selectedPlayer || !golfCourse.trim()) return false;
        if (isSaving || hasFinalized.current) return false;
        
        try {
            const lastValidHoleIdx = holes.map((h, i) => h.par > 0 ? i : -1).reduce((max, curr) => Math.max(max, curr), -1);
            const saveHolesCount = lastValidHoleIdx >= 0 ? lastValidHoleIdx + 1 : 1; 

            const computedTotalScore = holes.slice(0, saveHolesCount).reduce((acc, h) => {
                if (h.par === 0) return acc;
                const idx = h.shots.findIndex(s => s.location === "홀인" || s.location === "HI");
                return acc + (idx > 0 ? idx : 0);
            }, 0);

            const supabase = createClient();
            const { data: userData, error: userErr } = await supabase.from("users").select("id").eq("name", selectedPlayer).single();
            if (userErr) throw userErr;
            if (!userData) return false;

            const { data: { user } } = await supabase.auth.getUser();
            let targetId = draftIdRef.current || editId;

            if (targetId && targetId !== 'draft') {
                const { error: updateErr } = await supabase.from("scorecards").update({
                    total_score: computedTotalScore,
                    is_final: false,
                    hole_count: saveHolesCount,
                    round_date: roundDate,
                    course_name: golfCourse,
                    weather: category,
                    distance_unit: distanceUnit.includes("야드") ? "yard" : "meter",
                }).eq("id", targetId);
                if (updateErr) throw updateErr;
            } else {
                const { data: sc, error: insertErr } = await supabase.from("scorecards").insert({
                    athlete_id: userData.id,
                    coach_id: user?.id ?? null,
                    round_date: roundDate,
                    course_name: golfCourse,
                    weather: category,
                    total_score: computedTotalScore,
                    distance_unit: distanceUnit.includes("야드") ? "yard" : "meter",
                    is_final: false,
                    hole_count: saveHolesCount
                }).select("id").single();
                if (insertErr) throw insertErr;
                if (sc) {
                    targetId = sc.id;
                    draftIdRef.current = targetId;
                }
            }

            if (!targetId || targetId === 'draft') return false;

            const { error: shotDelErr } = await supabase.from("scorecard_shots").delete().eq("scorecard_id", targetId);
            if (shotDelErr) throw shotDelErr;
            const { error: holeDelErr } = await supabase.from("scorecard_holes").delete().eq("scorecard_id", targetId);
            if (holeDelErr) throw holeDelErr;

            const holesToInsert = holes.slice(0, saveHolesCount)
                .map((h, idx) => ({ h, idx }))
                .filter(({ h }) => h.par > 0)
                .map(({ h, idx }) => {
                    const calculatedScore = h.par > 0 ? calcHoleScore(h.shots, h.par) + h.par : 0;
                    return {
                        scorecard_id: targetId,
                        hole_number: idx + 1,
                        par: h.par,
                        score: calculatedScore > 0 ? calculatedScore : -1,
                    };
                });

            let insertedHoles: any[] | null = null;
            if (holesToInsert.length > 0) {
                const { data, error: holesErr } = await supabase.from("scorecard_holes").insert(holesToInsert).select("id, hole_number");
                if (holesErr) throw holesErr;
                insertedHoles = data;
            }
            
            if (insertedHoles && insertedHoles.length > 0) {
                const holeIdMap = new Map(insertedHoles.map((h: any) => [h.hole_number, h.id]));
                const isYard = distanceUnit.includes("야드");
                const shotsToInsert: any[] = [];
                
                holes.slice(0, saveHolesCount).forEach((h, hIdx) => {
                    const holeNumber = hIdx + 1;
                    const holeId = holeIdMap.get(holeNumber);
                    if (!holeId) return;

                    const validShots = h.shots.filter(s => s.location && s.location !== "");
                    validShots.forEach((shot, sIdx) => {
                        let distRaw = parseInt(shot.distance, 10);
                        let distMeter = distRaw;
                        if (isYard && !isNaN(distRaw)) {
                            distMeter = Math.round(distRaw * 0.9144);
                        }
                        const shotValue = encodeShotValue(shot.location, isNaN(distMeter) ? "" : distMeter.toString(), h.par, sIdx);
                        const code = LOCATION_ABBR[shot.location] ?? shot.location.toUpperCase();

                        shotsToInsert.push({
                            hole_id: holeId,
                            scorecard_id: targetId,
                            hole_number: holeNumber,
                            shot_number: sIdx + 1,
                            shot_value: shotValue,
                            location_code: code,
                            distance: (!isNaN(distMeter) && distMeter > 0) ? distMeter : null,
                            memo: shot.memo || null,
                        });
                    });
                });

                if (shotsToInsert.length > 0) {
                    const { error: shotsErr } = await supabase.from("scorecard_shots").insert(shotsToInsert);
                    if (shotsErr) throw shotsErr;
                }
            }

            return true;
        } catch (err: any) {
            console.error("Draft DB save error:", err, JSON.stringify(err, null, 2));
            return false;
        }
    };

    // 큐를 이용해 백그라운드에서 순차적으로 저장하도록 처리
    const saveDraftQueueRef = useRef<Promise<any>>(Promise.resolve());
    
    const enqueueSaveDraft = () => {
        saveDraftQueueRef.current = saveDraftQueueRef.current
            .then(() => saveDraftToDB())
            .catch(err => console.error("Draft queue error:", err));
    };

    // Fetch existing data if in edit mode
    useEffect(() => {
        if (!editId || editId === 'draft') return;

        const fetchExistingData = async () => {
            // 로컬 스토리지에서 먼저 확인 (단일 드래프트 및 다중 드래프트 모두 지원)
            let draft = null;
            
            // 1. 새로운 다중 드래프트 스토리지 확인
            const draftsStr = localStorage.getItem('scorecard_drafts');
            if (draftsStr) {
                try {
                    const drafts = JSON.parse(draftsStr);
                    if (drafts[editId]) {
                        draft = drafts[editId];
                    }
                } catch (e) {
                    console.error("Error parsing scorecard_drafts:", e);
                }
            }

            // 2. 만약 다중 드래프트에 없으면 이전 방식의 단일 스토리지 확인
            if (!draft) {
                const oldDraftStr = localStorage.getItem('scorecard_draft');
                if (oldDraftStr) {
                    try {
                        const oldDraft = JSON.parse(oldDraftStr);
                        if (oldDraft.id === editId || editId === 'draft') {
                            draft = oldDraft;
                        }
                    } catch (e) {
                        console.error("Error parsing old scorecard_draft:", e);
                    }
                }
            }

            if (draft) {
                setSelectedPlayer(draft.player || "");
                setRoundDate(draft.roundDate || formatLocalDate(new Date()));
                setGolfCourse(draft.golfCourse || "");
                setCategory(draft.category || "연습");
                setDistanceUnit(draft.distanceUnit || "미터 (m)");
                
                if (draft.holes && draft.holes.length > 0) {
                    const newHoles = [...holes];
                    let lastSavedHole = 1;
                    draft.holes.forEach((h: any, hIdx: number) => {
                        if (hIdx >= 0 && hIdx < 18) {
                            newHoles[hIdx] = {
                                par: h.par || 0,
                                shots: Array.isArray(h.shots) ? [...h.shots] : []
                            };
                            if (h.par > 0) {
                                lastSavedHole = hIdx + 1;
                            }
                            // 빈 칸이 필요한 경우 추가
                            const lastShot = newHoles[hIdx].shots[newHoles[hIdx].shots.length - 1];
                            if (!lastShot || (lastShot.location !== "홀인" && lastShot.location !== "HI")) {
                                newHoles[hIdx].shots.push({ location: "", distance: "", memo: "" });
                            }
                        }
                    });
                    
                    if (lastSavedHole > 0 && lastSavedHole < 18) {
                        const lastHoleData = newHoles[lastSavedHole - 1];
                        const isComplete = lastHoleData.shots.some(s => s.location === "홀인" || s.location === "HI");
                        if (isComplete) {
                            lastSavedHole += 1;
                        }
                    }
                    
                    setHoles(newHoles);
                    setCurrentHole(lastSavedHole);
                    draftIdRef.current = draft.id;
                    setIsBasicInfoConfirmed(true);
                    setIsInfoExpanded(false);
                    return; // 로컬 데이터로 로드 성공!
                }
            }

            // DB에서 로드 시도 (이전 방식)
            const supabase = createClient();
            const { data: sc, error } = await supabase
                .from("scorecards")
                .select(`
                    id, round_date, course_name, total_score, distance_unit, weather, is_final,
                    athlete:users!scorecards_athlete_id_fkey(name),
                    holes:scorecard_holes(
                        id, hole_number, par, score,
                        shots:scorecard_shots(*)
                    )
                `)
                .eq("id", editId)
                .single();

            if (error || !sc) {
                console.error("Error fetching scorecard:", error);
                return;
            }

            isOriginallyFinal.current = sc.is_final;
            const athleteName = Array.isArray(sc.athlete) ? (sc.athlete[0] as any)?.name : (sc.athlete as any)?.name;
            setSelectedPlayer(athleteName || "");
            setRoundDate(sc.round_date);
            setGolfCourse(sc.course_name || "");
            setCategory(sc.weather || "연습");
            setDistanceUnit(sc.distance_unit === "yard" ? "야드 (y)" : "미터 (m)");

            if (sc.holes && sc.holes.length > 0) {
                const newHoles = [...holes];
                sc.holes.forEach((h: any) => {
                    const hIdx = h.hole_number - 1;
                    if (hIdx >= 0 && hIdx < 18) {
                        newHoles[hIdx] = {
                            par: h.par,
                            shots: h.shots.sort((a: any, b: any) => a.shot_number - b.shot_number).map((s: any) => {
                                const parts = (s.shot_value || "").split(" / ");
                                const locCode = parts[0];
                                const locName = Object.keys(LOCATION_ABBR).find(k => LOCATION_ABBR[k] === locCode) || locCode;
                                
                                return {
                                    location: locName,
                                    distance: s.distance?.toString() || "",
                                    memo: s.memo || ""
                                };
                            })
                        };
                        const lastShot = newHoles[hIdx].shots[newHoles[hIdx].shots.length - 1];
                        if (!lastShot || (lastShot.location !== "홀인" && lastShot.location !== "HI")) {
                            newHoles[hIdx].shots.push({ location: "", distance: "" });
                        }
                    }
                });
                
                let targetHole = 1;
                if (sc.holes && sc.holes.length > 0) {
                    const maxHoleNum = Math.max(...sc.holes.map((h: any) => h.hole_number));
                    targetHole = maxHoleNum;
                    const lastHoleData = newHoles[targetHole - 1];
                    const isComplete = lastHoleData.shots.some((s: any) => s.location === "홀인" || s.location === "HI");
                    if (isComplete && targetHole < 18) {
                        targetHole += 1;
                    }
                }
                setCurrentHole(targetHole);

                setHoles(newHoles);
                draftIdRef.current = sc.id;
                setIsBasicInfoConfirmed(true);
                setIsInfoExpanded(false);
            }
        };

        fetchExistingData();
    }, [editId]);

    // Touch swipe for mobile hole navigation
    const touchStartX = useRef<number>(0);
    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
    };
    const handleTouchEnd = (e: React.TouchEvent) => {
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(dx) < 50) return;
        if (dx < 0) {
            // Swipe Left -> Next (Validate & Save)
            e.preventDefault();
            e.stopPropagation();
            saveCurrentAndNext();
        }
        if (dx > 0 && currentHole > 1) {
            // Swipe Right -> Prev
            e.preventDefault();
            e.stopPropagation();
            setCurrentHole(h => h - 1);
            setDistanceErrors(new Set());
        }
    };

    // Distance validation errors (shot indices with missing distance)
    const [distanceErrors, setDistanceErrors] = useState<Set<number>>(new Set());


    // Flag to enable strict validation for 'Next'/'Swipe' once any save has occurred
    const [hasSaveOccurred, setHasSaveOccurred] = useState(false);

    // Helper wrapper for local usage
    const isDistanceRequired = (idx: number, shot: Shot): boolean => {
        return checkDistanceRequired(idx, shot, holeData.shots, holeData.par);
    };

    const submitNineHoles = async (e: React.MouseEvent) => {
        e.preventDefault();
        
        const completedCount = holes.filter(h => {
            if (h.par === 0) return false;
            const hasHoleIn = h.shots.some(s => s.location === "홀인" || s.location === "HI");
            if (!hasHoleIn) return false;
            const hasMissingDist = h.shots.some((shot, idx) => {
                return checkDistanceRequired(idx, shot, h.shots, h.par) && (shot.distance === null || shot.distance === undefined || shot.distance.trim() === "");
            });
            return !hasMissingDist;
        }).length;
        
        if (completedCount < 9) {
            alert(`최소 9개의 홀을 완성해야 합니다. (현재 ${completedCount}개 완료)`);
            return;
        }

        if (!confirm(`작성된 ${completedCount}개의 홀 스코어만 최종 등록하시겠습니까?`)) return;
        
        handleSubmit(e as any, true);
    };

    const [showSgTable, setShowSgTable] = useState(false);
    const [holeAnalyses, setHoleAnalyses] = useState<HoleAnalysis[]>([]);

    const isAllHolesCompleted = useMemo(() => {
        return holes.every(h => {
            if (h.par === 0) return false;
            const hasHoleIn = h.shots.some(s => s.location === "홀인");
            if (!hasHoleIn) return false;
            return !h.shots.some((s, idx) => checkDistanceRequired(idx, s, h.shots, h.par) && s.distance.trim() === "");
        });
    }, [holes]);

    const saveCurrentAndNext = async (forced: boolean = false, isNext: boolean = true) => {
        const currentHoleData = holes[currentHole - 1];
        if (!currentHoleData) return;
        // If not forced (top button / swipe), allow skip only if NO save has occurred yet.
        // Once the save button is pressed at least once, the user MUST fill out every visited hole before moving next.
        if (!forced && !hasSaveOccurred) {
            if (isNext && currentHole < 18) {
                setCurrentHole(h => h + 1);
                setShowSgTable(false);
                setDistanceErrors(new Set());
            }
            return;
        }

        if (currentHoleData.par === 0) {
            setValidationError("Par를 선택해주세요.");
            return;
        }

        // 1. 남은 거리 미입력 유효성 검사
        const missing = new Set<number>();
        currentHoleData.shots.forEach((shot, idx) => {
            if (checkDistanceRequired(idx, shot, currentHoleData.shots, currentHoleData.par) && (shot.distance === null || shot.distance === undefined || shot.distance.trim() === "")) {
                missing.add(idx);
            }
        });

        if (missing.size > 0) {
            setDistanceErrors(missing);
            setValidationError("홀까지 남은거리를 입력해주세요.");
            return;
        }

        // 2. 30m 이하 볼 위치 유효성 검사 (사용자 요청)
        const allowedCodesAt30m = ["GR", "GB", "GA", "HI", "-"];
        let isInvalid30mUnder = false;
        let isInvalid30mOver = false;

        for (const shot of currentHoleData.shots) {
            const distVal = shot.distance ? parseInt(shot.distance, 10) : NaN;
            if (!isNaN(distVal) && distVal > 0) {
                const locName = (shot.location || "").trim();
                const code = LOCATION_ABBR[locName] || locName;

                // 30m 이내인데 그린주변/그린/홀인이 아닌 경우
                if (distVal <= 30 && !allowedCodesAt30m.includes(code)) {
                    isInvalid30mUnder = true;
                    break;
                }
                
                // 그린(GR), 그린주변(GA, GB)인데 30m를 초과한 경우 (사용자 요청)
                if (distVal > 30 && (code === "GA" || code === "GB" || code === "GR")) {
                    isInvalid30mOver = true;
                    break;
                }
            }
        }

        if (isInvalid30mUnder) {
            setValidationError("30미터 안쪽은 그린주변 어프로치 혹은 그린주변 벙커를 선택해 주세요");
            return;
        }

        if (isInvalid30mOver) {
            setValidationError("그린, 그린주변 어프로치 혹은 그린주변 벙커는 30미터 이내로 작성해 주세요");
            return;
        }

        setValidationError(null);

        if (forced) {
            setHasSaveOccurred(true);
            // 백그라운드 큐에 저장 작업을 넣고 UI는 즉시 넘깁니다
            enqueueSaveDraft();
        }
        setDistanceErrors(new Set());
        
        if (isNext) {
            if (currentHole < 18) {
                setCurrentHole(h => h + 1);
                setShowSgTable(false); // 다음 홀로 넘어가면 SG 테이블 숨김
            }
        } else {
            // 샷별 점수 확인 클릭 시 현재 홀에 머물며 로컬 SG 계산 후 테이블 표시
            try {
                const dbHoles = holes.map((h, i) => ({
                    hole_number: i + 1,
                    par: h.par,
                    score: calcHoleScore(h.shots, h.par) + h.par,
                    shots: h.shots.map((s, idx) => ({
                        shot_number: idx + 1,
                        shot_value: encodeShotValue(s.location, s.distance || "", h.par, idx),
                        distance: s.distance ? parseInt(s.distance, 10) : 0
                    }))
                }));
                calculateAnalysisFromHoles(dbHoles).then(res => {
                    setHoleAnalyses(res);
                }).catch(err => {
                    console.error("Local SG calc error", err);
                });
            } catch (err) {}
            setShowSgTable(true);
        }
    };

    // Bottom sheet state: which shot index is open (-1 = none)
    const [openPickerShotIndex, setOpenPickerShotIndex] = useState(-1);
    
    // Memo modal state
    const [editingMemoIndex, setEditingMemoIndex] = useState<number | null>(null);

    // Info section collapse
    const [isInfoExpanded, setIsInfoExpanded] = useState(true);

    const handleConfirmBasicInfo = () => {
        if (!selectedPlayer || !roundDate || !golfCourse.trim()) {
            alert("선수명, 일자, 골프장을 모두 입력해주세요.");
            setIsInfoExpanded(true);
            return;
        }
        setIsBasicInfoConfirmed(true);
        setIsInfoExpanded(false);
    };

    const holeData = holes[currentHole - 1];



    const updatePar = (par: number) => {
        if (holes[currentHole - 1].par === par) return; // 같은 Par 선택 시 초기화 방지
        
        setHoles(prev => {
            const next = [...prev];
            next[currentHole - 1] = {
                par,
                shots: getDefaultShots(par), // PAR 변경 시 샷 초기화
            };
            return next;
        });
    };

    const updateShotLocation = (shotIndex: number, location: string) => {
        setHoles(prev => {
            const next = [...prev];
            let shots = [...next[currentHole - 1].shots];
            shots[shotIndex] = { ...shots[shotIndex], location };

            if (location === "홀인") {
                // 홀인 이후 모든 샷 삭제
                shots = shots.slice(0, shotIndex + 1);

            } else if (location === "오비") {
                shots.splice(shotIndex + 1, 0, { location: "-", distance: "" });
                shots.splice(shotIndex + 2, 0, { location: "페어웨이", distance: "" });

            } else if (location === "패널티구역") {
                shots.splice(shotIndex + 1, 0, { location: "-", distance: "" });

            } else {
                // 일반: 마지막 행이 채워져 있으면 빈 행 추가
                const last = shots[shots.length - 1];
                if (last.location !== "" && last.location !== "홀인") {
                    shots.push({ location: "홀인", distance: "" });
                }
            }

            next[currentHole - 1] = { ...next[currentHole - 1], shots };
            return next;
        });
    };

    const updateShotDistance = (shotIndex: number, distance: string) => {
        setHoles(prev => {
            const next = [...prev];
            const shots = [...next[currentHole - 1].shots];
            shots[shotIndex] = { ...shots[shotIndex], distance };
            next[currentHole - 1] = { ...next[currentHole - 1], shots };
            return next;
        });
    };

    const updateShotMemo = (shotIndex: number, memo: string) => {
        setHoles(prev => {
            const next = [...prev];
            const shots = [...next[currentHole - 1].shots];
            shots[shotIndex] = { ...shots[shotIndex], memo };
            next[currentHole - 1] = { ...next[currentHole - 1], shots };
            return next;
        });
    };

    const holeScore = holeData.par > 0 ? calcHoleScore(holeData.shots, holeData.par) : 0;
    const isCurrentHoleComplete = holeData.shots.findIndex(s => s.location === "홀인" || s.location === "HI") > 0;

    // 합산 스코어 = 1번홀부터 현재 홀까지의 누적 타수 (언더파/오버파)
    const totalScore = holes.slice(0, currentHole).reduce((acc, h) => {
        return acc + calcHoleScore(h.shots, h.par);
    }, 0);

    const formatRelativeScore = (score: number) => {
        if (score > 0) return `+${score}`;
        if (score === 0) return "E";
        return `${score}`;
    };

    const getScoreColor = (score: number) => {
        if (score > 0) return "text-blue-500";
        if (score < 0) return "text-red-500";
        return "text-zinc-600 dark:text-zinc-400";
    };
    const unitSymbol = distanceUnit.includes("미터") ? "m" : "y";

    const handleSubmit = async (e: React.FormEvent, isPartial: boolean = false) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!selectedPlayer) {
            alert("선수를 선택해 주세요.");
            return;
        }
        if (!golfCourse.trim()) {
            setValidationError("골프장을 입력해 주세요.");
            // Scroll to validation error if needed (it's near the bottom now)
            return;
        }

        // Check for missing holes and missing distances
        const missingHoles: number[] = [];
        let firstErrorHole = -1;
        let completedCount = 0;

        for (let i = 0; i < 18; i++) {
            const h = holes[i];
            const hasAnyData = h.par > 0;

            if (!hasAnyData) continue; // Skip unplayed holes (par is 0)

            const hasHoleIn = h.shots.some(s => s.location === "홀인" || s.location === "HI");
            
            let hasMissingDist = false;
            if (hasHoleIn) {
                hasMissingDist = h.shots.some((shot, idx) => {
                    return checkDistanceRequired(idx, shot, h.shots, h.par) && (shot.distance === null || shot.distance === undefined || shot.distance.trim() === "");
                });
            }

            if (!hasHoleIn || hasMissingDist) {
                missingHoles.push(i + 1);
                if (firstErrorHole === -1) firstErrorHole = i + 1;
            } else {
                completedCount++;
            }
        }

        if (missingHoles.length > 0) {
            alert(`작성 중인 홀(${missingHoles.join(', ')})의 스코어를 전부 입력해주세요.`);
            setCurrentHole(firstErrorHole);
            return;
        }

        if (isPartial) {
            if (completedCount < 9) {
                alert(`최소 9개 이상의 홀을 작성해야 등록할 수 있습니다. (현재 ${completedCount}개)`);
                return;
            }
        } else {
            if (completedCount < 18) {
                alert("18홀 스코어를 전부 입력해주세요.");
                return;
            }
        }

        // Global validation for 30m rule across all filled holes
        const allowedCodesAt30m = ["GR", "GB", "GA", "HI", "-"];
        for (let i = 0; i < 18; i++) {
            const h = holes[i];
            const hasAnyData = h.par > 0 || h.shots.some(s => s.location !== "" && s.location !== "티박스");
            if (!hasAnyData) continue;

            let errorMsg: string | null = null;
            
            for (const shot of h.shots) {
                const distVal = shot.distance ? parseInt(shot.distance, 10) : NaN;
                if (!isNaN(distVal) && distVal > 0) {
                    const locName = (shot.location || "").trim();
                    const code = LOCATION_ABBR[locName] || locName;
                    
                    // 30m 이내 부적절 위치
                    if (distVal <= 30 && !allowedCodesAt30m.includes(code)) {
                        errorMsg = "30미터 안쪽은 그린주변 어프로치 혹은 그린주변 벙커를 선택해 주세요";
                        break;
                    }
                    
                    // 30m 초과 그린 혹은 그린주변 위치
                    if (distVal > 30 && (code === "GA" || code === "GB" || code === "GR")) {
                        errorMsg = "그린, 그린주변 어프로치 혹은 그린주변 벙커는 30미터 이내로 작성해 주세요";
                        break;
                    }
                }
            }

            if (errorMsg) {
                const holeNum = i + 1;
                setValidationError(`${holeNum}번 홀: ${errorMsg}`);
                setCurrentHole(holeNum);
                return;
            }
        }

        const computedTotalScore = holes.reduce((acc, h) => {
            if (h.par === 0) return acc;
            const idx = h.shots.findIndex(s => s.location === "홀인" || s.location === "HI");
            return acc + (idx > 0 ? idx : 0);
        }, 0);

        setIsSaving(true);
        try {
            const supabase = createClient();

            // 1. 선수 ID 조회
            const { data: userData, error: userErr } = await supabase
                .from("users")
                .select("id")
                .eq("name", selectedPlayer)
                .single();
            if (userErr || !userData) throw new Error(`선수 조회 실패: ${userErr?.message}`);
            const athleteId = userData.id;

            // 2. 로그인 유저(코치) ID
            const { data: { user } } = await supabase.auth.getUser();
            const coachId = user?.id ?? null;

            // 3. 스코어카드 헤더 저장 (Insert or Update)
            let scorecardId = draftIdRef.current || editId;

            if (scorecardId && scorecardId !== 'draft') {
                const { error: scErr } = await supabase
                    .from("scorecards")
                    .update({
                        total_score: computedTotalScore,
                        is_final: true,
                        hole_count: completedCount
                    })
                    .eq("id", scorecardId);
                if (scErr) throw new Error(`스코어카드 업데이트 실패: ${scErr.message}`);
            } else {
                const { data: sc, error: scErr } = await supabase
                    .from("scorecards")
                    .insert({
                        athlete_id:    athleteId,
                        coach_id:      coachId,
                        round_date:    roundDate,
                        course_name:   golfCourse,
                        weather:       category,
                        total_score:   computedTotalScore,
                        distance_unit: distanceUnit.includes("야드") ? "yard" : "meter",
                        is_final:      true,
                        hole_count:    completedCount
                    })
                    .select("id")
                    .single();
                if (scErr || !sc) throw new Error(`스코어카드 저장 실패: ${scErr?.message}`);
                scorecardId = sc.id;
            }

            // 4. 모든 홀 데이터를 배열로 준비 (Batch Insert용)
            const holesToInsert = holes
                .map((h, idx) => ({ h, idx }))
                .filter(({ h }) => h.par > 0)
                .map(({ h, idx }) => ({
                    scorecard_id: scorecardId,
                    hole_number:  idx + 1,
                    par:          h.par,
                    score:        calcHoleScore(h.shots, h.par) + h.par,
                }));

            // 5. 홀 데이터 저장 (수정 시 기존 데이터 삭제 후 재삽입)
            if (scorecardId && scorecardId !== 'draft') {
                // 기존 샷 데이터 먼저 삭제
                await supabase.from("scorecard_shots").delete().eq("scorecard_id", scorecardId);
                // 기존 홀 데이터 삭제
                await supabase.from("scorecard_holes").delete().eq("scorecard_id", scorecardId);
            }

            const { data: insertedHoles, error: holesErr } = await supabase
                .from("scorecard_holes")
                .insert(holesToInsert)
                .select("id, hole_number");
            
            if (holesErr || !insertedHoles) throw new Error(`홀 정보 저장 실패: ${holesErr?.message}`);

            // 6. 모든 샷 데이터를 배열로 준비 (Batch Insert용)
            const holeIdMap = new Map(insertedHoles.map(h => [h.hole_number, h.id]));
            const isYard = distanceUnit.includes("야드");
            
            const shotsToInsert: any[] = [];
            holes.forEach((h, hIdx) => {
                const holeNumber = hIdx + 1;
                const holeId = holeIdMap.get(holeNumber);
                if (!holeId) return;

                const validShots = h.shots.filter(s => s.location && s.location !== "");
                validShots.forEach((shot, sIdx) => {
                    // 야드 -> 미터 변환 로직
                    let distRaw = parseInt(shot.distance, 10);
                    let distMeter = distRaw;
                    if (isYard && !isNaN(distRaw)) {
                        distMeter = Math.round(distRaw * 0.9144); // 반올림하여 미터로 저장
                    }

                    const shotValue = encodeShotValue(shot.location, isNaN(distMeter) ? "" : distMeter.toString(), h.par, sIdx);
                    const code = LOCATION_ABBR[shot.location] ?? shot.location.toUpperCase();

                    shotsToInsert.push({
                        hole_id:       holeId,
                        scorecard_id:  scorecardId,
                        hole_number:   holeNumber,
                        shot_number:   sIdx + 1,
                        shot_value:    shotValue,
                        location_code: code,
                        distance:      (!isNaN(distMeter) && distMeter > 0) ? distMeter : null,
                        memo:          shot.memo || null,
                    });
                });
            });

            // 7. 샷 데이터 일괄 저장
            if (shotsToInsert.length > 0) {
                const { error: shotsErr } = await supabase
                    .from("scorecard_shots")
                    .insert(shotsToInsert);
                if (shotsErr) throw new Error(`샷 정보 저장 실패: ${shotsErr?.message}`);
            }

            // 8. 기록(records) 테이블에 활동 로그 추가 (최근 업데이트 연동)
            // 이미 완료된 스코어카드를 다시 수정하는 경우가 아닐 때만 자동 생성
            const isInitialSave = !isOriginallyFinal.current;
            if (isInitialSave) {
                await supabase.from("records").insert({
                    user_id: athleteId,
                    coach_id: coachId,
                    type: "analysis",
                    title: `${golfCourse} 분석 기록`,
                    category: category,
                    content: `${computedTotalScore}타 기록`,
                    related_id: scorecardId
                });

                // 8.5 복습 훈련(Review Training) 자동 배정 및 기존 복습 훈련 업데이트
                try {
                    const todayStr = formatLocalDate(new Date());

                    // (1) 기존 진행 중인 복습 훈련의 종료일을 오늘로 업데이트
                    const { data: existingReviews } = await supabase
                        .from("records")
                        .select("id")
                        .eq("type", "training")
                        .eq("user_id", athleteId)
                        .ilike("title", "%[복습]%")
                        .gte("training_end", todayStr);

                    if (existingReviews && existingReviews.length > 0) {
                        const reviewIds = existingReviews.map(r => r.id);
                        await supabase
                            .from("records")
                            .update({ training_end: todayStr })
                            .in("id", reviewIds);
                    }

                    // (2) 새로운 복습 훈련 배정 (18홀/9홀 무관)
                    const endDt = new Date();
                    endDt.setDate(endDt.getDate() + 6); // 7일간
                    const in7DaysStr = formatLocalDate(endDt);

                    const { calculateScorecardAnalysis } = await import("@/lib/score-calculations");
                    const { fetchScoreById } = await import("@/lib/score-sync");
                    
                    const analysis = await calculateScorecardAnalysis(scorecardId as string);
                    const recentScore = await fetchScoreById(scorecardId as string);
                    
                    const CATEGORY_TO_FIELD: Record<string, string> = {
                        "티샷 비거리": "distSG_DriverDist", "티샷 정확도": "distSG_DriverAcc",
                        "180M이상": "distSG_180Plus", "150-179M": "distSG_150_179",
                        "120-149M": "distSG_120_149", "90-119M": "distSG_90_119",
                        "피치샷": "distSG_Pitch31_89", "벙커": "distSG_Bunker",
                        "어프로치": "distSG_Approach",
                        "9M이상": "distSG_Putt9Plus", "4-8M": "distSG_Putt4_8",
                        "2-3M": "distSG_Putt2_3", "1M": "distSG_Putt1",
                    };
                    
                    let totalReviewTasks = 0;
                    if (analysis && analysis.length > 0) {
                        const cats = Object.entries(CATEGORY_TO_FIELD).map(([name, field]) => ({
                            name,
                            sg: analysis.reduce((s: any, h: any) => s + (h.summary as any)[field], 0)
                        }));
                        const positiveCats = cats.filter(c => c.sg > 0).sort((a, b) => b.sg - a.sg).slice(0, 5);

                        positiveCats.forEach(cat => {
                            const fieldName = CATEGORY_TO_FIELD[cat.name];
                            if (fieldName) {
                                const focusHoles = analysis.filter((h: any) => (h.summary as any)[fieldName] > 0).slice(0, 3);
                                totalReviewTasks += focusHoles.length;
                            }
                        });
                    }

                    await supabase.from("records").insert({
                        user_id: athleteId,
                        coach_id: coachId,
                        type: "training",
                        title: `[복습] ${roundDate.replace(/-/g, '.')}, ${golfCourse}`,
                        category: "review",
                        content: `스코어카드 기반 자동 생성된 복습 훈련입니다. (${completedCount}홀)`,
                        training_start: todayStr,
                        training_end: in7DaysStr,
                        template_settings: [{ type: "review_scorecard", scorecardId: scorecardId }],
                        total_count: Math.max(totalReviewTasks, 1)
                    });
                } catch (err) {
                    console.error("복습 훈련 생성 중 오류:", err);
                }
            }

            // 9. 로컬 임시 저장 데이터 삭제 (이제 더이상 사용되지 않지만 안전을 위해)
            localStorage.removeItem("gla_scorecard_draft");

            hasFinalized.current = true;
            alert("스코어카드가 등록되었습니다.");
            router.replace(`/scores/${scorecardId}`);

        } catch (err) {
            console.error("스코어카드 저장 오류:", err);
            alert(`저장 중 오류가 발생했습니다: ${(err as Error).message}`);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4 sm:px-8 py-6">
            <div className="max-w-3xl mx-auto">

                {/* ── Header ── */}
                <div className="flex items-center gap-3 mb-8">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-50 transition-colors"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                        스코어카드 작성
                    </h1>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">

                    {/* ── Box 1: Basic Info (Collapsible) ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">

                        {/* Header row — always visible */}
                        <button
                            type="button"
                            onClick={() => {
                                if (isInfoExpanded) {
                                    handleConfirmBasicInfo();
                                } else {
                                    setIsInfoExpanded(true);
                                }
                            }}
                            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                        >
                            <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">기본 정보</span>
                            <div className="flex items-center gap-2">
                                {!isInfoExpanded && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {selectedPlayer && (
                                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-navy/10 text-brand-navy dark:bg-brand-navy/20 dark:text-brand-navy-light">{selectedPlayer}</span>
                                        )}
                                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">{distanceUnit}</span>
                                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">{roundDate}</span>
                                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">{category}</span>
                                        {golfCourse && (
                                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 max-w-[120px] truncate">{golfCourse}</span>
                                        )}
                                    </div>
                                )}
                                <ChevronDown
                                    size={18}
                                    className={cn("text-zinc-400 transition-transform duration-200 shrink-0", isInfoExpanded && "rotate-180")}
                                />
                            </div>
                        </button>

                        {/* Expandable content */}
                        {isInfoExpanded && (
                            <div className="px-5 pb-5 border-t border-zinc-100 dark:border-zinc-800">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-5">

                                    {/* 선수 선택 */}
                                    <div className="space-y-2 relative">
                                        <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                            선수 선택 <span className="text-brand-red">*</span>
                                        </label>
                                        <AthleteSearch
                                            multi={false}
                                            selectedNames={selectedPlayer ? [selectedPlayer] : []}
                                            onSelect={(name: string) => !isEditMode && setSelectedPlayer(name)}
                                            onRemove={() => !isEditMode && setSelectedPlayer("")}
                                            placeholder={isEditMode ? selectedPlayer : "선수 이름을 검색하여 선택하세요..."}
                                        />
                                    </div>

                                    {/* 거리 단위 */}
                                    <div className="space-y-2">
                                        <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">거리 단위</label>
                                        <div className="relative">
                                            <select
                                                value={distanceUnit}
                                                onChange={(e) => setDistanceUnit(e.target.value)}
                                                disabled={isEditMode}
                                                className="w-full pl-4 pr-9 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all appearance-none disabled:opacity-60 disabled:bg-zinc-50 dark:disabled:bg-zinc-800/50"
                                            >
                                                <option value="미터 (m)">미터 (m)</option>
                                                <option value="야드 (y)">야드 (y)</option>
                                            </select>
                                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
                                        </div>
                                    </div>

                                    {/* 라운드 일자 */}
                                    <div className="space-y-2">
                                        <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                            라운드 일자 <span className="text-brand-red">*</span>
                                        </label>
                                        <div className="relative">
                                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                            <DatePickerInput
                                                value={roundDate}
                                                onChange={(e) => setRoundDate(e.target.value)}
                                                required
                                                disabled={isEditMode}
                                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all text-center disabled:opacity-60 disabled:bg-zinc-50 dark:disabled:bg-zinc-800/50"
                                            />
                                        </div>
                                    </div>

                                    {/* 구분 */}
                                    <div className="space-y-2">
                                        <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">구분</label>
                                        <div className="relative">
                                            <select
                                                value={category}
                                                onChange={(e) => setCategory(e.target.value)}
                                                disabled={isEditMode}
                                                className="w-full pl-4 pr-9 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all appearance-none disabled:opacity-60 disabled:bg-zinc-50 dark:disabled:bg-zinc-800/50"
                                            >
                                                <option value="연습">연습</option>
                                                <option value="대회">대회</option>
                                            </select>
                                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
                                        </div>
                                    </div>

                                    {/* 골프장 */}
                                    <div className="space-y-2 md:col-span-2">
                                        <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                            골프장 <span className="text-brand-red">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="골프장을 입력해 주세요."
                                            required
                                            value={golfCourse}
                                            onChange={(e) => setGolfCourse(e.target.value)}
                                            disabled={isEditMode}
                                            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all disabled:opacity-60 disabled:bg-zinc-50 dark:disabled:bg-zinc-800/50"
                                        />
                                    </div>
                                </div>

                                {/* 확인 버튼 */}
                                <div className="mt-4 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={handleConfirmBasicInfo}
                                        className="px-5 py-2 rounded-xl text-sm font-semibold bg-brand-navy text-white hover:bg-brand-navy/90 transition-colors shadow-sm"
                                    >
                                        확인
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>

                    {/* ── Box 2: Hole-by-hole input ── */}
                    <section
                        className={cn(
                            "relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-5 transition-all duration-300",
                            !isBasicInfoConfirmed && "opacity-40 pointer-events-none grayscale-[0.2]"
                        )}
                        onTouchStart={handleTouchStart}
                        onTouchEnd={handleTouchEnd}
                    >
                        {!isBasicInfoConfirmed && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/5 dark:bg-black/5 backdrop-blur-[1px] rounded-2xl">
                                <p className="text-sm font-bold text-zinc-500 bg-white/80 dark:bg-zinc-900/80 px-4 py-2 rounded-full shadow-sm border border-zinc-100 dark:border-zinc-800">
                                    상단 기본 정보를 입력 후 [확인]을 눌러주세요.
                                </p>
                            </div>
                        )}





                        {/* Hole Navigation */}
                        <div className="flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => setCurrentHole(prev => Math.max(1, prev - 1))}
                                disabled={currentHole === 1}
                                className="flex items-center gap-1 text-sm font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white disabled:opacity-25 transition-all"
                            >
                                <ChevronLeft size={18} /> 이전 홀
                            </button>
                            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Hole {currentHole}</h2>
                            <button
                                type="button"
                                onClick={() => saveCurrentAndNext(false)}
                                disabled={currentHole === 18}
                                className="flex items-center gap-1 text-sm font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:white disabled:opacity-25 transition-all"
                            >
                                다음 홀 <ChevronRight size={18} />
                            </button>
                        </div>

                        {/* Score Banner */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl px-5 py-3 flex justify-between items-center">
                            <span className="text-sm font-semibold text-brand-navy dark:text-blue-300">이번홀: {isCurrentHoleComplete ? <span className={getScoreColor(holeScore)}>{formatRelativeScore(holeScore)}</span> : "-"}</span>
                            <span className={cn("text-sm font-black", totalScore < 0 ? "text-red-500" : totalScore > 0 ? "text-blue-500" : "text-zinc-600 dark:text-zinc-300")}>
                                합산 스코어: {formatRelativeScore(totalScore)}
                            </span>
                        </div>

                        {/* Par Selection */}
                        <div className="flex flex-col items-center gap-3">
                            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Par</span>
                            <div className="flex gap-3">
                                {[3, 4, 5].map(p => (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => updatePar(p)}
                                        className={cn(
                                            "w-14 h-14 rounded-xl border-2 font-bold text-lg transition-all",
                                            holeData.par === p
                                                ? "bg-brand-navy text-white border-brand-navy shadow-md"
                                                : "bg-transparent dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400"
                                        )}
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Shots Table */}
                        {holeData.par > 0 && (
                            <div className="overflow-hidden rounded-xl border border-zinc-100 dark:border-zinc-800">
                            {/* Header */}
                            <div className="grid grid-cols-[36px_minmax(0,1fr)_90px] gap-2 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800 px-2 py-2.5 text-xs font-semibold text-zinc-500 text-center items-center">
                                <div>샷</div>
                                <div>볼 위치</div>
                                <div>홀까지 남은거리</div>
                            </div>

                            {/* Rows */}
                            <div className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
                                {holeData.shots.map((shot, idx) => {
                                    const prevLoc = holeData.shots[idx - 1]?.location;
                                    const isDisabled =
                                        shot.location === "홀인" ||
                                        (idx === 0 && holeData.par !== 3) ||
                                        shot.location === "오비" ||
                                        shot.location === "패널티구역" ||
                                        prevLoc === "오비";
                                    
                                    // Find if this is the very first empty required field
                                    const isCurrentTarget = holeData.shots.findIndex((s, i) => {
                                        const pLoc = holeData.shots[i - 1]?.location;
                                        const isDis = s.location === "홀인" || (i === 0 && holeData.par !== 3) || s.location === "오비" || s.location === "패널티구역" || pLoc === "오비";
                                        return !isDis && (!s.distance || s.distance.trim() === "");
                                    }) === idx;

                                    const hasError = !isDisabled && distanceErrors.has(idx);
                                    const shouldHighlight = hasError || isCurrentTarget;

                                    return (
                                        <div key={idx} className={cn(
                                            "flex flex-col px-2 py-2 gap-2 border-b border-zinc-50 dark:border-zinc-800/60 last:border-0 transition-colors",
                                            shouldHighlight ? "bg-red-50 dark:bg-red-900/20" : ""
                                        )}>
                                            <div className="grid grid-cols-[36px_minmax(0,1fr)_90px] items-center gap-2">
                                                {/* Shot index */}
                                                <div className="flex items-center justify-center text-sm font-semibold text-zinc-400">{idx}</div>

                                                {/* Ball location — native select on desktop, bottom sheet on mobile */}
                                                {idx === 0 ? (
                                                    <div className="px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-sm font-medium text-zinc-500 text-center border border-zinc-200 dark:border-zinc-700">
                                                        티박스
                                                    </div>
                                                ) : (() => {
                                                    const isLocLocked = prevLoc === "오비" || prevLoc === "패널티구역";

                                                    if (isLocLocked) {
                                                        // 회색 고정 셀 (수정 불가)
                                                        return (
                                                            <div className="px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-sm font-medium text-zinc-400 text-center border border-zinc-100 dark:border-zinc-800">
                                                                {shot.location || "-"}
                                                            </div>
                                                        );
                                                    }
                                                    return (
                                                        <>
                                                            {/* Desktop: native select */}
                                                            <div className="relative hidden md:block">
                                                                <select
                                                                    value={shot.location}
                                                                    onChange={(e) => updateShotLocation(idx, e.target.value)}
                                                                    className={cn(
                                                                        "w-full pl-3 pr-7 py-2 rounded-lg border text-sm font-medium text-center focus:outline-none focus:ring-2 transition-all appearance-none",
                                                                        shouldHighlight ? "bg-white dark:bg-zinc-800 border-red-200 dark:border-red-900/50 text-zinc-900 dark:text-zinc-100 focus:ring-red-300" : "bg-transparent dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:ring-brand-navy/30"
                                                                    )}
                                                                    style={{ textAlignLast: "center" }}
                                                                >
                                                                    <option value="">-</option>
                                                                    {BALL_LOCATIONS.map(loc => (
                                                                        <option key={loc} value={loc}>{loc}</option>
                                                                    ))}
                                                                </select>
                                                                <ChevronDown size={13} className={cn("absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none", shouldHighlight ? "text-red-400" : "text-zinc-400")} />
                                                            </div>

                                                            {/* Mobile: custom button → bottom sheet */}
                                                            <button
                                                                type="button"
                                                                onClick={() => setOpenPickerShotIndex(idx)}
                                                                className={cn(
                                                                    "md:hidden w-full flex items-center justify-between pl-3 pr-2 py-2 rounded-lg border text-sm font-medium transition-colors",
                                                                    shouldHighlight ? "bg-white dark:bg-zinc-800 border-red-200 dark:border-red-900/50 text-zinc-900 dark:text-zinc-100" : "bg-transparent dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 hover:border-brand-navy/40"
                                                                )}
                                                            >
                                                                <span className="flex-1 text-center truncate">{shot.location || "-"}</span>
                                                                <ChevronDown size={13} className={cn("shrink-0 ml-1", shouldHighlight ? "text-red-400" : "text-zinc-400")} />
                                                            </button>
                                                        </>
                                                    );
                                                })()}

                                                {/* Distance Input */}
                                                <div className="relative w-full">
                                                    {(() => {
                                                        return (
                                                        <input
                                                            type="number"
                                                            value={shot.distance}
                                                            onChange={(e) => {
                                                                updateShotDistance(idx, e.target.value);
                                                                if (e.target.value.trim() !== "") {
                                                                    setDistanceErrors(prev => {
                                                                        const next = new Set(prev);
                                                                        next.delete(idx);
                                                                        return next;
                                                                    });
                                                                }
                                                            }}
                                                            disabled={isDisabled}
                                                            className={cn(
                                                                "w-full pl-2 pr-6 py-2 rounded-lg border text-sm font-medium text-right focus:outline-none focus:ring-2 transition-all",
                                                                isDisabled
                                                                    ? "bg-zinc-50 dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 text-zinc-300"
                                                                    : shouldHighlight
                                                                        ? "bg-white dark:bg-red-900/40 border-red-400 dark:border-red-500 text-zinc-900 dark:text-zinc-100 focus:ring-red-300"
                                                                        : "bg-transparent dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:ring-brand-navy/30"
                                                            )}
                                                        />
                                                    );
                                                })()}
                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-medium text-zinc-400">{unitSymbol}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        </div>
                        )}

                        {/* Validation Error Message */}
                        {validationError && (
                            <div className="mb-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-3 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
                                <X className="text-red-500 shrink-0" size={18} />
                                <p className="text-sm font-semibold text-red-600 dark:text-red-400 leading-snug">{validationError}</p>
                                <button type="button" onClick={() => setValidationError(null)} className="ml-auto text-red-400 hover:text-red-600">
                                    <X size={14} />
                                </button>
                            </div>
                        )}

                        {/* Strokes Gained Table (Dynamic Display) will be moved below */}
                        {/* 샷별 점수 확인 & 다음홀 버튼 */}
                        <div className="flex justify-end gap-3 pt-1">
                            <button
                                type="button"
                                onClick={() => saveCurrentAndNext(true, false)}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-brand-navy text-brand-navy hover:bg-brand-navy/5 transition-colors shadow-sm"
                            >
                                샷별 점수 확인
                            </button>
                            <button
                                type="button"
                                onClick={() => saveCurrentAndNext(true, true)}
                                disabled={currentHole === 18}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-brand-navy text-white hover:bg-brand-navy/90 disabled:opacity-40 transition-colors shadow-sm"
                            >
                                저장 & 다음홀 <ChevronRight size={16} />
                            </button>
                        </div>

                        </section>

                    {/* Strokes Gained Table (Moved here) */}
                    {(() => {
                        const currentAnalysis = holeAnalyses.find(a => a.holeNumber === currentHole);
                        if (!showSgTable || !currentAnalysis || currentAnalysis.shots.length === 0) return null;
                        
                        return (
                            <div className="mt-4 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-sm">
                                <div className="grid grid-cols-[40px_1.5fr_1fr] bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-800">
                                    <div className="px-2 py-2.5 text-sm font-bold text-zinc-700 dark:text-zinc-300 text-center">샷</div>
                                    <div className="px-4 py-2.5 text-sm font-bold text-zinc-700 dark:text-zinc-300 text-center border-l border-zinc-200 dark:border-zinc-800">내용</div>
                                    <div className="px-4 py-2.5 text-sm font-bold text-zinc-900 dark:text-white border-l border-zinc-200 dark:border-zinc-800 text-center flex items-center justify-center">점수</div>
                                </div>
                                

                                {/* Shot-by-shot SG */}
                                {currentAnalysis.shots.map((shot: any, i: number) => (
                                    <div key={i} className="grid grid-cols-[40px_1.5fr_1fr] border-b border-zinc-100 dark:border-zinc-800/60 items-stretch">
                                        <div className="px-2 py-2 text-sm font-bold text-zinc-500 dark:text-zinc-400 text-center flex items-center justify-center bg-zinc-50/30 dark:bg-zinc-800/20">
                                            {i + 1}
                                        </div>
                                        <div className="px-4 py-2 flex flex-col justify-center pl-6 sm:pl-8 border-l border-zinc-100 dark:border-zinc-800/60">
                                            <div className="flex items-center gap-2">
                                                <span className="w-1 h-3 bg-orange-500 rounded-full shrink-0"></span>
                                                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate">
                                                    {(() => {
                                                        let loc = holeData.shots[i]?.location || "-";
                                                        if (loc === "-" && i > 0 && holeData.shots[i - 1]?.location === "오비") {
                                                            loc = "프로비저널볼";
                                                        } else {
                                                            loc = loc.replace('그린 주변 어프로치', '어프로치').replace('그린 주변 벙커', '벙커').replace('티박스', '티샷');
                                                        }
                                                        const dist = holeData.shots[i]?.distance;
                                                        const isHoleIn = holeData.shots[i]?.location === "홀인";
                                                        return `${loc}${dist && !isHoleIn ? ` / ${dist}${unitSymbol}` : ""}`;
                                                    })()}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="relative px-3 py-2 text-sm font-bold border-l border-zinc-100 dark:border-zinc-800/60 text-center flex items-center justify-center">
                                            <span className={shot.shotSG < 0 ? 'text-red-500' : shot.shotSG > 0 ? 'text-blue-500' : 'text-zinc-600 dark:text-zinc-400'}>
                                                {shot.shotSG === 0 ? "0.0" : shot.shotSG.toFixed(1)}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setEditingMemoIndex(i)}
                                                className={cn(
                                                    "absolute right-2 p-1.5 rounded-lg transition-colors border",
                                                    holeData.shots[i]?.memo 
                                                        ? "bg-brand-navy/5 border-brand-navy/30 text-brand-navy dark:bg-brand-navy/20 dark:border-brand-navy/50 dark:text-brand-navy-light" 
                                                        : "bg-transparent border-transparent text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                                )}
                                            >
                                                <MessageSquare size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {/* 총계 (Total SG) */}
                                <div className="grid grid-cols-[40px_1.5fr_1fr] border-t border-zinc-100 dark:border-zinc-800/60 items-stretch bg-zinc-50/50 dark:bg-zinc-800/30">
                                    <div className="col-span-2 px-4 py-2.5 text-sm font-bold text-zinc-700 dark:text-zinc-300 text-center flex items-center justify-center">총계</div>
                                    <div className="px-4 py-2.5 text-sm font-bold border-l border-zinc-100 dark:border-zinc-800/60 text-center flex items-center justify-center">
                                        <span className={currentAnalysis.totalSG < 0 ? 'text-red-500' : currentAnalysis.totalSG > 0 ? 'text-blue-500' : 'text-zinc-600 dark:text-zinc-400'}>
                                            {currentAnalysis.totalSG === 0 ? "0.0" : currentAnalysis.totalSG.toFixed(1)}
                                        </span>
                                    </div>
                                </div>
                                
                                {/* 하단 '저장 & 다음홀' 버튼 (표 아래) */}
                                <div className="p-3 border-t border-zinc-100 dark:border-zinc-800/60 bg-white dark:bg-zinc-900 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => saveCurrentAndNext(true, true)}
                                        disabled={currentHole === 18}
                                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-brand-navy text-white hover:bg-brand-navy/90 disabled:opacity-40 transition-colors shadow-sm"
                                    >
                                        저장 & 다음홀 <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        );
                    })()}

                    {/* ── Footer Actions ── */}
                    <div className="flex items-center justify-end gap-1.5 sm:gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800 overflow-x-auto scrollbar-hide">
                        <button
                            type="button"
                            onClick={submitNineHoles}
                            className="mr-auto px-2.5 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm whitespace-nowrap font-semibold border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                            9홀 스코어만 등록
                        </button>

                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="px-3 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm whitespace-nowrap font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={!isAllHolesCompleted || isSaving}
                            className="bg-brand-navy hover:bg-brand-navy/90 disabled:bg-zinc-200 disabled:text-zinc-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600 text-white px-3 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm whitespace-nowrap font-semibold transition-colors shadow-sm flex items-center gap-1.5 shrink-0"
                        >
                            {isSaving ? (
                                <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />저장 중...</>
                            ) : "스코어 등록"}
                        </button>
                    </div>

                </form>
            </div>

            {/* ── Bottom Sheet Picker ── */}
            <BottomSheetPicker
                isOpen={openPickerShotIndex >= 0}
                onClose={() => setOpenPickerShotIndex(-1)}
                options={BALL_LOCATIONS}
                value={openPickerShotIndex >= 0 ? holeData.shots[openPickerShotIndex]?.location ?? "" : ""}
                onSelect={(val) => {
                    if (openPickerShotIndex >= 0) updateShotLocation(openPickerShotIndex, val);
                }}
                title="볼 위치 선택"
            />

            {/* ── Memo Popup Modal ── */}
            {editingMemoIndex !== null && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
                            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">샷 메모 작성 ({editingMemoIndex + 1}번째 샷)</h3>
                            <button
                                onClick={() => setEditingMemoIndex(null)}
                                className="p-1 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-5">
                            <textarea
                                value={holeData.shots[editingMemoIndex]?.memo || ""}
                                onChange={(e) => updateShotMemo(editingMemoIndex, e.target.value)}
                                placeholder="샷에 대한 원인이나 결과 등을 간단히 기록해 주세요"
                                className="w-full h-32 px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400/60 dark:placeholder:text-zinc-600/60 focus:outline-none focus:ring-2 focus:ring-brand-navy/30 transition-all resize-none"
                                autoFocus
                            />
                        </div>
                        <div className="px-5 py-4 bg-zinc-50 dark:bg-zinc-800/30 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
                            <button
                                onClick={() => setEditingMemoIndex(null)}
                                className="px-6 py-2 bg-brand-navy hover:bg-brand-navy/90 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
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
