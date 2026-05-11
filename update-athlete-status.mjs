import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const athletes = [
    { "name": "이승민", "status": "등록" },
    { "name": "김강민", "status": "등록" },
    { "name": "김건호", "status": "등록" },
    { "name": "김윤제", "status": "등록" },
    { "name": "김정훈", "status": "등록" },
    { "name": "김동현", "status": "등록" },
    { "name": "나은교", "status": "등록" },
    { "name": "남효빈", "status": "등록" },
    { "name": "노성민", "status": "등록" },
    { "name": "박상윤1", "status": "등록" },
    { "name": "박소박", "status": "등록" },
    { "name": "박지민", "status": "등록" },
    { "name": "안유건", "status": "등록" },
    { "name": "유광호", "status": "등록" },
    { "name": "이대현", "status": "등록" },
    { "name": "이승순", "status": "등록" },
    { "name": "엄정현", "status": "등록" },
    { "name": "이초원", "status": "등록" },
    { "name": "임도율", "status": "등록" },
    { "name": "장지호", "status": "등록" },
    { "name": "정소윤", "status": "등록" },
    { "name": "정미나", "status": "등록" },
    { "name": "정지후", "status": "등록" },
    { "name": "조하늘", "status": "등록" },
    { "name": "김동은", "status": "등록" },
    { "name": "김승민", "status": "등록" },
    { "name": "김홍택", "status": "등록" },
    { "name": "김희지", "status": "등록" },
    { "name": "박준홍", "status": "등록" },
    { "name": "배용준", "status": "등록" },
    { "name": "성유진", "status": "등록" },
    { "name": "신상훈", "status": "등록" },
    { "name": "이성호", "status": "등록" },
    { "name": "이승찬", "status": "등록" },
    { "name": "이형준", "status": "등록" },
    { "name": "장승보", "status": "등록" },
    { "name": "장유빈", "status": "등록" },
    { "name": "정태양", "status": "등록" },
    { "name": "최승빈", "status": "등록" },
    { "name": "강민진", "status": "등록" },
    { "name": "김민우", "status": "등록" },
    { "name": "김주훈", "status": "등록" },
    { "name": "김한민", "status": "등록" },
    { "name": "박준호", "status": "등록" },
    { "name": "박민혁", "status": "등록" },
    { "name": "정종빈", "status": "등록" },
    { "name": "임은수", "status": "등록" },
    { "name": "황세윤", "status": "등록" },
    { "name": "김범규", "status": "등록" },
    { "name": "김준", "status": "등록" },
    { "name": "김태은", "status": "등록" },
    { "name": "박경희", "status": "등록" },
    { "name": "박준성", "status": "등록" },
    { "name": "신가윤", "status": "등록" },
    { "name": "오미인", "status": "등록" },
    { "name": "조아리", "status": "등록" },
    { "name": "김민기", "status": "등록" },
    { "name": "강예서", "status": "등록" },
    { "name": "샤넬", "status": "등록" },
    { "name": "조제욱", "status": "등록" },
    { "name": "허승완", "status": "등록" },
    { "name": "김선우", "status": "등록" },
    { "name": "이우현", "status": "등록" },
    { "name": "정종윤", "status": "휴회" },
    { "name": "이상원", "status": "휴회" },
    { "name": "오현수", "status": "휴회" },
    { "name": "이도현", "status": "휴회" },
    { "name": "김민지", "status": "등록" },
    { "name": "박경란", "status": "등록" },
    { "name": "정가윤", "status": "등록" },
    { "name": "우성현", "status": "등록" },
    { "name": "이연주", "status": "등록" },
    { "name": "김성현", "status": "등록" },
    { "name": "홍현지", "status": "등록" },
    { "name": "황유민", "status": "등록" },
    { "name": "홍진영", "status": "등록" }
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

async function updateStatus() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    console.log(`Updating status for ${athletes.length} athletes...`);

    let successCount = 0;

    for (const item of athletes) {
        const { error } = await supabase
            .from('users')
            .update({ status: item.status })
            .eq('name', item.name)
            .eq('role', 'athlete');

        if (error) {
            console.error(`Error updating ${item.name}:`, error.message);
        } else {
            successCount++;
        }
    }

    console.log(`Update complete. Successfully updated ${successCount}/${athletes.length} athletes.`);
}

updateStatus();
