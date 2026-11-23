import { NextResponse } from "next/server";
import {
  applyPushTemplate,
  getSupabaseAdmin,
  resolveRuleRecipients,
  sendPushNotification,
} from "@/lib/push-notification";

const SCHEDULE_REMINDER_EVENTS = new Set([
  "analysis_before",
  "lesson_before",
  "consultation_before",
  "schedule_before",
]);

function matchesScheduleEvent(ruleEventType: string, schedule: any): boolean {
  const title = String(schedule.title || "");
  if (ruleEventType === "schedule_before") return true;
  if (ruleEventType === "analysis_before") return title.startsWith("[분석]");
  if (ruleEventType === "consultation_before") return title.startsWith("[상담]");
  if (ruleEventType === "lesson_before") {
    return (
      schedule.event_type === "lesson" &&
      !title.startsWith("[분석]") &&
      !title.startsWith("[상담]")
    );
  }
  return false;
}

async function runReminderCron(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get("authorization");
      const urlSecret = new URL(request.url).searchParams.get("secret");
      if (authHeader !== `Bearer ${cronSecret}` && urlSecret !== cronSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: rules, error: rulesError } = await supabaseAdmin
      .from("push_notification_rules")
      .select("*")
      .eq("is_active", true)
      .eq("trigger_mode", "before_time");

    if (rulesError) {
      return NextResponse.json({ error: rulesError.message }, { status: 500 });
    }

    if (!rules || rules.length === 0) {
      return NextResponse.json({ processed: 0, sent: 0 });
    }

    const now = new Date();
    let totalSent = 0;
    let processedCount = 0;

    // 1. Schedule reminders (analysis_before, lesson_before, consultation_before, schedule_before)
    const scheduleRules = rules.filter((r) => SCHEDULE_REMINDER_EVENTS.has(r.event_type));
    if (scheduleRules.length > 0) {
      const maxMinutes = Math.max(...scheduleRules.map((r) => Number(r.minutes_before) || 30));
      const windowEnd = new Date(now.getTime() + (maxMinutes + 5) * 60_000);

      const { data: upcomingSchedules } = await supabaseAdmin
        .from("schedules")
        .select("id, user_id, creator_id, event_type, title, start_time, status")
        .eq("status", "scheduled")
        .gte("start_time", now.toISOString())
        .lte("start_time", windowEnd.toISOString());

      for (const rule of scheduleRules) {
        const mins = Math.max(1, Number(rule.minutes_before) || 30);
        const ruleEndMs = now.getTime() + (mins + 5) * 60_000;

        for (const sch of upcomingSchedules || []) {
          if (!matchesScheduleEvent(rule.event_type, sch)) continue;
          const startMs = new Date(sch.start_time).getTime();
          if (startMs < now.getTime() || startMs > ruleEndMs) continue;

          const { data: existingLog } = await supabaseAdmin
            .from("push_notification_logs")
            .select("id")
            .eq("rule_id", rule.id)
            .eq("entity_id", sch.id)
            .eq("target_time", String(sch.start_time))
            .maybeSingle();

          if (existingLog) continue;

          const relatedIds = [sch.user_id, sch.creator_id].filter(Boolean);
          const recipientIds = await resolveRuleRecipients(rule, relatedIds);
          if (recipientIds.length === 0) continue;

          const vars = { title: sch.title || "예정된 일정" };
          const { sent } = await sendPushNotification({
            userIds: recipientIds,
            title: applyPushTemplate(rule.title_template, vars),
            body: applyPushTemplate(rule.body_template, vars),
            url: "/schedule",
          });

          await supabaseAdmin.from("push_notification_logs").insert({
            rule_id: rule.id,
            entity_id: sch.id,
            target_time: String(sch.start_time),
          });

          processedCount += 1;
          totalSent += sent;
        }
      }
    }

    // 2. Poll deadline reminders (poll_deadline_before)
    const pollRules = rules.filter((r) => r.event_type === "poll_deadline_before");
    if (pollRules.length > 0) {
      const { data: activePolls } = await supabaseAdmin
        .from("polls")
        .select("id, title, end_date, end_time, status")
        .eq("status", "active")
        .not("end_date", "is", null);

      for (const rule of pollRules) {
        const mins = Math.max(1, Number(rule.minutes_before) || 30);
        const ruleEndMs = now.getTime() + (mins + 5) * 60_000;

        for (const poll of activePolls || []) {
          if (!poll.end_date) continue;
          const timePart = poll.end_time ? String(poll.end_time).slice(0, 5) : "23:59";
          const deadlineIso = `${poll.end_date}T${timePart}:00+09:00`;
          const deadlineMs = new Date(deadlineIso).getTime();
          if (Number.isNaN(deadlineMs)) continue;
          if (deadlineMs < now.getTime() || deadlineMs > ruleEndMs) continue;

          const { data: existingLog } = await supabaseAdmin
            .from("push_notification_logs")
            .select("id")
            .eq("rule_id", rule.id)
            .eq("entity_id", poll.id)
            .eq("target_time", deadlineIso)
            .maybeSingle();

          if (existingLog) continue;

          let recipientIds = await resolveRuleRecipients(rule, []);
          if (rule.only_non_respondents && recipientIds.length > 0) {
            const { data: responses } = await supabaseAdmin
              .from("poll_responses")
              .select("user_id")
              .eq("poll_id", poll.id);
            const respondedSet = new Set((responses || []).map((r) => r.user_id));
            recipientIds = recipientIds.filter((id) => !respondedSet.has(id));
          }

          if (recipientIds.length === 0) continue;

          const vars = { title: poll.title || "설문조사" };
          const { sent } = await sendPushNotification({
            userIds: recipientIds,
            title: applyPushTemplate(rule.title_template, vars),
            body: applyPushTemplate(rule.body_template, vars),
            url: `/admin/polls/${poll.id}`,
          });

          await supabaseAdmin.from("push_notification_logs").insert({
            rule_id: rule.id,
            entity_id: poll.id,
            target_time: deadlineIso,
          });

          processedCount += 1;
          totalSent += sent;
        }
      }
    }

    return NextResponse.json({ processed: processedCount, sent: totalSent });
  } catch (error: any) {
    console.error("Push cron error:", error);
    return NextResponse.json(
      { error: error?.message || "리마인드 발송 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return runReminderCron(request);
}

export async function POST(request: Request) {
  return runReminderCron(request);
}
