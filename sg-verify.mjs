// ============================================================
// sg-verify.mjs
// SG 계산 결과 검증 스크립트
// 스프레드시트 샘플 데이터(홀1~18)와 실제 계산 결과를 비교
// Usage: node sg-verify.mjs
// ============================================================

// 스프레드시트 C30:U45 에서 읽은 실제 샷 데이터
const SAMPLE_SCORECARD = {
  holes: [
    { hole: 1,  par: 4, score: 4, shots: ['TE', 'RO / 95', 'GR / 12', 'GR / 2',  'HI'] },
    { hole: 2,  par: 4, score: 4, shots: ['TE', 'RO / 125','GR / 16', 'GR / 3',  'HI'] },
    { hole: 3,  par: 4, score: 4, shots: ['TE', 'FW / 100','GA / 10', 'GR / 1',  'HI'] },
    { hole: 4,  par: 4, score: 4, shots: ['TE', 'FW / 190','GA / 43', 'GR / 4',  'HI'] },
    { hole: 5,  par: 3, score: 3, shots: ['TE / 115', 'GR / 6', 'GR / 1', 'HI'] },
    { hole: 6,  par: 5, score: 4, shots: ['TE', 'FW / 250','FW / 85', 'GR / 4',  'HI'] },
    { hole: 7,  par: 4, score: 5, shots: ['TE', 'RO / 150','GA / 15', 'GR / 5',  'GR / 1', 'HI'] },
    { hole: 8,  par: 3, score: 3, shots: ['TE / 150', 'GR / 10', 'GR / 1', 'HI'] },
    { hole: 9,  par: 5, score: 5, shots: ['TE', 'FW / 300','FW / 130','GR / 7',  'GR / 1', 'HI'] },
    { hole: 10, par: 5, score: 4, shots: ['TE', 'FW / 250','RO / 85', 'GR / 3',  'HI'] },
    { hole: 11, par: 3, score: 3, shots: ['TE / 130', 'GR / 15', 'GR / 2', 'HI'] },
    { hole: 12, par: 4, score: 3, shots: ['TE', 'FW / 90', 'GR / 1',  'HI'] },
    { hole: 13, par: 4, score: 4, shots: ['TE', 'FW / 120','GA / 7',  'GR / 1',  'HI'] },
    { hole: 14, par: 5, score: 5, shots: ['TE', 'FW / 280','FW / 130','GR / 15', 'GR / 2', 'HI'] },
    { hole: 15, par: 4, score: 3, shots: ['TE', 'FW / 80', 'GR / 10', 'HI'] },
    { hole: 16, par: 3, score: 3, shots: ['TE / 130', 'GR / 13', 'GR / 2', 'HI'] },
    { hole: 17, par: 4, score: 4, shots: ['TE', 'FW / 95', 'GR / 7',  'GR / 1',  'HI'] },
    { hole: 18, par: 4, score: 4, shots: ['TE', 'FW / 125','GR / 15', 'GR / 2',  'HI'] },
  ]
};

// 스프레드시트 C51:U63에서 읽은 실제 샷별 점수 기대값
const EXPECTED_SHOT_SCORES = {
  1:  [0.08, 0.07,  0.21, -0.35, 0.00],
  2:  [0.23, 0.04,  0.34, -0.60, 0.00],
  3:  [-0.16, 0.26, 0.00, -0.10, 0.00],
  4:  [0.30, -0.30, -0.30, -0.70, 0.00],
  5:  [-0.15, 0.25, -0.10, 0.00, 0.00],
  6:  [-0.41, 0.15, -0.05, -0.70, 0.00],
  7:  [0.38, -0.03, 0.45,  0.30, -0.10, 0.00],
  8:  [0.05, 0.05, -0.10,  0.00],
  9:  [-0.16, 0.15, -0.10,  0.20, -0.10, 0.00],
  10: [-0.41, 0.43, -0.43, -0.60, 0.00],
  11: [0.24, 0.11, -0.35,  0.00],
  12: [-0.21, -0.70, -0.10, 0.00],
  13: [-0.06, 0.16,  0.00, -0.10, 0.00],
  14: [-0.26, 0.25,  0.25,  0.11, -0.35, 0.00],
  15: [-0.26, 0.31, -1.05, 0.00],
  16: [0.18, 0.17, -0.35,  0.00],
  17: [-0.21, 0.11,  0.20, -0.10, 0.00],
  18: [-0.06, 0.30,  0.11, -0.35, 0.00],
};

// 스프레드시트 C55:U60에서 읽은 홀별 합산 점수
const EXPECTED_HOLE_TOTALS = {
  1: 0.00, 2: 0.00, 3: 0.00, 4: -1.00, 5: 0.00,
  6: -1.00, 7: 1.00, 8: 0.00, 9: 0.00, 10: -1.00,
  11: 0.00, 12: -1.00, 13: 0.00, 14: 0.00, 15: -1.00,
  16: 0.00, 17: 0.00, 18: 0.00
};

// ──────────────────────────────────────────────
// 간단한 검증 실행
// ──────────────────────────────────────────────
console.log('=== SG 계산 검증 ===\n');
console.log('기대 총 SG 점수:', Object.values(EXPECTED_HOLE_TOTALS).reduce((a, b) => a + b, 0));
console.log('기대 총 타수: 69 (스프레드시트 스코어 행 합계)');
console.log('');

console.log('홀별 기대 합산 SG:');
Object.entries(EXPECTED_HOLE_TOTALS).forEach(([hole, sg]) => {
  console.log(`  홀 ${hole.padStart(2)}: ${sg.toFixed(2)}`);
});

console.log('\n샷별 기대 점수 (첫 3홀):');
[1, 2, 3].forEach(hole => {
  const shots = EXPECTED_SHOT_SCORES[hole];
  console.log(`  홀 ${hole}: [${shots.map(s => s.toFixed(2)).join(', ')}]`);
});

console.log('\n✓ 이 값들과 Edge Function 결과가 일치하면 계산이 정확합니다.');
console.log('\n검증 방법:');
console.log('  1. Supabase SQL Editor에서 setup_scorecard.sql 실행');
console.log('  2. supabase functions deploy calculate-sg');
console.log('  3. 위 SAMPLE_SCORECARD 데이터로 saveScorecard() 호출');
console.log('  4. EXPECTED_SHOT_SCORES 값과 비교');
