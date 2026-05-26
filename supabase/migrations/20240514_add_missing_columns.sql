-- Migration to add missing columns used in the application
-- 1. Add related_id to records table to link training records to templates
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS related_id UUID;

-- 2. Add type to todos table for filtering (training, task, etc.)
ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'todo';

-- 3. Ensure foreign key names match those used in the application if they were auto-generated differently
-- (Optional, but helps with consistency if we know the names)
-- ALTER TABLE public.records DROP CONSTRAINT IF EXISTS records_user_id_fkey;
-- ALTER TABLE public.records ADD CONSTRAINT records_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);
-- ALTER TABLE public.records DROP CONSTRAINT IF EXISTS records_coach_id_fkey;
-- ALTER TABLE public.records ADD CONSTRAINT records_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.users(id);
