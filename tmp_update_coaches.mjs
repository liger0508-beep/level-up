import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    // Update "성시우" and "김홍식"
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
