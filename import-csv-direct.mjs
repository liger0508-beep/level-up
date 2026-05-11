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

async function fetchAndImport() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    console.log("Fetching CSV from Google Sheets...");

    // Fetch the CSV directly
    const url = "https://docs.google.com/spreadsheets/d/1y1GaGzNQA9zmrsUVk09IfZkEdBHfZc_1pXRXkCIJxEY/export?format=csv&gid=0";

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch CSV: ${response.statusText}`);
        }
        const csvText = await response.text();

        // Parse CSV
        const lines = csvText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        let importedCount = 0;

        console.log(`Downloaded ${lines.length} lines of CSV.`);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cols = line.split(',');

            // 데이터 행 식별 (상태 값이 '등록' 또는 '휴회'인 경우)
            const statusCol = cols[3];
            if (!statusCol || (statusCol !== '등록' && statusCol !== '휴회')) continue;

            const branch = cols[4] || "";
            const level = cols[5] || "";
            const name = cols[6] || "";
            const gender = cols[7] || "";
            const coach = cols[8] || "";
            const phone = cols[9] || "";

            if (!name) continue;

            const safeEmail = `${encodeURIComponent(name)}${Math.floor(Math.random() * 1000)}@gla.com`;

            // 1. Auth Create
            const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
                email: safeEmail,
                password: 'gla1!',
                email_confirm: true,
                user_metadata: { name: name, role: 'athlete' }
            });

            const athleteId = authUser?.user?.id;

            if (!athleteId) {
                // 이미 계정이 있는 경우 넘어갑니다. (에러 무시)
                continue;
            }

            // 2. DB Upsert
            const { error: dbError } = await supabase
                .from('users')
                .upsert({
                    id: athleteId,
                    name: name,
                    role: 'athlete',
                    branch: branch,
                    phone: phone,
                    coach_name: coach,
                    level: level,
                    gender: gender === '여' ? 'female' : 'male',
                    status: statusCol
                });

            if (!dbError) {
                importedCount++;
            }
        }

        console.log(`✅ CSV Parsing and Import Complete! Total inserted in this batch: ${importedCount}`);

        // Count total database users
        const { count } = await supabase.from('users').select('*', { count: 'exact', head: true });
        console.log(`Current Total Users in Database: ${count}`);

    } catch (err) {
        console.error("❌ Process Failed:", err.message);
    }
}

fetchAndImport();
