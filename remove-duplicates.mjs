import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

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

async function removeDuplicates() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    console.log("Fetching all athletes to find duplicates...");

    // 전체 유저 가져오기
    const { data: users, error } = await supabase.from('users').select('*');

    if (error) {
        console.error("Error fetching users:", error.message);
        return;
    }

    // 이름 기준으로 그룹화
    const nameMap = {};
    for (const u of users) {
        if (!nameMap[u.name]) nameMap[u.name] = [];
        nameMap[u.name].push(u);
    }

    let deletedCount = 0;

    for (const name in nameMap) {
        if (nameMap[name].length > 1) {
            // 중복된 경우, 가장 최근에 생긴 계정 하나만 남기고 (내림차순 정렬)
            const sorted = nameMap[name].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            // i=0 인 첫 번째 최신 데이터만 살리고 나머지는 삭제!
            for (let i = 1; i < sorted.length; i++) {
                const idToDelete = sorted[i].id;
                console.log(`Deleting duplicate -> Name: ${name}, ID: ${idToDelete}`);

                // 1. public.users 테이블에서 지우기 (화면에서 사라짐)
                await supabase.from('users').delete().eq('id', idToDelete);

                // 2. Auth 로그인 계정도 완전히 삭제
                await supabase.auth.admin.deleteUser(idToDelete);

                deletedCount++;
            }
        }
    }

    console.log(`\n✅ 삭제 완료! 총 ${deletedCount}명의 중복 계정을 깨끗하게 삭제했습니다.`);

    // 남은 유저 확인
    const { count } = await supabase.from('users').select('*', { count: 'exact', head: true });
    console.log(`Current Total Unique Users in Database: ${count}`);
}

removeDuplicates();
