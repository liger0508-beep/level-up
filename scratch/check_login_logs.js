import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkLoginLogs() {
    console.log("Checking login_logs table...");

    const { data, error } = await supabase.from('login_logs').select('*').limit(10);
    if (error) {
        console.log("Error querying login_logs:", error.message);
    } else {
        console.log("Table login_logs exists! Sample rows:", data);
        
        // Let's get count for September
        const { count, error: countErr } = await supabase
            .from('login_logs')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', '2024-09-01T00:00:00Z')
            .lt('created_at', '2024-10-01T00:00:00Z');
            
        console.log("September logins in login_logs:", count);
    }
}
checkLoginLogs();
