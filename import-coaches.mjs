import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const coaches = [
    { "name": "성시우", "branch": "총괄" }, { "name": "김홍식", "branch": "총괄" }, { "name": "김봉진", "branch": "조이마루" }, { "name": "김규태", "branch": "조이마루" }, { "name": "이동진", "branch": "조이마루" },
    { "name": "박치우", "branch": "조이마루" }, { "name": "김종명", "branch": "조이마루" }, { "name": "성세환", "branch": "조이마루" }, { "name": "장동선", "branch": "조이마루" }, { "name": "선동휘", "branch": "조이마루" },
    { "name": "배강호", "branch": "구미" }, { "name": "이기찬", "branch": "구미" }, { "name": "이준", "branch": "구미" }, { "name": "문치환", "branch": "구미" }, { "name": "성시현", "branch": "전체" },
    { "name": "김진홍", "branch": "전체" }, { "name": "강민규", "branch": "전체" }, { "name": "황정욱", "branch": "전체" }
];

function getEnv() {
    const envPath = path.join(process.cwd(), '.env.local');
    const content = fs.readFileSync(envPath, 'utf8');
    const env = {};
    content.split('\n').forEach(line => {
        const [key, ...value] = line.split('=');
        if (key && value) env[key.trim()] = value.join('=').trim();
    });
    return env;
}

async function importCoaches() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    console.log(`Starting import for ${coaches.length} coaches...`);

    for (let i = 0; i < coaches.length; i++) {
        const item = coaches[i];
        const email = `coach_${i + 1}@gla.coach`;
        const password = 'gla1!';
        console.log(`Processing: ${item.name} (${email})`);

        // 1. Check if user already exists in public.users to avoid duplicates
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('name', item.name)
            .eq('role', 'coach')
            .maybeSingle();

        if (existingUser) {
            console.log(`Skipping existing coach: ${item.name}`);
            continue;
        }

        // 2. Create Auth User
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { name: item.name, role: 'coach' }
        });

        if (authError) {
            // If email already exists, it might be the same coach or someone with same name
            if (authError.message.includes('already registered')) {
                console.log(`Email ${email} already exists, skipping...`);
                continue;
            }
            console.error(`❌ Failed to create auth for ${item.name}:`, authError.message);
            continue;
        }

        // 3. Update Public.Users (Trigger handles initial insert, we update details)
        // Storing "part" in the 'level' column as we don't have a specialty column yet
        const { error: dbError } = await supabase
            .from('users')
            .upsert({
                id: authUser.user.id,
                name: item.name,
                role: 'coach',
                branch: item.branch,
                gender: 'male',
                level: item.branch === '총괄' ? '마스터' : '프로'
            });

        if (dbError) {
            console.error(`⚠️ Failed to update DB for ${item.name}:`, dbError.message);
        } else {
            console.log(`✅ Imported: ${item.name} (${item.branch}, ${item.part})`);
        }
    }

    console.log('--- Coach Import Complete ---');
}

importCoaches();
