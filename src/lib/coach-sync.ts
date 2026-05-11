import { createClient } from "./supabase/client";

/**
 * Fetch all registered coaches and admins from Supabase.
 */
export async function fetchCoaches(): Promise<string[]> {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("users")
        .select("name")
        .in("role", ["coach", "admin"])
        .order("name");

    if (error) {
        console.error("Error fetching coaches:", error);
        return [];
    }

    return (data || []).map((u: { name: string }) => u.name);
}
