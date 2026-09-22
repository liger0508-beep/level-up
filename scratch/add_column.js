const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({path: '.env.local'});
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function addNoticeColumn() {
  const { data, error } = await supabase.rpc('exec_sql', {
    sql_string: "ALTER TABLE score_tournaments ADD COLUMN IF NOT EXISTS notice TEXT;"
  });
  console.log("RPC result:", error || "Success");
  
  // if rpc fails, we can't alter table via anon key easily without pg
}
addNoticeColumn();
