import { createClient } from "./supabase/client";
import { formatLocalDate } from "./utils";

export type ConsultationType = "all" | "assigned";

export interface Consultation {
    id: string;
    date: string;
    coachName: string;
    title: string;
    content: string;
    author: string;
    type: ConsultationType;
    athleteName: string;
    userId: string | null;
    isImportant: boolean;
    createdAt?: string;
}

export const CONSULTATION_TYPE_LABELS: Record<ConsultationType, string> = {
    all: "전체",
    assigned: "담임 선수",
};

export const CONSULTATION_TYPE_COLORS: Record<ConsultationType, { bg: string; text: string; border: string; side: string }> = {
    all: { bg: "bg-indigo-50", text: "text-indigo-600", border: "border-indigo-100", side: "border-l-indigo-400" },
    assigned: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100", side: "border-l-emerald-400" },
};

function mapFromDB(data: any): Consultation {
    return {
        id: data.id,
        date: data.date,
        coachName: data.coach_name || "",
        title: data.title || "",
        content: data.content || "",
        author: data.author || "",
        type: data.type as ConsultationType,
        athleteName: data.athlete_name || "",
        userId: data.user_id || null,
        isImportant: data.is_important || false,
        createdAt: data.created_at
    };
}

function mapToDB(data: Partial<Consultation>) {
    const dbData: any = { ...data };
    if (data.coachName !== undefined) {
        dbData.coach_name = data.coachName;
        delete dbData.coachName;
    }
    if (data.athleteName !== undefined) {
        dbData.athlete_name = data.athleteName;
        delete dbData.athleteName;
    }
    if (data.isImportant !== undefined) {
        dbData.is_important = data.isImportant;
        delete dbData.isImportant;
    }
    return dbData;
}

export async function fetchConsultations(): Promise<Consultation[]> {
    try {
        const supabase = createClient();
        const { data, error } = await supabase
            .from("consultations")
            .select("*")
            .order("date", { ascending: false })
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Supabase error fetching consultations:", error.message, error.code, error.details);
            throw error;
        }
        return (data || []).map(mapFromDB);
    } catch (err: any) {
        console.error("Error in fetchConsultations:", err);
        return [];
    }
}

export async function fetchConsultationById(id: string): Promise<Consultation | null> {
    try {
        const supabase = createClient();
        const { data, error } = await supabase
            .from("consultations")
            .select("*")
            .eq("id", id)
            .maybeSingle();

        if (error) throw error;
        return data ? mapFromDB(data) : null;
    } catch (err) {
        console.error("Error fetching consultation by id:", err);
        return null;
    }
}

export async function saveConsultation(consultation: Partial<Consultation>) {
    try {
        const supabase = createClient();
        
        // Resolve user_id and coach_id if possible
        const [athleteRes, coachRes] = await Promise.all([
            supabase.from("users").select("id").eq("name", consultation.athleteName).maybeSingle(),
            supabase.from("users").select("id").eq("name", consultation.coachName).maybeSingle()
        ]);

        const dbPayload = mapToDB(consultation);
        const { data, error } = await supabase
            .from("consultations")
            .insert({
                ...dbPayload,
                user_id: athleteRes.data?.id || null,
                coach_id: coachRes.data?.id || null
            })
            .select()
            .single();

        if (error) throw error;
        return mapFromDB(data);
    } catch (err) {
        console.error("Error saving consultation:", err);
        throw err;
    }
}

export async function updateConsultation(id: string, consultation: Partial<Consultation>) {
    try {
        const supabase = createClient();
        const dbPayload = mapToDB(consultation);
        const { data, error } = await supabase
            .from("consultations")
            .update(dbPayload)
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;
        return mapFromDB(data);
    } catch (err) {
        console.error("Error updating consultation:", err);
        throw err;
    }
}

export async function deleteConsultation(id: string) {
    try {
        const supabase = createClient();
        const { error } = await supabase
            .from("consultations")
            .delete()
            .eq("id", id);

        if (error) throw error;
        return true;
    } catch (err) {
        console.error("Error deleting consultation:", err);
        throw err;
    }
}

export async function fetchRecentActivityByPlayer(playerName: string, type: 'lesson' | 'analysis' | 'training'): Promise<any[]> {
    try {
        const supabase = createClient();
        
        const { data: userRes } = await supabase
            .from("users")
            .select("id")
            .eq("name", playerName)
            .maybeSingle();
            
        if (!userRes) return [];

        const { data, error } = await supabase
            .from("records")
            .select("id, title, created_at, category")
            .eq("user_id", userRes.id)
            .eq("type", type)
            .order("created_at", { ascending: false })
            .limit(3);

        if (error) throw error;
        return (data || []).map(r => ({
            id: r.id,
            title: r.title || (r.category ? `${r.category.toUpperCase()} ${type === 'analysis' ? '분석' : type === 'lesson' ? '레슨' : '훈련'}` : "제목 없음"),
            date: formatLocalDate(new Date(r.created_at)),
            type: r.category
        }));
    } catch (err) {
        console.error(`Error fetching recent ${type}:`, err);
        return [];
    }
}

export async function fetchRecentScorecardByPlayer(playerName: string): Promise<any | null> {
    try {
        const supabase = createClient();
        
        const { data: userRes } = await supabase
            .from("users")
            .select("id")
            .eq("name", playerName)
            .maybeSingle();
            
        if (!userRes) return null;

        const { data, error } = await supabase
            .from("records")
            .select("*")
            .eq("user_id", userRes.id)
            .eq("type", "scorecard")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw error;
        if (!data) return null;

        // Map from DB structure to UI structure
        return {
            id: data.id,
            date: formatLocalDate(new Date(data.created_at)),
            course: data.title || "코스 정보 없음",
            score: data.total_count || 0,
            teeShot: data.template_settings?.find((s: any) => s.label === "티샷")?.value || "-",
            iron: data.template_settings?.find((s: any) => s.label === "아이언")?.value || "-",
            pitch: data.template_settings?.find((s: any) => s.label === "피치")?.value || "-",
            aroundGreen: data.template_settings?.find((s: any) => s.label === "그린주변")?.value || "-",
            putting: data.template_settings?.find((s: any) => s.label === "퍼팅")?.value || "-",
            challengeFocus: data.content?.slice(0, 50) || "-",
            strongPoint: data.template_settings?.find((s: any) => s.label === "강점")?.value || "-",
        };
    } catch (err) {
        console.error("Error fetching recent scorecard:", err);
        return null;
    }
}

export function getPlainText(html: string) {
    if (!html) return "";
    return html.replace(/<[^>]*>/g, "").slice(0, 100);
}

