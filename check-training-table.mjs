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

async function checkTable() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    console.log('Checking if training_templates table exists...');
    const { error } = await supabase.from('training_templates').select('id').limit(1);
    if (error) {
        console.log('Table training_templates does NOT exist or error:', error.message);
    } else {
        console.log('Table training_templates EXISTS!');
    }
}

checkTable();
