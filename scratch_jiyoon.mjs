import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kvajcjtoserjhkdeatlh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2YWpjanRvc2VyamhrZGVhdGxoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM2MjM4MCwiZXhwIjoyMDkyOTM4MzgwfQ.RRc8nqdDBxKcf4Mp8ORX_VeZB8tcp2YhCj3X9D6hQXU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    // 1. Find athlete
    const { data: users } = await supabase.from('users').select('id, name').eq('name', '박지윤');
    console.log("Users:", users);
    
    if (!users || users.length === 0) return;
    const athleteId = users[0].id;

    // 2. Find scorecards on 7/29
    const { data: scorecards } = await supabase.from('scorecards').select('*').eq('athlete_id', athleteId).eq('round_date', '2026-07-29');
    console.log("Scorecards on 7/29:", scorecards);

    if (!scorecards || scorecards.length === 0) return;
    const scorecardId = scorecards[0].id;

    // 3. Check holes for that scorecard
    const { data: holes } = await supabase.from('scorecard_holes').select('*').eq('scorecard_id', scorecardId);
    console.log("Holes (count):", holes?.length);

    // 4. Check training_sessions linked to this scorecard
    const { data: training, error: trainingError } = await supabase.from('records').select('*').eq('type', 'training').eq('user_id', athleteId);
    if (training) {
        const linked = training.filter(t => 
            t.template_settings && 
            t.template_settings.some(s => s.scorecardId === scorecardId)
        );
        console.log("Linked Training Sessions:", linked);
    }
    console.log("Error:", trainingError);
}

main().catch(console.error);
