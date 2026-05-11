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
    if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('Missing Supabase environment variables in .env.local');
        return;
    }
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    console.log('--- Creating Comments Table ---');

    const sql = `
        CREATE TABLE IF NOT EXISTS public.comments (
          id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
          record_id uuid REFERENCES public.records(id) ON DELETE CASCADE NOT NULL,
          user_id uuid REFERENCES public.users(id) NOT NULL,
          content text,
          media_url text,
          media_type text,
          created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
        );

        -- Enable RLS
        ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

        -- Policies
        DROP POLICY IF EXISTS "Anyone can view comments" ON public.comments;
        CREATE POLICY "Anyone can view comments" ON public.comments FOR SELECT USING ( true );

        DROP POLICY IF EXISTS "Authenticated users can insert comments" ON public.comments;
        CREATE POLICY "Authenticated users can insert comments" ON public.comments FOR INSERT WITH CHECK ( auth.uid() = user_id );

        DROP POLICY IF EXISTS "Authors can delete own comments" ON public.comments;
        CREATE POLICY "Authors can delete own comments" ON public.comments FOR DELETE USING ( auth.uid() = user_id );
    `;

    // Attempt to execute SQL via the execute_sql function if it exists
    const { error } = await supabase.rpc('execute_sql', { sql_string: sql });

    if (error) {
        console.error('Migration failed via RPC:', error.message);
        console.log('\nPlease run the following SQL manually in your Supabase SQL Editor:');
        console.log('------------------------------------------------------------------');
        console.log(sql);
        console.log('------------------------------------------------------------------');
    } else {
        console.log('Successfully created comments table and setup RLS policies.');
    }
}

updateSchema();
