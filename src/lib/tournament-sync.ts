import { createClient } from "./supabase/client";

export type TournamentCategory = "KGA" | "KPGA" | "KLPGA" | "대학연맹" | "중고연맹" | "기타";

export interface Tournament {
    id: string;
    /** Date in "MM-DD" or "MM-DD ~ MM-DD" format (year stored separately for clarity) */
    date: string;
    /** The year this tournament belongs to */
    year: number;
    name: string;
    venue: string;
    category: TournamentCategory;
    players: string[];
}

/**
 * Fetch all tournaments from Supabase.
 */
export async function getStoredTournaments(): Promise<Tournament[]> {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("tournaments")
        .select("*")
        .order("date", { ascending: true });

    if (error) {
        console.error("Error fetching tournaments:", error);
        return [];
    }

    return (data || []).map(t => ({
        id: t.id,
        date: t.date,
        year: t.year,
        name: t.name,
        venue: t.venue,
        category: t.category as TournamentCategory,
        players: t.players || [],
    }));
}

/**
 * Save tournaments and delete removed ones.
 */
export async function saveAllTournaments(tournaments: Tournament[], deletedIds: string[] = []) {
    const supabase = createClient();
    
    // 1. Handle deletions
    if (deletedIds.length > 0) {
        const { error: delError } = await supabase
            .from("tournaments")
            .delete()
            .in("id", deletedIds);
        if (delError) {
            console.error("Error deleting tournaments:", delError);
        }
    }

    // 2. Handle upserts
    if (tournaments.length > 0) {
        const toUpsert = tournaments.map(t => ({
            id: t.id,
            date: t.date,
            year: t.year,
            name: t.name,
            venue: t.venue,
            category: t.category,
            players: t.players,
        }));

        const { error } = await supabase
            .from("tournaments")
            .upsert(toUpsert, { onConflict: 'id' });

        if (error) {
            console.error("Error saving tournaments:", error);
            throw error;
        }
    }
}

/**
 * Save a single tournament.
 */
export async function saveTournament(tournament: Tournament) {
    const supabase = createClient();
    const { error } = await supabase
        .from("tournaments")
        .insert({
            id: tournament.id,
            date: tournament.date,
            year: tournament.year,
            name: tournament.name,
            venue: tournament.venue,
            category: tournament.category,
            players: tournament.players,
        });

    if (error) {
        console.error("Error inserting tournament:", error);
        throw error;
    }
}

/**
 * Update an existing tournament.
 */
export async function updateTournament(updatedItem: Tournament) {
    const supabase = createClient();
    const { error } = await supabase
        .from("tournaments")
        .update({
            date: updatedItem.date,
            year: updatedItem.year,
            name: updatedItem.name,
            venue: updatedItem.venue,
            category: updatedItem.category,
            players: updatedItem.players,
        })
        .eq("id", updatedItem.id);

    if (error) {
        console.error("Error updating tournament:", error);
        throw error;
    }
}

/**
 * Delete a tournament.
 */
export async function deleteTournament(id: string) {
    const supabase = createClient();
    const { error } = await supabase
        .from("tournaments")
        .delete()
        .eq("id", id);

    if (error) {
        console.error("Error deleting tournament:", error);
        throw error;
    }
}
