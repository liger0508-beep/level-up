import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

function getEnv() {
    const envPath = path.join(process.cwd(), '.env.local');
    const content = fs.readFileSync(envPath, 'utf8');
    const env = {};
    content.split('\n').forEach(line => {
        const [key, ...value] = line.split('=');
        if (key && value) env[key.trim()] = value.join('=').trim();
    });
    return env;
}

async function check() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    console.log('--- Checking records table ---');
    const { data: rData, error: rErr } = await supabase.from('records').select('category').limit(10);
    if (rErr) console.error('Records fetch error:', rErr);
    else console.log('Sample category in records:', [...new Set(rData.map(d => d.category))]);
}

check();
