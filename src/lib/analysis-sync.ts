import { createClient } from "./supabase/client";

export interface AnalysisComment {
    id: string;
    author: string;
    role: string;
    time: string;
    text: string;
    fileUrl?: string;
    fileType?: string;
    userId: string;
}

export function parseMediaUrls(raw: any): string[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
        } catch {
            const cleaned = raw.replace(/^\{/, '').replace(/\}$/, '');
            if (!cleaned) return [];
            return cleaned.split(',').map(s => s.replace(/^"|"$/g, '').replace(/\\"/g, '"').trim()).filter(Boolean);
        }
    }
    return [];
}

export async function fetchComments(recordId: string): Promise<AnalysisComment[]> {
    try {
        const supabase = createClient();
        const { data, error } = await supabase
            .from("comments")
            .select(`
                id,
                content,
                media_url,
                media_type,
                created_at,
                user_id,
                user:users!comments_user_id_fkey(name, role)
            `)
            .eq("record_id", recordId.trim())
            .order("created_at", { ascending: true });

        if (error) {
            console.warn("Failed to fetch comments:", error);
            return [];
        }

        return (data || []).map((c: any) => ({
            id: c.id,
            author: c.user?.name || "알수없음",
            role: c.user?.role || "user",
            time: formatCommentTime(c.created_at),
            text: c.content || "",
            fileUrl: c.media_url,
            fileType: c.media_type,
            userId: c.user_id
        }));
    } catch (err) {
        console.error("Error in fetchComments:", err);
        return [];
    }
}

export async function saveComment(comment: {
    recordId: string;
    userId: string;
    content: string;
    mediaUrl?: string;
    mediaType?: string;
}) {
    try {
        const supabase = createClient();
        const { data, error } = await supabase
            .from("comments")
            .insert({
                record_id: comment.recordId,
                user_id: comment.userId,
                content: comment.content,
                media_url: comment.mediaUrl,
                media_type: comment.mediaType
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (err) {
        console.error("Error in saveComment:", err);
        throw err;
    }
}

export async function updateComment(id: string, content: string) {
    try {
        const supabase = createClient();
        const { error } = await supabase
            .from("comments")
            .update({ content })
            .eq("id", id);
        if (error) throw error;
    } catch (err) {
        console.error("Error in updateComment:", err);
        throw err;
    }
}

export async function deleteComment(id: string) {
    try {
        const supabase = createClient();
        const { error } = await supabase
            .from("comments")
            .delete()
            .eq("id", id);
        if (error) throw error;
    } catch (err) {
        console.error("Error in deleteComment:", err);
        throw err;
    }
}

function formatCommentTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "방금 전";
    if (minutes < 60) return `${minutes}분 전`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}시간 전`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}일 전`;

    return date.toISOString().split("T")[0];
}
