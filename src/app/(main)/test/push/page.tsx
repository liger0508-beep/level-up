"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, CheckSquare, RefreshCw, Send, Smartphone, Square } from "lucide-react";

interface PushTokenRow {
  id: string;
  user_id: string;
  platform: string;
  token: string;
  updated_at: string;
  isMe: boolean;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    role: string | null;
    branch: string | null;
  } | null;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "관리자",
  super_admin: "슈퍼관리자",
  superadmin: "슈퍼관리자",
  headquarter: "총괄",
  office: "오피스",
  coach: "코치",
  athlete: "선수",
  parent: "학부모",
};

export default function PushTestPage() {
  const [tokens, setTokens] = useState<PushTokenRow[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [title, setTitle] = useState("Level-Up 테스트 알림");
  const [body, setBody] = useState("푸시 알림이 정상 동작합니다!");
  const [resultMsg, setResultMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchTokens = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/push/test");
      const data = await res.json();
      if (!res.ok) {
        setResultMsg({ type: "error", text: data.error || "토큰 조회 실패" });
        setTokens([]);
      } else {
        const list: PushTokenRow[] = data.tokens || [];
        setTokens(list);
        if (list.length > 0 && selectedUserIds.length === 0) {
          const myRow = list.find((t) => t.isMe);
          if (myRow) {
            setSelectedUserIds([myRow.user_id]);
          }
        }
      }
    } catch {
      setResultMsg({ type: "error", text: "토큰 조회 중 오류가 발생했습니다." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTokens();
  }, []);

  // 사용자별로 그룹화
  const groupedUsers = useMemo(() => {
    const map = new Map<
      string,
      {
        userId: string;
        name: string;
        email: string;
        role: string;
        branch: string;
        isMe: boolean;
        devices: PushTokenRow[];
      }
    >();

    for (const row of tokens) {
      const existing = map.get(row.user_id);
      if (existing) {
        existing.devices.push(row);
      } else {
        map.set(row.user_id, {
          userId: row.user_id,
          name: row.user?.name || "이름 없음",
          email: row.user?.email || "",
          role: row.user?.role || "",
          branch: row.user?.branch || "",
          isMe: row.isMe,
          devices: [row],
        });
      }
    }

    const keyword = search.trim().toLowerCase();
    return Array.from(map.values()).filter((u) => {
      if (!keyword) return true;
      return (
        u.name.toLowerCase().includes(keyword) ||
        u.email.toLowerCase().includes(keyword) ||
        (ROLE_LABELS[u.role] || u.role).toLowerCase().includes(keyword)
      );
    });
  }, [tokens, search]);

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleAll = () => {
    const visibleIds = groupedUsers.map((u) => u.userId);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedUserIds.includes(id));
    if (allSelected) {
      setSelectedUserIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedUserIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleSendTest = async () => {
    if (sending) return;
    if (selectedUserIds.length === 0) {
      setResultMsg({ type: "error", text: "알림을 보낼 대상을 1명 이상 선택해 주세요." });
      return;
    }
    setSending(true);
    setResultMsg(null);
    try {
      const res = await fetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          targetUserIds: selectedUserIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResultMsg({ type: "error", text: data.error || "발송 실패" });
      } else {
        setResultMsg({
          type: "success",
          text: `테스트 알림을 발송했습니다! (선택 ${selectedUserIds.length}명 / 대상 기기 ${data.sent}대)`,
        });
      }
    } catch {
      setResultMsg({ type: "error", text: "발송 중 오류가 발생했습니다." });
    } finally {
      setSending(false);
    }
  };

  const allVisibleSelected =
    groupedUsers.length > 0 && groupedUsers.every((u) => selectedUserIds.includes(u.userId));

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-24">
      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-10 space-y-8">
        <div className="flex items-center gap-2">
          <Bell size={24} className="text-brand-navy dark:text-brand-navy-light shrink-0" />
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
            푸시 알림 테스트
          </h1>
        </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Smartphone size={16} />
            발송 대상 선택 ({selectedUserIds.length}명 선택 / 등록 기기 {tokens.length}대)
          </h2>
          <div className="flex items-center gap-3">
            {groupedUsers.length > 0 && (
              <button
                type="button"
                onClick={toggleAll}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-navy dark:text-zinc-300 hover:underline"
              >
                {allVisibleSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                {allVisibleSelected ? "전체 해제" : "전체 선택"}
              </button>
            )}
            <button
              type="button"
              onClick={fetchTokens}
              disabled={loading}
              className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              새로고침
            </button>
          </div>
        </div>

        {tokens.length > 0 && (
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름, 이메일, 역할로 검색..."
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
          />
        )}

        {loading ? (
          <p className="text-xs text-zinc-500">불러오는 중...</p>
        ) : groupedUsers.length === 0 ? (
          <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 p-4 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            아직 등록된 푸시 토큰이 없습니다.
            <br />
            모바일 앱(Android/iOS)에서 로그인하고 알림 권한을 허용하면 이 목록에 자동으로 표시됩니다.
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {groupedUsers.map((u) => {
              const checked = selectedUserIds.includes(u.userId);
              return (
                <button
                  key={u.userId}
                  type="button"
                  onClick={() => toggleUser(u.userId)}
                  className={`w-full text-left flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs transition-colors ${
                    checked
                      ? "border-brand-navy bg-brand-navy/5 dark:border-brand-navy-light dark:bg-brand-navy/20"
                      : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-brand-navy dark:text-zinc-200 shrink-0">
                      {checked ? <CheckSquare size={16} /> : <Square size={16} />}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {u.name}
                        </span>
                        {u.isMe && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-semibold">
                            나
                          </span>
                        )}
                        {u.role && (
                          <span className="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 text-[10px] font-medium">
                            {ROLE_LABELS[u.role] || u.role}
                          </span>
                        )}
                      </div>
                      {u.email && (
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                          {u.email}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {Array.from(new Set(u.devices.map((d) => d.platform.toUpperCase()))).map((plat) => (
                      <span
                        key={plat}
                        className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[10px] font-semibold text-zinc-700 dark:text-zinc-300"
                      >
                        {plat}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          테스트 알림 발송
        </h2>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              알림 제목
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              알림 내용
            </label>
            <textarea
              rows={2}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
            />
          </div>
        </div>

        {resultMsg && (
          <div
            className={`rounded-xl px-3.5 py-2.5 text-xs font-medium ${
              resultMsg.type === "success"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
            }`}
          >
            {resultMsg.text}
          </div>
        )}

        <button
          type="button"
          onClick={handleSendTest}
          disabled={sending || selectedUserIds.length === 0}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-navy hover:bg-brand-navy/90 text-white text-sm font-semibold py-2.5 px-4 transition-colors disabled:opacity-50"
        >
          <Send size={15} />
          {sending
            ? "발송 중..."
            : `선택한 ${selectedUserIds.length}명에게 테스트 푸시 보내기`}
        </button>
      </div>
      </main>
    </div>
  );
}
