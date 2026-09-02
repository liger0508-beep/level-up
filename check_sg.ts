import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data: baselines } = await supabase.from('sg_baseline').select('*').order('distance_m');
    const b0 = baselines?.find(b => b.distance_m <= 0) || baselines?.[0];
    console.log(b0);
}
run();
