import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kvajcjtoserjhkdeatlh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2YWpjanRvc2VyamhrZGVhdGxoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM2MjM4MCwiZXhwIjoyMDkyOTM4MzgwfQ.RRc8nqdDBxKcf4Mp8ORX_VeZB8tcp2YhCj3X9D6hQXU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBaseline() {
    const { data, error } = await supabase
        .from('sg_baseline')
        .select('distance_m, putting, bunker, tee_p4')
        .order('distance_m');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Dist | Putt | Bunk | Tee4');
    data.slice(0, 15).forEach(r => {
        console.log(`${r.distance_m.toString().padStart(4)} | ${r.putting.toString().padStart(4)} | ${r.bunker.toString().padStart(4)} | ${r.tee_p4.toString().padStart(4)}`);
    });
}

checkBaseline();
