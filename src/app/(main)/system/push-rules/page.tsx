"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  BellOff,
  CheckCircle2,
  CheckSquare,
  Clock,
  Edit2,
  Plus,
  Search,
  Square,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PushRule {
  id: string;
  name: string;
  event_type: string;
  trigger_mode?: "immediate" | "before_time";
  minutes_before?: number;
  only_non_respondents?: boolean;
  include_parents?: boolean;
  target_type: "all" | "roles" | "related_user" | "specific_users";
  target_roles: string[];
  target_user_ids: string[];
  title_template: string;
  body_template: string;
  is_active: boolean;
  created_at: string;
}

interface UserItem {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  branch: string | null;
}

const IMMEDIATE_EVENT_OPTIONS = [
  { value: "community_created", label: "공지사항 등록 시" },
  { value: "lesson_created", label: "레슨 일지 등록 시" },
  { value: "analysis_created", label: "분석 기록 등록 시" },
  { value: "training_plan_created", label: "훈련 계획 등록 시" },
  { value: "consultation_created", label: "상담 일지 등록 시" },
  { value: "poll_created", label: "투표(설문) 등록 시" },
  { value: "schedule_created", label: "스케줄 등록/변경 시" },
  { value: "score_created", label: "스코어 등록 시" },
];

const BEFORE_TIME_EVENT_OPTIONS = [
  { value: "analysis_before", label: "분석 시작 전 (리마인드)" },
  { value: "lesson_before", label: "레슨 시작 전 (리마인드)" },
  { value: "consultation_before", label: "상담 시작 전 (리마인드)" },
  { value: "schedule_before", label: "전체 일정 시작 전 (리마인드)" },
  { value: "poll_deadline_before", label: "설문조사 마감 전 (리마인드)" },
];

const ALL_EVENT_OPTIONS = [...IMMEDIATE_EVENT_OPTIONS, ...BEFORE_TIME_EVENT_OPTIONS];

const TIME_PRESETS = [
  { minutes: 10, label: "10분 전" },
  { minutes: 30, label: "30분 전" },
  { minutes: 60, label: "1시간 전" },
  { minutes: 120, label: "2시간 전" },
  { minutes: 1440, label: "하루 전" },
];

const AUDIENCE_TABS = [
  { key: "all", label: "전체" },
  { key: "coach", label: "코치" },
  { key: "athlete", label: "선수" },
  { key: "parent", label: "학부모" },
] as const;

const TARGET_TYPE_OPTIONS = [
  { value: "all", label: "전체 사용자", desc: "앱을 사용하는 모든 회원에게 발송" },
  { value: "roles", label: "역할별 선택", desc: "코치, 선수, 학부모 등 선택한 역할에게 발송" },
  { value: "related_user", label: "해당 대상자", desc: "일정·레슨·분석의 당사자(선수/코치)에게 발송" },
  { value: "specific_users", label: "특정 사용자 지정", desc: "원하는 사용자를 직접 선택해 발송" },
] as const;

const ROLE_OPTIONS = [
  { value: "athlete", label: "선수" },
  { value: "parent", label: "학부모" },
  { value: "coach", label: "코치" },
  { value: "headquarter", label: "총괄" },
  { value: "office", label: "오피스" },
  { value: "admin", label: "관리자" },
];

const EVENT_LABELS: Record<string, string> = Object.fromEntries(
  ALL_EVENT_OPTIONS.map((e) => [e.value, e.label])
);

const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  ROLE_OPTIONS.map((r) => [r.value, r.label])
);

const DEFAULT_TEMPLATES: Record<string, { title: string; body: string }> = {
  community_created: {
    title: "[공지] 새로운 공지사항이 등록되었습니다.",
    body: "앱에서 공지사항을 확인해 주세요.",
  },
  lesson_created: {
    title: "[레슨] 새로운 레슨 일지가 등록되었습니다.",
    body: "{{athleteName}} 선수의 레슨 일지를 확인해 보세요.",
  },
  analysis_created: {
    title: "[분석] 새로운 분석 기록이 등록되었습니다.",
    body: "{{athleteName}} 선수의 스윙 분석이 등록되었습니다.",
  },
  training_plan_created: {
    title: "[훈련계획] 새로운 훈련 계획이 등록되었습니다.",
    body: "{{athleteName}} 선수의 훈련 계획을 확인해 보세요.",
  },
  consultation_created: {
    title: "[상담] 새로운 상담 일지가 등록되었습니다.",
    body: "{{athleteName}} 선수의 상담 내용을 확인해 주세요.",
  },
  poll_created: {
    title: "[투표] 새로운 설문조사가 등록되었습니다.",
    body: "{{title}}",
  },
  schedule_created: {
    title: "[스케줄] 새로운 일정이 등록되었습니다.",
    body: "{{title}}",
  },
  score_created: {
    title: "[스코어] 새로운 라운드 스코어가 등록되었습니다.",
    body: "{{athleteName}} 선수의 스코어를 확인해 보세요.",
  },
  analysis_before: {
    title: "[분석 알림] 잠시 후 분석 일정이 시작됩니다.",
    body: "{{title}} 일정을 확인해 주세요.",
  },
  lesson_before: {
    title: "[레슨 알림] 잠시 후 레슨 일정이 시작됩니다.",
    body: "{{title}} 일정을 확인해 주세요.",
  },
  consultation_before: {
    title: "[상담 알림] 잠시 후 상담 일정이 시작됩니다.",
    body: "{{title}} 일정을 확인해 주세요.",
  },
  schedule_before: {
    title: "[일정 알림] 잠시 후 예정된 일정이 시작됩니다.",
    body: "{{title}} 일정을 확인해 주세요.",
  },
  poll_deadline_before: {
    title: "[투표 마감 임박] 설문조사에 참여해 주세요.",
    body: "{{title}} 투표가 곧 마감됩니다.",
  },
};

function formatMinutesLabel(minutes?: number) {
  const m = minutes || 30;
  if (m >= 1440 && m % 1440 === 0) return `${m / 1440}일 전`;
  if (m >= 60 && m % 60 === 0) return `${m / 60}시간 전`;
  return `${m}분 전`;
}

export default function PushRulesPage() {
  const [rules, setRules] = useState<PushRule[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [audienceFilter, setAudienceFilter] = useState<(typeof AUDIENCE_TABS)[number]["key"]>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<PushRule | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [triggerMode, setTriggerMode] = useState<"immediate" | "before_time">("immediate");
  const [eventType, setEventType] = useState("community_created");
  const [minutesBefore, setMinutesBefore] = useState<number>(30);
  const [onlyNonRespondents, setOnlyNonRespondents] = useState(false);
  const [includeParents, setIncludeParents] = useState(false);
  const [targetType, setTargetType] = useState<PushRule["target_type"]>("all");
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [targetUserIds, setTargetUserIds] = useState<string[]>([]);
  const [titleTemplate, setTitleTemplate] = useState(DEFAULT_TEMPLATES.community_created.title);
  const [bodyTemplate, setBodyTemplate] = useState(DEFAULT_TEMPLATES.community_created.body);
  const [isActive, setIsActive] = useState(true);
  const [userSearch, setUserSearch] = useState("");

  const fetchRules = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/system/push-rules");
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "불러오기에 실패했습니다.");
      } else {
        setRules(data.rules || []);
        setUsers(data.users || []);
        setTableMissing(Boolean(data.tableMissing));
      }
    } catch {
      setErrorMsg("서버와 통신하는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const userRoleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users) {
      if (u.role) map.set(u.id, u.role);
    }
    return map;
  }, [users]);

  const openCreateModal = () => {
    setEditingRule(null);
    setName("");
    setTriggerMode("immediate");
    setEventType("community_created");
    setMinutesBefore(30);
    setOnlyNonRespondents(false);
    setIncludeParents(false);
    setTargetType("all");
    setTargetRoles([]);
    setTargetUserIds([]);
    setTitleTemplate(DEFAULT_TEMPLATES.community_created.title);
    setBodyTemplate(DEFAULT_TEMPLATES.community_created.body);
    setIsActive(true);
    setUserSearch("");
    setIsModalOpen(true);
  };

  const openEditModal = (rule: PushRule) => {
    const isBefore =
      rule.trigger_mode === "before_time" ||
      BEFORE_TIME_EVENT_OPTIONS.some((o) => o.value === rule.event_type);
    setEditingRule(rule);
    setName(rule.name);
    setTriggerMode(isBefore ? "before_time" : "immediate");
    setEventType(rule.event_type);
    setMinutesBefore(rule.minutes_before || 30);
    setOnlyNonRespondents(Boolean(rule.only_non_respondents));
    setIncludeParents(Boolean(rule.include_parents));
    setTargetType(rule.target_type);
    setTargetRoles(rule.target_roles || []);
    setTargetUserIds(rule.target_user_ids || []);
    setTitleTemplate(rule.title_template);
    setBodyTemplate(rule.body_template);
    setIsActive(rule.is_active);
    setUserSearch("");
    setIsModalOpen(true);
  };

  const handleModeChange = (mode: "immediate" | "before_time") => {
    setTriggerMode(mode);
    const defaultEv = mode === "immediate" ? "community_created" : "analysis_before";
    setEventType(defaultEv);
    if (!editingRule && DEFAULT_TEMPLATES[defaultEv]) {
      setTitleTemplate(DEFAULT_TEMPLATES[defaultEv].title);
      setBodyTemplate(DEFAULT_TEMPLATES[defaultEv].body);
    }
  };

  const handleEventChange = (nextEvent: string) => {
    setEventType(nextEvent);
    if (!editingRule && DEFAULT_TEMPLATES[nextEvent]) {
      setTitleTemplate(DEFAULT_TEMPLATES[nextEvent].title);
      setBodyTemplate(DEFAULT_TEMPLATES[nextEvent].body);
    }
  };

  const toggleRole = (roleValue: string) => {
    setTargetRoles((prev) =>
      prev.includes(roleValue) ? prev.filter((r) => r !== roleValue) : [...prev, roleValue]
    );
  };

  const toggleUser = (userId: string) => {
    setTargetUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert("규칙 이름을 입력해 주세요.");
      return;
    }
    if (triggerMode === "before_time" && (!minutesBefore || minutesBefore < 1)) {
      alert("몇 분 전에 보낼지 1 이상의 숫자를 입력해 주세요.");
      return;
    }
    if (targetType === "roles" && targetRoles.length === 0) {
      alert("발송할 역할을 1개 이상 선택해 주세요.");
      return;
    }
    if (targetType === "specific_users" && targetUserIds.length === 0) {
      alert("발송할 사용자를 1명 이상 선택해 주세요.");
      return;
    }
    if (!titleTemplate.trim() || !bodyTemplate.trim()) {
      alert("알림 제목과 내용을 입력해 주세요.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...(editingRule ? { id: editingRule.id } : {}),
        name: name.trim(),
        event_type: eventType,
        trigger_mode: triggerMode,
        minutes_before: triggerMode === "before_time" ? Math.max(1, Number(minutesBefore) || 30) : 30,
        only_non_respondents: eventType === "poll_deadline_before" ? onlyNonRespondents : false,
        include_parents: targetType === "related_user" ? includeParents : false,
        target_type: targetType,
        target_roles: targetType === "roles" ? targetRoles : [],
        target_user_ids: targetType === "specific_users" ? targetUserIds : [],
        title_template: titleTemplate.trim(),
        body_template: bodyTemplate.trim(),
        is_active: isActive,
      };

      const res = await fetch("/api/system/push-rules", {
        method: editingRule ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "저장에 실패했습니다.");
        return;
      }

      setIsModalOpen(false);
      await fetchRules();
    } catch {
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (rule: PushRule) => {
    const nextActive = !rule.is_active;
    setRules((prev) =>
      prev.map((r) => (r.id === rule.id ? { ...r, is_active: nextActive } : r))
    );
    try {
      const res = await fetch("/api/system/push-rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rule.id, is_active: nextActive }),
      });
      if (!res.ok) {
        setRules((prev) =>
          prev.map((r) => (r.id === rule.id ? { ...r, is_active: rule.is_active } : r))
        );
        alert("상태 변경에 실패했습니다.");
      }
    } catch {
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, is_active: rule.is_active } : r))
      );
    }
  };

  const handleDelete = async (rule: PushRule) => {
    if (!confirm(`"${rule.name}" 알림 조건을 삭제하시겠습니까?`)) return;
    try {
      const res = await fetch(`/api/system/push-rules?id=${encodeURIComponent(rule.id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "삭제에 실패했습니다.");
        return;
      }
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
    } catch {
      alert("삭제 중 오류가 발생했습니다.");
    }
  };

  const audienceFiltered = useMemo(() => {
    if (audienceFilter === "all") return rules;
    return rules.filter((r) => {
      if (r.target_type === "all") return true;
      if (r.target_type === "roles") {
        return (r.target_roles || []).includes(audienceFilter);
      }
      if (r.target_type === "related_user") {
        if (audienceFilter === "athlete" || audienceFilter === "coach") return true;
        if (audienceFilter === "parent") return Boolean(r.include_parents);
        return false;
      }
      if (r.target_type === "specific_users") {
        return (r.target_user_ids || []).some((uid) => userRoleMap.get(uid) === audienceFilter);
      }
      return false;
    });
  }, [rules, audienceFilter, userRoleMap]);

  const stats = useMemo(
    () => ({
      total: audienceFiltered.length,
      active: audienceFiltered.filter((r) => r.is_active).length,
      inactive: audienceFiltered.filter((r) => !r.is_active).length,
    }),
    [audienceFiltered]
  );

  const filteredRules = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return audienceFiltered.filter((r) => {
      if (statusFilter === "active" && !r.is_active) return false;
      if (statusFilter === "inactive" && r.is_active) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.title_template.toLowerCase().includes(q) ||
        r.body_template.toLowerCase().includes(q)
      );
    });
  }, [audienceFiltered, statusFilter, searchQuery]);

  const filteredUsers = useMemo(() => {
    const keyword = userSearch.trim().toLowerCase();
    if (!keyword) return users;
    return users.filter(
      (u) =>
        (u.name || "").toLowerCase().includes(keyword) ||
        (u.email || "").toLowerCase().includes(keyword) ||
        (ROLE_LABELS[u.role || ""] || u.role || "").toLowerCase().includes(keyword)
    );
  }, [users, userSearch]);

  const renderConditionLabel = (rule: PushRule) => {
    const base = EVENT_LABELS[rule.event_type] || rule.event_type;
    const isBefore =
      rule.trigger_mode === "before_time" ||
      BEFORE_TIME_EVENT_OPTIONS.some((o) => o.value === rule.event_type);
    if (isBefore) {
      return `${base.replace(" (리마인드)", "")} · ${formatMinutesLabel(rule.minutes_before)}`;
    }
    return base;
  };

  const renderTargetLabel = (rule: PushRule) => {
    if (rule.target_type === "all") return "전체 사용자";
    if (rule.target_type === "related_user") {
      return rule.include_parents ? "해당 대상자 + 학부모" : "해당 대상자";
    }
    if (rule.target_type === "roles") {
      const labels = (rule.target_roles || []).map((r) => ROLE_LABELS[r] || r);
      return `역할: ${labels.join(", ")}`;
    }
    if (rule.target_type === "specific_users") {
      return `특정 사용자 (${rule.target_user_ids?.length || 0}명)`;
    }
    return rule.target_type;
  };

  const currentEventOptions =
    triggerMode === "immediate" ? IMMEDIATE_EVENT_OPTIONS : BEFORE_TIME_EVENT_OPTIONS;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-24">
      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-10 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Bell size={24} className="text-brand-navy dark:text-brand-navy-light shrink-0" />
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
              앱푸쉬 관리
            </h1>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            disabled={tableMissing}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-navy hover:bg-brand-navy/90 text-white text-sm font-semibold px-4 py-2.5 shadow-sm transition-colors disabled:opacity-50"
          >
            <Plus size={16} />
            새 조건 추가
          </button>
        </div>

        {/* Table Missing Alert */}
        {tableMissing && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 p-4 flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed space-y-1">
              <p className="font-semibold">DB 테이블(push_notification_rules)이 아직 생성되지 않았습니다.</p>
              <p>
                프로젝트 루트의 <code className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/60">setup_push_rules.sql</code> 파일 내용을 Supabase SQL Editor에서 실행한 뒤 새로고침해 주세요.
              </p>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 px-4 py-3 text-xs text-red-700 dark:text-red-300">
            {errorMsg}
          </div>
        )}

        {/* Audience Filter Pills: 전체, 코치, 선수, 학부모 */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
          {AUDIENCE_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setAudienceFilter(tab.key)}
              className={`whitespace-nowrap shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                audienceFilter === tab.key
                  ? "bg-brand-navy text-white shadow-md border-brand-navy"
                  : "bg-white text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-brand-navy-light dark:hover:bg-brand-navy-dark hover:text-brand-navy dark:hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Stats Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          {([
            {
              key: "all" as const,
              count: stats.total,
              label: "전체 조건",
              color: "text-brand-navy dark:text-zinc-100",
              bg: "bg-brand-navy/5 border-brand-navy/30 dark:border-brand-navy-light/30",
            },
            {
              key: "active" as const,
              count: stats.active,
              label: "활성화",
              color: "text-emerald-600 dark:text-emerald-400",
              bg: "bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20",
            },
            {
              key: "inactive" as const,
              count: stats.inactive,
              label: "비활성화",
              color: "text-zinc-500 dark:text-zinc-400",
              bg: "bg-zinc-500/5 border-zinc-300 dark:border-zinc-700",
            },
          ]).map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setStatusFilter((prev) => (prev === s.key ? "all" : s.key))}
              className={cn(
                "rounded-2xl border p-4 text-center transition-all",
                statusFilter === s.key
                  ? `${s.bg} ring-2 ring-offset-1 ring-brand-navy/30`
                  : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
              )}
            >
              <p className={cn("text-2xl font-black", s.color)}>{s.count}</p>
              <p className="text-xs font-medium text-zinc-500 mt-1">{s.label}</p>
            </button>
          ))}
        </div>

        {/* Search + Status Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input
              type="text"
              placeholder="규칙 이름 또는 알림 내용으로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {([
              { key: "all" as const, label: "전체" },
              { key: "active" as const, label: "활성화" },
              { key: "inactive" as const, label: "비활성화" },
            ]).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setStatusFilter(opt.key)}
                className={cn(
                  "whitespace-nowrap shrink-0 px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors",
                  statusFilter === opt.key
                    ? "bg-brand-navy text-white border-brand-navy"
                    : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-brand-navy/50"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Result count */}
        <p className="text-xs text-zinc-400 px-1">
          {audienceFilter !== "all" && (
            <span className="font-semibold text-brand-navy mr-1">
              {AUDIENCE_TABS.find((t) => t.key === audienceFilter)?.label}
            </span>
          )}
          검색 결과 <span className="font-semibold text-zinc-600 dark:text-zinc-300">{filteredRules.length}</span>개
        </p>

        {/* Rules Card List */}
        <div className="space-y-2">
          {loading ? (
            <div className="text-center py-16 text-sm text-zinc-400">불러오는 중...</div>
          ) : filteredRules.length > 0 ? (
            filteredRules.map((rule) => {
              const isBefore =
                rule.trigger_mode === "before_time" ||
                BEFORE_TIME_EVENT_OPTIONS.some((o) => o.value === rule.event_type);
              return (
                <div
                  key={rule.id}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all"
                >
                  <div className="flex items-center gap-4">
                    {/* Icon Badge */}
                    <div
                      className={cn(
                        "shrink-0 w-12 h-12 rounded-full flex items-center justify-center border-2",
                        rule.is_active
                          ? "bg-brand-navy/10 border-brand-navy/20 text-brand-navy dark:bg-brand-navy/25 dark:border-brand-navy/40 dark:text-zinc-100"
                          : "bg-zinc-100 border-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:border-zinc-700"
                      )}
                    >
                      {!rule.is_active ? (
                        <BellOff size={20} />
                      ) : isBefore ? (
                        <Clock size={20} />
                      ) : (
                        <Bell size={20} />
                      )}
                    </div>

                    {/* Main Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                          {rule.name}
                        </h3>
                        <span
                          className={cn(
                            "text-[11px] font-semibold px-2 py-0.5 rounded-full",
                            isBefore
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                              : "bg-brand-navy/10 text-brand-navy dark:bg-brand-navy/25 dark:text-zinc-200"
                          )}
                        >
                          {renderConditionLabel(rule)}
                        </span>
                        {rule.only_non_respondents && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-300">
                            미응답자만
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 truncate mb-1">
                        {rule.title_template} · {rule.body_template}
                      </p>
                      <div className="flex items-center gap-1 text-[11px] sm:text-xs text-zinc-400">
                        <Users size={12} className="shrink-0" />
                        <span className="truncate">{renderTargetLabel(rule)}</span>
                      </div>
                    </div>

                    {/* Right Actions */}
                    <div className="shrink-0 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(rule)}
                        className={cn(
                          "inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-full border transition-all hover:brightness-95 active:scale-95",
                          rule.is_active
                            ? "bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                            : "bg-zinc-100 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400"
                        )}
                      >
                        {rule.is_active ? (
                          <>
                            <CheckCircle2 size={12} />
                            활성
                          </>
                        ) : (
                          "비활성"
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditModal(rule)}
                        className="p-2 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        title="수정"
                      >
                        <Edit2 size={16} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(rule)}
                        className="p-2 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950/30 transition-colors"
                        title="삭제"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-16 text-zinc-400">
              <Bell size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">등록된 푸시 알림 조건이 없습니다.</p>
            </div>
          )}
        </div>
      </main>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => !saving && setIsModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {editingRule ? "알림 조건 수정" : "새 알림 조건 추가"}
              </h3>
              <button
                type="button"
                disabled={saving}
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  규칙 이름
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="예: 분석 시작 30분 전 선수 알림"
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
                />
              </div>

              {/* Trigger Mode Tabs */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  발송 방식
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleModeChange("immediate")}
                    className={cn(
                      "rounded-xl border p-2.5 text-left transition-colors",
                      triggerMode === "immediate"
                        ? "border-brand-navy bg-brand-navy/5 dark:border-brand-navy-light dark:bg-brand-navy/20"
                        : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                    )}
                  >
                    <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                      <Bell size={13} />
                      즉시 알림
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">등록·변경 시 바로 발송</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModeChange("before_time")}
                    className={cn(
                      "rounded-xl border p-2.5 text-left transition-colors",
                      triggerMode === "before_time"
                        ? "border-brand-navy bg-brand-navy/5 dark:border-brand-navy-light dark:bg-brand-navy/20"
                        : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                    )}
                  >
                    <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                      <Clock size={13} />
                      시간 예약 (N분 전)
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">일정·마감 N분 전 리마인드</div>
                  </button>
                </div>
              </div>

              {/* Event Type */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  어떤 조건일 때 보낼까요?
                </label>
                <select
                  value={eventType}
                  onChange={(e) => handleEventChange(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
                >
                  {currentEventOptions.map((ev) => (
                    <option key={ev.value} value={ev.value}>
                      {ev.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Minutes Before Setting */}
              {triggerMode === "before_time" && (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3.5 space-y-2.5 bg-zinc-50/70 dark:bg-zinc-800/30">
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    몇 분 전에 알림을 보낼까요?
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {TIME_PRESETS.map((preset) => (
                      <button
                        key={preset.minutes}
                        type="button"
                        onClick={() => setMinutesBefore(preset.minutes)}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors",
                          minutesBefore === preset.minutes
                            ? "bg-brand-navy text-white border-brand-navy"
                            : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
                        )}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={10080}
                      value={minutesBefore}
                      onChange={(e) => setMinutesBefore(Math.max(1, Number(e.target.value) || 1))}
                      className="w-24 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none"
                    />
                    <span className="text-xs text-zinc-500">분 전 ({formatMinutesLabel(minutesBefore)})</span>
                  </div>

                  {eventType === "poll_deadline_before" && (
                    <label className="flex items-center gap-2 pt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={onlyNonRespondents}
                        onChange={(e) => setOnlyNonRespondents(e.target.checked)}
                        className="rounded border-zinc-300 text-brand-navy focus:ring-brand-navy"
                      />
                      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        아직 투표하지 않은 미응답자에게만 발송
                      </span>
                    </label>
                  )}
                </div>
              )}

              {/* Target Type */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  누구에게 보낼까요?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {TARGET_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTargetType(opt.value)}
                      className={`text-left rounded-xl border p-3 transition-colors ${
                        targetType === opt.value
                          ? "border-brand-navy bg-brand-navy/5 dark:border-brand-navy-light dark:bg-brand-navy/20"
                          : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                      }`}
                    >
                      <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                        {opt.label}
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {opt.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {targetType === "related_user" && (
                <label className="flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 px-3.5 py-2.5 cursor-pointer bg-zinc-50/70 dark:bg-zinc-800/30">
                  <input
                    type="checkbox"
                    checked={includeParents}
                    onChange={(e) => setIncludeParents(e.target.checked)}
                    className="rounded border-zinc-300 text-brand-navy focus:ring-brand-navy"
                  />
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    해당 선수의 학부모에게도 함께 발송
                  </span>
                </label>
              )}

              {targetType === "roles" && (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 space-y-2">
                  <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    대상 역할 선택
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ROLE_OPTIONS.map((role) => {
                      const active = targetRoles.includes(role.value);
                      return (
                        <button
                          key={role.value}
                          type="button"
                          onClick={() => toggleRole(role.value)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                            active
                              ? "border-brand-navy bg-brand-navy text-white"
                              : "border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                          }`}
                        >
                          {active ? <CheckSquare size={13} /> : <Square size={13} />}
                          {role.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {targetType === "specific_users" && (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 space-y-2">
                  <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    대상 사용자 선택 ({targetUserIds.length}명)
                  </div>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-2.5 text-zinc-400" />
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="이름 또는 역할 검색..."
                      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 pl-8 pr-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none"
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {filteredUsers.map((u) => {
                      const checked = targetUserIds.includes(u.id);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => toggleUser(u.id)}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs ${
                            checked
                              ? "bg-brand-navy/10 text-brand-navy dark:bg-brand-navy/25 dark:text-white font-semibold"
                              : "hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300"
                          }`}
                        >
                          <span className="flex items-center gap-2 truncate">
                            {checked ? <CheckSquare size={14} /> : <Square size={14} />}
                            {u.name || u.email || "이름 없음"}
                          </span>
                          <span className="text-[11px] text-zinc-400">
                            {ROLE_LABELS[u.role || ""] || u.role || ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  알림 제목
                </label>
                <input
                  type="text"
                  value={titleTemplate}
                  onChange={(e) => setTitleTemplate(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    알림 내용
                  </label>
                  <span className="text-[10px] text-zinc-400">일반 문장 입력 가능</span>
                </div>
                <textarea
                  rows={2}
                  value={bodyTemplate}
                  onChange={(e) => setBodyTemplate(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  규칙 활성화
                </span>
                <button
                  type="button"
                  onClick={() => setIsActive((v) => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isActive ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isActive ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                disabled={saving}
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-brand-navy hover:bg-brand-navy/90 text-white transition-colors disabled:opacity-50"
              >
                {saving ? "저장 중..." : editingRule ? "수정 완료" : "규칙 추가"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
