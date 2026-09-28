import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function checkRecordsRLS() {
    // Just fetch one record with a regular client but mock auth if possible? 
    // We can't easily check RLS without logging in as 'office'.
    // Let's create an office user, log in, and try to fetch.
    const { data: users } = await supabase.from('users').select('id, role, email').eq('role', 'office').limit(1);
    console.log("Office users:", users);
}
checkRecordsRLS();
