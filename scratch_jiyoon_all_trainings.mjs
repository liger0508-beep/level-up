import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const athleteId = 'ce8d9464-29d4-4e4a-bd6e-cc725b474a10';
    const { data, error } = await supabase.from('records').select('*').eq('user_id', athleteId).eq('type', 'training');
    if (data) {
        console.log("All training sessions for Jiyoon:");
        for (const t of data) {
            console.log(`- ID: ${t.id}, Date: ${t.created_at}, Title: ${t.title}`);
            console.log(`  Template Settings:`, JSON.stringify(t.template_settings));
        }
    }
}
main();
