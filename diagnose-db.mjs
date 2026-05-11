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

async function diagnose() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    console.log('--- Diagnosis Report ---');

    // 1. Check records
    const { count: recordCount, error: recordError } = await supabase.from('records').select('*', { count: 'exact', head: true });
    console.log('Record Count:', recordError ? `ERROR: ${recordError.message}` : recordCount);

    // 2. Check users count
    const { count: userCount, error: userError } = await supabase.from('users').select('*', { count: 'exact', head: true });
    console.log('Public Users Count:', userError ? `ERROR: ${userError.message}` : userCount);

    // 3. List some records to see structure
    if (recordCount > 0) {
        const { data: recentRecords } = await supabase.from('records').select('*').limit(3);
        console.log('Recent Records:', recentRecords);
    }

    // 4. Check auth users
    const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();
    console.log('Auth Users Count:', authError ? `ERROR: ${authError.message}` : authUsers.length);
    if (authUsers && authUsers.length > 0) {
        console.log('Example Auth User:', { id: authUsers[0].id, email: authUsers[0].email, user_metadata: authUsers[0].user_metadata });
    }
}

diagnose();
