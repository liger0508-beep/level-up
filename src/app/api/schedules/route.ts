import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getSupabaseAdmin = () => {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || '',
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    );
};

export async function POST(request: Request) {
    try {
        const { event, userId } = await request.json();
        const supabase = getSupabaseAdmin();

        const participants = event.participantName?.split(", ").map((n: string) => n.trim()).filter(Boolean) || [];

        let creatorId = userId;
        if (event.coachName) {
            const cleanName = event.coachName.replace(/ (감독|코치|프로)$/, '').trim();
            let { data: cUser } = await supabase
                .from("users")
                .select("id")
                .eq("name", cleanName)
                .limit(1)
                .maybeSingle();

            if (!cUser && cleanName !== event.coachName.trim()) {
                const { data: cUser2 } = await supabase
                    .from("users")
                    .select("id")
                    .eq("name", event.coachName.trim())
                    .limit(1)
                    .maybeSingle();
                cUser = cUser2;
            }

            if (cUser) creatorId = cUser.id;
        }

        const insertPromises = (participants.length > 0 ? participants : [""]).map(async (name: string) => {
            let pUserId = userId;
            if (name) {
                // 1. Try to find user with matching name and athlete role
                let { data: pUser } = await supabase
                    .from("users")
                    .select("id")
                    .eq("name", name)
                    .eq("role", "athlete")
                    .limit(1)
                    .maybeSingle();

                // 2. Fallback to any user matching name
                if (!pUser) {
                    const { data: anyUser } = await supabase
                        .from("users")
                        .select("id")
                        .eq("name", name)
                        .limit(1)
                        .maybeSingle();
                    pUser = anyUser;
                }

                if (pUser) {
                    pUserId = pUser.id;
                } else {
                    console.error("Player user not found in database:", name);
                }
            }

            const prefixMap: Record<string, string> = {
                analysis: "[분석]",
                consultation: "[상담]",
            };
            const prefix = prefixMap[event.type] || "";
            const title = prefix && !event.title.startsWith(prefix) ? `${prefix} ${event.title}` : event.title;

            const map: Record<string, string> = {
                lesson: "lesson",
                training: "training",
                analysis: "lesson",
                consultation: "lesson",
                other: "training",
            };
            const dbType = map[event.type] || "training";

            return supabase.from("schedules").insert({
                user_id: pUserId,
                creator_id: creatorId,
                event_type: dbType,
                title: title,
                start_time: typeof event.start === "string" ? event.start : new Date(event.start).toISOString(),
                end_time: typeof event.end === "string" ? event.end : new Date(event.end).toISOString(),
                status: "scheduled",
            });
        });

        const results = await Promise.all(insertPromises);
        const firstError = results.find(r => r.error);
        if (firstError?.error) {
            return NextResponse.json({ error: firstError.error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const { event, userId } = await request.json();
        const supabase = getSupabaseAdmin();

        const prefixMap: Record<string, string> = {
            analysis: "[분석]",
            consultation: "[상담]",
        };
        const prefix = prefixMap[event.type] || "";
        const title = prefix && !event.title.startsWith(prefix) ? `${prefix} ${event.title}` : event.title;

        const map: Record<string, string> = {
            lesson: "lesson",
            training: "training",
            analysis: "lesson",
            consultation: "lesson",
            other: "training",
        };
        const dbType = map[event.type] || "training";

        const updateData: any = {
            title,
            event_type: dbType,
            start_time: typeof event.start === "string" ? event.start : new Date(event.start).toISOString(),
            end_time: typeof event.end === "string" ? event.end : new Date(event.end).toISOString(),
        };

        if (event.participantName) {
            const name = event.participantName.split(", ")[0].trim();
            let { data: pUser } = await supabase
                .from("users")
                .select("id")
                .eq("name", name)
                .eq("role", "athlete")
                .limit(1)
                .maybeSingle();

            if (!pUser) {
                const { data: anyUser } = await supabase
                    .from("users")
                    .select("id")
                    .eq("name", name)
                    .limit(1)
                    .maybeSingle();
                pUser = anyUser;
            }

            if (pUser) updateData.user_id = pUser.id;
        }

        if (event.coachName) {
            const cleanName = event.coachName.replace(/ (감독|코치|프로)$/, '').trim();
            let { data: cUser } = await supabase
                .from("users")
                .select("id")
                .eq("name", cleanName)
                .limit(1)
                .maybeSingle();

            if (!cUser && cleanName !== event.coachName.trim()) {
                const { data: cUser2 } = await supabase
                    .from("users")
                    .select("id")
                    .eq("name", event.coachName.trim())
                    .limit(1)
                    .maybeSingle();
                cUser = cUser2;
            }

            if (cUser) updateData.creator_id = cUser.id;
        }

        const { error } = await supabase.from("schedules").update(updateData).eq("id", event.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { id } = await request.json();
        const supabase = getSupabaseAdmin();
        const { error } = await supabase.from("schedules").delete().eq("id", id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const coachName = searchParams.get('coachName');
        const date = searchParams.get('date');
        const excludeId = searchParams.get('excludeId');

        if (!coachName || !date) {
            return NextResponse.json({ occupiedSlots: [] });
        }

        const supabase = getSupabaseAdmin();
        const cleanName = coachName.replace(/ (감독|코치|프로)$/, '').trim();

        // Find coach user id(s)
        const { data: coachUsers } = await supabase
            .from('users')
            .select('id, name')
            .or(`name.eq."${cleanName}",name.eq."${coachName.trim()}"`);

        const coachIds = (coachUsers || []).map(u => u.id);
        if (coachIds.length === 0) {
            return NextResponse.json({ occupiedSlots: [] });
        }

        // KST Day start and end in UTC
        const startKst = new Date(`${date}T00:00:00+09:00`).toISOString();
        const endKst = new Date(`${date}T23:59:59+09:00`).toISOString();

        let query = supabase
            .from('schedules')
            .select('id, start_time, end_time, title, event_type, status')
            .or(`creator_id.in.(${coachIds.join(',')}),user_id.in.(${coachIds.join(',')})`)
            .gte('end_time', startKst)
            .lte('start_time', endKst)
            .neq('status', 'cancelled');

        if (excludeId) {
            query = query.neq('id', excludeId);
        }

        const { data: schedules, error } = await query;
        if (error) {
            console.error('Error fetching coach schedules:', error);
            return NextResponse.json({ occupiedSlots: [] });
        }

        const slotDefinitions = [
            { key: "08:00", start: new Date(`${date}T08:00:00+09:00`).getTime(), end: new Date(`${date}T09:00:00+09:00`).getTime() },
            { key: "09:00", start: new Date(`${date}T09:00:00+09:00`).getTime(), end: new Date(`${date}T10:00:00+09:00`).getTime() },
            { key: "10:00", start: new Date(`${date}T10:00:00+09:00`).getTime(), end: new Date(`${date}T11:00:00+09:00`).getTime() },
            { key: "11:00", start: new Date(`${date}T11:00:00+09:00`).getTime(), end: new Date(`${date}T12:00:00+09:00`).getTime() },
            { key: "13:00", start: new Date(`${date}T13:00:00+09:00`).getTime(), end: new Date(`${date}T14:00:00+09:00`).getTime() },
            { key: "14:00", start: new Date(`${date}T14:00:00+09:00`).getTime(), end: new Date(`${date}T15:00:00+09:00`).getTime() },
            { key: "15:00", start: new Date(`${date}T15:00:00+09:00`).getTime(), end: new Date(`${date}T16:00:00+09:00`).getTime() },
            { key: "16:00", start: new Date(`${date}T16:00:00+09:00`).getTime(), end: new Date(`${date}T17:00:00+09:00`).getTime() },
            { key: "17:00", start: new Date(`${date}T17:00:00+09:00`).getTime(), end: new Date(`${date}T18:00:00+09:00`).getTime() },
            { key: "18:00", start: new Date(`${date}T18:00:00+09:00`).getTime(), end: new Date(`${date}T19:00:00+09:00`).getTime() },
            { key: "19:00", start: new Date(`${date}T19:00:00+09:00`).getTime(), end: new Date(`${date}T20:00:00+09:00`).getTime() },
            { key: "20:00", start: new Date(`${date}T20:00:00+09:00`).getTime(), end: new Date(`${date}T21:00:00+09:00`).getTime() },
        ];

        const occupiedSlots: string[] = [];

        (schedules || []).forEach(item => {
            const evStart = new Date(item.start_time).getTime();
            let evEnd = new Date(item.end_time).getTime();
            if (isNaN(evStart)) return;
            if (isNaN(evEnd) || evEnd <= evStart) {
                evEnd = evStart + 30 * 60 * 1000;
            }

            slotDefinitions.forEach(slot => {
                if (slot.start < evEnd && slot.end > evStart) {
                    if (!occupiedSlots.includes(slot.key)) {
                        occupiedSlots.push(slot.key);
                    }
                }
            });
        });

        // Also check coach blockout rules from settings/coach_blockouts.json
        try {
            const { data: bData } = await supabase.storage
                .from('records')
                .download('settings/coach_blockouts.json');

            if (bData) {
                const text = await bData.text();
                const blockouts: any[] = JSON.parse(text || '[]');
                const targetDayOfWeek = new Date(`${date}T00:00:00+09:00`).getDay();

                const matchedBlockouts = blockouts.filter(b => {
                    const matchCoach = coachIds.includes(b.coachId) || b.coachName === cleanName || b.coachName === coachName.trim();
                    if (!matchCoach) return false;

                    if (b.type === 'recurring') {
                        return b.dayOfWeek === targetDayOfWeek;
                    }
                    if (b.type === 'specific_date') {
                        return b.date === date;
                    }
                    return false;
                });

                matchedBlockouts.forEach(b => {
                    if (b.allDay) {
                        slotDefinitions.forEach(s => {
                            if (!occupiedSlots.includes(s.key)) occupiedSlots.push(s.key);
                        });
                    } else if (Array.isArray(b.slots)) {
                        b.slots.forEach((s: string) => {
                            if (!occupiedSlots.includes(s)) occupiedSlots.push(s);
                        });
                    }
                });
            }
        } catch (bErr) {
            console.error('Error checking blockouts in schedule get:', bErr);
        }

        return NextResponse.json({ occupiedSlots });
    } catch (err: any) {
        return NextResponse.json({ error: err.message, occupiedSlots: [] }, { status: 500 });
    }
}
