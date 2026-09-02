import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data, error } = await supabase.from('records').insert({
        user_id: 'ce8d9464-29d4-4e4a-bd6e-cc725b474a10',
        coach_id: 'ce8d9464-29d4-4e4a-bd6e-cc725b474a10',
        type: 'analysis',
        title: 'test',
        category: '연습',
        content: 'test',
        related_id: 'd0839c68-d489-4297-8dbb-ca59309ee3b1'
    });
    console.log("Error:", error);
}
main();
