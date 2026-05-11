import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl as string, supabaseKey as string);

async function run() {
    const usersToInsert = [
        {
            name: '성시우',
            role: 'head_coach',
            branch: '총괄',
            level: '총괄',
            phone: '010-0000-0000',
            status: 'active'
        },
        {
            name: '김홍식',
            role: 'head_coach',
            branch: '총괄',
            level: '총괄',
            phone: '010-0000-0000',
            status: 'active'
        }
    ];

    // Try to insert
    const { data, error } = await supabase
        .from('users')
        .insert(usersToInsert)
        .select();

    if (error) {
        if (error.code === '23505') { // Unique constraint
            console.log('Users already exist, updating instead.');
            for (const u of usersToInsert) {
                await supabase.from('users').update({ branch: '총괄', role: 'head_coach' }).eq('name', u.name);
            }
            console.log('Update complete');
        } else {
            console.error('Insert failed:', error);
        }
    } else {
        console.log('Insert success:', data);
    }
}

run();
