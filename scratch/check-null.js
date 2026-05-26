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

async function checkNullable() {
  // We can't directly check nullability via RPC easily without custom functions, 
  // but we can try to insert NULL.
  const { data: sc } = await supabase.from('scorecards').select('id').limit(1).single();
  if (!sc) return;

  console.log('Testing insert with score NULL');
  const { error } = await supabase.from('scorecard_holes').insert({
    scorecard_id: sc.id,
    hole_number: 17, // use another number
    par: 4,
    score: null
  });

  if (error) {
    console.log('Insert NULL failed:', error.message);
  } else {
    console.log('Insert NULL succeeded');
    await supabase.from('scorecard_holes').delete().eq('scorecard_id', sc.id).eq('hole_number', 17);
  }
}

checkNullable();
