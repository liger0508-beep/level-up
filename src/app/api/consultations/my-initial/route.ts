import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import {
    ConsultationCategory,
    ConsultationStructuredData,
    CONSULTATION_CATEGORY_LABELS,
    encodeConsultationContent,
    parseConsultationData,
} from "@/lib/consultation-templates";
import { formatLocalDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

function getAdminSupabase() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        throw new Error("Missing Supabase admin credentials");
    }
    return createAdminClient(url, key);
}

function isMissingColumnError(error: any): boolean {
    const msg = String(error?.message || "");
    return (
        error?.code === "PGRST204" ||
        error?.code === "42703" ||
        msg.includes("column") ||
        msg.includes("schema cache")
    );
}

function extractInitialConsultation(row: any) {
    const rawContent = row.content || "";
    const { structured, displayHtml } = parseConsultationData(rawContent);
    const resolvedStructured: ConsultationStructuredData | null = row.structured_data || structured;
    const resolvedCategory: ConsultationCategory =
        (row.category as ConsultationCategory) || resolvedStructured?.category || "general";

    return {
        id: row.id as string,
        date: row.date as string,
        title: (row.title as string) || "",
        athleteName: (row.athlete_name as string) || "",
        author: (row.author as string) || "",
        userId: (row.user_id as string) || null,
        category: resolvedCategory,
        structuredData: resolvedStructured,
        displayContent: displayHtml,
    };
}

async function getAuthenticatedProfile() {
    const supabase = await createServerSupabase();
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }

    const admin = getAdminSupabase();
    const { data: profile } = await admin
        .from("users")
        .select("id, name, role")
        .eq("id", user.id)
        .maybeSingle();

    if (!profile || (profile.role !== "athlete" && profile.role !== "parent")) {
        return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }

    return { user, profile, admin };
}

export async function GET() {
    try {
        const auth = await getAuthenticatedProfile();
        if ("error" in auth && auth.error) return auth.error;
        const { user, profile, admin } = auth;

        const targetCategory: ConsultationCategory =
            profile.role === "athlete" ? "initial" : "parent_first";

        let query = admin
            .from("consultations")
            .select("*")
            .order("date", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(50);

        if (profile.role === "athlete") {
            query = query.or(`user_id.eq.${user.id},athlete_name.eq.${profile.name}`);
        } else {
            query = query.eq("author", profile.name);
        }

        const { data, error } = await query;
        if (error) throw error;

        const matched = (data || [])
            .map(extractInitialConsultation)
            .find((c) => {
                if (c.category !== targetCategory) return false;
                if (profile.role === "athlete") {
                    return c.userId === user.id || c.athleteName === profile.name;
                }
                return (
                    c.structuredData?.submittedByUserId === user.id ||
                    c.author === profile.name
                );
            });

        return NextResponse.json({
            role: profile.role,
            userName: profile.name,
            consultation: matched || null,
        });
    } catch (err: any) {
        console.error("GET /api/consultations/my-initial error:", err);
        return NextResponse.json(
            { error: err?.message || "Failed to load consultation" },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const auth = await getAuthenticatedProfile();
        if ("error" in auth && auth.error) return auth.error;
        const { user, profile, admin } = auth;

        const body = await req.json();
        const answers: Record<string, string> = body?.answers || {};
        const generalNote: string = typeof body?.generalNote === "string" ? body.generalNote.trim() : "";
        const requestedAthleteName: string =
            typeof body?.athleteName === "string" ? body.athleteName.trim() : "";

        const targetCategory: ConsultationCategory =
            profile.role === "athlete" ? "initial" : "parent_first";

        const athleteName =
            profile.role === "athlete" ? profile.name : requestedAthleteName;

        if (!athleteName) {
            return NextResponse.json(
                { error: "대상 선수 이름을 선택해 주세요." },
                { status: 400 }
            );
        }

        const hasAnyAnswer = Object.values(answers).some((v) => String(v || "").trim().length > 0);
        if (!hasAnyAnswer && !generalNote) {
            return NextResponse.json(
                { error: "최소 1개 이상의 항목을 입력해 주세요." },
                { status: 400 }
            );
        }

        // Resolve athlete user_id
        let athleteUserId: string | null = profile.role === "athlete" ? user.id : null;
        if (profile.role === "parent") {
            const { data: athleteRow } = await admin
                .from("users")
                .select("id")
                .eq("name", athleteName)
                .maybeSingle();
            athleteUserId = athleteRow?.id || null;
        }

        const structuredPayload: ConsultationStructuredData = {
            version: 1,
            category: targetCategory,
            answers,
            generalNote: generalNote || undefined,
            submittedByUserId: user.id,
        };

        const encodedContent = encodeConsultationContent(structuredPayload, generalNote);
        const title = `${athleteName} ${CONSULTATION_CATEGORY_LABELS[targetCategory]}`;
        const dateStr = formatLocalDate();

        // Check if user already has an existing initial consultation to update
        let existingId: string | null = null;
        const { data: existingRows } = await admin
            .from("consultations")
            .select("*")
            .order("date", { ascending: false })
            .limit(50);

        const existingMatch = (existingRows || [])
            .map(extractInitialConsultation)
            .find((c) => {
                if (c.category !== targetCategory) return false;
                if (profile.role === "athlete") {
                    return c.userId === user.id || c.athleteName === profile.name;
                }
                return (
                    c.structuredData?.submittedByUserId === user.id ||
                    c.author === profile.name
                );
            });

        if (existingMatch) {
            existingId = existingMatch.id;
        }

        if (existingId) {
            const updateFull: Record<string, any> = {
                athlete_name: athleteName,
                user_id: athleteUserId,
                content: encodedContent,
                title,
                category: targetCategory,
                structured_data: structuredPayload,
            };

            let { data: updated, error } = await admin
                .from("consultations")
                .update(updateFull)
                .eq("id", existingId)
                .select()
                .single();

            if (error && isMissingColumnError(error)) {
                const { category: _c, structured_data: _s, ...fallback } = updateFull;
                const retry = await admin
                    .from("consultations")
                    .update(fallback)
                    .eq("id", existingId)
                    .select()
                    .single();
                updated = retry.data;
                error = retry.error;
            }

            if (error) throw error;
            return NextResponse.json({ consultation: extractInitialConsultation(updated) });
        }

        const insertFull: Record<string, any> = {
            date: dateStr,
            coach_name: "",
            author: profile.name,
            title,
            content: encodedContent,
            type: "all",
            athlete_name: athleteName,
            user_id: athleteUserId,
            coach_id: null,
            is_important: false,
            category: targetCategory,
            structured_data: structuredPayload,
        };

        let { data: inserted, error } = await admin
            .from("consultations")
            .insert(insertFull)
            .select()
            .single();

        if (error && isMissingColumnError(error)) {
            const { category: _c, structured_data: _s, ...fallback } = insertFull;
            const retry = await admin
                .from("consultations")
                .insert(fallback)
                .select()
                .single();
            inserted = retry.data;
            error = retry.error;
        }

        if (error) throw error;
        return NextResponse.json({ consultation: extractInitialConsultation(inserted) });
    } catch (err: any) {
        console.error("POST /api/consultations/my-initial error:", err);
        return NextResponse.json(
            { error: err?.message || "Failed to save consultation" },
            { status: 500 }
        );
    }
}

