import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl!, supabaseKey!);

    const { calculateAnalysisFromHoles } = require('./src/lib/score-calculations');

    const mockHole30 = {
        hole_number: 1, par: 5, score: 6,
        shots: [
            { shot_number: 1, shot_value: 'TE' },
            { shot_number: 2, shot_value: 'FW / 300' },
            { shot_number: 3, shot_value: 'PA' },
            { shot_number: 4, shot_value: '- / 30' },
            { shot_number: 5, shot_value: 'GR / 3' },
            { shot_number: 6, shot_value: 'GR / 1' },
            { shot_number: 7, shot_value: 'HI' }
        ]
    };

    const mockHole35 = {
        hole_number: 1, par: 5, score: 6,
        shots: [
            { shot_number: 1, shot_value: 'TE' },
            { shot_number: 2, shot_value: 'FW / 300' },
            { shot_number: 3, shot_value: 'PA' },
            { shot_number: 4, shot_value: '- / 35' },
            { shot_number: 5, shot_value: 'GR / 3' },
            { shot_number: 6, shot_value: 'GR / 1' },
            { shot_number: 7, shot_value: 'HI' }
        ]
    };

    try {
        const analysis30 = await calculateAnalysisFromHoles([mockHole30]);
        console.log("=== 30m ===");
        console.log(JSON.stringify(analysis30[0].shots.slice(2, 4), null, 2));

        const analysis35 = await calculateAnalysisFromHoles([mockHole35]);
        console.log("=== 35m ===");
        console.log(JSON.stringify(analysis35[0].shots.slice(2, 4), null, 2));
    } catch (e) {
        console.error(e);
    }
}

run();
