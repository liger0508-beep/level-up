"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
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
    Loader2,
    UserCircle,
    Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

// ── Types ──
type RegistrationStatus = "active" | "paused" | "inactive";

interface AthleteDetail {
    id: string;
    name: string;
    phone: string;
    age: number;
    birthDate: string;
    email: string;
    loginId: string;
    branch: string;
    registeredAt: string;
    status: RegistrationStatus;
    gender: string;
    parentName: string;
    parentPhone: string;
    coachName: string;
    memo: string;
    level: string;
}

// ── Status metadata ──
const statusConfig: Record<RegistrationStatus, { label: string; color: string; bgColor: string; icon: typeof UserCheck }> = {
    active: { label: "등록", color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20", icon: UserCheck },
    paused: { label: "휴회", color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-500/10 border-amber-200 dark:border-amber-500/20", icon: UserMinus },
    inactive: { label: "비활성화", color: "text-red-500 dark:text-red-400", bgColor: "bg-red-500/10 border-red-200 dark:border-red-500/20", icon: UserX },
};

// ── Info Row Component ──
function InfoRow({ icon: Icon, label, value, editable, editValue, onEdit, isEditing, options }: {
    icon: typeof User;
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
                                {options.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                                <option value="미지정">미지정</option>
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

// ── Main Page ──
export default function AthleteDetailPage() {
    const router = useRouter();
    const params = useParams();
    const supabase = createClient();
    const athleteId = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";

    const [athlete, setAthlete] = useState<AthleteDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState<AthleteDetail | null>(null);
    const [saveMessage, setSaveMessage] = useState("");
    const [availableBranches, setAvailableBranches] = useState<string[]>(["총괄", "오피스", "조이마루점", "구미점"]);

    useEffect(() => {
        if (!athleteId) return;

        async function fetchAthlete() {
            setLoading(true);
            try {
                // Fetch branch list dynamically from existing users and include standard ones
                const { data: branchesData } = await supabase
                    .from('users')
                    .select('branch');
                
                // Start with standard branches
                const standardBranches = ["총괄", "오피스", "조이마루점", "구미점"];
                let allBranches = [...standardBranches];

                if (branchesData) {
                    const dynamicBranches = branchesData
                        .map(b => b.branch)
                        .filter(v => v && v !== "미지정" && v !== "" && !standardBranches.includes(v));
                    allBranches = [...allBranches, ...Array.from(new Set(dynamicBranches))];
                }
                
                setAvailableBranches(allBranches as string[]);

                const { data: u, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', athleteId)
                    .single();

                if (u) {
                    const detail: AthleteDetail = {
                        id: u.id,
                        name: u.name,
                        phone: u.phone || "",
                        age: u.dob ? (new Date().getFullYear() - new Date(u.dob).getFullYear()) : 0,
                        birthDate: u.dob || "",
                        email: "", // User requested blank
                        loginId: "", // User requested blank
                        branch: u.branch || "미지정",
                        registeredAt: u.created_at?.split('T')[0] || "",
                        status: u.status === "휴회" ? "paused" : (u.status === "비활성화" ? "inactive" : "active"),
                        gender: u.gender === 'male' ? '남' : u.gender === 'female' ? '여' : (u.gender === 'other' ? '기타' : '미지정'),
                        parentName: u.parent_name || "",
                        parentPhone: u.parent_phone || "",
                        coachName: u.coach_name || "담당 없음",
                        memo: u.memo || "",
                        level: u.level || "미지정"
                    };
                    setAthlete(detail);
                    setEditData(detail);
                }
            } catch (err) {
                console.error("Error fetching athlete:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchAthlete();
    }, [athleteId]);

    const handleSave = async () => {
        if (!editData || !athleteId) return;

        try {
            const saveBranch = editData.branch === "미지정" ? null : editData.branch;
            const saveCoach = editData.coachName === "담당 없음" ? null : editData.coachName;
            const saveGender = editData.gender === '남' ? 'male' : editData.gender === '여' ? 'female' : (editData.gender === '기타' ? 'other' : null);

            console.log("Saving athlete data...", {
                id: athleteId,
                original: athlete,
                editing: editData,
                payload: {
                    name: editData.name,
                    phone: editData.phone,
                    branch: saveBranch,
                    status: editData.status === "paused" ? "휴회" : editData.status === "inactive" ? "비활성화" : "등록",
                    gender: saveGender,
                    parent_name: editData.parentName || null,
                    parent_phone: editData.parentPhone || null,
                    coach_name: saveCoach,
                    memo: editData.memo || null,
                    level: editData.level === "미지정" ? null : editData.level,
                    dob: editData.birthDate || null
                }
            });

            const { data: updatedArray, error } = await supabase
                .from('users')
                .update({
                    name: editData.name,
                    phone: editData.phone,
                    branch: saveBranch,
                    status: editData.status === "paused" ? "휴회" : editData.status === "inactive" ? "비활성화" : "등록",
                    gender: saveGender,
                    parent_name: editData.parentName || null,
                    parent_phone: editData.parentPhone || null,
                    coach_name: saveCoach,
                    memo: editData.memo || null,
                    level: editData.level === "미지정" ? null : editData.level,
                    dob: editData.birthDate || null
                })
                .eq('id', athleteId)
                .select();

            if (error) {
                console.error("Save error full detail:", error);
                console.error("Save error stringified:", JSON.stringify(error, null, 2));
                
                const msg = error.message || (error as any).error_description || "알 수 없는 오류";
                const code = error.code || "No Code";
                const details = (error as any).details || "";
                
                let alertMsg = `❌ 저장 실패\n\n메시지: ${msg}\n코드: ${code}`;
                if (details) alertMsg += `\n상세: ${details}`;
                
                if (code === "42703" || msg.includes("column")) {
                    alertMsg += "\n\n💡 원인: DB 컬럼이 없습니다. SQL 스크립트를 실행해주세요.";
                } else if (code === "23505") {
                    alertMsg += "\n\n💡 원인: 중복된 데이터가 있습니다.";
                }
                
                alert(alertMsg);
            } else if (!updatedArray || updatedArray.length === 0) {
                console.warn("Save warning: 0 rows updated.");
                alert("⚠️ 저장되지 않음: 수정된 데이터가 없거나 권한이 부족합니다 (RLS).");
            } else {
                const updatedData = updatedArray[0];
                console.log("Save successful! Server returned:", updatedData);
                // Map the server data back to our UI format
                const refreshed: AthleteDetail = {
                    id: updatedData.id,
                    name: updatedData.name,
                    phone: updatedData.phone || "",
                    age: updatedData.dob ? (new Date().getFullYear() - new Date(updatedData.dob).getFullYear()) : 0,
                    birthDate: updatedData.dob || "",
                    email: "",
                    loginId: "",
                    branch: updatedData.branch || "미지정",
                    registeredAt: updatedData.created_at?.split('T')[0] || "",
                    status: updatedData.status === "휴회" ? "paused" : (updatedData.status === "비활성화" ? "inactive" : "active"),
                    gender: updatedData.gender === 'male' ? '남' : updatedData.gender === 'female' ? '여' : (updatedData.gender === 'other' ? '기타' : '미지정'),
                    parentName: updatedData.parent_name || "",
                    parentPhone: updatedData.parent_phone || "",
                    coachName: updatedData.coach_name || "담당 없음",
                    memo: updatedData.memo || "",
                    level: updatedData.level || "미지정"
                };
                
                setAthlete(refreshed);
                setEditData(refreshed);
                setIsEditing(false);
                setSaveMessage("선수 정보가 저장되었습니다.");
                setTimeout(() => setSaveMessage(""), 3000);
            }
        } catch (err: any) {
            console.error("Critical Save error:", err);
            alert(`시스템 오류가 발생했습니다: ${err.message || "알 수 없는 오류"}`);
        }
    };

    const handleCancel = () => {
        setEditData(athlete);
        setIsEditing(false);
    };

    const handleDelete = async () => {
        if (!athlete || !athleteId) return;
        if (!confirm(`\n선수명: ${athlete.name}\n\n정말로 이 선수를 삭제하시겠습니까?\n모든 기록이 삭제됩니다.`)) return;

        try {
            const { error } = await supabase
                .from('users')
                .delete()
                .eq('id', athleteId);

            if (error) throw error;

            alert("삭제되었습니다.");
            router.push("/system/athletes");
        } catch (err) {
            console.error("Error deleting athlete:", err);
            alert("삭제에 실패했습니다.");
        }
    };

    const updateField = (field: keyof AthleteDetail, value: any) => {
        if (!editData) return;
        setEditData(prev => {
            if (!prev) return null;
            const updated = { ...prev, [field]: value };
            
            // Auto-calculate age if birthDate is changed
            if (field === "birthDate" && value && value.length >= 4) {
                const birthYear = parseInt(value.substring(0, 4));
                if (!isNaN(birthYear)) {
                    updated.age = new Date().getFullYear() - birthYear;
                }
            }
            
            return updated;
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
                <Loader2 className="animate-spin text-brand-navy" size={40} />
            </div>
        );
    }

    if (!athlete) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
                <p className="text-zinc-500 mb-4">선수 정보를 찾을 수 없습니다.</p>
                <button onClick={() => router.back()} className="text-brand-navy font-bold">뒤로 가기</button>
            </div>
        );
    }

    const status = statusConfig[athlete.status];
    const StatusIcon = status.icon;

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
                            선수 프로필
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">
                        {isEditing ? (
                            <>
                                <button
                                    onClick={handleCancel}
                                    className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                                >
                                    <X size={14} />
                                    취소
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="flex items-center gap-1 px-4 py-2 bg-brand-navy hover:bg-brand-navy/90 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
                                >
                                    <Save size={14} />
                                    저장
                                </button>
                            </>
                        ) : (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleDelete}
                                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl transition-colors"
                                >
                                    <Trash2 size={14} />
                                    삭제
                                </button>
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl transition-colors"
                                >
                                    <Edit2 size={14} />
                                    수정
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Save Toast */}
            {saveMessage && (
                <div className="fixed top-20 right-4 sm:right-8 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="bg-emerald-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2">
                        <Save size={16} />
                        {saveMessage}
                    </div>
                </div>
            )}

            <main className="max-w-3xl mx-auto px-4 sm:px-8 py-6 space-y-5">

                {/* ── Profile Card ── */}
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
                    {/* Top gradient bar */}
                    <div className="h-20 bg-gradient-to-r from-brand-navy via-brand-navy/80 to-blue-500 relative">
                        <div className="absolute -bottom-10 left-6">
                            <div className="w-20 h-20 rounded-2xl bg-white dark:bg-zinc-900 border-4 border-white dark:border-zinc-900 shadow-lg flex items-center justify-center">
                                <UserCircle size={48} className="text-zinc-300" />
                            </div>
                        </div>
                    </div>

                    <div className="pt-14 px-6 pb-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-50">
                                    {athlete.name}
                                </h2>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                                    {athlete.branch} · {athlete.coachName} 담당
                                </p>
                            </div>
                            <span className={cn(
                                "inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border",
                                status.bgColor, status.color
                            )}>
                                <StatusIcon size={13} />
                                {status.label}
                            </span>
                        </div>

                        {/* Status Change (Edit Mode) */}
                        {isEditing && (
                            <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800/50">
                                <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-2">등록 현황 변경</p>
                                <div className="flex gap-2">
                                    {(["active", "paused", "inactive"] as RegistrationStatus[]).map(s => {
                                        const sc = statusConfig[s];
                                        const ScIcon = sc.icon;
                                        return (
                                            <button
                                                key={s}
                                                onClick={() => updateField("status", s)}
                                                className={cn(
                                                    "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all",
                                                    editData?.status === s
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

                {/* ── Personal Information ── */}
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6">
                    <div className="flex items-center justify-between mb-1">
                        <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">개인 정보</h3>
                    </div>
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                        <InfoRow icon={User} label="이름" value={athlete.name} editable isEditing={isEditing}
                            editValue={editData?.name} onEdit={(v) => updateField("name", v)} />
                        <InfoRow icon={Phone} label="연락처" value={athlete.phone} editable isEditing={isEditing}
                            editValue={editData?.phone} onEdit={(v) => updateField("phone", v)} />
                        <InfoRow icon={Calendar} label="생년월일 / 나이" 
                            value={athlete.birthDate ? `${athlete.birthDate} (${athlete.age}세)` : "미입력"} 
                            editable isEditing={isEditing}
                            editValue={editData?.birthDate} 
                            onEdit={(v) => updateField("birthDate", v)} 
                        />
                        <InfoRow icon={User} label="성별" value={athlete.gender} editable isEditing={isEditing}
                            editValue={editData?.gender} onEdit={(v) => updateField("gender", v)} options={["남", "여"]} />
                        <InfoRow icon={Shield} label="선수 구분" value={athlete.level} editable isEditing={isEditing}
                            editValue={editData?.level} onEdit={(v) => updateField("level", v)} options={["엘리트", "프로", "1부투어"]} />
                        <InfoRow icon={Mail} label="이메일" value={athlete.email} editable isEditing={isEditing}
                            editValue={editData?.email} onEdit={(v) => updateField("email", v)} />
                    </div>
                </section>

                {/* ── Account Information ── */}
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6">
                    <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-1">계정 정보</h3>
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                        <InfoRow icon={Hash} label="ID" value={athlete.loginId} />
                        <InfoRow icon={Key} label="PW" value="••••••••" />
                    </div>
                </section>

                {/* ── Registration Information ── */}
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6">
                    <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-1">등록 정보</h3>
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                        <InfoRow icon={MapPin} label="등록 지점" value={athlete.branch} editable isEditing={isEditing}
                            editValue={editData?.branch} onEdit={(v) => updateField("branch", v)} options={availableBranches} />
                        <InfoRow icon={Clock} label="등록 시기" value={athlete.registeredAt} />
                        <InfoRow icon={Shield} label="등록 현황" value={statusConfig[athlete.status].label} />
                        <InfoRow icon={User} label="담당 코치" value={athlete.coachName} editable isEditing={isEditing}
                            editValue={editData?.coachName} onEdit={(v) => updateField("coachName", v)} />
                    </div>
                </section>

                {/* ── Parent/Guardian Information ── */}
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6">
                    <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-1">보호자 정보</h3>
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                        <InfoRow icon={User} label="보호자 이름" value={athlete.parentName} editable isEditing={isEditing}
                            editValue={editData?.parentName} onEdit={(v) => updateField("parentName", v)} />
                        <InfoRow icon={Phone} label="보호자 연락처" value={athlete.parentPhone} editable isEditing={isEditing}
                            editValue={editData?.parentPhone} onEdit={(v) => updateField("parentPhone", v)} />
                    </div>
                </section>

                {/* ── Memo ── */}
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6">
                    <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-3">메모</h3>
                    {isEditing ? (
                        <textarea
                            value={editData?.memo}
                            onChange={(e) => updateField("memo", e.target.value)}
                            rows={3}
                            placeholder="선수 관련 메모를 입력하세요..."
                            className="w-full p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all resize-y"
                        />
                    ) : (
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl">
                            {athlete.memo || <span className="text-zinc-300 dark:text-zinc-600 italic">메모가 없습니다.</span>}
                        </p>
                    )}
                </section>
            </main>
        </div>
    );
}
