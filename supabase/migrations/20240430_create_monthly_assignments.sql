-- Create monthly_assignments table
CREATE TABLE IF NOT EXISTS public.monthly_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    athlete_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    coach_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    month TEXT NOT NULL, -- Format: YYYY-MM
    branch TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(athlete_id, month) -- One athlete can only have one assigned coach per month
);

-- Enable RLS
ALTER TABLE public.monthly_assignments ENABLE ROW LEVEL SECURITY;

-- Policies
-- 1. Admins and Head Coaches can manage all monthly assignments
CREATE POLICY "Admins and head coaches can manage all monthly assignments" 
ON public.monthly_assignments 
FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND role IN ('admin', 'head_coach')
    )
) 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND role IN ('admin', 'head_coach')
    )
);

-- 2. Athletes can view their own assignments
CREATE POLICY "Athletes can view their own monthly assignments" 
ON public.monthly_assignments 
FOR SELECT 
TO authenticated 
USING (auth.uid() = athlete_id);

-- 3. Coaches can view their assigned athletes
CREATE POLICY "Coaches can view their assigned athletes" 
ON public.monthly_assignments 
FOR SELECT 
TO authenticated 
USING (auth.uid() = coach_id);

-- 4. Athletes can insert/update during the selection period (27th-30th)
-- Note: SQL-level date checking is tricky for "last 27-30 days of month", 
-- usually better handled in application logic but we can add a basic check.
-- For simplicity, we'll allow updates if it's their own record, and handle the date check in the UI.
CREATE POLICY "Athletes can select their coach" 
ON public.monthly_assignments 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = athlete_id);

CREATE POLICY "Athletes can update their coach selection" 
ON public.monthly_assignments 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = athlete_id)
WITH CHECK (auth.uid() = athlete_id);

CREATE POLICY "Athletes can delete their coach selection" 
ON public.monthly_assignments 
FOR DELETE 
TO authenticated 
USING (auth.uid() = athlete_id);
