import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { COACH_DEFAULT_SLOTS, generateSlotsFromConfig, resolveCoachSlotConfig } from '@/lib/schedule-slots';
import { sendPushNotification, triggerPushRules } from '@/lib/push-notification';

export const dynamic = 'force-dynamic';

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

function getKstMonthBounds(dateOrIso: string): { startIso: string; endIso: string } | null {
    // Support both "YYYY-MM-DD" and ISO timestamp
    let kstDateStr = dateOrIso;
    if (dateOrIso.includes('T')) {
        const d = new Date(dateOrIso);
        if (isNaN(d.getTime())) return null;
        kstDateStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
    }
    const [yStr, mStr] = kstDateStr.split('-');
    const y = Number(yStr);
    const m = Number(mStr);
    if (!y || !m) return null;
    const startIso = new Date(`${yStr}-${mStr}-01T00:00:00+09:00`).toISOString();
    const nextY = m === 12 ? y + 1 : y;
    const nextM = m === 12 ? 1 : m + 1;
    const endIso = new Date(`${nextY}-${String(nextM).padStart(2, '0')}-01T00:00:00+09:00`).toISOString();
    return { startIso, endIso };
}

async function getAthleteMonthlyAnalysisCount(
    supabase: ReturnType<typeof getSupabaseAdmin>,
    athleteUserId: string,
    dateOrIso: string,
    excludeId?: string | null
): Promise<number> {
    const bounds = getKstMonthBounds(dateOrIso);
    if (!bounds) return 0;

    let q = supabase
        .from("schedules")
        .select("id", { count: "exact", head: true })
        .eq("user_id", athleteUserId)
        .neq("status", "cancelled")
        .ilike("title", "[분석]%")
        .gte("start_time", bounds.startIso)
        .lt("start_time", bounds.endIso);

    if (excludeId) {
        q = q.neq("id", excludeId);
    }

    const { count, error } = await q;
    if (error) {
        console.error("Error counting monthly analysis schedules:", error);
        return 0;
    }
    return count || 0;
}

export async function POST(request: Request) {
    try {
        const serverSupabase = await createServerClient();
        const { data: { user: authUser } } = await serverSupabase.auth.getUser();
        const supabase = getSupabaseAdmin();

        if (authUser) {
            const { data: authProfile } = await supabase
                .from("users")
                .select("role")
                .eq("id", authUser.id)
                .maybeSingle();
            if (authProfile?.role === "athlete" || authProfile?.role === "parent") {
                return NextResponse.json(
                    { error: "선수 및 학부모는 신규 예약을 등록할 수 없습니다." },
                    { status: 403 }
                );
            }
        }

        const { event, userId } = await request.json();

        // Enforce monthly 2-time limit on 'analysis' reservations for athletes only (coaches/admins have no limit)
        if (userId && event?.type === "analysis") {
            const { data: requester } = await supabase
                .from("users")
                .select("role")
                .eq("id", userId)
                .maybeSingle();

            if (requester?.role === "athlete") {
                const startStr = typeof event.start === "string" ? event.start : new Date(event.start).toISOString();
                const currentCount = await getAthleteMonthlyAnalysisCount(supabase, userId, startStr);
                if (currentCount >= 2) {
                    return NextResponse.json(
                        { error: "분석 예약은 한 달에 2회까지만 가능합니다." },
                        { status: 400 }
                    );
                }
            }
        }

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

        const participantUserIds: string[] = [];
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
            if (pUserId) {
                participantUserIds.push(pUserId);
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

        const relatedIds = Array.from(new Set([...participantUserIds, creatorId].filter(Boolean))) as string[];
        triggerPushRules({
            eventType: "schedule_created",
            relatedUserIds: relatedIds,
            variables: { title: event.title || "새 일정" },
            url: "/schedule",
        }).catch(() => {});

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const { event, userId } = await request.json();
        const supabase = getSupabaseAdmin();

        const serverSupabase = await createServerClient();
        const { data: { user: authUser } } = await serverSupabase.auth.getUser();
        let actorProfile: { id: string; role: string | null; name: string | null } | null = null;
        if (authUser) {
            const { data: p } = await supabase
                .from("users")
                .select("id, role, name")
                .eq("id", authUser.id)
                .maybeSingle();
            actorProfile = p;
        }

        const { data: existingSchedule } = await supabase
            .from("schedules")
            .select("id, creator_id, user_id, title, start_time, end_time")
            .eq("id", event.id)
            .maybeSingle();

        const isAthleteOrParent =
            actorProfile?.role === "athlete" || actorProfile?.role === "parent";

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

        // 선수가 일정을 변경한 경우 담당 코치에게 푸시 알림 발송
        if (isAthleteOrParent) {
            const targetCoachId = updateData.creator_id || existingSchedule?.creator_id;
            if (targetCoachId) {
                const startDate = new Date(updateData.start_time);
                const kstStr = `${startDate.toLocaleDateString("ko-KR", {
                    timeZone: "Asia/Seoul",
                    month: "numeric",
                    day: "numeric",
                })} ${startDate.toLocaleTimeString("ko-KR", {
                    timeZone: "Asia/Seoul",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                })}`;
                const actorName = actorProfile?.name || "선수";
                sendPushNotification({
                    userIds: [targetCoachId],
                    title: "[일정 변경] 선수가 일정을 변경했습니다.",
                    body: `${actorName}님이 '${title}' 일정을 ${kstStr}로 변경했습니다.`,
                    url: "/schedule",
                }).catch(() => {});
            }
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const serverSupabase = await createServerClient();
        const { data: { user: authUser } } = await serverSupabase.auth.getUser();
        const supabase = getSupabaseAdmin();

        if (authUser) {
            const { data: authProfile } = await supabase
                .from("users")
                .select("role")
                .eq("id", authUser.id)
                .maybeSingle();
            if (authProfile?.role === "athlete" || authProfile?.role === "parent") {
                return NextResponse.json(
                    { error: "선수 및 학부모는 예약을 삭제할 수 없습니다." },
                    { status: 403 }
                );
            }
        }

        const { id } = await request.json();
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
        const athleteName = searchParams.get('athleteName');

        const supabase = getSupabaseAdmin();

        // Compute athlete's monthly analysis reservation count if athleteName and date are provided
        let athleteAnalysisMonthlyCount = 0;
        if (athleteName && date) {
            const { data: athUser } = await supabase
                .from('users')
                .select('id')
                .eq('name', athleteName)
                .eq('role', 'athlete')
                .limit(1)
                .maybeSingle();

            if (athUser?.id) {
                athleteAnalysisMonthlyCount = await getAthleteMonthlyAnalysisCount(
                    supabase,
                    athUser.id,
                    date,
                    excludeId
                );
            }
        }

        if (!coachName || !date) {
            return NextResponse.json({ occupiedSlots: [], athleteAnalysisMonthlyCount });
        }

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

        // Resolve coach custom slot configuration if any
        let resolvedSlots: { key: string; label: string; start: string; end: string }[] | null = null;
        let slotDurationMs = 60 * 60 * 1000;
        try {
            const { data: cfgData } = await supabase.storage
                .from('records')
                .download('settings/coach_slot_configs.json');
            if (cfgData) {
                const cfgText = await cfgData.text();
                const configs = JSON.parse(cfgText || '[]');
                const matched = resolveCoachSlotConfig(configs, coachName, date);
                if (matched) {
                    resolvedSlots = generateSlotsFromConfig(matched);
                    slotDurationMs = (matched.durationMinutes || 60) * 60 * 1000;
                }
            }
        } catch (cfgErr) {
            console.error('Error reading slot configs:', cfgErr);
        }

        const baseSlots = resolvedSlots && resolvedSlots.length > 0 ? resolvedSlots : COACH_DEFAULT_SLOTS;
        const slotDefinitions = baseSlots.map(s => ({
            key: s.key,
            start: new Date(`${date}T${s.start}:00+09:00`).getTime(),
            end: new Date(`${date}T${s.end}:00+09:00`).getTime(),
        }));

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
                const [y, m, d] = date.split('-').map(Number);
                const targetDayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay();

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
                        b.slots.forEach((bs: string) => {
                            // Exact match
                            if (!occupiedSlots.includes(bs)) occupiedSlots.push(bs);
                            // Also check range overlap in case blockout uses different slot granularity
                            const bsStart = new Date(`${date}T${bs}:00+09:00`).getTime();
                            const bsEnd = bsStart + slotDurationMs;
                            if (!isNaN(bsStart)) {
                                slotDefinitions.forEach(slot => {
                                    if (slot.start < bsEnd && slot.end > bsStart) {
                                        if (!occupiedSlots.includes(slot.key)) occupiedSlots.push(slot.key);
                                    }
                                });
                            }
                        });
                    }
                });
            }
        } catch (bErr) {
            console.error('Error checking blockouts in schedule get:', bErr);
        }

        return NextResponse.json({ occupiedSlots, resolvedSlots, athleteAnalysisMonthlyCount });
    } catch (err: any) {
        return NextResponse.json({ error: err.message, occupiedSlots: [] }, { status: 500 });
    }
}
