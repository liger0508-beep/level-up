import { createClient } from "./supabase/client";

export interface TrainingRecord {
    id: string;
    type: string; // Part: shot, pitch, bunker, approach, putt, physical, etc
    title: string;
    content: string;
    media_urls?: string[];
    created_at: string;
    date: string; // YYYY-MM-DD
    training_start?: string; // YYYY-MM-DD
    training_end?: string; // YYYY-MM-DD
    playerName: string;
    coachName: string;
    completion_logs?: string[];
    template_settings?: any[];
    total_count?: number;
    user_id?: string;
}

export async function fetchTrainingRecords(filters?: { playerName?: string, category?: string }): Promise<TrainingRecord[]> {
    try {
        const supabase = createClient();
        
        let query = supabase
            .from("records")
            .select(`
                id,
                user_id,
                type,
                category,
                title,
                content,
                media_urls,
                created_at,
                inserted_at,
                training_start,
                training_end,
                completion_logs,
                template_settings,
                total_count,
                users:users!records_user_id_fkey(name),
                coach:users!records_coach_id_fkey(name)
            `)
            .eq("type", "training")
            .order("inserted_at", { ascending: false });
            
        if (filters?.playerName) {
            query = query.eq("users.name", filters.playerName);
        }
        
        if (filters?.category && filters.category !== "all") {
            query = query.eq("category", filters.category);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        return (data || []).map((r: any) => {
            let mappedType = r.category;
            if (!["basic", "preview", "review", "lesson_review", "swing_pose"].includes(r.category)) {
                if (r.title?.includes("[예습]")) mappedType = "preview";
                else if (r.title?.includes("[복습]")) mappedType = "review";
                else mappedType = "basic";
            }
            return {
                id: r.id,
                type: mappedType,
                title: r.title,
                content: r.content,
                media_urls: r.media_urls,
                created_at: r.created_at,
                date: r.created_at.split("T")[0],
                training_start: r.training_start,
                training_end: r.training_end,
                completion_logs: r.completion_logs,
                template_settings: r.template_settings,
                total_count: r.total_count,
                playerName: r.users?.name || "알 수 없음",
                coachName: r.coach?.name || "알 수 없음",
                user_id: r.user_id
            };
        });
    } catch (error: any) {
        console.error("Error fetching training records:", error?.message || error);
        return [];
    }
}

export async function fetchRecentTrainingsByPlayer(playerName: string): Promise<TrainingRecord[]> {
    try {
        const supabase = createClient();
        
        const { data: userRes, error: userError } = await supabase
            .from("users")
            .select("id")
            .eq("name", playerName)
            .maybeSingle();
            
        if (userError || !userRes) return [];
        
        const { data, error } = await supabase
            .from("records")
            .select(`
                id,
                type,
                category,
                title,
                content,
                media_urls,
                created_at,
                inserted_at,
                training_start,
                training_end,
                total_count,
                completion_logs,
                template_settings,
                users!records_user_id_fkey(name),
                coach:users!records_coach_id_fkey(name)
            `)
            .eq("user_id", userRes.id)
            .eq("type", "training")
            .order("inserted_at", { ascending: false })
            .limit(3);
            
        if (error) throw error;
        
        return (data || []).map((r: any) => {
            let mappedType = r.category;
            if (!["basic", "preview", "review", "lesson_review", "swing_pose"].includes(r.category)) {
                if (r.title?.includes("[예습]")) mappedType = "preview";
                else if (r.title?.includes("[복습]")) mappedType = "review";
                else mappedType = "basic";
            }
            return {
                id: r.id,
                type: mappedType,
                title: r.title,
                content: r.content,
                media_urls: r.media_urls,
                created_at: r.created_at,
                date: r.created_at.split("T")[0],
                training_start: r.training_start,
                training_end: r.training_end,
                total_count: r.total_count,
                completion_logs: r.completion_logs,
                template_settings: r.template_settings,
                playerName: r.users?.name || "알 수 없음",
                coachName: r.coach?.name || "알 수 없음"
            };
        });
    } catch (error) {
        console.error("Error fetching recent trainings:", error);
        return [];
    }
}

export async function saveTrainingRecord(record: {
    playerName: string;
    category: string;
    title: string;
    content: string;
    media_urls?: string[];
    date?: string;
    startTime?: string;
    training_start?: string;
    training_end?: string;
    template_settings?: any[];
    total_count?: number;
    type?: string;
}) {
    try {
        const supabase = createClient();
        
        // 1. Get user_id by name
        const { data: userRes, error: userError } = await supabase
            .from("users")
            .select("id")
            .eq("name", record.playerName)
            .maybeSingle();
            
        if (userError || !userRes) throw new Error("선수를 찾을 수 없습니다.");
        
        // 2. Get current coach user_id (mocked or from auth)
        const { data: { user } } = await supabase.auth.getUser();
        const coachId = user?.id; // fallback to session user
        
        // 3. Insert record
        const { data, error } = await supabase
            .from("records")
            .insert({
                user_id: userRes.id,
                coach_id: coachId,
                type: record.type || "training",
                category: record.category,
                title: record.title,
                content: record.content,
                media_urls: record.media_urls || [],
                training_start: record.training_start,
                training_end: record.training_end,
                template_settings: record.template_settings || [],
                total_count: record.total_count || 0,
                created_at: record.date ? new Date(`${record.date}T${record.startTime || '12:00'}:00`).toISOString() : new Date().toISOString()
            })
            .select()
            .single();
            
        if (error) throw error;
        return { data, error: null };
    } catch (error: any) {
        console.error("Error saving training record:", error);
        return { data: null, error: error.message };
    }
}

export async function updateTrainingRecord(id: string, record: {
    playerName: string;
    category: string;
    title: string;
    content: string;
    media_urls?: string[];
    date?: string;
    startTime?: string;
    training_start?: string;
    training_end?: string;
    template_settings?: any[];
    total_count?: number;
}) {
    try {
        const supabase = createClient();
        
        // 1. Get user_id by name
        const { data: userRes, error: userError } = await supabase
            .from("users")
            .select("id")
            .eq("name", record.playerName)
            .maybeSingle();
            
        if (userError || !userRes) throw new Error("선수를 찾을 수 없습니다.");
        
        // 2. Update record
        const { data, error } = await supabase
            .from("records")
            .update({
                user_id: userRes.id,
                category: record.category,
                title: record.title,
                content: record.content,
                media_urls: record.media_urls || [],
                training_start: record.training_start,
                training_end: record.training_end,
                template_settings: record.template_settings || [],
                total_count: record.total_count || 0,
                created_at: record.date ? new Date(`${record.date}T${record.startTime || '12:00'}:00`).toISOString() : undefined
            })
            .eq("id", id)
            .select()
            .single();
            
        if (error) throw error;
        return { data, error: null };
    } catch (error: any) {
        console.error("Error updating training record:", error);
        return { data: null, error: error.message };
    }
}
