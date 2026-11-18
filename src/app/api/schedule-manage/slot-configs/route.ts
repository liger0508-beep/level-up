import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { CoachSlotConfig, generateSlotsFromConfig, resolveCoachSlotConfig } from "@/lib/schedule-slots";

export const dynamic = "force-dynamic";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = "records";
const FILE_PATH = "settings/coach_slot_configs.json";

async function loadConfigs(): Promise<CoachSlotConfig[]> {
    try {
        const { data, error } = await supabase.storage.from(BUCKET).download(FILE_PATH);
        if (error || !data) return [];
        const text = await data.text();
        return JSON.parse(text || "[]");
    } catch {
        return [];
    }
}

async function saveConfigs(configs: CoachSlotConfig[]): Promise<boolean> {
    try {
        const { error } = await supabase.storage
            .from(BUCKET)
            .upload(FILE_PATH, JSON.stringify(configs, null, 2), {
                contentType: "application/json",
                upsert: true,
            });
        return !error;
    } catch {
        return false;
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const coachName = searchParams.get("coachName");
        const date = searchParams.get("date");

        const configs = await loadConfigs();

        if (coachName && date) {
            const matched = resolveCoachSlotConfig(configs, coachName, date);
            const slots = matched ? generateSlotsFromConfig(matched) : null;
            return NextResponse.json({ config: matched, slots });
        }

        return NextResponse.json({ configs });
    } catch (err: any) {
        return NextResponse.json({ error: err.message, configs: [] }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            id,
            coachId,
            coachName,
            month,
            useAm,
            amStart,
            amEnd,
            usePm,
            pmStart,
            pmEnd,
            durationMinutes,
            breakMinutes,
            disabledSlots,
        } = body;

        if (!coachName || !month) {
            return NextResponse.json({ error: "코치와 적용 월을 선택해주세요." }, { status: 400 });
        }

        const cleanName = coachName.replace(/ (감독|코치|프로)$/, "").trim();
        const configs = await loadConfigs();

        const newConfig: CoachSlotConfig = {
            id: id || crypto.randomUUID(),
            coachId: coachId || "",
            coachName: cleanName,
            month,
            useAm: useAm !== false,
            amStart: amStart || "09:00",
            amEnd: amEnd || "12:00",
            usePm: usePm !== false,
            pmStart: pmStart || "14:00",
            pmEnd: pmEnd || "18:00",
            durationMinutes: Number(durationMinutes) || 60,
            breakMinutes: Number(breakMinutes) || 0,
            disabledSlots: Array.isArray(disabledSlots) ? disabledSlots : [],
            updatedAt: new Date().toISOString(),
        };

        // Replace existing config for same coachName + month if any
        const idx = configs.findIndex(
            (c) => (c.coachName === cleanName && c.month === month) || (id && c.id === id)
        );
        if (idx >= 0) {
            newConfig.id = configs[idx].id;
            configs[idx] = newConfig;
        } else {
            configs.unshift(newConfig);
        }

        const ok = await saveConfigs(configs);
        if (!ok) {
            return NextResponse.json({ error: "저장에 실패했습니다." }, { status: 500 });
        }

        return NextResponse.json({ success: true, config: newConfig });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { id } = await request.json();
        if (!id) {
            return NextResponse.json({ error: "ID가 필요합니다." }, { status: 400 });
        }

        const configs = await loadConfigs();
        const filtered = configs.filter((c) => c.id !== id);
        const ok = await saveConfigs(filtered);
        if (!ok) {
            return NextResponse.json({ error: "삭제에 실패했습니다." }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

