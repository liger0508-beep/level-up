"use client";

import { useState, useCallback, useEffect } from "react";
import { Shield, ChevronLeft, Save, RotateCcw, Eye, Pencil, Check, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
    { key: "coach", label: "코치", color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-500/10" },
    { key: "athlete", label: "선수", color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-500/10" },
    { key: "parent", label: "학부모", color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-500/10" },
];

// ── Default permission data (Synced with latest SideNav) ──
const defaultPermissions: MenuPermission[] = [
    // 메인 메뉴
    {
        menuKey: "home", label: "Home", section: "메인",
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
        menuKey: "challenges", label: "챌린지", section: "메인",
        permissions: { admin: { read: true, write: true }, coach: { read: true, write: true }, athlete: { read: true, write: false }, parent: { read: true, write: false } }
    },

    // 참가 대회
    {
        menuKey: "tournament-schedule", label: "대회 스케쥴", section: "참가 대회",
        permissions: { admin: { read: true, write: true }, coach: { read: true, write: true }, athlete: { read: true, write: false }, parent: { read: true, write: false } }
    },
    {
        menuKey: "tournament-results-view", label: "대회 결과", section: "참가 대회",
        permissions: { admin: { read: true, write: true }, coach: { read: true, write: true }, athlete: { read: true, write: false }, parent: { read: true, write: false } }
    },

    // 스케쥴
    {
        menuKey: "schedule", label: "스케쥴", section: "스케쥴",
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
    {
        menuKey: "scores-stats", label: "스코어 통계", section: "스코어",
        permissions: { admin: { read: true, write: true }, coach: { read: true, write: true }, athlete: { read: true, write: false }, parent: { read: true, write: false } }
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
    {
        menuKey: "coach-selection", label: "담임 코치 선택", section: "라운지",
        permissions: { admin: { read: true, write: true }, coach: { read: true, write: true }, athlete: { read: true, write: true }, parent: { read: true, write: false } }
    },

    // 운영/관리
    {
        menuKey: "statistics", label: "운영 통계", section: "운영/관리",
        permissions: { admin: { read: true, write: true }, coach: { read: true, write: true }, athlete: { read: false, write: false }, parent: { read: false, write: false } }
    },
    {
        menuKey: "player-reports", label: "선수 레포트 작성", section: "운영/관리",
        permissions: { admin: { read: true, write: true }, coach: { read: true, write: true }, athlete: { read: false, write: false }, parent: { read: false, write: false } }
    },
    {
        menuKey: "assigned-athletes", label: "담임 선수 배정", section: "운영/관리",
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
    {
        menuKey: "challenge-list", label: "챌린지 컨텐츠 관리", section: "운영/관리",
        permissions: { admin: { read: true, write: true }, coach: { read: true, write: true }, athlete: { read: false, write: false }, parent: { read: false, write: false } }
    },

    // 시스템 관리
    {
        menuKey: "attendance-kiosk", label: "출석체크 번호 입력", section: "시스템 관리",
        permissions: { admin: { read: true, write: true }, coach: { read: true, write: true }, athlete: { read: true, write: true }, parent: { read: true, write: false } }
    },
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
        menuKey: "parents", label: "학부모 관리", section: "시스템 관리",
        permissions: { admin: { read: true, write: true }, coach: { read: true, write: false }, athlete: { read: false, write: false }, parent: { read: false, write: false } }
    },
    {
        menuKey: "permissions", label: "권한 관리", section: "시스템 관리",
        permissions: { admin: { read: true, write: true }, coach: { read: false, write: false }, athlete: { read: false, write: false }, parent: { read: false, write: false } }
    },
    {
        menuKey: "menu-management", label: "메뉴 관리", section: "시스템 관리",
        permissions: { admin: { read: true, write: true }, coach: { read: false, write: false }, athlete: { read: false, write: false }, parent: { read: false, write: false } }
    },
    
    // 테스트
    {
        menuKey: "temp-swing-skeleton", label: "스윙 테스트 (임시)", section: "테스트",
        permissions: { admin: { read: true, write: true }, coach: { read: true, write: true }, athlete: { read: true, write: false }, parent: { read: true, write: false } }
    },
    {
        menuKey: "temp-swing-test", label: "복습 카메라 (임시)", section: "테스트",
        permissions: { admin: { read: true, write: true }, coach: { read: true, write: true }, athlete: { read: true, write: false }, parent: { read: true, write: false } }
    }
];

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
    const supabase = createClient();
    const [permissions, setPermissions] = useState<MenuPermission[]>(defaultPermissions);
    const [hasChanges, setHasChanges] = useState(false);
    const [saveMessage, setSaveMessage] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Group by section for tabs
    const sectionNames = Array.from(new Set(defaultPermissions.map(p => p.section)));
    const [activeTab, setActiveTab] = useState<string>(sectionNames[0]);

    useEffect(() => {
        fetchPermissions();
    }, []);

    const fetchPermissions = async () => {
        setIsLoading(true);
        const { data, error } = await supabase.from('role_permissions').select('*');
        if (data && !error && data.length > 0) {
            // Map DB data to our state structure
            const newPermissions = JSON.parse(JSON.stringify(defaultPermissions)); // deep clone
            
            data.forEach((row: any) => {
                const menuItem = newPermissions.find((p: MenuPermission) => p.menuKey === row.menu_key);
                if (menuItem && menuItem.permissions[row.role as Role]) {
                    menuItem.permissions[row.role as Role] = {
                        read: row.can_read,
                        write: row.can_write
                    };
                }
            });
            setPermissions(newPermissions);
        } else {
            // DB is empty, use defaults
            setPermissions(defaultPermissions);
        }
        setIsLoading(false);
        setHasChanges(false);
    };

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

    const handleSave = async () => {
        setIsSaving(true);
        
        // Prepare data for upsert
        const rowsToUpsert: any[] = [];
        permissions.forEach(menu => {
            roles.forEach(role => {
                rowsToUpsert.push({
                    menu_key: menu.menuKey,
                    role: role.key,
                    can_read: menu.permissions[role.key].read,
                    can_write: menu.permissions[role.key].write
                });
            });
        });

        const { error } = await supabase
            .from('role_permissions')
            .upsert(rowsToUpsert, { onConflict: 'menu_key, role' });

        setIsSaving(false);

        if (error) {
            alert("저장 중 오류가 발생했습니다: " + error.message);
        } else {
            setHasChanges(false);
            setSaveMessage("권한 설정이 DB에 저장되었습니다.");
            setTimeout(() => setSaveMessage(""), 3000);
        }
    };

    const handleReset = () => {
        if (window.confirm("변경사항을 취소하고 원래 상태로 되돌리시겠습니까?")) {
            fetchPermissions();
            setSaveMessage("설정을 다시 불러왔습니다.");
            setTimeout(() => setSaveMessage(""), 3000);
        }
    };

    const activeMenus = permissions.filter(p => p.section === activeTab);

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
                            disabled={!hasChanges || isSaving}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm ${hasChanges
                                    ? "bg-brand-navy hover:bg-brand-navy/90 text-white"
                                    : "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
                                }`}
                        >
                            <Save size={14} />
                            {isSaving ? "저장 중..." : "DB 저장"}
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 sm:px-8 py-6 space-y-6">

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
                            이 설정은 사이드바 메뉴 노출 여부를 제어합니다. (DB에 즉시 반영)
                        </p>
                    </div>
                </div>

                {isLoading ? (
                    <div className="text-center py-20 text-zinc-500">권한 정보를 불러오는 중입니다...</div>
                ) : (
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
                        {/* Tabs */}
                        <div className="flex overflow-x-auto no-scrollbar border-b border-zinc-100 dark:border-zinc-800">
                            {sectionNames.map(section => (
                                <button
                                    key={section}
                                    onClick={() => setActiveTab(section)}
                                    className={`
                                        whitespace-nowrap px-6 py-4 text-sm font-semibold transition-colors
                                        ${activeTab === section 
                                            ? "text-brand-navy dark:text-brand-navy-light border-b-2 border-brand-navy dark:border-brand-navy-light" 
                                            : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                                        }
                                    `}
                                >
                                    {section}
                                </button>
                            ))}
                        </div>

                        {/* Legend */}
                        <div className="flex items-center justify-end gap-4 px-6 py-3 bg-zinc-50/50 dark:bg-zinc-800/30 border-b border-zinc-100 dark:border-zinc-800/30">
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

                        <div className="hidden lg:grid items-center px-6 py-3 bg-zinc-50/50 dark:bg-zinc-800/30 border-b border-zinc-100 dark:border-zinc-800/30" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}>
                            <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">메뉴 ({activeMenus.length})</div>
                            {roles.map(role => (
                                <div key={role.key} className="text-center">
                                    <span className={`text-xs font-bold ${role.color}`}>{role.label}</span>
                                </div>
                            ))}
                        </div>

                        {/* Menu Rows */}
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/30">
                            {activeMenus.map((menu) => (
                                <div
                                    key={menu.menuKey}
                                    className="px-6 py-5 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors"
                                >
                                    <div className="hidden lg:grid items-center" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}>
                                        <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 pr-4">
                                            {menu.label}
                                            <div className="text-[10px] text-zinc-400 font-normal mt-0.5 font-mono">{menu.menuKey}</div>
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
                                    <div className="lg:hidden space-y-4">
                                        <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                                            {menu.label}
                                            <div className="text-[10px] text-zinc-400 font-normal mt-0.5 font-mono">{menu.menuKey}</div>
                                        </div>
                                        <div className="flex flex-col gap-3">
                                            {roles.map(role => (
                                                <div
                                                    key={role.key}
                                                    className={`${role.bgColor} rounded-xl px-4 py-3 flex items-center justify-between`}
                                                >
                                                    <span className={`text-sm font-bold ${role.color}`}>
                                                        {role.label}
                                                    </span>
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex items-center gap-1.5">
                                                            <Eye size={14} className="text-zinc-400" />
                                                            <span className="text-xs text-zinc-500 font-medium dark:text-zinc-400">읽기</span>
                                                            <PermToggle
                                                                checked={menu.permissions[role.key].read}
                                                                onChange={() => togglePermission(menu.menuKey, role.key, "read")}
                                                                type="read"
                                                                disabled={menu.menuKey === "permissions" && role.key === "admin"}
                                                            />
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <Pencil size={14} className="text-zinc-400" />
                                                            <span className="text-xs text-zinc-500 font-medium dark:text-zinc-400">쓰기</span>
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
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
