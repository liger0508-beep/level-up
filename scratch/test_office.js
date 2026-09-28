import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Using service key to generate JWT for an office user
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function testRLS() {
    // 1. Get an office user
    const { data: users } = await supabase.from('users').select('id, email, role').eq('role', 'office').limit(1);
    if (!users || users.length === 0) {
        console.log("No office user found");
        return;
    }
    const officeUser = users[0];
    console.log("Found office user:", officeUser.email);

    // 2. Fetch records using service role just to see how many exist
    const { count: totalPlans } = await supabase.from('records').select('*', { count: 'exact', head: true }).eq('type', 'plan').neq('category', 'field');
    console.log("Total plans in DB:", totalPlans);

    // 3. To test RLS properly, we need the user's JWT or we can just try to run a query via POST using REST directly.
    // Or simpler: let's just insert the policy via postgres if we can, but we can't directly.
    // Let's check if the policy exists by selecting from pg_policies via a special trick? No.
}
testRLS();
