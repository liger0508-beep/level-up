import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data: scorecard, error } = await supabase
        .from('scorecards')
        .select(`
            id,
            holes:scorecard_holes(
                id, hole_number, par, score,
                shots:scorecard_shots(*)
            )
        `)
        .eq('id', '06abf44d-80ec-4578-95b1-e26df6864a04')
        .limit(1)
        .single();
    
    if (error) {
        console.error(error);
        return;
    }

    const hole4 = scorecard.holes.find((h: any) => h.hole_number === 4);
    if (!hole4) return;
    console.log(JSON.stringify(hole4.shots.sort((a: any, b: any) => a.shot_number - b.shot_number), null, 2));
}
run();
