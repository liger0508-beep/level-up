import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    // athleteId for 박지윤
    const athleteId = 'ce8d9464-29d4-4e4a-bd6e-cc725b474a10';
    // Scorecard for 7/29
    const scorecardId = 'd0839c68-d489-4297-8dbb-ca59309ee3b1';

    // Let's run the exact same logic
    try {
        const { calculateScorecardAnalysis, generateReviewFocusCategories } = await import('./src/lib/score-calculations.js'); // Assuming we can import it in Node.js, wait it's typescript. 
        // Better to just fetch the holes and run the logic manually or just print what the API returned.
    } catch (e) {
        console.error(e);
    }
}
main();
