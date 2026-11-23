import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushNotification } from "@/lib/push-notification";

const getSupabaseAdmin = () => {
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

async function requireAdmin() {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      errorResponse: NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      ),
    };
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("role, name")
    .eq("id", user.id)
    .single();

  const role = profile?.role;
  const isSuperAdmin =
    role === "admin" ||
    role === "super_admin" ||
    role === "superadmin" ||
    profile?.name === "슈퍼관리자";
  if (!isSuperAdmin) {
    return {
      errorResponse: NextResponse.json(
        { error: "관리자 권한이 필요합니다." },
        { status: 403 }
      ),
    };
  }

  return { user, supabaseAdmin };
}

export async function GET() {
  try {
    const auth = await requireAdmin();
    if ("errorResponse" in auth) return auth.errorResponse;

    const { data: tokenRows, error } = await auth.supabaseAdmin
      .from("user_push_tokens")
      .select("id, user_id, platform, token, updated_at")
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "푸시 토큰 조회 실패: " + error.message },
        { status: 500 }
      );
    }

    const userIds = Array.from(
      new Set((tokenRows || []).map((r) => r.user_id).filter(Boolean))
    );

    let userMap: Record<
      string,
      { id: string; name: string | null; email: string | null; role: string | null; branch: string | null }
    > = {};

    if (userIds.length > 0) {
      const { data: usersData } = await auth.supabaseAdmin
        .from("users")
        .select("id, name, email, role, branch")
        .in("id", userIds);

      for (const u of usersData || []) {
        userMap[u.id] = u;
      }
    }

    const tokens = (tokenRows || []).map((row) => ({
      ...row,
      user: userMap[row.user_id] || null,
      isMe: row.user_id === auth.user.id,
    }));

    return NextResponse.json({ tokens, currentUserId: auth.user.id });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if ("errorResponse" in auth) return auth.errorResponse;

    let title = "Level-Up 테스트 알림";
    let body = "푸시 알림이 정상적으로 연결되었습니다!";
    let targetUserIds: string[] = [];

    try {
      const payload = await request.json();
      if (payload?.title && typeof payload.title === "string") {
        title = payload.title.trim() || title;
      }
      if (payload?.body && typeof payload.body === "string") {
        body = payload.body.trim() || body;
      }
      if (Array.isArray(payload?.targetUserIds)) {
        targetUserIds = payload.targetUserIds.filter(
          (id: unknown): id is string => typeof id === "string" && id.length > 0
        );
      }
    } catch {
      // Optional JSON body
    }

    const userIds = targetUserIds.length > 0 ? targetUserIds : [auth.user.id];

    const { sent } = await sendPushNotification({
      userIds,
      title,
      body,
      url: "/",
    });

    if (sent === 0) {
      return NextResponse.json(
        {
          error:
            "선택한 대상에 등록된 푸시 토큰이 없습니다. 모바일 앱에서 로그인하고 알림 권한을 허용했는지 확인해 주세요.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, sent });
  } catch (error: any) {
    console.error("Push test error:", error);
    return NextResponse.json(
      { error: error?.message || "테스트 알림 발송에 실패했습니다." },
      { status: 500 }
    );
  }
}
