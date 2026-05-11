import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl as string, supabaseKey as string);

async function run() {
    const { data: authData } = await supabase.auth.admin.listUsers();
    const adminUser = authData.users.find(u => u.email === 'admin@gla.com');
    const adminId = adminUser ? adminUser.id : undefined;

    if (adminId) {
        const { data, error } = await supabase
            .from('users')
            .upsert({
                id: adminId,
                name: '전체 관리자',
                role: 'admin',
                branch: '총괄',
                level: 'Admin',
                phone: '000-0000-0000',
                status: 'active'
            }, { onConflict: 'id' })
            .select();

        if (error) console.error('User insert failed:', error);
        else console.log('User insert success:', data);
    } else {
        console.log('Admin user not found in auth list.');
    }
}

run();
