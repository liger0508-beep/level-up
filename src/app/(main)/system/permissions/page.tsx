"use client";

import { useState, useCallback } from "react";
import { Shield, ChevronLeft, Save, RotateCcw, Eye, Pencil, Check, Info } from "lucide-react";
import { useRouter } from "next/navigation";

// ── Types ──
type Role = "admin" | "coach" | "athlete" | "parent";
type PermissionType = "read" | "write";

interface MenuPermission {
    menuKey: string;
    label: string;
    section: string;
    permissions: Record<Role, { read: boolean; write: boolean }>;
}

// ── Role metadata ──
const roles: { key: Role; label: string; color: string; bgColor: string }[] = [
    { key: "admin", label: "관리자", color: "text-purple-600 dark:text-purple-400", bgColor: "bg-purple-500/10" },
    { key: "coach", label: "코치", color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-500/10" },
    { key: "athlete", label: "선수", color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-500/10" },
    { key: "parent", label: "학부모", color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-500/10" },
];

// ── Default permission data ──
const defaultPermissions: MenuPermission[] = [
    // 메인 메뉴
    {
        menuKey: "home", label: "Home", section: "메인",
        permissions: { admin: { read: true, write: true }, coach: { read: true, write: true }, athlete: { read: true, write: false }, parent: { read: true, write: false } }
    },
    {
        menuKey: "analysis", label: "분석", section: "메인",
        permissions: { admin: { read: true, write: true }, coach: { read: true, write: true }, athlete: { read: true, write: false }, parent: { read: true, write: false } }
    },
    {
        menuKey: "lessons", label: "레슨", section: "메인",
        permissions: { admin: { read: true, write: true }, coach: { read: true, write: true }, athlete: { read: true, write: false }, parent: { read: true, write: false } }
    },
    {
        menuKey: "training", label: "훈련", section: "메인",
        permissions: { admin: { read: true, write: true }, coach: { read: true, write: true }, athlete: { read: true, write: false }, parent: { read: true, write: false } }
    },
    {
        menuKey: "tests", label: "테스트", section: "메인",
        permissions: { admin: { read: true, write: true }, coach: { read: true, write: true }, athlete: { read: true, write: false }, parent: { read: true, write: false } }
    },

    // 스케쥴
    {
        menuKey: "schedule", label: "스케쥴", section: "스케쥴",
        permissions: { admin: { read: true, write: true }, coach: { read: true, write: true }, athlete: { read: true, write: false }, parent: { read: true, write: false } }
    },
    {
        menuKey: "tournament-schedule", label: "대회 스케쥴", section: "스케쥴",
        permissions: { admin: { read: true, write: true }, coach: { read: true, write: true }, athlete: { read: true, write: false }, parent: { read: true, write: false } }
    },
    {
        menuKey: "coach-trip-schedule", label: "출장 스케쥴", section: "스케쥴",
        permissions: { admin: { read: true, write: true }, coach: { read: true, write: true }, athlete: { read: false, write: false }, parent: { read: false, write: false } }
    },

    // 스코어
    {
        menuKey: "scores", label: "스코어", section: "스코어",
        permissions: { admin: { read: true, write: true }, coach: { read: true, write: true }, athlete: { read: true, write: true }, parent: { read: true, write: false } }
    },
    
    // 라운지
    {
        menuKey: "community", label: "공지사항", section: "라운지",
        permissions: { admin: { read: true, write: true }, coach: { read: true, write: true }, athlete: { read: true, write: false }, parent: { read: true, write: false } }
    },
    {
        menuKey: "polls", label: "투표", section: "라운지",
        permissions: { admin: { read: true, write: true }, coach: { read: true, write: true }, athlete: { read: true, write: true }, parent: { read: true, write: true } }
    },
    {
        menuKey: "consultations", label: "상담", section: "라운지",
        permissions: { admin: { read: true, write: true }, coach: { read: true, write: true }, athlete: { read: true, write: true }, parent: { read: true, write: true } }
    },
    {
        menuKey: "training-journal", label: "훈련일지", section: "라운지",
        permissions: { admin: { read: true, write: true }, coach: { read: true, write: true }, athlete: { read: true, write: true }, parent: { read: true, write: false } }
    },
    {
        menuKey: "attendance", label: "출석 체크", section: "라운지",
        permissions: { admin: { read: true, write: true }, coach: { read: true, write: true }, athlete: { read: true, write: true }, parent: { read: true, write: false } }
    },
    {
        menuKey: "todo-list", label: "To-Do 리스트", section: "라운지",
        permissions: { admin: { read: true, write: true }, coach: { read: true, write: true }, athlete: { read: true, write: true }, parent: { read: false, write: false } }
    },
    {
        menuKey: "course-management", label: "골프IQ", section: "라운지",
        permissions: { admin: { read: true, write: true }, coach: { read: true, write: true }, athlete: { read: false, write: false }, parent: { read: false, write: false } }
    },
    {
        menuKey: "course-info", label: "코스 정보", section: "라운지",
        permissions: { admin: { read: true, write: true }, coach: { read: true, write: true }, athlete: { read: true, write: false }, parent: { read: true, write: false } }
    },
    {
        menuKey: "reports", label: "선수 레포트", section: "라운지",
        permissions: { admin: { read: true, write: true }, coach: { read: true, write: true }, athlete: { read: true, write: false }, parent: { read: true, write: false } }
    },

    // 운영/관리
    {
        menuKey: "assigned-athletes", label: "담임 선수 배정", section: "운영/관리",
        permissions: { admin: { read: true, write: true }, coach: { read: true, write: true }, athlete: { read: false, write: false }, parent: { read: false, write: false } }
    },
    {
        menuKey: "statistics", label: "운영 통계", section: "운영/관리",
        permissions: { admin: { read: true, write: true }, coach: { read: true, write: true }, athlete: { read: false, write: false }, parent: { read: false, write: false } }
    },
    {
        menuKey: "tournament-results", label: "대회 성적 관리", section: "운영/관리",
        permissions: { admin: { read: true, write: true }, coach: { read: true, write: true }, athlete: { read: true, write: false }, parent: { read: true, write: false } }
    },
    {
        menuKey: "lesson-list", label: "스윙 오류 관리", section: "운영/관리",
        permissions: { admin: { read: true, write: true }, coach: { read: true, write: true }, athlete: { read: false, write: false }, parent: { read: false, write: false } }
    },
    {
        menuKey: "training-list", label: "훈련 리스트 관리", section: "운영/관리",
        permissions: { admin: { read: true, write: true }, coach: { read: true, write: true }, athlete: { read: false, write: false }, parent: { read: false, write: false } }
    },

    // 시스템 관리
    {
        menuKey: "branches", label: "지점 관리", section: "시스템 관리",
        permissions: { admin: { read: true, write: true }, coach: { read: true, write: false }, athlete: { read: false, write: false }, parent: { read: false, write: false } }
    },
    {
        menuKey: "athletes", label: "선수 관리", section: "시스템 관리",
        permissions: { admin: { read: true, write: true }, coach: { read: true, write: true }, athlete: { read: false, write: false }, parent: { read: false, write: false } }
    },
    {
        menuKey: "coaches", label: "코치 관리", section: "시스템 관리",
        permissions: { admin: { read: true, write: true }, coach: { read: false, write: false }, athlete: { read: false, write: false }, parent: { read: false, write: false } }
    },
    {
        menuKey: "permissions", label: "권한 관리", section: "시스템 관리",
        permissions: { admin: { read: true, write: true }, coach: { read: false, write: false }, athlete: { read: false, write: false }, parent: { read: false, write: false } }
    },
    {
        menuKey: "sys-tournament", label: "대회 스케쥴 등록", section: "시스템 관리",
        permissions: { admin: { read: true, write: true }, coach: { read: true, write: true }, athlete: { read: false, write: false }, parent: { read: false, write: false } }
    },
    {
        menuKey: "sys-coach-trip", label: "출장 스케쥴 등록", section: "시스템 관리",
        permissions: { admin: { read: true, write: true }, coach: { read: true, write: true }, athlete: { read: false, write: false }, parent: { read: false, write: false } }
    },
];

// ── Section colors ──
const sectionColors: Record<string, string> = {
    "메인": "border-l-blue-500",
    "스케쥴": "border-l-cyan-500",
    "스코어": "border-l-emerald-500",
    "라운지": "border-l-indigo-500",
    "운영/관리": "border-l-amber-500",
    "시스템 관리": "border-l-purple-500",
};

const sectionBadgeColors: Record<string, string> = {
    "메인": "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    "스케쥴": "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    "스코어": "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    "라운지": "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    "운영/관리": "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    "시스템 관리": "bg-purple-500/10 text-purple-600 dark:text-purple-400",
};

// ── Permission Toggle Component ──
function PermToggle({
    checked,
    onChange,
    type,
    disabled,
}: {
    checked: boolean;
    onChange: () => void;
    type: PermissionType;
    disabled?: boolean;
}) {
    const isRead = type === "read";
    return (
        <button
            type="button"
            onClick={onChange}
            disabled={disabled}
            className={`
                relative w-[52px] h-7 rounded-full transition-all duration-200 ease-out
                focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-brand-navy/30
                ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
                ${checked
                    ? isRead
                        ? "bg-blue-500 shadow-inner shadow-blue-600/30"
                        : "bg-emerald-500 shadow-inner shadow-emerald-600/30"
                    : "bg-zinc-200 dark:bg-zinc-700"
                }
            `}
            title={`${isRead ? "읽기" : "쓰기"} ${checked ? "ON" : "OFF"}`}
        >
            <span
                className={`
                    absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md
                    flex items-center justify-center
                    transition-all duration-200 ease-out
                    ${checked ? "left-[24px]" : "left-0.5"}
                `}
            >
                {checked ? (
                    <Check size={12} className={isRead ? "text-blue-500" : "text-emerald-500"} strokeWidth={3} />
                ) : null}
            </span>
        </button>
    );
}

// ── Main Page ──
export default function PermissionsPage() {
    const router = useRouter();
    const [permissions, setPermissions] = useState<MenuPermission[]>(
        () => {
            // Load from localStorage if available
            if (typeof window !== "undefined") {
                const saved = localStorage.getItem("gla_permissions");
                if (saved) {
                    try {
                        return JSON.parse(saved);
                    } catch { /* fallback */ }
                }
            }
            return defaultPermissions;
        }
    );
    const [hasChanges, setHasChanges] = useState(false);
    const [saveMessage, setSaveMessage] = useState("");

    const togglePermission = useCallback((menuKey: string, role: Role, type: PermissionType) => {
        setPermissions(prev => prev.map(p => {
            if (p.menuKey !== menuKey) return p;
            const updated = { ...p, permissions: { ...p.permissions } };
            updated.permissions[role] = {
                ...updated.permissions[role],
                [type]: !updated.permissions[role][type],
            };
            // If disabling read, also disable write
            if (type === "read" && updated.permissions[role].read === false) {
                updated.permissions[role].write = false;
            }
            // If enabling write, also enable read
            if (type === "write" && updated.permissions[role][type] === true) {
                updated.permissions[role].read = true;
            }
            return updated;
        }));
        setHasChanges(true);
        setSaveMessage("");
    }, []);

    const handleSave = () => {
        if (typeof window !== "undefined") {
            localStorage.setItem("gla_permissions", JSON.stringify(permissions));
        }
        setHasChanges(false);
        setSaveMessage("권한 설정이 저장되었습니다.");
        setTimeout(() => setSaveMessage(""), 3000);
    };

    const handleReset = () => {
        if (window.confirm("기본 권한 설정으로 되돌리시겠습니까?")) {
            setPermissions(defaultPermissions);
            localStorage.removeItem("gla_permissions");
            setHasChanges(false);
            setSaveMessage("기본 설정으로 초기화되었습니다.");
            setTimeout(() => setSaveMessage(""), 3000);
        }
    };

    // Group by section
    const sections = permissions.reduce<Record<string, MenuPermission[]>>((acc, perm) => {
        (acc[perm.section] = acc[perm.section] || []).push(perm);
        return acc;
    }, {});

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-24">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-zinc-50/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
                <div className="max-w-6xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.back()}
                            className="p-2 -ml-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-50 transition-colors"
                        >
                            <ChevronLeft size={24} />
                        </button>
                        <div className="flex items-center gap-2">
                            <Shield size={20} className="text-brand-navy dark:text-brand-navy-light shrink-0" />
                            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                                권한 관리
                            </h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleReset}
                            className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                        >
                            <RotateCcw size={14} />
                            초기화
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!hasChanges}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm ${hasChanges
                                    ? "bg-brand-navy hover:bg-brand-navy/90 text-white"
                                    : "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
                                }`}
                        >
                            <Save size={14} />
                            저장
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 sm:px-8 py-6 space-y-6">

                {/* Save Message Toast */}
                {saveMessage && (
                    <div className="fixed top-20 right-4 sm:right-8 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="bg-emerald-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2">
                            <Check size={16} />
                            {saveMessage}
                        </div>
                    </div>
                )}

                {/* Info Banner */}
                <div className="bg-blue-50 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-500/20 rounded-2xl p-4 flex gap-3">
                    <Info size={18} className="text-blue-500 shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                        <p className="font-semibold">권한 설정 안내</p>
                        <p className="text-blue-600/80 dark:text-blue-400/80">
                            각 메뉴별로 역할(관리자/코치/선수/학부모)에 대한 <span className="font-semibold text-blue-500">읽기(보기)</span> 및 <span className="font-semibold text-emerald-500">쓰기(작성)</span> 권한을 설정할 수 있습니다.
                            쓰기 권한을 부여하면 읽기 권한이 자동으로 활성화됩니다.
                        </p>
                    </div>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-4 px-1">
                    <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        <div className="flex items-center gap-1.5">
                            <Eye size={13} className="text-blue-500" />
                            <span>읽기(보기)</span>
                        </div>
                        <span className="text-zinc-300 dark:text-zinc-700">|</span>
                        <div className="flex items-center gap-1.5">
                            <Pencil size={13} className="text-emerald-500" />
                            <span>쓰기(작성)</span>
                        </div>
                    </div>
                </div>

                {/* Permissions Matrix by Section */}
                {Object.entries(sections).map(([sectionName, menus]) => (
                    <section
                        key={sectionName}
                        className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden border-l-4 ${sectionColors[sectionName] || "border-l-zinc-400"}`}
                    >
                        {/* Section Header */}
                        <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800/50 flex items-center gap-3">
                            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider ${sectionBadgeColors[sectionName] || "bg-zinc-100 text-zinc-600"}`}>
                                {sectionName}
                            </span>
                            <span className="text-xs text-zinc-400">{menus.length}개 메뉴</span>
                        </div>

                        {/* Table Header (Desktop) */}
                        <div className="hidden lg:grid lg:grid-cols-[1fr_repeat(4,minmax(140px,1fr))] items-center px-5 py-3 bg-zinc-50/50 dark:bg-zinc-800/30 border-b border-zinc-100 dark:border-zinc-800/30">
                            <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">메뉴</div>
                            {roles.map(role => (
                                <div key={role.key} className="text-center">
                                    <span className={`text-xs font-bold ${role.color}`}>{role.label}</span>
                                    <div className="flex items-center justify-center gap-3 mt-1.5">
                                        <span className="text-[10px] text-zinc-400 flex items-center gap-0.5">
                                            <Eye size={10} /> 읽기
                                        </span>
                                        <span className="text-[10px] text-zinc-400 flex items-center gap-0.5">
                                            <Pencil size={10} /> 쓰기
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Menu Rows */}
                        {menus.map((menu, idx) => (
                            <div
                                key={menu.menuKey}
                                className={`
                                    px-5 py-4
                                    ${idx < menus.length - 1 ? "border-b border-zinc-100 dark:border-zinc-800/30" : ""}
                                    hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors
                                `}
                            >
                                {/* Desktop View */}
                                <div className="hidden lg:grid lg:grid-cols-[1fr_repeat(4,minmax(140px,1fr))] items-center">
                                    <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                                        {menu.label}
                                    </div>
                                    {roles.map(role => (
                                        <div key={role.key} className="flex items-center justify-center gap-3">
                                            <PermToggle
                                                checked={menu.permissions[role.key].read}
                                                onChange={() => togglePermission(menu.menuKey, role.key, "read")}
                                                type="read"
                                                disabled={menu.menuKey === "permissions" && role.key === "admin"}
                                            />
                                            <PermToggle
                                                checked={menu.permissions[role.key].write}
                                                onChange={() => togglePermission(menu.menuKey, role.key, "write")}
                                                type="write"
                                                disabled={menu.menuKey === "permissions" && role.key === "admin"}
                                            />
                                        </div>
                                    ))}
                                </div>

                                {/* Mobile View */}
                                <div className="lg:hidden space-y-3">
                                    <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                                        {menu.label}
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        {roles.map(role => (
                                            <div
                                                key={role.key}
                                                className={`${role.bgColor} rounded-xl p-3 space-y-2`}
                                            >
                                                <span className={`text-xs font-bold ${role.color}`}>
                                                    {role.label}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex items-center gap-1">
                                                        <Eye size={11} className="text-zinc-400" />
                                                        <PermToggle
                                                            checked={menu.permissions[role.key].read}
                                                            onChange={() => togglePermission(menu.menuKey, role.key, "read")}
                                                            type="read"
                                                            disabled={menu.menuKey === "permissions" && role.key === "admin"}
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <Pencil size={11} className="text-zinc-400" />
                                                        <PermToggle
                                                            checked={menu.permissions[role.key].write}
                                                            onChange={() => togglePermission(menu.menuKey, role.key, "write")}
                                                            type="write"
                                                            disabled={menu.menuKey === "permissions" && role.key === "admin"}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </section>
                ))}
            </main>
        </div>
    );
}
