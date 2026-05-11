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

async function migrate() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    console.log('Starting DB Migration for Categories...');

    // 1. Migrate records
    console.log('Migrating records table...');

    // putting -> putt
    const { error: e4 } = await supabase
        .from('records')
        .update({ category: 'putt' })
        .eq('category', 'putting');
    if (e4) console.error('Error updating putting -> putt in records:', e4);
    else console.log('Updated putting -> putt in records');

    // around_green -> approach
    const { error: e5 } = await supabase
        .from('records')
        .update({ category: 'approach' })
        .eq('category', 'around_green');
    if (e5) console.error('Error updating around_green -> approach in records:', e5);
    else console.log('Updated around_green -> approach in records');

    // short_game -> approach
    const { error: e6 } = await supabase
        .from('records')
        .update({ category: 'approach' })
        .eq('category', 'short_game');
    if (e6) console.error('Error updating short_game -> approach in records:', e6);
    else console.log('Updated short_game -> approach in records');

    console.log('Migration complete!');
}

migrate();
