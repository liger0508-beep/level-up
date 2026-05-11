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

async function testInsert() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    console.log('--- Manual Insert Test ---');

    // Get one auth user id
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
    if (authError || users.length === 0) {
        console.error('No auth users to test with');
        return;
    }

    const target = users[0];
    console.log('Attempting to insert/upsert user:', target.id, target.user_metadata?.name);

    const { data, error } = await supabase.from('users').upsert({
        id: target.id,
        name: target.user_metadata?.name || 'Test User',
        role: target.user_metadata?.role || 'athlete'
    }).select();

    if (error) {
        console.error('Insert failed:', error);
    } else {
        console.log('Insert succeeded:', data);
    }

    const { data: all } = await supabase.from('users').select('*');
    console.log('Current users count:', all?.length);
}

testInsert();
