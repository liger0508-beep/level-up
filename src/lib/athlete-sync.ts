import { createClient } from "./supabase/client";

const MOCK_ATHLETES: string[] = [];

export async function fetchAthletes(): Promise<string[]> {
    try {
        const supabase = createClient();
        const { data, error } = await supabase
            .from("users")
            .select("name")
            .neq("role", "parent");

        if (error) {
            console.warn("Using fallback mock data as Supabase fetch failed:", error);
            return MOCK_ATHLETES;
        }

        if (!data || data.length === 0) return MOCK_ATHLETES;

        const names = data.map((u: { name: string }) => (u.name || "")).filter(Boolean);
        return Array.from(new Set(names)).sort();
    } catch (err) {
        console.warn("Using fallback mock data (Supabase not initialized):", err);
        return MOCK_ATHLETES;
    }
}
