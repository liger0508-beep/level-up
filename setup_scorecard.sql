-- ============================================================
-- 스코어카드 시스템 DB 스키마 (심합 분석 버전)
-- 스프레드시트 '신규 스코어카드' 시트의 C93:U149 로직 반영을 위한 데이터 구성
-- ============================================================

-- 1. SG 기준값 테이블 (신규_구간점수 B3:H71)
CREATE TABLE IF NOT EXISTS sg_baseline (
  distance_m  INTEGER PRIMARY KEY,
  tee_p5      NUMERIC(7,4),   -- C열 (Tee Shot Par 5)
  tee_p4      NUMERIC(7,4),   -- D열 (Tee Shot Par 4 / Fairway)
  rough       NUMERIC(7,4),   -- E열 (Rough)
  bunker      NUMERIC(7,4),   -- F열 (Bunker)
  putting     NUMERIC(7,4),   -- G열 (Putting New)
  app_10m     NUMERIC(7,4),   -- J열 (Approach 0-10m)
  app_25m     NUMERIC(7,4),   -- K열 (Approach 11-25m)
  app_30m     NUMERIC(7,4),   -- L열 (Approach 26-30m)
  bunker_25m  NUMERIC(7,4),   -- M열 (Bunker 0-25m)
  bunker_30m  NUMERIC(7,4)    -- N열 (Bunker 26-30m)
);

-- 2. 위치별 페널티값 테이블 (신규_구간점수 C77:D87)
CREATE TABLE IF NOT EXISTS sg_location_penalty (
  location_code TEXT PRIMARY KEY,
  penalty_value NUMERIC(7,4) NOT NULL,
  description   TEXT
);

-- ============================================================
-- 기준 데이터 삽입
-- ============================================================

-- 위치 페널티 (신규_구간점수 C77:D87)
INSERT INTO sg_location_penalty (location_code, penalty_value, description) VALUES
  ('FW', -0.08, '페어웨이'),
  ('RO',  0.20, '러프'),
  ('FB',  0.25, '페어웨이 벙커'),
  ('FO',  0.50, '숲'),
  ('PA',  1.00, '패널티구역'),
  ('OB',  2.00, '오비'),
  ('GR',  0.00, '그린'),
  ('GA',  0.00, '그린 주변 어프로치'),
  ('GB',  0.40, '그린 주변 벙커'),
  ('-',   0.00, '-'),
  ('PS',  1.00, '벌타'),
  ('HI',  0.00, '홀인'),
  ('TE',  0.00, '티샷')
ON CONFLICT (location_code) DO UPDATE
  SET penalty_value = EXCLUDED.penalty_value,
      description   = EXCLUDED.description;

-- SG 기준값 (신규_구간점수 B3:G71 데이터 기반)
-- 주의: 데이터가 많으므로 주요 구간 위주로 삽입하거나 전체를 반영해야 함.
-- 사용자가 제공한 CSV 데이터를 기반으로 정제하여 삽입.
INSERT INTO sg_baseline (distance_m, tee_p5, tee_p4, rough, bunker, putting, app_10m, app_25m, app_30m, bunker_25m, bunker_30m) VALUES
  (0, 0, 0, 0, 0, -1, NULL, NULL, NULL, NULL, NULL),
  (1, -2.175, -0.45, -0.925, 0.45, -0.9, NULL, NULL, NULL, NULL, NULL),
  (2, -2.125, -0.45, -0.875, 0.45, -0.65, NULL, NULL, NULL, NULL, NULL),
  (3, -2.075, -0.45, -0.825, 0.45, -0.4, NULL, NULL, NULL, NULL, NULL),
  (4, -2.025, -0.45, -0.775, 0.45, -0.3, NULL, NULL, NULL, NULL, NULL),
  (5, -1.975, -0.45, -0.725, 0.45, -0.2, NULL, NULL, NULL, NULL, NULL),
  (6, -1.925, -0.45, -0.675, 0.45, -0.15, NULL, NULL, NULL, NULL, NULL),
  (7, -1.875, -0.45, -0.625, 0.45, -0.1, NULL, NULL, NULL, NULL, NULL),
  (8, -1.825, -0.45, -0.575, 0.45, -0.05, NULL, NULL, NULL, NULL, NULL),
  (9, -1.775, -0.45, -0.525, 0.45, 0, NULL, NULL, NULL, NULL, NULL),
  (10, -1.725, -0.45, -0.475, 0.45, 0.05, NULL, NULL, NULL, NULL, NULL),
  (11, -1.675, -0.45, -0.425, 0.45, 0.1, NULL, NULL, NULL, NULL, NULL),
  (12, -1.625, -0.45, -0.375, 0.45, 0.14, NULL, NULL, NULL, NULL, NULL),
  (13, -1.575, -0.45, -0.325, 0.45, 0.18, NULL, NULL, NULL, NULL, NULL),
  (14, -1.525, -0.45, -0.275, 0.45, 0.21, NULL, NULL, NULL, NULL, NULL),
  (15, -1.475, -0.45, -0.225, 0.45, 0.24, NULL, NULL, NULL, NULL, NULL),
  (16, -1.425, -0.45, -0.175, 0.45, 0.26, NULL, NULL, NULL, NULL, NULL),
  (17, -1.375, -0.45, -0.125, 0.45, 0.28, NULL, NULL, NULL, NULL, NULL),
  (18, -1.325, -0.45, -0.075, 0.45, 0.3, NULL, NULL, NULL, NULL, NULL),
  (19, -1.275, -0.45, -0.025, 0.45, 0.31, NULL, NULL, NULL, NULL, NULL),
  (20, -1.225, -0.45, 0.025, 0.45, 0.32, NULL, NULL, NULL, NULL, NULL),
  (30, -1.175, -0.45, 0.075, 0.45, NULL, NULL, NULL, NULL, NULL, NULL),
  (40, -1.125, -0.375, 0.125, 0.375, NULL, NULL, NULL, NULL, NULL, NULL),
  (50, -1.075, -0.325, 0.175, 0.325, NULL, NULL, NULL, NULL, NULL, NULL),
  (60, -1.025, -0.275, 0.225, 0.275, NULL, NULL, NULL, NULL, NULL, NULL),
  (70, -0.975, -0.225, 0.275, 0.225, NULL, NULL, NULL, NULL, NULL, NULL),
  (80, -0.925, -0.175, 0.325, 0.175, NULL, NULL, NULL, NULL, NULL, NULL),
  (90, -0.875, -0.125, 0.375, 0.125, NULL, NULL, NULL, NULL, NULL, NULL),
  (100, -0.825, -0.075, 0.425, 0.075, NULL, NULL, NULL, NULL, NULL, NULL),
  (110, -0.775, -0.025, 0.475, 0.025, NULL, NULL, NULL, NULL, NULL, NULL),
  (120, -0.725, 0.025, 0.525, -0.025, NULL, NULL, NULL, NULL, NULL, NULL),
  (130, -0.675, 0.075, 0.575, -0.075, NULL, NULL, NULL, NULL, NULL, NULL),
  (140, -0.625, 0.125, 0.625, -0.125, NULL, NULL, NULL, NULL, NULL, NULL),
  (150, -0.575, 0.175, 0.675, -0.175, NULL, NULL, NULL, NULL, NULL, NULL),
  (160, -0.525, 0.225, 0.725, -0.225, NULL, NULL, NULL, NULL, NULL, NULL),
  (170, -0.475, 0.275, 0.775, -0.275, NULL, NULL, NULL, NULL, NULL, NULL),
  (180, -0.425, 0.325, 0.825, -0.325, NULL, NULL, NULL, NULL, NULL, NULL),
  (190, -0.375, 0.375, 0.875, -0.375, NULL, NULL, NULL, NULL, NULL, NULL),
  (200, -0.325, 0.425, 0.925, -0.425, NULL, NULL, NULL, NULL, NULL, NULL),
  (210, -0.275, 0.475, 0.975, -0.475, NULL, NULL, NULL, NULL, NULL, NULL),
  (220, -0.225, 0.525, 1.025, -0.525, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (230, -0.175, 0.575, 1.075, -0.575, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (240, -0.125, 0.625, 1.125, -0.625, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (250, -0.075, 0.675, 1.175, -0.675, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (260, -0.025, 0.725, 1.225, -0.725, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (270, 0.025, 0.775, 1.275, -0.775, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (280, 0.075, 0.825, 1.325, -0.825, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (290, 0.125, 0.875, 1.375, -0.875, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (300, 0.175, 0.925, 1.425, -0.925, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (310, 0.225, 0.975, 1.475, -0.975, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (320, 0.275, 1.025, 1.525, -1.025, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (330, 0.325, 1.075, 1.575, -1.075, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (340, 0.375, 1.125, 1.625, -1.125, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (350, 0.425, 1.175, 1.675, -1.175, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (360, 0.475, 1.225, 1.725, -1.225, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (370, 0.525, 1.275, 1.775, -1.275, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (380, 0.575, 1.325, 1.825, -1.325, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (390, 0.625, 1.375, 1.875, -1.375, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (400, 0.675, 1.425, 1.925, -1.425, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (410, 0.725, 1.475, 1.975, -1.475, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (420, 0.775, 1.525, 2.025, -1.525, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (430, 0.825, 1.575, 2.075, -1.575, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (440, 0.875, 1.625, 2.125, -1.625, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (450, 0.925, 1.675, 2.175, -1.675, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (460, 0.975, 1.725, 2.225, -1.725, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (470, 1.025, 1.775, 2.275, -1.775, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (480, 1.075, 1.825, 2.325, -1.825, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (490, 1.125, 1.875, 2.375, -1.875, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (500, 1.175, 1.925, 2.425, -1.925, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
ON CONFLICT (distance_m) DO UPDATE
  SET tee_p5 = EXCLUDED.tee_p5,
      tee_p4 = EXCLUDED.tee_p4,
      rough  = EXCLUDED.rough,
      bunker = EXCLUDED.bunker,
      putting = EXCLUDED.putting,
      app_10m = EXCLUDED.app_10m,
      app_25m = EXCLUDED.app_25m,
      app_30m = EXCLUDED.app_30m,
      bunker_25m = EXCLUDED.bunker_25m,
      bunker_30m = EXCLUDED.bunker_30m;

-- PAR5 추가 보정값 (B90:D92)
CREATE TABLE IF NOT EXISTS sg_par5_adjustment (
  rule_name   TEXT PRIMARY KEY,
  value       NUMERIC(7,4) NOT NULL
);

INSERT INTO sg_par5_adjustment (rule_name, value) VALUES
  ('par5_two_on_attempt',    -0.25),
  ('par5_three_on_approach',  0.50),
  ('par4_three_on_approach',  0.50)
ON CONFLICT (rule_name) DO UPDATE SET value = EXCLUDED.value;

-- RLS
ALTER TABLE sg_baseline ENABLE ROW LEVEL SECURITY;
ALTER TABLE sg_location_penalty ENABLE ROW LEVEL SECURITY;
ALTER TABLE sg_par5_adjustment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sg_baseline_read"      ON sg_baseline;
DROP POLICY IF EXISTS "sg_penalty_read"       ON sg_location_penalty;
DROP POLICY IF EXISTS "sg_par5_adj_read"      ON sg_par5_adjustment;

CREATE POLICY "sg_baseline_read"      ON sg_baseline      FOR SELECT USING (true);
CREATE POLICY "sg_penalty_read"       ON sg_location_penalty FOR SELECT USING (true);
CREATE POLICY "sg_par5_adj_read"      ON sg_par5_adjustment  FOR SELECT USING (true);

