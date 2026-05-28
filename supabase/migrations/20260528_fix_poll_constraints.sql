-- 1. `poll_responses` 테이블에 `vote_date` 컬럼 추가 (없는 경우)
ALTER TABLE public.poll_responses ADD COLUMN IF NOT EXISTS vote_date DATE;

-- 2. `polls` 테이블에 `is_recurring` 컬럼 추가 (없는 경우)
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;

-- 3. 기존의 (poll_id, user_id) 고유 제약 조건 제거
-- (반복 투표의 경우 같은 poll_id, user_id로 여러 날짜에 걸쳐 투표가 가능해야 하므로 삭제)
ALTER TABLE public.poll_responses DROP CONSTRAINT IF EXISTS poll_responses_poll_id_user_id_key;

-- 4. 새로운 고유 제약 조건 추가 (poll_id, user_id, vote_date)
-- PostgreSQL 15 이상을 사용하는 Supabase에서는 NULLS NOT DISTINCT를 통해 
-- vote_date가 NULL인 경우(단일 투표)에도 중복을 방지할 수 있습니다.
ALTER TABLE public.poll_responses ADD CONSTRAINT poll_responses_poll_id_user_id_vote_date_key UNIQUE NULLS NOT DISTINCT (poll_id, user_id, vote_date);
