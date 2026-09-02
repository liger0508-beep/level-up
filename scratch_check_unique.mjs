import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const scorecardId = 'd0839c68-d489-4297-8dbb-ca59309ee3b1';
    const { data, error } = await supabase.from('scorecards').select('*').eq('id', scorecardId);
    console.log("Count:", data?.length);
    console.log("Error:", error);
}
main();
