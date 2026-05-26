-- 1. Create the new test_sessions table
CREATE TABLE IF NOT EXISTS public.test_sessions (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    coach_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    category TEXT NOT NULL,
    title TEXT,
    
    total_score FLOAT DEFAULT 0,
    
    -- Core Statistics Columns
    driver_score FLOAT,
    iron_score FLOAT,
    
    short_approach_score FLOAT,
    middle_approach_score FLOAT,
    long_approach_score FLOAT,
    short_bunker_score FLOAT,
    long_bunker_score FLOAT,
    
    short_putt_score FLOAT,
    middle_putt_score FLOAT,
    long_putt_score FLOAT,
    
    -- Raw Data payload (for 12 shots proximities etc)
    raw_shot_data JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexing for fast Analytics & Hall of Fame queries
CREATE INDEX idx_test_sessions_user_id ON public.test_sessions(user_id);
CREATE INDEX idx_test_sessions_category ON public.test_sessions(category);
CREATE INDEX idx_test_sessions_total_score ON public.test_sessions(total_score ASC);

-- 2. Migrate existing 'test' records from public.records to public.test_sessions
INSERT INTO public.test_sessions (
    id, user_id, coach_id, category, title, created_at, updated_at,
    total_score,
    driver_score, iron_score,
    short_putt_score, middle_putt_score, long_putt_score,
    raw_shot_data
)
SELECT 
    id, 
    user_id, 
    coach_id, 
    category, 
    title, 
    created_at, 
    created_at as updated_at,
    COALESCE(score, ((content::JSONB)->>'totalScore')::FLOAT, ((content::JSONB)->>'total')::FLOAT, 0),
    
    -- Extract known objects' scores if they exist
    ((content::JSONB)->'driver'->>'score')::FLOAT,
    ((content::JSONB)->'iron'->>'score')::FLOAT,
    ((content::JSONB)->'short'->>'score')::FLOAT,
    ((content::JSONB)->'middle'->>'score')::FLOAT,
    ((content::JSONB)->'long'->>'score')::FLOAT,
    
    content::JSONB -- keep the whole JSON payload to retain raw 1-12 shot proximities
FROM public.records
WHERE type = 'test'
ON CONFLICT (id) DO NOTHING;

-- 3. (Optional) Once you confirm the data has safely migrated, you can delete old test records
-- DELETE FROM public.records WHERE type = 'test';
