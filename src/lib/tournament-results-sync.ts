import { createClient } from "./supabase/client";

export interface TournamentResult {
    id?: string;
    tournament_id: string;
    athlete_name: string;
    round_number: number;
    round_date: string; // YYYY-MM-DD
    daily_score: string | null;
    daily_rank: number | null;
    cumulative_score: number | null;
    rank: number | null;
    notes: string | null;
}

/**
 * Fetch results for a specific tournament.
 */
export async function getTournamentResults(tournamentId: string): Promise<TournamentResult[]> {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("tournament_results")
        .select("*")
        .eq("tournament_id", tournamentId)
        .order("round_number", { ascending: true });

    if (error) {
        console.error("Error fetching tournament results:", error);
        return [];
    }

    return data || [];
}

/**
 * Save multiple tournament results.
 */
export async function saveTournamentResults(results: TournamentResult[]) {
    const supabase = createClient();
    
    // Dynamically check if the 'notes' column exists in the schema to avoid schema cache mismatch errors
    const { error: columnCheckError } = await supabase
        .from("tournament_results")
        .select("notes")
        .limit(0);
        
    const hasNotesColumn = !columnCheckError;
    
    // If the 'notes' column doesn't exist, gracefully omit it from the payload
    const processedResults = hasNotesColumn
        ? results
        : results.map(({ notes, ...rest }) => rest);
    
    const { error } = await supabase
        .from("tournament_results")
        .upsert(processedResults, { onConflict: 'tournament_id, athlete_name, round_number' });

    if (error) {
        console.error("Error saving tournament results:", error);
        throw error;
    }
}

/**
 * Utility to get all dates between two MM-DD strings for a given year.
 */
export function getDatesBetween(startDateStr: string, endDateStr: string, year: number): string[] {
    const dates: string[] = [];
    const start = new Date(`${year}-${startDateStr}`);
    const end = new Date(`${year}-${endDateStr}`);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];

    let current = new Date(start);
    while (current <= end) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
        
        // Safety break to prevent infinite loops if something goes wrong
        if (dates.length > 31) break; 
    }
    
    return dates;
}
