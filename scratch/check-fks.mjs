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

async function checkFKs() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    const { data, error } = await supabase.rpc('get_table_foreign_keys', { t_name: 'records' });

    if (error) {
        console.error('Error fetching FKs:', error);
        // Fallback to manual check if RPC fails
        const { data: cols } = await supabase.from('records').select('*').limit(1);
        console.log('Columns in records:', Object.keys(cols[0] || {}));
        return;
    }

    console.log('Foreign keys in records:', data);
}

checkFKs();
