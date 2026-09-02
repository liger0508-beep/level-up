import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl!, supabaseKey!);

    const { calculateScorecardAnalysis } = require('./src/lib/score-calculations');

    try {
        const analysis = await calculateScorecardAnalysis('246fc057-069c-43d1-b7bd-9c15197de067');
        const hole9 = analysis.find((h: any) => h.holeNumber === 9);
        console.log(JSON.stringify(hole9.shots, null, 2));
    } catch (e) {
        console.error(e);
    }
}

run();
