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

async function inspectScores() {
  const { data, error } = await supabase.from('scorecard_holes').select('score').limit(100);
  if (error) {
    console.error(error);
  } else {
    const minScore = Math.min(...data.map(d => d.score).filter(s => s !== null));
    const maxScore = Math.max(...data.map(d => d.score).filter(s => s !== null));
    const hasNull = data.some(d => d.score === null);
    const hasZero = data.some(d => d.score === 0);
    console.log(`Min score: ${minScore}, Max score: ${maxScore}, Has Null: ${hasNull}, Has Zero: ${hasZero}`);
  }
}
inspectScores();
