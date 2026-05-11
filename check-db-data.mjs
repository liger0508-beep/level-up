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

async function checkData() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    console.log("Checking data in public.users...");

    // 1. Count total users
    const { count, error: countError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

    if (countError) {
        console.error("❌ Error counting users:", countError.message);
    } else {
        console.log(`✅ Total users in DB: ${count}`);
    }

    // 2. Check roles distribution
    const { data: roles, error: roleError } = await supabase
        .from('users')
        .select('role');

    if (roles) {
        const counts = {};
        roles.forEach(r => counts[r.role] = (counts[r.role] || 0) + 1);
        console.log("✅ Role distribution:", counts);
    }

    // 3. Sample check
    const { data: sample, error: sampleError } = await supabase
        .from('users')
        .select('*')
        .limit(3);

    if (sample) {
        console.log("✅ Data sample:", JSON.stringify(sample, null, 2));
    }
}

checkData();
