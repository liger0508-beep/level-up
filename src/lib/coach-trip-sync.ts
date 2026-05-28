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

/**
 * Save a single coach trip.
 */
export async function saveCoachTrip(trip: CoachTrip) {
    const supabase = createClient();
    const { error } = await supabase
        .from("coach_trips")
        .insert({
            id: trip.id,
            date: trip.date,
            year: trip.year,
            venue: trip.venue,
            category: trip.category,
            participants: trip.participants,
            remarks: JSON.stringify({ remarks: trip.remarks, vehicle: trip.vehicle }),
        });

    if (error) {
        console.error("Error inserting coach trip:", error);
        throw error;
    }
}

/**
 * Update an existing coach trip.
 */
export async function updateCoachTrip(updatedItem: CoachTrip) {
    const supabase = createClient();
    const { error } = await supabase
        .from("coach_trips")
        .update({
            date: updatedItem.date,
            year: updatedItem.year,
            venue: updatedItem.venue,
            category: updatedItem.category,
            participants: updatedItem.participants,
            remarks: JSON.stringify({ remarks: updatedItem.remarks, vehicle: updatedItem.vehicle }),
        })
        .eq("id", updatedItem.id);

    if (error) {
        console.error("Error updating coach trip:", error);
        throw error;
    }
}

/**
 * Delete a coach trip.
 */
export async function deleteCoachTrip(id: string) {
    const supabase = createClient();
    const { error } = await supabase
        .from("coach_trips")
        .delete()
        .eq("id", id);

    if (error) {
        console.error("Error deleting coach trip:", error);
        throw error;
    }
}
