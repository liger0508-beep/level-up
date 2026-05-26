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

async function testSave() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    
    // Let's get one tournament first
    const { data: tournaments, error: tErr } = await supabase
        .from('tournaments')
        .select('*')
        .limit(1);

    if (tErr) {
        console.error("Error fetching tournaments:", tErr);
        return;
    }

    if (!tournaments || tournaments.length === 0) {
        console.log("No tournaments found.");
        return;
    }

    const tournament = tournaments[0];
    console.log("Found tournament:", tournament.id, tournament.name);

    // Let's try to upsert a record into tournament_results
    const mockResult = {
        tournament_id: tournament.id,
        athlete_name: "홍길동",
        round_number: 1,
        round_date: "2026-05-19",
        daily_score: "-1",
        daily_rank: 5,
        cumulative_score: 71,
        rank: 5,
        notes: "테스트 비고"
    };

    console.log("Attempting to upsert mock result...");
    const { error: upsertErr } = await supabase
        .from("tournament_results")
        .upsert([mockResult], { onConflict: "tournament_id, athlete_name, round_number" });

    if (upsertErr) {
        console.error("UPSERT ERROR:", upsertErr);
    } else {
        console.log("UPSERT SUCCESSFUL!");
    }
}

testSave();
