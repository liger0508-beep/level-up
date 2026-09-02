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
    
    if (baselines) {
        let prevBRow = baselines[0];
        for (const r of baselines) {
            if (r.distance_m <= 39) prevBRow = r;
            else break;
        }
        console.log("39m (closest row):", prevBRow.distance_m);
        console.log("putting:", prevBRow.putting);
        console.log("on_green:", prevBRow.on_green);
    }
}
run();
