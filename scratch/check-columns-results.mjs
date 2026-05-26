import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

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

async function checkColumns() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    
    console.log("Querying information_schema for tournament_results...");
    
    // We can run an RPC or raw sql if we have one, but we can also just fetch one row or query information_schema if enabled,
    // or try to select all columns to see which ones fail.
    // Let's try to query the table's structure via standard select.
    const { data, error } = await supabase
        .from('tournament_results')
        .select('*')
        .limit(1);

    if (error) {
        console.error("SELECT * ERROR:", error);
    } else {
        console.log("SELECT * SUCCESS! Columns present in returned data:", Object.keys(data[0] || {}));
    }
}

checkColumns();
