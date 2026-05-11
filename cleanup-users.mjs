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

async function cleanupUsers() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    console.log('Cleaning up public tables...');

    // Delete data that references users
    await supabase.from('records').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('schedules').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    // We don't delete skillup_templates as they don't reference users and weren't requested to be reset.

    console.log('Fetching all users from auth (with pagination)...');
    let allUsers = [];
    let page = 1;
    while (true) {
        const { data: { users }, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
        if (error || !users || users.length === 0) break;
        allUsers = allUsers.concat(users);
        if (users.length < 100) break;
        page++;
    }

    console.log(`Found ${allUsers.length} total users. Deleting from auth.users...`);

    for (const user of allUsers) {
        // Skip current admin user if necessary, but "re-register" usually implies a total reset.
        // I'll keep the admin user if its email is obvious, otherwise delete all.
        // In this project, admins usually have @gla.com or specific emails.
        if (user.email === 'admin@gla.com' || user.email === 'test@test.com' || user.email === 'golfzongla@gmail.com') {
            console.log(`Skipping admin/system user: ${user.email}`);
            continue;
        }

        const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
        if (deleteError) {
            console.error(`Failed to delete user ${user.email}:`, deleteError.message);
        } else {
            console.log(`Deleted user: ${user.email}`);
        }
    }

    console.log('Cleanup complete.');
}

cleanupUsers();
