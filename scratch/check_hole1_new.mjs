import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kvajcjtoserjhkdeatlh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2YWpjanRvc2VyamhrZGVhdGxoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM2MjM4MCwiZXhwIjoyMDkyOTM4MzgwfQ.RRc8nqdDBxKcf4Mp8ORX_VeZB8tcp2YhCj3X9D6hQXU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkHole1(id) {
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

    const hole1 = scorecard.holes.find(h => h.hole_number === 1);
    console.log(`Hole 1 (Par ${hole1.par}, Score ${hole1.score}):`);
    hole1.shots.sort((a, b) => a.shot_number - b.shot_number).forEach(shot => {
        console.log(`  Shot ${shot.shot_number}: ${shot.shot_value} (${shot.location_code}, ${shot.distance}m)`);
    });
}

checkHole1('18b019ab-ed00-41e5-b073-0d7ca4d7bbea');
