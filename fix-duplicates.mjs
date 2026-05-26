import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val.length > 0) {
      env[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const targetId = 'ca7da69c-1ad3-461f-add0-c0901fbf9040';

async function fix() {
  const { data: holes, error } = await supabase
    .from('scorecard_holes')
    .select('id, hole_number')
    .eq('scorecard_id', targetId)
    .gte('hole_number', 10);
    
  if (error) {
    console.error('Error fetching:', error);
    return;
  }
  
  const defaultShots = ["TE", "FW", "GR", "GR", "HI"];
  const newShots = [];
  
  holes.forEach(h => {
      defaultShots.forEach((loc, idx) => {
          newShots.push({
              scorecard_id: targetId,
              hole_id: h.id,
              hole_number: h.hole_number,
              shot_number: idx + 1,
              location_code: loc,
              distance: null,
              shot_value: 1
          });
      });
  });

  const { error: insErr } = await supabase.from('scorecard_shots').insert(newShots);
  if (insErr) {
      console.error('Error inserting default shots:', insErr);
  } else {
      console.log('Successfully reset holes 10-18 to default Par 4 shots.');
  }
}

fix();
