import { createClient } from "./supabase/client";
import { fetchCourseRecordBypassRLS } from "@/app/(main)/course-management/actions";

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
    putting: "퍼팅",
    physical: "피지컬",
    strategy: "코스공략",
    mental: "멘탈",
    etc: "기타",
};

export const COURSE_CAT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    all: { bg: "bg-zinc-50", text: "text-zinc-600", border: "border-zinc-100" },
    shot: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-100" },
    shortgame: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100" },
    putting: { bg: "bg-pink-50", text: "text-pink-600", border: "border-pink-100" },
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
            playerName: (r.user as any)?.name || "전체",
            coachName: (r.coach as any)?.name || "알 수 없음"
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
            .eq("id", id.trim())
            .single();

        if (error) {
            console.warn(`fetchCourseRecordById RLS Blocked (ID: ${id}), attempting fallback...`);
            
            // Fallback: If it's an RLS issue (0 rows for athletes), try fetching via server action
            try {
                const fallbackData = await fetchCourseRecordBypassRLS(id);
                if (fallbackData) {
                    return fallbackData;
                }
            } catch (fallbackErr) {
                console.error("Fallback fetch failed:", fallbackErr);
            }
            return null;
        }
        if (!data) return null;

        return {
            id: data.id,
            type: data.type,
            category: data.category || "shot",
            title: data.title || "",
            content: data.content || "",
            media_urls: data.media_urls || [],
            created_at: data.created_at,
            date: data.created_at.split("T")[0],
            playerName: (data.user as any)?.name || "전체",
            coachName: (data.coach as any)?.name || "알 수 없음"
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
                created_at: record.date ? `${record.date}T${new Date().toISOString().split('T')[1]}` : new Date().toISOString()
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

export async function updateCourseRecord(id: string, record: {
    playerName?: string;
    category?: string;
    title?: string;
    content?: string;
    media_urls?: string[];
    date?: string;
}) {
    try {
        const supabase = createClient();
        
        const updateData: any = {};
        if (record.category !== undefined) updateData.category = record.category;
        if (record.title !== undefined) updateData.title = record.title;
        if (record.content !== undefined) updateData.content = record.content;
        if (record.media_urls !== undefined) updateData.media_urls = record.media_urls;
        
        if (record.date) {
            updateData.created_at = `${record.date}T${new Date().toISOString().split('T')[1]}`;
        }
        
        if (record.playerName !== undefined) {
            if (record.playerName === "전체") {
                updateData.user_id = null;
            } else {
                const { data: userRes } = await supabase
                    .from("users")
                    .select("id")
                    .eq("name", record.playerName)
                    .maybeSingle();
                updateData.user_id = userRes?.id || null;
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
        console.error("Error updating course record:", err.message || err);
        throw err;
    }
}
