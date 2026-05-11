import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kvajcjtoserjhkdeatlh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2YWpjanRvc2VyamhrZGVhdGxoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM2MjM4MCwiZXhwIjoyMDkyOTM4MzgwfQ.RRc8nqdDBxKcf4Mp8ORX_VeZB8tcp2YhCj3X9D6hQXU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const { data, error } = await supabase.from('sg_location_penalty').select('*');
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Data:', JSON.stringify(data, null, 2));
    }
}

test();
