-- 담임코치 선택 (monthly_assignments) 테이블에 대해 슈퍼관리자를 포함한 인증된 모든 유저가 데이터를 다룰 수 있도록 권한을 오픈합니다.
ALTER TABLE public.monthly_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated on monthly_assignments" ON public.monthly_assignments;
CREATE POLICY "Allow all for authenticated on monthly_assignments" ON public.monthly_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);
