-- Add hole_count column to scorecards table
ALTER TABLE scorecards ADD COLUMN IF NOT EXISTS hole_count INTEGER DEFAULT 18;

-- Update existing records to 18 holes by default
UPDATE scorecards SET hole_count = 18 WHERE hole_count IS NULL;
