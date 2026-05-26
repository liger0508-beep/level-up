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

async function applyMigration() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    
    const migrationPath = path.join(process.cwd(), "supabase", "migrations", "20240514_create_tournament_results.sql");
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log("Applying migration via execute_sql RPC...");
    
    const { data, error } = await supabase.rpc('execute_sql', { sql_string: sql });

    if (error) {
        console.error("RPC ERROR:", JSON.stringify(error, null, 2));
    } else {
        console.log("Migration applied successfully!");
    }
}

applyMigration();
