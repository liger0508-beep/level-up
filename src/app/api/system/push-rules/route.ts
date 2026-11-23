import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

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

    const [{ data: rules, error: rulesError }, { data: usersData }] =
      await Promise.all([
        auth.supabaseAdmin
          .from("push_notification_rules")
          .select("*")
          .order("created_at", { ascending: false }),
        auth.supabaseAdmin
          .from("users")
          .select("id, name, email, role, branch")
          .order("name", { ascending: true }),
      ]);

    if (rulesError) {
      const isMissing =
        rulesError.code === "42P01" ||
        rulesError.message?.includes("does not exist") ||
        rulesError.message?.includes("schema cache");
      if (isMissing) {
        return NextResponse.json({
          rules: [],
          users: usersData || [],
          tableMissing: true,
        });
      }
      return NextResponse.json(
        { error: "규칙 조회 실패: " + rulesError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      rules: rules || [],
      users: usersData || [],
      tableMissing: false,
    });
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

    const body = await request.json();
    const {
      name,
      event_type,
      trigger_mode = "immediate",
      minutes_before = 30,
      only_non_respondents = false,
      include_parents = false,
      target_type,
      target_roles = [],
      target_user_ids = [],
      title_template,
      body_template,
      is_active = true,
    } = body;

    if (!name?.trim() || !event_type || !target_type || !title_template?.trim() || !body_template?.trim()) {
      return NextResponse.json(
        { error: "필수 항목(규칙 이름, 조건, 발송 대상, 알림 제목/내용)을 모두 입력해 주세요." },
        { status: 400 }
      );
    }

    const { data, error } = await auth.supabaseAdmin
      .from("push_notification_rules")
      .insert({
        name: name.trim(),
        event_type,
        trigger_mode: trigger_mode === "before_time" ? "before_time" : "immediate",
        minutes_before: Math.max(1, Number(minutes_before) || 30),
        only_non_respondents: Boolean(only_non_respondents),
        include_parents: Boolean(include_parents),
        target_type,
        target_roles: Array.isArray(target_roles) ? target_roles : [],
        target_user_ids: Array.isArray(target_user_ids) ? target_user_ids : [],
        title_template: title_template.trim(),
        body_template: body_template.trim(),
        is_active: Boolean(is_active),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "규칙 저장 실패: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ rule: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAdmin();
    if ("errorResponse" in auth) return auth.errorResponse;

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: "수정할 규칙 ID가 필요합니다." },
        { status: 400 }
      );
    }

    const allowed: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (typeof updates.name === "string") allowed.name = updates.name.trim();
    if (typeof updates.event_type === "string") allowed.event_type = updates.event_type;
    if (updates.trigger_mode === "immediate" || updates.trigger_mode === "before_time") {
      allowed.trigger_mode = updates.trigger_mode;
    }
    if (updates.minutes_before !== undefined) {
      allowed.minutes_before = Math.max(1, Number(updates.minutes_before) || 30);
    }
    if (typeof updates.only_non_respondents === "boolean") {
      allowed.only_non_respondents = updates.only_non_respondents;
    }
    if (typeof updates.include_parents === "boolean") {
      allowed.include_parents = updates.include_parents;
    }
    if (typeof updates.target_type === "string") allowed.target_type = updates.target_type;
    if (Array.isArray(updates.target_roles)) allowed.target_roles = updates.target_roles;
    if (Array.isArray(updates.target_user_ids)) allowed.target_user_ids = updates.target_user_ids;
    if (typeof updates.title_template === "string") allowed.title_template = updates.title_template.trim();
    if (typeof updates.body_template === "string") allowed.body_template = updates.body_template.trim();
    if (typeof updates.is_active === "boolean") allowed.is_active = updates.is_active;

    const { data, error } = await auth.supabaseAdmin
      .from("push_notification_rules")
      .update(allowed)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "규칙 수정 실패: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ rule: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAdmin();
    if ("errorResponse" in auth) return auth.errorResponse;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "삭제할 규칙 ID가 필요합니다." },
        { status: 400 }
      );
    }

    const { error } = await auth.supabaseAdmin
      .from("push_notification_rules")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { error: "규칙 삭제 실패: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
