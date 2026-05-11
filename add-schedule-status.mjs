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

async function addStatusColumn() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    console.log('Adding status column to schedules table...');
    const { error } = await supabase.rpc('execute_sql', {
        sql_string: "alter table public.schedules add column if not exists status text default 'scheduled';"
    });

    if (error) {
        console.error('Error adding status column:', error);
    } else {
        console.log('Successfully added status column to schedules table.');
    }
}

addStatusColumn();
