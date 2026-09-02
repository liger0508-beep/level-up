-- 훈련 세션을 저장하기 위한 단일 테이블 구조 제안
CREATE TABLE training_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coach_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  training_type VARCHAR(50) NOT NULL, 
  -- 훈련 종류: 'tee_shot_distance', 'tee_shot_accuracy', 'over_180m', '150_to_179m', '120_to_149m', '90_to_119m', 'bunker', 'approach', 'putting_over_9m', 'putting_4_to_8m', 'putting_2_to_3m', 'putting_1m'
  
  target_goal INTEGER DEFAULT 0,       -- 목표 성공 횟수 (예: 20)
  current_success INTEGER DEFAULT 0,   -- 현재까지 성공한 횟수 (이어서 하기를 위해 필수)
  current_fail INTEGER DEFAULT 0,      -- 현재까지 실패한 횟수
  
  status VARCHAR(20) DEFAULT 'in_progress', -- 'in_progress' (진행중), 'completed' (완료)
  
  started_at TIMESTAMPTZ DEFAULT NOW(),     -- 훈련 시작 시간
  ended_at TIMESTAMPTZ,                     -- 훈련 완료/종료 시간
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS (Row Level Security) 설정이 필요할 경우 추가
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;

-- 정책 예시: 자신의 훈련만 볼 수 있음
CREATE POLICY "Users can view own training sessions" ON training_sessions
  FOR SELECT USING (auth.uid() = user_id);
