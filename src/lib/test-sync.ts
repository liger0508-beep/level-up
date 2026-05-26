import { createClient } from "./supabase/client";
import { formatLocalDate } from "./utils";

export type TestType = 
    | "driver" 
    | "iron"
    | "wood_iron" 
    | "pitch" 
    | "approach" 
    | "bunker" 
    | "long_putt" 
    | "middle_putt" 
    | "short_putt"
    | "shot" | "around_green" | "putting" | "physical" | "short_game" | "etc";

export interface TestData {
    id: string;
    type: TestType;
    title: string;
    playerName: string;
    coachName: string;
    comment: string;
    date: string;
    totalScore?: number;
    content?: any;
}

export const TEST_TYPE_LABELS: Record<TestType, string> = {
    driver: "샷 종합",
    iron: "샷 종합",
    wood_iron: "우드/아이언",
    pitch: "피치샷",
    approach: "숏게임 종합",
    bunker: "숏게임 종합",
    long_putt: "퍼팅 종합",
    middle_putt: "퍼팅 종합",
    short_putt: "퍼팅 종합",
    shot: "샷 종합",
    around_green: "숏게임 종합",
    putting: "퍼팅 종합",
    physical: "피지컬",
    short_game: "숏게임 종합",
    etc: "기타"
};

export const TEST_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    driver: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-l-emerald-500" },
    iron: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-l-emerald-500" },
    wood_iron: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-l-emerald-500" },
    pitch: { bg: "bg-cyan-50", text: "text-cyan-600", border: "border-l-cyan-500" },
    approach: { bg: "bg-cyan-50", text: "text-cyan-600", border: "border-l-cyan-500" },
    bunker: { bg: "bg-amber-50", text: "text-amber-600", border: "border-l-amber-500" },
    long_putt: { bg: "bg-violet-50", text: "text-violet-600", border: "border-l-violet-500" },
    middle_putt: { bg: "bg-violet-50", text: "text-violet-600", border: "border-l-violet-500" },
    short_putt: { bg: "bg-violet-50", text: "text-violet-600", border: "border-l-violet-500" },
    // Fallbacks for old types if any
    shot: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-l-emerald-500" },
    around_green: { bg: "bg-cyan-50", text: "text-cyan-600", border: "border-l-cyan-500" },
    putting: { bg: "bg-violet-50", text: "text-violet-600", border: "border-l-violet-500" },
    physical: { bg: "bg-amber-50", text: "text-amber-600", border: "border-l-amber-500" },
};

export const mockTests: TestData[] = [
    {
        id: "t1",
        type: "shot",
        title: "드라이버 비거리 테스트",
        playerName: "김민수",
        coachName: "박코치",
        comment: "전체적으로 비거리가 10m 이상 향상됨. 정타율(Smash Factor) 1.48 기록.",
        date: "2026-03-22",
    },
    {
        id: "t2",
        type: "around_green",
        title: "그린 주변 어프로치 정교도",
        playerName: "이수진",
        coachName: "최코치",
        comment: "20m 거리 어프로치에서 반경 1.5m 이내 성공률 80% 달성.",
        date: "2026-03-21",
    },
];

export const mockTodayTests = [
    { id: "st1", playerName: "김민수", time: "10:00~11:00", type: "shot" as TestType },
    { id: "st2", playerName: "이지원", time: "11:30~12:30", type: "around_green" as TestType },
];

export interface TestRecord {
    id: string;
    type: "test";
    category: TestType;
    title: string;
    content: any; // Storing results as JSON
    score?: number;
    media_urls?: string[];
    created_at: string;
    playerName: string;
    coachName: string;
}

export async function saveTestRecord(record: {
    id?: string;
    playerName: string;
    coachName: string;
    category: TestType;
    title: string;
    content: any;
    media_urls?: string[];
    date: string;
    time?: string;
}) {
    try {
        console.log("1. Starting saveTestRecord for:", record.playerName, record.id ? "(Update)" : "(Insert)");
        const supabase = createClient();
        
        // 1. Resolve user IDs
        console.log("2. Resolving IDs for Player:", record.playerName, "and Coach:", record.coachName);
        const [userRes, coachRes] = await Promise.all([
            supabase.from("users").select("id").eq("name", record.playerName).maybeSingle(),
            supabase.from("users").select("id").eq("name", record.coachName).maybeSingle()
        ]);
        
        if (userRes.error) throw userRes.error;
        if (!userRes.data) throw new Error(`선수('${record.playerName}')를 찾을 수 없습니다.`);
        
        // 2. Create timestamp
        let createdAt = new Date().toISOString();
        if (record.date) {
            const timePart = record.time || "12:00";
            createdAt = new Date(`${record.date}T${timePart}:00`).toISOString();
        }
        
        const payload = {
            user_id: userRes.data.id,
            coach_id: coachRes.data?.id || null,
            category: record.category,
            title: record.title,
            raw_shot_data: record.content,
            total_score: record.content?.totalScore || 0,
            driver_score: record.content?.driver?.score ?? null,
            iron_score: record.content?.iron?.score ?? null,
            short_putt_score: record.content?.short?.score ?? null,
            middle_putt_score: record.content?.middle?.score ?? null,
            long_putt_score: record.content?.long?.score ?? null,
            created_at: createdAt,
            updated_at: new Date().toISOString()
        };

        // 3. Insert or Update
        if (record.id) {
            console.log("5. Updating record ID:", record.id);
            const { data, error } = await supabase
                .from("test_sessions")
                .update(payload)
                .eq("id", record.id)
                .select();
            if (error) {
                console.error("Supabase update error:", error);
                throw new Error(error.message || JSON.stringify(error));
            }
            return data?.[0] || null;
        } else {
            console.log("5. Inserting record into DB...");
            const { data, error } = await supabase
                .from("test_sessions")
                .insert(payload)
                .select();
            if (error) {
                console.error("Supabase insert error:", error);
                throw new Error(error.message || JSON.stringify(error));
            }
            return data?.[0] || null;
        }
    } catch (err: any) {
        console.error("Save error:", err.message, err.details, err.hint, err);
        throw err;
    }
}

export async function fetchTestsByPlayer(playerName: string): Promise<TestRecord[]> {
    try {
        const supabase = createClient();
        
        const { data: userRes } = await supabase
            .from("users")
            .select("id")
            .eq("name", playerName)
            .maybeSingle();
            
        if (!userRes) return [];
        
        const { data, error } = await supabase
            .from("test_sessions")
            .select(`
                id,
                category,
                title,
                raw_shot_data,
                total_score,
                created_at,
                athlete:users!test_sessions_user_id_fkey(name),
                coach:users!test_sessions_coach_id_fkey(name)
            `)
            .eq("user_id", userRes.id)
            .order("created_at", { ascending: false });
            
        if (error) {
            console.error("fetchTests error:", error);
            return [];
        }
        
        return (data || []).map((r: any) => ({
            id: r.id,
            type: "test",
            category: r.category as TestType,
            title: r.title || "",
            content: r.raw_shot_data, // mapped back to content for UI compatibility
            score: r.total_score,
            created_at: r.created_at,
            playerName: r.athlete?.name || "Unknown",
            coachName: r.coach?.name || "Unknown"
        }));
    } catch (err) {
        return [];
    }
}
