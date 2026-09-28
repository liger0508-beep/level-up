import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function backfillSeptemberLogins2() {
    console.log("Starting REAL backfill for September 2026 logins based on user activity...");

    const startDate = "2026-09-01T00:00:00Z";
    const endDate = "2026-10-01T00:00:00Z";

    const uniqueLogins = new Set();

    function addActivity(userId, dateString) {
        if (!userId || !dateString) return;
        const date = dateString.split('T')[0];
        uniqueLogins.add(`${userId}_${date}`);
    }

    // 1. Records
    const { data: records } = await supabase
        .from('records')
        .select('user_id, coach_id, created_at')
        .gte('created_at', startDate)
        .lt('created_at', endDate);

    if (records) {
        records.forEach(r => {
            if (r.coach_id) {
                // Coach wrote this
                addActivity(r.coach_id, r.created_at);
            } else {
                // Athlete or self wrote this (journal, challenge)
                addActivity(r.user_id, r.created_at);
            }
        });
    }

    // 2. Scorecards
    const { data: scorecards } = await supabase
        .from('scorecards')
        .select('athlete_id, marker_id, created_at')
        .gte('created_at', startDate)
        .lt('created_at', endDate);
    
    if (scorecards) {
        scorecards.forEach(s => {
            addActivity(s.athlete_id, s.created_at);
            if (s.marker_id) addActivity(s.marker_id, s.created_at);
        });
    }
    
    // 3. Comments
    const { data: comments } = await supabase
        .from('analysis_comments')
        .select('user_id, created_at')
        .gte('created_at', startDate)
        .lt('created_at', endDate)
        .then(res => res, err => ({ data: [] })); 
        
    if (comments && !('error' in comments)) {
        comments.forEach(c => addActivity(c.user_id, c.created_at));
    }

    // 4. Poll Responses
    const { data: pollResponses } = await supabase
        .from('poll_responses')
        .select('user_id, created_at')
        .gte('created_at', startDate)
        .lt('created_at', endDate)
        .then(res => res, err => ({ data: [] })); 

    if (pollResponses && !('error' in pollResponses)) {
        pollResponses.forEach(c => addActivity(c.user_id, c.created_at));
    }
    
    console.log(`Found ${uniqueLogins.size} unique daily activities to backfill.`);

    // Insert
    const inserts = [];
    for (const item of uniqueLogins) {
        const [user_id, date] = item.split('_');
        const created_at = `${date}T03:00:00Z`; // Noon KST
        inserts.push({ user_id, activity_type: 'login', created_at });
    }

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

backfillSeptemberLogins2();
