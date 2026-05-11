-- Update notices table to link with users
ALTER TABLE public.notices DROP COLUMN IF EXISTS author;
ALTER TABLE public.notices ADD COLUMN author_id UUID CONSTRAINT notices_author_id_fkey REFERENCES public.users(id) ON DELETE SET NULL;

-- Enable RLS (if not already enabled)
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

-- Policies for notices
DROP POLICY IF EXISTS "Notices are viewable by everyone" ON public.notices;
CREATE POLICY "Notices are viewable by everyone" ON public.notices
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Notices can be managed by authenticated users" ON public.notices;
CREATE POLICY "Notices can be managed by authenticated users" ON public.notices
    FOR ALL USING (auth.role() = 'authenticated');
