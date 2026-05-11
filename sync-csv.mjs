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

async function run() {
    console.log("Fetching CSV from Google Sheets...");

    // Explicitly targeting the first sheet as CSV, or gid=0
    const url = "https://docs.google.com/spreadsheets/d/1y1GaGzNQA9zmrsUVk09IfZkEdBHfZc_1pXRXkCIJxEY/export?format=csv&gid=0";

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch CSV: " + response.statusText);

        const csvText = await response.text();
        const lines = csvText.split('\n').map(line => line.split(','));

        const headers = lines[0].map(h => h.trim());
        const dataRows = lines.slice(1);

        // Find indices for Name ("이름", etc.) and Status ("상태", "등록여부", etc.)
        // User said: d열 등록상태
        // A=0, B=1, C=2, D=3. So index 3 is D. Let's verify header names.
        console.log("Headers:", headers);

        const env = getEnv();
        const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

        let updateCount = 0;
        let pausedCount = 0;

        for (const row of dataRows) {
            if (row.length < 4) continue;

            const name = row[1]?.trim(); // Often B is name, but let's check headers first 
            const status = row[3]?.trim(); // D is usually 3

            if (!name || name === '') continue;

            if (status === "휴회") pausedCount++;

            // Update in DB
            const { error } = await supabase
                .from('users')
                .update({ status: status })
                .eq('name', name)
                .eq('role', 'athlete');

            if (!error) updateCount++;
        }

        console.log(`Updated ${updateCount} rows. Parsed ${pausedCount} paused athletes from CSV.`);
    } catch (e) {
        console.error("Error:", e);
    }
}

run();
