const { createClient } = require('@supabase/supabase-client');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const { data, error } = await supabase
    .from('poll_responses')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Sample Data:', data);
  }

  // Try to get column names by selecting from information_schema
  const { data: columns, error: colError } = await supabase
    .rpc('get_table_columns', { table_name: 'poll_responses' });
  
  if (colError) {
    // If RPC doesn't exist, try a generic query
    const { data: cols, error: err } = await supabase.from('poll_responses').select().limit(0);
    console.log('Columns from select:', Object.keys(cols?.[0] || {}));
  } else {
    console.log('Columns:', columns);
  }
}

checkSchema();
