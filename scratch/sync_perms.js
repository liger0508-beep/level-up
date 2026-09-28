import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function syncPerms() {
    const { data: allPerms } = await supabase.from('role_permissions').select('*');
    
    const coachPerms = allPerms.filter(p => p.role === 'coach');
    
    for (const role of ['office', 'headquarter']) {
        for (const coachPerm of coachPerms) {
            const existing = allPerms.find(p => p.role === role && p.menu_key === coachPerm.menu_key);
            if (!existing) {
                console.log(`Adding ${coachPerm.menu_key} for ${role}`);
                await supabase.from('role_permissions').insert({
                    role: role,
                    menu_key: coachPerm.menu_key,
                    can_read: coachPerm.can_read,
                    can_write: coachPerm.can_write
                });
            } else if (existing.can_read !== coachPerm.can_read || existing.can_write !== coachPerm.can_write) {
                console.log(`Updating ${coachPerm.menu_key} for ${role} to read:${coachPerm.can_read}, write:${coachPerm.can_write}`);
                await supabase.from('role_permissions')
                    .update({ can_read: coachPerm.can_read, can_write: coachPerm.can_write })
                    .eq('id', existing.id);
            }
        }
    }
    console.log('Done syncing perms');
}
syncPerms();
