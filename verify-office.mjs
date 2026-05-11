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

async function verifyOffice() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    const { data } = await supabase
        .from('users')
        .select('*')
        .eq('branch', '오피스')
        .eq('role', 'coach');

    console.log(`Found ${data?.length} coaches with branch '오피스':`);
    console.table(data?.map(d => ({ name: d.name, level: d.level, branch: d.branch })));
}

verifyOffice();
