import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Function to parse .env.local manually to avoid dependency issues
function getEnv() {
    const envPath = path.join(process.cwd(), '.env.local');
    const content = fs.readFileSync(envPath, 'utf8');
    const env = {};
    content.split('\n').forEach(line => {
        const [key, ...value] = line.split('=');
        if (key && value) {
            env[key.trim()] = value.join('=').trim();
        }
    });
    return env;
}

async function diagnose() {
    const env = getEnv();
    const url = env.NEXT_PUBLIC_SUPABASE_URL;
    const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
        console.error("❌ Env variables not found");
        return;
    }

    const supabase = createClient(url, key);

    console.log("--- Supabase Diagnosis ---");

    // 1. Check if we can reach the URL
    try {
        console.log("Checking connection to:", url);
        // 2. Check if 'users' table exists
        const { data, error } = await supabase.from('users').select('*').limit(1);

        if (error) {
            console.log("❌ Error Code:", error.code);
            console.log("❌ Error Message:", error.message);

            if (error.code === '42P01') {
                console.log("\n👉 [진단 결과] 테이블이 없습니다! 2단계(SQL 실행)를 다시 확인해 주세요.");
            } else if (error.code === 'PGRST301' || error.message.includes('JWT')) {
                console.log("\n👉 [진단 결과] API Key가 올바르지 않습니다. 복사할 때 오타가 없었는지 확인해 주세요.");
            }
        } else {
            console.log("✅ Success! Connection and Table access OK.");
        }
    } catch (e) {
        console.error("❌ Fatal Error:", e.message);
    }
}

diagnose();
