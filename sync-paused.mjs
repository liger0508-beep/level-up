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

// These are the exact '휴회' athletes from the CSV content
const pausedAthletes = [
    "정종윤", "이상원", "오현수", "이도현", "이대규",
    "김민서", "류재하", "김시현", "정예서", "박서영",
    "고은", "유승은", "조세령"
];

async function updatePaused() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    console.log(`Setting exactly ${pausedAthletes.length} athletes to '휴회'...`);

    // First, set EVERYONE to '등록' (just to be safe and reset the wrong ones)
    await supabase.from('users').update({ status: '등록' }).eq('role', 'athlete');

    let successCount = 0;

    for (const name of pausedAthletes) {
        // Then set the specific ones to '휴회'
        const { error } = await supabase
            .from('users')
            .update({ status: '휴회' })
            .eq('name', name)
            .eq('role', 'athlete');

        if (error) {
            console.error(`Error updating ${name}:`, error.message);
        } else {
            console.log(`Updated ${name} -> 휴회`);
            successCount++;
        }
    }

    console.log(`Successfully updated ${successCount} paused athletes.`);
}

updatePaused();
