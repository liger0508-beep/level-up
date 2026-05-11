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

async function forceSync() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    console.log('--- Force Syncing ALL Auth Users ---');

    const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) {
        console.error('Auth User List Error:', authError.message);
        return;
    }

    console.log(`Found ${authUsers.length} auth users.`);

    for (const authUser of authUsers) {
        const metadata = authUser.user_metadata || {};
        const name = metadata.name || authUser.email?.split('@')[0] || 'Unknown';
        const role = metadata.raw_user_meta_data?.role || metadata.role || 'athlete'; // Check common metadata paths

        console.log(`Processing: ${name} (AuthID: ${authUser.id}, Role: ${role})`);

        // Use a simpler upsert if the previous one failed due to schema cache (which is weird)
        try {
            const { data, error: upsertError } = await supabase.from('users').upsert({
                id: authUser.id,
                name: name,
                role: role,
                updated_at: new Date().toISOString()
            }).select();

            if (upsertError) {
                console.error(`  Sync failed for ${name}:`, upsertError.message);
            } else {
                console.log(`  Sync success for ${name}. Role: ${role}`);
            }
        } catch (err) {
            console.error(`  Exception syncing ${name}:`, err.message);
        }
    }

    const { data: final } = await supabase.from('users').select('*');
    console.log(`\nFinal public.users count: ${final?.length}`);
    console.log(JSON.stringify(final, null, 2));
}

forceSync();
