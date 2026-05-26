const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
(async () => {
    const { data, error } = await supabase.from('records').select('*').eq('type', 'training').like('title', '%복습%').order('created_at', { ascending: false }).limit(5);
    console.log(JSON.stringify(data, null, 2));
    console.log('Error:', error);
})();
