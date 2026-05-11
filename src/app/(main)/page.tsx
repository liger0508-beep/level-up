"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Activity,
  BookOpen,
  Dumbbell,
  Flag,
  ClipboardList,
  Calendar,
  MessageSquare,
  PenTool,
  Trophy,
  Plus,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  TrendingUp,
  Target,
  Users
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getStoredEvents } from "@/lib/schedule-sync";
import { format, isSameDay, formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";

/* ──────── Master Shortcut Library ──────── */
const ALL_SHORTCUTS = [
  { id: "analysis", title: "분석", icon: Activity, color: "bg-orange-500", href: "/analysis" },
  { id: "lessons", title: "레슨", icon: BookOpen, color: "bg-blue-500", href: "/lessons" },
  { id: "training", title: "훈련", icon: Dumbbell, color: "bg-emerald-500", href: "/training" },
  { id: "tests", title: "테스트", icon: ClipboardList, color: "bg-rose-500", href: "/training/tests" },
  { id: "scores", title: "스코어", icon: Flag, color: "bg-sky-500", href: "/scores" },
  { id: "schedule", title: "스케쥴", icon: Calendar, color: "bg-cyan-600", href: "/schedule" },
  { id: "consultations", title: "상담", icon: MessageSquare, color: "bg-amber-500", href: "/consultations" },
  { id: "training-journal", title: "훈련일지", icon: PenTool, color: "bg-indigo-500", href: "/admin/training-journal" },
  { id: "community", title: "공지사항", icon: PenTool, color: "bg-blue-600", href: "/community" },
  { id: "tournament", title: "대회", icon: Trophy, color: "bg-emerald-600", href: "/admin/tournament-schedule" },
];

const typeConfigs: Record<string, { label: string; gradient: string }> = {
  lesson: { label: "LESSON", gradient: "from-blue-400 to-blue-600" },
  training: { label: "TRAINING", gradient: "from-emerald-400 to-emerald-600" },
  analysis: { label: "ANALYSIS", gradient: "from-orange-400 to-orange-600" },
  consultation: { label: "CONSULT", gradient: "from-pink-400 to-pink-600" },
  score: { label: "SCORE", gradient: "from-sky-400 to-sky-600" },
  etc: { label: "ETC", gradient: "from-zinc-400 to-zinc-600" },
};

function FeedCard({ item }: { item: any }) {
  const config = typeConfigs[item.type] || typeConfigs.etc;
  const timeAgo = formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ko });

  return (
    <Link
      href={`/${item.type === 'score' ? 'scores' : item.type === 'consultation' ? 'consultations' : item.type}s/${item.id}`}
      className="relative bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl overflow-hidden hover:shadow-md transition-all flex flex-col items-center justify-center h-28 sm:h-32 shrink-0 w-[80vw] max-w-[260px] p-4 text-center"
    >
      <div 
        className={cn(
          "absolute top-0 left-0 w-12 h-12 bg-gradient-to-br z-10",
          config.gradient
        )}
        style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}
      />
      <div className="flex flex-col items-center justify-center gap-1 w-full mt-2">
        <h4 className="text-[15px] font-black text-zinc-900 dark:text-zinc-100 leading-tight">
          {item.title?.split(' · ').pop() || "기록"}
        </h4>
        <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-tighter">
          {item.category || "일반"}
        </p>
      </div>
      <div className="absolute bottom-3 right-4">
        <p className="text-[10px] font-medium text-zinc-400">{timeAgo}</p>
      </div>
    </Link>
  );
}

interface UserProfile {
  id: string;
  name: string;
  role: string;
  assigned_athletes?: string;
}

interface SummaryStats {
  avgScore: number;
  completionRate: number;
}

export default function Home() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<SummaryStats>({ avgScore: 0, completionRate: 0 });
  const [todayTimeline, setTodayTimeline] = useState<any[]>([]);
  const [recentUpdates, setRecentUpdates] = useState<any[]>([]);

  useEffect(() => {
    async function initialize() {
      setIsLoading(true);
      const supabase = createClient();
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase.from("users").select("id, name, role, assigned_athletes").eq("id", user.id).single();
        if (!profile) return;
        
        setCurrentUser(profile);

        let targetAthleteIds: string[] = [];
        if (profile.role === "athlete") {
          targetAthleteIds = [user.id];
        } else if (profile.role === "admin") {
          // Super Admin: Fetch ALL athlete IDs
          const { data: allAthletes } = await supabase.from("users").select("id").eq("role", "athlete");
          if (allAthletes) targetAthleteIds = allAthletes.map(a => a.id);
        } else if (profile.role === "coach") {
          // Coach: Find assigned athletes
          if (profile.assigned_athletes) {
            const names = profile.assigned_athletes.split(',').map((s: string) => s.trim());
            const { data: athletes } = await supabase.from("users").select("id").in("name", names).eq("role", "athlete");
            if (athletes) targetAthleteIds = athletes.map(a => a.id);
          }
        }

        // 1. Calculate Average Score
        if (targetAthleteIds.length > 0) {
          const { data: scoreData } = await supabase
            .from("scorecards")
            .select("total_score")
            .in("athlete_id", targetAthleteIds)
            .order("round_date", { ascending: false })
            .limit(10);
          
          if (scoreData && scoreData.length > 0) {
            const avg = scoreData.reduce((s, x) => s + x.total_score, 0) / scoreData.length;
            setStats(prev => ({ ...prev, avgScore: Math.round(avg) }));
          }

          // 2. Calculate Training Completion Rate
          const { data: trainingTodos } = await supabase
            .from("todos")
            .select("is_completed")
            .in("user_id", targetAthleteIds)
            .eq("type", "training");
          
          if (trainingTodos && trainingTodos.length > 0) {
            const completed = trainingTodos.filter(t => t.is_completed).length;
            const rate = (completed / trainingTodos.length) * 100;
            setStats(prev => ({ ...prev, completionRate: Math.round(rate) }));
          }
        }

        const todayStr = format(new Date(), "yyyy-MM-dd");
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);

        // Fetch today's records for completion checks
        const { data: todayRecords } = await supabase
          .from("records")
          .select("id, type, title, category, created_at, related_id")
          .eq("user_id", user.id)
          .gte("created_at", startOfToday.toISOString())
          .lte("created_at", endOfToday.toISOString());

        // Fetch today's scores
        const { data: todayScores } = await supabase
          .from("scorecards")
          .select("id, round_date, total_score, course_name, created_at")
          .eq("athlete_id", user.id)
          .eq("round_date", todayStr);

        // Fetch active trainings (period-based)
        const { data: activeTrainings } = await supabase
          .from("records")
          .select("*")
          .eq("user_id", user.id)
          .eq("type", "training")
          .lte("training_start", todayStr)
          .gte("training_end", todayStr);

        // Fetch active polls
        const { data: activePolls } = await supabase
          .from("polls")
          .select("id, title, start_date, end_date")
          .lte("start_date", todayStr)
          .gte("end_date", todayStr);
        
        const { data: pollResponses } = await supabase
          .from("poll_responses")
          .select("poll_id")
          .eq("user_id", user.id);

        const schedules = await getStoredEvents();
        const todaySchedules = schedules.filter(e => isSameDay(new Date(e.start), new Date()));
        const { data: todos } = await supabase.from("todos").select("*").eq("user_id", user.id).eq("due_date", todayStr);
        
        const autoItems = [];
        if (profile.role === "athlete") {
          // 1. Mandatory Daily Journal
          autoItems.push({
            id: 'journal-auto',
            time: "20:00",
            title: "훈련일지 작성",
            type: 'journal',
            completed: todayRecords?.some(r => r.type === 'journal') || false
          });

          // 2. Active Trainings
          (activeTrainings || []).forEach(at => {
            autoItems.push({
              id: `training-auto-${at.id}`,
              time: "종일",
              title: at.title,
              type: 'training',
              completed: todayRecords?.some(r => r.type === 'training' && r.related_id === at.id) || false
            });
          });

          // 3. Active Polls
          (activePolls || []).forEach(p => {
            autoItems.push({
              id: `poll-auto-${p.id}`,
              time: "종일",
              title: `[투표] ${p.title}`,
              type: 'poll',
              completed: pollResponses?.some(pr => pr.poll_id === p.id) || false
            });
          });
        }

        const timeline = [
          ...autoItems,
          ...todaySchedules.map(s => {
            // Check if there's a matching record today
            const isCompletedByRecord = todayRecords?.some(r => 
                r.type === s.type && 
                (r.title === s.title || s.title?.includes(r.title || "") || r.title?.includes(s.title || ""))
            );
            return {
              id: s.id,
              time: format(new Date(s.start), "HH:mm"),
              title: s.title,
              type: 'schedule',
              completed: s.status === 'completed' || isCompletedByRecord
            };
          }),
          ...(todos || []).map(t => ({
            id: t.id,
            time: "종일",
            title: t.title,
            type: 'todo',
            completed: t.is_completed
          })),
          // Add records that are NOT journals and NOT matched to schedules or trainings
          ...(todayRecords || []).filter(r => {
            const isJournal = r.type === 'journal';
            const isUsedInTraining = r.type === 'training' && activeTrainings?.some(at => r.related_id === at.id);
            const matchesSchedule = todaySchedules.some(s => 
              r.type === s.type && 
              (r.title === s.title || s.title?.includes(r.title || "") || r.title?.includes(s.title || ""))
            );
            return !isJournal && !isUsedInTraining && !matchesSchedule;
          }).map(r => ({
            id: `record-${r.id}`,
            time: format(new Date(r.created_at), "HH:mm"),
            title: r.title || typeLabels[r.type] || "기록",
            type: r.type,
            completed: true
          })),
          // Add scorecards from today
          ...(todayScores || []).map(s => ({
            id: `score-${s.id}`,
            time: format(new Date(s.created_at), "HH:mm"),
            title: `${s.course_name} 스코어 입력`,
            type: 'score',
            completed: true
          }))
        ].sort((a, b) => a.time.localeCompare(b.time));
        setTodayTimeline(timeline);

        const { data: updates } = await supabase
          .from("records")
          .select(`id, type, title, created_at, category`)
          .in("type", ["lesson", "analysis", "training"])
          .order("created_at", { ascending: false })
          .limit(5);
        setRecentUpdates(updates || []);

      } catch (error) {
        console.error("Home initialization failed:", error);
      } finally {
        setIsLoading(false);
      }
    }
    initialize();
  }, []);

  const handleToggleItem = async (item: any) => {
    const supabase = createClient();
    const isCurrentlyCompleted = item.completed;
    
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
      } else {
        // Auto items (journal, training, poll) are driven by records.
        // For these, we might redirect or show a tooltip.
        return;
      }
      
      setTodayTimeline(prev => prev.map(i => i.id === item.id ? { ...i, completed: !isCurrentlyCompleted } : i));
    } catch (err) {
      console.error("Toggle failed:", err);
    }
  };

  const typeLabels: Record<string, string> = { lesson: "레슨", training: "훈련", analysis: "분석", consultation: "상담", todo: "할일", schedule: "일정", journal: "일지", poll: "투표", score: "스코어" };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-navy border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isCoach = currentUser?.role === "coach";
  const isAdmin = currentUser?.role === "admin";

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-12">
      {/* ─── Hero / Dashboard Section ─── */}
      <section className="bg-white dark:bg-zinc-900 border-2 border-zinc-100 dark:border-zinc-800 rounded-[2.5rem] p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-8 bg-brand-red rounded-full" />
              <h1 className="text-xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">반갑습니다, {currentUser?.name}님!</h1>
            </div>
            
            <div className="flex flex-wrap gap-3 mt-6">
              <Link href="/scores/create" className="bg-brand-navy text-white px-5 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2 hover:bg-brand-navy-dark transition-all shadow-lg shadow-brand-navy/10">
                <Plus size={18} strokeWidth={3} /> 스코어 입력
              </Link>
              <Link href="/schedule" className="bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 px-5 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all">
                <Calendar size={18} /> 일정 확인
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-50 dark:bg-zinc-800/50 p-5 rounded-3xl border border-zinc-100 dark:border-zinc-800 min-w-[140px]">
              <div className="flex items-center gap-2 mb-2 text-zinc-400">
                <TrendingUp size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">{isAdmin ? "전체 선수 평균" : isCoach ? "담당 선수 평균" : "평균 타수"}</span>
              </div>
              <p className="text-3xl font-black text-zinc-900 dark:text-zinc-100 italic">{stats.avgScore || "--"}</p>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-500 font-bold">
                <ArrowUpRight size={12} />
                <span>{isAdmin ? "플랫폼 전체" : "최근 10라운드"}</span>
              </div>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-800/50 p-5 rounded-3xl border border-zinc-100 dark:border-zinc-800 min-w-[140px]">
              <div className="flex items-center gap-2 mb-2 text-zinc-400">
                <Target size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">{isAdmin ? "전체 훈련 완료율" : isCoach ? "담당 선수 훈련" : "훈련 완료율"}</span>
              </div>
              <p className="text-3xl font-black text-zinc-900 dark:text-zinc-100 italic">{stats.completionRate}%</p>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-500 font-bold">
                <ArrowUpRight size={12} />
                <span>{isAdmin ? "전체 달성률" : "목표 달성 중"}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Shortcuts ─── */}
      <section className="bg-zinc-50 dark:bg-zinc-900/50 rounded-[2.5rem] p-6 border border-zinc-100 dark:border-zinc-800">
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-4">
          {ALL_SHORTCUTS.slice(0, 8).map(s => {
            const Icon = s.icon;
            return (
              <Link key={s.id} href={s.href} className="flex flex-col items-center gap-2 group">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-all", s.color)}>
                  <Icon size={20} />
                </div>
                <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400">{s.title}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-3 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight flex items-center gap-2 uppercase">
              To-Do list
            </h2>
            <Link href="/operations/todos" className="text-xs font-bold text-zinc-400 hover:text-brand-navy transition-colors">전체보기</Link>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 p-8 shadow-sm space-y-8 relative">
            {todayTimeline.length > 0 ? (
              todayTimeline.map((item, idx) => (
                <div key={item.id} className="relative flex items-start gap-6 group">
                  {idx !== todayTimeline.length - 1 && (
                    <div className="absolute left-[11px] top-8 bottom-[-32px] w-[2px] bg-zinc-100 dark:bg-zinc-800" />
                  )}
                  <button 
                    onClick={() => handleToggleItem(item)}
                    className={cn(
                      "relative z-10 w-6 h-6 rounded-full border-4 border-white dark:border-zinc-900 shadow-sm flex items-center justify-center transition-all",
                      item.completed 
                        ? "bg-zinc-300 dark:bg-zinc-600 scale-100" 
                        : cn(
                            "scale-110",
                            item.type === 'schedule' ? "bg-blue-500 shadow-blue-500/20" :
                            item.type === 'journal' ? "bg-indigo-500 shadow-indigo-500/20" :
                            item.type === 'training' ? "bg-emerald-500 shadow-emerald-500/20" :
                            item.type === 'poll' ? "bg-rose-500 shadow-rose-500/20" :
                            item.type === 'score' ? "bg-sky-500 shadow-sky-500/20" :
                            "bg-orange-500 shadow-orange-500/20"
                          ),
                      (item.type === 'todo' || item.type === 'schedule') ? "cursor-pointer" : "cursor-default"
                    )}
                    title={item.type === 'todo' || item.type === 'schedule' ? "완료 체크" : "자동 연동 항목"}
                  >
                    {item.completed && <CheckCircle2 size={12} className="text-white" />}
                    {!item.completed && <div className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse" />}
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">{item.time}</span>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[9px] font-black uppercase transition-colors",
                        item.completed ? "bg-zinc-100 text-zinc-400 dark:bg-zinc-800" :
                        item.type === 'schedule' ? "bg-blue-50 text-blue-600" : 
                        item.type === 'journal' ? "bg-indigo-50 text-indigo-600" :
                        item.type === 'training' ? "bg-emerald-50 text-emerald-600" :
                        item.type === 'poll' ? "bg-rose-50 text-rose-600" :
                        item.type === 'score' ? "bg-sky-50 text-sky-600" :
                        "bg-orange-50 text-orange-600"
                      )}>
                        {typeLabels[item.type]}
                      </span>
                    </div>
                    <h4 className={cn(
                      "text-lg font-bold transition-all",
                      item.completed ? "text-zinc-400 line-through" : "text-zinc-900 dark:text-zinc-100"
                    )}>
                      {item.title}
                    </h4>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-10 text-center flex flex-col items-center">
                <Clock className="text-zinc-100 dark:text-zinc-800 mb-4" size={48} />
                <p className="text-zinc-400 font-bold">오늘 예정된 일정이 없습니다.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <section className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-sm font-black text-zinc-400 uppercase tracking-widest">최근 업데이트</h2>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-hide px-2 -mx-2">
          {recentUpdates.length > 0 ? (
            recentUpdates.map(u => (
              <FeedCard key={u.id} item={u} />
            ))
          ) : (
            <p className="text-sm text-zinc-400 py-10 w-full text-center">최근 활동이 없습니다.</p>
          )}
        </div>
      </section>
    </div>
  );
}
