-- Update records table constraints to support course management
ALTER TABLE public.records DROP CONSTRAINT IF EXISTS records_type_check;
ALTER TABLE public.records ADD CONSTRAINT records_type_check CHECK (type IN ('analysis', 'lesson', 'training', 'course_management'));

ALTER TABLE public.records DROP CONSTRAINT IF EXISTS records_category_check;
ALTER TABLE public.records ADD CONSTRAINT records_category_check CHECK (category IN ('shot', 'pitch', 'bunker', 'approach', 'putt', 'physical', 'etc', 'field', 'short_game', 'shortgame', 'strategy', 'mental'));

-- Allow user_id to be null for general announcements/management posts
ALTER TABLE public.records ALTER COLUMN user_id DROP NOT NULL;
