import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function test() {
  const ids = ['51e909c3-3122-4f66-b034-9d30985499bc', '4b2c42d6-1413-472b-b2b6-a86390064ed6'];
  const { data: records, error } = await supabase.from('records').select('user_id, count').in('user_id', ids);
  
  const { data: r1 } = await supabase.from('records').select('id').eq('user_id', ids[0]);
  const { data: r2 } = await supabase.from('records').select('id').eq('user_id', ids[1]);
  
  console.log('Old account records count:', r1?.length);
  console.log('New account records count:', r2?.length);
  
  const { data: t1 } = await supabase.from('test_sessions').select('id').eq('user_id', ids[0]);
  const { data: t2 } = await supabase.from('test_sessions').select('id').eq('user_id', ids[1]);
  console.log('Old account tests count:', t1?.length);
  console.log('New account tests count:', t2?.length);
}
test();
