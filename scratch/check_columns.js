import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkColumns() {
    const { data: scorecards } = await supabase.from('scorecards').select('*').limit(1);
    const { data: tournamentResults } = await supabase.from('tournament_results').select('*').limit(1);
    
    console.log("Scorecards:", scorecards ? Object.keys(scorecards[0]) : null);
    console.log("Tournament Results:", tournamentResults ? Object.keys(tournamentResults[0]) : null);
}
checkColumns();
