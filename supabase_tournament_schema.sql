-- 1. Create score_tournaments table (독립적인 스코어 작성용 토너먼트 테이블)
CREATE TABLE IF NOT EXISTS public.score_tournaments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_rounds INT NOT NULL DEFAULT 1,
    location TEXT NOT NULL,
    password TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT '준비중',
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create tournament_participants table
CREATE TABLE IF NOT EXISTS public.tournament_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID REFERENCES public.score_tournaments(id) ON DELETE CASCADE,
    athlete_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tournament_id, athlete_id)
);

-- 3. Add tournament and signature columns to scorecards
ALTER TABLE public.scorecards
ADD COLUMN IF NOT EXISTS tournament_id UUID REFERENCES public.score_tournaments(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS tournament_round INT,
ADD COLUMN IF NOT EXISTS marker_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS marker_signature TEXT,
ADD COLUMN IF NOT EXISTS player_signature TEXT,
ADD COLUMN IF NOT EXISTS referee_signature TEXT,
ADD COLUMN IF NOT EXISTS marker_signed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS player_signed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS referee_signed_at TIMESTAMP WITH TIME ZONE;

-- 4. Create tournament_marker_scores table
CREATE TABLE IF NOT EXISTS public.tournament_marker_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scorecard_id UUID REFERENCES public.scorecards(id) ON DELETE CASCADE,
    hole_number INT NOT NULL,
    score INT NOT NULL,
    putts INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(scorecard_id, hole_number)
);

-- 5. Create tournament_leaderboards table
CREATE TABLE IF NOT EXISTS public.tournament_leaderboards (
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

-- RLS (Row Level Security) 비활성화 (개발 및 테스트 편의를 위해 일단 모두 허용)
ALTER TABLE public.score_tournaments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_marker_scores DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_leaderboards DISABLE ROW LEVEL SECURITY;
