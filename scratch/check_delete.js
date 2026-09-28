import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
    const oldId = '51e909c3-3122-4f66-b034-9d30985499bc'; // Sep 4
    const { error } = await supabase.from('users').delete().eq('id', oldId);
    console.log(error);
}
run();
