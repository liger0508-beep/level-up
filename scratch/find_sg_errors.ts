import { createClient } from './src/lib/supabase/client';
import { calculateAnalysisFromHoles } from './src/lib/score-calculations';

async function run() {
    console.log("Fetching scorecards...");
    const supabase = createClient();
    
    // Fetch all scorecards with holes and shots
    const { data: scorecards, error } = await supabase
        .from('scorecards')
        .select(`
            id, round_date, course_name, 
            athlete:users!scorecards_athlete_id_fkey(name),
            holes:scorecard_holes(
                id, hole_number, par, score,
                shots:scorecard_shots(*)
            )
        `);

    if (error) {
        console.error("Error fetching scorecards:", error);
        return;
    }

    console.log(`Found ${scorecards.length} scorecards. Analyzing...`);

    let count = 0;
    for (const sc of scorecards) {
        if (!sc.holes || sc.holes.length === 0) continue;

        const sortedHoles = (sc.holes as any[])
            .filter(h => h.score !== -1)
            .sort((a, b) => a.hole_number - b.hole_number);

        try {
            const analysis = await calculateAnalysisFromHoles(sortedHoles);
            
            for (const hole of analysis) {
                // Check if totalSG is not .00 (allow a small float tolerance like 0.001)
                const fractionalPart = Math.abs(hole.totalSG % 1);
                const isNotInteger = fractionalPart > 0.001 && fractionalPart < 0.999;
                
                if (isNotInteger) {
                    const athleteName = (sc.athlete as any)?.name || 'Unknown';
                    console.log(`Mismatch Found:
- 작성자(Athlete): ${athleteName}
- 날짜(Date): ${sc.round_date}
- 골프장(Course): ${sc.course_name}
- 해당홀(Hole): ${hole.holeNumber}
- 총점(TotalSG): ${hole.totalSG.toFixed(2)}
----------------------------------`);
                    count++;
                }
            }
        } catch (err) {
            // Some scorecards might fail due to missing data, etc.
            // console.error(`Error analyzing scorecard ${sc.id}:`, err);
        }
    }
    console.log(`Done. Found ${count} holes with non-integer totalSG.`);
}

run();
