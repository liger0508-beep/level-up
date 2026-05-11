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

async function checkCategories() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    console.log('\nChecking records...');
    const { data: records, error: recError } = await supabase
        .from('records')
        .select('category');

    if (recError) {
        console.error('Error fetching records:', recError);
    } else {
        const recCats = [...new Set(records.map(i => i.category))];
        console.log('Records currently in DB categories:', recCats);
    }
}

checkCategories();
