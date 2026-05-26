const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => { const [k, v] = line.split('='); if(k && v) acc[k.trim()] = v.trim(); return acc; }, {});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const sql = `
CREATE POLICY "Course management records are viewable by authenticated users" 
ON public.records 
FOR SELECT 
TO authenticated 
USING (type = 'course_management');
`;
supabase.rpc('run_sql', { query: sql }).then(res => console.log(res));
