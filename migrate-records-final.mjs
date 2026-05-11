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

async function updateSchema() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    console.log('--- Updating Records Table Schema ---');

    const sql = `
        -- Add columns if not exist
        ALTER TABLE public.records ADD COLUMN IF NOT EXISTS title text;
        ALTER TABLE public.records ADD COLUMN IF NOT EXISTS media_urls text[] DEFAULT '{}';

        -- Update category check constraint
        ALTER TABLE public.records DROP CONSTRAINT IF EXISTS records_category_check;
        ALTER TABLE public.records ADD CONSTRAINT records_category_check 
            CHECK (category IN ('shot', 'pitch', 'bunker', 'approach', 'putt', 'physical', 'etc', 'field', 'short_game'));
    `;

    const { error } = await supabase.rpc('execute_sql', { sql_string: sql });

    if (error) {
        console.error('Migration failed:', error.message);
        console.log('\nManual SQL to run:');
        console.log(sql);
    } else {
        console.log('Successfully updated records table schema and constraints.');
    }
}

updateSchema();
