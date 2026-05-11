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

async function checkUsers() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    const { data: users, error } = await supabase.from('users').select('*');
    if (error) {
        console.error('Error fetching users:', error);
        return;
    }

    console.log('--- ALL USERS ---');
    console.log(JSON.stringify(users, null, 2));

    // Specifically check for "황정욱"
    const target = '황정욱';
    const found = users.filter(u => u.name === target);
    console.log(`\nSearching for "${target}":`, found.length > 0 ? 'FOUND' : 'NOT FOUND');
    if (found.length > 0) {
        console.log('Details:', found);
    } else {
        // Try to find partial matches or normalized matches
        const partials = users.filter(u => u.name && u.name.includes(target));
        console.log('Partial matches:', partials);
    }
}

checkUsers();
