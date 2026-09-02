import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
supabase.from('sg_baseline').select('distance_m, app_25m').lte('distance_m', 5).order('distance_m').then((res) => {
    console.log(res.data);
});
