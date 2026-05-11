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

async function deepDiagnose() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    console.log('--- Deep Auth Diagnosis ---');
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    if (error) {
        console.error('List Users Error:', error.message);
        return;
    }

    console.log(`Total Auth Users: ${users.length}`);
    users.forEach((u, i) => {
        console.log(`[${i}] ID: ${u.id}, Email: ${u.email}, Metadata:`, JSON.stringify(u.user_metadata));
    });

    console.log('\n--- Public Users Table ---');
    const { data: dbUsers, error: dbError } = await supabase.from('users').select('*');
    if (dbError) {
        console.error('Fetch Public Users Error:', dbError.message);
    } else {
        console.log(`Total Public Users: ${dbUsers.length}`);
        console.log(JSON.stringify(dbUsers, null, 2));
    }
}

deepDiagnose();
