-- 1. consultations 테이블에 구조화 상담 및 향후 AI 분석용 컬럼 추가
ALTER TABLE public.consultations
    ADD COLUMN IF NOT EXISTS category text DEFAULT 'general',
    ADD COLUMN IF NOT EXISTS target_month text,
    ADD COLUMN IF NOT EXISTS structured_data jsonb;

-- 2. 선수별 / 상담유형별 / 기준월별 조회 및 향후 AI 분석 쿼리 성능용 인덱스
CREATE INDEX IF NOT EXISTS idx_consultations_user_category_date
    ON public.consultations (user_id, category, date DESC);

CREATE INDEX IF NOT EXISTS idx_consultations_category_month
    ON public.consultations (category, target_month);

-- 3. 선수(athlete) 및 학부모(parent) 열람 완전 차단 RLS 정책
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;

-- 기존 전체 공개 정책이 있다면 제거 (안전한 재실행)
DROP POLICY IF EXISTS "Allow all for authenticated on consultations" ON public.consultations;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.consultations;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.consultations;
DROP POLICY IF EXISTS "Allow coaches and admins full access on consultations" ON public.consultations;

-- 코치(coach) 및 관리자(admin, super_admin, superadmin)만 조회/작성/수정/삭제 가능
CREATE POLICY "Allow coaches and admins full access on consultations"
ON public.consultations
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND u.role IN ('coach', 'admin', 'super_admin', 'superadmin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND u.role IN ('coach', 'admin', 'super_admin', 'superadmin')
    )
);

