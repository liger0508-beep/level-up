import { createClient } from "./supabase/client";
import { LessonType } from "@/components/lesson/LessonCard";
import { formatLocalDate } from "./utils";

export interface LessonRecord {
    id: string;
    type: string; // "lesson"
    category: LessonType;
    title: string;
    content: string;
    media_urls?: string[];
    created_at: string;
    playerName: string;
    coachName: string;
}

export async function fetchRecentLessonsByPlayer(playerName: string, category?: string): Promise<LessonRecord[]> {
    try {
        const supabase = createClient();
        
        // 1. Get user_id by name
        const { data: userRes, error: userError } = await supabase
            .from("users")
            .select("id")
            .eq("name", playerName)
            .maybeSingle();
            
        if (userError || !userRes) return [];
        
        // 2. Fetch lessons
        let query = supabase
            .from("records")
            .select(`
                id,
                type,
                category,
                title,
                content,
                media_urls,
                created_at,
                users!records_user_id_fkey(name),
                coach:users!records_coach_id_fkey(name)
            `)
            .eq("user_id", userRes.id)
            .eq("type", "lesson")
            .order("created_at", { ascending: false });
            
        if (category && category !== "all") {
            query = query.eq("category", category);
        }
        
        const { data, error } = await query.limit(5);
        
        if (error) return [];
        
        return (data || []).map((r: any) => ({
            id: r.id,
            type: r.type,
            category: r.category as LessonType,
            title: r.title || "",
            content: r.content || "",
            media_urls: r.media_urls || [],
            created_at: r.created_at,
            playerName: r.users?.name || "Unknown",
            coachName: r.coach?.name || "Unknown"
        }));
    } catch (err) {
        console.error("Error in fetchRecentLessonsByPlayer:", err);
        return [];
    }
}

export async function fetchRecentScorecard(playerName: string): Promise<any | null> {
    try {
        const supabase = createClient();
        
        // 1. Get user_id by name
        const { data: userRes, error: userError } = await supabase
            .from("users")
            .select("id")
            .eq("name", playerName)
            .maybeSingle();
            
        if (userError || !userRes) return null;
        
        // 2. Fetch recent scorecard (assuming 'rounds' table exists or 'records' with type 'scorecard')
        // For now, let's check 'records' with type 'scorecard'
        const { data, error } = await supabase
            .from("records")
            .select("*")
            .eq("user_id", userRes.id)
            .eq("type", "scorecard")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
            
        if (error || !data) return null;
        
        return data;
    } catch (err) {
        return null;
    }
}

export async function saveLessonRecord(record: {
    playerName: string;
    coachName: string;
    category: LessonType;
    title: string;
    content: string;
    media_urls?: string[];
    date: string;
    startTime?: string;
    endTime?: string;
}) {
    try {
        const supabase = createClient();
        
        // 1. Resolve user IDs
        const [userRes, coachRes] = await Promise.all([
            supabase.from("users").select("id").eq("name", record.playerName).maybeSingle(),
            supabase.from("users").select("id").eq("name", record.coachName).maybeSingle()
        ]);
        
        if (userRes.error || !userRes.data) throw new Error("Player not found");
        
        // 2. Create timestamp
        let createdAt = new Date().toISOString();
        if (record.date && record.startTime) {
            createdAt = new Date(`${record.date}T${record.startTime}:00`).toISOString();
        }
        
        // 3. Insert
        const { data, error } = await supabase
            .from("records")
            .insert({
                user_id: userRes.data.id,
                coach_id: coachRes.data?.id || null,
                type: "lesson",
                category: record.category,
                title: record.title,
                content: record.content,
                media_urls: record.media_urls || [],
                created_at: createdAt
            })
            .select()
            .single();
            
        if (error) throw error;
        return data;
    } catch (err: any) {
        console.error("Error in saveLessonRecord FULL DETAILS:", {
            message: err.message,
            details: err.details,
            hint: err.hint,
            code: err.code
        });
        throw err;
    }
}

export async function updateLessonRecord(id: string, record: Partial<{
    playerName: string;
    category: LessonType;
    title: string;
    content: string;
    media_urls: string[];
    date: string;
    time: string;
}>) {
    try {
        const supabase = createClient();
        let updateData: any = {};
        if (record.category) updateData.category = record.category;
        if (record.title) updateData.title = record.title;
        if (record.content) updateData.content = record.content;
        if (record.media_urls) updateData.media_urls = record.media_urls;
        if (record.date) {
            const timePart = record.time || "12:00";
            updateData.created_at = new Date(`${record.date}T${timePart}:00`).toISOString();
        }

        if (record.playerName) {
            const { data: userRes, error } = await supabase.from("users").select("id").eq("name", record.playerName).maybeSingle();
            if (!error && userRes) {
                updateData.user_id = userRes.id;
            }
        }

        const { data, error } = await supabase
            .from("records")
            .update(updateData)
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (err: any) {
        console.error("Error in updateLessonRecord:", err);
        throw err;
    }
}
