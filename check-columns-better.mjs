import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

function getEnv() {
    const envPath = path.join(process.cwd(), '.env.local');
    const content = fs.readFileSync(envPath, 'utf8');
    const env = {};
    content.split('\n').forEach(line => {
        const [key, ...value] = line.split('=');
        if (key && value) env[key.trim()] = value.join('=').trim();
    });
    return env;
}

async function listColumns() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    const { data: columns, error } = await supabase
        .rpc('get_columns', { table_name: 'users' });

    if (error) {
        // If RPC doesn't exist, try a simple select again but stringify it
        const { data, error: selectError } = await supabase.from('users').select('*').limit(1);
        if (selectError) {
            console.error('Error:', selectError);
        } else if (data && data.length > 0) {
            console.log('Columns:', JSON.stringify(Object.keys(data[0]), null, 2));
        } else {
            console.log('No data to inspect.');
        }
    } else {
        console.log('Columns (via RPC):', columns);
    }
}

listColumns();
