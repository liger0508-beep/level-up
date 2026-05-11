import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const athletes = [
    { "name": "이승민", "status": "등록", "branch": "조이마루", "level": "상비군", "gender": "남", "coach": "박치우", "phone": "010-8547-0776" },
    { "name": "김강민", "status": "등록", "branch": "조이마루", "level": "엘리트", "gender": "남", "coach": "김규태", "phone": "010-3739-4093" },
    { "name": "김건호", "status": "등록", "branch": "조이마루", "level": "엘리트", "gender": "남", "coach": "성세환", "phone": "010-6407-4106" },
    { "name": "김윤제", "status": "등록", "branch": "조이마루", "level": "엘리트", "gender": "남", "coach": "김봉진", "phone": "010-3438-1930" }
    // 일단 4명으로 테스트 후 확대
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

async function startImport() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    console.log("--- Testing Import for 4 Athletes ---");

    for (const item of athletes) {
        // 이름 + 랜덤숫자@gla.com 으로 중복 방지 및 이메일 형식 준수
        const email = `${encodeURIComponent(item.name)}${Math.floor(Math.random() * 1000)}@gla.com`;

        console.log(`Trying to register: ${item.name} (${email})...`);

        // 1. 직접 public.users에 먼저 넣어보기 (트리거 의존성 배제)
        // 이를 위해 임시 ID 생성
        const tempId = crypto.randomUUID();

        const { error: dbError } = await supabase
            .from('users')
            .insert({
                id: tempId,
                name: item.name,
                role: 'athlete',
                branch: item.branch,
                phone: item.phone,
                coach_name: item.coach,
                level: item.level
            });

        if (dbError) {
            console.error(`❌ DB Insert Failed for ${item.name}:`, dbError.message);
        } else {
            console.log(`✅ DB Insert Success: ${item.name}`);
        }
    }
}

startImport();
