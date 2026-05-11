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

async function syncUsers() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    console.log('--- Syncing Auth Users to Public Users ---');

    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) {
        console.error('Failed to list auth users:', authError.message);
        return;
    }

    for (const user of users) {
        console.log(`Syncing user: ${user.email} (${user.id})`);
        const { error: syncError } = await supabase
            .from('users')
            .upsert({
                id: user.id,
                name: user.user_metadata?.name || user.email.split('@')[0],
                role: user.user_metadata?.role || 'athlete',
                phone: user.user_metadata?.phone || null,
                created_at: user.created_at
            });

        if (syncError) {
            console.error(`Failed to sync user ${user.email}:`, syncError.message);
        } else {
            console.log(`Successfully synced ${user.email}`);
        }
    }

    console.log('--- Sync Complete ---');
}

syncUsers();
