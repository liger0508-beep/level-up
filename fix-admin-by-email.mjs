import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) env[key.trim()] = value.trim();
});

const supabase = createClient(
    env['NEXT_PUBLIC_SUPABASE_URL'],
    env['SUPABASE_SERVICE_ROLE_KEY']
);

async function fixUserByEmail(email) {
    console.log(`Checking auth users for ${email}...`);
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
        console.error('Error listing auth users:', authError);
        return;
    }

    const authUser = users.find(u => u.email === email);
    if (!authUser) {
        console.error(`No auth user found with email ${email}`);
        return;
    }

    console.log(`Found auth user ID: ${authUser.id}. Updating public.users role...`);

    const { error: updateError } = await supabase
        .from('users')
        .update({ role: 'admin' })
        .eq('id', authUser.id);

    if (updateError) {
        console.error('Error updating public user:', updateError);
    } else {
        console.log(`Successfully updated role to admin for ${email}`);
    }
}

fixUserByEmail('admin@gla.com');
