import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl!, supabaseKey!);

    const { data: scorecard, error } = await supabase
        .from('scorecards')
        .select(`
            id,
            holes:scorecard_holes(
                hole_number, par, score,
                shots:scorecard_shots(*)
            )
        `)
        .eq('id', '246fc057-069c-43d1-b7bd-9c15197de067')
        .single();

    if (error || !scorecard) {
        console.error(error);
        return;
    }

    const hole9 = (scorecard.holes as any[]).find(h => h.hole_number === 9);
    console.log(JSON.stringify(hole9.shots.sort((a: any, b: any) => a.shot_number - b.shot_number), null, 2));
}

run();
