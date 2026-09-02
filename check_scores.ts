import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    // Use service role key to bypass RLS
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
        console.error("Missing Supabase env vars");
        return;
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all scorecards
    const { data: scorecards, error } = await supabase
        .from('scorecards')
        .select('id, course_name, round_date');

    if (error || !scorecards) {
        console.error("Error fetching scorecards:", error);
        return;
    }

    console.log(`Found ${scorecards.length} scorecards. Checking totalSG...`);

    // Import the calculation function dynamically to avoid static import issues
    const { calculateScorecardAnalysis } = require('./src/lib/score-calculations');

    let nonZeroFractionCount = 0;
    
    for (const sc of scorecards) {
        try {
            const analysis = await calculateScorecardAnalysis(sc.id);
            if (!analysis || analysis.length === 0) continue;

            let totalRoundSG = 0;
            let hasNonIntegerHole = false;

            for (const hole of analysis) {
                totalRoundSG += hole.totalSG;
                // Check if hole totalSG ends in .00
                const diff = Math.abs(hole.totalSG - Math.round(hole.totalSG));
                if (diff > 0.001) {
                    hasNonIntegerHole = true;
                }
            }

            const totalDiff = Math.abs(totalRoundSG - Math.round(totalRoundSG));
            
            if (hasNonIntegerHole || totalDiff > 0.001) {
                console.log(`Scorecard ${sc.id} (${sc.course_name} / ${sc.round_date}): Total SG = ${totalRoundSG.toFixed(2)}`);
                for (const hole of analysis) {
                    const holeDiff = Math.abs(hole.totalSG - Math.round(hole.totalSG));
                    if (holeDiff > 0.001) {
                        console.log(`  Hole ${hole.holeNumber} (Par ${hole.par}): totalSG = ${hole.totalSG.toFixed(2)}`);
                    }
                }
                nonZeroFractionCount++;
            }

        } catch (e) {
            console.error(`Error processing ${sc.id}:`, e);
        }
    }

    console.log(`Done. Found ${nonZeroFractionCount} scorecards with non-.00 totalSG.`);
}

run();
