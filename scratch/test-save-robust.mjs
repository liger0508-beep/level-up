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

async function testSave() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    
    // Let's get one tournament first
    const { data: tournaments } = await supabase
        .from('tournaments')
        .select('*')
        .limit(1);

    const tournament = tournaments[0];
    console.log("Found tournament:", tournament.id, tournament.name);

    // Let's test the dynamic column check first
    const { error: columnCheckError } = await supabase
        .from("tournament_results")
        .select("notes")
        .limit(0);
        
    const hasNotesColumn = !columnCheckError;
    console.log("hasNotesColumn:", hasNotesColumn);

    const results = [{
        tournament_id: tournament.id,
        athlete_name: "홍길동",
        round_number: 1,
        round_date: "2026-05-19",
        daily_score: "2",
        daily_rank: 5,
        cumulative_score: 74,
        rank: 5,
        notes: "테스트 비고"
    }];

    const processedResults = hasNotesColumn
        ? results
        : results.map(({ notes, ...rest }) => rest);

    console.log("Payload to upsert:", processedResults);

    const { error: upsertErr } = await supabase
        .from("tournament_results")
        .upsert(processedResults, { onConflict: "tournament_id, athlete_name, round_number" });

    if (upsertErr) {
        console.error("UPSERT ERROR:", upsertErr);
    } else {
        console.log("UPSERT SUCCESSFUL!");
    }
}

testSave();
