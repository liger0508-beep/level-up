import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data, error } = await supabase
        .from('users')
        .update({ branch: '총괄' })
        .in('name', ['성시우', '김홍식'])
        .select();

    if (error) {
        console.error('Update failed:', error);
    } else {
        console.log('Update success:', data);
    }
}

run();
