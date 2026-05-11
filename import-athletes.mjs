import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// 데이터 로드
const athletes = [
    { "name": "이승민", "branch": "조이마루" }, { "name": "김강민", "branch": "조이마루" }, { "name": "김건호", "branch": "조이마루" }, { "name": "김윤제", "branch": "조이마루" }, { "name": "김정훈", "branch": "조이마루" },
    { "name": "김동현", "branch": "조이마루" }, { "name": "나은교", "branch": "조이마루" }, { "name": "남효빈", "branch": "조이마루" }, { "name": "노성민", "branch": "조이마루" }, { "name": "박상윤1", "branch": "조이마루" },
    { "name": "박소박", "branch": "조이마루" }, { "name": "박지민", "branch": "조이마루" }, { "name": "안유건", "branch": "조이마루" }, { "name": "유광호", "branch": "조이마루" }, { "name": "이대현", "branch": "조이마루" },
    { "name": "이승순", "branch": "조이마루" }, { "name": "임정현", "branch": "조이마루" }, { "name": "이초원", "branch": "조이마루" }, { "name": "임도율", "branch": "조이마루" }, { "name": "장지호", "branch": "조이마루" },
    { "name": "정소윤", "branch": "조이마루" }, { "name": "정미나", "branch": "조이마루" }, { "name": "정지후", "branch": "조이마루" }, { "name": "조하늘", "branch": "조이마루" }, { "name": "김동은", "branch": "1부투어" },
    { "name": "김승민", "branch": "1부투어" }, { "name": "김홍택", "branch": "1부투어" }, { "name": "김희지", "branch": "1부투어" }, { "name": "박준홍", "branch": "1부투어" }, { "name": "배용준", "branch": "1부투어" },
    { "name": "성유진", "branch": "1부투어" }, { "name": "신상훈", "branch": "1부투어" }, { "name": "이성호", "branch": "1부투어" }, { "name": "이승찬", "branch": "1부투어" }, { "name": "이형준", "branch": "1부투어" },
    { "name": "장승보", "branch": "1부투어" }, { "name": "전우리", "branch": "1부투어" }, { "name": "장유빈", "branch": "1부투어" }, { "name": "정태양", "branch": "1부투어" }, { "name": "최승빈", "branch": "1부투어" },
    { "name": "강민진", "branch": "정회원" }, { "name": "김민우", "branch": "정회원" }, { "name": "김주훈", "branch": "정회원" }, { "name": "김한민", "branch": "정회원" }, { "name": "박준호", "branch": "정회원" },
    { "name": "박민혁", "branch": "정회원" }, { "name": "정종빈", "branch": "정회원" }, { "name": "임은수", "branch": "정회원" }, { "name": "황세윤", "branch": "정회원" }, { "name": "김범규", "branch": "세미프로" },
    { "name": "김준", "branch": "세미프로" }, { "name": "김태은", "branch": "세미프로" }, { "name": "박경희", "branch": "세미프로" }, { "name": "박준성", "branch": "세미프로" }, { "name": "신가윤", "branch": "세미프로" },
    { "name": "오민인", "branch": "세미프로" }, { "name": "조아리", "branch": "세미프로" }, { "name": "김민기", "branch": "엘리트" }, { "name": "강예서", "branch": "엘리트" }, { "name": "샤넬", "branch": "엘리트" },
    { "name": "조세욱", "branch": "엘리트" }, { "name": "허승완", "branch": "상비군" }, { "name": "김선우", "branch": "1부투어" }, { "name": "이우현", "branch": "1부투어" }, { "name": "김서은", "branch": "-" },
    { "name": "김주현", "branch": "-" }, { "name": "정희규", "branch": "조이마루" }, { "name": "이지현3", "branch": "조이마루" }, { "name": "김시현1", "branch": "조이마루" }, { "name": "윤지혜", "branch": "조이마루" },
    { "name": "이창빈1", "branch": "조이마루" }, { "name": "강민성2", "branch": "구미" }, { "name": "김형환", "branch": "구미" }, { "name": "곽민재", "branch": "구미" }, { "name": "신유영", "branch": "구미" },
    { "name": "심은진", "branch": "구미" }, { "name": "박범석", "branch": "구미" }, { "name": "류승주", "branch": "구미" }, { "name": "조희원", "branch": "구미" }, { "name": "허성호", "branch": "구미" },
    { "name": "이예원", "branch": "구미" }, { "name": "김민지", "branch": "구미" }, { "name": "박경란", "branch": "구미" }, { "name": "정가윤", "branch": "구미" }, { "name": "우성현", "branch": "구미" },
    { "name": "이연주", "branch": "구미" }, { "name": "김성현", "branch": "구미" }, { "name": "홍현지", "branch": "구미" }, { "name": "황유민", "branch": "구미" }, { "name": "홍진영", "branch": "구미" },
    { "name": "정종윤", "branch": "조이마루" }, { "name": "이상원", "branch": "조이마루" }, { "name": "오현수", "branch": "조이마루" }, { "name": "이도현", "branch": "조이마루" }, { "name": "이대규", "branch": "조이마루" },
    { "name": "김민서", "branch": "조이마루" }, { "name": "류재하", "branch": "조이마루" }, { "name": "김시현", "branch": "조이마루" }, { "name": "정예서", "branch": "조이마루" }, { "name": "박서영", "branch": "조이마루" },
    { "name": "고은", "branch": "조이마루" }, { "name": "유승은", "branch": "구미" }, { "name": "조세령", "branch": "구미" }
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
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoConfirm: true }
    });

    console.log(`Starting import for ${athletes.length} athletes...`);

    for (let i = 0; i < athletes.length; i++) {
        const item = athletes[i];
        const email = `athlete_${i + 1}@gla.com`;
        const password = 'gla1!';

        // 1. Create Auth User
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { name: item.name, role: 'athlete' }
        });

        if (authError) {
            console.error(`❌ Failed to create auth for ${item.name}:`, authError.message);
            continue;
        }

        // 2. Update Public.Users (Trigger might have already done it, but let's be sure and set other fields)
        const { error: dbError } = await supabase
            .from('users')
            .upsert({
                id: authUser.user.id,
                name: item.name,
                role: 'athlete',
                branch: item.branch,
                level: '주니어'
            });

        if (dbError) {
            console.error(`⚠️ Failed to update DB for ${item.name}:`, dbError.message);
        } else {
            console.log(`✅ Imported: ${item.name} (${item.level})`);
        }
    }

    console.log('--- Import Complete ---');
}

startImport();
