import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function run() {
    const { data: score } = await supabase
        .from('scores')
        .select('*')
        .eq('id', '11d9520b-cd20-4367-8bca-ca55deca978b')
        .single();
    
    if (score) {
        console.log("Keys in score:", Object.keys(score));
        if (score.hole_scores) {
            const hole4 = score.hole_scores.find((h: any) => h.hole_number === 4);
            console.log(JSON.stringify(hole4, null, 2));
        }
    } else {
        console.log("Score not found");
    }
}
run();
