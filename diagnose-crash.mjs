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

async function diagnose() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    console.log('--- DB Diagnosis ---');

    // 1. Check Records table columns
    const { data: recordsData, error: recordsError } = await supabase.from('records').select('*').limit(1);
    if (recordsError) {
        console.log('Records table error:', recordsError.message);
    } else {
        console.log('Records columns:', recordsData.length > 0 ? Object.keys(recordsData[0]) : 'Table empty, cannot see columns via SELECT *');
    }

    // 2. Check Users
    const { data: usersData, error: usersError } = await supabase.from('users').select('name, role');
    if (usersError) {
        console.log('Users table error:', usersError.message);
    } else {
        console.log('Users in DB:', usersData.map(u => `${u.name} (${u.role})`));
    }
}

diagnose();
