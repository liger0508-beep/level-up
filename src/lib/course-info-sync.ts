import { createClient } from "./supabase/client";

export type CourseInfoType = "course_info";

export interface CourseInfo {
    id: string;
    type: CourseInfoType;
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

export const COURSE_INFO_TYPE_LABELS: Record<CourseInfoType, string> = { "course_info": "코스 정보" };

export const COURSE_INFO_TYPE_COLORS: Record<CourseInfoType, { bg: string; text: string; border: string }> = { "course_info": { bg: "bg-indigo-50", text: "text-indigo-600", border: "border-indigo-100" } };

export const getPlainText = (html: string) => {
    if (!html) return "";
    return html
        .replace(/<[^>]*>?/gm, '') // Strip HTML tags
        .replace(/&nbsp;/g, ' ')   // Replace non-breaking spaces
        .replace(/\s+/g, ' ')      // Collapse whitespace
        .trim();
};

/**
 * Fetch all courseInfos from Supabase.
 */
export async function getCourseInfos(): Promise<CourseInfo[]> {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("notices")
        .select(`
            *,
            users!notices_author_id_fkey (name)
        `)
        .eq("type", "course_info").order("created_at", { ascending: false });

    if (error) {
        console.error("Error fetching courseInfos:", error);
        return [];
    }

    return (data || []).map(formatCourseInfoFromDb);
}

/**
 * Fetch a single courseInfo by ID.
 */
export async function getCourseInfoById(id: string): Promise<CourseInfo | null> {
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
        console.error("Error fetching courseInfo:", error);
        return null;
    }

    return formatCourseInfoFromDb(data);
}

/**
 * Save a new courseInfo.
 */
export async function saveCourseInfo(courseInfo: Omit<CourseInfo, "id" | "author">) {
    const supabase = createClient();
    
    const { error } = await supabase
        .from("notices")
        .insert({
            type: "course_info",
            branch: courseInfo.branch,
            title: courseInfo.title,
            content: courseInfo.content,
            date: courseInfo.date,
            author_id: courseInfo.authorId,
            is_important: courseInfo.isImportant,
            start_date: courseInfo.startDate,
            end_date: courseInfo.endDate,
        });

    if (error) {
        console.error("Error saving courseInfo:", error);
        throw error;
    }
}

/**
 * Update an existing courseInfo.
 */
export async function updateCourseInfo(id: string, courseInfo: Partial<CourseInfo>) {
    const supabase = createClient();
    
    const { error } = await supabase
        .from("notices")
        .update({
            type: "course_info",
            branch: courseInfo.branch,
            title: courseInfo.title,
            content: courseInfo.content,
            is_important: courseInfo.isImportant,
            start_date: courseInfo.startDate,
            end_date: courseInfo.endDate,
        })
        .eq("id", id);

    if (error) {
        console.error("Error updating courseInfo:", error);
        throw error;
    }
}

/**
 * Delete a courseInfo.
 */
export async function deleteCourseInfo(id: string) {
    const supabase = createClient();

    const { error } = await supabase
        .from("notices")
        .delete()
        .eq("id", id);

    if (error) {
        console.error("Error deleting courseInfo:", error);
        throw error;
    }
}

/**
 * Format database response to CourseInfo object.
 */
function formatCourseInfoFromDb(n: any): CourseInfo {
    return {
        id: n.id,
        type: n.type as CourseInfoType,
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
