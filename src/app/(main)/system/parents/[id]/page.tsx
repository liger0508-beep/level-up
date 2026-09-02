"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
    ChevronLeft,
    User,
    Phone,
    Mail,
    MapPin,
    Shield,
    Edit2,
    Save,
    X,
    Key,
    UserCheck,
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
type ParentStatus = "active" | "inactive";

interface ParentDetail {
    id: string;
    name: string;
    phone: string;
    email: string;
    loginId: string;
    branch: string;
    registeredAt: string;
    status: ParentStatus;
    gender: string;
    memo: string;
}

// ── Status metadata ──
const statusConfig: Record<ParentStatus, { label: string; color: string; bgColor: string; icon: typeof UserCheck }> = {
    active: { label: "활성", color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20", icon: UserCheck },
    inactive: { label: "비활성", color: "text-red-500 dark:text-red-400", bgColor: "bg-red-500/10 border-red-200 dark:border-red-500/20", icon: UserX },
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

export default function ParentDetailPage() {
    const router = useRouter();
    const params = useParams();
    const supabase = createClient();
    const parentId = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";

    const [parent, setParent] = useState<ParentDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState<ParentDetail | null>(null);
    const [saveMessage, setSaveMessage] = useState("");
    const [availableBranches, setAvailableBranches] = useState<string[]>(["조이마루점", "구미점"]);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [isResettingPw, setIsResettingPw] = useState(false);

    useEffect(() => {
        if (!parentId) return;

        async function fetchData() {
            setLoading(true);
            try {
                // Fetch branches
                const { data: bData } = await supabase.from('users').select('branch');
                if (bData) {
                    const unique = Array.from(new Set(bData.map(b => b.branch).filter(v => v && v !== "미지정" && v !== "")));
                    setAvailableBranches(["조이마루점", "구미점", ...unique.filter(v => v !== "조이마루점" && v !== "구미점")]);
                }

                // Fetch current user
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single();
                    if (profile) setCurrentUser(profile);
                }

                const { data: u, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', parentId)
                    .single();

                if (u) {
                    const detail: ParentDetail = {
                        id: u.id,
                        name: u.name,
                        phone: u.phone || "",
                        email: u.email || "",
                        loginId: u.login_id || "",
                        branch: u.branch || "미지정",
                        registeredAt: ((u.created_at) ? new Date(u.created_at).toLocaleDateString('en-CA', {timeZone: 'Asia/Seoul'}) : "") || "",
                        status: u.status === "비활성화" ? "inactive" : "active",
                        gender: u.gender === 'male' ? '남' : u.gender === 'female' ? '여' : (u.gender === 'other' ? '기타' : '미지정'),
                        memo: u.memo || ""
                    };
                    setParent(detail);
                    setEditData(detail);
                }
            } catch (err) {
                console.error("Error fetching parent:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [parentId]);

    const handleSave = async () => {
        if (!editData || !parentId) return;

        try {
            const saveBranch = editData.branch === "미지정" ? null : editData.branch;
            const saveGender = editData.gender === '남' ? 'male' : editData.gender === '여' ? 'female' : (editData.gender === '기타' ? 'other' : null);

            const { error } = await supabase
                .from('users')
                .update({
                    name: editData.name,
                    phone: editData.phone,
                    branch: saveBranch,
                    status: editData.status === "inactive" ? "비활성화" : "등록",
                    gender: saveGender,
                    memo: editData.memo || null
                })
                .eq('id', parentId);

            if (error) throw error;

            setParent(editData);
            setIsEditing(false);
            setSaveMessage("학부모 정보가 저장되었습니다.");
            setTimeout(() => setSaveMessage(""), 3000);
        } catch (err: any) {
            console.error("Save error:", err);
            alert(`저장에 실패했습니다: ${err.message}`);
        }
    };

    const handleCancel = () => {
        setEditData(parent);
        setIsEditing(false);
    };

    const handleDelete = async () => {
        if (!parent || !parentId) return;
        if (!confirm(`\n학부모명: ${parent.name}\n\n정말로 이 학부모를 삭제하시겠습니까?\n모든 기록이 삭제됩니다.`)) return;
        if (currentUser?.name !== '슈퍼관리자') {
            alert('슈퍼관리자만 사용할 수 있는 기능입니다.');
            return;
        }

        try {
            const res = await fetch('/api/admin/delete-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetUserId: parentId,
                    callerName: currentUser.name
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || '삭제 실패');

            alert("삭제되었습니다.");
            router.push("/system/parents");
        } catch (err: any) {
            console.error("Error deleting parent:", err);
            alert(`삭제에 실패했습니다: ${err.message}`);
        }
    };

    const updateField = (field: keyof ParentDetail, value: string) => {
        setEditData(prev => prev ? ({ ...prev, [field]: value }) : null);
    };

    const handleResetPassword = async () => {
        if (!parent || !parentId) return;
        if (currentUser?.name !== '슈퍼관리자') {
            alert('슈퍼관리자만 사용할 수 있는 기능입니다.');
            return;
        }

        const phone = parent.phone || "";
        const numericPhone = phone.replace(/[^0-9]/g, '');
        if (numericPhone.length < 4) {
            alert('연락처 정보가 올바르지 않습니다.');
            return;
        }
        
        const last4 = numericPhone.slice(-4);
        if (!confirm(`\n대상: ${parent.name}\n\n정말로 비밀번호를 초기화하시겠습니까?\n비밀번호는 연락처 뒷자리 '${last4}'(으)로 변경됩니다.`)) return;

        try {
            setIsResettingPw(true);
            const res = await fetch('/api/admin/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetUserId: parentId,
                    targetPhone: phone,
                    callerName: currentUser.name
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || '비밀번호 초기화 실패');
            
            alert(`비밀번호가 '${data.newPassword}'(으)로 초기화되었습니다.`);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsResettingPw(false);
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-brand-navy" /></div>;
    if (!parent) return <div className="min-h-screen flex items-center justify-center">정보를 찾을 수 없습니다.</div>;

    const currentStatus = statusConfig[parent.status];
    const StatusIcon = currentStatus.icon;

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-24">
            <header className="sticky top-0 z-40 bg-zinc-50/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
                <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-50 transition-colors">
                            <ChevronLeft size={24} />
                        </button>
                        <h1 className="text-lg font-bold">학부모 프로필</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        {isEditing ? (
                            <>
                                <button onClick={handleCancel} className="px-3 py-2 text-sm font-medium text-zinc-500">취소</button>
                                <button onClick={handleSave} className="px-4 py-2 bg-brand-navy text-white text-sm font-semibold rounded-xl shadow-sm">저장</button>
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
                                <button onClick={() => setIsEditing(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-zinc-600 border border-zinc-200 rounded-xl">
                                    <Edit2 size={14} /> 수정
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {saveMessage && (
                <div className="fixed top-20 right-4 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="bg-emerald-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2">
                        <Save size={16} /> {saveMessage}
                    </div>
                </div>
            )}

            <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
                    <div className="h-20 bg-gradient-to-r from-amber-500 to-orange-500 relative">
                        <div className="absolute -bottom-10 left-6">
                            <div className="w-20 h-20 rounded-2xl bg-white dark:bg-zinc-900 border-4 border-white dark:border-zinc-900 shadow-lg flex items-center justify-center text-amber-500">
                                <UserCircle size={48} />
                            </div>
                        </div>
                    </div>
                    <div className="pt-14 px-6 pb-6 flex items-start justify-between">
                        <div>
                            <h2 className="text-xl font-black">{parent.name}</h2>
                            <p className="text-sm text-zinc-500">{parent.branch}</p>
                        </div>
                        <span className={cn("inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border", currentStatus.bgColor, currentStatus.color)}>
                            <StatusIcon size={13} /> {currentStatus.label}
                        </span>
                    </div>
                    {isEditing && (
                        <div className="px-6 pb-6 border-t border-zinc-100 dark:border-zinc-800/50 pt-4">
                            <p className="text-[11px] font-medium text-zinc-400 uppercase mb-2">상태 변경</p>
                            <div className="flex gap-2">
                                {(["active", "inactive"] as const).map(s => (
                                    <button
                                        key={s}
                                        onClick={() => updateField("status", s)}
                                        className={cn("px-3 py-2 rounded-xl text-xs font-semibold border transition-all", editData?.status === s ? statusConfig[s].bgColor + " " + statusConfig[s].color : "bg-zinc-50 dark:bg-zinc-800 text-zinc-500")}
                                    >
                                        {statusConfig[s].label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </section>

                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6 divide-y divide-zinc-100 dark:divide-zinc-800/50">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">상세 정보</h3>
                        {currentUser?.name === '슈퍼관리자' && (
                            <button 
                                onClick={handleResetPassword}
                                disabled={isResettingPw}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-500/10 dark:hover:bg-red-500/20 rounded-lg transition-colors border border-red-200 dark:border-red-500/20 disabled:opacity-50"
                            >
                                <Key size={12} />
                                {isResettingPw ? "초기화 중..." : "비밀번호 초기화"}
                            </button>
                        )}
                    </div>
                    <InfoRow icon={User} label="이름" value={parent.name} editable isEditing={isEditing} editValue={editData?.name} onEdit={(v) => updateField("name", v)} />
                    <InfoRow icon={Phone} label="연락처" value={parent.phone} editable isEditing={isEditing} editValue={editData?.phone} onEdit={(v) => updateField("phone", v)} />
                    <InfoRow icon={Mail} label="이메일" value={parent.email} editable isEditing={isEditing} editValue={editData?.email} onEdit={(v) => updateField("email", v)} />
                    <InfoRow icon={User} label="성별" value={parent.gender} editable isEditing={isEditing} editValue={editData?.gender} onEdit={(v) => updateField("gender", v)} options={["남", "여"]} />
                    <InfoRow icon={MapPin} label="소속 지점" value={parent.branch} editable isEditing={isEditing} editValue={editData?.branch} onEdit={(v) => updateField("branch", v)} options={availableBranches} />
                    <InfoRow icon={Hash} label="ID" value={parent.loginId} />
                    <InfoRow icon={Key} label="PW" value="••••••••" />
                    <InfoRow icon={Clock} label="가입일" value={parent.registeredAt} />
                </section>

                <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6">
                    <h3 className="text-base font-bold mb-3">메모</h3>
                    {isEditing ? (
                        <textarea value={editData?.memo} onChange={(e) => updateField("memo", e.target.value)} rows={3} className="w-full p-3 rounded-xl border bg-transparent text-sm focus:outline-none" />
                    ) : (
                        <p className="text-sm text-zinc-600 bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl">{parent.memo || "메모가 없습니다."}</p>
                    )}
                </section>
            </main>
        </div>
    );
}
