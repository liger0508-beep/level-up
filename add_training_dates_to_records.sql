-- Add training period columns to records table
ALTER TABLE public.records 
ADD COLUMN IF NOT EXISTS training_start date,
ADD COLUMN IF NOT EXISTS training_end date;

-- Comments to describe usage
COMMENT ON COLUMN public.records.training_start IS 'Used for training type records to specify the start of a training period';
COMMENT ON COLUMN public.records.training_end IS 'Used for training type records to specify the end of a training period';
