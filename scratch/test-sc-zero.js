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

async function testScorecardZero() {
  const { data: user } = await supabase.from('users').select('id').limit(1).single();
  if (!user) return;

  console.log('Testing insert scorecard with total_score 0');
  const { data, error } = await supabase.from('scorecards').insert({
    athlete_id: user.id,
    coach_id: user.id,
    round_date: '2026-05-12',
    course_name: 'Test Course',
    total_score: 0,
    distance_unit: '미터'
  }).select('id').single();

  if (error) {
    console.log('Insert scorecard 0 failed:', error.message);
  } else {
    console.log('Insert scorecard 0 succeeded');
    await supabase.from('scorecards').delete().eq('id', data.id);
  }
}

testScorecardZero();
