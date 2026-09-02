-- records 테이블에 실제 삽입 시간을 추적하는 inserted_at 컬럼 추가
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS inserted_at TIMESTAMPTZ;

-- 기존 데이터 백필 (Backfill)
UPDATE public.records SET inserted_at = created_at WHERE inserted_at IS NULL;

-- 기본값 및 NOT NULL 제약 조건 설정
ALTER TABLE public.records ALTER COLUMN inserted_at SET DEFAULT timezone('utc'::text, now());
ALTER TABLE public.records ALTER COLUMN inserted_at SET NOT NULL;

-- test_sessions 테이블에도 동일하게 적용
ALTER TABLE public.test_sessions ADD COLUMN IF NOT EXISTS inserted_at TIMESTAMPTZ;
UPDATE public.test_sessions SET inserted_at = created_at WHERE inserted_at IS NULL;
ALTER TABLE public.test_sessions ALTER COLUMN inserted_at SET DEFAULT timezone('utc'::text, now());
ALTER TABLE public.test_sessions ALTER COLUMN inserted_at SET NOT NULL;
