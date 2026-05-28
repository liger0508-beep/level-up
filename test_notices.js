const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*"?([^"\n]+)"?/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY\s*=\s*"?([^"\n]+)"?/);
const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function run() {
    const { data, error } = await supabase.from('notices').insert({
        type: 'course_info',
        branch: 'test',
        title: 'test',
        content: 'test',
        date: '2026-05-28'
    }).select();
    console.log(error || data);
}
run();
