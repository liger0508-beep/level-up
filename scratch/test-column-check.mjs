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

async function testColumnCheck() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    
    console.log("Checking if column 'notes' exists...");
    const { error: notesError } = await supabase
        .from("tournament_results")
        .select("notes")
        .limit(0);
        
    const hasNotes = !notesError;
    console.log("notes column exists?", hasNotes, notesError ? notesError.message : "No error");

    console.log("Checking if column 'daily_score' exists...");
    const { error: scoreError } = await supabase
        .from("tournament_results")
        .select("daily_score")
        .limit(0);
        
    const hasScore = !scoreError;
    console.log("daily_score column exists?", hasScore, scoreError ? scoreError.message : "No error");
}

testColumnCheck();
