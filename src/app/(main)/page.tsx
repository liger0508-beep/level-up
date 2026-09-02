"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  User,
  Users,
  Settings,
  X,
  Bell,
  BarChart3,
  Lightbulb,
  Award,
  Video,
  FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getStoredEvents } from "@/lib/schedule-sync";
import { getPolls, Vote, VOTE_TYPE_COLORS, VOTE_TYPE_LABELS } from "@/lib/vote-sync";
import { getNotices, Notice, getPlainText } from "@/lib/notice-sync";
import { format, isSameDay, formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";

import { PageTitle, SectionTitle, LabelText } from "@/components/ui/Typography";

/* ──────── Master Shortcut Library ──────── */
const ALL_SHORTCUTS = [
  { id: "training", title: "훈련", icon: Dumbbell, color: "bg-emerald-50 border-transparent text-emerald-500 dark:bg-emerald-500/10 dark:border-transparent dark:text-emerald-400", href: "/training" },
  { id: "lessons", title: "레슨", icon: BookOpen, color: "bg-blue-50 border-transparent text-blue-500 dark:bg-blue-500/10 dark:border-transparent dark:text-blue-400", href: "/lessons" },
  { id: "challenges", title: "챌린지", icon: Trophy, color: "bg-rose-50 border-transparent text-rose-500 dark:bg-rose-500/10 dark:border-transparent dark:text-rose-400", href: "/training/challenges" },
  { id: "tournament-schedule", title: "대회 스케쥴", icon: Calendar, color: "bg-teal-50 border-transparent text-teal-500 dark:bg-teal-500/10 dark:border-transparent dark:text-teal-400", href: "/admin/tournament-schedule" },
  { id: "tournament-results", title: "대회 결과", icon: Award, color: "bg-amber-50 border-transparent text-amber-500 dark:bg-amber-500/10 dark:border-transparent dark:text-amber-400", href: "/admin/tournament-results" },
  { id: "schedule", title: "스케쥴", icon: Calendar, color: "bg-cyan-50 border-transparent text-cyan-500 dark:bg-cyan-500/10 dark:border-transparent dark:text-cyan-400", href: "/schedule" },
  { id: "scores", title: "스코어", icon: Flag, color: "bg-sky-50 border-transparent text-sky-500 dark:bg-sky-500/10 dark:border-transparent dark:text-sky-400", href: "/scores" },
  { id: "community", title: "공지사항", icon: Bell, color: "bg-indigo-50 border-transparent text-indigo-500 dark:bg-indigo-500/10 dark:border-transparent dark:text-indigo-400", href: "/community" },
  { id: "polls", title: "투표", icon: BarChart3, color: "bg-violet-50 border-transparent text-violet-500 dark:bg-violet-500/10 dark:border-transparent dark:text-violet-400", href: "/admin/polls" },
  { id: "consultations", title: "상담", icon: MessageSquare, color: "bg-amber-50 border-transparent text-amber-500 dark:bg-amber-500/10 dark:border-transparent dark:text-amber-400", href: "/consultations" },
  { id: "training-plan", title: "훈련계획", icon: Target, color: "bg-orange-50 border-transparent text-orange-500 dark:bg-orange-500/10 dark:border-transparent dark:text-orange-400", href: "/admin/training-plan" },
  { id: "training-journal", title: "훈련일지", icon: PenTool, color: "bg-fuchsia-50 border-transparent text-fuchsia-500 dark:bg-fuchsia-500/10 dark:border-transparent dark:text-fuchsia-400", href: "/admin/training-journal" },
  { id: "todos", title: "할일", icon: ClipboardList, color: "bg-zinc-50 border-transparent text-zinc-500 dark:bg-zinc-500/10 dark:border-transparent dark:text-zinc-400", href: "/operations/todos" },
];

const typeConfigs: Record<string, { label: string; gradient: string; icon: any; koLabel: string }> = {
  lesson: { label: "LESSON", gradient: "from-blue-400 to-blue-600", icon: BookOpen, koLabel: "레슨" },
  training: { label: "TRAINING", gradient: "from-emerald-400 to-emerald-600", icon: Dumbbell, koLabel: "훈련" },
  consultation: { label: "CONSULT", gradient: "from-pink-400 to-pink-600", icon: MessageSquare, koLabel: "상담" },
  score: { label: "SCORE", gradient: "from-sky-400 to-sky-600", icon: Flag, koLabel: "스코어" },
  etc: { label: "ETC", gradient: "from-zinc-400 to-zinc-600", icon: FileText, koLabel: "기타" },
};

const categoryLabels: Record<string, string> = {
  shot: "Shot",
  short_game: "Short Game",
  around_green: "Around Green",
  putting: "Putting",
  physical: "Physical",
  mental: "Mental",
  etc: "Etc",
  basic: "기본기",
  preview: "예습",
  review: "복습"
};

function FeedCard({ item }: { item: any }) {
  const config = typeConfigs[item.type] || typeConfigs.etc;
  const Icon = config.icon;
  const timeAgo = formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ko });
  const dateStr = format(new Date(item.created_at), "yy.MM.dd");
  const playerName = item.users?.name || "선수";
  const authorName = item.coach?.name || "관리자";

  const categoryDisplay = categoryLabels[item.category] || item.category;

  // Parse title for tags like [예습], [기본기], [복습]
  const tagMatch = item.title?.match(/^\[(.+?)\]/);
  const tag = tagMatch ? tagMatch[1] : null;
  const displayTitle = tag ? item.title.replace(`[${tag}]`, "").trim() : item.title;

  const finalTitle = categoryDisplay && displayTitle && displayTitle !== playerName
    ? `[${categoryDisplay}] ${displayTitle}`
    : (displayTitle || "기록");

  return (
    <Link
      href={`/${item.type === 'score' ? 'scores' : item.type === 'consultation' ? 'consultations' : item.type === 'training' ? 'training' : item.type + 's'}/${item.id}`}
      className="block bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 py-4 px-5 shadow-sm hover:border-brand-navy/30 hover:shadow-md transition-all group shrink-0 w-[70vw] sm:w-[260px] max-w-[280px] h-32 flex flex-col justify-between"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 shrink-0">
            <Icon size={16} />
          </div>
          <span className="text-sm font-bold text-zinc-600 dark:text-zinc-300">
            {config.koLabel}
            {item.type === 'lesson' && categoryDisplay && ` | ${categoryDisplay}`}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between mt-auto">
        <span className="text-[11px] font-bold text-zinc-400 shrink-0">
          {dateStr} <span className="opacity-40 font-normal mx-0.5">|</span> {authorName}
        </span>
        <span className="text-sm font-bold text-zinc-600 dark:text-zinc-300 truncate mr-2">
          {playerName}
        </span>
      </div>
    </Link>
  );
}

interface UserProfile {
  id: string;
  name: string;
  role: string;
  assigned_athletes?: string;
  branch?: string;
}

interface SummaryStats {
  avgScore: number;
  completionRate: number | string;
}

export default function Home() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedShortcutIds, setSelectedShortcutIds] = useState<string[]>(['lessons', 'training', 'challenges', 'schedule', 'scores', 'community', 'consultations']);
  const [isShortcutModalOpen, setIsShortcutModalOpen] = useState(false);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [isPollSheetOpen, setIsPollSheetOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('user_shortcuts');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const validIds = parsed.filter((id: string) => ALL_SHORTCUTS.some(s => s.id === id));
        if (validIds.length > 0) {
          setSelectedShortcutIds(validIds);
        }
      } catch (e) { }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded && selectedShortcutIds.length > 0) {
      localStorage.setItem('user_shortcuts', JSON.stringify(selectedShortcutIds));
    }
  }, [selectedShortcutIds, isLoaded]);
  const [stats, setStats] = useState<SummaryStats>({ avgScore: 0, completionRate: 0 });
  const [todayTimeline, setTodayTimeline] = useState<any[]>([]);
  const [recentUpdates, setRecentUpdates] = useState<any[]>([]);
  const [pendingPolls, setPendingPolls] = useState<Vote[]>([]);
  const [recentNotice, setRecentNotice] = useState<Notice | null>(null);
  const bannerScrollRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function initialize() {
      setIsLoading(true);
      const supabase = createClient();
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase.from("users").select("id, name, role, assigned_athletes, branch").eq("id", user.id).single();
        if (!profile) return;

        setCurrentUser(profile);

        let targetAthleteIds: string[] = []; // For training completion rate
        let scoreTargetAthleteIds: string[] = []; // For average score

        if (profile.role === "athlete") {
          targetAthleteIds = [user.id];
          scoreTargetAthleteIds = [user.id];
        } else if (profile.role === "admin") {
          // Super Admin: Fetch ALL athlete IDs
          const { data: allAthletes } = await supabase.from("users").select("id").eq("role", "athlete");
          if (allAthletes) {
            targetAthleteIds = allAthletes.map(a => a.id);
            scoreTargetAthleteIds = allAthletes.map(a => a.id);
          }
        } else if (profile.role === "coach") {
          // Coach: Find assigned athletes (for training)
          if (profile.assigned_athletes) {
            const names = profile.assigned_athletes.split(',').map((s: string) => s.trim());
            const { data: athletes } = await supabase.from("users").select("id").in("name", names).eq("role", "athlete");
            if (athletes) targetAthleteIds = athletes.map(a => a.id);
          }
          // Coach: Find branch athletes (for scores)
          if (profile.branch) {
            if (profile.branch === "총괄" || profile.branch === "오피스") {
              const { data: allBranchAthletes } = await supabase.from("users").select("id").eq("role", "athlete");
              if (allBranchAthletes) {
                scoreTargetAthleteIds = allBranchAthletes.map(a => a.id);
              }
            } else {
              const { data: branchAthletes } = await supabase.from("users").select("id").eq("branch", profile.branch).eq("role", "athlete");
              if (branchAthletes) {
                scoreTargetAthleteIds = branchAthletes.map(a => a.id);
              }
            }
          }
          if (scoreTargetAthleteIds.length === 0) {
            scoreTargetAthleteIds = [...targetAthleteIds];
          }
        }

        // 1. Calculate Average Score
        const todayStr = format(new Date(), "yyyy-MM-dd");
        const now = new Date();
        const startOfMonth = format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd");
        const endOfMonth = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), "yyyy-MM-dd");

        if (scoreTargetAthleteIds.length > 0) {
          const { data: scoreData } = await supabase
            .from("scorecards")
            .select("total_score")
            .in("athlete_id", scoreTargetAthleteIds)
            .eq("hole_count", 18)
            .gte("round_date", startOfMonth)
            .lte("round_date", endOfMonth);

          if (scoreData && scoreData.length > 0) {
            const avg = scoreData.reduce((s, x) => s + x.total_score, 0) / scoreData.length;
            setStats(prev => ({ ...prev, avgScore: avg }));
          }
        }

        if (targetAthleteIds.length > 0) {
          // 2. Calculate Today's Training Completion Rate (Average of today's active training progress)
          const { data: activeTrainings } = await supabase
            .from("records")
            .select("total_count, completion_logs, template_settings")
            .in("user_id", targetAthleteIds)
            .eq("type", "training")
            .lte("training_start", todayStr)
            .gte("training_end", todayStr);

          if (activeTrainings && activeTrainings.length > 0) {
            let totalProgress = 0;
            activeTrainings.forEach(train => {
              let parsedLogs: string[] = [];
              if (Array.isArray(train.completion_logs)) {
                parsedLogs = train.completion_logs;
              } else if (typeof train.completion_logs === 'string') {
                try {
                  const parsed = JSON.parse(train.completion_logs);
                  parsedLogs = Array.isArray(parsed) ? parsed : [];
                } catch {
                  parsedLogs = [train.completion_logs as string];
                }
              }

              let progressPercent = 0;
              let reviewSetting = null;

              if (Array.isArray(train.template_settings)) {
                reviewSetting = train.template_settings.find((s: any) => s.type === "review_scorecard");
              } else if (typeof train.template_settings === 'string') {
                try {
                  const parsedTs = JSON.parse(train.template_settings);
                  if (Array.isArray(parsedTs)) {
                    reviewSetting = parsedTs.find((s: any) => s.type === "review_scorecard");
                  }
                } catch (e) { }
              }

              if (reviewSetting) {
                const completedCount = reviewSetting.completedHoles?.length || 0;
                progressPercent = Math.min(100, Math.round((completedCount / (train.total_count || 1)) * 100));
              } else {
                progressPercent = Math.min(100, Math.round((parsedLogs.length / (train.total_count || 1)) * 100));
              }

              totalProgress += progressPercent;
            });
            const rate = totalProgress / activeTrainings.length;
            setStats(prev => ({ ...prev, completionRate: Math.round(rate) }));
          } else {
            setStats(prev => ({ ...prev, completionRate: "-" }));
          }
        }

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);

        // Fetch today's records for completion checks
        const { data: todayRecords } = await supabase
          .from("records")
          .select("id, type, title, category, created_at")
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
          .select("poll_id, vote_date")
          .eq("user_id", user.id);

        const allPolls = await getPolls(10);
        const ongoingUnvoted = allPolls.filter(p => {
          const isOngoing = p.status === "ongoing" && todayStr >= p.startDate && todayStr <= p.endDate;

          let hasNotVoted = true;
          if (p.isRecurring) {
            const now = new Date();
            const effectiveDate = new Date(now.getTime() - 6 * 60 * 60 * 1000);
            const yyyy = effectiveDate.getFullYear();
            const mm = String(effectiveDate.getMonth() + 1).padStart(2, '0');
            const dd = String(effectiveDate.getDate()).padStart(2, '0');
            const voteDateStr = `${yyyy}-${mm}-${dd}`;

            const votedToday = pollResponses?.some(pr => pr.poll_id === p.id && pr.vote_date === voteDateStr);
            hasNotVoted = !votedToday;
          } else {
            hasNotVoted = !pollResponses?.some(pr => pr.poll_id === p.id);
          }

          return isOngoing && hasNotVoted;
        });
        setPendingPolls(ongoingUnvoted);
        const allNotices = await getNotices(5);
        if (allNotices.length > 0) {
          setRecentNotice(allNotices.sort((a, b) => b.date.localeCompare(a.date))[0]);
        }


        const schedules = await getStoredEvents(todayStr, todayStr);
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
            const isCompletedInLogs = at.completion_logs?.some((log: string) => {
              try {
                const ts = log.startsWith('{') ? JSON.parse(log).timestamp : log;
                return format(new Date(ts), "yyyy-MM-dd") === todayStr;
              } catch { return false; }
            });

            autoItems.push({
              id: `training-auto-${at.id}`,
              time: "종일",
              title: at.title,
              type: 'training',
              completed: isCompletedInLogs || false
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
            const isUsedInTraining = false;
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
          .select(`id, type, title, created_at, category, users!records_user_id_fkey(name), coach:users!records_coach_id_fkey(name)`)
          .in("type", ["lesson", "training"])
          .order("inserted_at", { ascending: false })
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

  // Auto-show poll bottom sheet on mobile when pending polls exist
  useEffect(() => {
    if (!isLoading && pendingPolls.length > 0) {
      const hiddenDate = localStorage.getItem('poll_sheet_hidden_date');
      const now = new Date();
      const effectiveDate = new Date(now.getTime() - 6 * 60 * 60 * 1000);
      const todayStr = `${effectiveDate.getFullYear()}-${String(effectiveDate.getMonth() + 1).padStart(2, '0')}-${String(effectiveDate.getDate()).padStart(2, '0')}`;
      if (hiddenDate !== todayStr) {
        const timer = setTimeout(() => setIsPollSheetOpen(true), 600);
        return () => clearTimeout(timer);
      }
    }
  }, [isLoading, pendingPolls]);

  const handleToggleItem = async (item: any) => {
    const supabase = createClient();
    const isCurrentlyCompleted = item.completed;
    const todayStr = format(new Date(), "yyyy-MM-dd");

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
          .eq("id", item.id.replace('training-auto-', ''))
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
                return format(new Date(ts), "yyyy-MM-dd") !== todayStr;
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
        // For journal or poll, redirecting is better as they require user input
        if (item.type === 'journal') {
          router.push('/admin/training-journal/create');
        }
        return;
      }

      setTodayTimeline(prev => prev.map(i => i.id === item.id ? { ...i, completed: !isCurrentlyCompleted } : i));
    } catch (err) {
      console.error("Toggle failed:", err);
    }
  };

  const typeLabels: Record<string, string> = { lesson: "레슨", training: "훈련", consultation: "상담", todo: "할일", schedule: "일정", journal: "일지", poll: "투표", score: "스코어" };

  const isCoach = currentUser?.role === "coach";
  const isAdmin = currentUser?.role === "admin";
  const isLessonWriter = currentUser?.role === "coach" || currentUser?.role === "admin" || currentUser?.branch === "총괄" || currentUser?.branch === "오피스";

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* ─── Hero / Dashboard Section ─── */}
      <section className="bg-white dark:bg-zinc-900 border-2 border-zinc-100 dark:border-zinc-800 rounded-[2.5rem] p-5 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-8 bg-brand-red rounded-full" />
              <PageTitle>
                반갑습니다{currentUser?.name ? `, ${currentUser.name}님!` : '!'}
              </PageTitle>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <Link href="/scores/create" className="w-full justify-center bg-brand-navy text-white px-5 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2 hover:bg-brand-navy-dark transition-all shadow-lg shadow-brand-navy/10 whitespace-nowrap">
                <Plus size={18} strokeWidth={3} /> 스코어 입력
              </Link>
              {isLessonWriter ? (
                <Link href="/lessons/create" className="w-full justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 px-5 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all whitespace-nowrap">
                  <PenTool size={18} /> 레슨 작성
                </Link>
              ) : (
                <Link href="/admin/training-plan/create" className="w-full justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 px-5 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all whitespace-nowrap">
                  <Target size={18} /> 훈련 계획
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Shortcuts ─── */}
      <section className="bg-white dark:bg-zinc-900/50 rounded-[2.5rem] p-6 border border-zinc-100 dark:border-zinc-800">
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-4">
          {selectedShortcutIds.slice(0, 7).map(id => {
            const s = ALL_SHORTCUTS.find(x => x.id === id);
            if (!s) return null;
            const Icon = s.icon;
            return (
              <Link key={s.id} href={s.href} className="flex flex-col items-center gap-2 group">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all group-hover:scale-110", s.color)}>
                  <Icon size={20} />
                </div>
                <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400">{s.title}</span>
              </Link>
            );
          })}

          <button onClick={() => setIsShortcutModalOpen(true)} className="flex flex-col items-center gap-2 group">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-zinc-200 dark:bg-zinc-800 text-zinc-500 shadow-sm group-hover:scale-110 transition-all">
              <Settings size={20} />
            </div>
            <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400">관리</span>
          </button>
        </div>
      </section>

      {/* ─── Highlights Banner ─── */}
      {(pendingPolls.length > 0 || recentNotice) && (
        <section className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[2rem] p-6 shadow-sm overflow-hidden relative">
          <div
            ref={bannerScrollRef}
            className="flex overflow-x-auto snap-x snap-mandatory gap-8 pb-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            onScroll={(e) => {
              const scrollLeft = e.currentTarget.scrollLeft;
              const width = e.currentTarget.clientWidth;
              const index = Math.round(scrollLeft / width);
              setActiveBannerIndex(index);
            }}
          >
            {pendingPolls.length > 0 && (
              <Link href={`/admin/polls/${pendingPolls[0].id}`} className="w-full min-w-full snap-center shrink-0 flex justify-between items-center group">
                <div className="space-y-2 max-w-[75%] pr-4">
                  <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-50 tracking-tight line-clamp-1 group-hover:text-brand-navy transition-colors">
                    {getPlainText(pendingPolls[0].title)}
                  </h3>
                  <p className="text-[13px] font-bold text-zinc-500 leading-relaxed line-clamp-2">
                    {getPlainText(pendingPolls[0].description) || "새로운 투표가 진행 중입니다. 소중한 의견을 내주세요."}
                  </p>
                </div>
                <div className="w-14 h-14 flex items-center justify-center bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-2xl shrink-0 group-hover:scale-110 transition-transform">
                  <BarChart3 size={28} />
                </div>
              </Link>
            )}

            {recentNotice && (
              <Link href={`/community/${recentNotice.id}`} className="w-full min-w-full snap-center shrink-0 flex justify-between items-center group">
                <div className="space-y-2 max-w-[75%] pr-4">
                  <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-50 tracking-tight line-clamp-1 group-hover:text-emerald-600 transition-colors">
                    {getPlainText(recentNotice.title)}
                  </h3>
                </div>
                <div className="w-14 h-14 flex items-center justify-center bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 rounded-2xl shrink-0 group-hover:scale-110 transition-transform">
                  <Bell size={28} />
                </div>
              </Link>
            )}
          </div>

          {/* Dots Indicator */}
          {(pendingPolls.length > 0 && recentNotice) && (
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 cursor-pointer">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  bannerScrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
                  setActiveBannerIndex(0);
                }}
                className={cn("w-1.5 h-1.5 rounded-full transition-colors", activeBannerIndex === 0 ? "bg-zinc-400 dark:bg-zinc-500" : "bg-zinc-200 dark:bg-zinc-800")}
              />
              <button
                onClick={(e) => {
                  e.preventDefault();
                  if (bannerScrollRef.current) {
                    bannerScrollRef.current.scrollTo({ left: bannerScrollRef.current.clientWidth, behavior: 'smooth' });
                    setActiveBannerIndex(1);
                  }
                }}
                className={cn("w-1.5 h-1.5 rounded-full transition-colors", activeBannerIndex === 1 ? "bg-zinc-400 dark:bg-zinc-500" : "bg-zinc-200 dark:bg-zinc-800")}
              />
            </div>
          )}
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-3 space-y-4">
          <Link href="/operations/todos" className="block bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 py-4 px-6 shadow-sm hover:border-brand-navy/30 hover:shadow-md transition-all group">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 shrink-0">
                <ClipboardList size={16} />
              </div>
              <span className="text-sm font-bold text-zinc-600 dark:text-zinc-300">할일</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 pl-[40px]">오늘 완료해야할 일</span>
              <span className="text-[20px] sm:text-[26px] font-black text-zinc-900 dark:text-zinc-50 group-hover:text-brand-navy transition-colors">
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-brand-navy border-t-transparent rounded-full animate-spin inline-block ml-2" />
                ) : (
                  `${todayTimeline.filter(t => !t.completed).length}건`
                )}
              </span>
            </div>
          </Link>

          <Link href="/training" className="block bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 py-4 px-6 shadow-sm hover:border-brand-navy/30 hover:shadow-md transition-all group">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 shrink-0">
                <Dumbbell size={16} />
              </div>
              <span className="text-sm font-bold text-zinc-600 dark:text-zinc-300">훈련</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 pl-[40px]">오늘까지의 훈련 완료율</span>
              <span className="text-[20px] sm:text-[26px] font-black text-zinc-900 dark:text-zinc-50 group-hover:text-brand-navy transition-colors">
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-brand-navy border-t-transparent rounded-full animate-spin inline-block ml-2" />
                ) : (
                  stats.completionRate === "-" ? "-" : `${stats.completionRate}%`
                )}
              </span>
            </div>
          </Link>

          <Link href="/scores" className="block bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 py-4 px-6 shadow-sm hover:border-brand-navy/30 hover:shadow-md transition-all group">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 shrink-0">
                <Flag size={16} />
              </div>
              <span className="text-sm font-bold text-zinc-600 dark:text-zinc-300">스코어</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 pl-[40px]">{new Date().getMonth() + 1}월 평균 스코어</span>
              <span className="text-[20px] sm:text-[26px] font-black text-zinc-900 dark:text-zinc-50 group-hover:text-brand-navy transition-colors">
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-brand-navy border-t-transparent rounded-full animate-spin inline-block ml-2" />
                ) : (
                  `${stats.avgScore ? stats.avgScore.toFixed(1) : "--"}타`
                )}
              </span>
            </div>
          </Link>
        </div>
      </div>

      <section className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <SectionTitle>최근 업데이트</SectionTitle>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-hide px-2 -mx-2">
          {isLoading ? (
            <div className="w-full py-10 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-brand-navy border-t-transparent rounded-full animate-spin" />
            </div>
          ) : recentUpdates.length > 0 ? (
            recentUpdates.map(u => (
              <FeedCard key={u.id} item={u} />
            ))
          ) : (
            <p className="text-sm text-zinc-400 py-10 w-full text-center">최근 활동이 없습니다.</p>
          )}
        </div>
      </section>
      {/* ─── Shortcut Management Modal ─── */}
      {isShortcutModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-[2rem] w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black">메뉴 관리 (최대 7개)</h3>
              <button onClick={() => setIsShortcutModalOpen(false)} className="text-zinc-400 hover:text-zinc-900 transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-6">
              {ALL_SHORTCUTS.map(s => {
                const Icon = s.icon;
                const isSelected = selectedShortcutIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedShortcutIds(prev => prev.filter(id => id !== s.id));
                      } else {
                        if (selectedShortcutIds.length >= 7) {
                          alert("최대 7개까지만 선택할 수 있습니다.");
                          return;
                        }
                        setSelectedShortcutIds(prev => [...prev, s.id]);
                      }
                    }}
                    className={cn(
                      "flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all bg-transparent",
                      isSelected ? "border-transparent" : "border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    )}
                  >
                    <div className="relative">
                      {isSelected && (
                        <div className="absolute -top-2 -left-2 w-5 h-5 bg-zinc-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-sm z-10">
                          {selectedShortcutIds.indexOf(s.id) + 1}
                        </div>
                      )}
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-opacity", s.color, isSelected ? "opacity-100" : "opacity-50")}>
                        <Icon size={16} />
                      </div>
                    </div>
                    <span className="text-[10px] font-bold">{s.title}</span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setIsShortcutModalOpen(false)}
              className="w-full py-4 bg-brand-navy text-white font-black rounded-xl hover:bg-brand-navy-light transition-colors"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* ─── Poll Bottom Sheet (Mobile) ─── */}
      {isPollSheetOpen && pendingPolls.length > 0 && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 z-50 sm:hidden animate-fade-in"
            onClick={() => setIsPollSheetOpen(false)}
          />
          {/* Sheet */}
          <div className="fixed bottom-0 left-0 right-0 z-50 sm:hidden animate-slide-up">
            <div className="bg-white dark:bg-zinc-900 rounded-t-[2rem] shadow-2xl border-t border-zinc-200 dark:border-zinc-700 px-6 pt-4 pb-8" style={{ minHeight: '33vh' }}>
              {/* Handle bar */}
              <div className="flex justify-center mb-4">
                <div className="w-10 h-1 bg-zinc-300 dark:bg-zinc-600 rounded-full" />
              </div>

              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-500">
                  <BarChart3 size={16} />
                </div>
                <span className="text-xs font-bold text-violet-500 uppercase tracking-wider">참여하지 않은 투표 ({pendingPolls.length}건)</span>
              </div>

              <div className="space-y-3 max-h-[25vh] overflow-y-auto">
                {pendingPolls.slice(0, 2).map((poll, index) => (
                  <Link
                    key={poll.id}
                    href={`/admin/polls/${poll.id}`}
                    onClick={() => setIsPollSheetOpen(false)}
                    className={cn(
                      "block rounded-2xl p-4 active:scale-[0.98] transition-all border",
                      index === 0
                        ? "bg-violet-50/50 dark:bg-violet-900/10 border-violet-100/50 dark:border-violet-800/20"
                        : "bg-blue-50/50 dark:bg-blue-900/10 border-blue-100/50 dark:border-blue-800/20"
                    )}
                  >
                    <h4 className="text-sm font-black text-zinc-900 dark:text-zinc-50 line-clamp-1 mb-1">
                      {getPlainText(poll.title)}
                    </h4>
                    <p className="text-xs text-zinc-500 line-clamp-2 mb-2">
                      {getPlainText(poll.description) || "투표에 참여해주세요."}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-zinc-400">
                        ~ {poll.endDate}
                      </span>
                      <span className="text-xs font-bold text-brand-navy dark:text-blue-400 flex items-center gap-1">
                        투표하기 <ArrowUpRight size={12} />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>

              <div className="flex items-center justify-between mt-4">
                <button
                  onClick={() => {
                    setIsPollSheetOpen(false);
                    const now = new Date();
                    const effectiveDate = new Date(now.getTime() - 6 * 60 * 60 * 1000);
                    const dateStr = `${effectiveDate.getFullYear()}-${String(effectiveDate.getMonth() + 1).padStart(2, '0')}-${String(effectiveDate.getDate()).padStart(2, '0')}`;
                    localStorage.setItem('poll_sheet_hidden_date', dateStr);
                  }}
                  className="py-3 px-4 text-sm font-bold text-zinc-500 hover:text-zinc-700 transition-colors"
                >
                  오늘은 그만보기
                </button>
                <button
                  onClick={() => setIsPollSheetOpen(false)}
                  className="py-3 px-4 text-sm font-bold text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}