require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function test() {
  const { data, error } = await supabase
    .from('polls')
    .select('id, title, description')
    .order('created_at', { ascending: false })
    .limit(1);

  console.log('Error:', error);
  console.log('Data:', JSON.stringify(data, null, 2));
}

test();
