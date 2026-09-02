import { createClient } from "./supabase/client";

export type CoachTripCategory = "대회 출장" | "필드 레슨" | "기타";

export interface CoachTrip {
    id: string;
    /** Date in "MM-DD" or "MM-DD ~ MM-DD" format */
    date: string;
    /** The year this trip belongs to */
    year: number;
    venue: string;
    category: CoachTripCategory;
    participants: string[];
    remarks: string;
    vehicle?: string;
}

/**
 * Fetch all coach trips from Supabase.
 */
export async function getStoredCoachTrips(): Promise<CoachTrip[]> {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("coach_trips")
        .select("*")
        .order("date", { ascending: true });

    if (error) {
        console.error("Error fetching coach trips:", error);
        return [];
    }

    return (data || []).map(t => ({
        id: t.id,
        date: t.date,
        year: t.year,
        venue: t.venue,
        category: t.category as CoachTripCategory,
        participants: t.participants || [],
        remarks: (() => {
            try {
                if (t.remarks && t.remarks.startsWith("{")) {
                    return JSON.parse(t.remarks).remarks || "";
                }
                return t.remarks || "";
            } catch (e) { return t.remarks || ""; }
        })(),
        vehicle: (() => {
            try {
                if (t.remarks && t.remarks.startsWith("{")) {
                    return JSON.parse(t.remarks).vehicle || "";
                }
                return "";
            } catch (e) { return ""; }
        })(),
    }));
}

/**
 * Save coach trips and delete removed ones.
 */
export async function saveAllCoachTrips(trips: CoachTrip[], deletedIds: string[] = []) {
    const supabase = createClient();
    
    // 1. Handle deletions
    if (deletedIds.length > 0) {
        const { error: delError } = await supabase
            .from("coach_trips")
            .delete()
            .in("id", deletedIds);
        if (delError) {
            console.error("Error deleting coach trips:", delError);
        }
    }

    // 2. Handle upserts
    if (trips.length > 0) {
        const toUpsert = trips.map(t => ({
            id: t.id,
            date: t.date,
            year: t.year,
            venue: t.venue,
            category: t.category,
            participants: t.participants,
            remarks: JSON.stringify({ remarks: t.remarks, vehicle: t.vehicle }),
        }));

        const { error } = await supabase
            .from("coach_trips")
            .upsert(toUpsert, { onConflict: 'id' });

        if (error) {
            console.error("Error saving coach trips:", error);
            throw error;
        }
    }
}

