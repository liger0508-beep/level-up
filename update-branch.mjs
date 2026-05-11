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

async function updateBranch() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    const { data, error } = await supabase
        .from('users')
        .update({ branch: '오피스' })
        .eq('branch', '전체')
        .eq('role', 'coach');

    if (error) {
        console.error('Error updating branch:', error);
    } else {
        console.log('Successfully changed branch from 전체 to 오피스');
    }
}

updateBranch();
