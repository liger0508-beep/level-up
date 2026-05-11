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

async function updateRecordsSchema() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    console.log('Adding title and media_urls columns to public.records...');

    const { error } = await supabase.rpc('execute_sql', {
        sql_string: `
            alter table public.records add column if not exists title text;
            alter table public.records add column if not exists media_urls text[] default '{}';
        `
    });

    if (error) {
        console.error('Error executing SQL via RPC:');
        console.error(error);
        console.log('\nPlease run the following SQL manually in Supabase SQL editor:');
        console.log(`
            alter table public.records add column if not exists title text;
            alter table public.records add column if not exists media_urls text[] default '{}';
        `);
    } else {
        console.log('Successfully updated records table schema.');
    }
}

updateRecordsSchema();
