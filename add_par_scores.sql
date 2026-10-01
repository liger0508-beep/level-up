ALTER TABLE public.scorecard_summary 
ADD COLUMN par3_score_total smallint DEFAULT 0,
ADD COLUMN par3_count smallint DEFAULT 0,
ADD COLUMN par4_score_total smallint DEFAULT 0,
ADD COLUMN par4_count smallint DEFAULT 0,
ADD COLUMN par5_score_total smallint DEFAULT 0,
ADD COLUMN par5_count smallint DEFAULT 0;
