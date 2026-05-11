// ============================================================
// supabase/functions/calculate-sg/index.ts
// SG 상세 항목(try_loc, try_dist, loc_result, dist_result) 저장 버전
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SgBaseline {
  distance_m: number;
  te_score: number;
  fw_score: number;
  ro_score: number;
  bu_score: number;
  gr_score: number | null;
}

// ... (기존 parseShot, lookup 함수 동일) ...
function parseShot(shotValue: string) {
  const raw = (shotValue ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
  const match = raw.match(/^([A-Z\-]+)\s*\/\s*(\d+)$/);
  if (match) return { code: match[1], dist: parseInt(match[2], 10) };
  return { code: raw.replace(/[^A-Z\-]/g, ''), dist: 0 };
}

function lookup(dist: number, baselines: SgBaseline[], col: keyof SgBaseline): number {
  const sorted = [...baselines].sort((a, b) => a.distance_m - b.distance_m);
  let val = Number(sorted[0][col]) || 0;
  for (const row of sorted) {
    if (row.distance_m <= dist) {
      val = Number(row[col]) || val;
    } else break;
  }
  return val;
}

function getBaseline(code: string, dist: number, par: number, shotNum: number, baselines: SgBaseline[]): number {
    if (code === 'TE') {
        if (par === 3) return lookup(dist, baselines, 'gr_score' as any) || lookup(dist, baselines, 'fw_score');
        return lookup(dist, baselines, 'te_score');
    }
    if (code === 'GR') return lookup(dist, baselines, 'gr_score' as any) || lookup(dist, baselines, 'fw_score');
    if (code === 'RO') return lookup(dist, baselines, 'ro_score');
    if (code === 'FB' || code === 'GB') return lookup(dist, baselines, 'bu_score');
    return lookup(dist, baselines, 'fw_score');
}

function getLocationPenalty(code: string): number {
    const map: Record<string, number> = {
        'FW': -0.08, 'RO': 0.20, 'FB': 0.25, 'FO': 0.50, 'PA': 1.00, 'OB': 2.00, 'PS': 1.00
    };
    return map[code] || 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { scorecard_id, holes } = await req.json();

    const { data: baselines } = await supabase.from('sg_baseline').select('*').order('distance_m');
    if (!baselines) throw new Error('Baselines not found');

    for (const hole of holes) {
        const validShots = hole.shots.filter((s:any) => s.shot_value && s.shot_value !== '-').sort((a:any,b:any)=>a.shot_number-b.shot_number);
        const parsed = validShots.map((s:any) => parseShot(s.shot_value));
        
        let prevDistScore = 0;

        for (let i = 0; i < parsed.length; i++) {
            const current = parsed[i];
            const next = i + 1 < parsed.length ? parsed[i+1] : null;

            // 1. 시도위치 (Try Loc): PAR3 티샷만 존재
            const tryLoc = (current.code === 'TE' && hole.par === 3) ? -lookup(current.dist, baselines, 'fw_score') : 0;
            
            // 2. 시도거리 (Try Dist): 이전 샷의 결과값 반전
            const tryDist = -prevDistScore;

            // 3. 결과 (다음 샷 기준)
            let locResult = 0;
            let distResult = 0;

            if (next) {
                locResult = getLocationPenalty(next.code);
                distResult = getBaseline(next.code, next.dist, hole.par, i + 2, baselines);
            } else {
                // 마지막 샷 (홀인)
                locResult = 0;
                distResult = -1.00;
            }

            const sg = tryLoc + tryDist + locResult + distResult;
            prevDistScore = (current.code === 'HI') ? 0 : getBaseline(current.code, current.dist, hole.par, i + 1, baselines);

            // DB 업데이트
            await supabase.from('scorecard_shots')
                .update({
                    sg_score: Math.round(sg * 1000) / 1000,
                    try_loc_score: tryLoc,
                    try_dist_score: tryDist,
                    loc_result_score: locResult,
                    dist_result_score: distResult
                })
                .eq('hole_id', hole.id) // UI에서 넘겨준 hole table id가 필요
                .eq('shot_number', validShots[i].shot_number);
        }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
