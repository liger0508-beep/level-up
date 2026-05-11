// ============================================================
// src/lib/scorecard-sync.ts
// 스코어카드 클라이언트 유틸리티
// - UI 입력 → "약어 / 거리" 변환 저장
// - Supabase Edge Function 호출로 SG 계산
// ============================================================

import { createClient } from '@/lib/supabase/client';

// ──────────────────────────────────────────────
// 상수: 위치명 → 약어 매핑 (이미지1 기반)
// ──────────────────────────────────────────────
export const LOCATION_ABBR: Record<string, string> = {
  '티샷':            'TE',
  '페어웨이':        'FW',
  '러프':            'RO',
  '페어웨이 벙커':   'FB',
  '그린':            'GR',
  '그린 주변 어프로치': 'GA',
  '그린 주변 벙커':  'GB',
  '홀인':            'HI',
  '페널티구역':      'PA',
  '오비':            'OB',
  '벌타':            'PS',
  '숲속':            'FO',
};

export const ABBR_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(LOCATION_ABBR).map(([k, v]) => [v, k])
);

// 거리가 없는 위치 코드 (HI, OB, PA, PS 등)
const NO_DISTANCE_CODES = new Set(['HI', 'OB', 'PA', 'PS', '-']);

// ──────────────────────────────────────────────
// 타입 정의
// ──────────────────────────────────────────────

export interface ShotInput {
  locationLabel: string;  // UI 표시명 예: "티샷", "페어웨이"
  locationCode?: string;  // 직접 코드 지정 예: "TE", "FW"
  distance?: number;      // 거리 (미터)
}

export interface ParsedShot {
  locationCode: string;   // "TE", "FW", etc.
  distance: number | null;
  shotValue: string;      // DB 저장값: "TE / 350", "GR / 5", "HI"
}

export interface HoleInput {
  holeNumber: number;     // 1-18
  par: number;            // 3, 4, 5
  shots: ShotInput[];     // 샷 순서 중요 (이미지2 기반)
}

export interface ScorecardInput {
  athleteId: string;
  coachId?: string;
  roundDate: string;      // "YYYY-MM-DD"
  courseName: string;
  courseLocation?: string;
  weather?: string;
  memo?: string;
  holes: HoleInput[];
}

export interface ShotResult {
  shotNumber: number;
  shotValue: string;
  locationCode: string;
  distance: number | null;
  sgScore: number;
}

export interface HoleResult {
  holeNumber: number;
  par: number;
  score: number;
  totalSg: number;
  shots: ShotResult[];
}

export interface ScorecardResult {
  scorecardId: string;
  totalScore: number;
  totalSg: number;
  holes: HoleResult[];
}

export interface Scorecard {
  id: string;
  athlete_id: string;
  coach_id?: string;
  round_date: string;
  course_name: string;
  course_location?: string;
  total_score: number;
  total_sg: number;
  weather?: string;
  memo?: string;
  created_at: string;
  updated_at: string;
}

// ──────────────────────────────────────────────
// 핵심 유틸: UI 입력 → DB 저장 형식 변환
// "티샷, 150m" → "TE / 150"
// ──────────────────────────────────────────────

/**
 * UI 입력을 DB 저장 형식으로 변환
 * @param locationLabel - "티샷", "페어웨이" 등 한글 위치명 (또는 코드 "TE")
 * @param distance - 거리 (미터), 없으면 undefined
 * @returns ParsedShot { locationCode, distance, shotValue }
 */
export function encodeShotValue(
  locationLabel: string,
  distance?: number
): ParsedShot {
  // 약어인지 한글인지 판별
  const code = LOCATION_ABBR[locationLabel.trim()] 
    ?? locationLabel.trim().toUpperCase();

  const locationCode = code;
  const hasDistance = !NO_DISTANCE_CODES.has(locationCode) && distance != null && distance > 0;

  let shotValue: string;
  if (locationCode === 'HI') {
    shotValue = 'HI';
  } else if (!hasDistance) {
    shotValue = locationCode;
  } else {
    shotValue = `${locationCode} / ${distance}`;
  }

  return {
    locationCode,
    distance: hasDistance ? distance! : null,
    shotValue,
  };
}

/**
 * DB 저장값을 파싱하여 코드와 거리 추출
 * "TE / 350" → { code: "TE", distance: 350 }
 * "HI" → { code: "HI", distance: null }
 */
export function decodeShotValue(shotValue: string): { locationCode: string; distance: number | null } {
  const trimmed = shotValue.trim().toUpperCase();
  if (NO_DISTANCE_CODES.has(trimmed)) {
    return { locationCode: trimmed, distance: null };
  }
  const match = trimmed.match(/^([A-Z]+)\s*\/\s*(\d+)$/);
  if (match) {
    return { locationCode: match[1], distance: parseInt(match[2], 10) };
  }
  return { locationCode: trimmed, distance: null };
}

// ──────────────────────────────────────────────
// DB 저장: 스코어카드 생성
// ──────────────────────────────────────────────

export async function saveScorecard(input: ScorecardInput): Promise<ScorecardResult> {
  const supabase = createClient();

  // 1. 스코어카드 헤더 생성
  const { data: scorecard, error: scError } = await supabase
    .from('scorecards')
    .insert({
      athlete_id:      input.athleteId,
      coach_id:        input.coachId ?? null,
      round_date:      input.roundDate,
      course_name:     input.courseName,
      course_location: input.courseLocation ?? null,
      weather:         input.weather ?? null,
      memo:            input.memo ?? null,
    })
    .select('id')
    .single();

  if (scError || !scorecard) throw new Error(`스코어카드 생성 실패: ${scError?.message}`);
  const scorecardId = scorecard.id;

  // 2. 홀별 데이터 저장
  const holesPayload = input.holes.map(h => ({
    scorecard_id: scorecardId,
    hole_number:  h.holeNumber,
    par:          h.par,
  }));

  const { data: savedHoles, error: holeError } = await supabase
    .from('scorecard_holes')
    .insert(holesPayload)
    .select('id, hole_number');

  if (holeError || !savedHoles) throw new Error(`홀 저장 실패: ${holeError?.message}`);

  // 홀 ID 맵 구성
  const holeIdMap: Record<number, string> = {};
  savedHoles.forEach(h => { holeIdMap[h.hole_number] = h.id; });

  // 3. 샷별 데이터 저장 (순서 중요! 이미지2 기준)
  const shotsPayload: {
    hole_id: string;
    scorecard_id: string;
    hole_number: number;
    shot_number: number;
    shot_value: string;
    location_code: string;
    distance: number | null;
  }[] = [];

  for (const hole of input.holes) {
    const holeId = holeIdMap[hole.holeNumber];
    hole.shots.forEach((shot, idx) => {
      const parsed = encodeShotValue(
        shot.locationCode ?? shot.locationLabel,
        shot.distance
      );
      shotsPayload.push({
        hole_id:       holeId,
        scorecard_id:  scorecardId,
        hole_number:   hole.holeNumber,
        shot_number:   idx + 1,  // 1-indexed
        shot_value:    parsed.shotValue,
        location_code: parsed.locationCode,
        distance:      parsed.distance,
      });
    });
  }

  const { error: shotError } = await supabase
    .from('scorecard_shots')
    .insert(shotsPayload);

  if (shotError) throw new Error(`샷 저장 실패: ${shotError?.message}`);

  // 4. 로컬 API 호출: SG 계산 (Edge Function 대체)
  try {
    const response = await fetch('/api/calculate-sg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scorecard_id: scorecardId,
        holes: input.holes.map(h => {
          const holeId = holeIdMap[h.holeNumber];
          return {
            id:          holeId,
            hole_number: h.holeNumber,
            par:         h.par,
            shots:       h.shots.map((s, idx) => ({
              shot_number: idx + 1,
              shot_value:  encodeShotValue(s.locationCode ?? s.locationLabel, s.distance).shotValue,
            })),
          };
        }),
      }),
    });
    
    if (!response.ok) {
      console.warn('SG 계산 API 오류');
      return { scorecardId, totalScore: 0, totalSg: 0, holes: [] };
    }
    
    const calcResult = await response.json();
    return { scorecardId, ...calcResult } as ScorecardResult;
  } catch (calcError) {
    console.warn('SG 계산 호출 실패:', calcError);
    return {
      scorecardId,
      totalScore: 0,
      totalSg:    0,
      holes:      [],
    };
  }
}

// ──────────────────────────────────────────────
// DB 조회
// ──────────────────────────────────────────────

export async function fetchScorecards(athleteId?: string): Promise<Scorecard[]> {
  const supabase = createClient();
  let query = supabase
    .from('scorecards')
    .select('*')
    .order('round_date', { ascending: false });

  if (athleteId) {
    query = query.eq('athlete_id', athleteId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`스코어카드 조회 실패: ${error.message}`);
  return data ?? [];
}

export async function fetchScorecardDetail(scorecardId: string) {
  const supabase = createClient();

  const [{ data: scorecard }, { data: holes }, { data: shots }] = await Promise.all([
    supabase.from('scorecards').select('*').eq('id', scorecardId).single(),
    supabase.from('scorecard_holes').select('*').eq('scorecard_id', scorecardId).order('hole_number'),
    supabase.from('scorecard_shots').select('*').eq('scorecard_id', scorecardId).order('hole_number').order('shot_number'),
  ]);

  return {
    scorecard,
    holes: holes ?? [],
    shots: shots ?? [],
  };
}
