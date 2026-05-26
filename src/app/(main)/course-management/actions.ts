"use server";

import { createClient } from "@supabase/supabase-js";

export async function fetchCourseRecordBypassRLS(id: string) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        
        if (!supabaseUrl || !supabaseKey) {
            console.error("Missing Supabase env vars");
            return null;
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

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
            console.error("Bypass RLS error:", error);
            return null;
        }

        if (data) {
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
        }
        return null;
    } catch (err) {
        console.error("Server Action fetchCourseRecordBypassRLS error:", err);
        return null;
    }
}
