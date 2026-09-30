const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
async function run() {
    const env = fs.readFileSync('.env.local', 'utf8');
    const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
    const roleKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();
    const supabaseAdmin = createClient(url, roleKey);
    
    const { data: scorecards } = await supabaseAdmin.from('scorecards').select('id').limit(5);
    const { data: challenges, error: ce } = await supabaseAdmin.from('challenge_records').select('id').limit(5);
    const { data: challenge_attempts, error: cae } = await supabaseAdmin.from('challenge_attempts').select('id').limit(5);
    const { data: test_sessions, error: tse } = await supabaseAdmin.from('test_sessions').select('id, category').limit(5);
    const { data: records_sc } = await supabaseAdmin.from('records').select('id').eq('type', 'scorecard').limit(5);
    const { data: records_ch } = await supabaseAdmin.from('records').select('id').eq('type', 'challenge').limit(5);
    
    console.log('scorecards table:', scorecards ? scorecards.length : 'error');
    console.log('challenge_records table:', challenges ? challenges.length : ce?.message);
    console.log('challenge_attempts table:', challenge_attempts ? challenge_attempts.length : cae?.message);
    console.log('test_sessions table:', test_sessions ? test_sessions.length : tse?.message);
    console.log('records(scorecard):', records_sc ? records_sc.length : 'error');
    console.log('records(challenge):', records_ch ? records_ch.length : 'error');
}
run();
