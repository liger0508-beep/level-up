CREATE TABLE IF NOT EXISTS public.player_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    athlete_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    coach_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    month TEXT NOT NULL, -- Format: YYYY-MM
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(athlete_id, month)
);

ALTER TABLE public.player_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reports" 
ON public.player_reports FOR SELECT TO authenticated 
USING (auth.uid() = athlete_id OR auth.uid() = coach_id OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'head_coach')));

CREATE POLICY "Coaches can insert reports" 
ON public.player_reports FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = coach_id OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'head_coach')));

CREATE POLICY "Coaches can update reports" 
ON public.player_reports FOR UPDATE TO authenticated 
USING (auth.uid() = coach_id OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'head_coach')));
