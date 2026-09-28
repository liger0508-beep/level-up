import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function fixMissing() {
    const roles = ['admin', 'coach', 'office', 'headquarter'];
    for (const role of roles) {
        // For training-plan
        const { data: existingPlan } = await supabase.from('role_permissions').select('*').eq('role', role).eq('menu_key', 'training-plan');
        if (!existingPlan || existingPlan.length === 0) {
            await supabase.from('role_permissions').insert({
                role: role,
                menu_key: 'training-plan',
                can_read: true,
                can_write: true
            });
            console.log(`Inserted training-plan for ${role}`);
        } else {
            await supabase.from('role_permissions').update({ can_read: true, can_write: true }).eq('id', existingPlan[0].id);
        }

        // For training-journal
        const { data: existingJournal } = await supabase.from('role_permissions').select('*').eq('role', role).eq('menu_key', 'training-journal');
        if (!existingJournal || existingJournal.length === 0) {
            await supabase.from('role_permissions').insert({
                role: role,
                menu_key: 'training-journal',
                can_read: true,
                can_write: true
            });
            console.log(`Inserted training-journal for ${role}`);
        } else {
            await supabase.from('role_permissions').update({ can_read: true, can_write: true }).eq('id', existingJournal[0].id);
        }
    }
    console.log("Done fixing training-plan and training-journal");
}
fixMissing();
