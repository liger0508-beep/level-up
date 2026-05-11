import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

function getEnv() {
    const envPath = path.join(process.cwd(), '.env.local');
    const content = fs.readFileSync(envPath, 'utf8');
    const env = {};
    content.split('\n').filter(l => l.trim()).forEach(line => {
        const [key, ...value] = line.split('=');
        if (key && value) env[key.trim()] = value.join('=').trim();
    });
    return env;
}

async function fixInternal() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    if (error) return;

    for (const u of users) {
        if (u.email === 'admin@gla.com' || u.email === 'admin') {
            console.log('Found admin@gla.com! Syncing...');
            const { data, error: upsertError } = await supabase.from('users').upsert({
                id: u.id,
                name: '관리자',
                role: 'admin'
            }).select();
            console.log(upsertError ? `Sync Error: ${upsertError.message}` : `Sync Success: ${JSON.stringify(data)}`);
        }
    }
}

fixInternal();
