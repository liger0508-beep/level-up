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

async function createAdmin() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    const email = 'admin@gla.com';
    const password = 'admin1!';
    const name = '슈퍼관리자';
    const role = 'admin';

    console.log(`Creating admin account: ${email}...`);

    // 1. Create user in Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
            name,
            role
        }
    });

    if (authError) {
        console.error('❌ Failed to create auth user:', authError.message);
        return;
    }

    const userId = authData.user.id;
    console.log(`✅ Auth user created: ${userId}`);

    // The trigger 'on_auth_user_created' should have already added the user to 'public.users'.
    // Let's verify and update just in case.
    await new Promise(resolve => setTimeout(resolve, 1000));

    const { error: updateError } = await supabase
        .from('users')
        .update({ role: 'admin' })
        .eq('id', userId);

    if (updateError) {
        console.error('❌ Failed to set role as admin in users table:', updateError.message);
    } else {
        console.log('✅ Successfully created admin account and set role.');
    }
}

createAdmin();
