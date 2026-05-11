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

async function syncAdmin() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    console.log('--- Syncing Admins/Coaches ---');

    const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) {
        console.error('Failed to list auth users:', authError.message);
        return;
    }

    for (const authUser of authUsers) {
        const name = authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Unknown';
        // Force admin role if it's an admin user in auth or metadata
        let role = authUser.user_metadata?.role || 'athlete';

        console.log(`User: ${name}, Auth ID: ${authUser.id}, Metadata Role: ${role}`);

        const { error: upsertError } = await supabase.from('users').upsert({
            id: authUser.id,
            name: name,
            role: role,
            updated_at: new Date().toISOString()
        });

        if (upsertError) {
            console.error(`Failed to sync ${name}:`, upsertError.message);
        } else {
            console.log(`Synced ${name} as ${role}.`);
        }
    }
}

syncAdmin();
