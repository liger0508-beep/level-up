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

async function dump() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: users } = await supabase.from('users').select('*');
    const { data: auth } = await supabase.auth.admin.listUsers();

    console.log("=== USERS IN PUBLIC.USERS ===");
    users.forEach(u => console.log(`${u.name} | Role: ${u.role} | ID: ${u.id}`));

    console.log("=== USERS IN AUTH.USERS ===");
    auth.users.forEach(u => console.log(`${u.email} | ID: ${u.id} | Meta: ${JSON.stringify(u.user_metadata)}`));
}
dump();
