import { createClient } from "@supabase/supabase-js";

export const getSupabaseAdmin = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
};

interface SendPushOptions {
  userIds: string[];
  title: string;
  body: string;
  url?: string;
}

/**
 * 지정된 사용자 ID 목록에 Expo Push Notification을 발송합니다.
 */
export async function sendPushNotification({
  userIds,
  title,
  body,
  url,
}: SendPushOptions): Promise<{ sent: number }> {
  try {
    if (!userIds || userIds.length === 0) return { sent: 0 };

    const supabaseAdmin = getSupabaseAdmin();
    const { data: tokenRows, error } = await supabaseAdmin
      .from("user_push_tokens")
      .select("token")
      .in("user_id", userIds);

    if (error || !tokenRows || tokenRows.length === 0) {
      return { sent: 0 };
    }

    const uniqueTokens = Array.from(
      new Set(tokenRows.map((r) => r.token).filter(Boolean))
    );

    if (uniqueTokens.length === 0) return { sent: 0 };

    const messages = uniqueTokens.map((to) => ({
      to,
      sound: "default",
      title,
      body,
      data: url ? { url } : undefined,
    }));

    // Expo Push API는 한 번에 최대 100건씩 발송 권장
    let sentCount = 0;
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk),
      });

      if (res.ok) {
        sentCount += chunk.length;
      } else {
        console.error("Expo push send failed:", await res.text());
      }
    }

    return { sent: sentCount };
  } catch (err) {
    console.error("sendPushNotification error:", err);
    return { sent: 0 };
  }
}

export function applyPushTemplate(template: string, variables: Record<string, string>) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key) => {
    return variables[key] ?? "";
  });
}

export async function resolveRuleRecipients(
  rule: {
    target_type: string;
    target_roles?: string[];
    target_user_ids?: string[];
    include_parents?: boolean;
  },
  relatedUserIds: string[] = []
): Promise<string[]> {
  const supabaseAdmin = getSupabaseAdmin();
  let recipientIds: string[] = [];

  if (rule.target_type === "all") {
    const { data: allUsers } = await supabaseAdmin.from("users").select("id");
    recipientIds = (allUsers || []).map((u) => u.id);
  } else if (
    rule.target_type === "roles" &&
    Array.isArray(rule.target_roles) &&
    rule.target_roles.length > 0
  ) {
    const { data: roleUsers } = await supabaseAdmin
      .from("users")
      .select("id")
      .in("role", rule.target_roles);
    recipientIds = (roleUsers || []).map((u) => u.id);
  } else if (rule.target_type === "related_user") {
    recipientIds = [...relatedUserIds];
    if (rule.include_parents && relatedUserIds.length > 0) {
      const { data: athletes } = await supabaseAdmin
        .from("users")
        .select("name")
        .in("id", relatedUserIds)
        .eq("role", "athlete");

      for (const athlete of athletes || []) {
        if (!athlete.name) continue;
        const { data: parents } = await supabaseAdmin
          .from("users")
          .select("id")
          .eq("role", "parent")
          .like("name", `${athlete.name} (%`);
        for (const p of parents || []) {
          recipientIds.push(p.id);
        }
      }
    }
  } else if (
    rule.target_type === "specific_users" &&
    Array.isArray(rule.target_user_ids)
  ) {
    recipientIds = rule.target_user_ids;
  }

  return Array.from(new Set(recipientIds.filter(Boolean)));
}

interface TriggerPushRulesOptions {
  eventType: string;
  relatedUserIds?: string[];
  variables?: Record<string, string>;
  url?: string;
}

/**
 * push_notification_rules 테이블에 등록된 활성 조건을 조회해 대상자에게 푸시를 발송합니다.
 */
export async function triggerPushRules({
  eventType,
  relatedUserIds = [],
  variables = {},
  url,
}: TriggerPushRulesOptions): Promise<{ sent: number }> {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data: rules, error } = await supabaseAdmin
      .from("push_notification_rules")
      .select("*")
      .eq("event_type", eventType)
      .eq("is_active", true);

    if (error || !rules || rules.length === 0) {
      return { sent: 0 };
    }

    let totalSent = 0;

    for (const rule of rules) {
      const uniqueIds = await resolveRuleRecipients(rule, relatedUserIds);
      if (uniqueIds.length === 0) continue;

      const title = applyPushTemplate(rule.title_template, variables);
      const body = applyPushTemplate(rule.body_template, variables);

      const { sent } = await sendPushNotification({
        userIds: uniqueIds,
        title,
        body,
        url,
      });
      totalSent += sent;
    }

    return { sent: totalSent };
  } catch (err) {
    console.error("triggerPushRules error:", err);
    return { sent: 0 };
  }
}
