import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function runMerge() {
    const oldId = '51e909c3-3122-4f66-b034-9d30985499bc'; // Sep 4
    const newId = '4b2c42d6-1413-472b-b2b6-a86390064ed6'; // Sep 25

    console.log(`Starting merge from ${oldId} to ${newId}`);

    const tablesToUpdate = [
        { table: 'records', column: 'user_id' },
        { table: 'test_sessions', column: 'user_id' },
        { table: 'attendance', column: 'athlete_id' },
        { table: 'scorecards', column: 'athlete_id' },
        { table: 'consultations', column: 'user_id' },
        { table: 'user_activity_logs', column: 'user_id' },
        { table: 'login_logs', column: 'user_id' },
        { table: 'votes', column: 'user_id' }
    ];

    for (const { table, column } of tablesToUpdate) {
        const { data, error } = await supabase
            .from(table)
            .update({ [column]: newId })
            .eq(column, oldId)
            .select('id');

        if (error) {
            console.error(`Error updating ${table}:`, error.message);
        } else {
            console.log(`Updated ${data?.length || 0} rows in ${table}`);
        }
    }

    // monthly_assignments handling (avoiding unique constraint if any)
    const { data: oldAssignments } = await supabase.from('monthly_assignments').select('*').eq('athlete_id', oldId);
    if (oldAssignments && oldAssignments.length > 0) {
        for (const assign of oldAssignments) {
            const { error: assignError } = await supabase
                .from('monthly_assignments')
                .update({ athlete_id: newId })
                .eq('id', assign.id);
            if (assignError) {
                console.log(`Conflict/Error updating assignment ${assign.id}:`, assignError.message);
                // if conflict, we can just delete the old one
                await supabase.from('monthly_assignments').delete().eq('id', assign.id);
            } else {
                console.log(`Updated monthly_assignment ${assign.id}`);
            }
        }
    } else {
        console.log(`Updated 0 rows in monthly_assignments`);
    }

    // Now delete from auth.users
    const { data: deleteData, error: deleteError } = await supabase.auth.admin.deleteUser(oldId);
    if (deleteError) {
        console.error('Error deleting user from auth.users:', deleteError.message);
    } else {
        console.log('Successfully deleted user from auth.users (and public.users via cascade).');
    }
}

runMerge();
