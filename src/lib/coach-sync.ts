import { createClient } from "./supabase/client";

/**
 * Fetch all registered coaches and admins from Supabase.
 */
export async function fetchCoaches(): Promise<string[]> {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("users")
        .select("name, status")
        .in("role", ["coach", "admin"])
        .order("name");

    if (error) {
        console.error("Error fetching coaches:", error);
        return [];
    }

    return (data || [])
        .filter((u: any) => u.status !== "휴직" && u.status !== "퇴직")
        .map((u: { name: string }) => u.name);
}
