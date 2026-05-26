
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kvajcjtoserjhkdeatlh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2YWpjanRvc2VyamhrZGVhdGxoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM2MjM4MCwiZXhwIjoyMDkyOTM4MzgwfQ.RRc8nqdDBxKcf4Mp8ORX_VeZB8tcp2YhCj3X9D6hQXU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
    const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'scorecards' });
    if (error) {
        // If RPC doesn't exist, try a simple select
        const { data: selectData, error: selectError } = await supabase.from('scorecards').select('*').limit(1);
        if (selectError) {
            console.error('Error fetching scorecards:', selectError);
            return;
        }
        console.log('Columns:', Object.keys(selectData[0] || {}));
    } else {
        console.log('Columns:', data);
    }
}

checkColumns();
