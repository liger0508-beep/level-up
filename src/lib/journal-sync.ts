import { createClient } from "./supabase/client";

export type JournalType = "all" | "good" | "miss" | "field";

export interface Journal {
    id: string;
    type: JournalType;
    title: string;
    content: string;
    date: string;
    author: string;
    athleteName: string;
    isImportant: boolean;
    keywords?: string[];
    media_urls?: string[];
    fieldScore?: number;
    fieldCourse?: string;
    fieldHoleCount?: number;
}

export const JOURNAL_TYPE_LABELS: Record<JournalType, string> = {
    all: "전체",
    good: "굿샷",
    miss: "미스샷",
    field: "필드 노트",
};

export const JOURNAL_TYPE_COLORS: Record<JournalType, { bg: string; text: string; border: string; accent: string }> = {
    all: { bg: "bg-zinc-100", text: "text-zinc-600", border: "border-zinc-200", accent: "bg-zinc-400" },
    good: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-100", accent: "bg-blue-500" },
    miss: { bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-100", accent: "bg-orange-400" },
    field: { bg: "bg-indigo-50", text: "text-indigo-600", border: "border-indigo-100", accent: "bg-indigo-500" },
};

export function getPlainText(html: string) {
    if (typeof window === "undefined") return html;
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
}

export function calculateShotRatio(journals: Journal[]) {
    const good = journals.filter((j) => j.type === "good").length;
    const miss = journals.filter((j) => j.type === "miss").length;
    const total = good + miss;
    
    if (total === 0) return { good: 0, miss: 0, total: 0, goodPct: 0, missPct: 0 };
    
    const goodPct = Math.round((good / total) * 100);
    const missPct = 100 - goodPct;

    return {
        good,
        miss,
        total,
        goodPct,
        missPct,
    };
}

// ── Database Operations ──────────────────────────────────────────

export async function fetchJournalsByAthlete(athleteName: string): Promise<Journal[]> {
    try {
        const supabase = createClient();
        const { data, error } = await supabase
            .from("records")
            .select(`
                id,
                title,
                content,
                category,
                media_urls,
                training_start,
                is_important,
                keywords,
                user:users!records_user_id_fkey(name),
                coach:users!records_coach_id_fkey(name)
            `)
            .eq("type", "journal")
            .eq("users.name", athleteName)
            .order("training_start", { ascending: false });

        if (error) throw error;

        const parsedJournals = (data || []).map((item: any) => ({
            id: item.id,
            type: (item.category as JournalType) || "good",
            title: item.title,
            content: item.content,
            date: item.training_start,
            author: (Array.isArray(item.coach) ? (item.coach as any)[0]?.name : (item.coach as any)?.name) || "알 수 없음",
            athleteName: (Array.isArray(item.user) ? (item.user as any)[0]?.name : (item.user as any)?.name) || "알 수 없음",
            isImportant: item.is_important || false,
            keywords: item.keywords || [],
            media_urls: item.media_urls || [],
        }));

        const fieldJournals = parsedJournals.filter(j => j.type === 'field');
        if (fieldJournals.length > 0) {
            const { data: users } = await supabase.from("users").select("id").eq("name", athleteName).limit(1).single();
            if (users) {
                const { data: scorecards } = await supabase
                    .from("scorecards")
                    .select("total_score, course_name, round_date, hole_count")
                    .eq("athlete_id", users.id)
                    .order("round_date", { ascending: false });

                if (scorecards) {
                    fieldJournals.forEach(j => {
                        const sc = scorecards.find(s => s.round_date <= j.date);
                        if (sc) {
                            (j as any).fieldScore = sc.total_score;
                            (j as any).fieldCourse = sc.course_name;
                            (j as any).fieldHoleCount = sc.hole_count;
                        }
                    });
                }
            }
        }

        return parsedJournals;
    } catch (err: any) {
        console.error("Error fetching journals by athlete:", err?.message || err);
        return [];
    }
}

export async function fetchJournals(): Promise<Journal[]> {
    try {
        const supabase = createClient();
        const { data, error } = await supabase
            .from("records")
            .select(`
                id,
                title,
                content,
                category,
                media_urls,
                training_start,
                is_important,
                keywords,
                user:users!records_user_id_fkey(name),
                coach:users!records_coach_id_fkey(name)
            `)
            .eq("type", "journal")
            .order("training_start", { ascending: false });

        if (error) {
            console.error("Supabase error in fetchJournals:", error.message, error.details);
            throw error;
        }

        const parsedJournals = (data || []).map((item: any) => ({
            id: item.id,
            type: (item.category as JournalType) || "good",
            title: item.title,
            content: item.content,
            date: item.training_start,
            author: (Array.isArray(item.coach) ? (item.coach as any)[0]?.name : (item.coach as any)?.name) || "알 수 없음",
            athleteName: (Array.isArray(item.user) ? (item.user as any)[0]?.name : (item.user as any)?.name) || "알 수 없음",
            isImportant: item.is_important || false,
            keywords: item.keywords || [],
            media_urls: item.media_urls || [],
        }));

        const fieldJournals = parsedJournals.filter(j => j.type === 'field');
        if (fieldJournals.length > 0) {
            const athleteNames = [...new Set(fieldJournals.map(j => j.athleteName))];
            const { data: users } = await supabase.from("users").select("id, name").in("name", athleteNames);
            const userMap = users?.reduce((acc: any, u: any) => { acc[u.name] = u.id; return acc; }, {});

            if (userMap && Object.keys(userMap).length > 0) {
                const { data: scorecards } = await supabase
                    .from("scorecards")
                    .select("total_score, course_name, round_date, athlete_id, hole_count")
                    .in("athlete_id", Object.values(userMap))
                    .order("round_date", { ascending: false });

                if (scorecards) {
                    fieldJournals.forEach(j => {
                        const userId = userMap[j.athleteName];
                        const sc = scorecards.find(s => s.athlete_id === userId && s.round_date <= j.date);
                        if (sc) {
                            (j as any).fieldScore = sc.total_score;
                            (j as any).fieldCourse = sc.course_name;
                            (j as any).fieldHoleCount = sc.hole_count;
                        }
                    });
                }
            }
        }

        return parsedJournals;
    } catch (err: any) {
        console.error("Error fetching journals:", err?.message || err);
        return [];
    }
}

export async function fetchJournalById(id: string): Promise<Journal | null> {
    try {
        const supabase = createClient();
        const { data, error } = await supabase
            .from("records")
            .select(`
                id,
                title,
                content,
                category,
                media_urls,
                training_start,
                is_important,
                keywords,
                user:users!records_user_id_fkey(name),
                coach:users!records_coach_id_fkey(name)
            `)
            .eq("id", id)
            .single();

        if (error) {
            console.error("Supabase error in fetchJournalById:", error.message, error.details);
            throw error;
        }

        return {
            id: data.id,
            type: (data.category as JournalType) || "good",
            title: data.title,
            content: data.content,
            date: data.training_start,
            author: (Array.isArray(data.coach) ? (data.coach as any)[0]?.name : (data.coach as any)?.name) || "알 수 없음",
            athleteName: (Array.isArray(data.user) ? (data.user as any)[0]?.name : (data.user as any)?.name) || "알 수 없음",
            isImportant: data.is_important || false,
            keywords: data.keywords || [],
            media_urls: data.media_urls || [],
        };
    } catch (err: any) {
        console.error("Error fetching journal by id:", err?.message || err);
        return null;
    }
}

export async function saveJournal(journal: Omit<Journal, "id" | "author" | "athleteName"> & { userId: string, coachId: string }) {
    try {
        const supabase = createClient();
        const { data, error } = await supabase
            .from("records")
            .insert({
                type: "journal",
                category: journal.type,
                title: journal.title,
                content: journal.content,
                training_start: journal.date,
                user_id: journal.userId,
                coach_id: journal.coachId,
                is_important: journal.isImportant,
                keywords: journal.keywords,
                media_urls: journal.media_urls,
            })
            .select()
            .single();

        if (error) {
            console.error("Supabase error in saveJournal:", error.message, error.details);
            throw error;
        }
        return data;
    } catch (err: any) {
        console.error("Error saving journal:", err?.message || err);
        throw err;
    }
}

export async function updateJournal(id: string, journal: Partial<Journal>) {
    try {
        const supabase = createClient();
        const updateData: any = {};
        if (journal.type) updateData.category = journal.type;
        if (journal.title) updateData.title = journal.title;
        if (journal.content) updateData.content = journal.content;
        if (journal.date) updateData.training_start = journal.date;
        if (journal.isImportant !== undefined) updateData.is_important = journal.isImportant;
        if (journal.keywords) updateData.keywords = journal.keywords;
        if (journal.media_urls) updateData.media_urls = journal.media_urls;

        const { data, error } = await supabase
            .from("records")
            .update(updateData)
            .eq("id", id)
            .select()
            .single();

        if (error) {
            console.error("Supabase error in updateJournal:", error.message, error.details);
            throw error;
        }
        return data;
    } catch (err: any) {
        console.error("Error updating journal:", err?.message || err);
        throw err;
    }
}

export async function deleteJournal(id: string) {
    try {
        const supabase = createClient();
        const { error } = await supabase
            .from("records")
            .delete()
            .eq("id", id);

        if (error) {
            console.error("Supabase error in deleteJournal:", error.message, error.details);
            throw error;
        }
    } catch (err: any) {
        console.error("Error deleting journal:", err?.message || err);
        throw err;
    }
}
