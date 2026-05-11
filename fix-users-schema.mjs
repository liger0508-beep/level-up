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

async function fixUsersSchema() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    console.log('Adding missing columns to public.users...');

    // Attempt to add columns one by one to avoid total failure if some exist
    const columns = [
        "alter table public.users add column if not exists status text default '등록';",
        "alter table public.users add column if not exists parent_name text;",
        "alter table public.users add column if not exists parent_phone text;",
        "alter table public.users add column if not exists coach_name text;",
        "alter table public.users add column if not exists memo text;"
    ];

    for (const sql of columns) {
        console.log(`Executing: ${sql}`);
        const { error } = await supabase.rpc('execute_sql', { sql_string: sql });
        if (error) {
            console.error(`Error adding column: ${error.message}`);
            console.log(`Please run manually: ${sql}`);
        }
    }
}

fixUsersSchema();
