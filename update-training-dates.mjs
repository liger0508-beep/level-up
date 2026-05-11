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

async function updateTrainingDates() {
    const env = getEnv();
    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('SUPABASE_SERVICE_ROLE_KEY is missing in .env.local');
        return;
    }
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    console.log('Adding training_start and training_end columns to public.records...');

    const { error } = await supabase.rpc('execute_sql', {
        sql_string: `
            alter table public.records add column if not exists training_start date;
            alter table public.records add column if not exists training_end date;
        `
    });

    if (error) {
        console.error('Error executing SQL via RPC:');
        console.error(error);
        console.log('\nPlease run the following SQL manually in Supabase SQL editor:');
        console.log(`
            alter table public.records add column if not exists training_start date;
            alter table public.records add column if not exists training_end date;
        `);
    } else {
        console.log('Successfully updated records table schema with training dates.');
    }
}

updateTrainingDates();
