import { createClient } from "@supabase/supabase-js";
import fs from 'fs';
import path from 'path';

function getEnv() {
    const envPath = path.join(process.cwd(), '.env.local');
    const content = fs.readFileSync(envPath, 'utf8');
    const env: Record<string, string> = {};
    content.split('\n').filter(l => l.trim()).forEach(line => {
        const [key, ...value] = line.split('=');
        if (key && value) env[key.trim()] = value.join('=').trim();
    });
    return env;
}

async function check() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    
    console.log("Checking tables...");
    
    const t1 = await supabase.from('users').select('count').limit(1);
    console.log("Users table check:", t1.error ? t1.error.message : "OK");

    const t2 = await supabase.from('tournament_results').select('count').limit(1);
    console.log("Tournament results table check:", t2.error ? t2.error.message : "OK");
}

check();
