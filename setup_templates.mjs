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

const sql = `
CREATE TABLE IF NOT EXISTS public.lesson_templates (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  "categoryId" text NOT NULL,
  title text NOT NULL,
  description text,
  "imageUrl" text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.lesson_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public lesson templates access" ON public.lesson_templates;
CREATE POLICY "Public lesson templates access" ON public.lesson_templates FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow temp insert for test" ON public.lesson_templates;
CREATE POLICY "Allow temp insert for test" ON public.lesson_templates FOR ALL USING (true);
`;

async function run() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    // forcefully create table
    const { error } = await supabase.rpc('execute_sql', { sql_string: sql });
    if (error) {
        console.error("RPC Error:", error.message);
    } else {
        console.log("Created lesson_templates successfully via RPC.");
    }
}
run();
