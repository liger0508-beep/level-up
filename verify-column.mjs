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

async function verifyColumn() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    const { data, error } = await supabase.from('schedules').select('*').limit(1);
    if (error) {
        console.error('Error fetching schedules:', error);
    } else {
        console.log('Sample data:', data[0]);
        if (data[0] && 'status' in data[0]) {
            console.log('Column "status" exists.');
        } else {
            console.log('Column "status" does NOT exist.');
        }
    }
}

verifyColumn();
