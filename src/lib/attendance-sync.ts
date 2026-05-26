import { createClient } from "./supabase/client";
import { format } from "date-fns";

export interface AttendanceRecord {
    id: string;
    athlete_id: string;
    athlete_name: string;
    branch: string;
    check_in_at: string;
    check_out_at?: string;
    date: string;
}

export async function fetchAttendance(date: string, branch: string = "all") {
    const supabase = createClient();
    let query = supabase
        .from("attendance")
        .select(`
            *,
            athlete:users!attendance_athlete_id_fkey(name, phone)
        `)
        .eq("date", date);

    if (branch !== "all") {
        query = query.eq("branch", branch);
    }

    const { data, error } = await query.order("check_in_at", { ascending: false });
    
    if (error) {
        console.error("Error fetching attendance:", error);
        return [];
    }

    return data.map(item => ({
        ...item,
        athlete_name: (item.athlete as any)?.name || "Unknown"
    }));
}

export async function checkInAthlete(athleteId: string, branch: string) {
    const supabase = createClient();
    const date = format(new Date(), "yyyy-MM-dd");
    const now = new Date().toISOString();

    // Check if already checked in today at this branch
    const { data: existing } = await supabase
        .from("attendance")
        .select("id")
        .eq("athlete_id", athleteId)
        .eq("date", date)
        .eq("branch", branch)
        .maybeSingle();

    if (existing) {
        return { success: false, message: "이미 출석 체크되었습니다." };
    }

    const { error } = await supabase
        .from("attendance")
        .insert({
            athlete_id: athleteId,
            branch,
            date,
            check_in_at: now
        });

    if (error) throw error;
    return { success: true };
}

export async function checkInByPhone(phone: string, branch: string) {
    const supabase = createClient();
    
    // Find athlete by phone
    const { data: athlete, error: userError } = await supabase
        .from("users")
        .select("id, name")
        .eq("phone", phone)
        .eq("role", "athlete")
        .maybeSingle();

    if (userError || !athlete) {
        return { success: false, message: "해당 번호의 선수를 찾을 수 없습니다." };
    }

    return await checkInAthlete(athlete.id, branch);
}

export async function fetchMonthlyAttendance(athleteId: string, year: number, month: number) {
    const supabase = createClient();
    const startDate = format(new Date(year, month - 1, 1), "yyyy-MM-dd");
    const endDate = format(new Date(year, month, 0), "yyyy-MM-dd");

    const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("athlete_id", athleteId)
        .gte("date", startDate)
        .lte("date", endDate);

    if (error) throw error;
    return data;
}

export async function deleteAttendance(id: string) {
    const supabase = createClient();
    const { error } = await supabase
        .from("attendance")
        .delete()
        .eq("id", id);
    if (error) throw error;
}

export async function fetchAthletesByLast4Phone(last4: string) {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("users")
        .select("id, name, phone")
        .eq("role", "athlete")
        .like("phone", `%${last4}`);
    
    if (error) throw error;
    return data;
}
