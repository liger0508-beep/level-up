import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkRLS() {
    const { data: records, error } = await supabase.rpc('get_table_policies', { table_name_param: 'records' });
    console.log("RPC Error:", error);
    
    // Alternative: check pg_policies
    const { data: policies } = await supabase.from('pg_policies').select('*').eq('tablename', 'records');
    console.log("Policies:", policies);
}
checkRLS();
