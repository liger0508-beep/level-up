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
    after_media_urls?: string[];
    is_corrected?: boolean;
    correction_content?: string;
    correction_media?: string[];
    created_at: string;
    playerName: string;
    coachName: string;
    coachId?: string;
    connected_lesson_id?: string;
}

export async function fetchRecentLessonsByPlayer(playerName: string, category?: string): Promise<LessonRecord[]> {
    try {
        const supabase = createClient();

        // 1. Get user_id by name
        const { data: userRes, error: userError } = await supabase
            .from("users")
            .select("id")
            .eq("name", playerName)
            .limit(1)
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
                is_corrected,
                correction_content,
                correction_media,
                created_at,
                coach_id,
                connected_lesson_id,
                users!records_user_id_fkey(name),
                coach:users!records_coach_id_fkey(name)
            `)
            .eq("user_id", userRes.id)
            .eq("type", "lesson")
            .order("inserted_at", { ascending: false });

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
            is_corrected: r.is_corrected,
            correction_content: r.correction_content,
            correction_media: r.correction_media,
            created_at: r.created_at,
            playerName: r.users?.name || "Unknown",
            coachName: r.coach?.name || "Unknown",
            coachId: r.coach_id,
            connected_lesson_id: r.connected_lesson_id
        }));
    } catch (err) {
        console.error("Error in fetchRecentLessonsByPlayer:", err);
        return [];
    }
}

export async function fetchLatestLessonsPerCategory(playerName: string): Promise<Record<string, LessonRecord>> {
    try {
        const allLessons = await fetchAllLessonsByPlayer(playerName);
        const result: Record<string, LessonRecord> = {};

        // allLessons are already sorted by inserted_at descending
        for (const lesson of allLessons) {
            if (!result[lesson.category]) {
                result[lesson.category] = lesson;
            }
        }

        return result;
    } catch (err) {
        console.error("Error in fetchLatestLessonsPerCategory:", err);
        return {};
    }
}

export async function fetchAllLessonsByPlayer(playerName: string, category?: string, limit?: number): Promise<LessonRecord[]> {
    try {
        const supabase = createClient();

        // 1. Get user_id by name
        const { data: userRes, error: userError } = await supabase
            .from("users")
            .select("id")
            .eq("name", playerName)
            .limit(1)
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
                is_corrected,
                correction_content,
                correction_media,
                created_at,
                coach_id,
                connected_lesson_id,
                users!records_user_id_fkey(name),
                coach:users!records_coach_id_fkey(name)
            `)
            .eq("user_id", userRes.id)
            .eq("type", "lesson")
            .order("inserted_at", { ascending: false });

        if (category && category !== "all") {
            query = query.eq("category", category);
        }

        if (limit) query = query.limit(limit);

        const { data, error } = await query;

        if (error || !data) return [];

        let finalData = [...data];

        // Fetch missing parents if any
        const parentIdsToFetch = new Set<string>();
        finalData.forEach((item: any) => {
            if (item.connected_lesson_id) {
                const parentExists = finalData.some((l: any) => l.id === item.connected_lesson_id);
                if (!parentExists) {
                    parentIdsToFetch.add(item.connected_lesson_id);
                }
            }
        });

        if (parentIdsToFetch.size > 0) {
            const { data: parentData } = await supabase
                .from("records")
                .select(`
                    id,
                    type,
                    category,
                    title,
                    content,
                    media_urls,
                    is_corrected,
                    correction_content,
                    correction_media,
                    created_at,
                    coach_id,
                    connected_lesson_id,
                    users!records_user_id_fkey(name),
                    coach:users!records_coach_id_fkey(name)
                `)
                .in("id", Array.from(parentIdsToFetch));

            if (parentData) {
                finalData = [...finalData, ...parentData];
            }
        }

        return finalData.map((r: any) => ({
            id: r.id,
            type: r.type,
            category: r.category as LessonType,
            title: r.title || "",
            content: r.content || "",
            media_urls: r.media_urls || [],
            is_corrected: r.is_corrected,
            correction_content: r.correction_content,
            correction_media: r.correction_media,
            created_at: r.created_at,
            playerName: r.users?.name || "Unknown",
            coachName: r.coach?.name || "Unknown",
            coachId: r.coach_id,
            connected_lesson_id: r.connected_lesson_id
        }));
    } catch (err) {
        console.error("Error in fetchAllLessonsByPlayer:", err);
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
            .limit(1)
            .maybeSingle();

        if (userError || !userRes) return null;

        // 2. Fetch recent scorecard (assuming 'rounds' table exists or 'records' with type 'scorecard')
        // For now, let's check 'records' with type 'scorecard'
        const { data, error } = await supabase
            .from("records")
            .select("*")
            .eq("user_id", userRes.id)
            .eq("type", "scorecard")
            .order("inserted_at", { ascending: false })
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
    after_media_urls?: string[];
    date: string;
    startTime?: string;
    endTime?: string;
    connectedLessonId?: string | null;
}) {
    try {
        const supabase = createClient();
        console.log("DEBUG saveLessonRecord:", { playerName: record.playerName, coachName: record.coachName });

        // 1. Resolve user IDs
        const [userRes, coachRes] = await Promise.all([
            supabase.from("users").select("id").eq("name", record.playerName).limit(1).maybeSingle(),
            supabase.from("users").select("id").eq("name", record.coachName).limit(1).maybeSingle()
        ]);

        if (userRes.error || !userRes.data) throw new Error("Player not found: " + record.playerName);

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
                media_urls: [...(record.media_urls || []), ...(record.after_media_urls || [])],
                is_corrected: false,
                created_at: createdAt,
                connected_lesson_id: record.connectedLessonId || null
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
    after_media_urls: string[];
    is_corrected: boolean;
    correction_content: string;
    correction_media: string[];
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
        if (record.after_media_urls !== undefined) updateData.after_media_urls = record.after_media_urls;
        if (record.is_corrected !== undefined) updateData.is_corrected = record.is_corrected;
        if (record.correction_content !== undefined) updateData.correction_content = record.correction_content;
        if (record.correction_media !== undefined) updateData.correction_media = record.correction_media;
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


export async function fetchLessonsByIds(ids: string[]): Promise<LessonRecord[]> {
    if (!ids || ids.length === 0) return [];
    try {
        const supabase = createClient();
        const { data, error } = await supabase
            .from("records")
            .select(`
                id,
                type,
                category,
                title,
                content,
                media_urls,
                is_corrected,
                correction_content,
                correction_media,
                created_at,
                coach_id,
                connected_lesson_id,
                users!records_user_id_fkey(name),
                coach:users!records_coach_id_fkey(name)
            `)
            .in('id', ids);

        if (error) {
            console.error(error);
            return [];
        }

        return (data || []).map((r: any) => ({
            id: r.id,
            type: r.type,
            category: r.category as LessonType,
            title: r.title || "",
            content: r.content || "",
            media_urls: r.media_urls || [],
            is_corrected: r.is_corrected,
            correction_content: r.correction_content,
            correction_media: r.correction_media,
            created_at: r.created_at,
            playerName: r.users?.name || "Unknown",
            coachName: r.coach?.name || "Unknown",
            coachId: r.coach_id,
            connected_lesson_id: r.connected_lesson_id
        }));
    } catch (e) {
        console.error("fetchLessonsByIds Error:", e);
        return [];
    }
}