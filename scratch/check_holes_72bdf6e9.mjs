import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kvajcjtoserjhkdeatlh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2YWpjanRvc2VyamhrZGVhdGxoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM2MjM4MCwiZXhwIjoyMDkyOTM4MzgwfQ.RRc8nqdDBxKcf4Mp8ORX_VeZB8tcp2YhCj3X9D6hQXU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkHole(id, holeNum) {
    const { data: scorecard, error } = await supabase
        .from('scorecards')
        .select(`
            id,
            holes:scorecard_holes(
                id, hole_number, par, score,
                shots:scorecard_shots(*)
            )
        `)
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching scorecard:', error);
        return;
    }

    const hole = scorecard.holes.find(h => h.hole_number === holeNum);
    console.log(`Hole ${holeNum} (Par ${hole.par}, Score ${hole.score}):`);
    hole.shots.sort((a, b) => a.shot_number - b.shot_number).forEach(shot => {
        console.log(`  Shot ${shot.shot_number}: ${shot.shot_value} (${shot.location_code}, ${shot.distance}m)`);
    });
}

async function main() {
    await checkHole('72bdf6e9-3849-4834-95d7-d570be2341c2', 5);
    await checkHole('72bdf6e9-3849-4834-95d7-d570be2341c2', 6);
}

main();
