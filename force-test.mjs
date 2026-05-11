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

async function forceInsert() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    console.log("Force inserting 1 athlete directly to public.users...");

    const { data, error } = await supabase
        .from('users')
        .insert([
            {
                id: '00000000-0000-0000-0000-000000000000', // 임시 테스트 ID
                name: '연결테스트',
                role: 'athlete',
                branch: '조이마루',
                level: '테스트'
            }
        ])
        .select();

    if (error) {
        console.error("❌ Direct Insert Error:", error.message);
        console.error("❌ Error Code:", error.code);
    } else {
        console.log("✅ Success! Data inserted:", data);
    }
}

forceInsert();
