-- 1. `polls` 테이블에 `allow_multiple` 컬럼 추가 (없는 경우)
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS allow_multiple BOOLEAN DEFAULT false;

-- 2. `poll_responses` 테이블의 기존 고유 제약 조건 (poll_id, user_id, vote_date) 삭제
ALTER TABLE public.poll_responses DROP CONSTRAINT IF EXISTS poll_responses_poll_id_user_id_vote_date_key;

-- 3. 여러 개의 항목에 투표할 수 있도록 `option_id`를 포함한 새로운 고유 제약 조건 추가
-- 이렇게 하면 같은 사람이 같은 날짜에 같은 투표의 서로 다른 option_id에 투표할 수 있습니다.
ALTER TABLE public.poll_responses ADD CONSTRAINT poll_responses_poll_id_user_id_vote_date_option_id_key UNIQUE NULLS NOT DISTINCT (poll_id, user_id, vote_date, option_id);
