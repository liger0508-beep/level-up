CREATE TABLE public.scorecard_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scorecard_id uuid NOT NULL REFERENCES public.scorecards(id) ON DELETE CASCADE,
  athlete_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Filtering fields
  hole_count smallint NOT NULL,
  round_date date NOT NULL,
  
  -- Basic Info
  total_score smallint NOT NULL,
  rounds smallint DEFAULT 1,
  
  -- Long Game SG
  tee_dist_sg real DEFAULT 0,
  tee_acc_sg real DEFAULT 0,
  dist_180_plus_sg real DEFAULT 0,
  dist_150_179_sg real DEFAULT 0,
  dist_120_149_sg real DEFAULT 0,
  dist_90_119_sg real DEFAULT 0,
  
  -- Short Game SG
  pitch_sg real DEFAULT 0,
  bunker_sg real DEFAULT 0,
  approach_sg real DEFAULT 0,
  
  -- Putting SG
  putt_9_plus_sg real DEFAULT 0,
  putt_4_8_sg real DEFAULT 0,
  putt_2_3_sg real DEFAULT 0,
  putt_1_sg real DEFAULT 0,
  
  -- Freq & Others
  fw_hits smallint DEFAULT 0,
  fw_total smallint DEFAULT 0,
  gir_hits smallint DEFAULT 0,
  gir_total smallint DEFAULT 0,
  par_saves smallint DEFAULT 0,
  missed_gir_total smallint DEFAULT 0,
  
  total_putts real DEFAULT 0,
  three_putts real DEFAULT 0,
  penalty_ob real DEFAULT 0,
  
  bounce_backs smallint DEFAULT 0,
  bogey_or_worse smallint DEFAULT 0,
  birdie_or_better real DEFAULT 0,
  
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX idx_scorecard_summary_scorecard_id ON public.scorecard_summary(scorecard_id);
CREATE INDEX idx_scorecard_summary_filter ON public.scorecard_summary(hole_count, round_date, athlete_id);

-- Set up RLS
ALTER TABLE public.scorecard_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read access" 
ON public.scorecard_summary FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow authenticated insert access" 
ON public.scorecard_summary FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Allow authenticated update access" 
ON public.scorecard_summary FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Allow authenticated delete access" 
ON public.scorecard_summary FOR DELETE 
TO authenticated 
USING (true);
