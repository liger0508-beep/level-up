import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const athleteId = 'ce8d9464-29d4-4e4a-bd6e-cc725b474a10';
    const { data, error } = await supabase.from('records').select('*').eq('user_id', athleteId).eq('type', 'analysis');
    console.log("Analysis records for Jiyoon:", data?.map(d => ({ title: d.title, date: d.created_at })));
}
main();
