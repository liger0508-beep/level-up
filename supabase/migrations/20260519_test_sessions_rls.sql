-- Enable Row Level Security
ALTER TABLE public.test_sessions ENABLE ROW LEVEL SECURITY;

-- Policy to allow authenticated users to view test sessions
CREATE POLICY "Allow authenticated users to select test_sessions" 
ON public.test_sessions FOR SELECT 
TO authenticated 
USING (true);

-- Policy to allow authenticated users to insert test sessions
CREATE POLICY "Allow authenticated users to insert test_sessions" 
ON public.test_sessions FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Policy to allow authenticated users to update test sessions
CREATE POLICY "Allow authenticated users to update test_sessions" 
ON public.test_sessions FOR UPDATE 
TO authenticated 
USING (true);

-- Policy to allow authenticated users to delete test sessions
CREATE POLICY "Allow authenticated users to delete test_sessions" 
ON public.test_sessions FOR DELETE 
TO authenticated 
USING (true);
