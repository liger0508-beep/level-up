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

async function testScoreConstraints() {
  const { data: sc } = await supabase.from('scorecards').select('id').limit(1).single();
  if (!sc) return;

  const testValues = [-1, 0, 1, 20, 21, 99, null];
  
  for (const val of testValues) {
    await supabase.from('scorecard_holes').delete().eq('scorecard_id', sc.id).eq('hole_number', 18);
    const { error } = await supabase.from('scorecard_holes').insert({
      scorecard_id: sc.id,
      hole_number: 18,
      par: 4,
      score: val
    });
    
    if (error) {
      console.log(`Score ${val} FAILED:`, error.message);
    } else {
      console.log(`Score ${val} SUCCEEDED`);
    }
  }
  
  await supabase.from('scorecard_holes').delete().eq('scorecard_id', sc.id).eq('hole_number', 18);
}
testScoreConstraints();
