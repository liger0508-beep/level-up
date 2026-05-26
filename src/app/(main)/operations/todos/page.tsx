"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { 
    Calendar as CalendarIcon, 
    Plus, 
    Trash2, 
    CheckCircle2, 
    Circle, 
    User, 
    ChevronLeft, 
    ChevronRight,
    AlertCircle,
    Clock,
    UserPlus,
    Dumbbell,
    ClipboardCheck,
    X,
    Search,
    Check,
    Users as UsersIcon,
    Building2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatLocalDate } from "@/lib/utils";

interface UnifiedItem {
    id: string;
    type: 'todo' | 'schedule' | 'training' | 'record' | 'score' | 'journal' | 'analysis' | 'lesson';
    title: string;
    content: string | null;
    is_completed: boolean;
    due_date: string;
    user_id: string;
    user_name?: string;
    assigner_id?: string | null;
    assigner_name?: string;
    time?: string;
}

interface UserProfile {
    id: string;
    name: string;
    role: string;
    branch: string | null;
}

export default function TodoPage() {
    const [items, setItems] = useState<UnifiedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
    const [selectedDate, setSelectedDate] = useState(formatLocalDate(new Date()));
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    
    // Form states
    const [newTodoTitle, setNewTodoTitle] = useState("");
    const [newTodoContent, setNewTodoContent] = useState("");
    const [userSearchQuery, setUserSearchQuery] = useState("");
    const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);

    useEffect(() => {
        const supabase = createClient();
        const fetchData = async () => {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase
                    .from("users")
                    .select("id, name, role, branch")
                    .eq("id", user.id)
                    .single();
                setCurrentUser(profile);
                
                // Initially select self
                if (profile) setSelectedUserIds(new Set([profile.id]));

                await fetchAllItems(user.id, selectedDate, profile?.role || "athlete");

                // Fetch all users for selection (only if coach/admin)
                if (profile?.role === "coach" || profile?.role === "admin") {
                    const { data: users } = await supabase
                        .from("users")
                        .select("id, name, role, branch")
                        .order("name");
                    setAllUsers(users || []);
                }
            }
            setLoading(false);
        };
        fetchData();
    }, [selectedDate]);

    const fetchAllItems = async (currentUserId: string, date: string, role: string) => {
        const supabase = createClient();
        
        // 1. Fetch Todos
        let todoQuery = supabase
            .from("todos")
            .select(`*, assigner:assigner_id(name), user:user_id(name)`)
            .eq("due_date", date);

        if (role === "athlete" || role === "parent") {
            todoQuery = todoQuery.eq("user_id", currentUserId);
        } else {
            todoQuery = todoQuery.or(`user_id.eq.${currentUserId},assigner_id.eq.${currentUserId}`);
        }
        
        const { data: todoData } = await todoQuery.order("created_at", { ascending: false });

        // 2. Fetch Schedules
        const startOfDay = `${date}T00:00:00Z`;
        const endOfDay = `${date}T23:59:59Z`;
        let scheduleQuery = supabase
            .from("schedules")
            .select(`*, users!schedules_user_id_fkey(name)`)
            .gte("start_time", startOfDay)
            .lte("start_time", endOfDay);

        if (role === "athlete" || role === "parent") {
            scheduleQuery = scheduleQuery.eq("user_id", currentUserId);
        }
        const { data: scheduleData } = await scheduleQuery;

        // 3. Fetch Training Periods (Records)
        let trainingQuery = supabase
            .from("records")
            .select(`*, users!records_user_id_fkey(name), coach:users!records_coach_id_fkey(name)`)
            .eq("type", "training")
            .lte("training_start", date)
            .gte("training_end", date);

        if (role === "athlete" || role === "parent") {
            trainingQuery = trainingQuery.eq("user_id", currentUserId);
        }
        const { data: trainingData } = await trainingQuery;

        // 4. Fetch All other records for the date
        const startOfSelectedDay = new Date(date);
        startOfSelectedDay.setHours(0, 0, 0, 0);
        const endOfSelectedDay = new Date(date);
        endOfSelectedDay.setHours(23, 59, 59, 999);

        let recordsQuery = supabase
            .from("records")
            .select(`*, users!records_user_id_fkey(name)`)
            .gte("created_at", startOfSelectedDay.toISOString())
            .lte("created_at", endOfSelectedDay.toISOString());

        if (role === "athlete" || role === "parent") {
            recordsQuery = recordsQuery.eq("user_id", currentUserId);
        }
        const { data: recordsData } = await recordsQuery;

        // 5. Fetch Scorecards
        let scoresQuery = supabase
            .from("scorecards")
            .select(`*, users:athlete_id(name)`)
            .eq("round_date", date);
        
        if (role === "athlete" || role === "parent") {
            scoresQuery = scoresQuery.eq("athlete_id", currentUserId);
        }
        const { data: scoresData } = await scoresQuery;

        // Map
        const mappedTodos: UnifiedItem[] = (todoData || []).map(t => ({
            id: t.id,
            type: 'todo',
            title: t.title,
            content: t.content,
            is_completed: t.is_completed,
            due_date: t.due_date,
            user_id: t.user_id,
            user_name: t.user?.name,
            assigner_id: t.assigner_id,
            assigner_name: t.assigner?.name
        }));

        const mappedSchedules: UnifiedItem[] = (scheduleData || []).map(s => {
            const dStart = new Date(s.start_time);
            const timeStr = `${dStart.getHours().toString().padStart(2, '0')}:${dStart.getMinutes().toString().padStart(2, '0')}`;
            
            // Check if there's a matching record for this schedule
            const isCompletedByRecord = (recordsData || []).some(r => 
                (r.type === s.event_type || (s.event_type === 'lesson' && (r.type === 'lesson' || r.type === 'analysis'))) &&
                (r.title === s.title || s.title?.includes(r.title || "") || r.title?.includes(s.title || ""))
            );

            return {
                id: s.id,
                type: 'schedule',
                title: `[예약] ${s.title}`,
                content: `시간: ${timeStr} | 참여자: ${s.users?.name}`,
                is_completed: s.status === "completed" || isCompletedByRecord,
                due_date: date,
                user_id: s.user_id,
                user_name: s.users?.name,
                time: timeStr
            };
        });

        const mappedTrainings: UnifiedItem[] = (trainingData || [])
            .filter(t => {
                if (role === 'admin') return false;
                if (role === 'coach' && t.coach_id === currentUserId) return false;
                return true;
            })
            .map(t => {
            const isCompletedToday = t.completion_logs?.some((log: string) => {
                try {
                    let timestamp = log;
                    if (log.startsWith('{')) {
                        timestamp = JSON.parse(log).timestamp;
                    }
                    return formatLocalDate(new Date(timestamp)) === date;
                } catch { return false; }
            });

            return {
                id: t.id,
                type: 'training',
                title: `${t.title}`,
                content: `훈련 기간: ${t.training_start} ~ ${t.training_end}`,
                is_completed: isCompletedToday,
                due_date: date,
                user_id: t.user_id,
                user_name: t.users?.name,
                assigner_id: t.coach_id,
                assigner_name: t.coach?.name
            };
        });

        const mappedOtherRecords: UnifiedItem[] = (recordsData || []).filter(r => {
            if (r.type === 'course_management') return false;
            // Filter out journals and trainings already handled or matched to schedules
            const isUsedInTraining = r.type === 'training' && trainingData?.some(at => r.id === at.id);
            const matchesSchedule = (scheduleData || []).some(s => 
                (r.type === s.event_type || (s.event_type === 'lesson' && (r.type === 'lesson' || r.type === 'analysis'))) &&
                (r.title === s.title || s.title?.includes(r.title || "") || r.title?.includes(s.title || ""))
            );
            return !isUsedInTraining && !matchesSchedule;
        }).map(r => {
            const dStart = new Date(r.created_at);
            const timeStr = `${dStart.getHours().toString().padStart(2, '0')}:${dStart.getMinutes().toString().padStart(2, '0')}`;
            const typeLabels: Record<string, string> = { lesson: "레슨", training: "훈련", analysis: "분석", journal: "일지" };
            return {
                id: r.id,
                type: r.type as any,
                title: `[${typeLabels[r.type] || "기록"}] ${r.title || ""}`,
                content: `기록 시간: ${timeStr} | 작성자: ${r.users?.name}`,
                is_completed: true,
                due_date: date,
                user_id: r.user_id,
                user_name: r.users?.name,
                time: timeStr
            };
        });

        const mappedScores: UnifiedItem[] = (scoresData || []).map(s => {
            const dStart = new Date(s.created_at);
            const timeStr = `${dStart.getHours().toString().padStart(2, '0')}:${dStart.getMinutes().toString().padStart(2, '0')}`;
            return {
                id: s.id,
                type: 'score',
                title: `[스코어] ${s.course_name}`,
                content: `입력 시간: ${timeStr} | 선수: ${s.users?.name} | 점수: ${s.total_score}`,
                is_completed: true,
                due_date: date,
                user_id: s.athlete_id,
                user_name: s.users?.name,
                time: timeStr
            };
        });

        const dailyJournals: UnifiedItem[] = [];
        if (role === "athlete") {
            const todaysJournals = (recordsData || []).filter(r => r.type === 'journal');
            if (todaysJournals.length === 0) {
                dailyJournals.push({
                    id: `daily-journal-${date}`,
                    type: 'journal',
                    title: '훈련일지 작성',
                    content: '오늘의 훈련 일지를 작성해주세요.',
                    is_completed: false,
                    due_date: date,
                    user_id: currentUserId
                });
            }
        }

        const allItems = [...mappedTodos, ...mappedSchedules, ...mappedTrainings, ...mappedOtherRecords, ...mappedScores, ...dailyJournals];
        allItems.sort((a, b) => {
            if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
            const typeOrder = { todo: 0, schedule: 1, training: 2, lesson: 3, analysis: 4, score: 5, journal: 6 };
            return (typeOrder[a.type as keyof typeof typeOrder] || 99) - (typeOrder[b.type as keyof typeof typeOrder] || 99);
        });

        setItems(allItems);
    };

    const handleAddTodo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTodoTitle.trim() || selectedUserIds.size === 0) return;

        const supabase = createClient();
        const inserts = Array.from(selectedUserIds).map(userId => ({
            user_id: userId,
            assigner_id: currentUser?.id,
            title: newTodoTitle,
            content: newTodoContent,
            due_date: selectedDate,
            is_completed: false,
            priority: "medium"
        }));

        const { error } = await supabase
            .from("todos")
            .insert(inserts);

        if (error) {
            alert("To-Do 추가 중 오류가 발생했습니다.");
        } else {
            setNewTodoTitle("");
            setNewTodoContent("");
            setIsAddModalOpen(false);
            if (currentUser) fetchAllItems(currentUser.id, selectedDate, currentUser.role);
        }
    };

    const toggleUserSelection = (userId: string) => {
        const next = new Set(selectedUserIds);
        if (next.has(userId)) next.delete(userId);
        else next.add(userId);
        setSelectedUserIds(next);
    };

    const selectByRole = (role: string) => {
        const matchingIds = allUsers.filter(u => u.role === role).map(u => u.id);
        setSelectedUserIds(new Set([...Array.from(selectedUserIds), ...matchingIds]));
    };

    const selectByBranch = (branch: string) => {
        const matchingIds = allUsers.filter(u => u.branch === branch).map(u => u.id);
        setSelectedUserIds(new Set([...Array.from(selectedUserIds), ...matchingIds]));
    };

    const branches = useMemo(() => {
        const set = new Set<string>();
        allUsers.forEach(u => { if (u.branch) set.add(u.branch); });
        return Array.from(set).sort();
    }, [allUsers]);

    const searchedUsers = useMemo(() => {
        if (!userSearchQuery) return [];
        return allUsers.filter(u => 
            u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
            (u.branch || "").toLowerCase().includes(userSearchQuery.toLowerCase())
        ).slice(0, 10);
    }, [allUsers, userSearchQuery]);

    const toggleComplete = async (item: UnifiedItem) => {
        const supabase = createClient();
        const isCurrentlyCompleted = item.is_completed;
        const todayStr = formatLocalDate(new Date());

        try {
            if (item.type === 'todo') {
                const { error } = await supabase
                    .from("todos")
                    .update({ is_completed: !isCurrentlyCompleted })
                    .eq("id", item.id);
                if (error) throw error;
            } else if (item.type === 'schedule') {
                const { error } = await supabase
                    .from("schedules")
                    .update({ status: isCurrentlyCompleted ? 'scheduled' : 'completed' })
                    .eq("id", item.id);
                if (error) throw error;
            } else if (item.type === 'training') {
                // Find the record and update completion_logs
                const { data: record } = await supabase
                    .from("records")
                    .select("id, completion_logs")
                    .eq("id", item.id)
                    .single();
                
                if (record) {
                    let logs = [];
                    if (record.completion_logs) {
                        logs = Array.isArray(record.completion_logs) ? record.completion_logs : [record.completion_logs];
                    }
                    
                    if (!isCurrentlyCompleted) {
                        // Add today's log
                        logs.push(JSON.stringify({ timestamp: new Date().toISOString(), type: 'quick-complete' }));
                    } else {
                        // Remove today's log
                        logs = logs.filter((log: string) => {
                            try {
                                const ts = log.startsWith('{') ? JSON.parse(log).timestamp : log;
                                return formatLocalDate(new Date(ts)) === todayStr;
                            } catch { return true; }
                        }).filter((log: string) => {
                            // Actually we want to KEEP logs from OTHER days, and only remove today's logs if we are un-completing
                            try {
                                const ts = log.startsWith('{') ? JSON.parse(log).timestamp : log;
                                return formatLocalDate(new Date(ts)) !== todayStr;
                            } catch { return true; }
                        });
                    }

                    const { error } = await supabase
                        .from("records")
                        .update({ completion_logs: logs })
                        .eq("id", record.id);
                    if (error) throw error;
                }
            } else {
                alert("자동 연동 항목(기록 등)의 상태는 해당 메뉴에서 변경해주세요.");
                return;
            }

            setItems(items.map(t => t.id === item.id && t.type === item.type ? { ...t, is_completed: !isCurrentlyCompleted } : t));
        } catch (err) {
            console.error("Toggle failed:", err);
            alert("상태 변경 중 오류가 발생했습니다.");
        }
    };

    const handleDelete = async (item: UnifiedItem) => {
        if (item.type !== 'todo') return;
        if (!confirm("정말 삭제하시겠습니까?")) return;
        
        const supabase = createClient();
        const { error } = await supabase
            .from("todos")
            .delete()
            .eq("id", item.id);

        if (error) {
            alert("삭제 중 오류가 발생했습니다.");
        } else {
            setItems(items.filter(t => t.id !== item.id));
        }
    };

    const changeDate = (days: number) => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + days);
        setSelectedDate(formatLocalDate(d));
    };

    const isCoachOrAdmin = currentUser?.role === "coach" || currentUser?.role === "admin";

    return (
        <div className="max-w-5xl mx-auto px-4 py-8">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div>
                    <h1 className="text-3xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight mb-2">To-Do 리스트</h1>
                    <p className="text-zinc-500 dark:text-zinc-400 font-medium">자동 연동된 일정과 할 일을 한눈에 관리하세요.</p>
                </div>
                <button
                    onClick={() => {
                        setIsAddModalOpen(true);
                        if (currentUser) setSelectedUserIds(new Set([currentUser.id]));
                    }}
                    className="flex items-center justify-center gap-2 bg-brand-navy hover:bg-brand-navy-dark text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-brand-navy/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                    <Plus size={20} strokeWidth={3} />
                    <span>새 할일 추가</span>
                </button>
            </header>

            {/* Date Selector */}
            <div className="bg-white dark:bg-zinc-900 rounded-[2rem] p-4 mb-8 shadow-sm border border-zinc-200/60 dark:border-zinc-800/60 flex items-center justify-between">
                <button 
                    onClick={() => changeDate(-1)}
                    className="p-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 transition-colors"
                >
                    <ChevronLeft size={24} />
                </button>
                <div className="flex items-center gap-3">
                    <CalendarIcon size={20} className="text-brand-navy" />
                    <span className="text-lg font-black text-zinc-800 dark:text-zinc-200 tracking-tight">
                        {selectedDate === formatLocalDate(new Date()) ? "오늘, " : ""}
                        {selectedDate}
                    </span>
                </div>
                <button 
                    onClick={() => changeDate(1)}
                    className="p-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 transition-colors"
                >
                    <ChevronRight size={24} />
                </button>
            </div>

            {/* List Area */}
            <div className="space-y-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
                        <Clock className="animate-spin mb-4" size={40} />
                        <p className="font-bold">데이터를 불러오는 중...</p>
                    </div>
                ) : items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-zinc-900 rounded-[2.5rem] border-2 border-dashed border-zinc-100 dark:border-zinc-800/50">
                        <AlertCircle className="text-zinc-200 dark:text-zinc-800 mb-4" size={60} />
                        <p className="text-zinc-500 font-bold">등록된 일정이 없습니다.</p>
                    </div>
                ) : (
                    items.map((item) => (
                        <div 
                            key={`${item.type}-${item.id}`}
                            className={cn(
                                "group bg-white dark:bg-zinc-900 rounded-3xl p-5 border transition-all flex items-center gap-4",
                                item.is_completed 
                                    ? "border-zinc-100 dark:border-zinc-800/50 opacity-60" 
                                    : "border-zinc-200/60 dark:border-zinc-800/60 shadow-sm hover:shadow-md hover:border-brand-navy/20",
                                item.type === 'schedule' && !item.is_completed && "border-l-4 border-l-blue-500",
                                item.type === 'training' && !item.is_completed && "border-l-4 border-l-emerald-500",
                                (item.type === 'lesson' || item.type === 'analysis') && "border-l-4 border-l-orange-500",
                                item.type === 'score' && "border-l-4 border-l-sky-500",
                                item.type === 'journal' && "border-l-4 border-l-indigo-500"
                            )}
                        >
                            <button 
                                onClick={() => toggleComplete(item)}
                                disabled={!['todo', 'schedule', 'training'].includes(item.type)}
                                title={['todo', 'schedule', 'training'].includes(item.type) ? "완료 체크" : "자동 연동 항목"}
                                className={cn(
                                    "shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all",
                                    item.is_completed 
                                        ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" 
                                        : "text-zinc-300 border-2 border-zinc-100 dark:border-zinc-800",
                                    ['todo', 'schedule', 'training'].includes(item.type) && !item.is_completed && "hover:text-brand-navy hover:border-brand-navy/50 cursor-pointer",
                                    !['todo', 'schedule', 'training'].includes(item.type) && "cursor-default"
                                )}
                            >
                                {item.is_completed ? <CheckCircle2 size={24} /> : (
                                    item.type === 'schedule' ? <CalendarIcon size={20} /> : 
                                    item.type === 'training' ? <Dumbbell size={20} /> :
                                    <Circle size={24} />
                                )}
                            </button>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <Link href={
                                        item.type === 'todo' && item.title && item.title.includes(':::ID:::')
                                            ? `/course-management/${item.title.split(':::ID:::')[1].trim()}`
                                            : '#'
                                    }>
                                        <h3 className={cn(
                                            "text-base font-bold truncate hover:text-brand-navy dark:hover:text-brand-navy-light cursor-pointer transition-colors",
                                            item.is_completed ? "text-zinc-400 line-through" : "text-zinc-900 dark:text-zinc-50"
                                        )}>
                                            {item.title ? item.title.split(':::ID:::')[0] : ''}
                                        </h3>
                                    </Link>
                                    {(item.type === 'todo' || item.type === 'training') && item.assigner_id && item.assigner_id !== item.user_id && (
                                        <span className="px-2 py-0.5 rounded-full bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 text-[10px] font-black uppercase">
                                            Assigned by {item.assigner_name}
                                        </span>
                                    )}
                                    {item.type !== 'todo' && (
                                        <span className={cn(
                                            "px-2 py-0.5 rounded-full text-[10px] font-black uppercase",
                                            item.type === 'schedule' ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400" : 
                                            item.type === 'training' ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400" :
                                            item.type === 'score' ? "bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-400" :
                                            item.type === 'journal' ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400" :
                                            "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400"
                                        )}>
                                            {item.type}
                                        </span>
                                    )}
                                </div>
                                {item.content && (
                                    <p className={cn(
                                        "text-xs font-medium truncate",
                                        item.is_completed ? "text-zinc-300" : "text-zinc-500 dark:text-zinc-400"
                                    )}>
                                        {item.content}
                                    </p>
                                )}
                                {isCoachOrAdmin && item.user_id !== currentUser?.id && (
                                    <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-brand-navy dark:text-brand-navy-light uppercase">
                                        <User size={12} />
                                        <span>대상: {item.user_name}</span>
                                    </div>
                                )}
                            </div>

                            {item.type === 'todo' && (
                                <button 
                                    onClick={() => handleDelete(item)}
                                    className="opacity-0 group-hover:opacity-100 p-2 rounded-xl text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                                >
                                    <Trash2 size={18} />
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Add Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-zinc-950 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-zinc-200 dark:border-zinc-800">
                        <div className="p-8">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-brand-navy/10 flex items-center justify-center text-brand-navy">
                                        <Plus size={24} strokeWidth={3} />
                                    </div>
                                    <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-50">새 To-Do 등록</h2>
                                </div>
                                <button 
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-400 transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleAddTodo} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Left Side: Content */}
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-1">할 일 제목</label>
                                            <input
                                                type="text"
                                                required
                                                value={newTodoTitle}
                                                onChange={(e) => setNewTodoTitle(e.target.value)}
                                                placeholder="무엇을 해야 하나요?"
                                                className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800/60 rounded-2xl px-5 py-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-navy/20 transition-all"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-1">상세 내용 (선택)</label>
                                            <textarea
                                                value={newTodoContent}
                                                onChange={(e) => setNewTodoContent(e.target.value)}
                                                placeholder="상세 정보를 입력하세요..."
                                                rows={4}
                                                className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800/60 rounded-2xl px-5 py-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-navy/20 transition-all resize-none"
                                            />
                                        </div>
                                    </div>

                                    {/* Right Side: Target Selection */}
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-1">대상 지정 ({selectedUserIds.size}명)</label>
                                            
                                            {isCoachOrAdmin ? (
                                                <div className="space-y-4">
                                                    {/* Bulk Buttons */}
                                                    <div className="flex flex-wrap gap-2">
                                                        <button type="button" onClick={() => selectByRole('athlete')} className="px-2 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-[10px] font-black border border-emerald-100 dark:border-emerald-800 hover:scale-105 transition-all">전체 선수</button>
                                                        <button type="button" onClick={() => selectByRole('coach')} className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-[10px] font-black border border-blue-100 dark:border-blue-800 hover:scale-105 transition-all">전체 코치</button>
                                                        <button type="button" onClick={() => selectByRole('parent')} className="px-2 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-lg text-[10px] font-black border border-amber-100 dark:border-amber-800 hover:scale-105 transition-all">전체 학부모</button>
                                                        {branches.map(b => (
                                                            <button key={b} type="button" onClick={() => selectByBranch(b)} className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-lg text-[10px] font-black border border-zinc-200 dark:border-zinc-700 hover:scale-105 transition-all">
                                                                {b}
                                                            </button>
                                                        ))}
                                                    </div>

                                                    {/* User Search */}
                                                    <div className="relative">
                                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                                        <input
                                                            type="text"
                                                            placeholder="이름/지점으로 검색..."
                                                            value={userSearchQuery}
                                                            onChange={(e) => setUserSearchQuery(e.target.value)}
                                                            className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800/60 rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-navy/20 transition-all"
                                                        />
                                                        {searchedUsers.length > 0 && (
                                                            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-10 overflow-hidden py-1">
                                                                {searchedUsers.map(u => (
                                                                    <button
                                                                        key={u.id}
                                                                        type="button"
                                                                        onClick={() => { toggleUserSelection(u.id); setUserSearchQuery(""); }}
                                                                        className="w-full px-4 py-2 text-left text-xs font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-between"
                                                                    >
                                                                        <span>{u.name} ({u.role}) - {u.branch}</span>
                                                                        {selectedUserIds.has(u.id) && <Check size={14} className="text-emerald-500" />}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Selected Users Chips */}
                                                    <div className="max-h-32 overflow-y-auto flex flex-wrap gap-2 pr-1">
                                                        {allUsers.filter(u => selectedUserIds.has(u.id)).map(u => (
                                                            <div key={u.id} className="flex items-center gap-1.5 px-2 py-1 bg-brand-navy text-white rounded-lg text-[10px] font-black">
                                                                {u.name}
                                                                <button type="button" onClick={() => toggleUserSelection(u.id)}>
                                                                    <X size={12} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                        {selectedUserIds.size > 0 && (
                                                            <button type="button" onClick={() => setSelectedUserIds(new Set())} className="text-[10px] font-black text-zinc-400 hover:text-red-500 underline ml-1">전체 해제</button>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800/60 rounded-2xl flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-brand-navy/10 flex items-center justify-center text-brand-navy">
                                                        <User size={16} />
                                                    </div>
                                                    <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{currentUser?.name} (본인)</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 flex gap-3 border-t border-zinc-100 dark:border-zinc-800">
                                    <button
                                        type="button"
                                        onClick={() => setIsAddModalOpen(false)}
                                        className="flex-1 px-6 py-4 rounded-2xl font-bold text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all"
                                    >
                                        취소
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={selectedUserIds.size === 0}
                                        className="flex-[2] bg-brand-navy text-white px-6 py-4 rounded-2xl font-black shadow-lg shadow-brand-navy/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
                                    >
                                        {selectedUserIds.size > 1 ? `${selectedUserIds.size}명에게 등록하기` : "등록하기"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
