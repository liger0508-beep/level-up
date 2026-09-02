import { createClient } from "./supabase/client";

export type PlanType = "all" | "good" | "miss" | "field";

export interface Plan {
    id: string;
    type: PlanType;
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
    linkedLessonIds?: string[];
    parts?: string[];
    createdAt?: string;
}

export const PLAN_TYPE_LABELS: Record<PlanType, string> = {
    all: "전체",
    good: "굿샷",
    miss: "미스샷",
    field: "필드 노트",
};

export const PLAN_TYPE_COLORS: Record<PlanType, { bg: string; text: string; border: string; accent: string }> = {
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

export function calculateShotRatio(plans: Plan[]) {
    const good = plans.filter((j) => j.type === "good").length;
    const miss = plans.filter((j) => j.type === "miss").length;
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

export async function fetchPlansByAthlete(athleteName: string, limit?: number): Promise<Plan[]> {
    try {
        const supabase = createClient();
        let query = supabase
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
                inserted_at,
                user:users!records_user_id_fkey!inner(name),
                coach:users!records_coach_id_fkey(name)
            `)
            .eq("type", "plan")
            .eq("user.name", athleteName)
            .order("training_start", { ascending: false })
            .order("inserted_at", { ascending: false });

        if (limit) query = query.limit(limit);

        const { data, error } = await query;
        if (error) throw error;

        const parsedPlans = (data || []).map((item: any) => ({
            id: item.id,
            type: (item.category as PlanType) || "good",
            title: item.title,
            content: item.content,
            date: item.training_start,
            author: (Array.isArray(item.coach) ? (item.coach as any)[0]?.name : (item.coach as any)?.name) || "알 수 없음",
            athleteName: (Array.isArray(item.user) ? (item.user as any)[0]?.name : (item.user as any)?.name) || "알 수 없음",
            isImportant: item.is_important || false,
            keywords: item.keywords || [],
            media_urls: item.media_urls || [],
            linkedLessonIds: (item.keywords || []).filter((k: string) => k.startsWith("lesson_id:")).map((k: string) => k.replace("lesson_id:", "")),
            parts: (item.keywords || []).filter((k: string) => k.startsWith("part:")).map((k: string) => k.replace("part:", "")),
            createdAt: item.inserted_at,
        }));

        const fieldPlans = parsedPlans.filter(j => j.type === 'field');
        if (fieldPlans.length > 0) {
            const { data: users } = await supabase.from("users").select("id").eq("name", athleteName).limit(1).single();
            if (users) {
                const { data: scorecards } = await supabase
                    .from("scorecards")
                    .select("total_score, course_name, round_date, hole_count")
                    .eq("athlete_id", users.id)
                    .order("round_date", { ascending: false });

                if (scorecards) {
                    fieldPlans.forEach(j => {
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

        return parsedPlans;
    } catch (err: any) {
        console.error("Error fetching plans by athlete:", err?.message || err);
        return [];
    }
}

export async function fetchPlans(): Promise<Plan[]> {
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
                inserted_at,
                user:users!records_user_id_fkey(name),
                coach:users!records_coach_id_fkey(name)
            `)
            .eq("type", "plan")
            .order("training_start", { ascending: false })
            .order("inserted_at", { ascending: false });

        if (error) {
            console.error("Supabase error in fetchPlans:", error.message, error.details);
            throw error;
        }

        const parsedPlans = (data || []).map((item: any) => ({
            id: item.id,
            type: (item.category as PlanType) || "good",
            title: item.title,
            content: item.content,
            date: item.training_start,
            author: (Array.isArray(item.coach) ? (item.coach as any)[0]?.name : (item.coach as any)?.name) || "알 수 없음",
            athleteName: (Array.isArray(item.user) ? (item.user as any)[0]?.name : (item.user as any)?.name) || "알 수 없음",
            isImportant: item.is_important || false,
            keywords: item.keywords || [],
            media_urls: item.media_urls || [],
            linkedLessonIds: (item.keywords || []).filter((k: string) => k.startsWith("lesson_id:")).map((k: string) => k.replace("lesson_id:", "")),
            parts: (item.keywords || []).filter((k: string) => k.startsWith("part:")).map((k: string) => k.replace("part:", "")),
            createdAt: item.inserted_at,
        }));

        const fieldPlans = parsedPlans.filter(j => j.type === 'field');
        if (fieldPlans.length > 0) {
            const athleteNames = [...new Set(fieldPlans.map(j => j.athleteName))];
            const { data: users } = await supabase.from("users").select("id, name").in("name", athleteNames);
            const userMap = users?.reduce((acc: any, u: any) => { acc[u.name] = u.id; return acc; }, {});

            if (userMap && Object.keys(userMap).length > 0) {
                const { data: scorecards } = await supabase
                    .from("scorecards")
                    .select("total_score, course_name, round_date, athlete_id, hole_count")
                    .in("athlete_id", Object.values(userMap))
                    .order("round_date", { ascending: false });

                if (scorecards) {
                    fieldPlans.forEach(j => {
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

        return parsedPlans;
    } catch (err: any) {
        console.error("Error fetching plans:", err?.message || err);
        return [];
    }
}

export async function fetchPlanById(id: string): Promise<Plan | null> {
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
                inserted_at,
                user:users!records_user_id_fkey(name),
                coach:users!records_coach_id_fkey(name)
            `)
            .eq("id", id)
            .single();

        if (error) {
            console.error("Supabase error in fetchPlanById:", error.message, error.details);
            throw error;
        }

        return {
            id: data.id,
            type: (data.category as PlanType) || "good",
            title: data.title,
            content: data.content,
            date: data.training_start,
            author: (Array.isArray(data.coach) ? (data.coach as any)[0]?.name : (data.coach as any)?.name) || "알 수 없음",
            athleteName: (Array.isArray(data.user) ? (data.user as any)[0]?.name : (data.user as any)?.name) || "알 수 없음",
            isImportant: data.is_important || false,
            keywords: data.keywords || [],
            media_urls: data.media_urls || [],
            linkedLessonIds: (data.keywords || []).filter((k: string) => k.startsWith("lesson_id:")).map((k: string) => k.replace("lesson_id:", "")),
            parts: (data.keywords || []).filter((k: string) => k.startsWith("part:")).map((k: string) => k.replace("part:", "")),
            createdAt: data.inserted_at,
        };
    } catch (err: any) {
        console.error("Error fetching plan by id:", err?.message || err);
        return null;
    }
}

export async function savePlan(plan: Omit<Plan, "id" | "author" | "athleteName"> & { userId: string, coachId: string }) {
    try {
        const supabase = createClient();
        const finalKeywords = [...(plan.keywords || [])];
        if (plan.linkedLessonIds) {
            plan.linkedLessonIds.forEach(id => finalKeywords.push(`lesson_id:${id}`));
        }
        if (plan.parts) {
            plan.parts.forEach(part => finalKeywords.push(`part:${part}`));
        }

        const { data, error } = await supabase
            .from("records")
            .insert({
                type: "plan",
                category: plan.type,
                title: plan.title,
                content: plan.content,
                training_start: plan.date,
                user_id: plan.userId,
                coach_id: plan.coachId,
                is_important: plan.isImportant,
                keywords: finalKeywords,
                media_urls: plan.media_urls,
            })
            .select()
            .single();

        if (error) {
            console.error("Supabase error in savePlan:", error.message, error.details);
            throw error;
        }
        return data;
    } catch (err: any) {
        console.error("Error saving plan:", err?.message || err);
        throw err;
    }
}

export async function updatePlan(id: string, plan: Partial<Plan>) {
    try {
        const supabase = createClient();
        const updateData: any = {};
        if (plan.type) updateData.category = plan.type;
        if (plan.title) updateData.title = plan.title;
        if (plan.content) updateData.content = plan.content;
        if (plan.date) updateData.training_start = plan.date;
        if (plan.isImportant !== undefined) updateData.is_important = plan.isImportant;
        let finalKeywords = plan.keywords ? [...plan.keywords] : undefined;
        if (plan.linkedLessonIds) {
            finalKeywords = finalKeywords || [];
            plan.linkedLessonIds.forEach(id => finalKeywords!.push(`lesson_id:${id}`));
        }
        if (plan.parts) {
            finalKeywords = finalKeywords || [];
            plan.parts.forEach(part => finalKeywords!.push(`part:${part}`));
        }
        if (finalKeywords !== undefined) updateData.keywords = finalKeywords;

        if (plan.media_urls) updateData.media_urls = plan.media_urls;

        const { data, error } = await supabase
            .from("records")
            .update(updateData)
            .eq("id", id)
            .select()
            .single();

        if (error) {
            console.error("Supabase error in updatePlan:", error.message, error.details);
            throw error;
        }
        return data;
    } catch (err: any) {
        console.error("Error updating plan:", err?.message || err);
        throw err;
    }
}

export async function deletePlan(id: string) {
    try {
        const supabase = createClient();
        const { error } = await supabase
            .from("records")
            .delete()
            .eq("id", id);

        if (error) {
            console.error("Supabase error in deletePlan:", error.message, error.details);
            throw error;
        }
    } catch (err: any) {
        console.error("Error deleting plan:", err?.message || err);
        throw err;
    }
}