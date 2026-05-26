import { createClient } from "./supabase/client";

const MOCK_ATHLETES: string[] = [];

export async function fetchAthletes(): Promise<string[]> {
    try {
        const supabase = createClient();
        const { data, error } = await supabase
            .from("users")
            .select("name");

        if (error) {
            console.warn("Using fallback mock data as Supabase fetch failed:", error);
            return MOCK_ATHLETES;
        }

        if (!data || data.length === 0) return MOCK_ATHLETES;

        return data.map((u: { name: string }) => (u.name || "").trim().normalize("NFC")).filter(Boolean).sort();
    } catch (err) {
        console.warn("Using fallback mock data (Supabase not initialized):", err);
        return MOCK_ATHLETES;
    }
}
