import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkOldestLog() {
    const { data } = await supabase
        .from('login_logs')
        .select('created_at')
        .order('created_at', { ascending: true })
        .limit(1);
    
    console.log("Oldest record in login_logs:", data);
}
checkOldestLog();
