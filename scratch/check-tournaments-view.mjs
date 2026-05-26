import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

function getEnv() {
    const envPath = path.join(process.cwd(), '.env.local');
    const content = fs.readFileSync(envPath, 'utf8');
    const env = {};
    content.split('\n').forEach(line => {
        const cleanLine = line.replace('\r', '').trim();
        if (!cleanLine || cleanLine.startsWith('#')) return;
        const [key, ...value] = cleanLine.split('=');
        if (key && value) env[key.trim()] = value.join('=').trim();
    });
    return env;
}

async function checkTournamentsView() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    
    // Check tournaments first
    const { data: tournaments } = await supabase
        .from('tournaments')
        .select('*')
        .limit(1);
    console.log("Sample Tournament:", tournaments[0]);

    // Check schedules
    if (tournaments[0]) {
        const { data: schedule, error: sErr } = await supabase
            .from('schedules')
            .select('*')
            .eq('id', tournaments[0].id);
        console.log("Schedule matching tournament ID:", schedule, sErr ? sErr.message : "No error");
    }
}

checkTournamentsView();
