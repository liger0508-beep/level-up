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

async function addNotesColumn() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    
    console.log("Adding notes column to tournament_results via exec_sql RPC...");
    
    const sql = `ALTER TABLE tournament_results ADD COLUMN IF NOT EXISTS notes TEXT;`;
    
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.error("RPC ERROR:", JSON.stringify(error, null, 2));
    } else {
        console.log("Successfully ran ALTER TABLE! Result:", data);
    }
}

addNotesColumn();
