import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function runMerge2() {
    const oldId = '51e909c3-3122-4f66-b034-9d30985499bc'; // Sep 4
    const newId = '4b2c42d6-1413-472b-b2b6-a86390064ed6'; // Sep 25

    // Update coach_id references
    const tablesWithCoachId = [
        { table: 'records', column: 'coach_id' },
        { table: 'test_sessions', column: 'coach_id' },
        { table: 'monthly_assignments', column: 'coach_id' },
        { table: 'scorecards', column: 'coach_id' }
    ];

    for (const { table, column } of tablesWithCoachId) {
        const { data, error } = await supabase
            .from(table)
            .update({ [column]: newId })
            .eq(column, oldId)
            .select('id');
        if (!error) {
            console.log(`Updated ${data?.length || 0} rows in ${table} (${column})`);
        } else {
            console.error(`Error updating ${table} (${column}):`, error.message);
        }
    }

    // Now delete from auth.users
    const { data: deleteData, error: deleteError } = await supabase.auth.admin.deleteUser(oldId);
    if (deleteError) {
        console.error('Error deleting user from auth.users:', deleteError.message);
    } else {
        console.log('Successfully deleted user from auth.users (and public.users via cascade).');
    }
}

runMerge2();
