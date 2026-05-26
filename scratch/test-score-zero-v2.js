const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envFile = fs.readFileSync(envPath, 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[key] = value;
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function testInsert() {
  const { data: sc } = await supabase.from('scorecards').select('id').limit(1).single();
  if (!sc) return;

  console.log('Testing insert with score 0 and hole_number 18');
  
  // First delete to avoid unique constraint if it exists
  await supabase.from('scorecard_holes').delete().eq('scorecard_id', sc.id).eq('hole_number', 18);

  const { error } = await supabase.from('scorecard_holes').insert({
    scorecard_id: sc.id,
    hole_number: 18,
    par: 4,
    score: 0
  });

  if (error) {
    console.log('Insert failed with error:', JSON.stringify(error, null, 2));
  } else {
    console.log('Insert succeeded with score 0');
    // Don't cleanup yet so we can check if it really worked
  }
}

testInsert();
