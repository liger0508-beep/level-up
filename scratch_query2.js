const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
(async () => {
    const { data, error } = await supabase.from('records').select('id, type, template_settings').limit(1);
    console.log("DATA:", JSON.stringify(data, null, 2));
    console.log("ERROR:", JSON.stringify(error, null, 2));
})();
