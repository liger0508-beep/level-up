"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
    ChevronLeft,
    User,
    Phone,
    Mail,
    MapPin,
    Calendar,
    Shield,
    Edit2,
    Save,
    X,
    Key,
    UserCheck,
    UserMinus,
    UserX,
    Clock,
    Hash,
    Users,
    UserCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──
type CoachStatus = "active" | "paused";

interface CoachDetail {
    id: string;
    name: string;
    phone: string;
    email: string;
    loginId: string;
    branch: string;
    registeredAt: string;
    status: CoachStatus;
    gender: string;
    birthDate: string;
    assignedAthletes: string; // Comma separated for simplicity in mock
    memo: string;
}

// ── Status metadata ──
const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: typeof UserCheck }> = {
    active: { label: "재직", color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20", icon: UserCheck },
    paused: { label: "휴직", color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-500/10 border-amber-200 dark:border-amber-500/20", icon: UserMinus },
};


// ── Info Row Component ──
function InfoRow({ icon: Icon, label, value, editable, editValue, onEdit, isEditing, options }: {
    icon: any;
    label: string;
    value: string;
    editable?: boolean;
    editValue?: string;
    onEdit?: (v: string) => void;
    isEditing?: boolean;
    options?: string[];
}) {
    return (
        <div className="flex items-start gap-3 py-3">
            <div className="shrink-0 w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mt-0.5">
                <Icon size={15} className="text-zinc-400" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">
                    {label}
                </p>
                {isEditing && editable && onEdit ? (
                    options ? (
                        <div className="relative">
                            <select
                                value={editValue ?? value}
                                onChange={(e) => onEdit(e.target.value)}
                                className="w-full text-sm font-semibold text-zinc-900 dark:text-zinc-100 bg-transparent border-b-2 border-brand-navy/40 focus:border-brand-navy focus:outline-none py-0.5 transition-colors cursor-pointer appearance-none"
                            >
                                <option value="미지정">미지정</option>
                                {options.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <input
                            type="text"
                            value={editValue ?? value}
                            onChange={(e) => onEdit(e.target.value)}
                            className="w-full text-sm font-semibold text-zinc-900 dark:text-zinc-100 bg-transparent border-b-2 border-brand-navy/40 focus:border-brand-navy focus:outline-none py-0.5 transition-colors"
                        />
                    )
                ) : (
                    <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 break-all">
                        {value || <span className="text-zinc-300 dark:text-zinc-600 font-normal italic">미입력</span>}
                    </p>
                )}
            </div>
        </div>
    );
}

export default function CoachDetailPage() {
    const router = useRouter();
    const params = useParams();
    const coachId = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";

    const [coach, setCoach] = useState<CoachDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState<CoachDetail | null>(null);
    const [saveMessage, setSaveMessage] = useState("");
    const [availableBranches, setAvailableBranches] = useState<string[]>(["총괄", "오피스", "조이마루점", "구미점"]);

    useEffect(() => {
        const fetchCoach = async () => {
            if (!coachId) return;
            setIsLoading(true);
            try {
                const supabase = createClient();
                
                // Fetch branches
                const { data: branchesData } = await supabase.from('users').select('branch');
                const standardBranches = ["총괄", "오피스", "조이마루점", "구미점"];
                let allBranches = [...standardBranches];
                if (branchesData) {
                    const dynamicBranches = branchesData.map(b => b.branch).filter(v => v && v !== "미지정" && v !== "" && !standardBranches.includes(v));
                    allBranches = [...allBranches, ...Array.from(new Set(dynamicBranches))];
                }
                setAvailableBranches(allBranches as string[]);

                const { data, error } = await supabase
                    .from("users")
                    .select("*")
                    .eq("id", coachId)
                    .single();

                if (error) throw error;
                if (data) {
                    const loaded: CoachDetail = {
                        id: data.id,
                        name: data.name,
                        phone: data.phone || "",
                        email: data.email || "",
                        loginId: data.login_id || "",
                        branch: data.branch || "미지정",
                        registeredAt: data.created_at ? data.created_at.split('T')[0] : "",
                        status: data.status === "휴직" ? "paused" : "active",
                        gender: data.gender === "male" ? "남" : data.gender === "female" ? "여" : (data.gender === "other" ? "기타" : "미지정"),
                        birthDate: data.dob || "",
                        assignedAthletes: data.assigned_athletes || "",
                        memo: data.memo || "",
                    };
                    setCoach(loaded);
                    setEditData(loaded);
                }
            } catch (err) {
                console.error("Failed to load coach detail:", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchCoach();
    }, [coachId]);

    const status = statusConfig[coach?.status || "active"];
    const StatusIcon = status?.icon || UserCheck;

    const handleSave = async () => {
        if (!editData) return;
        try {
            const supabase = createClient();
            const saveBranch = editData.branch === "미지정" ? null : editData.branch;
            const saveGender = editData.gender === '남' ? 'male' : editData.gender === '여' ? 'female' : (editData.gender === '기타' ? 'other' : null);

            const { error } = await supabase
                .from("users")
                .update({
                    name: editData.name,
                    phone: editData.phone,
                    branch: saveBranch,
                    gender: saveGender,
                    status: editData.status === "paused" ? "휴직" : "재직",
                    memo: editData.memo || null,
                    assigned_athletes: editData.assignedAthletes || null,
                    dob: editData.birthDate || null
                })
                .eq("id", coachId);

            if (error) {
                console.error("Save error full detail:", error);
                const msg = error.message || "알 수 없는 오류";
                const details = (error as any).details || "";
                alert(`저장에 실패했습니다: ${msg}${details ? `\n상세: ${details}` : ""}`);
                return;
            }

            setCoach(editData);
            setIsEditing(false);
            setSaveMessage("코치 정보가 저장되었습니다.");
            setTimeout(() => setSaveMessage(""), 3000);
        } catch (err: any) {
            console.error("Failed to save coach:", err);
            alert(`저장 중 오류가 발생했습니다: ${err.message}`);
        }
    };

    const handleCancel = () => {
        if (coach) setEditData({ ...coach });
        setIsEditing(false);
    };

    const updateField = (field: keyof CoachDetail, value: string) => {
        if (editData) {
            setEditData(prev => prev ? ({ ...prev, [field]: value }) : prev);
        }
    };

    if (isLoading) {
        return <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">로딩 중...</div>;
    }

    if (!coach || !editData) {
        return <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">코치를 찾을 수 없습니다.</div>;
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-24">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-zinc-50/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
                <div className="max-w-3xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.back()}
                            className="p-2 -ml-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-50 transition-colors"
                        >
                            <ChevronLeft size={24} />
                        </button>
                        <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                            코치 프로필
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">
                        {isEditing ? (
                            <>
                                <button onClick={handleCancel} className="px-3 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-700 rounded-xl">취소</button>
                                <button onClick={handleSave} className="flex items-center gap-1 px-4 py-2 bg-brand-navy text-white text-sm font-semibold rounded-xl">저장</button>
                            </>
                        ) : (
                            <button onClick={() => setIsEditing(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-zinc-600 border border-zinc-200 rounded-xl">수정</button>
                        )}
                    </div>
                </div>
            </header>

            {/* Save Toast */}
            {saveMessage && (
                <div className="fixed top-20 right-8 z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="bg-emerald-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg">
                        {saveMessage}
                    </div>
                </div>
            )}

            <main className="max-w-3xl mx-auto px-4 sm:px-8 py-6 space-y-5">
                {/* ── Profile Card ── */}
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
                    <div className="h-20 bg-gradient-to-r from-brand-navy to-blue-500 relative">
                        <div className="absolute -bottom-10 left-6">
                            <div className="w-20 h-20 rounded-2xl bg-white dark:bg-zinc-800 border-4 border-white dark:border-zinc-900 shadow-md flex items-center justify-center">
                                <UserCircle size={48} className="text-zinc-300" />
                            </div>
                        </div>
                    </div>
                    <div className="pt-14 px-6 pb-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-50">{coach.name}</h2>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{coach.branch}</p>
                            </div>
                            <span className={cn("inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border", status.bgColor, status.color)}>
                                <StatusIcon size={13} />
                                {status.label}
                            </span>
                        </div>

                        {/* Status Change (Edit Mode) */}
                        {isEditing && (
                            <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800/50">
                                <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-2">근무 현황 변경</p>
                                <div className="flex gap-2">
                                    {(["active", "paused"] as const).map(s => {
                                        const sc = statusConfig[s];
                                        const ScIcon = sc.icon;
                                        return (
                                            <button
                                                key={s}
                                                onClick={() => updateField("status", s)}
                                                className={cn(
                                                    "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all",
                                                    editData.status === s
                                                        ? `${sc.bgColor} ${sc.color} ring-2 ring-offset-1 ring-brand-navy/20`
                                                        : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500"
                                                )}
                                            >
                                                <ScIcon size={12} />
                                                {sc.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* ── Details ── */}
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0 divide-y md:divide-y-0 divide-zinc-100 dark:divide-zinc-800/50">
                    <div className="space-y-0">
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-2 mt-4 md:mt-0">기본 정보</h3>
                        <InfoRow icon={User} label="이름" value={coach.name} editable={isEditing} editValue={editData.name} onEdit={(v) => updateField("name", v)} isEditing={isEditing} />
                        <InfoRow icon={Phone} label="연락처" value={coach.phone} editable={isEditing} editValue={editData.phone} onEdit={(v) => updateField("phone", v)} isEditing={isEditing} />
                        <InfoRow icon={Mail} label="이메일" value={coach.email} editable={isEditing} editValue={editData.email} onEdit={(v) => updateField("email", v)} isEditing={isEditing} />
                        <InfoRow icon={User} label="성별" value={coach.gender} editable={isEditing} editValue={editData.gender} onEdit={(v) => updateField("gender", v)} isEditing={isEditing} options={["남", "여"]} />
                        <InfoRow icon={Calendar} label="생년월일" value={coach.birthDate} editable={isEditing} editValue={editData.birthDate} onEdit={(v) => updateField("birthDate", v)} isEditing={isEditing} />
                    </div>
                    <div className="space-y-0 border-t md:border-t-0 pt-4 md:pt-0">
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-2">업무 정보</h3>
                        <InfoRow icon={MapPin} label="소속 지점" value={coach.branch} editable={isEditing} editValue={editData.branch} onEdit={(v) => updateField("branch", v)} isEditing={isEditing} options={availableBranches} />
                        <InfoRow icon={Hash} label="ID" value={coach.loginId} />
                    </div>
                </section>

                {/* ── Assigned Athletes ── */}
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-3">담당 선수</h3>
                    {isEditing ? (
                        <input
                            type="text"
                            value={editData.assignedAthletes}
                            onChange={(e) => updateField("assignedAthletes", e.target.value)}
                            placeholder="담당 선수를 입력하세요 (쉼표로 구분)..."
                            className="w-full text-sm font-semibold text-zinc-900 dark:text-zinc-100 bg-transparent border-b-2 border-brand-navy/40 focus:border-brand-navy focus:outline-none py-1 transition-colors"
                        />
                    ) : (
                        <p className="text-sm text-zinc-700 dark:text-zinc-300 font-semibold bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl">
                            {coach.assignedAthletes || <span className="text-zinc-300 italic">배정된 선수가 없습니다.</span>}
                        </p>
                    )}
                </section>

                {/* ── Memo ── */}
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-3">메모</h3>
                    {isEditing ? (
                        <textarea
                            value={editData.memo}
                            onChange={(e) => updateField("memo", e.target.value)}
                            rows={3}
                            className="w-full p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all"
                        />
                    ) : (
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl">
                            {coach.memo || <span className="text-zinc-300 italic">메모가 없습니다.</span>}
                        </p>
                    )}
                </section>
            </main>
        </div>
    );
}
