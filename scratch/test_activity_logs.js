import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function test() {
  const { data, error } = await supabase.from('user_activity_logs').select('*').limit(5);
  console.log('user_activity_logs data:', data, 'error:', error);
}
test();
