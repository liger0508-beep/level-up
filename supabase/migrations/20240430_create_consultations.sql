-- Create consultations table
CREATE TABLE IF NOT EXISTS public.consultations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    coach_name TEXT,
    title TEXT,
    content TEXT,
    author TEXT,
    type TEXT DEFAULT 'all', -- 'all' or 'assigned'
    athlete_name TEXT NOT NULL,
    is_important BOOLEAN DEFAULT false,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    coach_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow authenticated read" ON public.consultations
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert" ON public.consultations
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update" ON public.consultations
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete" ON public.consultations
    FOR DELETE TO authenticated USING (true);
