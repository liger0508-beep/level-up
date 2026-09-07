-- 기존에 잘못 연결된(tournaments 테이블을 바라보는) 테이블들을 깨끗하게 지웁니다.
DROP TABLE IF EXISTS public.tournament_leaderboards CASCADE;
DROP TABLE IF EXISTS public.tournament_marker_scores CASCADE;
DROP TABLE IF EXISTS public.tournament_participants CASCADE;

-- 1. tournament_participants 테이블 새로 생성 (score_tournaments 바라보도록)
CREATE TABLE public.tournament_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID REFERENCES public.score_tournaments(id) ON DELETE CASCADE,
    athlete_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tournament_id, athlete_id)
);

-- 2. tournament_marker_scores 테이블 새로 생성
CREATE TABLE public.tournament_marker_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scorecard_id UUID REFERENCES public.scorecards(id) ON DELETE CASCADE,
    hole_number INT NOT NULL,
    score INT NOT NULL,
    putts INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(scorecard_id, hole_number)
);

-- 3. tournament_leaderboards 테이블 새로 생성
CREATE TABLE public.tournament_leaderboards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID REFERENCES public.score_tournaments(id) ON DELETE CASCADE,
    athlete_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    round_number INT NOT NULL DEFAULT 0,
    thru_hole INT NOT NULL DEFAULT 0,
    total_score INT NOT NULL DEFAULT 0,
    rank_score INT,
    rank_tee_shot NUMERIC,
    rank_second_shot NUMERIC,
    rank_around_green NUMERIC,
    rank_putting NUMERIC,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tournament_id, athlete_id, round_number)
);

-- 4. 방금 다시 만든 3개 테이블의 권한(RLS) 허용 처리
ALTER TABLE public.tournament_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated on tournament_participants" ON public.tournament_participants FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.tournament_marker_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated on tournament_marker_scores" ON public.tournament_marker_scores FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.tournament_leaderboards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated on tournament_leaderboards" ON public.tournament_leaderboards FOR ALL TO authenticated USING (true) WITH CHECK (true);
