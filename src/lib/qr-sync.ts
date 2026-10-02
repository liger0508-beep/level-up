import { createClient } from "./supabase/client";

export type QrTargetType = "ALL" | "BRANCH" | "POLL_PARTICIPANTS" | "CUSTOM";

export interface QrEvent {
    id: string;
    title: string;
    date: string; // maps to start_date
    endDate?: string;
    endTime?: string;
    targetType: QrTargetType;
    targetData: any; // e.g. branch name, poll ID, or array of athlete IDs
    status: "ACTIVE" | "CLOSED";
    createdBy: string;
    createdAt?: string;
    authorName?: string;
}

export interface QrScanLog {
    id: string;
    eventId: string;
    athleteId: string;
    athleteName: string;
    scannedAt: string;
    status: string;
}

// Convert DB Poll to QrEvent
export function formatQrEventFromDb(dbPoll: any): QrEvent {
    // We map 'type' = 'qr_check'
    // 'description' = targetType
    // 'final_roster' = targetData
    // 'status' = ACTIVE / CLOSED
    return {
        id: dbPoll.id,
        title: dbPoll.title,
        date: dbPoll.start_date, // Use start_date for event date
        endDate: dbPoll.end_date,
        endTime: dbPoll.end_time,
        targetType: (dbPoll.description as QrTargetType) || "ALL",
        targetData: dbPoll.final_roster,
        status: dbPoll.status === "ongoing" ? "ACTIVE" : "CLOSED",
        createdBy: dbPoll.author_id,
        createdAt: dbPoll.created_at,
        authorName: dbPoll.users?.name || "운영자",
    };
}

export async function getQrEvents(limit?: number) {
    const supabase = createClient();
    let query = supabase
        .from("polls")
        .select(`*, users!polls_author_id_fkey (name)`)
        .eq("type", "qr_check")
        .order("created_at", { ascending: false });

    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw error;
    
    return (data || []).map(formatQrEventFromDb);
}

export async function createQrEvent(event: Omit<QrEvent, "id" | "createdAt" | "authorName">) {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("polls")
        .insert([{
            type: "qr_check",
            branch: "전체",
            status: event.status === "ACTIVE" ? "ongoing" : "closed",
            title: event.title,
            description: event.targetType,
            start_date: event.date,
            end_date: event.endDate || event.date,
            end_time: event.endTime || "23:59",
            author_id: event.createdBy,
            final_roster: event.targetData,
            total_participants: 0,
            options: [{ id: "attended", text: "출석", votes: 0 }] // Required for polls structure
        }])
        .select(`*, users!polls_author_id_fkey (name)`)
        .single();

    if (error) throw error;
    return formatQrEventFromDb(data);
}

export async function getQrScanLogs(eventId: string): Promise<QrScanLog[]> {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("poll_responses")
        .select(`
            id,
            user_id,
            created_at,
            users!poll_responses_user_id_fkey (name)
        `)
        .eq("poll_id", eventId)
        .order("created_at", { ascending: false });

    if (error) throw error;

    return (data || []).map((r: any) => ({
        id: r.id,
        eventId: eventId,
        athleteId: r.user_id,
        athleteName: r.users?.name || "알 수 없음",
        scannedAt: r.created_at,
        status: "SUCCESS"
    }));
}

export async function recordQrScan(eventId: string, athleteId: string) {
    const supabase = createClient();
    
    // Check if already scanned
    const { data: existing } = await supabase
        .from("poll_responses")
        .select("id")
        .eq("poll_id", eventId)
        .eq("user_id", athleteId)
        .single();
        
    if (existing) {
        return { success: true, message: "이미 출석 처리되었습니다." };
    }

    // 1. Get Event Details
    const { data: eventData, error: eventError } = await supabase
        .from("polls")
        .select("description, final_roster")
        .eq("id", eventId)
        .single();
        
    if (eventError || !eventData) {
        throw new Error("이벤트를 찾을 수 없습니다.");
    }
    
    // 2. Get Athlete Details
    const { data: athleteData, error: athleteError } = await supabase
        .from("users")
        .select("status, branch, name")
        .eq("id", athleteId)
        .single();
        
    if (athleteError || !athleteData) {
        throw new Error("선수 정보를 찾을 수 없습니다.");
    }
    
    // 3. Check Eligibility
    const targetType = eventData.description;
    const targetData = eventData.final_roster || {};
    
    const isExtraAthlete = (targetData.extraAthletes || []).some((a: any) => a.id === athleteId);
    let isEligible = false;
    
    if (isExtraAthlete) {
        isEligible = true;
    } else {
        // Only allow active ("등록") athletes
        if (athleteData.status === "등록") {
            if (targetType === "ALL") {
                isEligible = true;
            } else if (targetType === "BRANCH") {
                if (athleteData.branch === targetData.branch) isEligible = true;
            } else if (targetType === "POLL_PARTICIPANTS") {
                const isVoter = (targetData.voters || []).includes(athleteData.name);
                if (isVoter) isEligible = true;
            }
        }
    }
    
    if (!isEligible) {
        throw new Error("이 스마트 패스의 대상자가 아니거나 비활성 계정입니다.");
    }

    const { error } = await supabase
        .from("poll_responses")
        .insert([{
            poll_id: eventId,
            user_id: athleteId,
            option_id: "attended"
        }]);

    if (error) throw error;
    return { success: true, message: "출석 완료" };
}
