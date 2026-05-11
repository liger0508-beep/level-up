import { createClient } from "./supabase/client";

export type NoticeType = "all" | "coach" | "athlete" | "parent";

export interface Notice {
    id: string;
    type: NoticeType;
    branch: string;
    title: string;
    content: string;
    date: string;
    author: string;
    authorId?: string;
    isImportant?: boolean;
    startDate?: string;
    endDate?: string;
}

export const NOTICE_TYPE_LABELS: Record<NoticeType, string> = {
    all: "전체",
    coach: "코치",
    athlete: "선수",
    parent: "학부모",
};

export const NOTICE_TYPE_COLORS: Record<NoticeType, { bg: string; text: string; border: string }> = {
    all: { bg: "bg-indigo-50", text: "text-indigo-600", border: "border-indigo-100" },
    coach: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-100" },
    athlete: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100" },
    parent: { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-100" },
};

export const getPlainText = (html: string) => {
    if (!html) return "";
    return html
        .replace(/<[^>]*>?/gm, '') // Strip HTML tags
        .replace(/&nbsp;/g, ' ')   // Replace non-breaking spaces
        .replace(/\s+/g, ' ')      // Collapse whitespace
        .trim();
};

/**
 * Fetch all notices from Supabase.
 */
export async function getNotices(): Promise<Notice[]> {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("notices")
        .select(`
            *,
            users!notices_author_id_fkey (name)
        `)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error fetching notices:", error);
        return [];
    }

    return (data || []).map(formatNoticeFromDb);
}

/**
 * Fetch a single notice by ID.
 */
export async function getNoticeById(id: string): Promise<Notice | null> {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("notices")
        .select(`
            *,
            users!notices_author_id_fkey (name)
        `)
        .eq("id", id)
        .single();

    if (error) {
        console.error("Error fetching notice:", error);
        return null;
    }

    return formatNoticeFromDb(data);
}

/**
 * Save a new notice.
 */
export async function saveNotice(notice: Omit<Notice, "id" | "author">) {
    const supabase = createClient();
    
    const { error } = await supabase
        .from("notices")
        .insert({
            type: notice.type,
            branch: notice.branch,
            title: notice.title,
            content: notice.content,
            date: notice.date,
            author_id: notice.authorId,
            is_important: notice.isImportant,
            start_date: notice.startDate,
            end_date: notice.endDate,
        });

    if (error) {
        console.error("Error saving notice:", error);
        throw error;
    }
}

/**
 * Update an existing notice.
 */
export async function updateNotice(id: string, notice: Partial<Notice>) {
    const supabase = createClient();
    
    const { error } = await supabase
        .from("notices")
        .update({
            type: notice.type,
            branch: notice.branch,
            title: notice.title,
            content: notice.content,
            is_important: notice.isImportant,
            start_date: notice.startDate,
            end_date: notice.endDate,
        })
        .eq("id", id);

    if (error) {
        console.error("Error updating notice:", error);
        throw error;
    }
}

/**
 * Delete a notice.
 */
export async function deleteNotice(id: string) {
    const supabase = createClient();

    const { error } = await supabase
        .from("notices")
        .delete()
        .eq("id", id);

    if (error) {
        console.error("Error deleting notice:", error);
        throw error;
    }
}

/**
 * Format database response to Notice object.
 */
function formatNoticeFromDb(n: any): Notice {
    return {
        id: n.id,
        type: n.type as NoticeType,
        branch: n.branch,
        title: n.title,
        content: n.content,
        date: n.date,
        author: n.users?.name || "알 수 없음",
        authorId: n.author_id,
        isImportant: n.is_important,
        startDate: n.start_date,
        endDate: n.end_date,
    };
}
