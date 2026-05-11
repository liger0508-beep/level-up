import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// .env.local 수동 파싱
const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = fs.readFileSync(envPath, 'utf8');
const env = {};
envConfig.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) env[key.trim()] = value.trim();
});

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function checkAndRecalculate() {
  console.log("1. DB 연결 확인 및 스코어카드 수 조회...");
  const { count, error: countErr } = await supabase.from('scorecards').select('*', { count: 'exact', head: true });
  
  if (countErr) {
    console.error("DB 조회 오류:", countErr.message);
    return;
  }
  
  console.log(`현재 저장된 스코어카드 수: ${count}`);

  if (count === 0) {
    console.log("계산할 데이터가 없습니다. 웹 UI에서 먼저 스코어를 작성해 주세요!");
    return;
  }

  console.log("2. 최신 스코어카드 데이터 로드 중...");
  const { data: scorecards, error: fetchErr } = await supabase
    .from('scorecards')
    .select(`
      id,
      holes:scorecard_holes(
        id, hole_number, par,
        shots:scorecard_shots(*)
      )
    `)
    .order('created_at', { ascending: false })
    .limit(1);

  if (fetchErr || !scorecards || scorecards.length === 0) {
    console.error("데이터 로드 실패:", fetchErr?.message);
    return;
  }

  const sc = scorecards[0];
  console.log(`대상 스코어카드 ID: ${sc.id} (홀 수: ${sc.holes?.length})`);

  const payload = {
    scorecard_id: sc.id,
    holes: sc.holes.map(h => ({
      id: h.id,
      hole_number: h.hole_number,
      par: h.par,
      shots: (h.shots || []).sort((a,b)=>a.shot_number-b.shot_number).map(s => ({
        shot_number: s.shot_number,
        shot_value: s.shot_value
      }))
    }))
  };

  console.log("3. 에지 펑션 호출 중...");
  try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/calculate-sg`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ANON_KEY}`
          },
          body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        console.log("성공! 계산이 완료되었습니다.", result);
      } else {
        const errorText = await response.text();
        console.error("계산 실패 (에러 응답):", errorText);
      }
  } catch (e) {
      console.error("네트워크 오류:", e.message);
  }
}

checkAndRecalculate();
