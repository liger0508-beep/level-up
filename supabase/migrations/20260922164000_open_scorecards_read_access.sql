-- 모든 사용자가 대회 스코어카드를 조회할 수 있도록 읽기 권한(SELECT) 개방
CREATE POLICY "Allow public read access for scorecards" ON public.scorecards FOR SELECT USING (true);
CREATE POLICY "Allow public read access for scorecard_holes" ON public.scorecard_holes FOR SELECT USING (true);
CREATE POLICY "Allow public read access for tournament_marker_scores" ON public.tournament_marker_scores FOR SELECT USING (true);
