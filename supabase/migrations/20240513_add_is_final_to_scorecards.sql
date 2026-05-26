
-- Add is_final column to scorecards
ALTER TABLE scorecards ADD COLUMN IF NOT EXISTS is_final BOOLEAN DEFAULT FALSE;

-- Update existing records to true (assuming existing records are all finalized)
UPDATE scorecards SET is_final = TRUE WHERE is_final IS FALSE;

-- Create a function to delete old drafts
CREATE OR REPLACE FUNCTION delete_old_draft_scorecards()
RETURNS void AS $$
BEGIN
    DELETE FROM scorecards
    WHERE is_final = FALSE
      AND created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;
