import { createClient } from "./supabase/client";

export interface CourseManagementRecord {
    id: string;
    type: string; // "course_management"
    category: string; // e.g., "Field", "Strategy", "Mental"
    title: string;
    content: string;
    media_urls?: string[];
    created_at: string;
    date: string;
    playerName: string;
    coachName: string;
    authorId?: string;
}

export const COURSE_CAT_LABELS: Record<string, string> = {
    all: "전체",
    shot: "샷",
    shortgame: "숏게임",
    physical: "피지컬",
    strategy: "코스 공략",
    mental: "멘탈",
    etc: "기타",
};

export const COURSE_CAT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    all: { bg: "bg-zinc-50", text: "text-zinc-600", border: "border-zinc-100" },
    shot: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-100" },
    shortgame: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100" },
    physical: { bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-100" },
    strategy: { bg: "bg-indigo-50", text: "text-indigo-600", border: "border-indigo-100" },
    mental: { bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-100" },
    etc: { bg: "bg-zinc-100", text: "text-zinc-500", border: "border-zinc-200" },
};

export async function fetchCourseRecords(): Promise<CourseManagementRecord[]> {
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
                created_at,
                user:users!records_user_id_fkey(name),
                coach:users!records_coach_id_fkey(name)
            `)
            .eq("type", "course_management")
            .order("created_at", { ascending: false });

        if (error) throw error;

        return (data || []).map((r: any) => ({
            id: r.id,
            type: r.type,
            category: r.category || "shot",
            title: r.title || "",
            content: r.content || "",
            media_urls: r.media_urls || [],
            created_at: r.created_at,
            date: r.created_at.split("T")[0],
            playerName: r.user?.name || "전체",
            coachName: r.coach?.name || "알 수 없음"
        }));
    } catch (err) {
        console.error("Error fetching course records:", err);
        return [];
    }
}

export async function fetchCourseRecordById(id: string): Promise<CourseManagementRecord | null> {
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
                created_at,
                user:users!records_user_id_fkey(name),
                coach:users!records_coach_id_fkey(name)
            `)
            .eq("id", id)
            .single();

        if (error || !data) return null;

        return {
            id: data.id,
            type: data.type,
            category: data.category || "shot",
            title: data.title || "",
            content: data.content || "",
            media_urls: data.media_urls || [],
            created_at: data.created_at,
            date: data.created_at.split("T")[0],
            playerName: data.user?.name || "전체",
            coachName: data.coach?.name || "알 수 없음"
        };
    } catch (err) {
        console.error("Error fetching course record:", err);
        return null;
    }
}

export async function saveCourseRecord(record: {
    playerName: string;
    category: string;
    title: string;
    content: string;
    media_urls?: string[];
    date?: string;
}) {
    try {
        const supabase = createClient();
        
        // 1. Resolve user IDs
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Unauthorized");

        const { data: userRes } = await supabase
            .from("users")
            .select("id")
            .eq("name", record.playerName)
            .maybeSingle();

        const { data: coachRes } = await supabase
            .from("users")
            .select("id, name")
            .eq("id", user.id)
            .single();

        // 2. Insert
        const { data, error } = await supabase
            .from("records")
            .insert({
                user_id: userRes?.id || null, // null if "전체"
                coach_id: user.id,
                type: "course_management",
                category: record.category,
                title: record.title,
                content: record.content,
                media_urls: record.media_urls || [],
                created_at: record.date ? `${record.date}T12:00:00Z` : new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (err: any) {
        console.error("Error saving course record:", err.message || err);
        throw err;
    }
}

export async function deleteCourseRecord(id: string) {
    try {
        const supabase = createClient();
        const { error } = await supabase
            .from("records")
            .delete()
            .eq("id", id);
        if (error) throw error;
    } catch (err) {
        console.error("Error deleting course record:", err);
        throw err;
    }
}
