import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
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

function getSigningSecret() {
  return (
    process.env.QR_SIGNING_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "gla-daily-qr-fallback-secret"
  );
}

function createDailyQrToken(branch: string, date: string) {
  return crypto
    .createHmac("sha256", getSigningSecret())
    .update(`${branch}:${date}`)
    .digest("hex")
    .slice(0, 24);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const branch = (searchParams.get("branch") || "조이마루점").trim();
  const date = getKstDateStr();
  const token = createDailyQrToken(branch, date);

  return NextResponse.json({ branch, date, token });
}

export async function POST(request: Request) {
  try {
    const serverSupabase = await createServerClient();
    const {
      data: { user },
      error: userError,
    } = await serverSupabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, message: "로그인이 필요합니다. 로그인 후 다시 스캔해 주세요." },
        { status: 401 }
      );
    }

    const { branch, date, token } = await request.json();

    if (!branch || !date || !token) {
      return NextResponse.json(
        { success: false, message: "유효하지 않은 QR 코드입니다. 오늘 날짜의 QR을 스캔해 주세요." },
        { status: 400 }
      );
    }

    const todayKst = getKstDateStr();
    if (date !== todayKst) {
      return NextResponse.json(
        { success: false, message: "만료된 QR 코드입니다. 오늘 날짜의 QR을 다시 스캔해 주세요." },
        { status: 400 }
      );
    }

    const expected = createDailyQrToken(branch, date);
    const tokenBuf = Buffer.from(String(token));
    const expectedBuf = Buffer.from(expected);
    if (
      tokenBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(tokenBuf, expectedBuf)
    ) {
      return NextResponse.json(
        { success: false, message: "유효하지 않은 QR 코드입니다." },
        { status: 403 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: existing } = await supabaseAdmin
      .from("attendance")
      .select("id")
      .eq("athlete_id", user.id)
      .eq("date", todayKst)
      .eq("branch", branch)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        success: false,
        message: "이미 출석 체크되었습니다.",
      });
    }

    const { error } = await supabaseAdmin.from("attendance").insert({
      athlete_id: user.id,
      branch,
      date: todayKst,
      check_in_at: new Date().toISOString(),
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
