const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => { const [k, v] = line.split('='); if(k && v) acc[k.trim()] = v.trim(); return acc; }, {});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
supabase
    .from("records")
    .select(`
        id,
        type,
        category,
        title,
        content,
        media_urls,
        created_at,
        user:users!records_user_id_fkey(name),
        coach:users!records_coach_id_fkey(name)
    `)
    .eq("id", "d5f291e8-e237-401e-9fd4-c3f0b0e2635f")
    .single()
    .then(res => console.log(JSON.stringify(res, null, 2)));
