import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kvajcjtoserjhkdeatlh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2YWpjanRvc2VyamhrZGVhdGxoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM2MjM4MCwiZXhwIjoyMDkyOTM4MzgwfQ.RRc8nqdDBxKcf4Mp8ORX_VeZB8tcp2YhCj3X9D6hQXU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function addColumns() {
    const { error } = await supabase.rpc('run_sql', {
        sql: `
            ALTER TABLE sg_baseline 
            ADD COLUMN IF NOT EXISTS app_10m NUMERIC,
            ADD COLUMN IF NOT EXISTS app_25m NUMERIC,
            ADD COLUMN IF NOT EXISTS app_30m NUMERIC,
            ADD COLUMN IF NOT EXISTS bunker_25m NUMERIC,
            ADD COLUMN IF NOT EXISTS bunker_30m NUMERIC;
        `
    });

    if (error) {
        console.error('Error adding columns:', error);
    } else {
        console.log('Columns added successfully');
    }
}

addColumns();
