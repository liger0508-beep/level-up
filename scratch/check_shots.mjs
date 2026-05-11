import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kvajcjtoserjhkdeatlh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2YWpjanRvc2VyamhrZGVhdGxoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM2MjM4MCwiZXhwIjoyMDkyOTM4MzgwfQ.RRc8nqdDBxKcf4Mp8ORX_VeZB8tcp2YhCj3X9D6hQXU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkHoles() {
    const scorecardId = 'c87b46bc-7449-41bb-894a-197e92e071fd';
    const { data, error } = await supabase
        .from('scorecards')
        .select(`
            id,
            holes:scorecard_holes(
                hole_number, par, score,
                shots:scorecard_shots(*)
            )
        `)
        .eq('id', scorecardId)
        .single();

    if (error) {
        console.error('Error fetching scorecard:', error);
        return;
    }

    const hole4 = data.holes.find(h => h.hole_number === 4);
    const hole5 = data.holes.find(h => h.hole_number === 5);

    console.log('=== Hole 4 ===');
    hole4.shots.sort((a, b) => a.shot_number - b.shot_number).forEach(s => {
        console.log(`Shot ${s.shot_number}: loc=${s.location_code} dist=${s.distance} val=${s.shot_value}`);
    });

    console.log('=== Hole 5 ===');
    hole5.shots.sort((a, b) => a.shot_number - b.shot_number).forEach(s => {
        console.log(`Shot ${s.shot_number}: loc=${s.location_code} dist=${s.distance} val=${s.shot_value}`);
    });
}

checkHoles();
