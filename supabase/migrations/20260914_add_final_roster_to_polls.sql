-- Add final_roster column to polls table
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS final_roster JSONB DEFAULT NULL;
