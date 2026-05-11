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

async function testConn() {
    const env = getEnv();
    console.log("Checking DB Connection...");
    console.log("URL:", env.NEXT_PUBLIC_SUPABASE_URL);

    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data, error } = await supabase.from('users').select('*').limit(1);

    if (error) {
        console.error("❌ Connection failed or table missing:", error.message);
    } else {
        console.log("✅ Connection successfully established! Table 'users' exists.");
    }
}

testConn();
