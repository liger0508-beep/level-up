import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function createTables() {
    console.log("Checking and creating user_activity_logs table via SQL...");

    // Usually we'd do this via supabase Dashboard SQL editor.
    // Let's generate the SQL and print it out so I can give it to the user.
    const sql = `
CREATE TABLE IF NOT EXISTS public.user_activity_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable insert for authenticated users only" ON public.user_activity_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Enable read access for admins and office" ON public.user_activity_logs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'headquarter', 'office', 'total', 'superadmin')));
    `;
    console.log("SQL to run:\n", sql);

    // Also let's check if we can fetch from it
    const { data, error } = await supabase.from('user_activity_logs').select('*').limit(1);
    if (error) {
        console.log("Error querying user_activity_logs. Table probably doesn't exist:", error.message);
    } else {
        console.log("Table exists! Rows found:", data?.length);
    }
}
createTables();
