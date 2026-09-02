import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kvajcjtoserjhkdeatlh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2YWpjanRvc2VyamhrZGVhdGxoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM2MjM4MCwiZXhwIjoyMDkyOTM4MzgwfQ.RRc8nqdDBxKcf4Mp8ORX_VeZB8tcp2YhCj3X9D6hQXU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const scorecardId = 'd0839c68-d489-4297-8dbb-ca59309ee3b1';

    // 1. Check holes
    const { data: holes } = await supabase.from('scorecard_holes').select('*').eq('scorecard_id', scorecardId);
    console.log("Holes:", holes?.length);

    // 2. Check shots
    const { data: shots } = await supabase.from('scorecard_shots').select('*').eq('scorecard_id', scorecardId);
    console.log("Shots:", shots?.length);
    if (shots?.length === 0) {
        console.log("NO SHOTS RECORDED!");
    } else {
        console.log("First shot:", shots?.[0]);
    }
}
main();
