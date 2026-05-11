const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function check() {
    const envText = fs.readFileSync('.env.local', 'utf8');
    const env = envText.split('\n').reduce((a, l) => {
        const [k, ...v] = l.split('=');
        if (k && v) a[k.trim()] = v.join('=').trim().replace(/^"|"$/g, '');
        return a;
    }, {});

    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    console.log('Checking constraints for public.records.category...');
    const { data, error } = await supabase.rpc('execute_sql', {
        sql_string: "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'public.records'::regclass AND contype = 'c';"
    });

    if (error) {
        console.error('RPC Error:', error);
        // Fallback: Try a simple query if RPC fails
        const { data: records, error: fetchError } = await supabase.from('records').select('category').limit(1);
        if (fetchError) console.error('Fetch Error:', fetchError);
        else console.log('Successfully fetched at least one record category:', records[0]?.category);
    } else {
        console.log('Constraints:', JSON.stringify(data, null, 2));
    }
}

check();
