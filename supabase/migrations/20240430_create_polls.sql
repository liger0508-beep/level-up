-- 1. Create polls table
CREATE TABLE IF NOT EXISTS public.polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL, -- 'all', 'coach', 'athlete', 'parent'
    branch TEXT NOT NULL DEFAULT '전체',
    status TEXT NOT NULL DEFAULT 'ongoing', -- 'ongoing', 'closed'
    title TEXT NOT NULL,
    description TEXT,
    options JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {id, text, votes}
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    author_id UUID CONSTRAINT polls_author_id_fkey REFERENCES public.users(id),
    is_important BOOLEAN DEFAULT false,
    total_participants INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.poll_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    option_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(poll_id, user_id)
);

-- 3. Enable RLS
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_responses ENABLE ROW LEVEL SECURITY;

-- 4. Policies for polls
CREATE POLICY "Polls are viewable by everyone" ON public.polls
    FOR SELECT USING (true);

CREATE POLICY "Polls can be managed by authenticated users" ON public.polls
    FOR ALL USING (auth.role() = 'authenticated');

-- 5. Policies for poll_responses
CREATE POLICY "Responses are viewable by everyone" ON public.poll_responses
    FOR SELECT USING (true);

CREATE POLICY "Users can cast their own votes" ON public.poll_responses
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own votes" ON public.poll_responses
    FOR UPDATE USING (auth.uid() = user_id);

-- 6. Trigger to automatically update total_participants in polls table
CREATE OR REPLACE FUNCTION update_poll_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.polls 
        SET total_participants = total_participants + 1
        WHERE id = NEW.poll_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.polls 
        SET total_participants = total_participants - 1
        WHERE id = OLD.poll_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_vote_cast
AFTER INSERT OR DELETE ON public.poll_responses
FOR EACH ROW EXECUTE FUNCTION update_poll_stats();
