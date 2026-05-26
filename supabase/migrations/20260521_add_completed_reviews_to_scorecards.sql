ALTER TABLE IF EXISTS public.scorecards
ADD COLUMN IF NOT EXISTS completed_reviews INTEGER[] DEFAULT '{}';
