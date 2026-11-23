"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
    Activity,
    Home,
    BookOpen,
    Dumbbell,
    Calendar,
    Flag,
    Settings,
    ChevronDown,
    ChevronRight,
    MoreHorizontal,
    Search,
    Bell,
    Menu,
    X,
    ClipboardList,
    Server,
    LogOut,
    UserCircle,
    MessageSquare,
    Trophy,
    Medal,
    LineChart
} from "lucide-react";

// Menu configuration based on user request
// Menu configuration with keys matching the Permissions Management page
const menuItems = [
    {
        key: "home",
        title: "Home",
        icon: Home,
        href: "/",
    },
    {
        key: "lessons",
        title: "레슨",
        icon: BookOpen,
        href: "/lessons",
    },
    {
        key: "analysis",
        title: "분석",
        icon: LineChart,
        href: "/analysis",
    },
    {
        key: "training",
        title: "훈련",
        icon: Dumbbell,
        href: "/training",
    },
    {
        key: "challenges",
        title: "챌린지",
        icon: Trophy,
        href: "/training/challenges",
    },
    {
        title: "참가 대회",
        icon: Medal,
        subItems: [
            { key: "tournament-schedule", title: "대회 스케쥴", href: "/schedule/tournaments" },
            { key: "tournament-results-view", title: "대회 결과", href: "/schedule/tournament-results" },
        ],
    },
    {
        title: "스케쥴",
        icon: Calendar,
        subItems: [
            { key: "schedule", title: "스케쥴 예약", href: "/schedule" },
            { key: "schedule-manage", title: "스케쥴 관리", href: "/schedule/manage" },
            { key: "coach-trip-schedule", title: "출장 스케쥴", href: "/schedule/coach-trips" },
        ],
    },
    {
        title: "스코어",
        icon: Flag,
        subItems: [
            { key: "scores", title: "스코어", href: "/scores" },
            { key: "scores-stats", title: "스코어 통계", href: "/scores/stats" },
            { key: "scores-category-stats", title: "항목별 통계", href: "/scores/category-stats" },
            { key: "scores-tournaments", title: "토너먼트", href: "/scores/tournaments" },
        ],
    },
    {
        title: "라운지",
        icon: MessageSquare,
        subItems: [
            { key: "community", title: "공지사항", href: "/community" },
            { key: "polls", title: "투표", href: "/admin/polls" },
            { key: "consultations", title: "상담", href: "/consultations" },
            { key: "training-plan", title: "훈련계획", href: "/admin/training-plan" },
            { key: "training-journal", title: "훈련일지", href: "/admin/training-journal" },
            { key: "attendance", title: "출석 체크", href: "/operations/attendance" },
            { key: "todo-list", title: "할일", href: "/operations/todos" },
            { key: "course-management", title: "골프IQ", href: "/course-management" },
            { key: "course-info", title: "코스 정보", href: "/course-info" },
            { key: "reports", title: "선수 레포트", href: "/operations/reports" },
            { key: "coach-selection", title: "담임 코치 선택", href: "/coach-selection" },
            { key: "my-qr", title: "스마트 패스", href: "/my-qr" },
        ],
    },
    {
        title: "운영/관리",
        icon: Settings,
        subItems: [
            { key: "statistics", title: "운영 통계", href: "/admin/statistics" },
            { key: "player-reports", title: "선수 레포트 작성", href: "/admin/player-reports" },
            { key: "assigned-athletes", title: "담임 선수 배정", href: "/admin/assigned-athletes" },
            { key: "tournament-results", title: "대회 성적 관리", href: "/admin/tournament-results" },
            { key: "lesson-list", title: "스윙 오류 관리", href: "/system/lesson-list" },
            { key: "training-list", title: "훈련 리스트 관리", href: "/system/training-list" },
            { key: "challenge-list", title: "챌린지 컨텐츠 관리", href: "/system/challenge-list" },
            { key: "qr-check", title: "스마트 패스 관리", href: "/operations/qr-check" },
        ],
    },
    {
        title: "시스템 관리",
        icon: Server,
        subItems: [
            { key: "attendance-kiosk", title: "출석체크 번호 입력", href: "/operations/attendance/kiosk" },
            { key: "branches", title: "지점 관리", href: "/system/branches" },
            { key: "athletes", title: "선수 관리", href: "/system/athletes" },
            { key: "coaches", title: "코치 관리", href: "/system/coaches" },
            { key: "parents", title: "학부모 관리", href: "/system/parents" },
            { key: "permissions", title: "권한 관리", href: "/system/permissions" },
            { key: "menu-management", title: "메뉴 관리", href: "/system/menu-management" },
            { key: "push-rules", title: "앱푸쉬 관리", href: "/system/push-rules" },
        ],
    },
    {
        title: "테스트",
        icon: ClipboardList,
        subItems: [
            { key: "temp-training", title: "훈련 (임시)", href: "/admin/training-temp" },
            { key: "temp-swing-skeleton", title: "스윙 테스트 (임시)", href: "/training/swing-skeleton" },
            { key: "temp-swing-test", title: "복습 카메라 (임시)", href: "/training/swing-test" },
            { key: "push-test", title: "푸시 알림 테스트", href: "/test/push", adminOnly: true },
        ],
    },
];

export function SideNav() {
    const router = useRouter();
    const pathname = usePathname();
    const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [profileLink, setProfileLink] = useState("/");
    const [userRole, setUserRole] = useState<string | null>(null);
    const [userName, setUserName] = useState<string | null>(null);
    const [userBranch, setUserBranch] = useState<string | null>(null);
    const [permissions, setPermissions] = useState<any[]>([]);
    const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);

    const handleDeleteAccount = async () => {
        if (isDeletingAccount) return;
        setIsDeletingAccount(true);
        try {
            const res = await fetch("/api/auth/delete-account", {
                method: "POST",
            });
            const data = await res.json();
            if (!res.ok) {
                alert(data.error || "회원탈퇴 처리에 실패했습니다.");
                return;
            }
            const supabase = createClient();
            await supabase.auth.signOut();
            alert("회원탈퇴가 완료되었습니다.");
            setIsDeleteAccountModalOpen(false);
            setIsMobileMenuOpen(false);
            router.push("/login");
            router.refresh();
        } catch (err) {
            console.error("Failed to delete account:", err);
            alert("회원탈퇴 처리 중 오류가 발생했습니다.");
        } finally {
            setIsDeletingAccount(false);
        }
    };

    // Close mobile menu when pathname changes
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [pathname]);

    useEffect(() => {
        const supabase = createClient();
        const getProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase
                    .from("users")
                    .select("id, role, name, branch, status")
                    .eq("id", user.id)
                    .single();

                if (profile) {
                    if (profile.status === "퇴직" || profile.status === "휴직") {
                        await supabase.auth.signOut();
                        window.location.href = `/login?message=${encodeURIComponent(
                            profile.status === "퇴직"
                                ? "퇴직 처리된 계정입니다. 관리자에게 문의하세요."
                                : "휴직 상태인 계정입니다. 관리자에게 문의하세요."
                        )}`;
                        return;
                    }

                    setUserRole(profile.role);
                    setUserName(profile.name);
                    setUserBranch(profile.branch);
                    if (profile.role === "coach" || profile.role === "admin" || profile.role === "headquarter" || profile.role === "office") {
                        setProfileLink(`/system/coaches/${profile.id}`);
                    } else if (profile.role === "athlete") {
                        setProfileLink(`/system/athletes/${profile.id}`);
                    }
                }
            } else {
                setUserRole("guest");
            }
        };
        getProfile();

        // Load permissions from Supabase
        const getPermissions = async () => {
            const { data, error } = await supabase.from('role_permissions').select('*');
            if (data && !error) {
                // Group by menuKey
                const permMap: any[] = [];
                const grouped = data.reduce((acc: any, curr: any) => {
                    if (!acc[curr.menu_key]) {
                        acc[curr.menu_key] = {
                            menuKey: curr.menu_key,
                            permissions: {}
                        };
                    }
                    acc[curr.menu_key].permissions[curr.role] = {
                        read: curr.can_read,
                        write: curr.can_write
                    };
                    return acc;
                }, {});
                for (const key in grouped) {
                    permMap.push(grouped[key]);
                }
                setPermissions(permMap);
            } else {
                setPermissions([]);
            }
        };
        getPermissions();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
            if (session?.user) {
                getProfile();
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // 모바일 앱(WebView) 환경에서 발급된 푸시 토큰을 로그인 계정에 자동 등록
    useEffect(() => {
        if (!userRole || userRole === "guest") return;

        const registerToken = (token?: string, platform?: string) => {
            if (!token) return;
            const cacheKey = `push_registered_${token}`;
            if (sessionStorage.getItem(cacheKey) === userRole) return;
            fetch("/api/push/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, platform }),
            })
                .then((res) => {
                    if (res.ok) {
                        sessionStorage.setItem(cacheKey, userRole);
                    }
                })
                .catch(() => {});
        };

        const win = window as any;
        if (win.__EXPO_PUSH_TOKEN__) {
            registerToken(win.__EXPO_PUSH_TOKEN__, win.__EXPO_PLATFORM__);
        }

        const handlePushTokenEvent = (e: Event) => {
            const customEvent = e as CustomEvent<{ token?: string; platform?: string }>;
            registerToken(customEvent.detail?.token, customEvent.detail?.platform);
        };

        window.addEventListener("expoPushToken", handlePushTokenEvent);
        return () => window.removeEventListener("expoPushToken", handlePushTokenEvent);
    }, [userRole]);

    const canShowMenu = (item: any) => {
        if (!userRole) return false;

        const isSuperAdmin = userRole === "admin" || userRole === "super_admin" || userRole === "superadmin" || userName === "슈퍼관리자";
        if (isSuperAdmin) return true;

        const isHQOrOffice = userRole === "headquarter" || userRole === "office";

        // Hide Admin & System menus explicitly for athletes
        if (userRole === "athlete" && (item.title === "운영/관리" || item.title === "시스템 관리" || item.title === "테스트")) {
            return false;
        }

        // Hide System menus explicitly for coaches
        if (userRole === "coach" && item.title === "시스템 관리") {
            return false;
        }

        if (item.title === "테스트") {
            if (!isHQOrOffice) {
                return false;
            }
        }

        if (item.subItems) {
            // Folder is visible if any sub-item is visible
            return item.subItems.some((sub: any) => canShowSubItem(sub));
        }

        const perm = permissions.find(p => p.menuKey === item.key);
        if (!perm) return true; // Default to visible if not in perm table (e.g. newly added)

        return perm.permissions[userRole]?.read;
    };

    const canShowSubItem = (sub: any) => {
        if (!userRole) return false;

        const isSuperAdmin = userRole === "admin" || userRole === "super_admin" || userRole === "superadmin" || userName === "슈퍼관리자";
        if (isSuperAdmin) return true;

        if (sub.adminOnly) {
            return false;
        }

        if (sub.key === "schedule-manage" && (userRole === "athlete" || userRole === "parent")) {
            return false;
        }

        const perm = permissions.find(p => p.menuKey === sub.key);
        if (!perm) return true;

        return perm.permissions[userRole]?.read;
    };

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/login");
    };

    const toggleMenu = (title: string) => {
        setOpenMenus((prev) => ({
            ...prev,
            [title]: !prev[title],
        }));
    };

    // Format today's date
    const today = new Date();
    const dateOptions: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    };
    const formattedDate = today.toLocaleDateString('en-GB', dateOptions);

    return (
        <>
            {/* Mobile Header with new design layout */}
            <div className="md:hidden flex items-center justify-between bg-white dark:bg-zinc-950 px-4 h-16 sticky top-0 z-40 w-full border-b border-zinc-200 dark:border-zinc-800/60">

                {/* Left: Menu Trigger */}
                <button
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="p-2 -ml-2 text-zinc-900 dark:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg transition-colors"
                >
                    <Menu size={24} />
                </button>

                {/* Right: Shortcuts + Profile aligned to the right */}
                <div className="flex items-center gap-1 sm:gap-2 ml-auto">
                    <Link href="/" className={cn(
                        "flex flex-col items-center justify-center min-w-[40px] py-1 rounded-lg transition-all",
                        pathname === "/" ? "text-brand-navy dark:text-brand-navy-light" : "text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                    )}>
                        <Home size={18} />
                        <span className="text-[9px] font-bold mt-0.5 leading-none">Home</span>
                    </Link>
                    <Link href="/lessons" className={cn(
                        "flex flex-col items-center justify-center min-w-[40px] py-1 rounded-lg transition-all",
                        pathname.startsWith("/lessons") ? "text-brand-navy dark:text-brand-navy-light" : "text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                    )}>
                        <BookOpen size={18} />
                        <span className="text-[9px] font-bold mt-0.5 leading-none">Lesson</span>
                    </Link>
                    <Link href="/training" className={cn(
                        "flex flex-col items-center justify-center min-w-[40px] py-1 rounded-lg transition-all",
                        pathname.startsWith("/training") ? "text-brand-navy dark:text-brand-navy-light" : "text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                    )}>
                        <Dumbbell size={18} />
                        <span className="text-[9px] font-bold mt-0.5 leading-none">Train</span>
                    </Link>
                    <Link href="/scores" className={cn(
                        "flex flex-col items-center justify-center min-w-[40px] py-1 rounded-lg transition-all",
                        pathname.startsWith("/scores") ? "text-brand-navy dark:text-brand-navy-light" : "text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                    )}>
                        <Flag size={18} />
                        <span className="text-[9px] font-bold mt-0.5 leading-none">Score</span>
                    </Link>
                    <Link href={profileLink} className={cn(
                        "flex flex-col items-center justify-center min-w-[44px] py-1 rounded-lg transition-all",
                        pathname.startsWith("/system/coaches") || pathname.startsWith("/system/athletes") ? "text-brand-navy dark:text-brand-navy-light" : "text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                    )}>
                        <UserCircle size={22} strokeWidth={1.5} />
                        <span className="text-[9px] font-bold mt-0.5 leading-none">Profile</span>
                    </Link>
                </div>
            </div>

            {/* Backdrop for mobile */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar (Fixed on Mobile, Sticky on Desktop) */}
            <aside className={`fixed inset-y-0 left-0 z-50 w-[280px] sm:w-64 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 transform transition-transform duration-300 ease-in-out md:sticky md:top-0 md:h-screen overflow-y-auto
                ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
            `}>
                <div className="p-6">
                    <div className="flex flex-col gap-4 mb-6">
                        <div className="flex items-center justify-between">
                            <Link href="/" className="flex items-center justify-center w-full px-3 py-2.5 bg-brand-navy rounded-xl shadow-md group border border-brand-navy-dark">
                                <span className="text-white font-black text-xl tracking-widest transition-transform group-hover:scale-105">Level-Up</span>
                            </Link>
                            {/* Mobile Close Button */}
                            <button
                                className="p-1 -mr-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 md:hidden transition-colors ml-4"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex flex-row items-center justify-center gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800/60">
                            <Link href={profileLink} className="flex items-center gap-2 px-3 py-1.5 rounded-full text-zinc-400 hover:text-brand-navy dark:hover:text-brand-navy-light hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all focus:outline-none">
                                <UserCircle size={24} strokeWidth={1.5} />
                                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{userName}</span>
                            </Link>

                            <button
                                onClick={handleLogout}
                                className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800 dark:hover:text-red-400 transition-colors" title="로그아웃"
                            >
                                <LogOut size={18} strokeWidth={2.5} />
                            </button>
                        </div>
                    </div>

                    <nav className="space-y-1">
                        {menuItems
                            .filter(item => canShowMenu(item))
                            .map((item) => {
                                const Icon = item.icon;
                                const filteredSubItems = item.subItems?.filter(sub => canShowSubItem(sub));
                                const hasSubItems = !!filteredSubItems && filteredSubItems.length > 0;

                                if (!item.subItems) {
                                    // For single links, we consider it active if the pathname starts with the href
                                    // But avoid double-highlighting if another menu item has a more specific (longer) match
                                    const isActive = pathname === item.href || (
                                        item.href !== '/' &&
                                        pathname.startsWith(item.href!) &&
                                        !menuItems.some(other =>
                                            other.href !== item.href &&
                                            other.href &&
                                            other.href !== '/' &&
                                            pathname.startsWith(other.href) &&
                                            other.href.length > item.href!.length
                                        )
                                    );
                                    return (
                                        <Link
                                            key={item.title}
                                            href={item.href!}
                                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                                            ${isActive
                                                    ? "bg-brand-navy/10 text-brand-navy dark:bg-brand-navy/20 dark:text-white"
                                                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-zinc-100"
                                                }`}
                                        >
                                            <Icon size={18} />
                                            {item.title}
                                        </Link>
                                    );
                                }

                                // Foldable Item
                                const isMenuOpen = openMenus[item.title];
                                const isAnyChildActive = item.subItems?.some(
                                    sub => pathname === sub.href || pathname.startsWith(sub.href + '/')
                                );

                                return (
                                    <div key={item.title} className="space-y-1">
                                        <button
                                            onClick={() => toggleMenu(item.title)}
                                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                                            ${isAnyChildActive
                                                    ? "text-brand-navy dark:text-white"
                                                    : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <Icon size={18} className={isAnyChildActive ? "text-brand-navy dark:text-brand-navy-light" : "text-zinc-400"} />
                                                {item.title}
                                            </div>
                                            {isMenuOpen ? (
                                                <ChevronDown size={16} className="text-zinc-400" />
                                            ) : (
                                                <ChevronRight size={16} className="text-zinc-400" />
                                            )}
                                        </button>

                                        {isMenuOpen && (
                                            <div className="pl-10 space-y-1 mt-1 mb-2">
                                                {filteredSubItems?.map((sub) => {
                                                    const isSubActive = pathname === sub.href;
                                                    return (
                                                        <Link
                                                            key={sub.title}
                                                            href={sub.href}
                                                            onClick={() => {
                                                                if (sub.href === "/admin/player-reports") {
                                                                    sessionStorage.removeItem("gla_report_athlete_id");
                                                                }
                                                            }}
                                                            className={`block px-3 py-2 rounded-lg text-sm transition-colors
                                                            ${isSubActive
                                                                    ? "bg-brand-navy/5 text-brand-navy font-semibold dark:bg-brand-navy/20 dark:text-white"
                                                                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                                                                }`}
                                                        >
                                                            {sub.title}
                                                        </Link>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                    </nav>

                    {userRole && userRole !== "guest" && userName !== "슈퍼관리자" && (
                        <div className="mt-8 pt-4 border-t border-zinc-100 dark:border-zinc-800/60 flex justify-center">
                            <button
                                type="button"
                                onClick={() => setIsDeleteAccountModalOpen(true)}
                                className="text-xs font-medium text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition-colors underline underline-offset-4"
                            >
                                회원탈퇴
                            </button>
                        </div>
                    )}
                </div>
            </aside>

            {/* Delete Account Confirmation Modal */}
            {isDeleteAccountModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => !isDeletingAccount && setIsDeleteAccountModalOpen(false)}>
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-sm border border-zinc-200 dark:border-zinc-800 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                            회원탈퇴
                        </h3>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                            정말로 회원탈퇴를 진행하시겠습니까? 탈퇴 시 계정 정보 및 이용 권한이 즉시 삭제되며 복구할 수 없습니다.
                        </p>
                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                                type="button"
                                disabled={isDeletingAccount}
                                onClick={() => setIsDeleteAccountModalOpen(false)}
                                className="px-4 py-2 rounded-xl text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                disabled={isDeletingAccount}
                                onClick={handleDeleteAccount}
                                className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
                            >
                                {isDeletingAccount ? "처리 중..." : "탈퇴하기"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
