import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin, triggerPushRules } from "@/lib/push-notification";

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const {
      eventType,
      relatedUserIds = [],
      relatedAthleteNames = [],
      variables = {},
      url,
    } = body;

    if (!eventType || typeof eventType !== "string") {
      return NextResponse.json({ error: "eventType is required" }, { status: 400 });
    }

    const resolvedIds: string[] = Array.isArray(relatedUserIds)
      ? relatedUserIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
      : [];

    if (Array.isArray(relatedAthleteNames) && relatedAthleteNames.length > 0) {
      const names = relatedAthleteNames.filter(
        (n: unknown): n is string => typeof n === "string" && n.trim().length > 0
      );
      if (names.length > 0) {
        const supabaseAdmin = getSupabaseAdmin();
        const { data: usersData } = await supabaseAdmin
          .from("users")
          .select("id")
          .in("name", names);
        for (const u of usersData || []) {
          resolvedIds.push(u.id);
        }
      }
    }

    const { sent } = await triggerPushRules({
      eventType,
      relatedUserIds: Array.from(new Set(resolvedIds)),
      variables,
      url,
    });

    return NextResponse.json({ success: true, sent });
  } catch (error: any) {
    console.error("Push trigger API error:", error);
    return NextResponse.json(
      { error: error?.message || "푸시 발송 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
