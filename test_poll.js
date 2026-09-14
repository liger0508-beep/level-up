require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function test() {
  const { data, error } = await supabase
    .from('polls')
    .insert([{
      type: 'all',
      branch: '전체',
      status: 'ongoing',
      title: 'test',
      description: 'test',
      options: [{ id: 'opt_1', text: 'option 1', votes: 0 }],
      start_date: new Date().toISOString(),
    }])
    .select();

  console.log('Error:', error);
  console.log('Data:', data);
}

test();
