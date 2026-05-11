import { createClient } from "./supabase/client";
import { AnalysisData, AnalysisType } from "@/components/analysis/AnalysisCard";
import { formatLocalDate } from "./utils";

export interface AnalysisRecord extends AnalysisData {
    id: string;
    media_urls?: string[];
    comments?: AnalysisComment[];
}

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

export async function fetchAnalysisRecords(): Promise<AnalysisRecord[]> {
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
            .eq("type", "analysis")
            .order("created_at", { ascending: false })
            .order("id", { ascending: false });

        if (error) {
            console.warn("Failed to fetch analysis records from Supabase:", error);
            return [];
        }

        return (data || []).map((r: any) => {
            const createdAt = new Date(r.created_at);
            return {
                id: r.id,
                type: r.category as AnalysisType,
                title: r.title || `${r.category.toUpperCase()} 분석`,
                playerName: (r.user as any)?.name || "알수없음",
                coachName: (r.coach as any)?.name || "코치",
                comment: r.content || "",
                date: formatLocalDate(createdAt),
                time: createdAt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }),
                media_urls: parseMediaUrls(r.media_urls)
            };
        });
    } catch (err) {
        console.error("Error in fetchAnalysisRecords:", err);
        return [];
    }
}

export async function fetchAnalysisById(id: string): Promise<AnalysisRecord | null> {
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

        if (error || !data) {
            console.warn("Failed to fetch analysis record by ID:", error);
            return null;
        }

        const createdAt = new Date(data.created_at);
        return {
            id: data.id,
            type: data.category as AnalysisType,
            title: data.title || `${data.category?.toUpperCase() || 'ANALYSIS'} 분석`,
            playerName: (data.user as any)?.name || "알수없음",
            coachName: (data.coach as any)?.name || "코치",
            comment: data.content || "",
            date: formatLocalDate(createdAt),
            time: createdAt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }),
            media_urls: parseMediaUrls(data.media_urls)
        };
    } catch (err) {
        console.error("Error in fetchAnalysisById:", err);
        return null;
    }
}

export async function saveAnalysisRecord(record: {
    playerName: string;
    coachName: string;
    type: AnalysisType;
    title: string;
    content: string;
    media_urls?: string[];
    date: string;
    time?: string;
}) {
    try {
        const supabase = createClient();

        // 1. Resolve user ID and coach ID
        const { data: { session } } = await supabase.auth.getSession();
        const currentUserId = session?.user?.id;

        const [userRes, coachRes] = await Promise.all([
            supabase.from("users").select("id").eq("name", record.playerName).maybeSingle(),
            supabase.from("users").select("id").eq("name", record.coachName).maybeSingle()
        ]);

        if (userRes.error || !userRes.data) {
            throw new Error(`Player not found: ${record.playerName}`);
        }

        const userId = userRes.data.id;
        // Fallback to current session user if coach name doesn't match a user
        const coachId = coachRes.data?.id || currentUserId || null;

        console.log("Saving Analysis Record:", {
            playerName: record.playerName,
            userId,
            coachName: record.coachName,
            coachId,
            currentUserId
        });

        // 2. Insert record
        const { data, error } = await supabase
            .from("records")
            .insert({
                user_id: userId,
                coach_id: coachId,
                type: "analysis",
                category: record.type,
                title: record.title,
                content: record.content,
                media_urls: record.media_urls || [],
                created_at: new Date(`${record.date}T${record.time || '12:00'}:00`).toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error("Supabase Insert Error:", error);
            throw error;
        }
        return data;
    } catch (err: any) {
        console.error("Error in saveAnalysisRecord:", err);
        // Supabase errors are sometimes objects that don't stringify well
        if (err && typeof err === 'object') {
            try {
                console.error("Error details:", JSON.stringify(err, null, 2));
            } catch (jsonErr) {
                console.error("Error details (raw):", err);
            }
        }
        throw err;
    }
}

export async function updateAnalysisRecord(id: string, record: Partial<{
    playerName: string;
    type: AnalysisType;
    title: string;
    content: string;
    media_urls: string[];
    date: string;
    time: string;
}>) {
    try {
        const supabase = createClient();

        let updateData: any = {};
        if (record.type) updateData.category = record.type;
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
        console.error("Error in updateAnalysisRecord:", err);
        throw err;
    }
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
            .eq("record_id", recordId)
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
