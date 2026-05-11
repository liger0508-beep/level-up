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

async function restoreUsers() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    console.log('Fetching users from auth.users...');
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
        console.error('Failed to list auth users:', authError);
        return;
    }

    console.log(`Found ${users.length} users in auth. Restoring to public.users...`);

    for (const user of users) {
        const { error: dbError } = await supabase
            .from('users')
            .upsert({
                id: user.id,
                name: user.user_metadata.name || 'User',
                role: user.user_metadata.role || 'athlete',
                phone: user.user_metadata.phone || ''
            });

        if (dbError) {
            console.error(`Failed to restore ${user.email}:`, dbError.message);
        } else {
            console.log(`Restored: ${user.user_metadata.name} (${user.email})`);
        }
    }
    console.log('Restoration complete!');
}

restoreUsers();
