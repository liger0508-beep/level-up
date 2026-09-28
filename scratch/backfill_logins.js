import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function backfillSeptemberLogins() {
    console.log("Starting backfill for September 2026 logins based on user activity...");

    const startDate = "2026-09-01T00:00:00Z";
    const endDate = "2026-10-01T00:00:00Z";

    // Track unique user+date pairs to avoid duplicate login entries per day
    const uniqueLogins = new Set();

    function addActivity(userId, dateString) {
        if (!userId || !dateString) return;
        // Format to YYYY-MM-DD
        const date = dateString.split('T')[0];
        uniqueLogins.add(`${userId}_${date}`);
    }

    // 1. Fetch records (Challenge, Score, Journal/Lounge)
    const { data: records } = await supabase
        .from('records')
        .select('user_id, created_at, category')
        .gte('created_at', startDate)
        .lt('created_at', endDate);

    if (records) {
        records.forEach(r => {
            // Include challenge, score, journal (lounge). Exclude 'lesson' if coach wrote it.
            // Wait, if it's athlete writing it, user_id is the athlete.
            if (['challenge', 'score', 'journal'].includes(r.category)) {
                addActivity(r.user_id, r.created_at);
            }
        });
    }

    // 2. Fetch scorecards
    const { data: scorecards } = await supabase
        .from('scorecards')
        .select('user_id, created_at')
        .gte('created_at', startDate)
        .lt('created_at', endDate);
    
    if (scorecards) {
        scorecards.forEach(s => addActivity(s.user_id, s.created_at));
    }

    // 3. Fetch tournament_results
    const { data: tournamentResults } = await supabase
        .from('tournament_results')
        .select('user_id, created_at')
        .gte('created_at', startDate)
        .lt('created_at', endDate);
    
    if (tournamentResults) {
        tournamentResults.forEach(s => addActivity(s.user_id, s.created_at));
    }
    
    // 4. Any comments made in the lounge/lessons
    const { data: comments } = await supabase
        .from('analysis_comments')
        .select('user_id, created_at')
        .gte('created_at', startDate)
        .lt('created_at', endDate)
        .then(res => res, err => ({ data: [] })); // Catch error if table name differs
        
    if (comments && !('error' in comments)) {
        (comments).forEach(c => addActivity(c.user_id, c.created_at));
    }

    console.log(`Found ${uniqueLogins.size} unique daily activities to backfill.`);

    // Convert Set to array of inserts
    const inserts = [];
    for (const item of uniqueLogins) {
        const [user_id, date] = item.split('_');
        // create a timestamp at noon KST (03:00 UTC) for that day
        const created_at = `${date}T03:00:00Z`;
        inserts.push({
            user_id,
            activity_type: 'login',
            created_at
        });
    }

    // Insert into user_activity_logs in batches of 100
    let insertedCount = 0;
    for (let i = 0; i < inserts.length; i += 100) {
        const batch = inserts.slice(i, i + 100);
        const { error } = await supabase.from('user_activity_logs').insert(batch);
        if (error) {
            console.error("Error inserting batch:", error);
        } else {
            insertedCount += batch.length;
        }
    }

    console.log(`Successfully backfilled ${insertedCount} daily activity logins!`);
}

backfillSeptemberLogins();
