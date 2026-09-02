import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
});

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const athleteId = searchParams.get('athlete_id');
    const type = searchParams.get('type');

    if (type === 'status' && month) {
        const { data, error } = await supabaseAdmin
            .from("player_reports")
            .select("athlete_id")
            .eq("month", month);
        return NextResponse.json({ data, error });
    }

    if (type === 'detail' && month && athleteId) {
        const { data, error } = await supabaseAdmin
            .from("player_reports")
            .select("id, content")
            .eq("athlete_id", athleteId)
            .eq("month", month)
            .maybeSingle();
        return NextResponse.json({ data, error });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { athlete_id, coach_id, month, content } = body;

        if (!athlete_id || !coach_id || !month || !content) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin.from('player_reports').upsert({
            athlete_id,
            coach_id,
            month,
            content
        }, { onConflict: 'athlete_id, month' }).select('id').single();

        if (error) {
            console.error("Supabase upsert error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data });
    } catch (e: any) {
        console.error("API /reports error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}