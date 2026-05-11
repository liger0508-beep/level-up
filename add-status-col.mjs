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

    const { error } = await supabase.rpc('execute_sql', {
        sql_string: "alter table public.users add column if not exists status text default 'active';"
    });

    if (error) {
        console.error('RPC execute_sql might not exist. If so, we must run the SQL manually or create the function.');
        console.error(error);
    } else {
        console.log('Successfully added status column.');
    }
}

addStatusColumn();
