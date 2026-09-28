import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkLoginLogs2026() {
    // Let's get count for September 2026
    const { count, error: countErr } = await supabase
        .from('login_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', '2026-09-01T00:00:00Z')
        .lt('2026-10-01T00:00:00Z'); // oops wait this syntax is wrong for lt
        // .lt('created_at', '2026-10-01T00:00:00Z')

    const { count: countCorrect } = await supabase
        .from('login_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', '2026-09-01T00:00:00Z')
        .lt('created_at', '2026-10-01T00:00:00Z');
        
    console.log("September 2026 logins:", countCorrect);

    // Group by user_id
    const { data: allLogs } = await supabase
        .from('login_logs')
        .select('user_id')
        .gte('created_at', '2026-09-01T00:00:00Z')
        .lt('created_at', '2026-10-01T00:00:00Z');
        
    const userCounts = {};
    for (const log of allLogs || []) {
        userCounts[log.user_id] = (userCounts[log.user_id] || 0) + 1;
    }

    const { data: users } = await supabase.from('users').select('id, name, role');
    const userMap = {};
    for (const u of users || []) {
        userMap[u.id] = { name: u.name, role: u.role };
    }

    const topUsers = Object.entries(userCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, count]) => {
            const u = userMap[id] || { name: 'Unknown' };
            return `${u.name} (${u.role}): ${count}회`;
        });
        
    console.log("Top 5 users:", topUsers);
}
checkLoginLogs2026();
