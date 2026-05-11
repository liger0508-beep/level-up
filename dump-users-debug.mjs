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

async function dumpUsers() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    const { data: users, error } = await supabase.from('users').select('id, name, role');
    if (error) {
        console.error(error);
        return;
    }

    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) {
        console.error(authError);
        return;
    }

    const authMap = {};
    authUsers.users.forEach(u => authMap[u.id] = u.email);

    console.log(`Total users: ${users.length}`);
    users.forEach(u => {
        console.log(`- ${u.name} (${u.role}): ${authMap[u.id] || 'no email'}`);
    });
}

dumpUsers();
