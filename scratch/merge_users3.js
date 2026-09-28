import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function runMerge3() {
    const oldId = '51e909c3-3122-4f66-b034-9d30985499bc'; // Sep 4
    const newId = '4b2c42d6-1413-472b-b2b6-a86390064ed6'; // Sep 25

    let success = false;
    let iterations = 0;
    while (!success && iterations < 10) {
        iterations++;
        const { error } = await supabase.from('users').delete().eq('id', oldId);
        if (error) {
            console.log('Delete error:', error.message);
            const match = error.message.match(/table "(.*?)" violates foreign key constraint ".*?" on table "(.*?)"/);
            if (match) {
                const table = match[2];
                // Try to find the column. The error might look like 'Key (id)=(...) is still referenced from table "schedules".'
                // Or 'violates foreign key constraint "schedules_user_id_fkey"'
                let column = 'user_id';
                const fkeyMatch = error.message.match(/constraint "(.*?)_fkey"/);
                if (fkeyMatch) {
                    const fkeyName = fkeyMatch[1]; // e.g. schedules_user_id
                    if (fkeyName.endsWith('_coach_id')) column = 'coach_id';
                    else if (fkeyName.endsWith('_athlete_id')) column = 'athlete_id';
                    else if (fkeyName.endsWith('_author_id')) column = 'author_id';
                    // We can also just check common columns
                }

                console.log(`Trying to fix table ${table}, column ${column}`);
                const { data: updateData, error: updateError } = await supabase
                    .from(table)
                    .update({ [column]: newId })
                    .eq(column, oldId)
                    .select('id');
                
                if (updateError) {
                     console.error(`Update error on ${table}.${column}:`, updateError.message);
                     // fallback if column is wrong
                     if (updateError.message.includes('column')) {
                         const alternativeCols = ['user_id', 'coach_id', 'athlete_id', 'author_id'];
                         for (const altCol of alternativeCols) {
                             if (altCol !== column) {
                                  const { error: altError } = await supabase.from(table).update({ [altCol]: newId }).eq(altCol, oldId);
                                  if (!altError) {
                                      console.log(`Fixed table ${table} with column ${altCol}`);
                                      break;
                                  }
                             }
                         }
                     } else {
                         // Unique constraint maybe? Delete it
                         console.log(`Deleting from ${table} due to conflict`);
                         await supabase.from(table).delete().eq(column, oldId);
                     }
                } else {
                    console.log(`Fixed table ${table}. Updated ${updateData?.length || 0} rows.`);
                }
            } else {
                console.log("Could not parse error string:", error.message);
                break;
            }
        } else {
            console.log('Successfully deleted user from public.users!');
            success = true;
        }
    }
    
    if (success) {
        // Delete from auth.users
        const { error: authError } = await supabase.auth.admin.deleteUser(oldId);
        if (authError) {
            console.error('Error deleting from auth.users:', authError.message);
        } else {
            console.log('Successfully deleted user from auth.users!');
        }
    }
}
runMerge3();
