import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkData() {
    const { data: scorecards } = await supabase.from('scorecards').select('*').limit(5);
    const { data: tournamentResults } = await supabase.from('tournament_results').select('*').limit(5);
    const { data: records } = await supabase.from('records').select('*').limit(5);
    
    console.log("Scorecards:", scorecards?.length);
    console.log("Tournament Results:", tournamentResults?.length);
    console.log("Records:", records?.length);
    if (records) console.log(records.map(r => r.category));
}
checkData();
