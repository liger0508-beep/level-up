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

async function registerUser() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    const email = 'liger0508@naver.com';
    const password = 'ghkdwjddnr1!';
    const name = '황정욱';
    const branch = '오피스';
    const gender = 'male'; // '남자' -> 'male'
    const role = 'athlete';

    console.log(`Registering user: ${email}...`);

    // 1. Sign up user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
            name,
            role,
            phone: '010-0000-0000'
        }
    });

    if (authError) {
        if (authError.message.includes('already been registered')) {
            console.log('User already exists in Auth. Proceeding to update users table...');
            // Try to find the user id
            const { data: userData } = await supabase.from('users').select('id').eq('name', name).limit(1).single();
            if (userData) {
                await updateUsersTable(supabase, userData.id, name, branch, gender);
            } else {
                console.error('Could not find existing user in users table by name.');
            }
            return;
        }
        console.error('Error in auth.admin.createUser:');
        console.error(authError);
        return;
    }

    const userId = authData.user.id;
    console.log(`User created in Auth with ID: ${userId}`);

    // Wait a bit for the trigger to finish (though it should be instantaneous)
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 2. Update users table with branch and gender
    await updateUsersTable(supabase, userId, name, branch, gender);
}

async function updateUsersTable(supabase, userId, name, branch, gender) {
    console.log(`Updating users table for: ${name}...`);
    const { error: updateError } = await supabase
        .from('users')
        .update({
            branch,
            gender
        })
        .eq('id', userId);

    if (updateError) {
        console.error('Error updating users table:');
        console.error(updateError);
    } else {
        console.log('Successfully registered and updated user.');
    }
}

registerUser();
