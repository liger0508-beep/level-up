-- 1. 기존의 잘못된 참조 관계(old tournaments 테이블)를 끊습니다.
ALTER TABLE public.scorecards DROP CONSTRAINT IF EXISTS scorecards_tournament_id_fkey;

-- 2. 새로운 score_tournaments 테이블에 존재하지 않는 기존 tournament_id 값들을 먼저 NULL 처리합니다.
-- (이 작업을 하지 않으면 기존 데이터 충돌로 인해 다음 단계에서 에러가 발생할 수 있습니다.)
UPDATE public.scorecards
SET tournament_id = NULL
WHERE tournament_id IS NOT NULL 
  AND tournament_id NOT IN (SELECT id FROM public.score_tournaments);

-- 3. 올바른 새로운 score_tournaments 테이블을 바라보도록 외래 키를 맺습니다.
ALTER TABLE public.scorecards 
ADD CONSTRAINT scorecards_tournament_id_fkey 
FOREIGN KEY (tournament_id) REFERENCES public.score_tournaments(id) ON DELETE SET NULL;
