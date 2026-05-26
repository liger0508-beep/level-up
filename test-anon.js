const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => { const [k, v] = line.split('='); if(k && v) acc[k.trim()] = v.trim(); return acc; }, {});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
supabase
    .from("records")
    .select('id')
    .eq("id", "d5f291e8-e237-401e-9fd4-c3f0b0e2635f")
    .single()
    .then(res => console.log("ANON_KEY RESULT:", res));
