-- 토너먼트 테이블의 RLS(Row Level Security)를 활성화하고, 로그인한 사용자가 자유롭게 데이터를 넣고 볼 수 있도록 권한 정책(Policy)을 추가합니다.

-- 1. score_tournaments 테이블 권한 정책
ALTER TABLE public.score_tournaments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated on score_tournaments" ON public.score_tournaments;
CREATE POLICY "Allow all for authenticated on score_tournaments" ON public.score_tournaments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. tournament_participants 테이블 권한 정책
ALTER TABLE public.tournament_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated on tournament_participants" ON public.tournament_participants;
CREATE POLICY "Allow all for authenticated on tournament_participants" ON public.tournament_participants FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. tournament_marker_scores 테이블 권한 정책
ALTER TABLE public.tournament_marker_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated on tournament_marker_scores" ON public.tournament_marker_scores;
CREATE POLICY "Allow all for authenticated on tournament_marker_scores" ON public.tournament_marker_scores FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. tournament_leaderboards 테이블 권한 정책
ALTER TABLE public.tournament_leaderboards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated on tournament_leaderboards" ON public.tournament_leaderboards;
CREATE POLICY "Allow all for authenticated on tournament_leaderboards" ON public.tournament_leaderboards FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. 기존 scorecards 테이블에 대해서도 필요한 권한 추가 (만약 막혀있다면)
-- (기존에 잘 되고 있었다면 이 부분은 무시될 수 있지만, 안전하게 모든 권한을 열어줍니다.)
CREATE POLICY "Allow all for authenticated on scorecards" ON public.scorecards FOR ALL TO authenticated USING (true) WITH CHECK (true);
