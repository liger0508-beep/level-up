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

export async function POST() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 슈퍼관리자 계정은 실수 방지를 위해 셀프 탈퇴 제한
    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("name")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.name === "슈퍼관리자") {
      return NextResponse.json(
        { error: "슈퍼관리자 계정은 탈퇴할 수 없습니다." },
        { status: 403 }
      );
    }

    // 1. Delete from public.users
    const { error: dbError } = await supabaseAdmin
      .from("users")
      .delete()
      .eq("id", user.id);

    if (dbError) {
      console.error("Self delete failed in public.users:", dbError);
    }

    // 2. Delete from auth.users
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(
      user.id
    );

    if (authError) {
      console.error("Self delete failed in auth.users:", authError);
      return NextResponse.json(
        { error: `회원탈퇴 처리에 실패했습니다: ${authError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete account API error:", error);
    return NextResponse.json(
      { error: error?.message || "서버 에러가 발생했습니다." },
      { status: 500 }
    );
  }
}
