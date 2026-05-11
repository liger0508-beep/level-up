-- Add columns to records table for Training Journal support
ALTER TABLE records ADD COLUMN IF NOT EXISTS is_important BOOLEAN DEFAULT false;
ALTER TABLE records ADD COLUMN IF NOT EXISTS keywords TEXT[] DEFAULT '{}';

-- Update records table constraints to support journals
ALTER TABLE public.records DROP CONSTRAINT IF EXISTS records_type_check;
ALTER TABLE public.records ADD CONSTRAINT records_type_check CHECK (type IN ('analysis', 'lesson', 'training', 'course_management', 'journal'));

ALTER TABLE public.records DROP CONSTRAINT IF EXISTS records_category_check;
ALTER TABLE public.records ADD CONSTRAINT records_category_check CHECK (category IN ('shot', 'pitch', 'bunker', 'approach', 'putt', 'physical', 'etc', 'field', 'short_game', 'shortgame', 'strategy', 'mental', 'good', 'miss'));

-- Optional: Add a comment to describe the columns
COMMENT ON COLUMN records.is_important IS 'Whether the record is marked as important';
COMMENT ON COLUMN records.keywords IS 'Keywords/tags for the record';

