import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function testQuery() {
    // try to fetch records using service role to check total count
    const { count } = await supabase.from('records').select('*', { count: 'exact', head: true });
    console.log("Total records:", count);

    // Let's create a temporary function to check pg_policies or just try to see if office policy exists
    const { data, error } = await supabase.rpc('get_table_policies', { table_name_param: 'records' });
    console.log(data || error);
}
testQuery();
