import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const athletes = [
    { "name": "이승민", "status": "등록", "branch": "조이마루", "level": "상비군", "gender": "남", "coach": "박치우", "phone": "010-8547-0776" },
    { "name": "김강민", "status": "등록", "branch": "조이마루", "level": "엘리트", "gender": "남", "coach": "김규태", "phone": "010-3739-4093" },
    { "name": "김건호", "status": "등록", "branch": "조이마루", "level": "엘리트", "gender": "남", "coach": "성세환", "phone": "010-6407-4106" },
    { "name": "김윤제", "status": "등록", "branch": "조이마루", "level": "엘리트", "gender": "남", "coach": "김봉진", "phone": "010-3438-1930" },
    { "name": "김정훈", "status": "등록", "branch": "조이마루", "level": "엘리트", "gender": "남", "coach": "", "phone": "010-3131-4183" },
    { "name": "김동현", "status": "등록", "branch": "조이마루", "level": "엘리트", "gender": "남", "coach": "이동진", "phone": "010-9770-8756" },
    { "name": "나은교", "status": "등록", "branch": "조이마루", "level": "엘리트", "gender": "여", "coach": "김봉진", "phone": "010-5816-7863" },
    { "name": "남효빈", "status": "등록", "branch": "조이마루", "level": "엘리트", "gender": "여", "coach": "박치우", "phone": "010-7276-1560" },
    { "name": "노성민", "status": "등록", "branch": "조이마루", "level": "엘리트", "gender": "남", "coach": "김종명", "phone": "010-9860-0824" },
    { "name": "박상윤1", "status": "등록", "branch": "조이마루", "level": "엘리트", "gender": "남", "coach": "성세환", "phone": "010-2170-4982" },
    { "name": "박소박", "status": "등록", "branch": "조이마루", "level": "엘리트", "gender": "여", "coach": "이동진", "phone": "010-8299-9832" },
    { "name": "박지민", "status": "등록", "branch": "조이마루", "level": "엘리트", "gender": "여", "coach": "박치우", "phone": "010-5922-2779" },
    { "name": "안유건", "status": "등록", "branch": "조이마루", "level": "엘리트", "gender": "남", "coach": "김종명", "phone": "010-8917-2193" },
    { "name": "유광호", "status": "등록", "branch": "조이마루", "level": "엘리트", "gender": "남", "coach": "성세환", "phone": "010-5650-9790" },
    { "name": "이대현", "status": "등록", "branch": "조이마루", "level": "엘리트", "gender": "남", "coach": "김규태", "phone": "010-2612-0854" },
    { "name": "이승순", "status": "등록", "branch": "조이마루", "level": "엘리트", "gender": "남", "coach": "김종명", "phone": "010-3565-8177" },
    { "name": "엄정현", "status": "등록", "branch": "조이마루", "level": "엘리트", "gender": "남", "coach": "김종명", "phone": "010-2311-5161" },
    { "name": "이초원", "status": "등록", "branch": "조이마루", "level": "엘리트", "gender": "여", "coach": "성세환", "phone": "010-6413-7386" },
    { "name": "임도율", "status": "등록", "branch": "조이마루", "level": "엘리트", "gender": "남", "coach": "성세환", "phone": "010-2278-6475" },
    { "name": "장지호", "status": "등록", "branch": "조이마루", "level": "엘리트", "gender": "남", "coach": "김봉진", "phone": "010-2796-1487" },
    { "name": "정소윤", "status": "등록", "branch": "조이마루", "level": "엘리트", "gender": "여", "coach": "김종명", "phone": "010-6471-1563" },
    { "name": "정미나", "status": "등록", "branch": "조이마루", "level": "엘리트", "gender": "여", "coach": "이동진", "phone": "010-8585-2196" },
    { "name": "정지후", "status": "등록", "branch": "조이마루", "level": "엘리트", "gender": "남", "coach": "김봉진", "phone": "010-4795-3882" },
    { "name": "조하늘", "status": "등록", "branch": "조이마루", "level": "엘리트", "gender": "남", "coach": "김종명", "phone": "010-2252-6872" },
    { "name": "김동은", "status": "등록", "branch": "조이마루", "level": "1부투어", "gender": "남", "coach": "", "phone": "010-9924-0838" },
    { "name": "김승민", "status": "등록", "branch": "조이마루", "level": "1부투어", "gender": "남", "coach": "", "phone": "010-2264-3391" },
    { "name": "김홍택", "status": "등록", "branch": "조이마루", "level": "1부투어", "gender": "남", "coach": "", "phone": "010-9924-0838" },
    { "name": "김희지", "status": "등록", "branch": "조이마루", "level": "1부투어", "gender": "여", "coach": "김홍식", "phone": "010-6617-8289" },
    { "name": "박준홍", "status": "등록", "branch": "조이마루", "level": "1부투어", "gender": "남", "coach": "", "phone": "010-3119-1407" },
    { "name": "배용준", "status": "등록", "branch": "조이마루", "level": "1부투어", "gender": "남", "coach": "", "phone": "010-6617-8289" },
    { "name": "성유진", "status": "등록", "branch": "조이마루", "level": "1부투어", "gender": "여", "coach": "김홍식", "phone": "010-3119-1407" },
    { "name": "신상훈", "status": "등록", "branch": "조이마루", "level": "1부투어", "gender": "남", "coach": "", "phone": "010-9772-8937" },
    { "name": "이성호", "status": "등록", "branch": "조이마루", "level": "1부투어", "gender": "남", "coach": "", "phone": "010-3703-7687" },
    { "name": "이승찬", "status": "등록", "branch": "조이마루", "level": "1부투어", "gender": "남", "coach": "", "phone": "010-6305-9928" },
    { "name": "이형준", "status": "등록", "branch": "조이마루", "level": "1부투어", "gender": "남", "coach": "", "phone": "010-4610-4507" },
    { "name": "장승보", "status": "등록", "branch": "조이마루", "level": "1부투어", "gender": "남", "coach": "", "phone": "010-9040-1865" },
    { "name": "장유빈", "status": "등록", "branch": "조이마루", "level": "1부투어", "gender": "남", "coach": "", "phone": "010-7294-1339" },
    { "name": "정태양", "status": "등록", "branch": "조이마루", "level": "1부투어", "gender": "남", "coach": "", "phone": "010-3442-0999" },
    { "name": "최승빈", "status": "등록", "branch": "조이마루", "level": "1부투어", "gender": "남", "coach": "", "phone": "010-9024-9698" },
    { "name": "정종윤", "status": "휴회", "branch": "조이마루", "level": "세미프로", "gender": "남", "coach": "", "phone": "010-3825-0408" },
    { "name": "이상원", "status": "휴회", "branch": "조이마루", "level": "정회원", "gender": "남", "coach": "", "phone": "010-6417-9875" },
    { "name": "오현수", "status": "휴회", "branch": "조이마루", "level": "일반", "gender": "남", "coach": "", "phone": "010-8847-5114" },
    { "name": "이도현", "status": "휴회", "branch": "조이마루", "level": "일반", "gender": "남", "coach": "", "phone": "010-4128-3728" },
    { "name": "김성현", "status": "등록", "branch": "구미", "level": "1부투어", "gender": "남", "coach": "", "phone": "010-9326-7027" },
    { "name": "홍현지", "status": "등록", "branch": "구미", "level": "1부투어", "gender": "여", "coach": "김홍식", "phone": "010-5207-1842" },
    { "name": "황유민", "status": "등록", "branch": "구미", "level": "1부투어", "gender": "여", "coach": "", "phone": "010-2283-9749" },
    { "name": "홍진영", "status": "등록", "branch": "구미", "level": "1부투어", "gender": "여", "coach": "김홍식", "phone": "010-8841-4941" }
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

async function startUpsert() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    console.log(`Starting force upsert for ${athletes.length} athletes...`);

    for (const item of athletes) {
        // 이메일 주소에 한글이 들어가면 안 되므로 영문 변환 또는 인코딩 처리
        const safeEmail = `${encodeURIComponent(item.name)}${Math.floor(Math.random() * 100)}@gla.com`;

        // 1. Auth 유저 먼저 생성 (혹시 이미 있으면 에러나지만 무시하고 진행)
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email: safeEmail,
            password: 'gla1!',
            email_confirm: true,
            user_metadata: { name: item.name, role: 'athlete' }
        });

        const athleteId = authUser?.user?.id;

        if (!athleteId) {
            console.error(`Skipping ${item.name} since auth failed or already exists`);
            // 만약 이미 있는 경우를 위해 이메일로 검색해서 ID 가져올 수도 있지만 일단 진행
            continue;
        }

        // 2. public.users에 강제로 upsert
        const { error: dbError } = await supabase
            .from('users')
            .upsert({
                id: athleteId,
                name: item.name,
                role: 'athlete',
                branch: item.branch,
                phone: item.phone,
                coach_name: item.coach,
                level: item.level,
                status: item.status
            });

        if (dbError) {
            console.error(`❌ DB Upsert Failed for ${item.name}:`, dbError.message);
        } else {
            console.log(`✅ Success: ${item.name} integrated.`);
        }
    }
}

startUpsert();
