
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://kvajcjtoserjhkdeatlh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2YWpjanRvc2VyamhrZGVhdGxoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM2MjM4MCwiZXhwIjoyMDkyOTM4MzgwfQ.RRc8nqdDBxKcf4Mp8ORX_VeZB8tcp2YhCj3X9D6hQXU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runSql() {
    const sqlFile = process.argv[2];
    if (!sqlFile) {
        console.error('Usage: node run-sql.js <sql-file>');
        return;
    }

    const sql = fs.readFileSync(sqlFile, 'utf8');
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
        console.error('Error running SQL:', error);
        // Fallback to direct fetch if exec_sql is not available
        console.log('Attempting direct SQL execution via postgres if possible... (Wait, Supabase SDK doesn\'t support direct SQL unless rpc is defined)');
    } else {
        console.log('SQL executed successfully:', data);
    }
}

runSql();
