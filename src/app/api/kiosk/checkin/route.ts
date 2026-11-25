import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getKstDateStr } from "@/lib/utils";

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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const branch = (searchParams.get("branch") || "").trim();
    const last4 = (searchParams.get("last4") || "").trim();

    const supabaseAdmin = getSupabaseAdmin();

    // Return today's checked-in attendees (name + check_in_at only) for a branch
    if (branch && !last4) {
      const today = getKstDateStr();
      const { data, error } = await supabaseAdmin
        .from("attendance")
        .select("id, check_in_at, users(name)")
        .eq("date", today)
        .eq("branch", branch)
        .order("check_in_at", { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const attendees = (data || []).map((row: any) => ({
        id: row.id,
        name: row.users?.name || "선수",
        check_in_at: row.check_in_at,
      }));

      return NextResponse.json({ attendees });
    }

    if (!/^\d{4}$/.test(last4)) {
      return NextResponse.json(
        { error: "전화번호 뒷자리 4자리를 입력해 주세요." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, name, status")
      .eq("role", "athlete")
      .like("phone", `%${last4}`);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const activeAthletes = (data || [])
      .filter((u) => u.status !== "퇴직" && u.status !== "비활성화")
      .map((u) => ({ id: u.id, name: u.name }));

    return NextResponse.json({ athletes: activeAthletes });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { athleteId, branch } = await request.json();

    if (!athleteId || !branch) {
      return NextResponse.json(
        { success: false, message: "선수 및 지점 정보가 필요합니다." },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const date = getKstDateStr();
    const now = new Date().toISOString();

    const { data: existing } = await supabaseAdmin
      .from("attendance")
      .select("id")
      .eq("athlete_id", athleteId)
      .eq("date", date)
      .eq("branch", branch)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        success: false,
        message: "이미 출석 체크되었습니다.",
      });
    }

    const { error } = await supabaseAdmin.from("attendance").insert({
      athlete_id: athleteId,
      branch,
      date,
      check_in_at: now,
    });

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "출석 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
