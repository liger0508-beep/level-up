import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function run() {
    const { data: baselines } = await supabase
        .from('sg_baseline')
        .select('*')
        .order('distance_m', { ascending: true });
    
    console.log(JSON.stringify(baselines));
}
run();
