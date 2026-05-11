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

async function checkSchema() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    // Try to fetch a single row to see columns
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching one user:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Columns in public.users:', Object.keys(data[0]));
    } else {
        console.log('No users found to inspect columns.');
        // fallback to query information_schema if possible, but easier to just check and insert one test row
    }
}

checkSchema();
